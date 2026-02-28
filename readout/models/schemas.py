from __future__ import annotations

from pydantic import BaseModel


class MarkdownChunk(BaseModel):
    heading: str
    content: str
    level: int


class ProductSummary(BaseModel):
    product_description: str
    features: list[str]
    audience: str
    differentiators: list[str]
    tech_stack: list[str]


class IngestRequest(BaseModel):
    owner: str
    repo: str
    paths: list[str] | None = None
    github_token: str | None = None


class IngestResponse(BaseModel):
    knowledge_id: str
    chunks_count: int
    summary: ProductSummary | None


class BriefRequest(BaseModel):
    knowledge_id: str
    audience: str
    tone: str
    goals: str | None = None
    channels: list[str] = ["reddit"]
    constraints: str | None = None


class BriefResponse(BaseModel):
    brief_id: str


class GenerateRequest(BaseModel):
    brief_id: str
    channel: str
    count: int = 3


class Draft(BaseModel):
    id: str | None = None
    channel: str
    title: str | None = None
    body: str
    metadata: dict | None = None


class GenerateResponse(BaseModel):
    drafts: list[Draft]


class SubredditInfo(BaseModel):
    name: str
    description: str | None = None
    subscribers: int | None = None
    rationale: str | None = None


class DiscoverSubredditsRequest(BaseModel):
    brief_id: str


class DiscoverSubredditsResponse(BaseModel):
    subreddits: list[SubredditInfo]


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    knowledge_id: str
    messages: list[ChatMessage]


class ChatResponse(BaseModel):
    reply: str


class TTSRequest(BaseModel):
    text: str
    voice_id: str = "JBFqnCBsd6RMkjVDRZzb"  # ElevenLabs "George" voice


# --- Apollo / leads ---


class Lead(BaseModel):
    id: str | None = None
    first_name: str = ""
    last_name: str = ""
    title: str | None = None
    organization_name: str | None = None
    linkedin_url: str | None = None
    email: str | None = None


class LeadSearchRequest(BaseModel):
    title: str | None = None
    industry: str | None = None
    company_size: str | None = None
    page: int = 1
    per_page: int = 25


class LeadSearchResponse(BaseModel):
    leads: list[Lead]


class EngagementStat(BaseModel):
    label: str
    value: str
    delta: str


class EngagementAnalyticsRequest(BaseModel):
    """Payload of engagement stats and chart data for AI analysis."""

    stats: list[EngagementStat] = []
    reach_by_day: list[dict] = []  # [{ day, Reddit, Email, LinkedIn }, ...]
    channel_breakdown: list[dict] = []  # [{ channel, upvotes, comments, shares }, ...]
    post_performance: list[dict] = []  # [{ post, score, clicks }, ...]


class AnalyzeEngagementResponse(BaseModel):
    analysis: str


class ImproveDraftRequest(BaseModel):
    body: str
    channel: str = "reddit"
    instruction: str = ""


class ImproveDraftResponse(BaseModel):
    improved_body: str
    changes_summary: str
