"""Data-layer tests. Supabase is mocked — no DB, no network.

Covers the edge case the review flagged: every getter calls active_program_id
first and must return an empty/None result (not raise) when there's no active
program. Also pins the LIFT_LABELS mapping behaviour.
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


# ── happy paths + label enrichment ───────────────────────────────────────────
def test_get_pr_attaches_human_label(fake_client):
    # First response: programs lookup; second: working_weights row.
    with fake_client(_resp([{"id": "prog-1"}]),
                     _resp([{"key": "bench", "pr_lbs": 157.5, "streak": 0, "failures": 0}])):
        row = db.get_pr("user-1", "bench")
    assert row["pr_lbs"] == 157.5
    assert row["label"] == "Bench Press"  # from LIFT_LABELS


def test_get_pr_unknown_lift_falls_back_to_key(fake_client):
    with fake_client(_resp([{"id": "prog-1"}]),
                     _resp([{"key": "zercher", "pr_lbs": 100}])):
        row = db.get_pr("user-1", "zercher")
    assert row["label"] == "zercher"  # unknown key → label defaults to the key


def test_get_progression_state_enriches_all_rows(fake_client):
    with fake_client(_resp([{"id": "prog-1"}]),
                     _resp([{"key": "squat", "weight_lbs": 280},
                            {"key": "row", "weight_lbs": 120}])):
        rows = db.get_progression_state("user-1")
    assert {r["label"] for r in rows} == {"Back Squat", "Barbell Row"}
