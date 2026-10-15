"""Applies db/schema.sql (and optionally db/seed.sql) at startup.

A managed Postgres add-on has no equivalent of docker-compose's
`/docker-entrypoint-initdb.d`, so a deployed instance starts against an empty
database. Both files are idempotent, so running them on boot is safe and means
a fresh environment works without a manual migration step.

Controlled by DB_BOOTSTRAP:
  off           do nothing (default when DATABASE_URL is unset)
  schema        apply schema.sql only (default when a database is configured)
  schema+seed   also apply seed.sql, which inserts the labelled demo rows

Two instances booting together would otherwise race on CREATE TABLE, so the
work is taken under a Postgres advisory lock. An instance that cannot get the
lock skips the work rather than waiting, because the holder is doing it.
"""

import os
from pathlib import Path

import asyncpg

from .db import CONNECT_ARGS, DATABASE_URL, DB_ENABLED

DB_DIR = Path(__file__).resolve().parents[1] / "db"
SCHEMA = DB_DIR / "schema.sql"
SEED = DB_DIR / "seed.sql"

# Any distinct constant works; it only has to be the same across instances.
ADVISORY_LOCK_KEY = 728_193_455


def mode() -> str:
    default = "schema" if DB_ENABLED else "off"
    return os.getenv("DB_BOOTSTRAP", default).strip().lower()


def asyncpg_dsn() -> str:
    """asyncpg.connect wants a libpq-style DSN, not the SQLAlchemy driver name."""
    return DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://", 1)


async def run() -> dict:
    """Returns what was applied, for the startup log and the health endpoint."""
    chosen = mode()
    if not DB_ENABLED or chosen == "off":
        return {"mode": chosen, "applied": [], "skipped": "disabled"}

    files = [SCHEMA]
    if chosen == "schema+seed":
        files.append(SEED)

    missing = [path.name for path in files if not path.is_file()]
    if missing:
        return {"mode": chosen, "applied": [], "error": f"missing {', '.join(missing)}"}

    ssl = CONNECT_ARGS.get("ssl")
    connection = await asyncpg.connect(asyncpg_dsn(), ssl=ssl, timeout=30)
    try:
        # Non-blocking: if another instance holds it, that instance is applying
        # the same files and this one has nothing useful to add.
        acquired = await connection.fetchval("SELECT pg_try_advisory_lock($1)", ADVISORY_LOCK_KEY)
        if not acquired:
            return {"mode": chosen, "applied": [], "skipped": "another instance holds the lock"}
        try:
            applied = []
            for path in files:
                # asyncpg's simple query protocol runs a multi-statement script,
                # which a prepared statement cannot.
                await connection.execute(path.read_text(encoding="utf-8"))
                applied.append(path.name)
            return {"mode": chosen, "applied": applied}
        finally:
            await connection.execute("SELECT pg_advisory_unlock($1)", ADVISORY_LOCK_KEY)
    finally:
        await connection.close()
