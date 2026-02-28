# Readout Backend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Readout Python/FastAPI backend — repo ingestion, Gemini summarization, Claude draft generation, intelligent subreddit discovery, and a voice-ready chat endpoint.

**Architecture:** FastAPI app with modular packages: `ingestion/` (GitHub fetch, markdown parsing, Gemini summarization), `intelligence/` (Claude drafts, prompt templates), `connectors/` (Reddit PRAW + scraper, Supabase CRUD), wired together via `api/routes.py`. Supabase Postgres for persistence.

**Tech Stack:** Python 3.11+, FastAPI, Anthropic SDK, Google Generative AI SDK, PRAW, BeautifulSoup4, httpx, Supabase Python client, pydantic-settings, pytest.

**Design doc:** `docs/plans/2026-02-28-backend-first-slice-design.md`

---

## Prerequisites (manual, before starting)

Create these accounts and credentials, then fill `.env`:

1. **GitHub:** Go to github.com → Settings → Developer Settings → Personal Access Tokens → Fine-grained → Create with `Contents: Read` scope. Copy token.
2. **Reddit:** Go to reddit.com/prefs/apps → Create app → Type "script" → Note client_id (under app name) and client_secret. Set user_agent to `readout:1.0 (by u/YOUR_USERNAME)`.
3. **Supabase:** Go to supabase.com → New Project → Copy URL and service role key from Settings → API. Then run the schema SQL in SQL Editor (provided in Task 2).
4. **Anthropic:** Go to console.anthropic.com → API Keys → Create. Copy key.
5. **Google AI:** Go to ai.google.dev → Get API Key. Copy key.

---

## Task 1: Project Scaffold

**Files:**
- Create: `readout/__init__.py`
- Create: `readout/config.py`
- Create: `readout/main.py`
- Create: `requirements.txt`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `tests/__init__.py`

**Step 1: Create `.gitignore`**

```gitignore
__pycache__/
*.pyc
.env
.venv/
venv/
*.egg-info/
dist/
build/
.pytest_cache/
```

**Step 2: Create `requirements.txt`**

```
fastapi==0.115.*
uvicorn[standard]==0.34.*
anthropic==0.49.*
google-generativeai==0.8.*
praw==7.8.*
supabase==2.13.*
pydantic-settings==2.7.*
python-dotenv==1.0.*
httpx==0.28.*
beautifulsoup4==4.13.*
pytest==8.3.*
pytest-asyncio==0.25.*
```

**Step 3: Create `.env.example`**

```
GITHUB_TOKEN=ghp_...
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USER_AGENT=readout:1.0 (by u/your_username)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=
```

**Step 4: Create `readout/__init__.py`**

```python
```

(Empty file.)

**Step 5: Create `readout/config.py`**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    github_token: str = ""
    reddit_client_id: str = ""
    reddit_client_secret: str = ""
    reddit_user_agent: str = "readout:1.0"
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    anthropic_api_key: str = ""
    google_ai_api_key: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
```

**Step 6: Create `readout/main.py`**

```python
from fastapi import FastAPI

app = FastAPI(title="Readout", description="Unified outreach automation from repo")


@app.get("/health")
def health():
    return {"status": "ok"}
```

**Step 7: Create `tests/__init__.py`**

```python
```

(Empty file.)

**Step 8: Install dependencies and verify server starts**

Run:
```bash
cd /Users/james/Readout
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn readout.main:app --host 0.0.0.0 --port 8000 &
sleep 2 && curl http://localhost:8000/health
kill %1
```

Expected: `{"status":"ok"}`

**Step 9: Commit**

```bash
git add .gitignore requirements.txt .env.example readout/ tests/
git commit -m "chore: project scaffold with FastAPI, config, and dependencies"
```

---

## Task 2: Supabase Schema

**Files:**
- Create: `supabase/schema.sql`

**Step 1: Create the schema file**

```sql
-- Run this in Supabase SQL Editor

create table if not exists product_knowledge (
  id uuid primary key default gen_random_uuid(),
  repo_owner text not null,
  repo_name text not null,
  chunks jsonb not null default '[]'::jsonb,
  summary jsonb,
  last_synced_at timestamptz default now(),
  unique(repo_owner, repo_name)
);

create table if not exists briefs (
  id uuid primary key default gen_random_uuid(),
  knowledge_id uuid references product_knowledge(id) on delete cascade,
  audience text not null,
  tone text not null,
  goals text,
  channels text[] default '{}',
  constraints text,
  created_at timestamptz default now()
);

create table if not exists drafts (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid references briefs(id) on delete cascade,
  channel text not null,
  title text,
  body text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists subreddits (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  public_description text,
  subscribers int,
  over18 boolean default false,
  rules jsonb,
  topic text,
  engagement_avg_score numeric,
  engagement_posts_per_day numeric,
  last_synced_at timestamptz default now()
);
```

**Step 2: Commit**

```bash
git add supabase/
git commit -m "chore: add Supabase schema for product_knowledge, briefs, drafts, subreddits"
```

---

## Task 3: Pydantic Models

**Files:**
- Create: `readout/models/__init__.py`
- Create: `readout/models/schemas.py`

**Step 1: Create `readout/models/__init__.py`**

```python
```

**Step 2: Create `readout/models/schemas.py`**

```python
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
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    knowledge_id: str
    messages: list[ChatMessage]


class ChatResponse(BaseModel):
    reply: str
```

**Step 3: Commit**

```bash
git add readout/models/
git commit -m "feat: add Pydantic schemas for all API request/response models"
```

---

## Task 4: GitHub Client

**Files:**
- Create: `readout/ingestion/__init__.py`
- Create: `readout/ingestion/github_client.py`
- Create: `tests/test_github_client.py`

**Step 1: Write the failing test**

Create `tests/test_github_client.py`:

```python
import pytest
from readout.ingestion.github_client import fetch_repo_contents


def test_fetch_readme_from_public_repo():
    """Fetch README from a known public repo (no auth needed)."""
    files = fetch_repo_contents("octocat", "Hello-World")
    assert len(files) >= 1
    readme = next((f for f in files if f["path"].upper().startswith("README")), None)
    assert readme is not None
    assert len(readme["content"]) > 0


def test_fetch_with_specific_paths():
    """Fetch only specific paths."""
    files = fetch_repo_contents("octocat", "Hello-World", paths=["README"])
    assert len(files) >= 1


def test_fetch_nonexistent_repo():
    """Non-existent repo raises an error."""
    with pytest.raises(Exception):
        fetch_repo_contents("octocat", "this-repo-does-not-exist-xyz-123")
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/james/Readout && source .venv/bin/activate && pytest tests/test_github_client.py -v`

Expected: FAIL — `ModuleNotFoundError` or `ImportError`

**Step 3: Create `readout/ingestion/__init__.py`**

```python
```

**Step 4: Write the implementation**

Create `readout/ingestion/github_client.py`:

```python
import base64

import httpx

from readout.config import settings

GITHUB_API = "https://api.github.com"


def _headers(token: str | None = None) -> dict:
    t = token or settings.github_token
    h = {"Accept": "application/vnd.github.v3+json"}
    if t:
        h["Authorization"] = f"Bearer {t}"
    return h


def _get(url: str, token: str | None = None) -> dict | list:
    resp = httpx.get(url, headers=_headers(token), timeout=30)
    resp.raise_for_status()
    return resp.json()


def fetch_repo_contents(
    owner: str,
    repo: str,
    paths: list[str] | None = None,
    token: str | None = None,
) -> list[dict]:
    """Fetch file contents from a GitHub repo.

    Returns list of {path, content} dicts. Fetches README + docs/ by default.
    """
    if paths is None:
        paths = ["README.md", "README", "README.rst", "docs"]

    results: list[dict] = []

    for path in paths:
        url = f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}"
        try:
            data = _get(url, token)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                continue
            raise

        if isinstance(data, list):
            # Directory listing — fetch each file
            for item in data:
                if item.get("type") == "file" and item["name"].endswith(
                    (".md", ".txt", ".rst")
                ):
                    file_data = _get(item["url"], token)
                    content = base64.b64decode(file_data["content"]).decode("utf-8")
                    results.append({"path": item["path"], "content": content})
        elif isinstance(data, dict) and data.get("content"):
            content = base64.b64decode(data["content"]).decode("utf-8")
            results.append({"path": data["path"], "content": content})

    if not results:
        # Try fetching root to find any README
        root = _get(f"{GITHUB_API}/repos/{owner}/{repo}/contents/", token)
        for item in root:
            if item.get("type") == "file" and item["name"].upper().startswith("README"):
                file_data = _get(item["url"], token)
                content = base64.b64decode(file_data["content"]).decode("utf-8")
                results.append({"path": item["path"], "content": content})
                break

    if not results:
        raise ValueError(f"No readable files found in {owner}/{repo}")

    return results
```

**Step 5: Run tests to verify they pass**

Run: `pytest tests/test_github_client.py -v`

Expected: 3 PASSED

**Step 6: Commit**

```bash
git add readout/ingestion/ tests/test_github_client.py
git commit -m "feat: add GitHub client for fetching repo contents"
```

---

## Task 5: Markdown Parser

**Files:**
- Create: `readout/ingestion/markdown_parser.py`
- Create: `tests/test_markdown_parser.py`

**Step 1: Write the failing test**

Create `tests/test_markdown_parser.py`:

```python
from readout.ingestion.markdown_parser import parse_markdown


def test_parse_headings():
    md = """# Title

Some intro text.

## Features

- Feature A
- Feature B

## Installation

Run `pip install thing`.

### Sub-section

More detail.
"""
    chunks = parse_markdown(md)
    assert len(chunks) == 4
    assert chunks[0]["heading"] == "Title"
    assert chunks[0]["level"] == 1
    assert "intro text" in chunks[0]["content"]
    assert chunks[1]["heading"] == "Features"
    assert chunks[1]["level"] == 2
    assert "Feature A" in chunks[1]["content"]
    assert chunks[3]["heading"] == "Sub-section"
    assert chunks[3]["level"] == 3


def test_parse_no_headings():
    md = "Just plain text with no headings."
    chunks = parse_markdown(md)
    assert len(chunks) == 1
    assert chunks[0]["heading"] == ""
    assert chunks[0]["level"] == 0
    assert "plain text" in chunks[0]["content"]


def test_parse_empty():
    chunks = parse_markdown("")
    assert chunks == []
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_markdown_parser.py -v`

Expected: FAIL — `ImportError`

**Step 3: Write the implementation**

Create `readout/ingestion/markdown_parser.py`:

```python
import re


def parse_markdown(text: str) -> list[dict]:
    """Split markdown into heading-based chunks.

    Returns list of {heading, content, level}.
    """
    if not text.strip():
        return []

    lines = text.split("\n")
    chunks: list[dict] = []
    current_heading = ""
    current_level = 0
    current_lines: list[str] = []

    for line in lines:
        match = re.match(r"^(#{1,6})\s+(.+)$", line)
        if match:
            # Save previous chunk
            content = "\n".join(current_lines).strip()
            if content or current_heading:
                chunks.append(
                    {
                        "heading": current_heading,
                        "content": content,
                        "level": current_level,
                    }
                )
            current_heading = match.group(2).strip()
            current_level = len(match.group(1))
            current_lines = []
        else:
            current_lines.append(line)

    # Save last chunk
    content = "\n".join(current_lines).strip()
    if content or current_heading:
        chunks.append(
            {"heading": current_heading, "content": content, "level": current_level}
        )

    return chunks
```

**Step 4: Run tests to verify they pass**

Run: `pytest tests/test_markdown_parser.py -v`

Expected: 3 PASSED

**Step 5: Commit**

```bash
git add readout/ingestion/markdown_parser.py tests/test_markdown_parser.py
git commit -m "feat: add markdown parser for heading-based chunking"
```

---

## Task 6: Gemini Summarizer

**Files:**
- Create: `readout/ingestion/summarizer.py`
- Create: `tests/test_summarizer.py`

**Step 1: Write the failing test**

Create `tests/test_summarizer.py`:

```python
import os

import pytest

from readout.ingestion.summarizer import summarize_product


@pytest.fixture
def sample_chunks():
    return [
        {
            "heading": "MyTool",
            "content": "A CLI tool for automating deployments to AWS.",
            "level": 1,
        },
        {
            "heading": "Features",
            "content": "- Zero-downtime deploys\n- Rollback support\n- Multi-region",
            "level": 2,
        },
        {
            "heading": "Installation",
            "content": "pip install mytool",
            "level": 2,
        },
    ]


@pytest.mark.skipif(
    not os.environ.get("GOOGLE_AI_API_KEY"), reason="No Google AI API key"
)
def test_summarize_returns_structured_output(sample_chunks):
    summary = summarize_product(sample_chunks)
    assert "product_description" in summary
    assert isinstance(summary["features"], list)
    assert len(summary["features"]) > 0
    assert "audience" in summary
    assert isinstance(summary["differentiators"], list)
    assert isinstance(summary["tech_stack"], list)


def test_summarize_empty_chunks():
    with pytest.raises(ValueError):
        summarize_product([])
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_summarizer.py -v`

Expected: FAIL — `ImportError`

**Step 3: Write the implementation**

Create `readout/ingestion/summarizer.py`:

```python
import json

import google.generativeai as genai

from readout.config import settings

SUMMARIZE_PROMPT = """You are analyzing a software product's documentation to create a structured summary.

Given these documentation chunks from the product's repo (README first, then docs), produce a JSON object with:
- "product_description": 2-3 sentence description of what the product does
- "features": list of key features (strings)
- "audience": who this product is for (one sentence)
- "differentiators": what makes it unique vs alternatives (list of strings)
- "tech_stack": technologies/languages used (list of strings, inferred from docs)

Respond with ONLY valid JSON, no markdown fencing.

Documentation chunks:
{chunks_text}
"""


def summarize_product(chunks: list[dict]) -> dict:
    """Use Gemini to summarize product knowledge from parsed markdown chunks.

    Returns dict with: product_description, features, audience, differentiators, tech_stack.
    """
    if not chunks:
        raise ValueError("No chunks to summarize")

    genai.configure(api_key=settings.google_ai_api_key)
    model = genai.GenerativeModel("gemini-2.0-flash")

    chunks_text = "\n\n".join(
        f"### {c['heading']} (level {c['level']})\n{c['content']}" for c in chunks
    )

    response = model.generate_content(SUMMARIZE_PROMPT.format(chunks_text=chunks_text))
    text = response.text.strip()

    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    text = text.strip()

    return json.loads(text)
```

**Step 4: Run tests to verify they pass**

Run: `pytest tests/test_summarizer.py -v`

Expected: 1 PASSED (summarize test), 1 SKIPPED (if no API key) or 2 PASSED (if API key set). `test_summarize_empty_chunks` always passes.

**Step 5: Commit**

```bash
git add readout/ingestion/summarizer.py tests/test_summarizer.py
git commit -m "feat: add Gemini-powered product summarizer (README-first)"
```

---

## Task 7: Supabase Client

**Files:**
- Create: `readout/connectors/__init__.py`
- Create: `readout/connectors/supabase_client.py`
- Create: `tests/test_supabase_client.py`

**Step 1: Write the failing test**

Create `tests/test_supabase_client.py`:

```python
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
    # Requires a knowledge_id — create one first
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
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_supabase_client.py -v`

Expected: FAIL — `ImportError`

**Step 3: Create `readout/connectors/__init__.py`**

```python
```

**Step 4: Write the implementation**

Create `readout/connectors/supabase_client.py`:

```python
from datetime import datetime, timezone

from supabase import create_client

from readout.config import settings


def _client():
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def upsert_product_knowledge(
    owner: str,
    repo: str,
    chunks: list[dict],
    summary: dict | None = None,
) -> str:
    """Upsert product knowledge. Returns the row id."""
    row = {
        "repo_owner": owner,
        "repo_name": repo,
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
    audience: str,
    tone: str,
    goals: str | None = None,
    channels: list[str] | None = None,
    constraints: str | None = None,
) -> str:
    """Create a brief. Returns the brief id."""
    row = {
        "knowledge_id": knowledge_id,
        "audience": audience,
        "tone": tone,
        "goals": goals,
        "channels": channels or ["reddit"],
        "constraints": constraints,
    }
    result = _client().table("briefs").insert(row).execute()
    return result.data[0]["id"]


def get_brief(brief_id: str) -> dict:
    result = (
        _client()
        .table("briefs")
        .select("*")
        .eq("id", brief_id)
        .single()
        .execute()
    )
    return result.data


def save_drafts(brief_id: str, drafts: list[dict]) -> None:
    """Save generated drafts."""
    rows = [
        {
            "brief_id": brief_id,
            "channel": d["channel"],
            "title": d.get("title"),
            "body": d["body"],
            "metadata": d.get("metadata", {}),
        }
        for d in drafts
    ]
    _client().table("drafts").insert(rows).execute()


def get_drafts(brief_id: str) -> list[dict]:
    result = (
        _client()
        .table("drafts")
        .select("*")
        .eq("brief_id", brief_id)
        .execute()
    )
    return result.data


def upsert_subreddits(rows: list[dict]) -> None:
    """Upsert subreddit metadata."""
    for row in rows:
        row.setdefault("last_synced_at", datetime.now(timezone.utc).isoformat())
    _client().table("subreddits").upsert(rows, on_conflict="name").execute()
```

**Step 5: Run tests to verify they pass**

Run: `pytest tests/test_supabase_client.py -v`

Expected: All PASSED (if Supabase credentials set) or all SKIPPED.

**Step 6: Commit**

```bash
git add readout/connectors/ tests/test_supabase_client.py
git commit -m "feat: add Supabase client for product_knowledge, briefs, drafts, subreddits"
```

---

## Task 8: Channel Prompt Templates

**Files:**
- Create: `readout/intelligence/__init__.py`
- Create: `readout/intelligence/templates.py`
- Create: `tests/test_templates.py`

**Step 1: Write the failing test**

Create `tests/test_templates.py`:

```python
from readout.intelligence.templates import get_system_prompt, CHANNELS


def test_all_channels_have_templates():
    for channel in CHANNELS:
        prompt = get_system_prompt(channel)
        assert isinstance(prompt, str)
        assert len(prompt) > 50


def test_unknown_channel_raises():
    import pytest
    with pytest.raises(ValueError):
        get_system_prompt("tiktok")


def test_reddit_prompt_mentions_subreddit():
    prompt = get_system_prompt("reddit")
    assert "subreddit" in prompt.lower()


def test_email_prompt_mentions_subject():
    prompt = get_system_prompt("email")
    assert "subject" in prompt.lower()
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_templates.py -v`

Expected: FAIL — `ImportError`

**Step 3: Create `readout/intelligence/__init__.py`**

```python
```

**Step 4: Write the implementation**

Create `readout/intelligence/templates.py`:

```python
CHANNELS = ["reddit", "email", "linkedin"]

_TEMPLATES = {
    "reddit": """You are a copywriter specializing in Reddit posts. Your job is to create posts that feel authentic to the subreddit community.

Rules:
- Write in a helpful, non-promotional tone. Sound like a community member sharing something useful, not a marketer.
- Be specific and technical where appropriate. Redditors respect depth.
- If a subreddit name is provided, tailor the tone and content to that community.
- Never use marketing buzzwords ("revolutionary", "game-changing", "disrupting").
- Reference the product naturally — as something you built/found/use, not something you're selling.
- Include a clear reason WHY the reader should care (solves X problem, saves Y time).

Output format — return valid JSON:
{
  "title": "Post title (engaging but not clickbait)",
  "body": "Post body (markdown ok, 100-300 words)"
}""",
    "email": """You are a copywriter specializing in cold outreach emails. Your job is to write concise, compelling emails that get responses.

Rules:
- Subject line: under 50 characters, curiosity-driven or benefit-driven. No ALL CAPS or spam triggers.
- Body: 2-4 sentences maximum. Every sentence must earn its place.
- One clear CTA (call to action) — a question or low-commitment ask.
- Use personalization placeholders: {first_name}, {company} where appropriate.
- Tone: direct, respectful, peer-to-peer. Not salesy.
- No attachments, no "I hope this email finds you well."

Output format — return valid JSON:
{
  "title": "Email subject line",
  "body": "Email body (plain text, 2-4 sentences with CTA)"
}""",
    "linkedin": """You are a copywriter specializing in LinkedIn posts. Your job is to write posts that get engagement (likes, comments, reposts).

Rules:
- Hook in the first line — something surprising, contrarian, or curiosity-inducing. This is what people see before "see more."
- Professional but conversational. Not corporate-speak.
- Include proof, results, or a specific story. Abstract claims get ignored.
- End with a question or CTA that invites comments.
- Use line breaks for readability. Short paragraphs (1-2 sentences each).
- No hashtag spam. 0-3 relevant hashtags at the end, max.

Output format — return valid JSON:
{
  "title": null,
  "body": "Full LinkedIn post text (150-300 words)"
}""",
}


def get_system_prompt(channel: str) -> str:
    """Return the system prompt for a given channel."""
    if channel not in _TEMPLATES:
        raise ValueError(f"Unknown channel: {channel}. Must be one of {CHANNELS}")
    return _TEMPLATES[channel]
```

**Step 5: Run tests to verify they pass**

Run: `pytest tests/test_templates.py -v`

Expected: 4 PASSED

**Step 6: Commit**

```bash
git add readout/intelligence/ tests/test_templates.py
git commit -m "feat: add channel-specific prompt templates for Reddit, email, LinkedIn"
```

---

## Task 9: Claude Draft Generator

**Files:**
- Create: `readout/intelligence/generator.py`
- Create: `tests/test_generator.py`

**Step 1: Write the failing test**

Create `tests/test_generator.py`:

```python
import json
import os

import pytest

from readout.intelligence.generator import generate_drafts


@pytest.fixture
def product_context():
    return {
        "summary": {
            "product_description": "A CLI tool for zero-downtime deployments to AWS.",
            "features": ["Zero-downtime deploys", "Rollback support", "Multi-region"],
            "audience": "DevOps engineers and backend developers",
            "differentiators": ["Single binary", "No YAML config needed"],
            "tech_stack": ["Go", "AWS SDK"],
        },
        "chunks": [
            {"heading": "DeployFast", "content": "Deploy to AWS in one command.", "level": 1},
            {"heading": "Features", "content": "- Zero-downtime\n- Rollback\n- Multi-region", "level": 2},
        ],
    }


@pytest.fixture
def brief():
    return {
        "audience": "DevOps engineers at startups",
        "tone": "casual and technical",
        "goals": "awareness and signups",
        "constraints": "Don't mention competitors by name",
    }


@pytest.mark.skipif(not os.environ.get("ANTHROPIC_API_KEY"), reason="No Anthropic key")
def test_generate_reddit_drafts(product_context, brief):
    drafts = generate_drafts(product_context, brief, channel="reddit", count=1)
    assert len(drafts) == 1
    assert "body" in drafts[0]
    assert len(drafts[0]["body"]) > 20


@pytest.mark.skipif(not os.environ.get("ANTHROPIC_API_KEY"), reason="No Anthropic key")
def test_generate_email_drafts(product_context, brief):
    drafts = generate_drafts(product_context, brief, channel="email", count=1)
    assert len(drafts) == 1
    assert "title" in drafts[0]  # subject line
    assert "body" in drafts[0]
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_generator.py -v`

Expected: FAIL — `ImportError`

**Step 3: Write the implementation**

Create `readout/intelligence/generator.py`:

```python
import json

import anthropic

from readout.config import settings
from readout.intelligence.templates import get_system_prompt


def generate_drafts(
    product_context: dict,
    brief: dict,
    channel: str,
    count: int = 3,
) -> list[dict]:
    """Generate channel-specific drafts using Claude.

    Args:
        product_context: dict with 'summary' and 'chunks' keys
        brief: dict with 'audience', 'tone', 'goals', 'constraints' keys
        channel: one of 'reddit', 'email', 'linkedin'
        count: number of drafts to generate

    Returns:
        List of dicts with 'title' and 'body' keys.
    """
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    system_prompt = get_system_prompt(channel)

    summary = product_context.get("summary", {})
    chunks_text = "\n".join(
        f"## {c['heading']}\n{c['content']}" for c in product_context.get("chunks", [])
    )

    user_message = f"""Product summary:
{json.dumps(summary, indent=2)}

Product documentation:
{chunks_text}

Outreach brief:
- Audience: {brief.get('audience', 'general')}
- Tone: {brief.get('tone', 'professional')}
- Goals: {brief.get('goals', 'awareness')}
- Constraints: {brief.get('constraints', 'none')}

Generate {count} distinct draft(s). Return a JSON array of objects, each with "title" and "body" keys. Return ONLY the JSON array, no other text."""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )

    text = response.content[0].text.strip()

    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    text = text.strip()

    drafts = json.loads(text)
    if isinstance(drafts, dict):
        drafts = [drafts]

    return [{"title": d.get("title"), "body": d["body"], "channel": channel} for d in drafts]
```

**Step 4: Run tests to verify they pass**

Run: `pytest tests/test_generator.py -v`

Expected: 2 PASSED (if Anthropic key set) or 2 SKIPPED.

**Step 5: Commit**

```bash
git add readout/intelligence/generator.py tests/test_generator.py
git commit -m "feat: add Claude-powered draft generator with channel templates"
```

---

## Task 10: Reddit Client (PRAW)

**Files:**
- Create: `readout/connectors/reddit_client.py`
- Create: `tests/test_reddit_client.py`

**Step 1: Write the failing test**

Create `tests/test_reddit_client.py`:

```python
import os

import pytest

from readout.connectors.reddit_client import search_subreddits, fetch_subreddit_metadata

SKIP = not os.environ.get("REDDIT_CLIENT_ID")


@pytest.mark.skipif(SKIP, reason="No Reddit credentials")
def test_search_subreddits():
    results = search_subreddits("python programming", limit=5)
    assert len(results) >= 1
    assert "name" in results[0]
    assert "subscribers" in results[0]


@pytest.mark.skipif(SKIP, reason="No Reddit credentials")
def test_fetch_subreddit_metadata():
    meta = fetch_subreddit_metadata("python")
    assert meta["name"] == "Python"  # display_name is capitalized
    assert meta["subscribers"] > 0
    assert "rules" in meta
    assert isinstance(meta["rules"], list)
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_reddit_client.py -v`

Expected: FAIL — `ImportError`

**Step 3: Write the implementation**

Create `readout/connectors/reddit_client.py`:

```python
import time

import praw

from readout.config import settings


def _reddit():
    return praw.Reddit(
        client_id=settings.reddit_client_id,
        client_secret=settings.reddit_client_secret,
        user_agent=settings.reddit_user_agent,
    )


def search_subreddits(query: str, limit: int = 20) -> list[dict]:
    """Search Reddit for subreddits matching a query.

    Returns list of {name, public_description, subscribers, over18}.
    """
    reddit = _reddit()
    results = []
    for sub in reddit.subreddits.search(query, limit=limit):
        results.append(
            {
                "name": sub.display_name,
                "public_description": sub.public_description,
                "subscribers": sub.subscribers,
                "over18": sub.over18,
            }
        )
    return results


def fetch_subreddit_metadata(subreddit_name: str) -> dict:
    """Fetch detailed metadata for a single subreddit.

    Returns dict with name, description, public_description, rules,
    subscribers, over18, engagement_avg_score.
    """
    reddit = _reddit()
    sub = reddit.subreddit(subreddit_name)

    # Fetch rules
    rules = []
    for rule in sub.rules:
        rules.append({"short_name": rule.short_name, "description": rule.description})

    # Fetch engagement: average score of top 25 posts this week
    scores = []
    for post in sub.top(time_filter="week", limit=25):
        scores.append(post.score)

    engagement_avg = sum(scores) / len(scores) if scores else None

    time.sleep(1)  # Rate limiting

    return {
        "name": sub.display_name,
        "description": sub.description,
        "public_description": sub.public_description,
        "subscribers": sub.subscribers,
        "over18": sub.over18,
        "rules": rules,
        "engagement_avg_score": engagement_avg,
    }
```

**Step 4: Run tests to verify they pass**

Run: `pytest tests/test_reddit_client.py -v`

Expected: 2 PASSED (if Reddit credentials set) or 2 SKIPPED.

**Step 5: Commit**

```bash
git add readout/connectors/reddit_client.py tests/test_reddit_client.py
git commit -m "feat: add Reddit client with PRAW for subreddit search and metadata"
```

---

## Task 11: Reddit Scraper (BeautifulSoup Fallback)

**Files:**
- Create: `readout/connectors/reddit_scraper.py`
- Create: `tests/test_reddit_scraper.py`

**Step 1: Write the failing test**

Create `tests/test_reddit_scraper.py`:

```python
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
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_reddit_scraper.py -v`

Expected: FAIL — `ImportError`

**Step 3: Write the implementation**

Create `readout/connectors/reddit_scraper.py`:

```python
import time

import httpx
from bs4 import BeautifulSoup


def scrape_subreddit_search(query: str, limit: int = 20) -> list[dict]:
    """Fallback: scrape old.reddit.com for subreddit search results.

    Returns list of {name, description, subscribers}.
    """
    if not query.strip():
        return []

    url = "https://old.reddit.com/subreddits/search"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) readout-scraper/1.0"
    }

    try:
        resp = httpx.get(
            url, params={"q": query}, headers=headers, timeout=15, follow_redirects=True
        )
        resp.raise_for_status()
    except httpx.HTTPError:
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    results = []

    for entry in soup.select(".search-result-subreddit"):
        name_el = entry.select_one(".search-title a")
        desc_el = entry.select_one(".search-result-body")
        subs_el = entry.select_one(".search-subscribers .number")

        if not name_el:
            continue

        name = name_el.text.strip().replace("/r/", "").replace("r/", "")
        description = desc_el.text.strip() if desc_el else ""
        subscribers = None
        if subs_el:
            try:
                subscribers = int(subs_el.text.strip().replace(",", ""))
            except ValueError:
                pass

        results.append(
            {"name": name, "description": description, "subscribers": subscribers}
        )

        if len(results) >= limit:
            break

    time.sleep(2)  # Respectful delay
    return results
```

**Step 4: Run tests to verify they pass**

Run: `pytest tests/test_reddit_scraper.py -v`

Expected: 2 PASSED

**Step 5: Commit**

```bash
git add readout/connectors/reddit_scraper.py tests/test_reddit_scraper.py
git commit -m "feat: add Reddit scraper fallback via old.reddit.com"
```

---

## Task 12: Intelligent Subreddit Discovery

**Files:**
- Create: `readout/intelligence/discovery.py`
- Create: `tests/test_discovery.py`

**Step 1: Write the failing test**

Create `tests/test_discovery.py`:

```python
import os

import pytest

from readout.intelligence.discovery import discover_subreddits


@pytest.fixture
def product_summary():
    return {
        "product_description": "A CLI tool for zero-downtime deployments to AWS.",
        "features": ["Zero-downtime deploys", "Rollback support"],
        "audience": "DevOps engineers",
        "differentiators": ["Single binary", "No YAML"],
        "tech_stack": ["Go", "AWS SDK"],
    }


@pytest.fixture
def brief():
    return {
        "audience": "DevOps engineers at startups",
        "tone": "casual",
        "goals": "awareness",
    }


SKIP = not (
    os.environ.get("ANTHROPIC_API_KEY") and os.environ.get("REDDIT_CLIENT_ID")
)


@pytest.mark.skipif(SKIP, reason="No Anthropic or Reddit credentials")
def test_discover_subreddits(product_summary, brief):
    results = discover_subreddits(product_summary, brief, max_results=5)
    assert isinstance(results, list)
    assert len(results) >= 1
    assert "name" in results[0]
    assert "rationale" in results[0]
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_discovery.py -v`

Expected: FAIL — `ImportError`

**Step 3: Write the implementation**

Create `readout/intelligence/discovery.py`:

```python
import json

import anthropic

from readout.config import settings
from readout.connectors.reddit_client import search_subreddits
from readout.connectors.reddit_scraper import scrape_subreddit_search


def _generate_search_queries(summary: dict, brief: dict) -> list[str]:
    """Use Claude to generate targeted Reddit search queries from product context."""
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=500,
        messages=[
            {
                "role": "user",
                "content": f"""Given this product and audience, generate 3-5 Reddit subreddit search queries that would find communities where this product's audience hangs out.

Product: {summary.get('product_description', '')}
Features: {', '.join(summary.get('features', []))}
Audience: {brief.get('audience', summary.get('audience', ''))}
Tech stack: {', '.join(summary.get('tech_stack', []))}

Return ONLY a JSON array of search query strings. No other text.
Example: ["devops tools", "aws deployment", "golang cli"]""",
            }
        ],
    )

    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    return json.loads(text.strip())


def _rank_subreddits(
    candidates: list[dict], summary: dict, brief: dict
) -> list[dict]:
    """Use Claude to rank and filter subreddit candidates."""
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    candidates_text = json.dumps(candidates[:30], indent=2)

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        messages=[
            {
                "role": "user",
                "content": f"""Rank these subreddits by relevance for promoting this product. Consider: audience overlap, subreddit rules compatibility, engagement level, and community culture fit.

Product: {summary.get('product_description', '')}
Audience: {brief.get('audience', summary.get('audience', ''))}

Subreddit candidates:
{candidates_text}

Return a JSON array of the top results, ordered best to worst. Each object must have:
- "name": subreddit name
- "subscribers": subscriber count (from input)
- "rationale": one sentence why this subreddit is a good fit
- "description": short description (from input)

Return ONLY the JSON array.""",
            }
        ],
    )

    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    return json.loads(text.strip())


def discover_subreddits(
    summary: dict, brief: dict, max_results: int = 10
) -> list[dict]:
    """Intelligent subreddit discovery: generate queries → search → rank.

    Returns ranked list of {name, subscribers, description, rationale}.
    """
    # Step 1: Generate search queries from product context
    queries = _generate_search_queries(summary, brief)

    # Step 2: Search Reddit for each query, merge and dedupe
    seen = set()
    candidates = []
    for query in queries:
        # Try PRAW first
        results = search_subreddits(query, limit=15)
        # Fallback to scraper if PRAW returns few results
        if len(results) < 3:
            results.extend(scrape_subreddit_search(query, limit=10))

        for r in results:
            name = r["name"].lower()
            if name not in seen and not r.get("over18", False):
                seen.add(name)
                candidates.append(r)

    if not candidates:
        return []

    # Step 3: Claude ranks by relevance
    ranked = _rank_subreddits(candidates, summary, brief)
    return ranked[:max_results]
```

**Step 4: Run tests to verify they pass**

Run: `pytest tests/test_discovery.py -v`

Expected: 1 PASSED (if credentials set) or 1 SKIPPED.

**Step 5: Commit**

```bash
git add readout/intelligence/discovery.py tests/test_discovery.py
git commit -m "feat: add intelligent subreddit discovery with Claude-guided search and ranking"
```

---

## Task 13: FastAPI Routes

**Files:**
- Create: `readout/api/__init__.py`
- Create: `readout/api/routes.py`
- Modify: `readout/main.py`

**Step 1: Create `readout/api/__init__.py`**

```python
```

**Step 2: Write `readout/api/routes.py`**

```python
from fastapi import APIRouter, HTTPException

from readout.connectors.supabase_client import (
    upsert_product_knowledge,
    get_product_knowledge,
    create_brief,
    get_brief,
    save_drafts,
    get_drafts,
    upsert_subreddits,
)
from readout.ingestion.github_client import fetch_repo_contents
from readout.ingestion.markdown_parser import parse_markdown
from readout.ingestion.summarizer import summarize_product
from readout.intelligence.generator import generate_drafts
from readout.intelligence.discovery import discover_subreddits
from readout.models.schemas import (
    IngestRequest,
    IngestResponse,
    BriefRequest,
    BriefResponse,
    GenerateRequest,
    GenerateResponse,
    DiscoverSubredditsRequest,
    DiscoverSubredditsResponse,
    ChatRequest,
    ChatResponse,
)

import anthropic
import json
from readout.config import settings

router = APIRouter()


@router.post("/ingest", response_model=IngestResponse)
def ingest(req: IngestRequest):
    """Fetch repo contents, parse markdown, summarize with Gemini, store."""
    try:
        files = fetch_repo_contents(
            req.owner, req.repo, paths=req.paths, token=req.github_token
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch repo: {e}")

    # Parse all files into chunks
    all_chunks = []
    for f in files:
        chunks = parse_markdown(f["content"])
        for chunk in chunks:
            chunk["source_file"] = f["path"]
        all_chunks.extend(chunks)

    # Summarize with Gemini
    summary = None
    try:
        summary = summarize_product(all_chunks)
    except Exception:
        pass  # Summarization is optional

    knowledge_id = upsert_product_knowledge(
        req.owner, req.repo, all_chunks, summary
    )

    return IngestResponse(
        knowledge_id=knowledge_id,
        chunks_count=len(all_chunks),
        summary=summary,
    )


@router.get("/knowledge/{knowledge_id}")
def get_knowledge(knowledge_id: str):
    """Return stored product knowledge."""
    try:
        return get_product_knowledge(knowledge_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Knowledge not found")


@router.post("/brief", response_model=BriefResponse)
def create_brief_endpoint(req: BriefRequest):
    """Store a brief."""
    brief_id = create_brief(
        req.knowledge_id,
        audience=req.audience,
        tone=req.tone,
        goals=req.goals,
        channels=req.channels,
        constraints=req.constraints,
    )
    return BriefResponse(brief_id=brief_id)


@router.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest):
    """Generate channel-specific drafts."""
    brief = get_brief(req.brief_id)
    knowledge = get_product_knowledge(brief["knowledge_id"])

    product_context = {
        "summary": knowledge.get("summary", {}),
        "chunks": knowledge.get("chunks", []),
    }

    drafts = generate_drafts(product_context, brief, req.channel, req.count)
    save_drafts(req.brief_id, drafts)

    return GenerateResponse(drafts=drafts)


@router.post("/discover-subreddits", response_model=DiscoverSubredditsResponse)
def discover(req: DiscoverSubredditsRequest):
    """Discover relevant subreddits."""
    brief = get_brief(req.brief_id)
    knowledge = get_product_knowledge(brief["knowledge_id"])
    summary = knowledge.get("summary", {})

    results = discover_subreddits(summary, brief)

    # Store in Supabase
    rows = [
        {"name": r["name"], "description": r.get("description"), "subscribers": r.get("subscribers")}
        for r in results
    ]
    if rows:
        upsert_subreddits(rows)

    return DiscoverSubredditsResponse(subreddits=results)


@router.get("/drafts/{brief_id}")
def list_drafts(brief_id: str):
    """List drafts for a brief."""
    return get_drafts(brief_id)


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    """Conversational endpoint — voice-ready for Phase 2."""
    knowledge = get_product_knowledge(req.knowledge_id)
    summary = knowledge.get("summary", {})
    chunks_text = "\n".join(
        f"## {c['heading']}\n{c['content']}" for c in knowledge.get("chunks", [])
    )

    system = f"""You are Readout, an outreach strategy assistant. You understand this product deeply and help the user plan their outreach.

Product summary:
{json.dumps(summary, indent=2)}

Product docs:
{chunks_text}

Help the user refine their outreach plan: suggest channels, personas, messaging angles, subreddits, email strategies. Be specific and actionable."""

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        system=system,
        messages=messages,
    )

    return ChatResponse(reply=response.content[0].text)
```

**Step 3: Update `readout/main.py` to include the router**

Replace the contents of `readout/main.py` with:

```python
from fastapi import FastAPI

from readout.api.routes import router

app = FastAPI(title="Readout", description="Unified outreach automation from repo")

app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

**Step 4: Verify the server starts and docs load**

Run:
```bash
cd /Users/james/Readout && source .venv/bin/activate
uvicorn readout.main:app --host 0.0.0.0 --port 8000 &
sleep 2 && curl http://localhost:8000/health
curl -s http://localhost:8000/openapi.json | python -m json.tool | head -20
kill %1
```

Expected: Health returns `{"status":"ok"}`, OpenAPI JSON shows all endpoints.

**Step 5: Commit**

```bash
git add readout/api/ readout/main.py
git commit -m "feat: add FastAPI routes for ingest, brief, generate, discover, chat"
```

---

## Task 14: Integration Smoke Test

**Files:**
- Create: `tests/test_integration.py`

**Step 1: Write the integration test**

Create `tests/test_integration.py`:

```python
"""Integration test: ingest a real repo → create brief → generate drafts.

Requires all credentials in .env.
"""
import os

import pytest
from fastapi.testclient import TestClient

from readout.main import app

SKIP = not all(
    os.environ.get(k)
    for k in ["GITHUB_TOKEN", "SUPABASE_URL", "ANTHROPIC_API_KEY", "GOOGLE_AI_API_KEY"]
)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.mark.skipif(SKIP, reason="Missing credentials for integration test")
def test_full_pipeline(client):
    # 1. Ingest a known public repo
    resp = client.post("/ingest", json={"owner": "octocat", "repo": "Hello-World"})
    assert resp.status_code == 200
    data = resp.json()
    knowledge_id = data["knowledge_id"]
    assert data["chunks_count"] >= 1

    # 2. Create a brief
    resp = client.post(
        "/brief",
        json={
            "knowledge_id": knowledge_id,
            "audience": "developers",
            "tone": "casual",
            "goals": "awareness",
            "channels": ["reddit"],
        },
    )
    assert resp.status_code == 200
    brief_id = resp.json()["brief_id"]

    # 3. Generate a Reddit draft
    resp = client.post(
        "/generate",
        json={"brief_id": brief_id, "channel": "reddit", "count": 1},
    )
    assert resp.status_code == 200
    drafts = resp.json()["drafts"]
    assert len(drafts) == 1
    assert len(drafts[0]["body"]) > 10

    # 4. List drafts
    resp = client.get(f"/drafts/{brief_id}")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1

    # 5. Chat
    resp = client.post(
        "/chat",
        json={
            "knowledge_id": knowledge_id,
            "messages": [{"role": "user", "content": "What channels should I focus on?"}],
        },
    )
    assert resp.status_code == 200
    assert len(resp.json()["reply"]) > 10
```

**Step 2: Run the integration test**

Run: `pytest tests/test_integration.py -v`

Expected: 1 PASSED (if all credentials set) or 1 SKIPPED.

**Step 3: Commit**

```bash
git add tests/test_integration.py
git commit -m "test: add integration smoke test for full pipeline"
```

---

## Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Project scaffold | None |
| 2 | Supabase schema | None |
| 3 | Pydantic models | Task 1 |
| 4 | GitHub client | Task 1 |
| 5 | Markdown parser | Task 1 |
| 6 | Gemini summarizer | Task 5 |
| 7 | Supabase client | Tasks 2, 3 |
| 8 | Channel templates | Task 1 |
| 9 | Claude generator | Tasks 8, 3 |
| 10 | Reddit client (PRAW) | Task 1 |
| 11 | Reddit scraper | Task 1 |
| 12 | Subreddit discovery | Tasks 9, 10, 11 |
| 13 | FastAPI routes | Tasks 4-12 |
| 14 | Integration test | Task 13 |

**Parallelizable groups:**
- Tasks 3, 4, 5, 8, 10, 11 can all run in parallel (no cross-dependencies)
- Tasks 6, 7, 9 can run in parallel after their deps complete
- Task 12 after 9, 10, 11
- Tasks 13, 14 are sequential at the end
