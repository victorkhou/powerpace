"""LangChain tools the coach can call.

Tool design notes (this is the LangChain abstraction layer you're learning):
- Each @tool's docstring IS the description the model sees — write it for the model.
- Define tools ONCE here; they work unchanged across every provider (Phase 4).
- user_id is injected per-request (see graph.py), NOT a tool argument — the model
  should never have to know or guess the user id.
"""
import json

from langchain_core.tools import tool

from . import db


def build_tools(user_id: str):
    """Return the toolset bound to one user. Closures capture user_id so the
    model's tool calls only carry domain arguments (lift_key, limit, ...)."""

    @tool
    def get_personal_record(lift_key: str) -> str:
        """Get the personal record (PR), current working weight, win streak, and
        failure count for a single lift, by its weight_key (e.g. squat, bench, ohp).
        If unsure which keys exist, call get_progression_state first — it lists
        every tracked lift's key and label."""
        rec = db.get_pr(user_id, lift_key)
        return json.dumps(rec) if rec else f"No data for lift '{lift_key}'."

    @tool
    def get_recent_sessions(limit: int = 10) -> str:
        """List the most recent workout sessions (date, week, status, total volume
        in lbs, RPE, notes), newest first. Use for 'how did my last workouts go'."""
        return json.dumps(db.get_recent_sessions(user_id, limit))

    @tool
    def get_progression_state() -> str:
        """Get current working weight, PR, streak, and failure count for ALL tracked
        lifts at once. Use to assess overall progress or spot lifts near a deload.
        Each row includes the deload threshold via get_program_rules."""
        return json.dumps(db.get_progression_state(user_id))

    @tool
    def get_volume_trend(limit: int = 20) -> str:
        """Get per-session total training volume (lbs) over time, oldest first.
        Use for trend questions like 'is my volume going up'."""
        return json.dumps(db.get_volume_trend(user_id, limit))

    @tool
    def get_program_rules() -> str:
        """Get THIS program's actual progression rules: per-lift weight increments,
        the deload failure threshold and reset formula, and the program's real
        volume-day multiplier (volume_pct, which can differ from the default).
        ALWAYS call this before stating any progression rule, increment, deload
        percentage, or volume percentage — do not recite rules from memory."""
        return json.dumps(db.program_rules(user_id))

    return [get_personal_record, get_recent_sessions, get_progression_state,
            get_volume_trend, get_program_rules]
