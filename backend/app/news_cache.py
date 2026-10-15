"""Read and write the industry_news cache.

The fetcher owns freshness: this module hands it whatever is stored and upserts
whatever comes back, keyed by the fetcher's own id (a hash of sector plus
canonical URL), so re-ingesting the same article updates the row rather than
duplicating it.

published_at stays null when the provider does not establish one. It is never
backfilled from observed_at, which only records when the article was first seen.
"""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from .models import IndustryNews

# Enough history for the fetcher to judge staleness; it discards what is too old.
CACHE_LIMIT = 200


def parse_moment(value) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None


async def load_cached_articles(session: AsyncSession | None, sector: str) -> list[dict]:
    if session is None:
        return []
    rows = (
        await session.scalars(
            select(IndustryNews)
            .where(IndustryNews.sector == sector)
            .order_by(IndustryNews.fetched_at.desc())
            .limit(CACHE_LIMIT)
        )
    ).all()
    return [
        {
            "id": row.id,
            "sector": row.sector,
            "provider": row.provider,
            "source": row.source,
            "url": row.url,
            "title": row.title,
            "published_at": row.published_at.isoformat() if row.published_at else None,
            "observed_at": row.observed_at.isoformat() if row.observed_at else None,
            "fetched_at": row.fetched_at.isoformat(),
            "date_source": row.date_source,
            "status": row.status,
        }
        for row in rows
    ]


async def upsert_articles(session: AsyncSession | None, articles: list[dict]) -> int:
    if session is None or not articles:
        return 0

    stored = 0
    for article in articles:
        identifier = article.get("id")
        fetched_at = parse_moment(article.get("fetched_at"))
        if not identifier or fetched_at is None:
            continue
        statement = insert(IndustryNews).values(
            id=identifier,
            sector=article.get("sector", ""),
            provider=article.get("provider", ""),
            source=article.get("source"),
            url=article.get("url", ""),
            title=article.get("title", ""),
            published_at=parse_moment(article.get("published_at")),
            observed_at=parse_moment(article.get("observed_at")),
            fetched_at=fetched_at,
            date_source=article.get("date_source"),
            status=article.get("status"),
            raw=article,
        ).on_conflict_do_update(
            index_elements=[IndustryNews.id],
            set_={
                "title": article.get("title", ""),
                "source": article.get("source"),
                "published_at": parse_moment(article.get("published_at")),
                "observed_at": parse_moment(article.get("observed_at")),
                "fetched_at": fetched_at,
                "date_source": article.get("date_source"),
                "status": article.get("status"),
                "raw": article,
            },
        )
        await session.execute(statement)
        stored += 1
    await session.flush()
    return stored
