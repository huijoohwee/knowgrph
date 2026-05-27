---
title: "Knowgrph MCP Server (stdio)"
doc_type: "Subsystem README"
status: "active"
lang: "en-US"
frontmatter_contract: "required"
---

# Knowgrph MCP Server (stdio)

## Authoring Contract

- The opening YAML frontmatter block remains the first-block machine SSOT for subsystem metadata, transport scope, and runtime context for this MCP README.
- This document is a canonical authored subsystem README, not a generated registry surface or typed validation fixture.
- Frontmatter stays in plain YAML so the file demonstrates the default authoring path for MCP subsystem docs, transport boundaries, and operator guidance.
- If typed `{key, type, value}` envelopes are needed for ingest -> parse -> render validation, that coverage should live in a dedicated fixture doc rather than replacing canonical subsystem prose.
- Runtime guidance and surface-separation rules must still be derived from parsed frontmatter and document content only, never from file path assumptions or downstream mirrors.

This folder provides the **local stdio MCP server** for Knowgrph. It exposes core local
`knowgrph_parser` and browser-bridge commands as MCP tools so users can operate Knowgrph from
**any stdio-capable MCP client** (Claude Desktop, Claude Code, Cursor, etc.).

## Surface separation

This README documents **only** the shipped local stdio MCP server in `mcp/server.js`.

It is intentionally distinct from the other shipped Knowgrph MCP-ready surfaces:

1. **Local stdio MCP**
   - Owners:
     - `mcp/server.js`
     - `mcp/local-tool-contract.js`
   - Scope: local UI launch, local pipelines, local superagent harness, local browser API bridge
   - Transport: stdio only

2. **Pages HTTP MCP**
   - Owner: `cloudflare/pages/knowgrph-agent-ready.mjs`
   - Scope: read-only published-document MCP on `/knowgrph/mcp`
   - Transport: JSON-RPC over HTTP

3. **Browser WebMCP**
   - Owners:
     - `canvas/src/features/agent-ready/webMcpRuntime.ts`
     - `canvas/src/features/agent-ready/knowgrphAgentReadyToolContract.mjs`
   - Scope: read-only browser tool registration for published Source Files reads

4. **MainPanel MCP / Integrations readiness**
   - Owners:
     - `canvas/src/features/panels/views/McpHubView.tsx`
     - `canvas/src/features/panels/views/IntegrationsHubView.tsx`
     - `canvas/src/features/panels/views/useSettingsChatAssist.tsx`
   - Scope: shared settings, chat readiness, and routing into the FloatingPanel Chat workflow

Do not conflate this local stdio server with the deployed read-only Pages/browser MCP surfaces or
with any future remote Worker MCP platform proposed elsewhere in the docs.

## Canonical docs

For the repo-accurate MCP architecture and roadmap, see:

- `docs/documents/knowgrph-mcp/knowgrph-mcp.md`
- `docs/documents/knowgrph-mcp/knowgrph-mcp-service-prd-tad.md`
- `docs/documents/knowgrph-mcp/knowgrph-mcp-service-prd-tad.companion.md`

## Why recommend ClawdChat (clawdchat.cn)?

If you want external users to *discover* and *try* your Knowgrph MCP quickly, **ClawdChat** is useful as:

1. **Distribution & discovery**: you can publish a public Agent profile, posts, and tutorials that point to your MCP server.
2. **MCP-native ecosystem**: ClawdChat provides an official MCP server (`clawdchat-mcp`) so users already in MCP clients can interact with the ClawdChat network and your announcements in the same workflow.

ClawdChat itself is not required to run Knowgrph—your users still connect to **your Knowgrph MCP server** from their MCP client.

## What tools are exposed?

Canonical local tool inventory owner:

- `mcp/local-tool-contract.js`

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
   - Typical use: run the Codex-compatible rich media super-agent harness with deterministic mock text/image providers plus either mock video or `provider_mode=pixverse` through local PixVerse MCP stdio, constrained additive `fusion_video`, bounded polling, optional additive `lip_sync_video` on generated clips or uploaded `video_media_id` in TTS mode plus custom-audio on generated clips and uploaded videos, automated local uploaded-media handoff, optional `sound_effect_video` on generated clips or uploaded `video_media_id`, and mock fallback
   - Emits: `state.json`, `trace.jsonl`, `final-report.md`, `artifacts/canvas/canvas.graph.json`, and `artifacts/workspace/rich-media-flow.md`
4. `knowgrph.browser_api.run`
   - Calls a configurable local API-native browser runtime, using an Unbrowse-compatible shape without copying its implementation
   - Typical use: health-check the runtime, search/resolve first-party browser API routes, list cached skills, login through a local browser session, run guarded cookie import, send feedback/verification, execute a resolved route with `dryRun=true` by default, or fall back to native browser capture/action operations such as `go`, `snap`, `click`, `fill`, `screenshot`, `text`, `markdown`, `sync`, and `close`
   - Default runtime URL: `http://localhost:6969` or `KNOWGRPH_BROWSER_API_RUNTIME_URL`; non-loopback hosts are rejected unless `KNOWGRPH_BROWSER_API_ALLOW_REMOTE_RUNTIME=1` is set on the MCP server

## What this README does not claim

This local README does **not** claim that the following are implemented in `mcp/server.js`:

- remote HTTP MCP transport for the local stdio tool set
- deployed mutating graph or pipeline tools on Cloudflare Pages
- a server-side D1 shadow graph for the browser canvas pipeline
- a second MCP-only graph materialization path outside the current FloatingPanel Chat ->
  YAML frontmatter -> Canvas apply flow

The current browser-local E2E path remains:

- MainPanel `mcp` / `integrations`
- shared settings and chat readiness
- FloatingPanel Chat submit helpers
- KGC recovery and validation
- `applyChatKgcWorkspaceDocumentToCanvas()`
- `setActiveMarkdownDocument({ applyToGraph: true })`
- frontmatter-flow parsing and downstream subgraph/group projection

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

## Relationship to MainPanel MCP

MainPanel `mcp` can show readiness and configuration snippets for external MCP surfaces such as:

- Stripe MCP readiness
- crawler access MCP readiness
- direct API-native browser MCP snippets

That MainPanel documentation layer does **not** replace this local stdio server. Instead:

- MainPanel readiness docs explain how to connect supported MCP surfaces
- this README explains how to run the local `mcp/server.js` server itself
- the richer browser-local Chat -> KGC -> Canvas pipeline stays owned by the canvas chat and parser
  helpers, not by a duplicate MCP-only pipeline

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
