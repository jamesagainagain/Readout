from fastapi import FastAPI

app = FastAPI(title="Readout", description="Unified outreach automation from repo")


@app.get("/health")
def health():
    return {"status": "ok"}
