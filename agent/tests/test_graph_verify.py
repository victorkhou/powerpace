"""Graph-level test of the inline groundedness guard, fully hermetic.

We stub the coach model (to emit a tool call, then a hallucinated answer, then a
corrected answer) and the judge (NOT_GROUNDED first, GROUNDED second), and assert
the verify→agent loop regenerates the answer. No real model or network.
"""
from types import SimpleNamespace
from unittest.mock import patch

from langchain_core.messages import AIMessage, ToolMessage

from app import graph as g


class _ScriptedModel:
    """Returns a queued AIMessage per invoke() call. bind_tools is a no-op."""
    def __init__(self, scripted):
        self._scripted = list(scripted)

    def bind_tools(self, _tools):
        return self

    def invoke(self, _messages):
        return self._scripted.pop(0)


def test_verify_loop_regenerates_ungrounded_answer():
    # 1) agent asks for a tool, 2) agent gives a hallucinated answer,
    # 3) after correction, agent gives a grounded answer.
    tool_call = AIMessage(
        content="",
        tool_calls=[{"name": "get_volume_trend", "args": {}, "id": "call-1"}],
    )
    bad_answer = AIMessage(content="Your most recent session 06-28 hit 6,075 lbs.")
    good_answer = AIMessage(content="Your most recent recorded session is 06-27 at 0 lbs.")
    model = _ScriptedModel([tool_call, bad_answer, good_answer])

    # Judge: first verdict rejects, second accepts.
    judge = SimpleNamespace(_verdicts=["x\nNOT_GROUNDED", "x\nGROUNDED"])
    judge.invoke = lambda _p: SimpleNamespace(content=judge._verdicts.pop(0))

    # Tool returns clean data with no 06-28 row.
    def fake_tool(_uid, *_a, **_k):
        return [{"date": "2026-06-27", "volume_lbs": 0.0}]

    with patch.object(g, "init_chat_model", return_value=model), \
         patch.object(g, "_judge", return_value=judge), \
         patch("app.db.get_volume_trend", side_effect=fake_tool), \
         patch("app.db.active_program_id", return_value="prog-1"):
        # ToolNode will call the real tool function; patch at db level so no network.
        agent = g.build_coach("user-1")
        result = agent.invoke(
            {"messages": [{"role": "user", "content": "is my volume up?"}], "grounding_attempts": 0},
            {"configurable": {"thread_id": "t1"}, "recursion_limit": 12},
        )

    final = result["messages"][-1]
    assert isinstance(final, AIMessage)
    assert "06-28" not in final.content        # the hallucinated answer was rejected
    assert "06-27" in final.content            # the corrected, grounded answer won
    assert result["grounding_attempts"] == 1   # exactly one regeneration
    # Both verdicts consumed → the RETRY answer was re-verified too. Before the
    # coach_correction tag fix, the retry pass saw zero tool outputs (the walk
    # stopped at the correction message) and was accepted with NO judge call.
    assert judge._verdicts == []


def test_retry_answer_is_reverified_and_budget_bounds_the_loop():
    """A retry that is STILL ungrounded must be re-judged (not silently accepted)
    and then returned once the retry budget is exhausted — proving the verify
    loop re-checks regenerated answers and remains bounded."""
    tool_call = AIMessage(
        content="", tool_calls=[{"name": "get_volume_trend", "args": {}, "id": "c1"}]
    )
    bad1 = AIMessage(content="You hit 9,999 lbs on 07-04.")
    bad2 = AIMessage(content="Definitely 9,999 lbs on 07-04.")
    model = _ScriptedModel([tool_call, bad1, bad2])

    calls = {"n": 0}
    def judge_invoke(_p):
        calls["n"] += 1
        return SimpleNamespace(content="nope\nNOT_GROUNDED")
    judge = SimpleNamespace(invoke=judge_invoke)

    with patch.object(g, "init_chat_model", return_value=model), \
         patch.object(g, "_judge", return_value=judge), \
         patch("app.db.get_volume_trend", return_value=[{"date": "2026-06-27", "volume_lbs": 0.0}]), \
         patch("app.db.active_program_id", return_value="prog-1"):
        agent = g.build_coach("user-1")
        result = agent.invoke(
            {"messages": [{"role": "user", "content": "volume?"}], "grounding_attempts": 0},
            {"configurable": {"thread_id": "t3"}, "recursion_limit": 12},
        )

    # Judge ran on the original AND the retry (2 calls) — the retry was not
    # silently accepted. With retries=1 exhausted, the last attempt is returned.
    assert calls["n"] == 2
    assert result["grounding_attempts"] == 1
    assert isinstance(result["messages"][-1], AIMessage)


def test_verify_accepts_grounded_answer_without_retry():
    tool_call = AIMessage(
        content="", tool_calls=[{"name": "get_volume_trend", "args": {}, "id": "c1"}]
    )
    good = AIMessage(content="Most recent recorded session: 06-27 at 0 lbs.")
    model = _ScriptedModel([tool_call, good])
    judge = SimpleNamespace(invoke=lambda _p: SimpleNamespace(content="fine\nGROUNDED"))

    with patch.object(g, "init_chat_model", return_value=model), \
         patch.object(g, "_judge", return_value=judge), \
         patch("app.db.get_volume_trend", return_value=[{"date": "2026-06-27", "volume_lbs": 0.0}]), \
         patch("app.db.active_program_id", return_value="prog-1"):
        agent = g.build_coach("user-1")
        result = agent.invoke(
            {"messages": [{"role": "user", "content": "q"}], "grounding_attempts": 0},
            {"configurable": {"thread_id": "t2"}, "recursion_limit": 12},
        )

    assert result["messages"][-1].content == good.content
    assert result.get("grounding_attempts", 0) == 0  # no retry needed
