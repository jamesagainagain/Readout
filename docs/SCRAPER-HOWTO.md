# How the Reddit scraper works and how to run it

## What a scraper does (in this project)

1. **Request** – Send an HTTP GET to a webpage (e.g. `https://old.reddit.com/subreddits/search?q=python`).
2. **Parse** – Turn the HTML into a structure you can query (we use **BeautifulSoup**).
3. **Extract** – Use CSS selectors (e.g. `.search-result-subreddit`, `.search-title a`) to find the bits you care about (name, description, subscriber count).
4. **Return** – Give back a list of dicts so the rest of the app can use the data without caring that it came from scraping.

No browser, no JavaScript execution—just raw HTML. We use **old.reddit.com** because its HTML is simple and stable.

---

## How this scraper is implemented

**File:** `readout/connectors/reddit_scraper.py`

| Step | Code | What it does |
|------|------|--------------|
| 1. Request | `httpx.get(url, params={"q": query}, headers=...)` | Fetches the search page. `User-Agent` identifies the client so Reddit doesn’t treat it as a generic bot. |
| 2. Parse | `BeautifulSoup(resp.text, "html.parser")` | Builds a DOM from the HTML string. |
| 3. Extract | `soup.select(".search-result-subreddit")` then `.select_one(".search-title a")` etc. | Finds each result block, then the subreddit name link, description div, subscriber span. |
| 4. Return | `results.append({"name": ..., "public_description": ..., "subscribers": ..., "over18": False})` | Same shape as PRAW so discovery can use either source; `time.sleep(2)` before returning. |

The selectors (`.search-result-subreddit`, `.search-title a`, …) come from looking at old.reddit’s HTML. If Reddit changes their markup, those selectors may need updating.

---

## How to run it

### 1. Run the tests (safest)

From the **project root** (`Readout/`):

```bash
pytest tests/test_reddit_scraper.py -v
```

This calls `scrape_subreddit_search("python programming", limit=5)` and checks the shape of the results. If Reddit blocks or returns no results, the test still passes as long as the return value is a list (and, when non-empty, has the expected keys).

### 2. Call it from Python (REPL or script)

From the project root, with the virtualenv activated:

```bash
cd /Users/james/Readout
# Activate your venv if you use one, e.g.:
# source .venv/bin/activate   or   uv run ...
python -c "
from readout.connectors.reddit_scraper import scrape_subreddit_search
results = scrape_subreddit_search('python programming', limit=5)
for r in results:
    print(r['name'], '-', r.get('subscribers'), 'subs')
print('Total:', len(results))
"
```

Or run the script in `scripts/run_reddit_scraper.py`:

```bash
python scripts/run_reddit_scraper.py "your search query"
python scripts/run_reddit_scraper.py "indie games" 20
```

### 3. Run it via the API (scraper is wired as fallback)

`reddit_client.search_subreddits` now uses the scraper when Reddit API credentials are missing or when the API fails. So you can call the discover endpoint **without** setting `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET`:

```bash
# Backend on 8000, Supabase + Dust configured; no Reddit API keys
curl -X POST http://localhost:8000/discover-subreddits -H "Content-Type: application/json" -d '{"brief_id": "<a-valid-brief-id>"}'
```

Discovery will use the scraper for the search step, then rank with the LLM and **persist results to Supabase** (see below). You don’t run the scraper by itself for that—it’s used inside the app automatically when the API path isn’t available.

---

## How scraped data gets into Supabase

The scraper **does not** write to Supabase itself. The flow is:

1. **Discovery** (`subreddit_discovery.discover_subreddits`) is called with a `brief_id` (e.g. from `POST /discover-subreddits`).
2. It loads the brief and product knowledge from Supabase, then asks the LLM for search queries.
3. It calls **`reddit_client.search_subreddits(query)`** for each query. That function now uses **PRAW if credentials are set**, otherwise (or on API error) uses **the scraper**. Both return the same shape: `name`, `public_description`, `subscribers`, `over18`.
4. Discovery filters (min subscribers, SFW), ranks with the LLM, and builds a list of `SubredditInfo`.
5. It then calls **`supabase_client.upsert_subreddits(rows)`**, which writes to the **`subreddits`** table (name, public_description, subscribers, topic, etc.). Rows are upserted on `name`, so the same subreddit can be updated across runs.

So: **scraper → search_subreddits (fallback) → discovery → upsert_subreddits → Supabase.** The scraper is just one data source; persistence is always done by the discovery layer.

---

## Does it work?

- **Scraper in isolation:** Yes. Run `pytest tests/test_reddit_scraper.py -v` or `python scripts/run_reddit_scraper.py "python"`.
- **End-to-end (scraper → Supabase):** Yes, now that the fallback is implemented. With no Reddit API keys (or if the API fails), discovery uses the scraper and still writes to the `subreddits` table. You need Supabase and Dust configured so discovery can load the brief and run the LLM steps.

---

## Can you use Devvit instead?

**Devvit** is Reddit’s platform for building **apps that run inside Reddit** (e.g. in-subreddit tools, games). It’s not a scraper and it’s not something you run on your own server. Devvit apps use `context.reddit` on Reddit’s infrastructure and don’t give you a way to “scrape” Reddit from an external FastAPI app like Readout.

For Readout (external app, optional or no Reddit API keys), the right approach is the **existing scraper** (httpx + BeautifulSoup on old.reddit.com) with **PRAW as primary when credentials are set**. That’s what’s implemented: `reddit_client.search_subreddits` tries PRAW first, falls back to the scraper, and discovery + Supabase work the same either way.

---

## Optional: run script

The repo includes `scripts/run_reddit_scraper.py`. From project root:

```bash
python scripts/run_reddit_scraper.py "python programming"
python scripts/run_reddit_scraper.py "indie games" 20
```

---

## Summary

| Goal | Command / approach |
|------|---------------------|
| **Run tests** | `pytest tests/test_reddit_scraper.py -v` |
| **Run scraper once from CLI** | `python -c "from readout.connectors.reddit_scraper import scrape_subreddit_search; print(scrape_subreddit_search('python', 5))"` or use `scripts/run_reddit_scraper.py` |
| **Use in the app** | No wiring needed. Call `POST /discover-subreddits` with a valid `brief_id`; with no Reddit API keys (or on API failure), discovery uses the scraper and still writes to Supabase. |
