"""Async SQLAlchemy engine. Persistence is optional: with no DATABASE_URL the API
still serves every endpoint and simply skips writes (demo / offline mode)."""

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

# asyncpg takes TLS settings as a connect argument, not as a query parameter, and
# rejects the libpq spellings that hosted Postgres add to the URL it hands out.
LIBPQ_ONLY_PARAMS = frozenset({"sslmode", "sslrootcert", "sslcert", "sslkey", "target_session_attrs"})
REQUIRED_SSL_MODES = frozenset({"require", "verify-ca", "verify-full", "prefer", "allow"})


def normalise_database_url(url: str) -> tuple[str, dict]:
    """Returns an asyncpg URL plus connect_args, from whatever the host supplies.

    A managed Postgres add-on hands out `postgresql://...` (or the legacy
    `postgres://`), which SQLAlchemy maps to a synchronous driver and which then
    fails against an async engine. The driver is pinned here instead of asking
    every deployment to rewrite the variable it was given.

    An `sslmode` in the query string is translated to asyncpg's own `ssl`
    connect argument rather than dropped, so a provider that requires TLS keeps
    getting it.
    """
    url = url.strip()
    if not url:
        return "", {}

    parts = urlsplit(url)
    scheme = parts.scheme
    if scheme in {"postgres", "postgresql"}:
        scheme = "postgresql+asyncpg"

    query = parse_qsl(parts.query, keep_blank_values=True)
    kept = [(key, value) for key, value in query if key.lower() not in LIBPQ_ONLY_PARAMS]
    dropped = {key.lower(): value for key, value in query if key.lower() in LIBPQ_ONLY_PARAMS}

    connect_args: dict = {}
    sslmode = dropped.get("sslmode", "").lower()
    if sslmode in REQUIRED_SSL_MODES:
        connect_args["ssl"] = True
    elif sslmode == "disable":
        connect_args["ssl"] = False

    rebuilt = urlunsplit((scheme, parts.netloc, parts.path, urlencode(kept), parts.fragment))
    return rebuilt, connect_args


RAW_DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
DATABASE_URL, CONNECT_ARGS = normalise_database_url(RAW_DATABASE_URL)
DB_ENABLED = bool(DATABASE_URL)

# An asyncpg connection belongs to the event loop that opened it, so a pooled
# connection is unusable from a different loop - which is exactly what happens
# under TestClient (a fresh loop per request) and on serverless runtimes. The
# default NullPool opens one connection per session and is correct everywhere.
# Set DB_POOL=queue behind a long-lived uvicorn process to pool instead.
POOLED = os.getenv("DB_POOL", "null").strip().lower() == "queue"

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None

if DB_ENABLED:
    pool_options: dict = (
        {"pool_size": 5, "max_overflow": 5, "pool_pre_ping": True}
        if POOLED
        else {"poolclass": NullPool}
    )
    if CONNECT_ARGS:
        pool_options["connect_args"] = CONNECT_ARGS
    _engine = create_async_engine(DATABASE_URL, **pool_options)
    _session_factory = async_sessionmaker(_engine, expire_on_commit=False)


@asynccontextmanager
async def session_scope() -> AsyncGenerator[AsyncSession | None, None]:
    """Yields a committed session, or None when persistence is disabled."""
    if _session_factory is None:
        yield None
        return
    async with _session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def dispose_engine() -> None:
    if _engine is not None:
        await _engine.dispose()
