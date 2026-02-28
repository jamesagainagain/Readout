"""FastAPI route handlers for the Readout API."""

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

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
from readout.connectors.dust_client import chat_completion
from readout.connectors.apollo_client import search_people
from readout.intelligence.generator import generate_drafts
from readout.intelligence.subreddit_discovery import discover_subreddits
from readout.config import settings
from readout.models.schemas import (
    BriefRequest,
    BriefResponse,
    ChatRequest,
    ChatResponse,
    DiscoverSubredditsRequest,
    DiscoverSubredditsResponse,
    Draft,
    GenerateRequest,
    GenerateResponse,
    IngestRequest,
    IngestResponse,
    Lead,
    LeadSearchRequest,
    LeadSearchResponse,
    TTSRequest,
    EngagementAnalyticsRequest,
    AnalyzeEngagementResponse,
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

    if req.channel not in ("reddit", "email", "linkedin", "hackernews"):
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


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    """Conversational endpoint: product knowledge + message history → Claude reply.

    Send the full conversation history each time. Claude has full product context
    loaded as the system prompt — useful for voice brief, Q&A, or plan refinement.
    """
    try:
        knowledge = get_product_knowledge(req.knowledge_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Product knowledge not found.")

    summary = knowledge.get("summary") or {}
    chunks = knowledge.get("chunks") or []
    chunks_text = "\n\n".join(
        f"### {c.get('heading', '')} (level {c.get('level', 1)})\n{c.get('content', '')}"
        for c in chunks[:10]
    )

    system = f"""You are an outreach strategist helping a founder craft their go-to-market story.
You have deep knowledge of their product — use it to give specific, actionable advice.

Product summary:
{summary.get('product_description', 'N/A')}

Audience: {summary.get('audience', 'N/A')}
Differentiators: {', '.join(summary.get('differentiators', []) or [])}
Tech stack: {', '.join(summary.get('tech_stack', []) or [])}

Documentation:
{chunks_text}

Help the founder refine their outreach brief, choose channels, pick subreddits, or improve drafts.
Be concise and direct. Ask clarifying questions when needed."""

    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    try:
        reply = chat_completion(system=system, messages=messages)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {e}")

    return ChatResponse(reply=reply)


@router.post("/analyze-engagement", response_model=AnalyzeEngagementResponse)
def analyze_engagement(req: EngagementAnalyticsRequest):
    """Analyze engagement analytics with an LLM and return concise insights and recommendations."""
    system = """You are an outreach and content strategist. You analyze engagement metrics across channels (Reddit, Email, LinkedIn) and give brief, actionable insights.

Your response should:
1. Summarize what’s working (which channel or metric stands out).
2. Note one or two quick recommendations to improve engagement.
3. Be concise: 2–4 short paragraphs, no bullet walls. Write in a direct, friendly tone."""

    lines = []
    if req.stats:
        lines.append("Summary stats:")
        for s in req.stats:
            lines.append(f"  - {s.label}: {s.value} ({s.delta} this week)")
    if req.reach_by_day:
        lines.append("\nReach by channel (last 7 days):")
        for row in req.reach_by_day:
            parts = [f"{k}={v}" for k, v in row.items() if k != "day" and isinstance(v, (int, float))]
            lines.append(f"  {row.get('day', '')}: {', '.join(parts)}")
    if req.channel_breakdown:
        lines.append("\nChannel engagement breakdown (upvotes, comments, shares):")
        for row in req.channel_breakdown:
            lines.append(f"  {row}")
    if req.post_performance:
        lines.append("\nPost performance (score vs clicks):")
        for row in req.post_performance:
            lines.append(f"  {row}")

    data_text = "\n".join(lines) if lines else "No engagement data provided."
    user_content = f"Analyze this engagement data and give insights and recommendations.\n\n{data_text}"

    try:
        analysis = chat_completion(system=system, messages=[{"role": "user", "content": user_content}])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")

    return AnalyzeEngagementResponse(analysis=analysis.strip())


@router.get("/apollo/status")
def apollo_status():
    """Return 200 if Apollo is configured (APOLLO_API_KEY set), otherwise 503."""
    if not settings.apollo_api_key:
        raise HTTPException(status_code=503, detail="Apollo is not configured. Add APOLLO_API_KEY to the backend .env.")
    return {"status": "ok"}


@router.post("/leads/search", response_model=LeadSearchResponse)
def leads_search(req: LeadSearchRequest):
    """Search Apollo for leads by persona filters (title, industry, company size)."""
    if not settings.apollo_api_key:
        raise HTTPException(status_code=503, detail="Apollo is not configured. Add APOLLO_API_KEY to the backend .env.")
    try:
        raw = search_people(
            title=req.title or None,
            industry=req.industry or None,
            company_size=req.company_size or None,
            page=req.page,
            per_page=req.per_page,
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except httpx.HTTPStatusError as e:
        if e.response.status_code in (401, 403):
            raise HTTPException(status_code=502, detail="Invalid Apollo API key.")
        raise HTTPException(status_code=502, detail=f"Apollo API error: {e.response.text[:200]}")
    leads = [Lead(**r) for r in raw]
    return LeadSearchResponse(leads=leads)


@router.post("/tts")
def text_to_speech(req: TTSRequest):
    """Convert text to speech via ElevenLabs and return MP3 audio bytes."""
    if not settings.elevenlabs_api_key:
        raise HTTPException(status_code=500, detail="ElevenLabs API key not configured")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{req.voice_id}"
    with httpx.Client(timeout=30) as client:
        resp = client.post(
            url,
            headers={
                "xi-api-key": settings.elevenlabs_api_key,
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            },
            json={
                "text": req.text,
                "model_id": "eleven_turbo_v2_5",
                "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
            },
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=f"ElevenLabs error: {resp.text[:200]}")

    return Response(content=resp.content, media_type="audio/mpeg")
