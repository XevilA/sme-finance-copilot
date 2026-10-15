# Live provider verification

Verified on 2026-10-15 from the Windows development machine. Synthetic financial
inputs were used; no workbook, contact details or credentials are included here.

## Backend regression checks

- Docker Compose confirmed the existing PostgreSQL container running; no volume
  was removed or reset.
- The full suite passed **330 tests**, with one existing Starlette/httpx
  deprecation warning, after the final mocked-provider assertions were added.
- `backend/run.cmd` restarted the backend at `127.0.0.1:8000`; `/health` reported
  `persistence: true`. A rules-only HTTP analysis remained grade B / 75.00 with
  `aiMode: rules` and no warning.
- The 12 translated finding branches were compared with the original Git source
  across positive and negative financial cases. Only finding/action text and
  explanation summary/reasoning/suggestions differed, excluding the independent
  per-request `analyzedAt` timestamp. Numerical values and all identifiers stayed
  unchanged. The code structure was also compared with string values excluded.
- Both seeded SME overview endpoints returned Thai `title`, `description` and
  `actionText`. Stable action IDs included `act-debt_service_coverage` for Baan
  Suan and `act-debt_service_shortfall` for Rung Charoen.
- The diff against baseline `6dc7f6b` was empty for `src/` and every protected
  Claude-owned path listed in the assignment. The ignored `.env` was not staged.

## OpenAI

Authenticated model listing succeeded with HTTP 200 and included `gpt-6-luna`.
The configured model is the cheapest current, non-deprecated compatible text
model in the official catalog reviewed for this run. Legacy `gpt-5-nano` and
`gpt-4.1-nano` are cheaper in some token categories but marked deprecated.

Exactly two paid generation requests were made through the real local HTTP
analysis endpoint at 2026-10-15 01:55 UTC. Both returned valid Structured Outputs,
`status: completed`, `aiMode: openai`, `aiModel: gpt-6-luna`, and no warning.
No paid failure probes or live test-suite loops were run.

| Case | Input tokens | Cache-write tokens within input | Cached input tokens | Output tokens including reasoning | Cost at published rates, USD |
| --- | ---: | ---: | ---: | ---: | ---: |
| Synthetic example | 4,565 | 4,562 | 0 | 128 | 0.00063455 |
| Synthetic cash shortfall | 5,759 | 5,756 | 0 | 184 | 0.00081180 |
| Total | 10,324 | 10,318 | 0 | 312 | **0.00144635** |

Standard rates per million tokens: uncached input $0.10, cached input $0.01,
cache write $0.125, output $0.50. Input tokens are separated into these three
input categories; cache writes are not counted again at the ordinary input rate.
Output usage already includes reasoning tokens, so reasoning is not added twice.
No tools, regional processing, Fast mode or long-context pricing were requested.

The resulting **usage-based cost is $0.00144635**. Subtracting it from the user's
reported $5.98 leaves **$5.97855365**. This is an estimate from observed usage and
published rates, **not a verified billing debit or account balance**. No billing
dashboard or organization Costs API was accessed; other account activity, taxes
and billing adjustments are not known.

Metrics and grades matched the rules path byte-for-byte under canonical JSON.
Every finding matched byte-for-byte when keyed by ID. The shortfall case changed
array order within fixed severity groups, as intended; it did not change facts.
The synthetic example retained its array order. `max_output_tokens` remains 600.
The nine mocked provider cases remain automated coverage and now assert complete
finding preservation, severity order, model ID and the output-token cap.

Sources: [model pricing and capabilities](https://developers.openai.com/api/docs/models/gpt-6-luna),
[official pricing](https://developers.openai.com/api/docs/pricing),
[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

## Industry news: not successfully fetched

Provider remains `https://api.gdeltproject.org/api/v2/doc/doc`. No provider switch,
TLS verification bypass, HTTP downgrade or fabricated headline was introduced.

Observed diagnostics:

| Probe | Observed result |
| --- | --- |
| DNS for `api.gdeltproject.org` | Resolved to `104.197.47.124` during this run |
| Production query: sector `food_processing`, ArtList JSON, 50 records, 7 days | `ConnectTimeout`, approximately 5.5-5.8 seconds |
| Simplified HTTPS query: `food`, 5 records, 24 hours | Same `ConnectTimeout` |
| Direct TCP connections to provider ports 443 and 80 | Connected in approximately 0.2-0.3 seconds |
| TLS handshake to provider port 443, with normal certificate verification and SNI | Timed out after approximately 5.3 seconds |
| Public GDELT homepage HTTPS control | HTTP 301 |
| Plain HTTP API diagnostic, no redirects followed | HTTP 429; provider body requests at most one request per five seconds |
| Local `GET /api/industry/trends?sector=food_processing` | HTTP 200 envelope, `status: unavailable`, `sourceError: timeout`, zero articles, zero stored rows |

There are two observed issues: HTTPS stalls at TLS from this environment, and a
separate plain-HTTP diagnostic reaches a rate-limited API. Query syntax cannot
explain a TLS handshake timeout because no HTTP query has been sent at that
stage. These observations do **not** establish whether the TLS problem is the
provider, an intermediary, or destination-specific local/network filtering.
General outbound HTTPS works, as shown by the authenticated OpenAI calls.

A working environment needs a successful certificate-verified TLS handshake to
the provider, followed by a successful ArtList JSON response. Recheck from the
intended deployment host, and inspect destination-specific firewall/proxy/TLS
inspection rules or provider health if the handshake still fails. Do not disable
certificate verification or silently use plain HTTP to hide this limitation.

Claude still owns `industry_news_fetch_state` and provider-wide scheduling across
workers and sectors. Respect the provider's minimum interval and any Retry-After
before retrying; a database limiter cannot itself repair a failing TLS handshake.
No schema or Claude-owned API/cache file was changed in this work.

Successful live deduplication and publication-date checks remain **unverified**
because no real articles were retrieved. Mocked normalization/deduplication tests
still pass. GDELT `seendate` remains `observed_at`; `published_at` stays null when
the source supplies no actual publication date. Empty/unavailable is truthful.
