"""Centralized settings. Reads from the environment / agent/.env.

Keeping model IDs here (not scattered through the code) is what makes the
multi-provider swap in Phase 4 a one-line change: point COACH_MODEL at a
different provider string and every tool/graph keeps working unchanged.
"""
from . import env  # noqa: F401 — side effect: load .env into os.environ before anything reads it
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase — service role, server-side only.
    supabase_url: str
    supabase_service_role_key: str

    # Models, as LangChain provider strings ("provider:model-id").
    # init_chat_model() parses these, so changing the provider is a string edit.
    coach_model: str = "anthropic:claude-opus-4-8"
    judge_model: str = "anthropic:claude-haiku-4-5"

    # ── Hardening knobs (see graph.py / main.py) ──
    # Shared secret the Next.js route must present. Empty = auth disabled (local
    # dev only); main.py refuses to start auth-disabled unless COACH_ENV=development.
    coach_shared_secret: str = ""
    # Kill-switch: set false to disable the LLM path without redeploying.
    coach_enabled: bool = True
    # Comma-separated browser origins allowed to call this service directly.
    # Empty disables CORS entirely (server-to-server only).
    coach_allowed_origins: str = ""
    # Bound the blast radius of one turn on a paid LLM.
    coach_max_tokens: int = 2048          # per-response output cap
    coach_request_timeout: float = 60.0   # seconds per model call
    coach_recursion_limit: int = 12       # max agent<->tools hops before bailing
    coach_max_question_chars: int = 4000  # reject oversized prompts before the model
    # Inline groundedness guard: how many times to regenerate an answer the judge
    # flags as ungrounded before giving up and returning the last attempt. 0 disables.
    coach_grounding_retries: int = 1


settings = Settings()  # raises at import time if a required var is missing — fail fast
