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
- `COACH_SERVICE_URL=http://127.0.0.1:8000` — use the IPv4 literal, **not**
  `localhost`. Node resolves `localhost` to IPv6 `::1` first, and the sidecar
  binds IPv4 only, so `localhost` makes the proxy fetch throw ECONNREFUSED and
  the UI reports "Coach service unreachable" while the sidecar is perfectly
  healthy.
- `COACH_SHARED_SECRET=<same value as agent/.env>` — the sidecar 401s without it.

## Run

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000   # sidecar
# in another shell, the Next.js app as usual (npm run dev)
```

Smoke test (bypasses Next.js auth — uses a real user_id from your DB):

```bash
curl -s localhost:8000/coach \
  -H 'Content-Type: application/json' \
  -H "x-coach-secret: $COACH_SHARED_SECRET" \
  -d '{"user_id":"<a real user uuid>","question":"What is my bench PR?"}' | jq
```

## Deploying (required for a hosted web app)

The sidecar is a **separate service**. The web app is hosted on **AWS Amplify**
(see `amplify.yml`), which builds and serves the Next.js app but cannot run a
Python process — and `localhost` inside an Amplify SSR function points at that
function's own container, not at your laptop. So a hosted web app must reach the
sidecar over a real URL. Without `COACH_SERVICE_URL` set, `/api/coach` returns
503 `not_configured` and the coach page says so explicitly rather than appearing
broken.

A `Dockerfile` is included; it binds `0.0.0.0:$PORT`, which is what container
hosts inject.

> Pricing note: verify each host's current terms yourself — they change often.
> As of this writing Cloud Run has a standing free tier (2M req/mo) but requires
> a billing account on file; Render offers a free web-service tier that idles
> out; Railway and Fly.io no longer have a free allowance (~$5/mo floor).
> Model-provider (Anthropic) usage is billed separately regardless of host.

### Google Cloud Run (what this project is deployed on)

No local Docker needed — Cloud Build builds the image server-side from source.

```bash
gcloud auth login
gcloud config set project <YOUR_PROJECT_ID>          # billing must be enabled

# One-time: enable APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com

# One-time: grant the default compute service account the build roles.
# New projects lack these, and `run deploy --source` fails with PERMISSION_DENIED
# until they're granted. PNUM = your project NUMBER (not the id).
PNUM=$(gcloud projects describe <YOUR_PROJECT_ID> --format='value(projectNumber)')
SA="$PNUM-compute@developer.gserviceaccount.com"
for R in roles/cloudbuild.builds.builder roles/storage.objectViewer \
         roles/logging.logWriter roles/artifactregistry.writer; do
  gcloud projects add-iam-policy-binding <YOUR_PROJECT_ID> \
    --member="serviceAccount:$SA" --role="$R" --condition=None
done

# Put prod env vars in a YAML file (NOT on the command line). Include
# SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, a strong
# COACH_SHARED_SECRET, optionally LANGSMITH_*. Do NOT set COACH_ENV.
gcloud run deploy powerpace-coach \
  --source agent \
  --region us-central1 \
  --allow-unauthenticated \
  --env-vars-file /path/to/coach-run-env.yaml \
  --memory 1Gi --cpu 1 --timeout 120 --max-instances 3
```

`--allow-unauthenticated` refers to Google IAM (the endpoint is public); the
sidecar's OWN shared-secret check is what actually gates access. Verify:
`curl https://<service-url>/health` → `{"status":"ok"}`.

### Render (alternative)

New → **Web Service** → this repo → Root Directory `agent`, Runtime **Docker**.
Add the same env vars. Render provides `PORT` automatically.

### Then point the web app at it (AWS Amplify)

Amplify Console → your app → **Hosting → Environment variables** → Manage
variables → add:

- `COACH_SERVICE_URL` = `https://<your-cloud-run-url>` (no trailing slash)
- `COACH_SHARED_SECRET` = the **same** value the sidecar runs with

Two Amplify-specific gotchas:

1. **Scope matters.** Variables can be set per-branch or for "All branches". If
   you set them on `main` only, preview branches won't have them.
2. **You must redeploy.** Env vars are baked in at build time, so saving them
   does not change the running app — trigger **Redeploy this version** (or push
   a commit) on the branch you're actually visiting.

Amplify also needs these to reach the *server* runtime, not just the build. They
are read in a route handler (`src/app/api/coach/route.ts`) which runs
server-side, so plain (non-`NEXT_PUBLIC_`) variables are correct — never prefix
these with `NEXT_PUBLIC_`, which would ship the shared secret to the browser.

### Deployment notes

- **Keep the sidecar private.** It holds the service-role key (bypasses RLS).
  The shared secret is the only thing preventing an arbitrary caller from
  passing any `user_id` and reading another user's data. Never set
  `COACH_ENV=development` in production — that's the one flag that allows
  running with auth disabled, and `main.py` otherwise refuses to start.
- **Conversation memory is per-process.** `MemorySaver` (graph.py) is in-memory,
  so redeploys, cold starts, and multiple instances all reset the model's
  recollection. The chat transcript itself is stored client-side and survives.
  Swap in a Postgres checkpointer if durable memory matters.
- **Cold starts.** Scale-to-zero hosts (Cloud Run, Render free) idle out; the first question after a while can be
  slow enough to hit the proxy's 60s timeout. Retrying usually works.

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
