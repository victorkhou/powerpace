#!/usr/bin/env bash
# Securely write the three secret values into agent/.env.
# Prompts with hidden input (read -s) so nothing is echoed or saved to shell history.
# Run from the agent/ directory:  bash set-secrets.sh
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo "agent/.env not found. Run 'cp .env.example .env' first."
  exit 1
fi

# set_secret KEY "human label"
set_secret() {
  local key="$1" label="$2" value
  printf '%s: ' "$label"
  read -rs value
  echo
  if [[ -z "$value" ]]; then
    echo "  (skipped — left unchanged)"
    return
  fi
  # Escape characters that are special to sed's replacement.
  local esc
  esc=$(printf '%s' "$value" | sed -e 's/[\/&|]/\\&/g')
  # Use | as the delimiter since keys/values won't contain it after escaping.
  sed -i '' "s|^${key}=.*|${key}=${esc}|" .env
  echo "  ✓ ${key} saved"
}

echo "Paste each secret (input is hidden). Press Enter on an empty line to skip one."
echo
set_secret SUPABASE_SERVICE_ROLE_KEY "Supabase service_role key"
set_secret ANTHROPIC_API_KEY         "Anthropic API key (sk-ant-...)"
set_secret LANGSMITH_API_KEY         "LangSmith API key (lsv2_...)"
echo
echo "Done. Verify with:  bash check-env.sh"
