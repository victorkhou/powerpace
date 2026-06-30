"""Load agent/.env into os.environ — import this FIRST, before any SDK.

Why this exists: init_chat_model (Anthropic SDK) and LangSmith read their keys
straight from os.environ, not from our pydantic Settings object. pydantic-settings
only populates the fields we declare in config.py; it does not export anything to
the process environment. So without this, ANTHROPIC_API_KEY / LANGSMITH_* are
invisible to those SDKs even though they're in the file.

Importing this module runs load_dotenv() as a side effect, populating os.environ
for every library that expects it.
"""
from pathlib import Path

from dotenv import load_dotenv

# agent/.env lives one level up from this app/ package.
_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_ENV_PATH)
