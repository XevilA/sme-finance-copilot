"""POST /api/auth/login and GET /api/auth/me.

Issues the signed token that app/rbac.py verifies. Nothing else in the API
issues credentials.

Deliberate behaviours:
- One answer for every failed login, so the response cannot be used to find out
  which addresses exist or which have a password set.
- A user with no password_hash can never log in, rather than logging in with an
  empty password.
- The response never contains the password or the stored hash.
- Login works whether or not RBAC_ENFORCED is on, so a token can be obtained
  and tested before enforcement is switched on.
- Failed attempts are rate limited in the database (app/throttle.py), so the
  limit holds across replicas and restarts. Unknown addresses are counted too,
  or the lockout would say which addresses exist.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy import select
from starlette.concurrency import run_in_threadpool

from ..db import DB_ENABLED, session_scope
from ..models import User
from ..rbac import Principal, resolve_principal
from ..schemas import StrictModel
from ..security import AuthConfigError, issue_token, verify_password
from ..throttle import check as throttle_check
from ..throttle import record_failure, record_success

router = APIRouter(tags=["auth"])

# One message for every rejection, whatever the actual cause.
INVALID = "Invalid email or password"


class LoginRequest(StrictModel):
    # Bounded str rather than EmailStr: the address is only a lookup key, and
    # EmailStr would pull in email-validator for format checking we never use.
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=512)


@router.post("/auth/login")
async def login(request: LoginRequest) -> dict:
    if not DB_ENABLED:
        raise HTTPException(status_code=503, detail="Login requires DATABASE_URL")

    identifier = request.email.strip().lower()

    # Checked before the password is verified, so a locked-out caller does not
    # get to spend scrypt time on every attempt either.
    async with session_scope() as session:
        retry_after = await throttle_check(session, identifier)
    if retry_after is not None:
        raise HTTPException(
            status_code=429,
            detail="Too many failed attempts. Try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    async with session_scope() as session:
        user = await session.scalar(select(User).where(User.email == identifier))

    # scrypt is intentionally slow, so it runs off the event loop. It is also
    # run for a missing user, so a wrong address and a wrong password take a
    # similar amount of time.
    stored = user.password_hash if user else None
    correct = await run_in_threadpool(verify_password, request.password, stored)

    if user is None or not user.active or not correct:
        # Counted for unknown addresses too: throttling only real accounts
        # would reveal which addresses exist.
        async with session_scope() as session:
            await record_failure(session, identifier)
        raise HTTPException(status_code=401, detail=INVALID)

    try:
        token, expires_at = issue_token(
            user_id=str(user.id),
            email=user.email,
            role=user.role,
            sme_id=str(user.sme_id) if user.sme_id else None,
            investor_id=str(user.investor_id) if user.investor_id else None,
        )
    except AuthConfigError as exc:
        # The server cannot sign; that is not the caller's fault, so this is not
        # counted as a failed attempt.
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    # A correct password forgives earlier typos.
    async with session_scope() as session:
        await record_success(session, identifier)

    return {
        "data": {
            "accessToken": token,
            "tokenType": "Bearer",
            "expiresAt": expires_at,
            "user": {
                "id": str(user.id),
                "email": user.email,
                "fullName": user.full_name,
                "role": user.role,
                "smeId": str(user.sme_id) if user.sme_id else None,
                "investorId": str(user.investor_id) if user.investor_id else None,
            },
        },
        "status": "ok",
    }


@router.get("/auth/me")
async def me(principal: Principal = Depends(resolve_principal)) -> dict:
    """Who the server thinks you are.

    With enforcement off this reports an unauthenticated caller rather than
    pretending to have checked anything.
    """
    return {
        "data": {
            "email": principal.email,
            "role": principal.role,
            "smeId": str(principal.sme_id) if principal.sme_id else None,
            "investorId": str(principal.investor_id) if principal.investor_id else None,
            "authenticated": principal.enforced and principal.role is not None,
            "method": principal.method,
        },
        "status": "ok",
        "rbacEnforced": principal.enforced,
    }
