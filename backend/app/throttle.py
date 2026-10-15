"""Login rate limiting, held in the database.

In-process counters do not survive a restart and do not apply across replicas,
so an attacker gets a fresh allowance from every instance. The counter lives in
`auth_throttle` instead.

Two things it deliberately does not do:

**It does not store the addresses that were tried.** The key is a SHA-256 of the
identifier with the signing secret mixed in, so the table cannot be read as a
list of attempted accounts, and the same address produces the same key only on
this deployment.

**It does not distinguish an existing account from a missing one.** Throttling
only real accounts would turn the lockout into an oracle for which addresses
exist, so every attempt is counted the same way.
"""

import hashlib
import os
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Defaults: 8 failures in 15 minutes, then locked for 15 minutes. Generous
# enough for someone fumbling a password, far too slow to guess one.
DEFAULT_MAX_ATTEMPTS = 8
DEFAULT_WINDOW_SECONDS = 15 * 60
DEFAULT_BLOCK_SECONDS = 15 * 60


def setting(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw.isdigit() or int(raw) <= 0:
        return default
    return int(raw)


def max_attempts() -> int:
    return setting("AUTH_MAX_ATTEMPTS", DEFAULT_MAX_ATTEMPTS)


def window_seconds() -> int:
    return setting("AUTH_ATTEMPT_WINDOW_SECONDS", DEFAULT_WINDOW_SECONDS)


def block_seconds() -> int:
    return setting("AUTH_BLOCK_SECONDS", DEFAULT_BLOCK_SECONDS)


def throttle_key(identifier: str) -> str:
    """Hashed so the table is not a list of attempted addresses."""
    pepper = os.getenv("AUTH_SECRET", "")
    return hashlib.sha256(f"login:{pepper}:{identifier.strip().lower()}".encode("utf-8")).hexdigest()


async def check(session: AsyncSession | None, identifier: str) -> int | None:
    """Returns seconds remaining if locked out, otherwise None."""
    if session is None:
        return None
    now = datetime.now(timezone.utc)
    row = (
        await session.execute(
            text("SELECT blocked_until FROM auth_throttle WHERE key_hash = :k"),
            {"k": throttle_key(identifier)},
        )
    ).first()
    if row is None or row[0] is None:
        return None
    blocked_until = row[0]
    if blocked_until <= now:
        return None
    return max(1, int((blocked_until - now).total_seconds()))


async def record_failure(session: AsyncSession | None, identifier: str) -> None:
    """Counts one failure, starting a new window or locking out as needed."""
    if session is None:
        return
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(seconds=window_seconds())
    blocked_until = now + timedelta(seconds=block_seconds())

    # One statement so two concurrent failures cannot both read a stale count.
    # A window older than the cutoff restarts at one attempt; otherwise the
    # count increments, and reaching the limit sets blocked_until.
    await session.execute(
        text(
            """
            INSERT INTO auth_throttle (key_hash, window_start, attempts, blocked_until, updated_at)
            VALUES (:k, :now, 1, NULL::timestamptz, :now)
            ON CONFLICT (key_hash) DO UPDATE SET
                window_start = CASE
                    WHEN auth_throttle.window_start < :cutoff THEN CAST(:now AS timestamptz)
                    ELSE auth_throttle.window_start END,
                attempts = CASE
                    WHEN auth_throttle.window_start < :cutoff THEN 1
                    ELSE auth_throttle.attempts + 1 END,
                -- Casts are explicit because Postgres cannot infer a type for a
                -- bare NULL branch, and reads the whole CASE as text without them.
                blocked_until = CASE
                    WHEN auth_throttle.window_start >= :cutoff
                         AND auth_throttle.attempts + 1 >= :limit THEN CAST(:blocked AS timestamptz)
                    ELSE NULL::timestamptz END,
                updated_at = :now
            """
        ),
        {"k": throttle_key(identifier), "now": now, "cutoff": cutoff,
         "limit": max_attempts(), "blocked": blocked_until},
    )


async def record_success(session: AsyncSession | None, identifier: str) -> None:
    """Clears the counter, so a correct password forgives earlier typos."""
    if session is None:
        return
    await session.execute(
        text("DELETE FROM auth_throttle WHERE key_hash = :k"),
        {"k": throttle_key(identifier)},
    )


async def purge_expired(session: AsyncSession | None) -> int:
    """Drops rows whose window and block have both passed."""
    if session is None:
        return 0
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=window_seconds() + block_seconds())
    result = await session.execute(
        text(
            "DELETE FROM auth_throttle WHERE window_start < :cutoff "
            "AND (blocked_until IS NULL OR blocked_until < now())"
        ),
        {"cutoff": cutoff},
    )
    return result.rowcount or 0
