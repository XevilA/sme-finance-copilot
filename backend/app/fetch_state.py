"""Provider-wide rate limit gate, shared by every worker.

The news fetcher must not be called once per page render, and several replicas
calling it at the same moment is what produced HTTP 429 during verification.
`provider_fetch_state` holds one row per provider and `next_allowed_at` is the
gate.

Two separate mechanisms, because they solve different problems:

**next_allowed_at** spaces calls out over time, including the backoff after a
failure and any Retry-After the provider asked for.

**pg_try_advisory_xact_lock** stops two workers calling at the same instant. It is
tried, not waited on: a worker that cannot take it has nothing to add to the one
that holds it, so it serves what is cached instead of queueing behind a network
call.

Backoff doubles per consecutive failure from the base delay up to the ceiling. A
success clears the counter, so one bad response does not punish the next hour.
"""

import os
import hashlib
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Minimum spacing between successful calls, and the backoff bounds.
DEFAULT_MIN_INTERVAL_SECONDS = 300
DEFAULT_BACKOFF_BASE_SECONDS = 60
DEFAULT_BACKOFF_CEILING_SECONDS = 3600

# Derived from the provider name so two providers never block each other.
LOCK_NAMESPACE = 918_273


def setting(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw.isdigit() or int(raw) <= 0:
        return default
    return int(raw)


def min_interval() -> int:
    return setting("PROVIDER_MIN_INTERVAL_SECONDS", DEFAULT_MIN_INTERVAL_SECONDS)


def lock_key(provider: str) -> int:
    """A stable signed 32-bit key, since advisory locks take integers."""
    # Python hash() is randomized per interpreter, so it cannot coordinate
    # independent workers. Keep the key deterministic across process restarts.
    return LOCK_NAMESPACE + int.from_bytes(hashlib.sha256(provider.encode()).digest()[:4], "big") % 100_000


@dataclass(frozen=True)
class Gate:
    """Whether a call may go out, and why not when it may not."""

    allowed: bool
    reason: str | None = None
    retry_after_seconds: int | None = None
    consecutive_failures: int = 0

    @property
    def blocked_by_rate_limit(self) -> bool:
        return not self.allowed and self.reason == "rate_limited"


async def acquire(session: AsyncSession | None, provider: str, *, force: bool = False) -> Gate:
    """Checks the gate under a transaction lock held through the network call.

    `force` skips the time gate but still respects the lock, so a manual refresh
    cannot be used to stampede the provider from several workers at once.
    """
    if session is None:
        # No database means no coordination is possible. Allowing the call is
        # the honest answer: the caller is a single local process.
        return Gate(allowed=True, reason="no_coordination")

    # Transaction lock cannot escape into a pooled connection and remains held
    # until the updated backoff/cache state commits. Check time only AFTER
    # locking, so a concurrent worker cannot act on a stale pre-commit gate.
    acquired = (await session.execute(
        text("SELECT pg_try_advisory_xact_lock(:k)"), {"k": lock_key(provider)}
    )).scalar_one()
    if not acquired:
        return Gate(allowed=False, reason="another_worker_is_fetching")
    now = datetime.now(timezone.utc)
    row = (
        await session.execute(
            text(
                "SELECT next_allowed_at, consecutive_failures FROM provider_fetch_state "
                "WHERE provider = :p"
            ),
            {"p": provider},
        )
    ).first()

    failures = row[1] if row else 0
    if row and row[0] is not None and not force and row[0] > now:
        return Gate(
            allowed=False,
            reason="rate_limited",
            retry_after_seconds=max(1, int((row[0] - now).total_seconds())),
            consecutive_failures=failures,
        )

    await session.execute(
        text(
            """
            INSERT INTO provider_fetch_state (provider, last_attempt_at, updated_at)
            VALUES (:p, :now, :now)
            ON CONFLICT (provider) DO UPDATE SET
                last_attempt_at = :now,
                updated_at = :now
            """
        ),
        {"p": provider, "now": now},
    )
    return Gate(allowed=True, consecutive_failures=failures)


async def release(session: AsyncSession | None, provider: str) -> None:
    """Compatibility hook: transaction locks release on commit/rollback only.

    Unlocking before the gate update commits would let another worker read a
    stale gate. The route keeps its session open through fetch and persistence.
    """
    return None


async def record_success(session: AsyncSession | None, provider: str) -> None:
    """Clears the failure count and spaces out the next call."""
    if session is None:
        return
    now = datetime.now(timezone.utc)
    await session.execute(
        text(
            """
            UPDATE provider_fetch_state SET
                last_success_at = :now,
                next_allowed_at = :next,
                consecutive_failures = 0,
                last_error = NULL,
                updated_at = :now
            WHERE provider = :p
            """
        ),
        {"p": provider, "now": now, "next": now + timedelta(seconds=min_interval())},
    )


async def record_failure(
    session: AsyncSession | None,
    provider: str,
    error: str,
    retry_after_seconds: int | None = None,
) -> int:
    """Applies backoff and returns the delay used.

    A Retry-After from the provider wins over our own backoff when it is longer:
    being asked to wait and then calling sooner is how a soft limit becomes a
    hard block.
    """
    if session is None:
        return 0
    now = datetime.now(timezone.utc)
    base = setting("PROVIDER_BACKOFF_BASE_SECONDS", DEFAULT_BACKOFF_BASE_SECONDS)
    ceiling = setting("PROVIDER_BACKOFF_CEILING_SECONDS", DEFAULT_BACKOFF_CEILING_SECONDS)

    current = (
        await session.execute(
            text("SELECT consecutive_failures FROM provider_fetch_state WHERE provider = :p"),
            {"p": provider},
        )
    ).scalar()
    failures = (current or 0) + 1
    delay = min(base * (2 ** (failures - 1)), ceiling)
    if retry_after_seconds:
        delay = max(delay, min(retry_after_seconds, ceiling))

    await session.execute(
        text(
            """
            INSERT INTO provider_fetch_state
                (provider, last_attempt_at, next_allowed_at, consecutive_failures, last_error, updated_at)
            VALUES (:p, :now, :next, 1, :error, :now)
            ON CONFLICT (provider) DO UPDATE SET
                last_attempt_at = :now,
                next_allowed_at = :next,
                consecutive_failures = :failures,
                last_error = :error,
                updated_at = :now
            """
        ),
        {"p": provider, "now": now, "next": now + timedelta(seconds=delay),
         "failures": failures, "error": error[:500]},
    )
    return delay


async def status(session: AsyncSession | None, provider: str) -> dict:
    """Reported alongside a trends response so the gate is visible."""
    if session is None:
        return {"provider": provider, "coordinated": False}
    row = (
        await session.execute(
            text(
                "SELECT last_attempt_at, last_success_at, next_allowed_at, "
                "consecutive_failures, last_error FROM provider_fetch_state WHERE provider = :p"
            ),
            {"p": provider},
        )
    ).first()
    if row is None:
        return {"provider": provider, "coordinated": True, "state": "never_called"}
    return {
        "provider": provider,
        "coordinated": True,
        "lastAttemptAt": row[0].isoformat() if row[0] else None,
        "lastSuccessAt": row[1].isoformat() if row[1] else None,
        "nextAllowedAt": row[2].isoformat() if row[2] else None,
        "consecutiveFailures": row[3],
        "lastError": row[4],
    }
