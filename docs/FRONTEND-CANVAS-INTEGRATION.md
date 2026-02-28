# Frontend-Canvas + Readout Integration

This document is the implementation plan for wiring the **frontend-canvas** UI (Vite + React + shadcn) to the **Readout** FastAPI backend: API client, shared onboarding state, and replacing mock data with real API calls.

---

## Current state

- **Readout** (`readout/`): FastAPI on port 8000. Routes: ingest, brief, generate, get drafts, discover-subreddits, chat. CORS `allow_origins=["*"]` in `readout/main.py`. Request/response shapes in `readout/models/schemas.py`.
- **frontend-canvas** (`frontend-canvas/`): Vite + React 18 + TypeScript, shadcn/ui (Radix), Tailwind, React Query, React Router, react-hook-form, zod. Dev server **port 8080** (`frontend-canvas/vite.config.ts`). No API client or shared state for `knowledge_id` / `brief_id` yet; all pages use mock data.

### Page → API mapping (verified)

| Page              | Route                 | Current behavior                                                      | Backend to use                                                                          |
| ----------------- | --------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Onboard           | `/onboard`            | Repo search (mock list) + URL, include checkboxes → navigate to brief | `POST /ingest` → store `knowledge_id`, repo label                                       |
| OnboardBrief      | `/onboard/brief`      | Audience, tone, goal, avoid, channels → navigate to processing        | `POST /brief` with `knowledge_id` → store `brief_id`                                    |
| OnboardProcessing | `/onboard/processing` | Fake steps then → dashboard                                           | Use `brief_id`: call discover-subreddits, then `POST /generate` (reddit), then navigate  |
| Dashboard         | `/dashboard`          | Mock drafts + channel counts                                          | `GET /briefs/{brief_id}/drafts`; Re-sync = re-ingest; Regenerate = `POST /generate`     |
| RedditDiscover    | `/reddit/discover`    | Mock subreddit list                                                   | `POST /discover-subreddits`; “Generate drafts” = `POST /generate` then navigate         |
| EmailCampaign     | `/email`              | Mock email subject/body                                              | `GET /briefs/{brief_id}/drafts` (channel=email) or `POST /generate` (email)           |

Ingest paths: backend `readout/ingestion/github_client.py` accepts optional `paths`; default `["README.md", "README", "README.rst", "docs"]`. Frontend “includes” (readme, docs, changelog) map to e.g. `["README.md", "docs", "CHANGELOG.md"]` when building the request.

---

## 1. API client and env

**1.1 Env**

- In `frontend-canvas/`: add `.env.example` with `VITE_READOUT_API_URL=http://localhost:8000`. Use `import.meta.env.VITE_READOUT_API_URL` in code, fallback to `http://localhost:8000` if unset.

**1.2 API client**

- New file: `frontend-canvas/src/lib/readoutApi.ts`.
- Base URL: `const base = import.meta.env.VITE_READOUT_API_URL ?? "http://localhost:8000"`.
- Typed functions (match `readout/models/schemas.py`):
  - `ingest({ owner, repo, paths?, github_token? })` → `{ knowledge_id, chunks_count, summary }`
  - `createBrief({ knowledge_id, audience, tone, goals?, channels, constraints? })` → `{ brief_id }`
  - `generate({ brief_id, channel, count? })` → `{ drafts }`
  - `getDrafts(brief_id)` → `{ drafts }`
  - `discoverSubreddits({ brief_id })` → `{ subreddits }`
  - `chat({ knowledge_id, messages })` → `{ reply }`
- Use `fetch`; on non-2xx throw an Error with message from response body or status text so UI can show errors.

---

## 2. Shared onboarding state

**2.1 Context**

- New file: `frontend-canvas/src/context/ReadoutContext.tsx` (or under `src/lib/`).
- State: `knowledge_id: string | null`, `brief_id: string | null`, `repoLabel: string | null` (e.g. `"owner/repo"` for display).
- Setters: `setKnowledgeId`, `setBriefId`, `setRepoLabel`.
- Optional: persist to `sessionStorage` on set so refresh keeps flow (key e.g. `readout_onboard`).

**2.2 Provide in App**

- In `frontend-canvas/src/App.tsx`: wrap `<BrowserRouter>` (or the whole tree) with `ReadoutProvider` so Onboard, OnboardBrief, OnboardProcessing, Dashboard, RedditDiscover, and EmailCampaign can read/write these ids and repo label.

---

## 3. Wire each page

**3.1 Onboard** (`frontend-canvas/src/pages/Onboard.tsx`)

- Parse owner/repo: from `repoUrl` (e.g. `https://github.com/owner/repo` or `owner/repo`) or from `selectedRepo` (e.g. `"james/readout"` → `owner="james"`, `repo="readout"`).
- Build `paths`: if `includes.readme` add `"README.md"` (or similar), if `includes.docs` add `"docs"`, if `includes.changelog` add `"CHANGELOG.md"`; if none, pass `undefined` so backend uses default.
- On “Connect repo”: call `ingest({ owner, repo, paths, github_token?: undefined })`, then `setKnowledgeId(res.knowledge_id)`, `setRepoLabel(owner + "/" + repo)`, `navigate("/onboard/brief")`. Show loading and catch errors (toast or inline).
- Remove or keep mock repo list as quick-select; ensure selected item still yields owner/repo for the API.

**3.2 OnboardBrief** (`frontend-canvas/src/pages/OnboardBrief.tsx`)

- Read `knowledge_id` and `repoLabel` from context. If `knowledge_id` is missing, redirect to `/onboard`.
- Map tone to API: e.g. “Casual & direct” → `"casual"`, “Professional” → `"professional"`, “Technical” → `"technical"` (use values the backend expects).
- Build `channels`: array of `"reddit" | "email" | "linkedin"` from the checkboxes.
- On “Build my brain”: call `createBrief({ knowledge_id, audience, tone, goals: goal, channels, constraints: avoid })`, then `setBriefId(res.brief_id)`, `navigate("/onboard/processing")`. Show loading and errors.
- Header repo label: use `repoLabel` from context instead of hardcoded “james/readout”.

**3.3 OnboardProcessing** (`frontend-canvas/src/pages/OnboardProcessing.tsx`)

- Read `brief_id` from context. If missing, redirect to `/onboard/brief` or `/onboard`.
- Replace mock steps with a real sequence, e.g.:
  1. “Discovering subreddits…” → `discoverSubreddits({ brief_id })`.
  2. “Generating Reddit drafts…” → `generate({ brief_id, channel: "reddit", count: 3 })`.
- Update progress from API completion; on success show a short summary (e.g. “Found N subreddits, generated M drafts”) then `navigate("/dashboard")`. Handle errors (retry or show message).

**3.4 Dashboard** (`frontend-canvas/src/pages/Dashboard.tsx`)

- Read `brief_id` and `repoLabel` from context. If no `brief_id`, redirect to `/onboard` or show “Create a brief first”.
- Fetch drafts: `getDrafts(brief_id)` (e.g. on mount via React Query or useEffect). Show real drafts; map `channel`, `title`, `body`, `metadata` (e.g. subreddit name from metadata) to the current card UI.
- Channel counts: derive from drafts (e.g. count by `draft.channel`).
- Re-sync: if you have repo from context, parse owner/repo and call `ingest` again (optional: update `knowledge_id` if backend returns same or new id). Show loading.
- Regenerate: call `generate({ brief_id, channel: "reddit", count: 3 })` then refetch drafts or invalidate query.

**3.5 RedditDiscover** (`frontend-canvas/src/pages/RedditDiscover.tsx`)

- Read `brief_id` from context. If missing, redirect or show empty state.
- On mount (or “Discover” button): call `discoverSubreddits({ brief_id })`, replace mock `subreddits` with API response. Map `name`, `description`, `subscribers`, `rationale` to the card (backend returns `SubredditInfo`: name, description, subscribers, rationale).
- “Generate drafts for N subreddits”: call `generate({ brief_id, channel: "reddit", count: selected.size })` then navigate to `/dashboard` or show success and link to dashboard.

**3.6 EmailCampaign** (`frontend-canvas/src/pages/EmailCampaign.tsx`)

- Read `brief_id` from context. Load drafts: `getDrafts(brief_id)` and find a draft with `channel === "email"`, or call `generate({ brief_id, channel: "email", count: 1 })` if none. Display `title` as subject, `body` as body. Regenerate button: call `generate` again and update UI.

---

## 4. Backend and CORS

- **CORS**: In `readout/main.py`, restrict `allow_origins` to the frontend origin (e.g. `http://localhost:8080` for dev). Use env e.g. `FRONTEND_ORIGIN` so production can set the deployed frontend URL.
- **README**: In repo root or `docs/`, add a short “Running the app” section: start backend (`uvicorn readout.main:app --reload --port 8000`), then frontend (`cd frontend-canvas && npm run dev`), set `VITE_READOUT_API_URL=http://localhost:8000` for the frontend.

---

## 5. Implementation order

1. **API client + env** — Add `VITE_READOUT_API_URL`, create `frontend-canvas/src/lib/readoutApi.ts` with all six functions.
2. **Context** — Add ReadoutProvider with `knowledge_id`, `brief_id`, `repoLabel`; wrap App.
3. **Onboard** — Ingest on submit, set context, navigate to brief.
4. **OnboardBrief** — Create brief on submit, set brief_id, navigate to processing.
5. **OnboardProcessing** — Real discover + generate, then navigate to dashboard.
6. **Dashboard** — getDrafts, Re-sync (ingest), Regenerate (generate).
7. **RedditDiscover** — discoverSubreddits, then generate drafts.
8. **EmailCampaign** — Load/regenerate email draft from API.
9. **CORS + docs** — Tighten CORS, document running both.
10. **Apollo (optional)** — Backend Apollo client + `POST /leads/search`; frontend `searchLeads` + EmailCampaign “Find leads” and leads table (see §7).

---

## 6. Readout API quick reference

| Endpoint                        | Request                                                                  | Response                                                   |
| ------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `POST /ingest`                  | `owner`, `repo`, `paths?`, `github_token?`                               | `knowledge_id`, `chunks_count`, `summary?`                 |
| `POST /brief`                   | `knowledge_id`, `audience`, `tone`, `goals?`, `channels`, `constraints?`  | `brief_id`                                                 |
| `POST /generate`                | `brief_id`, `channel`, `count?` (default 3)                              | `drafts[]`                                                 |
| `GET /briefs/{brief_id}/drafts` | —                                                                        | `drafts[]`                                                 |
| `POST /discover-subreddits`     | `brief_id`                                                               | `subreddits[]` (name, description, subscribers, rationale)  |
| `POST /chat`                    | `knowledge_id`, `messages[]`                                             | `reply`                                                    |

Shapes: `readout/models/schemas.py`. Chat can be added later (e.g. a dedicated chat page or sidebar) using `knowledge_id` from context.

---

## 7. Apollo (leads) integration

Apollo.io is used on the **EmailCampaign** page for lead sourcing: “Connect Apollo” + persona filters (Title, Industry, Company size) → search leads → show list; those leads can later be used with the generated email draft (merge fields, export, or send via another provider). The backend holds the Apollo API key and exposes a single search endpoint so the frontend never touches the key.

### 7.1 Backend

**Config** (`readout/config.py`)

- Add `apollo_api_key: str = ""` (loaded from `.env` as `APOLLO_API_KEY`). Optional: if empty, the leads search route returns 503 or a clear “Apollo not configured” message.

**Apollo client** (`readout/connectors/apollo_client.py`)

- New module. Base URL: `https://api.apollo.io/api/v1`.
- Auth: every request uses header `x-api-key: settings.apollo_api_key`.
- Function: `search_people(title?: str, industry?: str, company_size?: str, page: int = 1, per_page: int = 25) -> list[dict]`. Call Apollo’s People Search (or Mixed People Search) endpoint with these filters; normalize the response to a simple list of lead objects, e.g. `{ id, first_name, last_name, email, title, organization_name, linkedin_url }`. Handle rate limits and errors (e.g. 401/403 → “invalid or missing API key”).

**Schemas** (`readout/models/schemas.py`)

- `LeadSearchRequest`: optional `title`, `industry`, `company_size`, `page`, `per_page`.
- `LeadSearchResponse`: `leads: list[Lead]` where `Lead` has `id`, `first_name`, `last_name`, `email`, `title`, `organization_name`, `linkedin_url` (all optional except what Apollo returns).

**Route** (`readout/api/routes.py`)

- `POST /leads/search`: body `LeadSearchRequest`, call `apollo_client.search_people(...)`, return `LeadSearchResponse`. If `apollo_api_key` is empty, return 503 with a message that Apollo is not configured.

**.env.example**

- Add `APOLLO_API_KEY=` (user fills from Apollo dashboard → API Keys).

### 7.2 Frontend

**API client** (`frontend-canvas/src/lib/readoutApi.ts`)

- Add `searchLeads({ title?, industry?, company_size?, page?, per_page? })` → `{ leads }` (typed to match `LeadSearchResponse`). Call `POST /leads/search`.

**EmailCampaign page** (`frontend-canvas/src/pages/EmailCampaign.tsx`)

- **Connect Apollo**: “Connect Apollo” can mean “Apollo is available for search.” Either:
  - Call a small backend health/status endpoint (e.g. `GET /apollo/status` that returns 200 if `APOLLO_API_KEY` is set, 503 otherwise), or
  - No separate “connect” step: when user clicks “Find leads,” call `searchLeads(...)`; if backend returns 503, show “Add APOLLO_API_KEY to the backend to use Apollo.”
- **Persona filters**: Wire the existing Selects (Title, Industry, Size) to state: `title`, `industry`, `companySize`. Map to API params (e.g. “CTO” → title, “SaaS” → industry, “50-500” → company_size).
- **Find leads**: Button “Find leads” → `searchLeads({ title, industry, company_size, per_page: 25 })`. Show loading; on success, display leads in a table or list (columns: name, email, title, company, optional LinkedIn link). On 503 or error, show the “Apollo not configured” or error message.
- **Optional**: “Save for campaign” or “Use these leads” that stores the selected leads in context or a later Supabase table linked to `brief_id` (can be a follow-up task).

### 7.3 Implementation order (Apollo)

1. Backend: add `APOLLO_API_KEY` to config and `.env.example`.
2. Backend: implement `readout/connectors/apollo_client.py` (search people, normalize to leads).
3. Backend: add `LeadSearchRequest`, `LeadSearchResponse`, `Lead` in schemas; add `POST /leads/search` route.
4. Frontend: add `searchLeads` to `readoutApi.ts`.
5. Frontend: wire EmailCampaign persona filters and “Find leads” to `searchLeads`; display results; handle 503/errors.

### 7.4 API reference (Apollo)

| Endpoint           | Request                                                                 | Response                          |
| ------------------ | ----------------------------------------------------------------------- | --------------------------------- |
| `POST /leads/search` | `title?`, `industry?`, `company_size?`, `page?`, `per_page?`           | `leads[]` (id, name, email, title, organization_name, linkedin_url) |

Apollo API: API key in `x-api-key` header; People Search (or Mixed People Search) endpoint per [Apollo API docs](https://docs.apollo.io/reference/people-api-search). Keep the key only on the backend.

---

## Checklist (tracking)

- [ ] Add `VITE_READOUT_API_URL` and `frontend-canvas/src/lib/readoutApi.ts` with typed ingest, brief, generate, getDrafts, discoverSubreddits, chat
- [ ] Add ReadoutProvider (knowledge_id, brief_id, repoLabel) and wrap App; optional sessionStorage persist
- [ ] Onboard: parse owner/repo, build paths from includes, call ingest, set context, navigate to /onboard/brief
- [ ] OnboardBrief: read knowledge_id from context, map tone, call createBrief, set brief_id, navigate to /onboard/processing
- [ ] OnboardProcessing: use brief_id, call discover-subreddits then generate(reddit), real progress, navigate to /dashboard
- [ ] Dashboard: fetch getDrafts(brief_id), show real drafts; Re-sync (re-ingest), Regenerate (generate)
- [ ] RedditDiscover: call discoverSubreddits(brief_id), show API results; Generate drafts calls generate then navigate
- [ ] EmailCampaign: load email draft via getDrafts or generate(brief_id, email)
- [ ] Tighten CORS to frontend origin (e.g. 8080), add README section for running both
- [ ] **Apollo:** Backend: add `APOLLO_API_KEY`, `readout/connectors/apollo_client.py`, schemas + `POST /leads/search`
- [ ] **Apollo:** Frontend: add `searchLeads` to readoutApi; wire EmailCampaign persona filters + “Find leads” to search; display leads table; handle 503/errors
