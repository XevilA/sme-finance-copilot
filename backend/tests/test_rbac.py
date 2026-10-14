"""RBAC roles and the enforcement switch.

The default (enforcement off) must never reject the deployed frontend, which
sends no headers. With enforcement on, an unidentified caller must be rejected
and a role must come from the users table rather than from the request.

The enforced cases run the app in a subprocess with RBAC_ENFORCED=true, because
the flag is read at import time and the rest of the suite runs with it off.
"""

import json
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.db import DB_ENABLED
from app.main import app
from app.rbac import RBAC_ENFORCED, FUNDER_ROLES, Principal, funder_access

client = TestClient(app)
BACKEND = Path(__file__).resolve().parents[1]


def test_enforcement_is_off_by_default():
    """Turning this on is a deliberate step, not the default."""
    assert RBAC_ENFORCED is False


def test_funder_route_answers_without_any_header():
    response = client.get("/api/v1/funder/projects")
    assert response.status_code == 200
    body = response.json()
    assert body["rbacEnforced"] is False
    assert body["role"] == "unauthenticated"
    # The response must admit that access was not actually verified.
    assert "rbac_not_enforced" in body["missing"]


def test_unenforced_principal_is_permissive_but_says_so():
    principal = Principal(None, None, None, None, enforced=False)
    assert principal.may("admin") is True
    assert principal.owns_sme(None) is True
    assert principal.enforced is False


def test_enforced_principal_checks_the_role():
    import uuid

    owner_sme = uuid.uuid4()
    owner = Principal("owner@example.test", "sme_owner", owner_sme, None, enforced=True)
    assert owner.may("sme_owner") is True
    assert owner.may("admin") is False
    assert owner.owns_sme(owner_sme) is True
    assert owner.owns_sme(uuid.uuid4()) is False


def test_staff_roles_are_not_scoped_to_one_sme():
    import uuid

    analyst = Principal("analyst@example.test", "analyst", None, None, enforced=True)
    assert analyst.owns_sme(uuid.uuid4()) is True


def test_funder_access_is_permissive_only_while_unenforced():
    assert funder_access(None) is True  # enforcement off in this process
    assert FUNDER_ROLES == {"investor", "analyst", "admin"}
    assert "sme_owner" not in FUNDER_ROLES


def run_enforced(script: str) -> dict:
    """Runs a snippet against the app with RBAC_ENFORCED=true."""
    completed = subprocess.run(
        [sys.executable, "-c", script],
        cwd=BACKEND,
        capture_output=True,
        text=True,
        env={"RBAC_ENFORCED": "true", "PATH": "", "SYSTEMROOT": "C:\\Windows"},
        timeout=120,
    )
    assert completed.returncode == 0, completed.stderr[-2000:]
    return json.loads(completed.stdout.strip().splitlines()[-1])


ENFORCED_SCRIPT = """
import json, sys
sys.path.insert(0, ".")
from fastapi.testclient import TestClient
from app.main import app
from app.rbac import RBAC_ENFORCED

client = TestClient(app)
out = {"enforced": RBAC_ENFORCED}
out["no_header"] = client.get("/api/v1/funder/projects").status_code
out["unknown_user"] = client.get(
    "/api/v1/funder/projects", headers={"X-User-Email": "nobody@example.test"}
).status_code
investor = client.get(
    "/api/v1/funder/projects", headers={"X-User-Email": "fund@example.test"}
)
out["investor"] = investor.status_code
if investor.status_code == 200:
    body = investor.json()
    out["investor_role"] = body["role"]
    out["investor_access"] = body["data"][0]["hasAccessPermission"] if body["data"] else None
    out["investor_rbac_enforced"] = body["rbacEnforced"]
owner = client.get(
    "/api/v1/funder/projects", headers={"X-User-Email": "owner@baansuan.test"}
)
out["sme_owner"] = owner.status_code
if owner.status_code == 200:
    body = owner.json()
    out["owner_access"] = body["data"][0]["hasAccessPermission"] if body["data"] else None
print(json.dumps(out))
"""


@pytest.mark.skipif(not DB_ENABLED, reason="enforced RBAC resolves roles from the database")
def test_enforced_rbac_rejects_and_resolves_correctly():
    result = run_enforced(ENFORCED_SCRIPT)
    assert result["enforced"] is True
    # No identity at all -> 401, not a silent pass.
    assert result["no_header"] == 401
    # Unknown address -> 403, same answer as an inactive one.
    assert result["unknown_user"] == 403
    # A seeded investor resolves and is allowed funder detail.
    assert result["investor"] == 200
    assert result["investor_role"] == "investor"
    assert result["investor_access"] is True
    assert result["investor_rbac_enforced"] is True
    # An SME owner resolves but is not a funder, so detail is withheld.
    assert result["sme_owner"] == 200
    assert result["owner_access"] is False
