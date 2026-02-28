# Readout

**Unified outreach automation from your repo.** Connect a GitHub repository and a brief; Readout ingests your docs, learns your voice and goals, and generates channel-specific outreach (Reddit, email, LinkedIn) from one place.

## What it does

- **Ingest** — Pull README, docs, and optional paths from a GitHub repo; summarize with AI into a “knowledge base” for that project.
- **Brief** — Define audience, tone, goals, and channels (Reddit, email, LinkedIn). One brief drives all channels.
- **Generate** — Create on-brand drafts per channel. Reddit: discover relevant subreddits and draft posts; email: subject + body; LinkedIn: post copy.
- **Manage** — View drafts, re-sync from repo, regenerate, and (future) schedule or publish.

Backend: FastAPI, Gemini for summarization, Claude for drafts, PRAW + scraper for Reddit, Supabase for persistence. Frontend: Vite + React + shadcn/ui.

## Plan and implementation

- **[PLAN.md](./PLAN.md)** — Full product plan, architecture, implementation phases, and task-by-task execution guide (Reddit → Supabase sync and beyond).
- **[docs/FRONTEND-CANVAS-INTEGRATION.md](./docs/FRONTEND-CANVAS-INTEGRATION.md)** — Implementation plan for wiring the frontend-canvas UI to the Readout API (API client, context, page-by-page wiring, CORS, checklist).

## Running the app

**Backend** (FastAPI on port 8000):
```bash
cp .env.example .env   # fill in credentials
pip install -r requirements.txt
uvicorn readout.main:app --reload --port 8000
```

**Frontend** (Vite + React on port 8080):
```bash
cd frontend-canvas
cp .env.example .env   # sets VITE_READOUT_API_URL=http://localhost:8000
npm install
npm run dev
```

The frontend connects to `VITE_READOUT_API_URL`. The backend accepts requests from `FRONTEND_ORIGIN` (default `http://localhost:8080`).

## License

MIT — see [LICENSE](./LICENSE).
