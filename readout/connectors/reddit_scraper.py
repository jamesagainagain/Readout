import time

import httpx
from bs4 import BeautifulSoup


def scrape_subreddit_search(query: str, limit: int = 20) -> list[dict]:
    """Fallback: scrape old.reddit.com for subreddit search results."""
    if not query.strip():
        return []

    url = "https://old.reddit.com/subreddits/search"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) readout-scraper/1.0"
    }

    try:
        resp = httpx.get(
            url, params={"q": query}, headers=headers, timeout=15, follow_redirects=True
        )
        resp.raise_for_status()
    except httpx.HTTPError:
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    results = []

    for entry in soup.select(".search-result-subreddit"):
        name_el = entry.select_one(".search-title a")
        desc_el = entry.select_one(".search-result-body")
        subs_el = entry.select_one(".search-subscribers .number")

        if not name_el:
            continue

        name = name_el.text.strip().replace("/r/", "").replace("r/", "")
        description = desc_el.text.strip() if desc_el else ""
        subscribers = None
        if subs_el:
            try:
                subscribers = int(subs_el.text.strip().replace(",", ""))
            except ValueError:
                pass

        results.append(
            {
                "name": name,
                "public_description": description,
                "subscribers": subscribers,
                "over18": False,
            }
        )

        if len(results) >= limit:
            break

    time.sleep(2)
    return results
