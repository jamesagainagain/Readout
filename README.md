# Readout

Unified outreach automation from repo: connect a GitHub repo and a brief, then generate and manage channel-specific outreach (Reddit, email, LinkedIn) from one place.

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
