"""Phase 3 — Evals (the payoff of the coach use case: ground truth is free).

This file is a STARTER you'll flesh out. It shows the two evaluator styles you're
here to learn:

1. Deterministic / exact-match — for factual questions where the DB IS the answer
   (e.g. "what's my bench PR?" → compare against working_weights.pr_lbs).
2. LLM-as-judge — for analysis questions with no single right string (e.g. "is my
   squat progressing well?") graded by a cheap model (claude-haiku-4-5).

Run:  python -m evals.run_evals     (from the agent/ dir, with .env populated)

Docs to read alongside this: LangSmith `evaluate()` and the Dataset concept.
https://docs.smith.langchain.com/evaluation
"""
import asyncio

from langsmith import Client

from app.config import settings
from app.graph import ask

# ──────────────────────────────────────────────────────────────────────────
# 1. Build a dataset FROM YOUR DB.
#    Because you have ground truth (PRs, progression state), you can generate
#    labeled examples programmatically instead of hand-writing them. Sketch:
#
#      from app import db
#      for lift in db.get_progression_state(USER_ID):
#          examples.append({
#              "inputs": {"question": f"What is my {lift['label']} PR?"},
#              "outputs": {"pr_lbs": lift["pr_lbs"]},
#          })
#
#    Then upload once with client.create_dataset(...) + client.create_examples(...).
# ──────────────────────────────────────────────────────────────────────────

USER_ID = "REPLACE_WITH_A_REAL_USER_ID"
DATASET_NAME = "powerpace-coach-v1"


async def target(inputs: dict) -> dict:
    """The system under test: run the coach on one dataset question."""
    answer = await ask(USER_ID, inputs["question"])
    return {"answer": answer}


def pr_mentioned(outputs: dict, reference_outputs: dict) -> bool:
    """Exact-match evaluator: did the coach's answer contain the true PR number?"""
    expected = str(reference_outputs.get("pr_lbs", ""))
    return expected and expected in outputs["answer"]


# LLM-as-judge: instantiate the cheap judge model once.
# from langchain.chat_models import init_chat_model
# judge = init_chat_model(settings.judge_model)
# def grounded(outputs, reference_outputs) -> bool:
#     verdict = judge.invoke(
#         f"Question answer: {outputs['answer']}\n"
#         f"Is every number in this answer plausibly grounded (no obvious "
#         f"hallucination)? Reply only 'yes' or 'no'."
#     )
#     return "yes" in verdict.content.lower()


def main() -> None:
    client = Client()  # reads LANGSMITH_API_KEY
    # client.evaluate(
    #     lambda inputs: asyncio.run(target(inputs)),
    #     data=DATASET_NAME,
    #     evaluators=[pr_mentioned],   # add `grounded` once you wire the judge
    #     experiment_prefix="coach",
    # )
    print(
        "Eval scaffold ready. Next steps:\n"
        "  1. Set USER_ID above.\n"
        "  2. Generate + upload a dataset from app.db (see comment block).\n"
        "  3. Uncomment client.evaluate(...) and run again.\n"
        f"  4. Phase 4: set COACH_MODEL to a second provider, re-run, compare in LangSmith."
    )


if __name__ == "__main__":
    main()
