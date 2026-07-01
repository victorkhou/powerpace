"""Phase 4 — Multi-provider comparison.

Runs the SAME eval suite (same dataset, same evaluators, same tools, same graph)
against two or more coach models and prints a side-by-side scoreboard. The models
are just provider-prefixed strings — swapping "anthropic:claude-opus-4-8" for
"openai:gpt-..." would compare providers with ZERO other code change. That the
comparison needs no per-model branching IS the lesson: the agent abstraction
(LangChain's init_chat_model + a provider-agnostic graph/tools) makes model choice
a config value, not a code path.

This demo A/Bs two Claude models (opus vs haiku) so it runs with no new setup. To
add a real second provider: pip install its langchain integration, put its key in
.env, and add its "provider:model" string to MODELS below.

Run (from agent/, with .env populated + EVAL_USER_ID set):
    python -m evals.compare_models
"""
from langsmith import Client, evaluate

from app import env  # noqa: F401 — load .env into os.environ before any SDK reads it
from evals.run_evals import (
    DATASET_NAME,
    USER_ID,
    ensure_dataset,
    grounded,
    make_target,
    pr_correct,
)

# The models to compare. Same graph/tools/eval for each — only this string varies.
# Add "openai:gpt-4o" / "google_genai:gemini-1.5-pro" / "ollama:llama3.1" here
# (with the package installed + key set) to compare real providers.
MODELS = [
    "anthropic:claude-opus-4-8",
    "anthropic:claude-haiku-4-5",
]

# The metrics we report, in display order. Must match the evaluator keys.
METRICS = ["pr_correct", "grounded"]


def _run_one(client: Client, model_id: str) -> dict[str, float]:
    """Run the full eval suite for one model; return {metric: mean_score}."""
    # Slugify the model id for a readable, valid experiment prefix.
    slug = model_id.replace(":", "-").replace(".", "-").replace("/", "-")
    results = evaluate(
        make_target(model_id),
        data=DATASET_NAME,
        evaluators=[pr_correct, grounded],
        experiment_prefix=f"compare-{slug}",
        metadata={"model": model_id},
        max_concurrency=4,
    )
    results.wait()  # ensure all runs + feedback are flushed to LangSmith

    # Aggregate scores by reading feedback from the experiment's runs — the same
    # reliable path used elsewhere in this session (independent of the internal
    # row-dict shape, which varies across langsmith versions).
    sums: dict[str, list[float]] = {m: [] for m in METRICS}
    for run in client.list_runs(project_name=results.experiment_name, is_root=True):
        for fb in client.list_feedback(run_ids=[run.id]):
            if fb.key in sums and fb.score is not None:
                sums[fb.key].append(fb.score)
    return {m: (sum(v) / len(v) if v else float("nan")) for m, v in sums.items()}


def _print_table(scores: dict[str, dict[str, float]]) -> None:
    """Side-by-side scoreboard: rows = models, columns = metrics."""
    model_w = max(len(m) for m in scores) + 2
    header = "model".ljust(model_w) + "".join(m.rjust(14) for m in METRICS)
    print("\n" + header)
    print("-" * len(header))
    for model_id, metrics in scores.items():
        row = model_id.ljust(model_w) + "".join(
            (f"{metrics[m]:.2f}").rjust(14) for m in METRICS
        )
        print(row)
    print()


def main() -> None:
    if not USER_ID:
        raise SystemExit("Set EVAL_USER_ID in agent/.env to a real user UUID first.")
    client = Client()
    ensure_dataset(client)  # one shared dataset → every model graded on identical examples

    scores: dict[str, dict[str, float]] = {}
    for model_id in MODELS:
        print(f"\n=== evaluating {model_id} ===")
        scores[model_id] = _run_one(client, model_id)

    print("\n================ COMPARISON ================")
    _print_table(scores)
    print("Full per-example traces + experiments are in LangSmith "
          "(dataset: %s)." % DATASET_NAME)


if __name__ == "__main__":
    main()
