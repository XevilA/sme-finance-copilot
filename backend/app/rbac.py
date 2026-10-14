"""Role-based access control for the API layer.

What this is: the role model and the decision points. A caller is resolved to a
`users` row, and a route can require one of a set of roles.

What this is NOT: authentication. The caller identity comes from an
`X-User-Email` header, which anyone can set. It carries no proof. Treat it as a
role switch for the demo and for wiring the UI, never as a security boundary.
Before this touches real financial data it needs a real credential - a signed
token checked against a secret, or a session issued after a password check -
and this module is where that check belongs.

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

RBAC_ENFORCED = os.getenv("RBAC_ENFORCED", "false").strip().lower() == "true"

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


async def resolve_principal(x_user_email: str | None = Header(default=None)) -> Principal:
    """FastAPI dependency. Returns a permissive principal when enforcement is off."""
    if not RBAC_ENFORCED:
        return ANONYMOUS_UNENFORCED

    if not x_user_email:
        raise HTTPException(status_code=401, detail="X-User-Email is required while RBAC_ENFORCED is on")
    if not DB_ENABLED:
        raise HTTPException(status_code=503, detail="RBAC_ENFORCED requires DATABASE_URL to resolve roles")

    async with session_scope() as session:
        user = await session.scalar(select(User).where(User.email == x_user_email.strip().lower()))

    if user is None or not user.active:
        # Same answer for unknown and deactivated, so the response does not
        # confirm which addresses exist.
        raise HTTPException(status_code=403, detail="Unknown or inactive user")

    return Principal(user.email, user.role, user.sme_id, user.investor_id, enforced=True)


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
