# Readout Backend-First Slice — Design

> **Date:** 2026-02-28
> **Scope:** Phase 1 backend — repo ingestion, codebase summarization, intelligent subreddit discovery, draft generation, and chat endpoint for future voice integration.

---

## Tech Stack

- **Backend:** Python + FastAPI
- **Frontend (later):** Next.js
- **Database:** Supabase (Postgres)
- **LLM — drafts & intelligence:** Claude API (Anthropic)
- **LLM — codebase summarization:** Google Gemini API
- **Reddit data:** PRAW (primary) + BeautifulSoup scraper (fallback via old.reddit.com)
- **Voice (Phase 2):** ElevenLabs TTS/STT

---

## Project Structure

```
Readout/
├── readout/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app entry
│   ├── config.py               # Settings via pydantic-settings (.env)
│   ├── ingestion/
│   │   ├── __init__.py
│   │   ├── github_client.py    # Fetch repo contents via GitHub REST API
│   │   ├── markdown_parser.py  # Parse markdown into structured chunks
│   │   └── summarizer.py       # Gemini API: README-first codebase summarization
│   ├── intelligence/
│   │   ├── __init__.py
│   │   ├── generator.py        # Claude API: brief + knowledge → drafts
│   │   └── templates.py        # Channel-specific prompt templates
│   ├── connectors/
│   │   ├── __init__.py
│   │   ├── reddit_client.py    # PRAW: subreddit search + metadata
│   │   ├── reddit_scraper.py   # BeautifulSoup fallback for old.reddit.com
│   │   └── supabase_client.py  # Supabase CRUD
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py          # Pydantic models
│   └── api/
│       ├── __init__.py
│       └── routes.py           # FastAPI route definitions
├── tests/
│   ├── test_github_client.py
│   ├── test_markdown_parser.py
│   ├── test_summarizer.py
│   ├── test_generator.py
│   ├── test_reddit_client.py
│   └── test_reddit_scraper.py
├── .env.example
├── requirements.txt
├── pyproject.toml
└── README.md
```

---

## Dependencies

```
fastapi
uvicorn[standard]
anthropic
google-generativeai
praw
supabase
pydantic-settings
python-dotenv
httpx
beautifulsoup4
pytest
pytest-asyncio
elevenlabs          # Phase 2 — voice chat
```

---

## Credentials Required

| Service | What to create | Key(s) |
|---------|---------------|--------|
| **GitHub** | Personal Access Token (fine-grained, `contents:read`) | `GITHUB_TOKEN` |
| **Reddit** | Script app at reddit.com/prefs/apps | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT` |
| **Supabase** | New project | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Anthropic** | API key from console.anthropic.com | `ANTHROPIC_API_KEY` |
| **Google AI** | API key from ai.google.dev | `GOOGLE_AI_API_KEY` |
| **ElevenLabs** | API key (Phase 2) | `ELEVENLABS_API_KEY` |

---

## Supabase Schema

```sql
create table if not exists product_knowledge (
  id uuid primary key default gen_random_uuid(),
  repo_owner text not null,
  repo_name text not null,
  chunks jsonb not null,        -- [{heading, content, level}]
  summary jsonb,                -- Gemini-generated structured summary
  last_synced_at timestamptz default now(),
  unique(repo_owner, repo_name)
);

create table if not exists briefs (
  id uuid primary key default gen_random_uuid(),
  knowledge_id uuid references product_knowledge(id),
  audience text not null,
  tone text not null,
  goals text,
  channels text[],              -- ['reddit', 'email', 'linkedin']
  constraints text,             -- "don't say" list
  created_at timestamptz default now()
);

create table if not exists drafts (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid references briefs(id),
  channel text not null,        -- 'reddit', 'email', 'linkedin'
  title text,
  body text not null,
  metadata jsonb,               -- subreddit name, subject line, etc.
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

---

## Pipeline: Data Flow

### 1. Ingest (`POST /ingest`)

Input: `{owner, repo, paths?, github_token?}`

1. **GitHub client** fetches file contents via REST API (README.md first, then docs/, then CHANGELOG)
2. **Markdown parser** splits each file into heading-based chunks: `{heading, content, level}`
3. **Gemini summarizer** generates a structured summary using a priority hierarchy:
   - README.md as primary source
   - docs/ folder for depth
   - CHANGELOG for momentum
   - File tree only if README/docs are thin
   - Output: `{product_description, features[], audience, differentiators[], tech_stack}`
4. Chunks + summary stored in Supabase `product_knowledge`

### 2. Brief (`POST /brief`)

Input: `{knowledge_id, audience, tone, goals, channels, constraints?}`

Stored in Supabase `briefs`. Returns brief_id.

### 3. Generate (`POST /generate`)

Input: `{brief_id, channel, count?}`

1. Load product_knowledge (chunks + Gemini summary) and brief
2. Select channel-specific prompt template
3. Call Claude API with: system prompt (channel rules) + user message (product context + brief)
4. Parse structured output (title, body, metadata)
5. Store in Supabase `drafts`, return drafts

### 4. Discover Subreddits (`POST /discover-subreddits`)

Input: `{brief_id}`

Intelligent multi-step search:
1. Claude extracts topics, audience segments, and use cases from product summary
2. Claude maps these to Reddit topic categories and generates targeted search queries
3. PRAW searches within relevant categories (fallback: scrape old.reddit.com)
4. For each result: fetch description, rules, engagement metrics
5. Claude ranks by: audience overlap, subreddit rules compatibility, engagement, culture fit
6. Returns ranked list with name, subscribers, description, and one-line rationale
7. Stored in Supabase `subreddits`

### 5. Chat (`POST /chat`) — Phase 2 voice-ready

Input: `{knowledge_id, messages: [{role, content}]}`

- Maintains conversational context
- Claude responds with strategy advice, draft refinements, plan adjustments
- Backend is text-in/text-out; frontend adds ElevenLabs voice I/O layer

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST /ingest` | Fetch repo → parse → summarize → store |
| `GET /knowledge/{repo_id}` | Return stored chunks + summary |
| `POST /brief` | Store audience/tone/goals brief |
| `POST /generate` | Generate channel-specific drafts |
| `POST /discover-subreddits` | Intelligent subreddit discovery |
| `GET /drafts/{brief_id}` | List drafts for a brief |
| `POST /chat` | Conversational endpoint (Phase 2 voice-ready) |

---

## Channel Prompt Templates

- **Reddit:** Helpful, non-promotional, subreddit-aware. Match community tone. Reference product naturally.
- **Email:** Subject < 50 chars. Body 2-3 sentences. One CTA. Personalization placeholders.
- **LinkedIn:** Hook first line. Professional but conversational. Proof/results. End with question or CTA.

---

## Reddit Data: PRAW + Scraper Fallback

- **Primary:** PRAW subreddit search (`reddit.subreddits.search()`)
- **Fallback:** When PRAW returns insufficient results, scrape `old.reddit.com/subreddits/search?q=...` with httpx + BeautifulSoup. Parse subreddit name, description, subscriber count from HTML.
- **Rate limiting:** 1s sleep between Reddit API calls; scraper uses respectful delays.

---

## Implementation Order

1. Config + scaffold (project setup, .env, Supabase tables)
2. GitHub client (fetch repo contents, decode base64)
3. Markdown parser (split into heading-based chunks)
4. Gemini summarizer (README-first codebase summary)
5. Supabase client (CRUD for all tables)
6. Claude generator (templates + API call → structured drafts)
7. Reddit discovery (PRAW + scraper + intelligent ranking)
8. FastAPI routes (wire everything, Swagger UI)
9. Chat endpoint (text-based, voice-ready)
10. Tests (unit tests for each module)
