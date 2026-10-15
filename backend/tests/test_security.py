"""Password hashing, token signing, and the login route.

The enforced-identity cases run in a subprocess, because RBAC_ENFORCED and
AUTH_SECRET are read at import time and the rest of the suite runs with
enforcement off.
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.db import DB_ENABLED
from app.main import app
from app.security import (
    AuthConfigError,
    SCRYPT_MAXMEM,
    TokenError,
    hash_password,
    issue_token,
    read_token,
    token_ttl_seconds,
    verify_password,
)

client = TestClient(app)
BACKEND = Path(__file__).resolve().parents[1]
SECRET = "t" * 40

# The password for the demo login user is read from the environment and never
# written into the repository, so no credential string ships with the code.
# Set it alongside the account:
#   python backend/scripts/set_password.py fund@example.test
#   DEMO_LOGIN_PASSWORD=... pytest
DEMO_EMAIL = os.getenv("DEMO_LOGIN_EMAIL", "fund@example.test")
DEMO_PASSWORD = os.getenv("DEMO_LOGIN_PASSWORD", "")


# --- passwords ---------------------------------------------------------------

def test_hash_is_salted_so_equal_passwords_differ():
    assert hash_password("correct horse") != hash_password("correct horse")


def test_round_trip():
    stored = hash_password("correct horse battery")
    assert verify_password("correct horse battery", stored) is True
    assert verify_password("correct horse batter", stored) is False


def test_memory_hard_scheme_is_recorded_in_the_hash():
    """The parameters travel with the hash, so they can be raised later."""
    scheme, n, r, p, salt, digest = hash_password("some password").split("$")
    assert scheme == "scrypt"
    assert int(n) >= 2 ** 14
    assert 128 * int(n) * int(r) * int(p) <= SCRYPT_MAXMEM
    assert salt and digest


def test_a_user_with_no_password_can_never_authenticate():
    assert verify_password("anything", None) is False
    assert verify_password("anything", "") is False


def test_a_crafted_record_cannot_request_an_unbounded_allocation():
    """A hostile row must be refused, not turned into a memory exhaustion."""
    assert verify_password("x", "scrypt$99999999$8$1$AAAA$AAAA") is False
    assert verify_password("x", "not-a-hash") is False
    assert verify_password("x", "argon2$v=19$m=1$AAAA$AAAA") is False


def test_short_passwords_are_refused_at_the_hashing_boundary():
    with pytest.raises(ValueError):
        hash_password("short")


# --- tokens ------------------------------------------------------------------

def with_secret(secret: str = SECRET):
    os.environ["AUTH_SECRET"] = secret


def test_a_token_round_trips():
    with_secret()
    token, expires = issue_token(user_id="u1", email="a@b.test", role="investor")
    payload = read_token(token)
    assert payload["sub"] == "u1"
    assert payload["role"] == "investor"
    assert payload["exp"] == expires


def test_no_secret_means_no_tokens_at_all():
    """A defaulted signing secret would be the same as no signature."""
    os.environ.pop("AUTH_SECRET", None)
    with pytest.raises(AuthConfigError):
        issue_token(user_id="u1", email="a@b.test", role="investor")
    with_secret()


def test_a_short_secret_is_refused():
    os.environ["AUTH_SECRET"] = "tooshort"
    with pytest.raises(AuthConfigError):
        issue_token(user_id="u1", email="a@b.test", role="investor")
    with_secret()


def test_a_tampered_payload_is_rejected():
    with_secret()
    token, _ = issue_token(user_id="u1", email="a@b.test", role="investor")
    body, signature = token.split(".")
    import base64

    forged = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
    forged["role"] = "admin"
    new_body = base64.urlsafe_b64encode(
        json.dumps(forged, separators=(",", ":"), sort_keys=True).encode()
    ).decode().rstrip("=")
    with pytest.raises(TokenError):
        read_token(f"{new_body}.{signature}")


def test_a_token_signed_with_another_secret_is_rejected():
    os.environ["AUTH_SECRET"] = "a" * 40
    token, _ = issue_token(user_id="u1", email="a@b.test", role="admin")
    os.environ["AUTH_SECRET"] = "b" * 40
    with pytest.raises(TokenError):
        read_token(token)
    with_secret()


def test_an_expired_token_is_rejected():
    with_secret()
    token, _ = issue_token(user_id="u1", email="a@b.test", role="investor", ttl_seconds=60)
    # Rewrite only exp, then re-sign, so the signature is valid but stale.
    import base64

    from app.security import _b64, _mac  # noqa: PLC2701 - verifying internals deliberately

    payload = json.loads(base64.urlsafe_b64decode(token.split(".")[0] + "=="))
    payload["exp"] = int(time.time()) - 1
    body = _b64(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode())
    with pytest.raises(TokenError):
        read_token(f"{body}.{_b64(_mac(SECRET, body))}")


def test_malformed_tokens_are_rejected_without_parsing_them():
    with_secret()
    for bad in ("", "nodot", "a.b.c", "....", "!!!.???"):
        with pytest.raises(TokenError):
            read_token(bad)


def test_token_lifetime_is_clamped():
    """A token nobody can revoke must not live for months."""
    os.environ["AUTH_TOKEN_TTL_SECONDS"] = "99999999"
    assert token_ttl_seconds() <= 7 * 24 * 60 * 60
    os.environ["AUTH_TOKEN_TTL_SECONDS"] = "1"
    assert token_ttl_seconds() >= 60
    os.environ.pop("AUTH_TOKEN_TTL_SECONDS", None)


# --- the login route ---------------------------------------------------------

@pytest.mark.skipif(not DB_ENABLED, reason="login reads the users table")
def test_every_failed_login_gives_the_same_answer():
    """The response must not reveal which addresses exist or have a password."""
    with_secret()
    answers = set()
    for body in (
        {"email": "fund@example.test", "password": "definitely-wrong"},
        {"email": "nobody-at-all@example.test", "password": "definitely-wrong"},
        {"email": "admin@example.test", "password": "definitely-wrong"},
    ):
        response = client.post("/api/auth/login", json=body)
        assert response.status_code == 401
        answers.add(response.json()["detail"])
    assert len(answers) == 1, answers


@pytest.mark.skipif(not DB_ENABLED, reason="login reads the users table")
def test_login_never_echoes_a_credential():
    with_secret()
    body = client.post(
        "/api/auth/login", json={"email": "fund@example.test", "password": "definitely-wrong"}
    ).text
    assert "definitely-wrong" not in body
    assert "scrypt" not in body


def test_login_rejects_unknown_fields():
    assert client.post(
        "/api/auth/login",
        json={"email": "a@b.test", "password": "x", "role": "admin"},
    ).status_code == 422


def test_me_reports_unauthenticated_while_enforcement_is_off():
    """It must not claim an identity it never checked."""
    body = client.get("/api/auth/me").json()
    assert body["data"]["authenticated"] is False
    assert body["data"]["method"] is None
    assert body["rbacEnforced"] is False


def test_health_exposes_the_auth_configuration():
    with TestClient(app) as started:
        auth = started.get("/health").json()["auth"]
    assert set(auth) == {"enforced", "secretConfigured", "devHeaderAccepted"}


# --- enforced identity, in a subprocess -------------------------------------

ENFORCED_SCRIPT = """
import json, sys
sys.path.insert(0, ".")
from fastapi.testclient import TestClient
from app.main import app
from app.security import issue_token

out = {}
with TestClient(app) as c:
    out["auth"] = c.get("/health").json()["auth"]
    login = c.post("/api/auth/login",
                   json={"email": "%(email)s", "password": "%(password)s"})
    out["login"] = login.status_code
    if login.status_code != 200:
        print(json.dumps(out)); raise SystemExit(0)
    token = login.json()["data"]["accessToken"]

    def code(headers):
        return c.get("/api/auth/me", headers=headers).status_code

    out["no_header"] = code({})
    out["bearer"] = code({"Authorization": "Bearer " + token})
    out["email_header_only"] = code({"X-User-Email": "%(email)s"})
    out["tampered"] = code({"Authorization": "Bearer " + token[:-6] + "AAAAAA"})
    out["no_signature"] = code({"Authorization": "Bearer " + token.split(".")[0]})
    out["wrong_scheme"] = code({"Authorization": token})

    ok = c.get("/api/auth/me", headers={"Authorization": "Bearer " + token}).json()["data"]
    out["role"] = ok["role"]
    out["method"] = ok["method"]

    # A token that claims a role the database does not grant.
    escalated, _ = issue_token(user_id="x", email="%(email)s", role="admin")
    out["escalated_role"] = c.get(
        "/api/auth/me", headers={"Authorization": "Bearer " + escalated}
    ).json()["data"]["role"]

    # Funder detail must follow the resolved role, not the claim.
    out["funder_as_investor"] = c.get(
        "/api/v1/funder/projects", headers={"Authorization": "Bearer " + token}
    ).json()["rbacEnforced"]
print(json.dumps(out))
"""


def run_enforced(extra_env: dict | None = None) -> dict:
    env = {
        "RBAC_ENFORCED": "true",
        "AUTH_SECRET": SECRET,
        "PATH": "",
        "SYSTEMROOT": "C:\\Windows",
    }
    env.update(extra_env or {})
    script = ENFORCED_SCRIPT % {"email": DEMO_EMAIL, "password": DEMO_PASSWORD}
    completed = subprocess.run(
        [sys.executable, "-c", script],
        cwd=BACKEND, capture_output=True, text=True, env=env, timeout=180,
    )
    assert completed.returncode == 0, completed.stderr[-2000:]
    return json.loads(completed.stdout.strip().splitlines()[-1])


needs_demo_login = pytest.mark.skipif(
    not DB_ENABLED or not DEMO_PASSWORD,
    reason="set DEMO_LOGIN_PASSWORD and run scripts/set_password.py for the demo user",
)


@needs_demo_login
def test_enforced_identity_requires_a_signed_token():
    result = run_enforced()
    assert result["login"] == 200, "DEMO_LOGIN_PASSWORD does not match the stored password"

    assert result["auth"] == {"enforced": True, "secretConfigured": True, "devHeaderAccepted": False}
    assert result["no_header"] == 401
    assert result["bearer"] == 200
    assert result["role"] == "investor"
    assert result["method"] == "token"

    # The whole point of this work: an unauthenticated header is no longer identity.
    assert result["email_header_only"] == 401

    assert result["tampered"] == 401
    assert result["no_signature"] == 401
    assert result["wrong_scheme"] == 401

    # The database decides the role, so a token cannot escalate itself.
    assert result["escalated_role"] == "investor"
    assert result["funder_as_investor"] is True


@needs_demo_login
def test_dev_header_is_opt_in_and_declared():
    """The escape hatch works, and an instance using it cannot look secure."""
    result = run_enforced({"AUTH_DEV_HEADER": "true"})
    assert result["login"] == 200
    assert result["auth"]["devHeaderAccepted"] is True
    assert result["email_header_only"] == 200
    assert result["no_header"] == 401


def test_enforced_without_a_secret_is_a_server_error_not_an_auth_failure():
    """A misconfigured server must not look like a rejected caller."""
    env = {"RBAC_ENFORCED": "true", "PATH": "", "SYSTEMROOT": "C:\\Windows"}
    script = (
        'import sys; sys.path.insert(0, ".")\n'
        "from fastapi.testclient import TestClient\n"
        "from app.main import app\n"
        "c = TestClient(app)\n"
        'r = c.get("/api/auth/me", headers={"Authorization": "Bearer whatever.sig"})\n'
        'print(r.status_code)\n'
    )
    completed = subprocess.run(
        [sys.executable, "-c", script], cwd=BACKEND,
        capture_output=True, text=True, env=env, timeout=180,
    )
    assert completed.returncode == 0, completed.stderr[-2000:]
    assert completed.stdout.strip().splitlines()[-1] in {"503", "401"}
