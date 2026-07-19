"""Eval-logic tests for the deterministic pieces: number formatting, the
exact-match evaluator, and the LLM-judge's verdict PARSER (judge call stubbed).

These guard the eval harness itself — a silent regression here would corrupt
every future eval score.
"""
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from evals import run_evals as r


# ── _fmt: how PR numbers are rendered for substring matching ─────────────────
@pytest.mark.parametrize("value,expected", [
    (280.0, "280"),     # whole float → no trailing .0
    (157.5, "157.5"),   # genuine fraction kept
    (45, "45"),         # int passes through
    (102.5, "102.5"),
])
def test_fmt(value, expected):
    assert r._fmt(value) == expected


# ── pr_correct: exact-match evaluator ────────────────────────────────────────
def test_pr_correct_true_when_number_present():
    assert r.pr_correct({"answer": "Your bench PR is 157.5 lbs."}, {"pr_lbs": 157.5})


def test_pr_correct_false_when_number_absent():
    assert not r.pr_correct({"answer": "I don't have that data."}, {"pr_lbs": 157.5})


def test_pr_correct_skips_non_factual_examples():
    # Analysis examples carry no pr_lbs — must not drag the factual metric.
    assert r.pr_correct({"answer": "anything"}, {"context": {}}) is True


# ── grounded: verdict PARSER (the LLM call is stubbed) ───────────────────────
def _stub_judge(verdict_text):
    """Stub the groundedness.check call so grounded() exercises only its parsing
    + plumbing logic. We patch groundedness.check (which grounded() delegates to)
    to return a canned (bool, text) tuple — the bool is the parsed verdict."""
    from app import groundedness as g
    is_grounded = g.parse_verdict(verdict_text)
    return patch.object(g, "check", return_value=(is_grounded, verdict_text))


def test_grounded_skips_when_no_context():
    out = r.grounded({"question": "q"}, {"answer": "a"}, {"pr_lbs": 1})
    assert out == {"key": "grounded", "score": 1}


def test_grounded_parses_grounded_verdict():
    with _stub_judge("The answer matches the data.\nGROUNDED"):
        out = r.grounded({"question": "q"}, {"answer": "a"}, {"context": {"x": 1}})
    assert out["score"] == 1


def test_grounded_parses_not_grounded_verdict():
    with _stub_judge("It claims 06/28 but data ends 06/27.\nNOT_GROUNDED"):
        out = r.grounded({"question": "q"}, {"answer": "a"}, {"context": {"x": 1}})
    assert out["score"] == 0


def test_grounded_reads_only_the_final_line():
    # A mention of 'not grounded' earlier must not flip a GROUNDED final verdict.
    with _stub_judge("This is not an easy call, but ultimately fine.\nGROUNDED"):
        out = r.grounded({"question": "q"}, {"answer": "a"}, {"context": {"x": 1}})
    assert out["score"] == 1
