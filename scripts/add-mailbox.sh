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

AUTH="Basic REDACTED_AUTH="
API_URL="http://127.0.0.1:8085/api/principal"

# 1. Create principal
curl -sf -u admin:REDACTED_PASSWORD -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"$EMAIL\", \"type\": \"individual\", \"emails\": [\"$EMAIL\"], \"roles\": [\"user\"]}" > /dev/null

# 2. Set secret
curl -sf -u admin:REDACTED_PASSWORD -X PATCH "$API_URL/$EMAIL" \
  -H "Content-Type: application/json" \
  -d "[{\"action\": \"set\", \"field\": \"secrets\", \"value\": [\"$PASSWORD\"]}]" > /dev/null

echo "✅ Postfach erfolgreich angelegt: $EMAIL"
echo "🔑 Passwort: $PASSWORD"
