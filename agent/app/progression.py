"""Progression rules — the Python mirror of src/lib/progression.ts.

WHY THIS MODULE EXISTS: the coach previously hardcoded progression rules as prose
in its system prompt ("~5% deload", "3 failures"), which (a) drifted from the real
TS engine and (b) ignored each program's actual volume_pct. The rules below mirror
the TS source of truth, and `program_rules()` (in db.py) layers the program's
live volume_pct on top, so the coach can state what the system ACTUALLY does
instead of a hardcoded approximation.

Keep this in sync with src/lib/progression.ts. The values are static program
design constants (not per-user), so a small shared definition is the right
abstraction; the dynamic piece (volume_pct) is read from the DB at query time.
"""

# Per-lift weight increment on a successful session. Mirrors INCREMENTS in
# src/lib/progression.ts:3-13.
INCREMENTS: dict[str, float] = {
    "squat": 5,
    "rdl": 2.5,
    "goodMornings": 2.5,
    "bench": 5,
    "incline": 5,
    "ohp": 5,
    "cgbp": 2.5,
    "row": 5,
    "deadlift": 5,
}

# Consecutive failures that trigger a deload. Mirrors processLift (newFailures >= 3).
DELOAD_FAILURE_THRESHOLD = 3

# Deload multiplier applied at the threshold, rounded to the lift's increment.
# Mirrors: Math.max(inc, round((weight * 0.95) / inc) * inc).
DELOAD_MULTIPLIER = 0.95

# Default volume multiplier (Texas Method). Programs override via programs.volume_pct.
# Mirrors DEFAULT_VOLUME_PCT in src/lib/progression.ts:38.
DEFAULT_VOLUME_PCT = 0.875


def deload_target(weight: float, increment: float) -> float:
    """The weight a lift resets to after hitting the failure threshold.
    Mirrors the 'down' branch of processLift in progression.ts."""
    return max(increment, round((weight * DELOAD_MULTIPLIER) / increment) * increment)
