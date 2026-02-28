import os
from unittest.mock import MagicMock, patch

import pytest

from readout.intelligence.generator import _build_user_prompt, _parse_drafts, generate_drafts
from readout.models.schemas import Draft

SKIP_LIVE = not os.environ.get("SUPABASE_URL")


# --- Unit tests (no credentials needed) ---


def test_parse_drafts_json_array():
    raw = '[{"title": "My Title", "body": "Post body here"}, {"title": "T2", "body": "B2"}]'
    drafts = _parse_drafts(raw, "reddit", 3)
    assert len(drafts) == 2
    assert drafts[0].title == "My Title"
    assert drafts[0].body == "Post body here"
    assert drafts[0].channel == "reddit"


def test_parse_drafts_single_object():
    raw = '{"title": "Subject", "body": "Email body"}'
    drafts = _parse_drafts(raw, "email", 3)
    assert len(drafts) == 1
    assert drafts[0].title == "Subject"


def test_parse_drafts_fallback_plain_text():
    raw = "This is the body text with no JSON."
    drafts = _parse_drafts(raw, "linkedin", 1)
    assert len(drafts) == 1
    assert drafts[0].body == raw.strip()


def test_parse_drafts_respects_count_limit():
    raw = '[{"title": "T1", "body": "B1"}, {"title": "T2", "body": "B2"}, {"title": "T3", "body": "B3"}]'
    drafts = _parse_drafts(raw, "reddit", 2)
    assert len(drafts) == 2


def test_build_user_prompt_includes_channel():
    knowledge = {
        "chunks": [{"heading": "Overview", "content": "A great tool", "level": 1}],
        "summary": {"product_description": "A CLI tool", "audience": "devs",
                    "differentiators": ["fast"], "tech_stack": ["Python"]},
    }
    brief = {"audience": "founders", "tone": "casual", "goals": "awareness", "constraints": None}
    prompt = _build_user_prompt(knowledge, brief, "reddit", subreddit="SideProject", count=2)
    assert "reddit" in prompt
    assert "r/SideProject" in prompt
    assert "2" in prompt
    assert "A CLI tool" in prompt


# --- Live tests (require real credentials) ---


@pytest.mark.skipif(SKIP_LIVE, reason="No Supabase credentials")
def test_generate_drafts_live():
    """End-to-end: generate reddit drafts for a real brief."""
    from readout.connectors.supabase_client import create_brief, upsert_product_knowledge

    chunks = [{"heading": "Readout", "content": "Outreach automation from your repo.", "level": 1}]
    kid = upsert_product_knowledge("test-gen-owner", "test-gen-repo", chunks)
    brief_id = create_brief(kid, audience="founders", tone="casual", goals="awareness",
                            channels=["reddit"])

    drafts = generate_drafts(brief_id, "reddit", count=1, save=False)
    assert len(drafts) >= 1
    assert drafts[0].channel == "reddit"
    assert drafts[0].body


@pytest.mark.skipif(SKIP_LIVE, reason="No Supabase credentials")
def test_generate_drafts_saves_to_db():
    from readout.connectors.supabase_client import (
        create_brief,
        get_drafts,
        upsert_product_knowledge,
    )

    chunks = [{"heading": "Tool", "content": "Saves time", "level": 1}]
    kid = upsert_product_knowledge("save-test-owner", "save-test-repo", chunks)
    brief_id = create_brief(kid, audience="devs", tone="professional")

    drafts = generate_drafts(brief_id, "email", count=1, save=True)
    saved = get_drafts(brief_id)
    assert len(saved) >= 1
    assert saved[0]["channel"] == "email"
