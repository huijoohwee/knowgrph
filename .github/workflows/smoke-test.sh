#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."
npm run smoke:prepare
# Release readiness excludes the operator-owned x402 wallet gate while the
# default agent-ready check continues to enforce it for commerce readiness.
for attempt in 1 2 3 4 5; do
  if KNOWGRPH_AGENT_READY_BASE_URL="${KNOWGRPH_AGENT_READY_BASE_URL:-https://airvio.co/knowgrph}" \
    KNOWGRPH_AGENT_READY_INCLUDE_X402=false \
    npm run agent-ready:check; then
    exit 0
  fi
  if [[ "$attempt" == "5" ]]; then
    exit 1
  fi
  echo "[knowgrph] release smoke attempt $attempt failed; retrying after Pages propagation"
  sleep 15
done
