#!/usr/bin/env bash
set -euo pipefail

if ! command -v cloudflared >/dev/null 2>&1; then
  printf '%s\n' "cloudflared is required: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
  exit 1
fi

npm run build
npm run db:migrate:local

LOG_FILE="${TMPDIR:-/tmp}/pulso-wrangler.log"
npx wrangler dev >"$LOG_FILE" 2>&1 &
WORKER_PID=$!

cleanup() {
  kill "$WORKER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8787/api/health >/dev/null 2>&1; then
    exec cloudflared tunnel --url http://127.0.0.1:8787
  fi
  sleep 1
done

printf '%s\n' "The Worker did not start. See $LOG_FILE"
exit 1
