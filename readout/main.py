from fastapi import FastAPI

from readout.api.routes import router

app = FastAPI(title="Readout", description="Unified outreach automation from repo")

app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok"}
