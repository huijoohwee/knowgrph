#!/usr/bin/env bash
set -euo pipefail

# Publishes Knowgrph Canvas to Cloudflare Pages content folder:
#   knowgrph/canvas/dist -> huijoohwee/content/knowgrph
#
# Usage (from /GitHub/knowgrph):
#   ./scripts/publish-to-huijoohwee.sh
#
# Notes:
# - Builds with BASE path /knowgrph/ (for airvio.co/knowgrph).
# - Skips docs generation (python deps) to keep the publish step lean.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CANVAS_DIR="${ROOT_DIR}/canvas"

export VITE_BASE_PATH="${VITE_BASE_PATH:-/knowgrph/}"
export KG_SKIP_DOCS_UPDATE="${KG_SKIP_DOCS_UPDATE:-1}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

echo "[knowgrph] installing deps (canvas)..."
npm --prefix "${CANVAS_DIR}" install --no-audit --no-fund

echo "[knowgrph] rebuilding native deps (esbuild)..."
npm --prefix "${CANVAS_DIR}" rebuild esbuild || true

echo "[knowgrph] building (canvas) with base=${VITE_BASE_PATH}..."
npm --prefix "${CANVAS_DIR}" run build

echo "[knowgrph] syncing dist -> huijoohwee/content/knowgrph..."
node "${ROOT_DIR}/scripts/sync-pages-knowgrph.mjs"

echo "[knowgrph] done. Now commit+push in the huijoohwee repo:"
echo "  cd ../huijoohwee && git add content/knowgrph _redirects _headers && git commit -m \"Publish knowgrph\" && git push"

