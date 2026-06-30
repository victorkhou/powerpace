"""Data-layer tests. Supabase is mocked — no DB, no network.

Covers the edge case the review flagged: every getter calls active_program_id
first and must return an empty/None result (not raise) when there's no active
program. Also pins the DB-derived lift-label and program-rules behaviour.
"""
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app import db


def _resp(data):
    """Mimic the supabase response object: a thing with a .data attribute."""
    return SimpleNamespace(data=data)


class _Query:
    """A chainable stub: every builder method returns self; execute() returns a
    preset response. Mirrors supabase's fluent .table().select().eq()...execute()."""

    def __init__(self, response):
        self._response = response

    def __getattr__(self, _name):
        return lambda *a, **k: self

    def execute(self):
        return self._response


class _Client:
    """Returns a queued response per .table() call, in order."""

    def __init__(self, responses):
        self._responses = list(responses)

    def table(self, _name):
        return _Query(self._responses.pop(0))


@pytest.fixture
def fake_client():
    """Patch db._client to return a client yielding the given responses."""
    def _make(*responses):
        client = _Client(responses)
        return patch.object(db, "_client", lambda: client)
    return _make


# ── active_program_id ────────────────────────────────────────────────────────
def test_active_program_id_found(fake_client):
    with fake_client(_resp([{"id": "prog-1"}])):
        assert db.active_program_id("user-1") == "prog-1"


def test_active_program_id_none_when_no_program(fake_client):
    with fake_client(_resp([])):
        assert db.active_program_id("user-1") is None


# ── the "no active program" edge case across every getter ────────────────────
def test_get_pr_no_program_returns_none(fake_client):
    with fake_client(_resp([])):  # programs lookup empty
        assert db.get_pr("user-1", "bench") is None


def test_get_recent_sessions_no_program_returns_empty(fake_client):
    with fake_client(_resp([])):
        assert db.get_recent_sessions("user-1") == []


def test_get_progression_state_no_program_returns_empty(fake_client):
    with fake_client(_resp([])):
        assert db.get_progression_state("user-1") == []


def test_get_volume_trend_no_program_returns_empty(fake_client):
    with fake_client(_resp([])):
        assert db.get_volume_trend("user-1") == []


# ── lift_labels: DB-derived label map ────────────────────────────────────────
def test_lift_labels_derives_from_exercises(fake_client):
    # programs lookup → workout_days → exercises
    with fake_client(_resp([{"id": "prog-1"}]),
                     _resp([{"id": "day-1"}]),
                     _resp([{"name": "Flat Bench", "weight_key": "bench"},
                            {"name": "Flat Bench", "weight_key": "benchVol"},
                            {"name": "Back Squat", "weight_key": "squat"},
                            {"name": "Skip me", "weight_key": None}])):
        labels = db.lift_labels("user-1")
    assert labels == {"bench": "Flat Bench", "benchVol": "Flat Bench", "squat": "Back Squat"}


def test_lift_labels_empty_when_no_program(fake_client):
    with fake_client(_resp([])):
        assert db.lift_labels("user-1") == {}


# ── happy paths + label enrichment (labels now DB-derived) ───────────────────
def test_get_pr_attaches_db_derived_label(fake_client):
    # get_pr issues: programs (active id) → working_weights → then lift_labels
    # issues programs → workout_days → exercises.
    with fake_client(_resp([{"id": "prog-1"}]),                                   # active_program_id
                     _resp([{"key": "bench", "pr_lbs": 157.5, "streak": 0, "failures": 0}]),  # working_weights
                     _resp([{"id": "prog-1"}]),                                   # lift_labels: active_program_id
                     _resp([{"id": "day-1"}]),                                    # lift_labels: workout_days
                     _resp([{"name": "Flat Bench", "weight_key": "bench"}])):     # lift_labels: exercises
        row = db.get_pr("user-1", "bench")
    assert row["pr_lbs"] == 157.5
    assert row["label"] == "Flat Bench"  # from the DB, not a hardcoded map


def test_get_pr_unknown_lift_falls_back_to_key(fake_client):
    with fake_client(_resp([{"id": "prog-1"}]),
                     _resp([{"key": "zercher", "pr_lbs": 100}]),
                     _resp([{"id": "prog-1"}]),
                     _resp([{"id": "day-1"}]),
                     _resp([{"name": "Flat Bench", "weight_key": "bench"}])):
        row = db.get_pr("user-1", "zercher")
    assert row["label"] == "zercher"  # key absent from label map → defaults to the key


# ── program_rules: live volume_pct + static rule constants ───────────────────
def test_program_rules_uses_live_volume_pct(fake_client):
    with fake_client(_resp([{"id": "prog-1"}]),
                     _resp([{"volume_pct": 0.9, "week_number": 1, "deload_week": None}])):
        rules = db.program_rules("user-1")
    assert rules["volume_pct"] == 0.9            # the program's real value, not the default
    assert rules["deload_failure_threshold"] == 3
    assert rules["increments_lbs"]["squat"] == 5


def test_program_rules_falls_back_to_default_volume_pct(fake_client):
    with fake_client(_resp([{"id": "prog-1"}]),
                     _resp([{"volume_pct": None, "week_number": 1}])):
        rules = db.program_rules("user-1")
    assert rules["volume_pct"] == db.progression.DEFAULT_VOLUME_PCT


def test_program_rules_none_when_no_program(fake_client):
    with fake_client(_resp([])):
        assert db.program_rules("user-1") is None
