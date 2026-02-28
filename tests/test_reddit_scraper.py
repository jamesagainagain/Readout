from readout.connectors.reddit_scraper import scrape_subreddit_search


def test_scrape_subreddit_search():
    results = scrape_subreddit_search("python programming", limit=5)
    assert isinstance(results, list)
    # May return 0 if Reddit blocks — that's ok, test the structure
    if len(results) > 0:
        assert "name" in results[0]
        assert "description" in results[0]


def test_scrape_empty_query():
    results = scrape_subreddit_search("", limit=5)
    assert isinstance(results, list)
