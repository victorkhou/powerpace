"""Test setup: make the suite hermetic — no real secrets, no DB, no network.

These env vars are set BEFORE any `app`/`evals` import. `app.env.load_dotenv`
does not override already-set environment variables, so these dummies win even
when a real agent/.env exists locally — and they're all that's needed in CI.
"""
import os

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-test")
os.environ.setdefault("LANGSMITH_TRACING", "false")
os.environ.setdefault("COACH_ENV", "development")  # allow auth-disabled startup
