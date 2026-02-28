import time

import praw

from readout.config import settings


def _reddit():
    return praw.Reddit(
        client_id=settings.reddit_client_id,
        client_secret=settings.reddit_client_secret,
        user_agent=settings.reddit_user_agent,
    )


def search_subreddits(query: str, limit: int = 20) -> list[dict]:
    """Search Reddit for subreddits matching a query."""
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
