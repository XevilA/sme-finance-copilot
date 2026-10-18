"""Deployment configuration: the database URL a host hands us, and the
startup schema bootstrap.

These exist because both failed the first time the image was actually run:
a managed Postgres add-on supplies `postgresql://`, which SQLAlchemy maps to a
synchronous driver and which an async engine rejects, and the lock file was
missing greenlet, so the container could not even import SQLAlchemy's asyncio
module. Unit tests over the URL rules catch the first class of bug; the lock
file is checked here so a clean install cannot silently lose a dependency
again.
"""

import re
from pathlib import Path

from app.bootstrap import SCHEMA, SEED, asyncpg_dsn, mode
from app.db import normalise_database_url

BACKEND = Path(__file__).resolve().parents[1]


# --- the URL a host gives us ------------------------------------------------

def test_managed_postgres_url_is_pinned_to_the_async_driver():
    """Railway, Render and Fly all hand out a plain postgresql:// URL."""
    url, args = normalise_database_url("postgresql://u:p@host.proxy.rlwy.net:1234/railway")
    assert url == "postgresql+asyncpg://u:p@host.proxy.rlwy.net:1234/railway"
    assert args == {}


def test_legacy_postgres_scheme_is_accepted():
    url, _ = normalise_database_url("postgres://u:p@host:5432/db")
    assert url.startswith("postgresql+asyncpg://")


def test_an_already_explicit_driver_is_left_alone():
    original = "postgresql+asyncpg://u:p@host:5432/db"
    url, args = normalise_database_url(original)
    assert url == original
    assert args == {}


def test_sslmode_becomes_an_asyncpg_connect_argument():
    """asyncpg rejects sslmode as a query parameter, so it must move."""
    for requested in ("require", "verify-full", "prefer"):
        url, args = normalise_database_url(f"postgresql://u:p@host:5432/db?sslmode={requested}")
        assert "sslmode" not in url
        assert args == {"ssl": True}


def test_sslmode_disable_is_honoured_rather_than_ignored():
    url, args = normalise_database_url("postgresql://u:p@host:5432/db?sslmode=disable")
    assert "sslmode" not in url
    assert args == {"ssl": False}


def test_unrelated_query_parameters_survive():
    url, args = normalise_database_url(
        "postgresql://u:p@host:5432/db?sslmode=require&application_name=sme"
    )
    assert "application_name=sme" in url
    assert "sslmode" not in url
    assert args == {"ssl": True}


def test_neon_connection_string_keeps_tls_and_drops_channel_binding():
    """Neon hands out sslmode=require&channel_binding=require; asyncpg rejects the second."""
    url, args = normalise_database_url(
        "postgresql://owner:p@ep-x-pooler.ap-southeast-1.aws.neon.tech/neondb"
        "?sslmode=require&channel_binding=require"
    )
    assert url.startswith("postgresql+asyncpg://")
    assert "channel_binding" not in url
    assert "sslmode" not in url
    assert args == {"ssl": True}


def test_an_empty_url_stays_empty_so_demo_mode_still_works():
    assert normalise_database_url("") == ("", {})
    assert normalise_database_url("   ") == ("", {})


def test_credentials_are_not_rewritten():
    """A password with URL-significant characters must pass through intact."""
    url, _ = normalise_database_url("postgresql://user:p%40ss%3Aword@host:5432/db")
    assert "user:p%40ss%3Aword@host" in url


# --- startup bootstrap ------------------------------------------------------

def test_bootstrap_reads_a_libpq_dsn_not_the_sqlalchemy_name():
    """asyncpg.connect does not understand the +asyncpg driver suffix."""
    assert "+asyncpg" not in asyncpg_dsn()


def test_bootstrap_mode_is_one_of_the_documented_values():
    assert mode() in {"off", "schema", "schema+seed"}


def test_bootstrap_sql_files_ship_with_the_app():
    """The container copies db/, so these must resolve inside the image too."""
    assert SCHEMA.is_file()
    assert SEED.is_file()


def test_schema_is_safe_to_apply_repeatedly():
    """Bootstrap runs on every boot, so every statement must be idempotent."""
    sql = SCHEMA.read_text(encoding="utf-8")
    creates = re.findall(r"CREATE\s+(TABLE|INDEX|UNIQUE INDEX|EXTENSION)\s+(?!IF NOT EXISTS)", sql, re.I)
    assert not creates, f"not idempotent: {creates}"
    for trigger in re.findall(r"CREATE TRIGGER (\w+)", sql):
        assert f"DROP TRIGGER IF EXISTS {trigger}" in sql, f"{trigger} is not dropped first"


def test_seed_only_inserts_with_a_conflict_clause():
    """Seeding twice must not duplicate rows."""
    sql = SEED.read_text(encoding="utf-8")
    inserts = len(re.findall(r"INSERT INTO", sql, re.I))
    guarded = len(re.findall(r"ON CONFLICT", sql, re.I))
    assert inserts == guarded, f"{inserts} inserts but {guarded} ON CONFLICT clauses"


# --- the lock file ----------------------------------------------------------

def locked_packages() -> dict:
    text = (BACKEND / "requirements.lock.txt").read_text(encoding="utf-8")
    entries = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        name, _, version = line.partition("==")
        entries[name.lower().replace("_", "-")] = version
    return entries


def test_every_runtime_import_is_pinned():
    """greenlet was missing, and the container failed on import because of it.

    It is a dependency of SQLAlchemy's asyncio extra rather than something the
    code imports directly, which is exactly why it was easy to lose.
    """
    locked = locked_packages()
    for package in ("fastapi", "uvicorn", "pydantic", "sqlalchemy", "greenlet",
                    "asyncpg", "openpyxl", "python-multipart", "python-dotenv", "httpx"):
        assert package in locked, f"{package} is not pinned in requirements.lock.txt"


def test_lock_file_pins_exact_versions():
    text = (BACKEND / "requirements.lock.txt").read_text(encoding="utf-8")
    for line in text.splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            assert "==" in line, f"not an exact pin: {line}"


# --- container definition ---------------------------------------------------

def test_dockerfile_installs_from_the_lock_file():
    """A deployed build must match what was tested, not resolve ranges afresh."""
    dockerfile = (BACKEND / "Dockerfile").read_text(encoding="utf-8")
    assert "requirements.lock.txt" in dockerfile
    assert "requirements.txt" not in dockerfile.replace("requirements.lock.txt", "")


def test_dockerfile_copies_the_sql_the_bootstrap_needs():
    dockerfile = (BACKEND / "Dockerfile").read_text(encoding="utf-8")
    assert "COPY db ./db" in dockerfile


def test_dockerfile_binds_the_host_supplied_port():
    """A host assigns the port; binding 8000 unconditionally fails its probe."""
    dockerfile = (BACKEND / "Dockerfile").read_text(encoding="utf-8")
    assert "${PORT:-8000}" in dockerfile
    assert "--host 0.0.0.0" in dockerfile


def test_dockerignore_keeps_secrets_and_local_state_out_of_the_image():
    ignored = (BACKEND / ".dockerignore").read_text(encoding="utf-8").split()
    for entry in (".env", ".venv/", "uploads/", "tests/"):
        assert entry in ignored, f"{entry} would be copied into the image"


def test_vercel_serves_api_before_spa_and_excludes_private_workbooks():
    import json
    root = BACKEND.parent
    config = json.loads((root / "vercel.json").read_text(encoding="utf-8"))
    assert config["framework"] == "vite"
    assert config["rewrites"][0] == {"source": "/api/:path*", "destination": "/api/index.py"}
    assert config["rewrites"][-1]["destination"] == "/index.html"
    assert config["build"]["env"] == {"VITE_USE_MOCK": "false", "VITE_API_BASE_URL": "/api/v1"}
    excluded = config["functions"]["api/index.py"]["excludeFiles"]
    ignored = (root / ".vercelignore").read_text(encoding="utf-8")
    for private in ("backend/.env", "backend/.venv", "backend/uploads", "backend/templates", ".worktrees"):
        assert private in ignored and private in excluded
    assert "from app.main import app" in (root / "api/index.py").read_text(encoding="utf-8")
    assert "DB_BOOTSTRAP" in (root / "api/index.py").read_text(encoding="utf-8")
