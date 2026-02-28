# Readout

**Unified outreach automation from your repo.** Connect a GitHub repo and a brief; Readout ingests your docs, learns your voice and goals, and generates channel-specific outreach (Reddit, email, LinkedIn) from one place.

## Summary

- **Ingest** — Pull README, docs, and optional paths from GitHub; summarize with AI into a knowledge base for that project.
- **Brief** — Define audience, tone, goals, and channels (Reddit, email, LinkedIn). One brief drives all channels.
- **Generate** — Create on-brand drafts per channel: Reddit (discover subreddits + draft posts), email (subject + body), LinkedIn (post copy).
- **Manage** — View drafts, re-sync from repo, regenerate; scheduling/publishing planned.


Has 11 labs support for voice, and has appollo support for emial outreach 
**Stack:** Backend — FastAPI, Gemini (summarization), Claude (drafts), PRAW + scraper (Reddit), Supabase. Frontend — Vite, React, shadcn/ui.

## Docs

- **[PLAN.md](./PLAN.md)** — Product plan, architecture, implementation phases, and task guide (Reddit → Supabase sync and beyond).
- **[docs/FRONTEND-CANVAS-INTEGRATION.md](./docs/FRONTEND-CANVAS-INTEGRATION.md)** — Wiring the frontend-canvas UI to the Readout API (client, context, CORS, checklist).

## Run locally

**Backend** (port 8000):

```bash
cp .env.example .env   # fill in credentials
pip install -r requirements.txt
uvicorn readout.main:app --reload --port 8000
```

**Frontend** (port 8080):

```bash
cd frontend-canvas
cp .env.example .env   # sets VITE_READOUT_API_URL=http://localhost:8000
npm install
npm run dev
```

Frontend uses `VITE_READOUT_API_URL`; backend allows origins from `FRONTEND_ORIGIN` (default `http://localhost:8080`).

## License

MIT — see [LICENSE](./LICENSE).
