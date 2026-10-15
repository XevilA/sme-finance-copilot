"""Attributed industry headlines and deterministic signals with explicit freshness."""

from datetime import datetime, timedelta, timezone
from hashlib import sha256
import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError

ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc"
_QUERIES = {
    "food_processing": '(food OR agriculture OR restaurant) (Thailand OR ASEAN OR SME)',
    "food": '(food OR agriculture OR restaurant) (Thailand OR ASEAN OR SME)',
    "packaging": '(packaging OR paper OR plastic) (Thailand OR ASEAN OR SME)',
    "manufacturing": '(manufacturing OR factory OR exports) (Thailand OR ASEAN OR SME)',
    "agriculture": '(agriculture OR crops OR farming) (Thailand OR ASEAN OR SME)',
    "retail": '(retail OR commerce OR consumer) (Thailand OR ASEAN OR SME)',
    "logistics": '(logistics OR shipping OR transport) (Thailand OR ASEAN OR SME)',
    "services": '(services OR tourism OR hospitality) (Thailand OR ASEAN OR SME)',
}
_KEYWORDS = {
    "risk": ("shortage", "disruption", "recall", "flood", "rising costs", "price hike", "ขาดแคลน", "น้ำท่วม", "ต้นทุนเพิ่ม", "เรียกคืน"),
    "opportunity": ("export growth", "new market", "grant", "subsidy", "demand growth", "investment incentives", "ตลาดใหม่", "เงินสนับสนุน", "ส่งออกเติบโต"),
}
NOTICE = "Headline keyword signals only; verify the linked reporting and SME exposure. No financial forecast, source verification, or causal claim is inferred."


class Article(BaseModel):
    model_config = ConfigDict(extra="ignore")
    sector: str
    title: str = Field(min_length=1, max_length=512)
    url: str = Field(min_length=1, max_length=4096)
    observed_at: datetime
    fetched_at: datetime
    published_at: datetime | None = None
    date_source: str = "gdelt_first_seen"
    provider: str = "gdelt"


def _utc(value: datetime) -> datetime:
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("An explicit timezone-aware timestamp is required")
    return value.astimezone(timezone.utc)


def _sector(value: str) -> str:
    if value not in _QUERIES:
        raise ValueError("Unsupported sector; use a configured industry query")
    return value


def _url(value: str) -> str:
    parsed = urlsplit(value.strip())
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Expected a public article URL without embedded credentials")
    if parsed.port is not None and parsed.port not in {80, 443}:
        raise ValueError("Unsupported article URL port")
    query = sorted((key, val) for key, val in parse_qsl(parsed.query, keep_blank_values=True)
                   if not key.casefold().startswith("utm_") and key.casefold() not in {"fbclid", "gclid"})
    host = parsed.hostname.lower()
    if ":" in host:
        host = f"[{host}]"
    if parsed.port is not None and parsed.port != (443 if parsed.scheme.lower() == "https" else 80):
        host += f":{parsed.port}"
    return urlunsplit((parsed.scheme.lower(), host, parsed.path or "/", urlencode(query), ""))


def _articles(rows: list[dict], sector: str, as_of: datetime) -> list[dict]:
    if len(rows) > 500:
        raise ValueError("At most 500 cached articles are supported")
    valid = []
    for raw in rows:
        try:
            item = Article.model_validate(raw)
            if item.sector != sector or item.provider != "gdelt":
                continue
            observed, fetched = _utc(item.observed_at), _utc(item.fetched_at)
            published = None if item.published_at is None else _utc(item.published_at)
            reference = published or observed
            if max(observed, fetched, reference) > as_of + timedelta(minutes=5):
                continue
            if as_of - fetched > timedelta(days=7) or as_of - reference > timedelta(days=30):
                continue
            canonical = _url(item.url)
            title = item.title.strip()
            if not title:
                continue
            stale = as_of - reference > timedelta(hours=72) or as_of - fetched > timedelta(hours=1)
            valid.append({"id": sha256((sector + "\0" + canonical).encode()).hexdigest(),
                          "sector": sector, "provider": "gdelt", "source": urlsplit(canonical).hostname,
                          "url": canonical, "title": title,
                          "published_at": None if published is None else published.isoformat(),
                          "observed_at": observed.isoformat(), "fetched_at": fetched.isoformat(),
                          "date_source": item.date_source, "status": "stale" if stale else "fresh"})
        except (ValidationError, ValueError, TypeError):
            continue
    seen_urls, seen_titles, result = set(), set(), []
    # Preserve observation/URL ordering, then prefer the latest fetched snapshot
    # of a duplicate. Remaining source fields break exact timestamp ties so
    # input order cannot change freshness, headline signals or date evidence.
    for item in sorted(valid, key=lambda row: (
        datetime.fromisoformat(row["observed_at"]), row["url"],
        datetime.fromisoformat(row["fetched_at"]), row["published_at"] or "",
        row["title"], row["date_source"],
    ), reverse=True):
        title_key = " ".join(item["title"].casefold().split())
        if item["url"] in seen_urls or title_key in seen_titles:
            continue
        seen_urls.add(item["url"])
        seen_titles.add(title_key)
        result.append(item)
    return result[:50]


def _keyword_matches(title: str, keyword: str) -> bool:
    text = title.casefold()
    if keyword not in text:
        return False
    if keyword.isascii():
        if not re.search(r"\b" + re.escape(keyword) + r"\b", text):
            return False
        if re.search(r"\b(?:no|not|without)\s+(?:\w+\s+){0,2}" + re.escape(keyword) + r"\b", text):
            return False
    return True


def analyze_industry_articles(articles: list[dict], sector: str, *, as_of: datetime,
                              source_status: str = "live", source_error: str | None = None) -> dict:
    as_of, sector = _utc(as_of), _sector(sector)
    rows = _articles(articles, sector, as_of)
    if source_status not in {"live", "cached", "unavailable"}:
        raise ValueError("Invalid source_status")
    status = "unavailable" if not rows and source_status == "unavailable" else "empty" if not rows else (
        "stale" if source_status == "unavailable" or all(row["status"] == "stale" for row in rows) else "ok")
    findings = []
    for row in rows:
        if source_status == "unavailable":
            row["status"] = "stale"
        for category, terms in _KEYWORDS.items():
            hits = [term for term in terms if _keyword_matches(row["title"], term)]
            if hits:
                findings.append({"id": f"{row['id']}:{category}", "category": category,
                                 "article_id": row["id"], "evidence_url": row["url"],
                                 "matched_terms": hits, "status": row["status"],
                                 "text": f"Potential {category} signal: the attributed headline contains {', '.join(hits)}. Check reporting details and SME exposure.",
                                 "notice": NOTICE})
    missing = [] if rows else ["industry_news"]
    if any(row["published_at"] is None for row in rows):
        missing.append("source_publication_dates")
    return {"sector": sector, "as_of": as_of.isoformat(), "status": status, "source_status": source_status,
            "source_error": source_error, "retry_after_seconds": None, "articles": rows, "findings": findings, "missing": missing,
            "notice": NOTICE,
            "assumptions": ["GDELT first-seen time is observed_at, not an invented article publication date",
                            "Freshness requires source age <=72 hours and fetch age <=1 hour; cache retention is seven days",
                            "Keyword classification is deterministic and does not read or verify full article text",
                            "Queries are sector-specific; articles may describe other markets, so local business relevance must be confirmed"]}


def _from_gdelt(payload: dict, sector: str, fetched_at: datetime) -> list[dict]:
    if not isinstance(payload, dict) or not isinstance(payload.get("articles"), list):
        raise ValueError("Invalid article-list response")
    if len(payload["articles"]) > 250:
        raise ValueError("Article response exceeds the import limit")
    rows = []
    for item in payload["articles"]:
        try:
            observed = datetime.strptime(item["seendate"], "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
            row = {"sector": sector, "title": item["title"], "url": item["url"],
                   "observed_at": observed.isoformat(), "fetched_at": fetched_at.isoformat(),
                   "published_at": None, "date_source": "gdelt_first_seen", "provider": "gdelt"}
            Article.model_validate(row)
            rows.append(row)
        except (KeyError, TypeError, ValueError, ValidationError):
            continue
    if payload["articles"] and not _articles(rows, sector, fetched_at):
        raise ValueError("Provider returned no valid dated articles")
    return rows


async def fetch_industry_trends(sector: str, *, as_of: datetime, cached_articles: list[dict] | None = None,
                                 client: httpx.AsyncClient | None = None, force_refresh: bool = False) -> dict:
    """One API request; caller owns cache persistence and cross-worker scheduling."""
    sector, as_of = _sector(sector), _utc(as_of)
    if type(force_refresh) is not bool:
        raise ValueError("force_refresh must be boolean")
    cache = _articles(cached_articles or [], sector, as_of)
    if cache and not force_refresh and all(as_of - datetime.fromisoformat(row["fetched_at"]) <= timedelta(minutes=5) for row in cache):
        return analyze_industry_articles(cache, sector, as_of=as_of, source_status="cached")
    if client is None:
        async with httpx.AsyncClient(timeout=httpx.Timeout(12.0, connect=5.0), follow_redirects=False) as owned:
            return await fetch_industry_trends(sector, as_of=as_of, cached_articles=cache,
                                                client=owned, force_refresh=True)
    try:
        response = await client.get(ENDPOINT, params={"query": _QUERIES[sector], "mode": "artlist", "format": "json",
                                                      "maxrecords": 50, "timespan": "7d", "sort": "datedesc"},
                                    timeout=httpx.Timeout(12.0, connect=5.0))
        response.raise_for_status()
        if len(response.content) > 2 * 1024 * 1024:
            raise ValueError("News response exceeds two MiB")
        rows = _from_gdelt(response.json(), sector, as_of)
        return analyze_industry_articles(rows, sector, as_of=as_of)
    except httpx.HTTPStatusError as exc:
        error = f"http_{exc.response.status_code}"
        if exc.response.status_code == 429:
            try:
                retry_after = max(5, min(86400, int(exc.response.headers.get("Retry-After", "5"))))
            except ValueError:
                retry_after = 5
        else:
            retry_after = None
    except httpx.TimeoutException:
        error = "timeout"
        retry_after = None
    except (httpx.HTTPError, ValueError, TypeError):
        error = "invalid_or_unavailable_response"
        retry_after = None
    result = analyze_industry_articles(cache, sector, as_of=as_of, source_status="unavailable", source_error=error)
    result["retry_after_seconds"] = retry_after
    return result
