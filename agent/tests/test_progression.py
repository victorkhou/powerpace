"""Tests for the progression rule constants/formulas (the Python mirror of
src/lib/progression.ts). These pin the values so drift from the TS source is
caught here."""
from app import progression


def test_increments_match_ts_source():
    # Mirror of INCREMENTS in src/lib/progression.ts:3-13.
    assert progression.INCREMENTS == {
        "squat": 5, "rdl": 2.5, "goodMornings": 2.5, "bench": 5, "incline": 5,
        "ohp": 5, "cgbp": 2.5, "row": 5, "deadlift": 5,
    }


def test_deload_threshold_and_multiplier():
    assert progression.DELOAD_FAILURE_THRESHOLD == 3
    assert progression.DELOAD_MULTIPLIER == 0.95


def test_deload_target_rounds_to_increment():
    # 280 * 0.95 = 266 → rounds to nearest 5 → 265. Mirrors processLift 'down' branch.
    assert progression.deload_target(280, 5) == 265
    # 157.5 * 0.95 = 149.625 → nearest 2.5 → 150.
    assert progression.deload_target(157.5, 2.5) == 150


def test_deload_target_never_below_one_increment():
    assert progression.deload_target(4, 5) == 5
