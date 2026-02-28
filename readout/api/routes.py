"""FastAPI route handlers for the Readout API."""

from fastapi import APIRouter, HTTPException

from readout.connectors.supabase_client import (
    create_brief,
    get_brief,
    get_drafts,
    get_product_knowledge,
    upsert_product_knowledge,
)
from readout.ingestion.github_client import fetch_repo_contents
from readout.ingestion.markdown_parser import parse_markdown
from readout.ingestion.summarizer import summarize_product
from readout.intelligence.generator import generate_drafts
from readout.intelligence.subreddit_discovery import discover_subreddits
from readout.models.schemas import (
    BriefRequest,
    BriefResponse,
    DiscoverSubredditsRequest,
    DiscoverSubredditsResponse,
    Draft,
    GenerateRequest,
    GenerateResponse,
    IngestRequest,
    IngestResponse,
)

router = APIRouter()


@router.post("/ingest", response_model=IngestResponse)
def ingest(req: IngestRequest):
    """Fetch a GitHub repo, parse markdown, summarize, and store as product knowledge."""
    try:
        files = fetch_repo_contents(req.owner, req.repo, req.paths, req.github_token)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to fetch repo: {e}")

    chunks: list[dict] = []
    for f in files:
        chunks.extend(parse_markdown(f["content"]))

    if not chunks:
        raise HTTPException(status_code=422, detail="No parseable markdown content found in repo.")

    # Summarize with Gemini (skip gracefully if no API key)
    summary = None
    try:
        summary = summarize_product(chunks)
    except Exception:
        pass  # Summary is optional; ingestion still succeeds

    knowledge_id = upsert_product_knowledge(req.owner, req.repo, chunks, summary)

    return IngestResponse(
        knowledge_id=knowledge_id,
        chunks_count=len(chunks),
        summary=summary,
    )


@router.post("/brief", response_model=BriefResponse)
def create_brief_route(req: BriefRequest):
    """Create a campaign brief linked to product knowledge."""
    # Verify knowledge exists
    try:
        get_product_knowledge(req.knowledge_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Product knowledge not found.")

    brief_id = create_brief(
        knowledge_id=req.knowledge_id,
        audience=req.audience,
        tone=req.tone,
        goals=req.goals or "",
        channels=req.channels,
        constraints=req.constraints or "",
    )
    return BriefResponse(brief_id=brief_id)


@router.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest):
    """Generate channel-specific drafts for a brief."""
    # Verify brief exists
    try:
        get_brief(req.brief_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Brief not found.")

    if req.channel not in ("reddit", "email", "linkedin"):
        raise HTTPException(status_code=422, detail=f"Unknown channel: {req.channel}")

    try:
        drafts = generate_drafts(req.brief_id, req.channel, req.count, save=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {e}")

    return GenerateResponse(drafts=drafts)


@router.get("/briefs/{brief_id}/drafts", response_model=GenerateResponse)
def get_drafts_route(brief_id: str):
    """Retrieve all saved drafts for a brief."""
    try:
        get_brief(brief_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Brief not found.")

    rows = get_drafts(brief_id)
    drafts = [
        Draft(
            id=r.get("id"),
            channel=r["channel"],
            title=r.get("title"),
            body=r["body"],
            metadata=r.get("metadata"),
        )
        for r in rows
    ]
    return GenerateResponse(drafts=drafts)


@router.post("/discover-subreddits", response_model=DiscoverSubredditsResponse)
def discover(req: DiscoverSubredditsRequest):
    """Discover relevant subreddits for a brief using LLM + Reddit search."""
    try:
        get_brief(req.brief_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Brief not found.")

    try:
        subreddits = discover_subreddits(req.brief_id, persist=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Discovery failed: {e}")

    return DiscoverSubredditsResponse(subreddits=subreddits)
