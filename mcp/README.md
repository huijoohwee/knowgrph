# Knowgrph MCP Server (stdio)

This folder provides a **minimal MCP server** that exposes core `knowgrph_parser` commands as MCP tools, so external users can operate Knowgrph from **any MCP client** (Claude Desktop, Claude Code, Cursor, etc.).

## Why recommend ClawdChat (clawdchat.cn)?

If you want external users to *discover* and *try* your Knowgrph MCP quickly, **ClawdChat** is useful as:

1. **Distribution & discovery**: you can publish a public Agent profile, posts, and tutorials that point to your MCP server.
2. **MCP-native ecosystem**: ClawdChat provides an official MCP server (`clawdchat-mcp`) so users already in MCP clients can interact with the ClawdChat network and your announcements in the same workflow.

ClawdChat itself is not required to run Knowgrph—your users still connect to **your Knowgrph MCP server** from their MCP client.

## What tools are exposed?

### UI launcher

- `knowgrph.ui.launch` — starts the **Canvas Vite dev server** and returns a mode-specific URL:
  - `target=canvas` → normal Canvas
  - `target=workspaceEditor` → opens Workspace Editor (`?openEditorWorkspace=1`)
  - `target=geospatial` → enables Geospatial overlay (`?kgGeo=1`, DEV behavior)
- `knowgrph.ui.stop` — stops the dev server started by `knowgrph.ui.launch`

### Pipeline / data tools

1. `knowgrph.pipeline`
   - Runs: `python -m knowgrph_parser pipeline ...`
   - Typical use: convert GraphData JSON → A0 CSV/JSON-LD + codebase-index artifacts
2. `knowgrph.graphrag_pipeline`
   - Runs: `python -m knowgrph_parser graphrag-pipeline ...`
   - Typical use: generate GraphData + A0 exports from a GraphRAG indexing run
3. `knowgrph.superagent.run`
   - Runs: `python -m knowgrph_parser superagent ...`
   - Typical use: run the Codex-compatible rich media super-agent harness with deterministic mock text/image/video providers
   - Emits: `state.json`, `trace.jsonl`, `final-report.md`, `artifacts/canvas/canvas.graph.json`, and `artifacts/workspace/rich-media-flow.md`
4. `knowgrph.browser_api.run`
   - Calls a configurable local API-native browser runtime, using an Unbrowse-compatible shape without copying its implementation
   - Typical use: health-check the runtime, search/resolve first-party browser API routes, list cached skills, login through a local browser session, run guarded cookie import, send feedback/verification, execute a resolved route with `dryRun=true` by default, or fall back to native browser capture/action operations such as `go`, `snap`, `click`, `fill`, `screenshot`, `text`, `markdown`, `sync`, and `close`
   - Default runtime URL: `http://localhost:6969` or `KNOWGRPH_BROWSER_API_RUNTIME_URL`; non-loopback hosts are rejected unless `KNOWGRPH_BROWSER_API_ALLOW_REMOTE_RUNTIME=1` is set on the MCP server

## Install (external users)

From the repo root:

```bash
# 1) Python deps (required)
python3.11 -m venv .venv
./.venv/bin/python -m pip install --upgrade pip
./.venv/bin/python -m pip install -r requirements.txt

# 2) Node deps for MCP server
npm --prefix mcp install
```

## Run locally (smoke test)

```bash
KNOWGRPH_ROOT="$(pwd)" KNOWGRPH_PYTHON="./.venv/bin/python" node ./mcp/server.js
```

## Configure in an MCP client (stdio)

### Claude Desktop / Cursor

Add a server entry similar to:

```json
{
  "mcpServers": {
    "api-native-browser-bridge": {
      "command": "node",
      "args": ["/ABS/PATH/TO/LOCAL_MCP_SERVER.js"],
      "env": {
        "KNOWGRPH_ROOT": "/ABS/PATH/TO/WORKSPACE_ROOT",
        "KNOWGRPH_PYTHON": "/ABS/PATH/TO/PYTHON",
        "KNOWGRPH_MCP_TIMEOUT_MS": "600000",
        "KNOWGRPH_BROWSER_API_RUNTIME_URL": "http://localhost:6969"
      }
    }
  }
}
```

Then you can call:

- `knowgrph.ui.launch` with `{ "target": "workspaceEditor" }` (or `canvas` / `geospatial`)
- `knowgrph.pipeline` with `{ "mode": "pipeline", "inputPath": "data/outputs/graph.json", "outputDir": "data/outputs" }`
- `knowgrph.graphrag_pipeline` with `{ "inputDir": "data/raw", "outDir": "data/graphrag" }`
- `knowgrph.superagent.run` with `{ "inputPath": "knowgrph_parser/fixtures/superagent-neutral.md", "outputDir": "data/outputs/superagent-neutral-example", "runId": "superagent-neutral-example" }`
- `knowgrph.browser_api.run` with `{ "operation": "resolve", "targetUrl": "<TARGET_URL>", "intent": "find the current account profile JSON endpoint" }`
- `knowgrph.browser_api.run` with `{ "operation": "execute", "skillId": "resolved-skill-id", "payload": {}, "dryRun": true, "confirmUnsafe": false, "confirmThirdPartyTerms": false }`
- `knowgrph.browser_api.run` with `{ "operation": "cookieImport", "targetUrl": "<TARGET_URL>", "dryRun": false, "confirmCookieImport": true, "confirmUnsafe": true, "confirmThirdPartyTerms": true }`
- `knowgrph.browser_api.run` with `{ "operation": "click", "sessionId": "session-id", "selector": "#submit", "dryRun": false, "confirmUnsafe": true }`

### Direct API-native browser MCP config

If an agent should connect to the browser runtime MCP directly instead of going through Knowgrph, MainPanel MCP also exposes a direct `mcpServers` snippet shaped like:

```json
{
  "mcpServers": {
    "api-native-browser": {
      "command": "npx",
      "args": ["-y", "unbrowse", "mcp"],
      "env": {
        "UNBROWSE_URL": "http://localhost:6969"
      }
    }
  }
}
```

## Security / sandboxing

By default, tool path arguments are restricted to **inside `KNOWGRPH_ROOT`**. This prevents accidental reads/writes outside the repo.

If you truly need to allow external paths, set:

```bash
KNOWGRPH_ALLOW_EXTERNAL_PATHS=1
```
