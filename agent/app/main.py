"""FastAPI sidecar. Next.js calls POST /coach; this owns all the AI logic.

Run locally:  uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

Bind 127.0.0.1 explicitly (uvicorn's default) and point COACH_SERVICE_URL at
127.0.0.1 too — NOT "localhost". Node resolves localhost to IPv6 ::1 first, so
an IPv4-only listener makes the Next.js fetch throw ECONNREFUSED, which surfaces
in the UI as "Coach service unreachable" even though the sidecar is healthy.

Trust model: this service queries Supabase with the service-role key (bypasses
RLS), so it must NOT be reachable by untrusted callers. Two controls:
  1. A shared secret (COACH_SHARED_SECRET) the Next.js route must present.
  2. Bind to localhost in dev; never expose the port publicly.
The Next.js route is the only thing that should set user_id (from the
authenticated session) — the sidecar cannot re-verify the session, so the
shared secret is what stops a direct caller from impersonating any user_id.
"""
import json
import logging
import os
import secrets
import traceback

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from .config import settings
from .graph import CoachLimitError, ask, ask_stream

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("coach")

# Fail CLOSED: verbose error bodies only when COACH_ENV is explicitly "development".
# A deployment that forgets to set it gets safe, generic 500s.
_DEV = os.environ.get("COACH_ENV") == "development"

# Refuse to run auth-disabled outside local dev — an unauthenticated sidecar with
# a service-role key is a data-exfiltration hole. In dev we allow it for convenience.
if not settings.coach_shared_secret and not _DEV:
    raise RuntimeError(
        "COACH_SHARED_SECRET is required unless COACH_ENV=development. "
        "Refusing to start an unauthenticated sidecar that holds a service-role key."
    )

app = FastAPI(title="PowerPace Coach")


def verify_caller(x_coach_secret: str = Header(default="")) -> None:
    """Auth dependency: constant-time compare against the shared secret.
    No-op when no secret is configured (dev only — guarded at startup above)."""
    if not settings.coach_shared_secret:
        return
    if not secrets.compare_digest(x_coach_secret, settings.coach_shared_secret):
        raise HTTPException(status_code=401, detail="unauthorized")


class CoachRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=64)
    question: str = Field(min_length=1, max_length=settings.coach_max_question_chars)
    # Optional conversation id. Reuse the same value across turns to get
    # multi-turn memory (the graph replays that thread's saved state). Omit it
    # and the graph defaults the thread to the user_id (one rolling conversation).
    thread_id: str | None = Field(default=None, max_length=128)


class CoachResponse(BaseModel):
    answer: str


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/coach", dependencies=[Depends(verify_caller)])
async def coach(req: CoachRequest):
    # Kill-switch: disable the paid LLM path without redeploying.
    if not settings.coach_enabled:
        return JSONResponse(status_code=503, content={"error": "coach_disabled"})
    try:
        answer = await ask(req.user_id, req.question, req.thread_id)
        return CoachResponse(answer=answer)
    except CoachLimitError as exc:
        # Expected, bounded failure — not a server fault. Surface a clean 422.
        return JSONResponse(status_code=422, content={"error": "step_budget_exceeded", "detail": str(exc)})
    except Exception as exc:
        logger.exception("coach failed")  # full traceback always goes to the server log
        if _DEV:
            return JSONResponse(
                status_code=500,
                content={"error": type(exc).__name__, "detail": str(exc), "trace": traceback.format_exc()},
            )
        return JSONResponse(status_code=500, content={"error": "internal_error"})


@app.post("/coach/stream", dependencies=[Depends(verify_caller)])
async def coach_stream(req: CoachRequest):
    """Server-Sent Events variant of /coach. Same auth, same kill-switch; emits
    typed events (tool / token / revising / done / error) so the client can show
    progress instead of a blank wait. See graph.ask_stream for the event shapes."""
    if not settings.coach_enabled:
        return JSONResponse(status_code=503, content={"error": "coach_disabled"})

    async def gen():
        try:
            async for ev in ask_stream(req.user_id, req.question, req.thread_id):
                yield f"data: {json.dumps(ev)}\n\n"
        except Exception:
            logger.exception("coach stream failed")
            # The HTTP status is already 200 by the time streaming starts, so
            # errors must be delivered in-band as a final event.
            yield f"data: {json.dumps({'type': 'error', 'code': 'internal_error'})}\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
