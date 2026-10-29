#!/usr/bin/env bash
# scripts/add-mailbox.sh
# Adds a new mailbox to Stalwart Mail Server on mail.abgabestellen.app
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <email-address> [password]"
  echo "Example: $0 koeln@abgabestellen.app"
  exit 1
fi

EMAIL="$1"
PASSWORD="${2:-}"

if [ -z "$PASSWORD" ]; then
  PASSWORD=$(openssl rand -base64 18 | tr -dc 'a-zA-Z0-9!#%*+,-.=?@_' | head -c 24)
fi

# Load environment variables from .env if present
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/../.env" ]; then
  # shellcheck disable=SC2046
  export $(grep -E '^STALWART_' "$SCRIPT_DIR/../.env" | xargs) 2>/dev/null || true
fi

STALWART_ADMIN_USER="${STALWART_ADMIN_USER:-admin}"
STALWART_ADMIN_SECRET="${STALWART_ADMIN_SECRET:-}"

if [ -z "$STALWART_ADMIN_SECRET" ]; then
  echo "❌ FEHLER: STALWART_ADMIN_SECRET ist weder in der Umgebung noch in .env definiert." >&2
  exit 1
fi

API_URL="${STALWART_API_URL:-http://127.0.0.1:8085/api/principal}"

# 1. Create principal
curl -sf -u "${STALWART_ADMIN_USER}:${STALWART_ADMIN_SECRET}" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"$EMAIL\", \"type\": \"individual\", \"emails\": [\"$EMAIL\"], \"roles\": [\"user\"]}" > /dev/null

# 2. Set secret
curl -sf -u "${STALWART_ADMIN_USER}:${STALWART_ADMIN_SECRET}" -X PATCH "$API_URL/$EMAIL" \
  -H "Content-Type: application/json" \
  -d "[{\"action\": \"set\", \"field\": \"secrets\", \"value\": [\"$PASSWORD\"]}]" > /dev/null

echo "✅ Postfach erfolgreich angelegt: $EMAIL"
echo "🔑 Passwort: $PASSWORD"
