import asyncio
from datetime import datetime, timedelta, timezone
from itertools import permutations

import httpx
import pytest

from app.industry import analyze_industry_articles, fetch_industry_trends

NOW = datetime(2026, 10, 15, 12, tzinfo=timezone.utc)


def article(**updates):
    return {"sector": "food_processing", "title": "Food supply shortage affects exporters", "url": "https://news.example/story",
            "observed_at": (NOW - timedelta(hours=2)).isoformat(), "fetched_at": NOW.isoformat(),
            "published_at": None, "date_source": "gdelt_first_seen", "provider": "gdelt", **updates}


def payload():
    return {"articles": [{"title": "Food supply shortage affects exporters", "url": "https://news.example/story?utm_source=demo",
                           "seendate": "20261015T100000Z", "domain": "news.example"}]}


def fetch(handler, **updates):
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await fetch_industry_trends("food_processing", as_of=NOW, client=client, **updates)
    return asyncio.run(run())


def test_live_response_keeps_true_title_url_and_observation_date_without_inventing_publication_date():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, json=payload())

    result = fetch(handler)
    assert result["status"] == "ok"
    row = result["articles"][0]
    assert row["title"] == payload()["articles"][0]["title"]
    assert row["url"] == "https://news.example/story"
    assert row["observed_at"] == "2026-10-15T10:00:00+00:00"
    assert row["published_at"] is None
    assert "source_publication_dates" in result["missing"]
    assert result["findings"][0]["category"] == "risk"
    assert result["findings"][0]["evidence_url"] == row["url"]
    assert calls[0].url.params["mode"] == "artlist"
    assert len(calls) == 1


def test_deduplicates_tracking_urls_and_syndicated_titles_deterministically():
    rows = [article(url="https://news.example/story?utm_campaign=x#part"),
            article(url="https://news.example/story?fbclid=y"), article(url="https://other.example/same-story")]
    forward = analyze_industry_articles(rows, "food_processing", as_of=NOW)
    reverse = analyze_industry_articles(list(reversed(rows)), "food_processing", as_of=NOW)
    assert forward == reverse
    assert len(forward["articles"]) == 1


def test_duplicate_url_uses_latest_fetch_independent_of_input_order():
    stale = article(fetched_at=(NOW - timedelta(hours=2)).isoformat())
    fresh = article(url="https://news.example/story?utm_source=refresh")
    for rows in permutations([stale, fresh]):
        result = analyze_industry_articles(list(rows), "food_processing", as_of=NOW)
        assert result["status"] == "ok"
        assert len(result["articles"]) == 1
        assert result["articles"][0]["fetched_at"] == NOW.isoformat()
        assert result["findings"][0]["status"] == "fresh"


def test_duplicate_url_uses_latest_fetched_headline_and_its_own_evidence():
    old = article(title="Food supply shortage", fetched_at=(NOW - timedelta(hours=1)).isoformat())
    updated = article(title="New market grant for exporters")
    expected = analyze_industry_articles([updated], "food_processing", as_of=NOW)
    for rows in permutations([old, updated]):
        assert analyze_industry_articles(list(rows), "food_processing", as_of=NOW) == expected
    assert [item["category"] for item in expected["findings"]] == ["opportunity"]
    assert expected["articles"][0]["published_at"] is None


@pytest.mark.parametrize("change", [
    {"title": "New market grant for exporters"},
    {"published_at": (NOW - timedelta(hours=3)).isoformat()},
    {"date_source": "source_publication_date"},
])
def test_duplicate_timestamp_ties_have_a_total_deterministic_order(change):
    rows = [article(), article(**change)]
    forward = analyze_industry_articles(rows, "food_processing", as_of=NOW)
    assert forward == analyze_industry_articles(list(reversed(rows)), "food_processing", as_of=NOW)
    assert len(forward["articles"]) == 1


def test_opportunity_signals_are_attributed_and_obvious_negation_is_not_a_risk():
    result = analyze_industry_articles([article(title="New market grant for food exporters"),
                                        article(title="No food shortage expected", url="https://news.example/other")],
                                       "food_processing", as_of=NOW)
    assert len(result["findings"]) == 1
    assert result["findings"][0]["category"] == "opportunity"
    assert set(result["findings"][0]["matched_terms"]) == {"grant", "new market"}


@pytest.mark.parametrize("status", [401, 429, 500])
def test_provider_failure_without_cache_is_unavailable_with_no_fake_headline(status):
    result = fetch(lambda request: httpx.Response(status, text="private provider response"))
    assert result["status"] == "unavailable"
    assert result["source_error"] == f"http_{status}"
    assert result["articles"] == []
    assert result["findings"] == []
    assert "industry_news" in result["missing"]
    assert "private provider response" not in str(result)


def test_rate_limit_retry_hint_is_propagated_without_automatic_retry():
    result = fetch(lambda request: httpx.Response(429, headers={"Retry-After": "30"}))
    assert result["retry_after_seconds"] == 30


def test_timeout_uses_only_real_cached_rows_with_stale_state():
    def timeout(request):
        raise httpx.ReadTimeout("provider timeout")

    result = fetch(timeout, cached_articles=[article(fetched_at=(NOW - timedelta(hours=2)).isoformat())])
    assert result["status"] == "stale"
    assert result["source_error"] == "timeout"
    assert result["articles"][0]["status"] == "stale"
    assert result["findings"][0]["status"] == "stale"


def test_recent_cache_avoids_a_rate_limited_api_request():
    def should_not_fetch(request):
        raise AssertionError("A fresh cache should be reused")

    result = fetch(should_not_fetch, cached_articles=[article()])
    assert result["source_status"] == "cached"
    assert result["status"] == "ok"


def test_expired_cache_and_other_sectors_are_not_presented_as_current_data():
    result = fetch(lambda request: httpx.Response(503), cached_articles=[
        article(fetched_at=(NOW - timedelta(days=8)).isoformat()),
        article(sector="packaging", url="https://news.example/other-sector"),
    ])
    assert result["status"] == "unavailable"
    assert not result["articles"]


@pytest.mark.parametrize("body", [b"not JSON", b'{"articles":null}', b'{"wrong":[]}',
                                 b'{"articles":[{"title":"invented","url":"javascript:alert(1)","seendate":"bad"}]}'])
def test_malformed_provider_output_never_becomes_a_headline(body):
    result = fetch(lambda request: httpx.Response(200, content=body))
    assert result["status"] == "unavailable"
    assert result["articles"] == []


def test_empty_success_is_distinct_from_an_outage():
    result = fetch(lambda request: httpx.Response(200, json={"articles": []}))
    assert result["status"] == "empty"
    assert result["source_status"] == "live"


def test_old_source_dates_are_stale_even_when_fetched_now():
    result = analyze_industry_articles([article(observed_at=(NOW - timedelta(days=4)).isoformat())], "food_processing", as_of=NOW)
    assert result["status"] == "stale"


@pytest.mark.parametrize("change", [{"url": "javascript:alert(1)"}, {"url": "https://user:secret@news.example/story"},
                                    {"observed_at": (NOW + timedelta(days=1)).isoformat()},
                                    {"observed_at": "2026-10-15T10:00:00"}])
def test_invalid_urls_or_timestamps_are_not_returned(change):
    result = analyze_industry_articles([article(**change)], "food_processing", as_of=NOW)
    assert result["articles"] == []


def test_explicit_sector_and_timezone_are_required():
    with pytest.raises(ValueError):
        analyze_industry_articles([], "arbitrary query injection", as_of=NOW)
    with pytest.raises(ValueError):
        analyze_industry_articles([], "food_processing", as_of=NOW.replace(tzinfo=None))


def test_oversized_provider_response_is_unavailable():
    result = fetch(lambda request: httpx.Response(200, content=b"x" * (2 * 1024 * 1024 + 1)))
    assert result["status"] == "unavailable"
