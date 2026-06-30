"""FastAPI sidecar. Next.js calls POST /coach; this owns all the AI logic.

Run locally:  uvicorn app.main:app --reload --port 8000
"""
import logging
import os
import traceback

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .graph import ask

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("coach")

# Only leak tracebacks to the HTTP response in local dev. Set COACH_ENV=production
# (or anything other than "development") to return a generic message instead.
_DEV = os.environ.get("COACH_ENV", "development") == "development"

app = FastAPI(title="PowerPace Coach")


class CoachRequest(BaseModel):
    user_id: str
    question: str
    # Optional conversation id. Reuse the same value across turns to get
    # multi-turn memory (the graph replays that thread's saved state). Omit it
    # and the graph defaults the thread to the user_id (one rolling conversation).
    thread_id: str | None = None


class CoachResponse(BaseModel):
    answer: str


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/coach")
async def coach(req: CoachRequest):
    try:
        answer = await ask(req.user_id, req.question, req.thread_id)
        return CoachResponse(answer=answer)
    except Exception as exc:
        logger.exception("coach failed")  # full traceback always goes to the server log
        if _DEV:
            return JSONResponse(
                status_code=500,
                content={"error": type(exc).__name__, "detail": str(exc), "trace": traceback.format_exc()},
            )
        return JSONResponse(status_code=500, content={"error": "internal_error"})
