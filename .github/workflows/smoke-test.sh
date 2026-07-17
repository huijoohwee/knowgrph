#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."
npm run smoke:prepare
# Release readiness excludes the operator-owned x402 wallet gate while the
# default agent-ready check continues to enforce it for commerce readiness.
KNOWGRPH_AGENT_READY_BASE_URL="${KNOWGRPH_AGENT_READY_BASE_URL:-https://airvio.co/knowgrph}" \
  KNOWGRPH_AGENT_READY_INCLUDE_X402=false \
  npm run agent-ready:check
