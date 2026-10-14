"""Async SQLAlchemy engine. Persistence is optional: with no DATABASE_URL the API
still serves every endpoint and simply skips writes (demo / offline mode)."""

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
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
