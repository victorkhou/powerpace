#!/usr/bin/env bash
# Report which agent/.env fields are filled vs still placeholders. Masks all values.
set -euo pipefail
cd "$(dirname "$0")"

echo "=== agent/.env status (values masked) ==="
while IFS= read -r line; do
  case "$line" in ''|\#*) continue;; esac
  key="${line%%=*}"; val="${line#*=}"
  case "$val" in
    ''|'https://your-project.supabase.co'|'your-service-role-key'|'sk-ant-...'|'lsv2_...')
      echo "  NEEDS VALUE  -> $key" ;;
    *) echo "  filled       -> $key" ;;
  esac
done < .env
