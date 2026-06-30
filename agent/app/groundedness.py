"""Groundedness verification — shared by the inline runtime guard (graph.py) and
the offline eval (evals/run_evals.py), so both judge the same way.

The lesson behind this module: tightening the system prompt to "every number must
come from a tool result" did NOT stop the coach from fabricating a data point
(it invented a session that wasn't in the tool output). A prompt instruction is
not a reliable guardrail. So we verify the answer against the actual tool outputs
with a cheap judge model, and regenerate if it doesn't hold up.

The judge allows arithmetic DERIVED from the data (differences, ratios, totals,
percentages) — it only fails answers that introduce or contradict facts. That's
why we use a model rather than a regex: a substring check would false-positive on
every legitimate "your squat is 122.5 lbs heavier than your bench."
"""

_PROMPT = (
    "You verify whether a fitness coach's answer is GROUNDED in the data it was "
    "given. Grounded means: it introduces no session, date, weight, volume, or "
    "other fact that is absent from or contradicts the DATA below.\n\n"
    "DATA (the only facts available to the coach):\n{data}\n\n"
    "COACH ANSWER:\n{answer}\n\n"
    "Rules:\n"
    "- Arithmetic derived from the DATA (differences, ratios, sums, percentages) "
    "is allowed and is NOT a violation.\n"
    "- Fail the answer if it states a specific session, date, or number that does "
    "not appear in the DATA, or that the DATA contradicts.\n\n"
    "Give a one-sentence reason, then on a FINAL separate line write exactly "
    "GROUNDED or NOT_GROUNDED."
)


def parse_verdict(text: str) -> bool:
    """True = grounded. Reads the final non-empty line for the NOT_GROUNDED token,
    so a judge that explains before its verdict is parsed correctly."""
    lines = [ln for ln in text.strip().upper().splitlines() if ln.strip()]
    last = lines[-1] if lines else ""
    return "NOT_GROUNDED" not in last


def check(judge, answer: str, tool_outputs: list[str]) -> tuple[bool, str]:
    """Ask the judge whether `answer` is grounded in `tool_outputs`.
    Returns (is_grounded, raw_verdict_text). `judge` is any object with .invoke()
    returning a message with .content — injected so this stays testable."""
    data = "\n\n".join(tool_outputs) if tool_outputs else "(no data was retrieved)"
    resp = judge.invoke(_PROMPT.format(data=data, answer=answer))
    text = resp.content if isinstance(resp.content, str) else str(resp.content)
    return parse_verdict(text), text
