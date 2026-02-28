import os
from unittest.mock import MagicMock, patch

import pytest

from readout.intelligence.subreddit_discovery import _build_product_context, _extract_queries, _extract_ranked

SKIP_LIVE = not os.environ.get("SUPABASE_URL")
SKIP_REDDIT = not os.environ.get("REDDIT_CLIENT_ID")


# --- Unit tests ---

def test_extract_queries_json_array():
    raw = '["developer tools", "open source CLI", "startup founders"]'
    queries = _extract_queries(raw)
    assert queries == ["developer tools", "open source CLI", "startup founders"]


def test_extract_queries_with_surrounding_text():
    raw = 'Here are the queries:\n["python tools", "devops automation"]'
    queries = _extract_queries(raw)
    assert "python tools" in queries


def test_extract_ranked_valid():
    raw = '[{"name": "devops", "rationale": "Great fit"}, {"name": "sysadmin", "rationale": "Relevant"}]'
    ranked = _extract_ranked(raw)
    assert len(ranked) == 2
    assert ranked[0]["name"] == "devops"


def test_extract_ranked_empty_on_bad_json():
    ranked = _extract_ranked("no json here")
    assert ranked == []


def test_build_product_context_includes_fields():
    knowledge = {
        "summary": {
            "product_description": "A great CLI",
            "audience": "developers",
            "differentiators": ["fast", "simple"],
            "tech_stack": ["Python"],
        }
    }
    brief = {"audience": "founders", "tone": "casual", "goals": "awareness"}
    ctx = _build_product_context(knowledge, brief)
    assert "A great CLI" in ctx
    assert "founders" in ctx
    assert "fast" in ctx


# --- Live tests ---

@pytest.mark.skipif(SKIP_REDDIT, reason="No Reddit credentials")
def test_discover_subreddits_from_queries_live():
    from readout.intelligence.subreddit_discovery import discover_subreddits_from_queries
    results = discover_subreddits_from_queries(["python developers"], min_subscribers=100, per_query_limit=5)
    assert isinstance(results, list)
    # Should find at least one real subreddit
    if results:
        assert results[0].name
        assert results[0].subscribers


@pytest.mark.skipif(SKIP_LIVE, reason="No Supabase credentials")
def test_discover_subreddits_live():
    from readout.connectors.supabase_client import create_brief, upsert_product_knowledge
    from readout.intelligence.subreddit_discovery import discover_subreddits

    chunks = [{"heading": "Readout", "content": "Outreach automation from your repo.", "level": 1}]
    summary = {"product_description": "CLI outreach tool", "audience": "founders",
               "differentiators": ["repo-connected"], "tech_stack": ["Python"]}
    kid = upsert_product_knowledge("disc-test-owner", "disc-test-repo", chunks, summary)
    brief_id = create_brief(kid, audience="founders", tone="casual", goals="community growth",
                            channels=["reddit"])

    results = discover_subreddits(brief_id, persist=False)
    assert isinstance(results, list)
