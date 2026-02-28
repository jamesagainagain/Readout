import os

import pytest

from readout.connectors.supabase_client import (
    upsert_product_knowledge,
    get_product_knowledge,
    create_brief,
    get_brief,
    save_drafts,
    get_drafts,
    upsert_subreddits,
)

SKIP = not os.environ.get("SUPABASE_URL")


@pytest.mark.skipif(SKIP, reason="No Supabase credentials")
def test_upsert_and_get_product_knowledge():
    chunks = [{"heading": "Test", "content": "test content", "level": 1}]
    summary = {"product_description": "test", "features": [], "audience": "devs",
               "differentiators": [], "tech_stack": []}
    kid = upsert_product_knowledge("test-owner", "test-repo", chunks, summary)
    assert kid is not None

    knowledge = get_product_knowledge(kid)
    assert knowledge["repo_owner"] == "test-owner"
    assert len(knowledge["chunks"]) == 1


@pytest.mark.skipif(SKIP, reason="No Supabase credentials")
def test_create_and_get_brief():
    chunks = [{"heading": "Test", "content": "content", "level": 1}]
    kid = upsert_product_knowledge("brief-test-owner", "brief-test-repo", chunks)

    brief_id = create_brief(kid, audience="devs", tone="casual", goals="awareness",
                            channels=["reddit"])
    assert brief_id is not None

    brief = get_brief(brief_id)
    assert brief["audience"] == "devs"


@pytest.mark.skipif(SKIP, reason="No Supabase credentials")
def test_save_and_get_drafts():
    chunks = [{"heading": "Test", "content": "content", "level": 1}]
    kid = upsert_product_knowledge("draft-test-owner", "draft-test-repo", chunks)
    brief_id = create_brief(kid, audience="devs", tone="casual")

    drafts = [{"channel": "reddit", "title": "Test Post", "body": "Check out this tool",
               "metadata": {"subreddit": "r/test"}}]
    save_drafts(brief_id, drafts)

    result = get_drafts(brief_id)
    assert len(result) >= 1
    assert result[0]["channel"] == "reddit"


@pytest.mark.skipif(SKIP, reason="No Supabase credentials")
def test_upsert_subreddits():
    rows = [{"name": "test_readout_sub", "description": "test", "subscribers": 100}]
    upsert_subreddits(rows)
    # No exception = success
