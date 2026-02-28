#!/usr/bin/env python3
"""Run the Reddit subreddit search scraper. Usage: python scripts/run_reddit_scraper.py [query] [limit]"""
import sys

from readout.connectors.reddit_scraper import scrape_subreddit_search


def main() -> None:
    query = sys.argv[1] if len(sys.argv) > 1 else "python programming"
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    results = scrape_subreddit_search(query, limit=limit)
    print(f"Query: {query!r} (limit={limit})\nFound {len(results)} subreddits:\n")
    for r in results:
        subs = r.get("subscribers") or "?"
        print(f"  r/{r['name']}  {subs} subscribers")
        desc = r.get("public_description") or r.get("description") or ""
        if desc:
            print(f"    {desc[:80]}...")


if __name__ == "__main__":
    main()
