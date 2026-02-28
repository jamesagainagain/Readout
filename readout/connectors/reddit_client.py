import logging
import time

import praw

from readout.config import settings

logger = logging.getLogger(__name__)


def _has_reddit_credentials() -> bool:
    return bool(settings.reddit_client_id and settings.reddit_client_secret)


def _reddit():
    return praw.Reddit(
        client_id=settings.reddit_client_id,
        client_secret=settings.reddit_client_secret,
        user_agent=settings.reddit_user_agent,
    )


def search_subreddits(query: str, limit: int = 20) -> list[dict]:
    """Search Reddit for subreddits matching a query. Uses PRAW when credentials are set; falls back to scraping old.reddit.com otherwise or on API failure."""
    if _has_reddit_credentials():
        try:
            reddit = _reddit()
            results = []
            for sub in reddit.subreddits.search(query, limit=limit):
                results.append(
                    {
                        "name": sub.display_name,
                        "public_description": sub.public_description,
                        "subscribers": sub.subscribers,
                        "over18": sub.over18,
                    }
                )
            return results
        except Exception as e:
            logger.warning("Reddit API search failed, using scraper fallback: %s", e)
    else:
        logger.debug("No Reddit API credentials; using scraper for subreddit search")

    from readout.connectors.reddit_scraper import scrape_subreddit_search

    results = scrape_subreddit_search(query, limit=limit)
    time.sleep(0.5)
    return results


def fetch_subreddit_metadata(subreddit_name: str) -> dict:
    """Fetch detailed metadata for a single subreddit."""
    reddit = _reddit()
    sub = reddit.subreddit(subreddit_name)

    rules = []
    for rule in sub.rules:
        rules.append({"short_name": rule.short_name, "description": rule.description})

    scores = []
    for post in sub.top(time_filter="week", limit=25):
        scores.append(post.score)

    engagement_avg = sum(scores) / len(scores) if scores else None
    time.sleep(1)

    return {
        "name": sub.display_name,
        "description": sub.description,
        "public_description": sub.public_description,
        "subscribers": sub.subscribers,
        "over18": sub.over18,
        "rules": rules,
        "engagement_avg_score": engagement_avg,
    }
