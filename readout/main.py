from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from readout.api.routes import router
from readout.config import settings

app = FastAPI(title="Readout", description="Unified outreach automation from repo")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok"}
