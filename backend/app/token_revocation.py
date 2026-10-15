"""Taking a signed token back before it expires.

app/security.py can tell whether a token is authentic. It cannot tell whether
it is still wanted, because that is a fact about the account, not about the
bytes. This module holds that fact, in the same shape as app/throttle.py: raw
statements, a session passed in, and a `None` session meaning nothing was read.

Two mechanisms, because they answer different questions.

**`revoked_tokens`, keyed by the token's own id.** "Log this session out." It
needs the id of the token being revoked, which the caller presents, and it
leaves that user's other sessions alone. The row stores the id, never the
token: an id without the signing secret cannot be turned back into a
credential, so the table is not a store of live credentials.

**`users.tokens_valid_from`, a cutoff per account.** "This account is
compromised, kill everything." A denylist cannot serve that case - the stolen
token is exactly the one nobody can list - so a cutoff refuses every token
issued at or before an instant, without needing to know any of them. It costs
no extra query, because app/rbac.py already loads the user row on every
enforced request to decide the role.

**Not checked is never reported as not revoked.** With no session the denylist
was not read, so `is_revoked` answers True. Enforcement already requires a
database, so no caller reaches that branch; the direction of the failure is
what matters.
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# How long a revoked row is kept past the moment its token would have expired
# anyway. The token is already refused by then, so this is only slack against
# clock skew between the API and the database.
PURGE_GRACE_SECONDS = 60 * 60


def cutoff_blocks(issued_at: int, tokens_valid_from: datetime | None) -> bool:
    """Whether an account-wide cutoff refuses a token issued at `issued_at`.

    `iat` carries whole seconds, so a token issued in the same second as the
    cutoff cannot be ordered against it. It is refused: a token that survives
    the compromise it was meant to be cut off by is the worse outcome, and the
    cost of the other direction is one retry on a login made inside that
    second.
    """
    if tokens_valid_from is None:
        return False
    cutoff = tokens_valid_from
    if cutoff.tzinfo is None:
        cutoff = cutoff.replace(tzinfo=timezone.utc)
    return issued_at <= int(cutoff.timestamp())


async def is_revoked(
    session: AsyncSession | None,
    *,
    jti: str,
    issued_at: int,
    tokens_valid_from: datetime | None,
) -> bool:
    """Whether this token has been taken back, by either mechanism.

    The cutoff is checked first because it needs no query - the caller already
    holds the user row.
    """
    if cutoff_blocks(issued_at, tokens_valid_from):
        return True
    if session is None:
        # The denylist was not read. Nothing may be called live on that basis.
        return True
    found = await session.execute(
        text("SELECT 1 FROM revoked_tokens WHERE jti = :jti"), {"jti": jti}
    )
    return found.first() is not None


async def revoke_token(
    session: AsyncSession | None,
    *,
    jti: str,
    user_id: uuid.UUID | str,
    expires_at: int,
    reason: str | None = None,
) -> None:
    """Denies one token. Revoking an already revoked token is not an error.

    `expires_at` is the token's own `exp`, stored so a maintenance pass can
    drop the row without parsing the token it names.
    """
    if session is None:
        return
    await session.execute(
        text(
            """
            INSERT INTO revoked_tokens (jti, user_id, expires_at, reason)
            VALUES (:jti, :user_id, :expires_at, :reason)
            ON CONFLICT (jti) DO NOTHING
            """
        ),
        {
            "jti": jti,
            # asyncpg checks a parameter against the column type before any
            # SQL-side cast runs, so these are real Python objects.
            "user_id": user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id)),
            "expires_at": datetime.fromtimestamp(expires_at, timezone.utc),
            "reason": reason,
        },
    )


async def revoke_all_for_user(
    session: AsyncSession | None,
    *,
    user_id: uuid.UUID | str,
    at: datetime | None = None,
) -> datetime | None:
    """Sets the account's cutoff, refusing every token it has issued so far.

    Returns the cutoff actually stored, which is the database's own `now()`
    unless one was given, so the value does not depend on the API host's clock.
    """
    if session is None:
        return None
    identifier = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))
    if at is None:
        row = (
            await session.execute(
                text(
                    "UPDATE users SET tokens_valid_from = now() "
                    "WHERE id = :id RETURNING tokens_valid_from"
                ),
                {"id": identifier},
            )
        ).first()
    else:
        row = (
            await session.execute(
                text(
                    "UPDATE users SET tokens_valid_from = :at "
                    "WHERE id = :id RETURNING tokens_valid_from"
                ),
                {"id": identifier, "at": at},
            )
        ).first()
    return row[0] if row else None


async def cutoff_for_user(
    session: AsyncSession | None, *, user_id: uuid.UUID | str
) -> datetime | None:
    """The account's cutoff, or None when it has never had one."""
    if session is None:
        return None
    identifier = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))
    row = (
        await session.execute(
            text("SELECT tokens_valid_from FROM users WHERE id = :id"),
            {"id": identifier},
        )
    ).first()
    return row[0] if row else None


async def purge_expired(session: AsyncSession | None) -> int:
    """Drops rows for tokens that would have expired on their own by now.

    A maintenance helper, not part of a request: putting a delete on the login
    or logout path would charge every caller for housekeeping. The denylist
    only ever holds tokens that are still live, so it stays small either way.
    """
    if session is None:
        return 0
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=PURGE_GRACE_SECONDS)
    result = await session.execute(
        text("DELETE FROM revoked_tokens WHERE expires_at < :cutoff"), {"cutoff": cutoff}
    )
    return result.rowcount or 0
