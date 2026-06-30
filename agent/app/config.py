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


settings = Settings()  # raises at import time if a required var is missing — fail fast
