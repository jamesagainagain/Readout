"""Integration tests: end-to-end flow through the FastAPI app.

These tests require live credentials (SUPABASE_URL, DUST_API_KEY, REDDIT_CLIENT_ID).
They are skipped automatically when credentials are absent.

Flow tested:
  POST /ingest  →  POST /brief  →  POST /generate  →  GET /briefs/{id}/drafts
  POST /ingest  →  POST /brief  →  POST /discover-subreddits
"""

import os

import pytest
from fastapi.testclient import TestClient

from readout.main import app

SKIP = not (os.environ.get("SUPABASE_URL") and os.environ.get("DUST_API_KEY"))
SKIP_REDDIT = SKIP or not os.environ.get("REDDIT_CLIENT_ID")

client = TestClient(app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.skipif(SKIP, reason="Missing live credentials")
def test_full_generate_flow():
    """Ingest a public repo, create a brief, generate reddit drafts, retrieve them."""
    # 1. Ingest
    ingest_resp = client.post("/ingest", json={
        "owner": "tiangolo",
        "repo": "fastapi",
        "paths": ["README.md"],
    })
    assert ingest_resp.status_code == 200, ingest_resp.text
    ingest_data = ingest_resp.json()
    assert "knowledge_id" in ingest_data
    assert ingest_data["chunks_count"] > 0
    knowledge_id = ingest_data["knowledge_id"]

    # 2. Create brief
    brief_resp = client.post("/brief", json={
        "knowledge_id": knowledge_id,
        "audience": "Python developers",
        "tone": "casual",
        "goals": "community awareness",
        "channels": ["reddit"],
    })
    assert brief_resp.status_code == 200, brief_resp.text
    brief_id = brief_resp.json()["brief_id"]

    # 3. Generate drafts
    gen_resp = client.post("/generate", json={
        "brief_id": brief_id,
        "channel": "reddit",
        "count": 2,
    })
    assert gen_resp.status_code == 200, gen_resp.text
    drafts = gen_resp.json()["drafts"]
    assert len(drafts) >= 1
    assert all(d["channel"] == "reddit" for d in drafts)
    assert all(d["body"] for d in drafts)

    # 4. Retrieve saved drafts
    get_resp = client.get(f"/briefs/{brief_id}/drafts")
    assert get_resp.status_code == 200, get_resp.text
    saved = get_resp.json()["drafts"]
    assert len(saved) >= 1


@pytest.mark.skipif(SKIP_REDDIT, reason="Missing live credentials (Supabase + Reddit)")
def test_discover_subreddits_flow():
    """Ingest a repo, create a brief, discover subreddits."""
    from readout.connectors.supabase_client import create_brief, upsert_product_knowledge

    chunks = [
        {"heading": "Readout", "content": "CLI outreach automation from your repo.", "level": 1},
        {"heading": "Features", "content": "Reddit posts, cold email, LinkedIn drafts.", "level": 2},
    ]
    summary = {
        "product_description": "Outreach automation for developers",
        "audience": "indie hackers and founders",
        "differentiators": ["repo-connected", "multi-channel"],
        "tech_stack": ["Python", "FastAPI"],
    }
    kid = upsert_product_knowledge("integ-test-owner", "integ-test-repo", chunks, summary)
    brief_id = create_brief(kid, audience="indie hackers", tone="casual",
                            goals="community growth", channels=["reddit"])

    disc_resp = client.post("/discover-subreddits", json={"brief_id": brief_id})
    assert disc_resp.status_code == 200, disc_resp.text
    subreddits = disc_resp.json()["subreddits"]
    assert isinstance(subreddits, list)


@pytest.mark.skipif(SKIP, reason="Missing live credentials")
def test_generate_unknown_channel_returns_422():
    """Attempting to generate for an unknown channel returns 422."""
    from readout.connectors.supabase_client import create_brief, upsert_product_knowledge

    kid = upsert_product_knowledge("err-test-owner", "err-test-repo",
                                   [{"heading": "T", "content": "c", "level": 1}])
    brief_id = create_brief(kid, audience="devs", tone="casual")

    resp = client.post("/generate", json={"brief_id": brief_id, "channel": "fax", "count": 1})
    assert resp.status_code == 422


def test_brief_not_found_returns_404():
    """Getting drafts for a non-existent brief returns 404 (no credentials needed for structure)."""
    # This hits Supabase, so only run if credentials present
    if not os.environ.get("SUPABASE_URL"):
        pytest.skip("No Supabase credentials")
    resp = client.get("/briefs/00000000-0000-0000-0000-000000000000/drafts")
    assert resp.status_code == 404
