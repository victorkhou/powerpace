# PowerPace Coach — agent sidecar

A Python sidecar that adds an AI **training coach** to PowerPace. Built as a
learning vehicle for: agent abstraction (LangChain), observability (LangSmith),
evals (LangSmith datasets), and orchestration (LangGraph) — provider-neutral, so
a second model provider drops in without rewriting tools.

```
Next.js (/api/coach)  ──▶  FastAPI sidecar  ──▶  LangGraph agent ──▶ Supabase (read-only)
                                              └─▶ LangSmith (tracing + evals)
```

## Setup

```bash
cd agent
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then fill in the values
```

Fill `.env`:
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — service-role key, **server-side only**.
  Find it in Supabase → Project Settings → API. Never put it in the Next.js client.
- `ANTHROPIC_API_KEY`
- `LANGSMITH_API_KEY` (+ keep `LANGSMITH_TRACING=true`) — from https://smith.langchain.com

On the Next.js side, add to `webapp/.env.local`:
- `COACH_SERVICE_URL=http://localhost:8000`

## Run

```bash
uvicorn app.main:app --reload --port 8000        # sidecar
# in another shell, the Next.js app as usual (npm run dev)
```

Smoke test (bypasses Next.js auth — uses a real user_id from your DB):

```bash
curl -s localhost:8000/coach \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"<a real user uuid>","question":"What is my bench PR?"}' | jq
```

Then open https://smith.langchain.com and watch the trace appear.

Multi-turn memory — reuse `thread_id` across calls to keep conversation context
(omit it and the graph defaults the thread to `user_id`):

```bash
curl -s localhost:8000/coach -H 'Content-Type: application/json' \
  -d '{"user_id":"<uuid>","thread_id":"chat-1","question":"What is my bench PR?"}' | jq
curl -s localhost:8000/coach -H 'Content-Type: application/json' \
  -d '{"user_id":"<uuid>","thread_id":"chat-1","question":"And how does that compare to my squat?"}' | jq
```

## The learning path (each phase is runnable on its own)

| Phase | Goal | Files | What you learn |
|---|---|---|---|
| 0 ✅ | Wiring + tracing | `main.py`, `graph.py`, `config.py` | One Claude call end-to-end; LangSmith traces it automatically |
| 1 ✅ | Working coach | `tools.py`, `db.py` | LangChain tools + prebuilt ReAct agent over your real data |
| 2 ✅ | Custom graph | `graph.py` | Explicit `StateGraph` (state + reducer, agent/tools nodes, conditional edge) + `MemorySaver` checkpointer for multi-turn memory via `thread_id` |
| 3 ✅ | Evals | `evals/run_evals.py` | Dataset generated from DB ground truth; exact-match (`pr_correct`) + LLM-as-judge (`grounded`, Haiku) evaluators; `python -m evals.run_evals` |
| 4 ✅ | Multi-provider | `evals/compare_models.py` | Run the same eval suite across N models via one `build_coach(user_id, model_id)` seam; side-by-side scoreboard. Demoed opus-vs-haiku (both 1.00/1.00); a real provider drops in by adding `"provider:model"` to `MODELS` + its package/key |

Models: `claude-opus-4-8` for the coach, `claude-haiku-4-5` for eval grading.

## Tests

```bash
cd agent && pytest
```

Unit tests under `tests/` mock Supabase, Anthropic, and LangSmith, so they need
**no `.env`, no DB, and no network** — they run in CI on every push (the `coach`
job in `.github/workflows/ci.yml`). They cover the deterministic, drift-prone
plumbing: `db.py` query/edge-case handling, tool JSON serialization, and the eval
harness's `_fmt` / `pr_correct` / `grounded`-parser logic. The LangSmith evals
(`python -m evals.run_evals`) are a separate, live groundedness harness — not
unit tests.

## Safety

- Every DB tool is **read-only** (SELECT). The agent cannot write.
- `user_id` is injected per-request from the authenticated Next.js session — it is
  not a tool argument and not taken from the client body. The sidecar additionally
  requires a shared secret (`COACH_SHARED_SECRET`) and refuses to start
  auth-disabled unless `COACH_ENV=development`.
- The LLM path is bounded: per-response `max_tokens`, a request timeout, a graph
  recursion limit, and a `COACH_ENABLED` kill-switch.
- **Groundedness guard:** a `verify` node checks every final answer against that
  turn's tool outputs (via the Haiku judge in `groundedness.py`) and regenerates
  it if the model invented a figure — a structural backstop, since a prompt
  instruction alone did not stop hallucination. Bounded by `coach_grounding_retries`.
- Secrets live only in `agent/.env` (git-ignored); the service-role key is never
  shipped to the browser.
