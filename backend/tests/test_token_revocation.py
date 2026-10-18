"""Token revocation: one session, a whole account, and what the API exposes.

Until now a signed token was valid until it expired, which is why the lifetime
was clamped to seven days - there was no way to take one back. Two mechanisms
replace that, because they answer different questions:

- a **denylist keyed by the token's own id**, for "log this session out", and
- a **per-user cutoff**, for "this account is compromised, kill everything",
  which is the case a denylist cannot serve because the stolen token is exactly
  the one you do not have.

The decision is checked on every enforced request, so a route that trusts a
token is the thing being tested here, not just the table.
"""

import asyncio
import base64
import json
import os
import subprocess
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app import token_revocation as revocation
from app.db import DB_ENABLED, session_scope
from app.main import app
from app.security import (
    TOKEN_VERSION,
    TokenError,
    hash_password,
    issue_token,
    read_token,
)

client = TestClient(app)
BACKEND = Path(__file__).resolve().parents[1]
SECRET = "k" * 40

# Users created by this file only. Fixed ids so a crashed run cannot leave rows
# that a later run mistakes for someone real.
ANALYST = uuid.UUID("aaaaaaaa-0000-4000-8000-000000000001")
ADMIN = uuid.UUID("aaaaaaaa-0000-4000-8000-000000000002")
ANALYST_EMAIL = "revocation-analyst@example.test"
ADMIN_EMAIL = "revocation-admin@example.test"
TEST_PASSWORD = "revocation-test-password"


def with_secret(secret: str = SECRET) -> None:
    os.environ["AUTH_SECRET"] = secret


def database_reachable() -> bool:
    if not DB_ENABLED:
        return False

    async def ping() -> None:
        async with session_scope() as session:
            await session.execute(text("SELECT 1"))

    try:
        asyncio.run(ping())
        return True
    except Exception:
        return False


HAS_DB = database_reachable()
needs_db = pytest.mark.skipif(not HAS_DB, reason="no reachable DATABASE_URL")


def run(coro_factory):
    async def wrapper():
        async with session_scope() as session:
            return await coro_factory(session)

    return asyncio.run(wrapper())


@pytest.fixture
def users():
    """Two accounts with a known password, removed again afterwards.

    Created here rather than reusing the demo login user, so these tests run
    without DEMO_LOGIN_PASSWORD being set.
    """
    digest = hash_password(TEST_PASSWORD)

    async def create(session):
        for user_id, email, role in ((ANALYST, ANALYST_EMAIL, "analyst"),
                                     (ADMIN, ADMIN_EMAIL, "admin")):
            await session.execute(
                text(
                    """
                    INSERT INTO users (id, email, full_name, role, password_hash, active)
                    VALUES (:id, :email, :name, :role, :hash, TRUE)
                    ON CONFLICT (id) DO UPDATE SET
                        email = EXCLUDED.email, role = EXCLUDED.role,
                        password_hash = EXCLUDED.password_hash, active = TRUE,
                        tokens_valid_from = NULL
                    """
                ),
                {"id": user_id, "email": email, "name": "Revocation Test",
                 "role": role, "hash": digest},
            )

    run(create)
    yield {"analyst": ANALYST, "admin": ADMIN}

    async def remove(session):
        await session.execute(
            text("DELETE FROM users WHERE id = ANY(:ids)"),
            {"ids": [ANALYST, ADMIN]},
        )

    run(remove)


# --- the token itself --------------------------------------------------------

def test_every_token_carries_its_own_id():
    """Without a per-token id, one session cannot be revoked without the rest."""
    with_secret()
    first, _ = issue_token(user_id="u1", email="a@b.test", role="analyst")
    second, _ = issue_token(user_id="u1", email="a@b.test", role="analyst")
    assert read_token(first)["jti"] != read_token(second)["jti"]
    assert len(read_token(first)["jti"]) >= 16


def test_a_token_without_an_id_is_rejected():
    """A token that cannot be named cannot be revoked, so it is not accepted."""
    with_secret()
    payload = {
        "v": TOKEN_VERSION, "sub": "u1", "email": "a@b.test", "role": "admin",
        "sme_id": None, "investor_id": None,
        "iat": int(time.time()), "exp": int(time.time()) + 600,
    }
    with pytest.raises(TokenError):
        read_token(_sign(payload))


def test_tokens_issued_before_this_version_are_rejected():
    """Upgrading is itself a revocation: v1 tokens had no id to revoke by."""
    with_secret()
    payload = {
        "v": "v1", "sub": "u1", "email": "a@b.test", "role": "admin",
        "sme_id": None, "investor_id": None,
        "iat": int(time.time()), "exp": int(time.time()) + 600,
    }
    with pytest.raises(TokenError):
        read_token(_sign(payload))


# --- the cutoff decision, without a database --------------------------------

def test_no_cutoff_revokes_nothing():
    assert revocation.cutoff_blocks(int(time.time()), None) is False


def test_a_cutoff_revokes_a_token_issued_before_it():
    now = datetime.now(timezone.utc)
    issued = int((now - timedelta(minutes=5)).timestamp())
    assert revocation.cutoff_blocks(issued, now) is True


def test_a_cutoff_does_not_revoke_a_token_issued_after_it():
    now = datetime.now(timezone.utc)
    issued = int((now + timedelta(seconds=5)).timestamp())
    assert revocation.cutoff_blocks(issued, now) is False


def test_a_token_issued_in_the_same_second_as_the_cutoff_is_revoked():
    """`iat` has one-second resolution, so the boundary has to fail closed.

    The alternative lets a token issued in the same second as a compromise
    report survive it. The cost is that logging in again within that second
    needs one retry, which is the cheaper mistake.
    """
    now = datetime.now(timezone.utc).replace(microsecond=0)
    assert revocation.cutoff_blocks(int(now.timestamp()), now) is True


def test_without_a_session_a_token_is_treated_as_revoked():
    """The denylist was not read, so nothing may be called live.

    Same rule as the obligation loaders: not-checked is never reported as
    not-found. No caller reaches this - enforcement already requires a
    database - but the direction of the failure is the point.
    """
    assert asyncio.run(
        revocation.is_revoked(None, jti="whatever", issued_at=int(time.time()),
                              tokens_valid_from=None)
    ) is True


# --- the denylist -----------------------------------------------------------

@needs_db
def test_revoking_one_token_leaves_the_others_alone(users):
    with_secret()
    first, first_exp = issue_token(user_id=str(ANALYST), email=ANALYST_EMAIL, role="analyst")
    second, _ = issue_token(user_id=str(ANALYST), email=ANALYST_EMAIL, role="analyst")
    one, two = read_token(first), read_token(second)

    run(lambda s: revocation.revoke_token(
        s, jti=one["jti"], user_id=ANALYST, expires_at=first_exp, reason="logout"))

    assert run(lambda s: revocation.is_revoked(
        s, jti=one["jti"], issued_at=one["iat"], tokens_valid_from=None)) is True
    assert run(lambda s: revocation.is_revoked(
        s, jti=two["jti"], issued_at=two["iat"], tokens_valid_from=None)) is False


@needs_db
def test_revoking_the_same_token_twice_is_not_an_error(users):
    """Logging out twice is a double-click, not a failure."""
    with_secret()
    token, expires = issue_token(user_id=str(ANALYST), email=ANALYST_EMAIL, role="analyst")
    jti = read_token(token)["jti"]
    for _ in range(2):
        run(lambda s: revocation.revoke_token(
            s, jti=jti, user_id=ANALYST, expires_at=expires, reason="logout"))
    assert run(lambda s: revocation.is_revoked(
        s, jti=jti, issued_at=0, tokens_valid_from=None)) is True


@needs_db
def test_the_denylist_never_stores_the_token(users):
    """The row names the token; it does not contain a usable copy of it."""
    with_secret()
    token, expires = issue_token(user_id=str(ANALYST), email=ANALYST_EMAIL, role="analyst")
    jti = read_token(token)["jti"]
    run(lambda s: revocation.revoke_token(
        s, jti=jti, user_id=ANALYST, expires_at=expires, reason="logout"))

    async def read_row(session):
        result = await session.execute(
            text("SELECT * FROM revoked_tokens WHERE jti = :j"), {"j": jti})
        return dict(result.mappings().one())

    row = run(read_row)
    assert token not in " ".join(str(value) for value in row.values())
    assert row["jti"] == jti


# --- the per-user cutoff ----------------------------------------------------

@needs_db
def test_revoke_all_blocks_every_existing_token_for_that_account(users):
    with_secret()
    first, _ = issue_token(user_id=str(ANALYST), email=ANALYST_EMAIL, role="analyst")
    second, _ = issue_token(user_id=str(ANALYST), email=ANALYST_EMAIL, role="analyst")
    other, _ = issue_token(user_id=str(ADMIN), email=ADMIN_EMAIL, role="admin")

    cutoff = run(lambda s: revocation.revoke_all_for_user(s, user_id=ANALYST))
    stored = run(lambda s: revocation.cutoff_for_user(s, user_id=ANALYST))
    assert stored == cutoff

    for token in (first, second):
        payload = read_token(token)
        assert revocation.cutoff_blocks(payload["iat"], stored) is True

    # The other account was not touched.
    assert run(lambda s: revocation.cutoff_for_user(s, user_id=ADMIN)) is None
    assert revocation.cutoff_blocks(read_token(other)["iat"], None) is False


@needs_db
def test_a_login_after_revoke_all_is_accepted_again(users):
    """A cutoff is not a ban. The account still works; the old tokens do not."""
    with_secret()
    run(lambda s: revocation.revoke_all_for_user(s, user_id=ANALYST))
    cutoff = run(lambda s: revocation.cutoff_for_user(s, user_id=ANALYST))

    # One second on, so the boundary rule above cannot be what passes this.
    assert revocation.cutoff_blocks(int(cutoff.timestamp()) + 1, cutoff) is False


@needs_db
def test_purge_drops_expired_rows_and_keeps_live_ones(users):
    with_secret()
    now = int(time.time())
    live, _ = issue_token(user_id=str(ANALYST), email=ANALYST_EMAIL, role="analyst")
    live_jti = read_token(live)["jti"]
    dead_jti = "expired-" + uuid.uuid4().hex

    run(lambda s: revocation.revoke_token(
        s, jti=live_jti, user_id=ANALYST, expires_at=now + 3600, reason="logout"))
    # Well past the grace period, so the pass is not decided by a boundary.
    run(lambda s: revocation.revoke_token(
        s, jti=dead_jti, user_id=ANALYST,
        expires_at=now - revocation.PURGE_GRACE_SECONDS - 86400, reason="logout"))

    assert run(lambda s: revocation.purge_expired(s)) >= 1

    async def present(session, jti):
        found = await session.execute(
            text("SELECT 1 FROM revoked_tokens WHERE jti = :j"), {"j": jti})
        return found.first() is not None

    assert run(lambda s: present(s, live_jti)) is True
    assert run(lambda s: present(s, dead_jti)) is False


# --- the routes -------------------------------------------------------------

@needs_db
def test_logout_revokes_the_presented_token(users):
    with_secret()
    token, _ = issue_token(user_id=str(ANALYST), email=ANALYST_EMAIL, role="analyst")
    jti = read_token(token)["jti"]

    response = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200, response.text
    assert response.json()["data"]["revoked"] == "session"

    assert run(lambda s: revocation.is_revoked(
        s, jti=jti, issued_at=0, tokens_valid_from=None)) is True


@needs_db
def test_a_second_logout_with_the_same_token_is_refused(users):
    """A revoked token authenticates nothing, logout included.

    Written the other way round first, expecting an idempotent 200 on the
    second call. That was wrong: the second call presents a revoked
    credential, and letting it through would carve an exception into the one
    check this work exists to add. The caller loses nothing - their session is
    over either way - and `revoke_token` is still idempotent underneath, which
    `test_revoking_the_same_token_twice_is_not_an_error` pins.
    """
    with_secret()
    token, _ = issue_token(user_id=str(ANALYST), email=ANALYST_EMAIL, role="analyst")
    headers = {"Authorization": f"Bearer {token}"}
    assert client.post("/api/auth/logout", headers=headers).status_code == 200
    assert client.post("/api/auth/logout", headers=headers).status_code == 401


@needs_db
def test_revoke_all_over_http_sets_the_callers_own_cutoff(users):
    with_secret()
    token, _ = issue_token(user_id=str(ANALYST), email=ANALYST_EMAIL, role="analyst")
    response = client.post("/api/auth/revoke-all", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200, response.text
    assert response.json()["data"]["revoked"] == "all_sessions"
    assert run(lambda s: revocation.cutoff_for_user(s, user_id=ANALYST)) is not None


@needs_db
def test_the_credential_routes_refuse_an_unauthenticated_caller():
    """These manage credentials, so they verify a token even with RBAC off.

    RBAC_ENFORCED is false by default in this project. If these routes used the
    ordinary permissive principal, revoking someone else's sessions would be an
    unauthenticated call.
    """
    with_secret()
    for path in ("/api/auth/logout", "/api/auth/revoke-all", "/api/auth/revoke"):
        assert client.post(path, json={"email": ADMIN_EMAIL}).status_code == 401, path


@needs_db
def test_the_credential_routes_refuse_the_dev_header():
    """The escape hatch is for reading demo data, never for managing credentials."""
    with_secret()
    headers = {"X-User-Email": ADMIN_EMAIL}
    for path in ("/api/auth/logout", "/api/auth/revoke-all"):
        assert client.post(path, headers=headers).status_code == 401, path


@pytest.mark.skipif(DB_ENABLED, reason="asserts the behaviour without DATABASE_URL")
def test_without_a_database_these_routes_are_a_server_error_not_a_rejection():
    """503, checked before the missing token is noticed.

    Revocation is a fact in the database, so without one these routes cannot
    answer at all. Saying 401 would blame the caller for the server's
    configuration - the same rule login and resolve_principal already follow.
    """
    for path in ("/api/auth/logout", "/api/auth/revoke-all"):
        assert client.post(path).status_code == 503, path


@needs_db
def test_only_an_admin_may_revoke_another_account(users):
    with_secret()
    as_analyst, _ = issue_token(user_id=str(ANALYST), email=ANALYST_EMAIL, role="analyst")
    as_admin, _ = issue_token(user_id=str(ADMIN), email=ADMIN_EMAIL, role="admin")

    denied = client.post("/api/auth/revoke", json={"email": ADMIN_EMAIL},
                         headers={"Authorization": f"Bearer {as_analyst}"})
    assert denied.status_code == 403, denied.text
    assert run(lambda s: revocation.cutoff_for_user(s, user_id=ADMIN)) is None

    allowed = client.post("/api/auth/revoke", json={"email": ANALYST_EMAIL},
                          headers={"Authorization": f"Bearer {as_admin}"})
    assert allowed.status_code == 200, allowed.text
    assert run(lambda s: revocation.cutoff_for_user(s, user_id=ANALYST)) is not None


@needs_db
def test_an_admin_token_claiming_admin_is_not_enough(users):
    """The role comes from the database, as everywhere else in this API."""
    with_secret()
    forged, _ = issue_token(user_id=str(ANALYST), email=ANALYST_EMAIL, role="admin")
    response = client.post("/api/auth/revoke", json={"email": ADMIN_EMAIL},
                           headers={"Authorization": f"Bearer {forged}"})
    assert response.status_code == 403, response.text


@needs_db
def test_revoking_an_unknown_account_says_nothing_about_it(users):
    """Admin-only, but still not an oracle for which addresses exist."""
    with_secret()
    as_admin, _ = issue_token(user_id=str(ADMIN), email=ADMIN_EMAIL, role="admin")
    headers = {"Authorization": f"Bearer {as_admin}"}
    known = client.post("/api/auth/revoke", json={"email": ANALYST_EMAIL}, headers=headers)
    unknown = client.post("/api/auth/revoke", json={"email": "nobody@example.test"},
                          headers=headers)
    assert known.status_code == unknown.status_code == 200
    assert known.json()["data"] == unknown.json()["data"]


# --- end to end, with enforcement actually on -------------------------------

ENFORCED_SCRIPT = """
import json, sys
sys.path.insert(0, ".")
from fastapi.testclient import TestClient
from app.main import app

c = TestClient(app)
out = {}
login = c.post("/api/auth/login", json={"email": "%(email)s", "password": "%(password)s"})
out["login"] = login.status_code
token = login.json()["data"]["accessToken"] if login.status_code == 200 else ""
auth = {"Authorization": "Bearer " + token}

out["before"] = c.get("/api/auth/me", headers=auth).status_code
out["protected_before"] = c.get("/api/v1/funder/projects", headers=auth).status_code
out["logout"] = c.post("/api/auth/logout", headers=auth).status_code
out["after"] = c.get("/api/auth/me", headers=auth).status_code
out["protected_after"] = c.get("/api/v1/funder/projects", headers=auth).status_code

again = c.post("/api/auth/login", json={"email": "%(email)s", "password": "%(password)s"})
out["login_again"] = again.status_code
fresh = {"Authorization": "Bearer " + again.json()["data"]["accessToken"]}
out["fresh_token"] = c.get("/api/auth/me", headers=fresh).status_code
out["revoke_all"] = c.post("/api/auth/revoke-all", headers=fresh).status_code
out["after_revoke_all"] = c.get("/api/auth/me", headers=fresh).status_code
print(json.dumps(out))
"""


def run_enforced(email: str, password: str) -> dict:
    child_env = os.environ.copy()
    child_env.update({
        "RBAC_ENFORCED": "true",
        "AUTH_SECRET": SECRET,
        "DB_BOOTSTRAP": "off",
        "DB_POOL": "null",
        "PATH": "",
        "SYSTEMROOT": "C:\\\\Windows",
    })
    completed = subprocess.run(
        [sys.executable, "-c", ENFORCED_SCRIPT % {"email": email, "password": password}],
        cwd=BACKEND, capture_output=True, text=True, timeout=180,
        env=child_env,
    )
    assert completed.returncode == 0, completed.stderr[-2000:]
    return json.loads(completed.stdout.strip().splitlines()[-1])


@needs_db
def test_a_revoked_token_is_refused_by_a_protected_route(users):
    """The point of the whole change, proved against a route that trusts tokens."""
    result = run_enforced(ANALYST_EMAIL, TEST_PASSWORD)
    assert result["login"] == 200, result

    assert result["before"] == 200
    assert result["protected_before"] == 200

    assert result["logout"] == 200
    # Same answer as a forged or expired token: 401, with no hint that the
    # difference was revocation.
    assert result["after"] == 401
    assert result["protected_after"] == 401

    # Revocation killed the token, not the account.
    assert result["login_again"] == 200
    assert result["fresh_token"] == 200

    assert result["revoke_all"] == 200
    assert result["after_revoke_all"] == 401


# --- helpers ----------------------------------------------------------------

def _sign(payload: dict) -> str:
    """Signs a payload correctly, so only its contents are under test."""
    from app.security import _b64, _mac, auth_secret

    body = _b64(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    return f"{body}.{_b64(_mac(auth_secret(), body))}"


def _decode(token: str) -> dict:
    body = token.split(".")[0]
    return json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
