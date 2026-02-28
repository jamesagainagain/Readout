# Reddit scraping plan

Plan for making subreddit discovery work without Reddit API credentials by using the existing scraper as a fallback (and optionally as the only path when credentials are unset).

---

## Current state

| Component | Behavior |
|-----------|----------|
| **reddit_client.py** | PRAW: `search_subreddits(query, limit)`, `fetch_subreddit_metadata(name)`. Requires `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`. Returns `name`, `public_description`, `subscribers`, `over18`. |
| **reddit_scraper.py** | Single function: `scrape_subreddit_search(query, limit)`. Hits `old.reddit.com/subreddits/search`. Returns `name`, `description`, `subscribers`. No `over18`. 2s sleep after request. |
| **subreddit_discovery.py** | Uses only `search_subreddits` from reddit_client. Expects dicts with `name`, `public_description`, `subscribers`, `over18`. No fallback to scraper. |

**Gap:** If credentials are missing or API fails, discovery fails. Scraper exists but is not wired in, and its output shape doesn’t match what discovery expects (`description` vs `public_description`, missing `over18`).

---

## Goals

1. **Unified search** – One entry point for “search subreddits by query” that uses PRAW when possible and falls back to the scraper when credentials are missing or the API fails.
2. **Normalized shape** – All callers see the same dict shape: `name`, `public_description`, `subscribers`, `over18`.
3. **Respectful scraping** – Rate limiting, identifiable User-Agent, minimal requests so we don’t get blocked.
4. **Optional later** – Scraping more data (e.g. subreddit rules or top-post engagement) if we need it for ranking without PRAW.

---

## 1. Normalize scraper output

**File:** `readout/connectors/reddit_scraper.py`

- Keep `scrape_subreddit_search` as the low-level function.
- Have it return the same keys discovery expects:
  - `name` (already)
  - `public_description`: use current `description` value (alias so discovery can use `public_description`).
  - `subscribers` (already)
  - `over18`: default to `False` (old.reddit search results may expose NSFW in the HTML later; for now assume False so we don’t filter out everything).

So each scraped result should be:

```python
{"name": name, "public_description": description, "subscribers": subscribers, "over18": False}
```

No change to the function signature; only the keys of the returned dicts.

---

## 2. Unified search in reddit_client

**File:** `readout/connectors/reddit_client.py`

- **Option A (recommended):** Add a single function `search_subreddits(query, limit)` that:
  1. If `settings.reddit_client_id` and `settings.reddit_client_secret` are set: call PRAW `search_subreddits` (current implementation), return results.
  2. Else: call `reddit_scraper.scrape_subreddit_search(query, limit)` and return its results (after scraper returns normalized shape).
  3. On PRAW exception (e.g. auth error, 403, connection): fallback to scraper once, then re-raise or return scraper results depending on product choice (see below).

- **Option B:** New module `readout/connectors/reddit_provider.py` that implements the “try PRAW, else scraper” logic and is the only place discovery imports from. `reddit_client` stays PRAW-only; `reddit_scraper` stays scrape-only.

Recommendation: **Option A** to avoid an extra module and keep a single place for “search subreddits.” Move current PRAW `search_subreddits` to a private `_praw_search_subreddits` and have `search_subreddits` implement the fallback.

**Normalization:** Scraper already normalized in step 1. PRAW already returns `public_description` and `over18`. So no extra normalization layer needed if both paths return the same keys.

**Error handling:** On PRAW failure (missing credentials, 401, 403, timeout), log a warning and call scraper. If scraper also fails, raise or return [] (prefer returning [] so discovery can still return “no subreddits” instead of a 500).

---

## 3. Scraper robustness and etiquette

**File:** `readout/connectors/reddit_scraper.py`

- **User-Agent:** Already set to a readable value (`readout-scraper/1.0`). Keep it; optionally make it configurable via settings (e.g. `settings.reddit_user_agent` or a dedicated `scraper_user_agent`) so it can be overridden.
- **Rate limiting:** Keep a delay between requests. Current 2s at end of function is good; if we add multiple requests (e.g. pagination), add 1–2s (with optional small jitter) between requests.
- **Retries:** Optional: on 429 or 5xx, retry once or twice with backoff (e.g. 5s, 15s). Not required for first slice.
- **Timeout:** Already 15s; keep it.
- **Empty query:** Already return `[]`; keep it.

No need to add pagination for old.reddit subreddit search in the first slice unless we see that one page is too few results. We can add “next page” later if needed.

---

## 4. fetch_subreddit_metadata

Discovery does **not** call `fetch_subreddit_metadata` in the main flow; it only uses search. So:

- **Now:** No scraper implementation for metadata. If PRAW credentials are missing, `fetch_subreddit_metadata` will still fail if something calls it (e.g. a future feature). We can document that metadata is “API only” for now.
- **Later:** If we want metadata (rules, engagement) without PRAW, we could add `scrape_subreddit_metadata(subreddit_name)` that hits old.reddit.com/r/{name}/about or the sidebar and parses rules/description. Out of scope for this plan.

---

## 5. Wiring discovery

**File:** `readout/intelligence/subreddit_discovery.py`

- No code change needed if `reddit_client.search_subreddits` implements the fallback: discovery already calls `search_subreddits`. Once reddit_client uses scraper when PRAW is unavailable, discovery will automatically use scraping.
- Optional: add a one-line log when fallback is used (e.g. “Using Reddit scraper fallback (no API credentials or API error)”) so operators know which path ran. That log would live in reddit_client, not discovery.

---

## 6. Config and env

**File:** `readout/config.py`

- No new settings required. Existing `reddit_client_id`, `reddit_client_secret` already control whether PRAW can run. Empty = use scraper only.
- **.env.example:** Document that Reddit can work in two modes: with credentials (PRAW) or without (scraper fallback). List `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT` as optional for API mode.

---

## 7. Tests

- **reddit_scraper.py**
  - Update tests to assert normalized shape: `public_description`, `over18` in results when `len(results) > 0`.
  - Keep `test_scrape_empty_query` returning `[]`.
- **reddit_client.py**
  - Unit tests: when credentials are empty, `search_subreddits` should call scraper and return normalized results (mock or patch `reddit_scraper.scrape_subreddit_search`).
  - When credentials are set, mock PRAW and assert it’s called; optionally assert that on PRAW exception, scraper is called (integration-style).
- **subreddit_discovery** (optional): One test that runs `discover_subreddits` or `discover_subreddits_from_queries` with PRAW mocked to fail and scraper to return one subreddit; assert discovery returns that subreddit. Ensures the pipeline works end-to-end with fallback.

---

## 8. Implementation order

1. **Normalize scraper output** – In `reddit_scraper.py`, change returned dicts to include `public_description` and `over18`. Update tests.
2. **Unified search** – In `reddit_client.py`, add fallback: if no credentials or PRAW fails, call scraper. Ensure both paths return same shape. Add a short log when using scraper.
3. **Tests** – Update scraper tests; add reddit_client tests for “no credentials” and “PRAW fails” → scraper used.
4. **Docs** – .env.example and README (or FRONTEND-CANVAS-INTEGRATION) note: Reddit works with or without API credentials; scraper fallback when credentials missing or API errors.

---

## 9. Out of scope (later)

- Pagination for old.reddit subreddit search.
- Scraping subreddit metadata (rules, engagement).
- Using new Reddit (new.reddit.com) or mobile endpoints; stick to old.reddit for stability and simpler HTML.
- Caching search results (e.g. per query) to reduce requests; can add later if we hit rate limits.

---

## Summary

| Task | File(s) | Description |
|------|---------|-------------|
| Normalize scraper dict keys | reddit_scraper.py | Return `public_description`, `over18` |
| Unified search with fallback | reddit_client.py | Try PRAW, else scraper; same shape |
| Scraper tests | test_reddit_scraper.py | Assert normalized shape |
| Client tests | test_reddit_client.py (or new) | No-creds and PRAW-fail → scraper |
| Docs | .env.example, README or integration doc | Reddit API optional; scraper fallback |

This keeps discovery working without Reddit API credentials and makes the scraper a first-class fallback with a single, consistent contract for search results.
