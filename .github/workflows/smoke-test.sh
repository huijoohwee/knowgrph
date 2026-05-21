#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."
KNOWGRPH_AGENT_READY_BASE_URL="${KNOWGRPH_AGENT_READY_BASE_URL:-https://airvio.co/knowgrph}" npm run agent-ready:check
