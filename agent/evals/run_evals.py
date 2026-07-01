"""Phase 3 — Evals. The payoff of the coach use case: ground truth is free.

Two evaluator styles, both demonstrated here:

1. Exact-match (deterministic) — for factual questions where the DB IS the answer.
   "What is my bench PR?" → assert the true pr_lbs number appears in the reply.
   Cheap, fast, no model needed, zero ambiguity.

2. LLM-as-judge — for analysis questions with no single correct string.
   "Is my squat progressing well?" → a cheap judge model (claude-haiku-4-5)
   scores whether the answer is grounded in the reference data we pass it.

Pipeline: build a dataset FROM the DB → run the coach on each example (the
"target") → score each output with the evaluators → results land in LangSmith.

Run (from agent/, with .env populated and EVAL_USER_ID set):
    python -m evals.run_evals

Docs: https://docs.smith.langchain.com/evaluation
"""
import asyncio
import os
import uuid

from langchain.chat_models import init_chat_model
from langsmith import Client, evaluate

from app import env  # noqa: F401 — load .env into os.environ before any SDK reads it
from app import db
from app.config import settings
from app.graph import ask

# The user whose real data we evaluate against. Kept in .env (git-ignored) so the
# UUID never lands in the repo. Set EVAL_USER_ID in agent/.env.
USER_ID = os.environ.get("EVAL_USER_ID", "")
DATASET_NAME = "powerpace-coach-v1"


# ── 1. Build the dataset from the DB ────────────────────────────────────────
def build_examples() -> list[dict]:
    """Generate labeled examples from ground truth in the DB.

    Two kinds, distinguished by example metadata["kind"]:
      - "factual"  → reference_outputs carries the exact pr_lbs (exact-match graded)
      - "analysis" → reference_outputs carries supporting data for the LLM judge
    """
    examples: list[dict] = []

    # Factual: one PR question per tracked lift that has a recorded PR.
    # `labels` is DB-derived; the intensity lifts are those whose key is NOT a
    # volume key (volume keys end in "Vol" and inherit their parent's name).
    labels = db.lift_labels(USER_ID)
    for lift in db.get_progression_state(USER_ID):
        if lift["key"] not in labels or lift["key"].endswith("Vol") or not lift.get("pr_lbs"):
            continue  # only the named main lifts; skip volume keys / unset PRs
        examples.append({
            "inputs": {"question": f"What is my {lift['label']} PR?"},
            "outputs": {"pr_lbs": lift["pr_lbs"]},
            "metadata": {"kind": "factual", "lift": lift["key"]},
        })

    # Analysis: open-ended questions graded by the LLM judge against context.
    state = db.get_progression_state(USER_ID)
    near_deload = [l for l in state if l["failures"] >= 1]
    examples.append({
        "inputs": {"question": "Which of my lifts are closest to a deload, and why?"},
        "outputs": {"context": {"lifts_with_failures": near_deload,
                                "rule": "3 consecutive failures triggers a deload"}},
        "metadata": {"kind": "analysis"},
    })
    examples.append({
        "inputs": {"question": "Is my training volume trending up or down recently?"},
        # Use the SAME window the coach's tool defaults to (limit=20). If the
        # reference and the coach see different-sized windows, the judge flags a
        # boundary-row "contradiction" that is really just a window mismatch.
        "outputs": {"context": {"volume_trend": db.get_volume_trend(USER_ID)}},
        "metadata": {"kind": "analysis"},
    })
    return examples


def ensure_dataset(client: Client) -> None:
    """Create the dataset + examples once; idempotent on re-runs."""
    if client.has_dataset(dataset_name=DATASET_NAME):
        print(f"Dataset {DATASET_NAME!r} already exists — reusing it.")
        return
    ds = client.create_dataset(DATASET_NAME, description="Coach eval set, generated from DB ground truth.")
    examples = build_examples()
    client.create_examples(dataset_id=ds.id, examples=examples)
    print(f"Created dataset {DATASET_NAME!r} with {len(examples)} examples.")


# ── 2. The target: run the coach on one example ─────────────────────────────
def make_target(model_id: str | None = None):
    """Build the system-under-test callable for a given coach model.

    model_id=None → the configured default (settings.coach_model). Passing a
    model here is the ONLY change needed to eval a different model/provider — the
    dataset, evaluators, tools, and prompt are all identical. That's the Phase 4
    point: the comparison is apples-to-apples by construction.

    A FRESH thread_id per example keeps eval runs isolated — otherwise they'd
    share the coach's conversation memory and contaminate each other."""
    def target(inputs: dict) -> dict:
        answer = asyncio.run(
            ask(USER_ID, inputs["question"], thread_id=f"eval-{uuid.uuid4()}", model_id=model_id)
        )
        return {"answer": answer}
    return target


# Default target for the single-model eval (python -m evals.run_evals).
target = make_target()


# ── 3a. Exact-match evaluator (factual examples) ────────────────────────────
def _fmt(n: float) -> str:
    """157.5 → '157.5', 280.0 → '280' — match how the coach writes numbers."""
    return str(int(n)) if float(n).is_integer() else str(n)


def pr_correct(outputs: dict, reference_outputs: dict) -> bool:
    """Did the answer contain the true PR? Skips non-factual examples (returns True
    so they don't drag the score — the judge grades those instead)."""
    if "pr_lbs" not in reference_outputs:
        return True
    return _fmt(reference_outputs["pr_lbs"]) in outputs["answer"]


# ── 3b. LLM-as-judge evaluator (analysis examples) ──────────────────────────
_judge = init_chat_model(settings.judge_model)  # claude-haiku-4-5 — cheap, runs often


def grounded(inputs: dict, outputs: dict, reference_outputs: dict) -> dict:
    """Judge whether an analysis answer is grounded in the reference context.

    Grading "groundedness" is about CONTRADICTION, not completeness: a good coach
    adds reasoning and framing beyond the raw data, and that must not be penalized.
    The rubric below makes that explicit, and we ask for the verdict on its own
    last line so score extraction is robust to the judge explaining first.

    Returns {key, score, comment} so the metric AND its rationale show in LangSmith.
    """
    if "context" not in reference_outputs:
        return {"key": "grounded", "score": 1}  # not an analysis example; skip
    verdict = _judge.invoke(
        "You grade whether a strength coach's answer is GROUNDED in the data — "
        "meaning it does not state numbers or facts that CONTRADICT the data.\n\n"
        f"QUESTION: {inputs['question']}\n"
        f"GROUND-TRUTH DATA: {reference_outputs['context']}\n"
        f"COACH ANSWER: {outputs['answer']}\n\n"
        "Rules:\n"
        "- Added coaching insight, framing, or reasoning that goes BEYOND the data "
        "is fine and must NOT lower the grade.\n"
        "- Only fail the answer if it states a number or fact that the data "
        "directly contradicts (e.g. wrong PR, claims 'up' when data is clearly down).\n\n"
        "First give a one-sentence reason, then on a FINAL separate line write "
        "exactly GROUNDED or NOT_GROUNDED."
    )
    text = verdict.content.strip().upper()
    last_line = text.splitlines()[-1] if text.splitlines() else text
    score = 0 if "NOT_GROUNDED" in last_line else 1
    return {"key": "grounded", "score": score, "comment": verdict.content.strip()[:500]}


def main() -> None:
    if not USER_ID:
        raise SystemExit("Set EVAL_USER_ID in agent/.env to a real user UUID first.")
    client = Client()
    ensure_dataset(client)
    results = evaluate(
        target,
        data=DATASET_NAME,
        evaluators=[pr_correct, grounded],
        experiment_prefix="coach",
        max_concurrency=4,
    )
    print("\nDone. Open the experiment in LangSmith to inspect per-example scores.")
    print(results)


if __name__ == "__main__":
    main()
