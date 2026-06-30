"""Tests for the groundedness guard's deterministic logic. The judge is stubbed,
so these run with no model/network — they pin the verdict parser and the
check() data-assembly + return contract."""
from types import SimpleNamespace

from app import groundedness


def _judge(verdict_text):
    """A fake judge: records the prompt it received, returns a canned verdict."""
    captured = {}

    def invoke(prompt):
        captured["prompt"] = prompt
        return SimpleNamespace(content=verdict_text)

    return SimpleNamespace(invoke=invoke), captured


# ── parse_verdict ────────────────────────────────────────────────────────────
def test_parse_verdict_grounded():
    assert groundedness.parse_verdict("Looks fine.\nGROUNDED") is True


def test_parse_verdict_not_grounded():
    assert groundedness.parse_verdict("Invented a session.\nNOT_GROUNDED") is False


def test_parse_verdict_reads_only_final_line():
    # 'not grounded' phrasing earlier must not flip a GROUNDED final verdict.
    assert groundedness.parse_verdict("This was not an easy call.\nGROUNDED") is True


def test_parse_verdict_ignores_trailing_blank_lines():
    assert groundedness.parse_verdict("reason\nNOT_GROUNDED\n\n") is False


# ── check ────────────────────────────────────────────────────────────────────
def test_check_returns_grounded_true():
    judge, _ = _judge("ok\nGROUNDED")
    ok, text = groundedness.check(judge, "answer", ["tool output"])
    assert ok is True and "GROUNDED" in text


def test_check_returns_grounded_false():
    judge, _ = _judge("bad\nNOT_GROUNDED")
    ok, _text = groundedness.check(judge, "answer", ["tool output"])
    assert ok is False


def test_check_includes_tool_outputs_in_prompt():
    judge, captured = _judge("ok\nGROUNDED")
    groundedness.check(judge, "the answer", ["VOL=6075 on 06-28", "PR=157.5"])
    assert "VOL=6075 on 06-28" in captured["prompt"]
    assert "the answer" in captured["prompt"]


def test_check_handles_no_tool_outputs():
    judge, captured = _judge("ok\nGROUNDED")
    groundedness.check(judge, "answer", [])
    assert "no data was retrieved" in captured["prompt"]
