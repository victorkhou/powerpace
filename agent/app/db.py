"""Thin read-only data-access layer over Supabase.

Every function here is a SELECT. The agent never writes — that keeps the blast
radius of a hallucinated tool call to zero and keeps evals deterministic.
"""
from functools import lru_cache

from supabase import Client, create_client

from . import progression
from .config import settings


@lru_cache(maxsize=1)
def _client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def active_program_id(user_id: str) -> str | None:
    res = (
        _client().table("programs").select("id")
        .eq("user_id", user_id).eq("is_active", True).limit(1).execute()
    )
    return res.data[0]["id"] if res.data else None


def lift_labels(user_id: str) -> dict[str, str]:
    """Map each weight_key to its display name, DERIVED FROM THE DB (the active
    program's exercises) rather than a hardcoded dict.

    This is the fix for the label-drift finding: the names live in one place
    (the exercises table the UI already uses), so the coach can never disagree
    with the app about what a lift is called, and lifts the user doesn't train
    simply don't appear. Volume keys (squatVol, …) inherit their parent
    exercise's name automatically.
    """
    pid = active_program_id(user_id)
    if not pid:
        return {}
    days = (
        _client().table("workout_days").select("id")
        .eq("program_id", pid).execute()
    )
    day_ids = [d["id"] for d in (days.data or [])]
    if not day_ids:
        return {}
    rows = (
        _client().table("exercises").select("name, weight_key")
        .in_("workout_day_id", day_ids).execute()
    )
    labels: dict[str, str] = {}
    for r in rows.data or []:
        key = r.get("weight_key")
        if key and key not in labels:
            labels[key] = r["name"]
    return labels


def program_rules(user_id: str) -> dict | None:
    """The active program's progression rules, with the program's LIVE volume_pct.

    Fix for the rules-drift finding: instead of the coach reciting hardcoded
    numbers from its prompt, it calls this and states what the system actually
    does — including this program's real volume multiplier (which can differ
    from the default)."""
    pid = active_program_id(user_id)
    if not pid:
        return None
    res = (
        _client().table("programs")
        .select("volume_pct, week_number, deload_week")
        .eq("id", pid).limit(1).execute()
    )
    row = res.data[0] if res.data else {}
    volume_pct = row.get("volume_pct") or progression.DEFAULT_VOLUME_PCT
    return {
        "increments_lbs": progression.INCREMENTS,
        "deload_failure_threshold": progression.DELOAD_FAILURE_THRESHOLD,
        "deload_multiplier": progression.DELOAD_MULTIPLIER,
        "deload_rule": (
            f"After {progression.DELOAD_FAILURE_THRESHOLD} consecutive failures, the "
            f"weight resets to {int(progression.DELOAD_MULTIPLIER * 100)}% of current, "
            "rounded to the lift's increment."
        ),
        "volume_pct": volume_pct,
        "volume_rule": (
            f"Volume-day weights are {round(volume_pct * 100, 1)}% of the "
            "corresponding intensity-day weight, rounded to the lift's increment."
        ),
        "current_week": row.get("week_number"),
    }


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
    row["label"] = lift_labels(user_id).get(lift_key, lift_key)
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
    labels = lift_labels(user_id)
    for row in res.data or []:
        row["label"] = labels.get(row["key"], row["key"])
    return res.data or []


def get_volume_trend(user_id: str, limit: int = 20) -> list[dict]:
    """The most recent `limit` sessions' volume, returned oldest-first for trend
    analysis.

    IMPORTANT: order DESC then limit then reverse — we want the newest N sessions.
    Ordering ASC + limit would return the *oldest* N and silently drop the most
    recent session (the one a "recent trend" question cares about most). That bug
    previously made the coach's view and the eval's reference disagree on whether
    the latest session existed."""
    pid = active_program_id(user_id)
    if not pid:
        return []
    res = (
        _client().table("sessions")
        .select("date, week_number, volume_lbs")
        .eq("program_id", pid).neq("status", "undone")
        .order("date", desc=True).limit(limit).execute()
    )
    return list(reversed(res.data or []))
