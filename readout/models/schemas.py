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
