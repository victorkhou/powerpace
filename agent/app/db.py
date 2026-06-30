"""Thin read-only data-access layer over Supabase.

Every function here is a SELECT. The agent never writes — that keeps the blast
radius of a hallucinated tool call to zero and keeps evals deterministic.
"""
from functools import lru_cache

from supabase import Client, create_client

from .config import settings

# Human-readable lift names — mirrors LIFT_LABELS in src/lib/progression.ts so the
# coach speaks the same language as the UI.
LIFT_LABELS = {
    "squat": "Back Squat", "bench": "Bench Press", "incline": "Incline Bench",
    "cgbp": "Close-Grip Bench", "ohp": "Overhead Press", "deadlift": "Deadlift",
    "row": "Barbell Row", "rdl": "Romanian DL", "goodMornings": "Good Mornings",
}


@lru_cache(maxsize=1)
def _client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def active_program_id(user_id: str) -> str | None:
    res = (
        _client().table("programs").select("id")
        .eq("user_id", user_id).eq("is_active", True).limit(1).execute()
    )
    return res.data[0]["id"] if res.data else None


def get_pr(user_id: str, lift_key: str) -> dict | None:
    """Personal record + streak/failure state for one lift."""
    pid = active_program_id(user_id)
    if not pid:
        return None
    res = (
        _client().table("working_weights")
        .select("key, weight_lbs, pr_lbs, streak, failures, updated_at")
        .eq("program_id", pid).eq("key", lift_key).limit(1).execute()
    )
    if not res.data:
        return None
    row = res.data[0]
    row["label"] = LIFT_LABELS.get(lift_key, lift_key)
    return row


def get_recent_sessions(user_id: str, limit: int = 10) -> list[dict]:
    """Most recent logged sessions (excludes undone), newest first."""
    pid = active_program_id(user_id)
    if not pid:
        return []
    res = (
        _client().table("sessions")
        .select("id, date, week_number, status, volume_lbs, rpe, notes")
        .eq("program_id", pid).neq("status", "undone")
        .order("date", desc=True).limit(limit).execute()
    )
    return res.data or []


def get_progression_state(user_id: str) -> list[dict]:
    """Current working weight + streak/failures for every tracked lift."""
    pid = active_program_id(user_id)
    if not pid:
        return []
    res = (
        _client().table("working_weights")
        .select("key, weight_lbs, pr_lbs, streak, failures")
        .eq("program_id", pid).execute()
    )
    for row in res.data or []:
        row["label"] = LIFT_LABELS.get(row["key"], row["key"])
    return res.data or []


def get_volume_trend(user_id: str, limit: int = 20) -> list[dict]:
    """Per-session total volume over time (oldest first), for trend analysis."""
    pid = active_program_id(user_id)
    if not pid:
        return []
    res = (
        _client().table("sessions")
        .select("date, week_number, volume_lbs")
        .eq("program_id", pid).neq("status", "undone")
        .order("date", desc=False).limit(limit).execute()
    )
    return res.data or []
