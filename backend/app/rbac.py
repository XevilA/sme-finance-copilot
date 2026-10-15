"""Role-based access control for the API layer.

What this is: the role model and the decision points. A caller is resolved to a
`users` row, and a route can require one of a set of roles.

Identity comes from a signed access token: `Authorization: Bearer <token>`,
issued by `POST /api/auth/login` against the password stored for the user and
verified here against AUTH_SECRET. See app/security.py.

The old `X-User-Email` header carried no proof of anything and is no longer
accepted while enforcement is on. It remains available only behind
AUTH_DEV_HEADER=true, for local work against a throwaway database, and that
setting is reported through /health so an instance running with it cannot look
secure.

Enforcement is off by default. The deployed frontend calls these routes with no
headers at all, so turning enforcement on without a plan would start rejecting
the UI that works today. Set RBAC_ENFORCED=true to switch it on, which is a
deliberate, reversible step.
"""

import os
import uuid
from dataclasses import dataclass

from fastapi import Header, HTTPException
from sqlalchemy import select

from .db import DB_ENABLED, session_scope
from .models import User
from .security import AuthConfigError, TokenError, read_token, secret_configured

RBAC_ENFORCED = os.getenv("RBAC_ENFORCED", "false").strip().lower() == "true"
# Escape hatch for local development only: accepts an unauthenticated
# X-User-Email header as identity. Never enable this on a reachable instance.
AUTH_DEV_HEADER = os.getenv("AUTH_DEV_HEADER", "false").strip().lower() == "true"

ALL_ROLES = ("sme_owner", "investor", "analyst", "admin")
# Who may see another party's funding detail on the funder screen.
FUNDER_ROLES = frozenset({"investor", "analyst", "admin"})


@dataclass(frozen=True)
class Principal:
    """The resolved caller. `enforced` records whether this was actually checked."""

    email: str | None
    role: str | None
    sme_id: uuid.UUID | None
    investor_id: uuid.UUID | None
    enforced: bool
    # How identity was established: "token", "dev_header", or None when
    # enforcement is off and nothing was checked.
    method: str | None = None

    @property
    def is_anonymous(self) -> bool:
        return self.role is None

    def may(self, *roles: str) -> bool:
        if not self.enforced:
            return True
        return self.role in roles

    def owns_sme(self, sme_id: uuid.UUID | None) -> bool:
        """An sme_owner may only act for its own SME; staff roles are not scoped."""
        if not self.enforced:
            return True
        if self.role in {"admin", "analyst"}:
            return True
        return sme_id is not None and self.sme_id == sme_id


ANONYMOUS_UNENFORCED = Principal(None, None, None, None, enforced=False)


async def resolve_principal(
    authorization: str | None = Header(default=None),
    x_user_email: str | None = Header(default=None),
) -> Principal:
    """FastAPI dependency. Returns a permissive principal when enforcement is off.

    With enforcement on, a verified Bearer token is the only accepted identity
    unless AUTH_DEV_HEADER is explicitly turned on.
    """
    if not RBAC_ENFORCED:
        return ANONYMOUS_UNENFORCED

    if not DB_ENABLED:
        raise HTTPException(status_code=503, detail="RBAC_ENFORCED requires DATABASE_URL to resolve roles")

    bearer = _bearer(authorization)
    if bearer:
        try:
            payload = read_token(bearer)
        except AuthConfigError as exc:
            # A misconfigured server must not look like a rejected caller.
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except TokenError:
            # One answer for malformed, wrongly signed and expired alike, so a
            # caller cannot probe which part of the token was wrong.
            raise HTTPException(status_code=401, detail="Invalid or expired token") from None
        email = str(payload["email"]).strip().lower()
        method = "token"
    elif AUTH_DEV_HEADER and x_user_email:
        email = x_user_email.strip().lower()
        method = "dev_header"
    else:
        raise HTTPException(
            status_code=401,
            detail="Authorization: Bearer <token> is required; obtain one from POST /api/auth/login",
        )

    # The token says who the caller is; the database still decides what they are
    # now, so a deactivated account or a changed role takes effect immediately
    # instead of living until the token expires.
    async with session_scope() as session:
        user = await session.scalar(select(User).where(User.email == email))

    if user is None or not user.active:
        # Same answer for unknown and deactivated, so the response does not
        # confirm which addresses exist.
        raise HTTPException(status_code=403, detail="Unknown or inactive user")

    return Principal(user.email, user.role, user.sme_id, user.investor_id, enforced=True, method=method)


def _bearer(header: str | None) -> str | None:
    if not header:
        return None
    scheme, _, value = header.partition(" ")
    if scheme.lower() != "bearer":
        return None
    return value.strip() or None


def auth_status() -> dict:
    """Reported through /health so an insecure configuration is visible."""
    return {
        "enforced": RBAC_ENFORCED,
        "secretConfigured": secret_configured(),
        "devHeaderAccepted": AUTH_DEV_HEADER,
    }


def require(principal: Principal, *roles: str) -> Principal:
    """Raises 403 unless the principal holds one of `roles`."""
    if not principal.may(*roles):
        raise HTTPException(
            status_code=403,
            detail=f"Role {principal.role or 'anonymous'} may not perform this action",
        )
    return principal


def funder_access(role: str | None) -> bool:
    """Whether funder-only detail may be shown.

    With enforcement off this is True, and the response says which role it was
    asked about, so the UI can show the real answer once auth exists instead of
    a value that silently means "we did not check".
    """
    if not RBAC_ENFORCED:
        return True
    return role in FUNDER_ROLES
