from datetime import datetime, timezone
from typing import Optional

from supabase import create_client

from readout.config import settings


def _client():
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def upsert_product_knowledge(
    repo_owner: str,
    repo_name: str,
    chunks: list,
    summary: Optional[dict] = None,
) -> str:
    """Upsert product knowledge for a repo; return the row id."""
    row = {
        "repo_owner": repo_owner,
        "repo_name": repo_name,
        "chunks": chunks,
        "summary": summary,
        "last_synced_at": datetime.now(timezone.utc).isoformat(),
    }
    result = (
        _client()
        .table("product_knowledge")
        .upsert(row, on_conflict="repo_owner,repo_name")
        .execute()
    )
    return result.data[0]["id"]


def get_product_knowledge(knowledge_id: str) -> dict:
    result = (
        _client()
        .table("product_knowledge")
        .select("*")
        .eq("id", knowledge_id)
        .single()
        .execute()
    )
    return result.data


def create_brief(
    knowledge_id: str,
    audience: str = "",
    tone: str = "",
    goals: str = "",
    channels: Optional[list] = None,
    constraints: str = "",
) -> str:
    """Create a brief linked to product knowledge; return the brief id."""
    row = {
        "knowledge_id": knowledge_id,
        "audience": audience,
        "tone": tone,
        "goals": goals,
        "channels": channels or [],
        "constraints": constraints,
    }
    result = _client().table("briefs").insert(row).execute()
    return result.data[0]["id"]


def get_brief(brief_id: str) -> dict:
    result = (
        _client().table("briefs").select("*").eq("id", brief_id).single().execute()
    )
    return result.data


def save_drafts(brief_id: str, drafts: list) -> None:
    """Insert drafts for a brief (each draft: channel, title, body, metadata)."""
    rows = [{"brief_id": brief_id, **d} for d in drafts]
    _client().table("drafts").insert(rows).execute()


def get_drafts(brief_id: str) -> list:
    result = (
        _client().table("drafts").select("*").eq("brief_id", brief_id).execute()
    )
    return result.data


def upsert_subreddits(rows: list) -> None:
    """Upsert subreddit metadata rows (each must have 'name')."""
    _client().table("subreddits").upsert(rows, on_conflict="name").execute()
