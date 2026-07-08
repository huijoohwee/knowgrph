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
   - Scope: read-only published Source Files retrieval, prompt/resource/template discovery, local UI launch, local pipelines, local superagent harness, approval-gated video-remix run manifests, local browser API bridge, SEA-LION sidecar calls, HTML video rendering, visual annotation, scoped memory, local probe-tree branching, AI Showrunner dry-runs, zero-token OS status, and vdeoxpln registry inspection
   - Transport: stdio only
   - MCP Apps metadata: advertises the shared `ui://knowgrph/agent-ready` resource, no-auth `securitySchemes`, mirrored `_meta.securitySchemes` for UI-linked tools, and widget-accessibility metadata from the shared contract

2. **Pages HTTP MCP**
   - Owner: `cloudflare/pages/knowgrph-agent-ready.mjs`
   - Scope: read-only published-document MCP on `/knowgrph/mcp`
   - Transport: JSON-RPC over HTTP

3. **Browser WebMCP**
   - Owners:
     - `canvas/src/features/agent-ready/webMcpRuntime.ts`
     - `canvas/src/features/agent-ready/knowgrphAgentReadyToolContract.mjs`
   - Scope: read-only browser tool registration for published Source Files reads and browser-local inspection

4. **MainPanel MCP / Integrations readiness**
   - Owners:
     - `canvas/src/features/panels/views/McpHubView.tsx`
     - `canvas/src/features/panels/views/knowgrphToolServerDocs.ts`
     - `canvas/src/features/panels/views/externalMcpToolServerDocs.ts`
     - `canvas/src/features/panels/views/IntegrationsHubView.tsx`
     - `canvas/src/features/panels/views/useSettingsChatAssist.tsx`
   - Scope: shared settings, Knowgrph-owned tool-server readiness, external MCP tool-server readiness, chat readiness, and routing into the FloatingPanel Chat workflow

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

- `search` — searches published Knowgrph Source Files and returns stable `kgdoc:` ids with citation-ready result URLs
- `fetch` — fetches the complete published Source File markdown for an id returned by `search`, returning both `content` and `text`
- `prompts/list` / `prompts/get` — expose read-only prompt templates that guide MCP hosts to use `search`/`fetch` or `inspect_agent_surface`; prompts do not introduce a second execution path
- `resources/templates/list` — exposes the shared `kgdoc://source-file/{id}` template for Source Files returned by `search`
- `resources/read` — reads either `ui://knowgrph/agent-ready` as MCP Apps HTML or `kgdoc://source-file/{id}` as Source Files `text/markdown` through the existing `fetch` executor
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
   - Typical use: run the Codex-compatible long-horizon SuperAgent harness for research, code, and create tasks across `quick_triage`, `bounded_compile`, `deep_research`, and `parallel_build` levels. The run uses native memory, role-scoped subagents, `skill.select`, `research.scout`, `code.write_and_run`, bounded generated-code sandbox artifacts, default `providerMode="byteplus-modelark"` placeholder media metadata, optional deterministic `mock` mode, and Codex-facing BytePlus ModelArk remote MCP guidance for image/audio-in-video/video generation.
   - Emits: `state.json`, `trace.jsonl`, `goal.json`, `harness-proof.json`, `final-report.md`, selected-skill/research/code/sandbox artifacts, `artifacts/canvas/canvas.graph.json`, and `artifacts/workspace/rich-media-flow.md`
4. SEA-LION sidecar tools
   - `sealion.detect_language_variant` detects language, regional variant, register, and code-switching before Southeast Asian language routing
   - `sealion.translate_localize` returns translation plus localization notes through the hosted sidecar with server-owned auth
   - `sealion.safety_check` returns advisory SEA-Guard safety classification through the same sidecar boundary
5. `knowgrph.video_remix.run`
   - Produces an approval-gated video-remix run manifest for `referenceUrl`, `brief`, `sourceCards`, budget meters, storyboard flow, render/checkout gates, demo-pack coverage, and bounded failure handling
   - `mode="live"` without approval tokens returns `state="blocked"`, at least five approval gates, zero estimated cost, and no provider execution log entries
   - Research evidence is source-card driven in the local runtime; it never fabricates Exa results or calls paid providers during local validation
   - Storyboard output emits `kgc-computing-flow/v1` Markdown with one flow node per planned shot
6. `knowgrph.browser_api.run`
   - Calls a configurable local API-native browser runtime, using an Unbrowse-compatible shape without copying its implementation
   - Typical use: health-check the runtime, search/resolve first-party browser API routes, list cached skills, login through a local browser session, run guarded cookie import, send feedback/verification, execute a resolved route with `dryRun=true` by default, or fall back to native browser capture/action operations such as `go`, `snap`, `click`, `fill`, `screenshot`, `text`, `markdown`, `sync`, and `close`
   - Default runtime URL: `http://localhost:6969` or `KNOWGRPH_BROWSER_API_RUNTIME_URL`; non-loopback hosts are rejected unless `KNOWGRPH_BROWSER_API_ALLOW_REMOTE_RUNTIME=1` is set on the MCP server
   - Browser target URLs are normalized before runtime calls; only `http` and `https` targets without embedded credentials are forwarded
7. `knowgrph.html_video.render`
   - Accepts HTML, CSS, JSON data, duration, fps, width, height, and optional `engine_hint` for a local HTML-to-video render request
   - Resolves the active engine from `engine_hint` or `KNOWGRPH_HTML_VIDEO_ENGINE`; missing or unregistered engines return `engine_not_configured` without falling back to a hardcoded renderer
   - Recommended no-install Dev smoke path: register/select `canvas-2d`; it uses browser canvas capture plus native `MediaRecorder` to produce the browser-supported video container without a system FFmpeg binary or imported muxer
   - The native `headless-browser` adapter is inspired by Hyperframes without copying it: Playwright captures seeked HTML frames and an operator-provided FFmpeg binary encodes MP4
   - Runtime knobs: `KNOWGRPH_HTML_VIDEO_FFMPEG_BIN` (default `ffmpeg`), `KNOWGRPH_HTML_VIDEO_FFMPEG_VIDEO_CODEC` (default `mpeg4` to avoid forcing GPL codecs), and `KNOWGRPH_HTML_VIDEO_MAX_FRAMES` (safety bound)
   - The browser Storyboard Widget path writes successful video results through `writeRichMediaWidgetRunOutputArtifact` and the existing Source Files/rich-media manifest owner
8. Visual annotation tools
   - `knowgrph.annotate.image` accepts `asset_url`, 1-6 annotation `tasks`, and optional `model_hint`
   - `knowgrph.annotate.video_frame` also requires `frame_timestamp_ms` and keeps frame extraction browser-local
   - Outputs are LLM-ready annotation JSON with deterministic `annotation_id`; validation/runtime failures return structured `invalid_spec`, `model_not_configured`, `worker_not_supported`, or `inference_failed` errors
   - Native dataset operators load annotation results or frame-box arrays, split/merge/save deterministic JSON datasets, and build frame-ordered zone-count timelines for live panel projection
   - Dev default adds no external dependency and no paid inference path; the browser worker emits runtime-local heuristic annotations while model adapters remain runtime-owned behind the `Annotation_Worker` boundary
9. Memory layer tools
   - `knowgrph.memory.add` persists explicitly scoped memory text or messages through the provider-neutral memory harness
   - `knowgrph.memory.search` returns top-K scoped memory results for prompt augmentation
   - `knowgrph.memory.assemble_prompt` injects ranked memory results into a bounded `## Relevant Context` system-message section
   - Dev default uses local JSON storage at `KNOWGRPH_MEMORY_STORE_PATH` or `data/memory-layer/local-memory-store.json`; Mem0 credentials and provider config remain host-owned runtime inputs
10. Probe-tree tools
   - `knowgrph.probe.generate` recalls scoped resolved-path exemplars and returns at most four typed candidate next questions without mutating the current node; `token_budget` is enforced before a local model call, trimming recalled exemplars first and degrading to local heuristic options when the request would exceed budget
   - `knowgrph.probe.select` persists a user-selected option as a fresh `type: probe` markdown node with an embedded `branches-to` edge and checkpoint fork metadata under `data/probe-tree`
   - `knowgrph.probe.select` output is frontmatter-flow parseable, so the existing canvas/sync parser can project the new `type: probe` node and `branches-to` edge without a probe-specific renderer
   - `knowgrph.probe.evolve` scores a resolved branch path and writes one reusable exemplar through the existing memory layer; incomplete parent paths are surfaced unless `allow_partial_path` is explicitly set
   - `knowgrph.probe.generate` can call a host-owned local Ollama runtime when `KNOWGRPH_PROBE_TREE_MODEL` is set; it uses non-streaming structured JSON output and falls back to local heuristic options when the adapter is unconfigured or fails
   - The local runtime keeps markdown as the graph SSOT; native LangGraph checkpoint persistence remains a follow-on adapter path rather than a second datastore
11. AI Showrunner tools
   - `knowgrph.showrunner.start_run` validates a Creative_Brief and starts a bounded dry-run or approval-gated Pipeline_Run
   - `knowgrph.showrunner.run_status` reads lifecycle state without mutating Creative_State
   - `knowgrph.showrunner.post_choice`, `knowgrph.showrunner.submit_critique`, and `knowgrph.showrunner.approve_stage` route explicit user/operator events through the showrunner message bus
   - `knowgrph.showrunner.get_artifact` returns a Source_File path for an existing run artifact without triggering new turns
12. `knowgrph.os.status`
   - Returns zero-token Agentic OS views for process state, capability catalogs, cost summary, approval gates, and circuit breakers
   - Optional remote MCP catalog discovery reports unavailable endpoints as status data rather than blocking local stdio readiness
13. `knowgrph.vdeoxpln.list`
   - Reads the canonical Knowgrph vdeoxpln registry from `canvas/src/features/agent-ready/knowgrphVdeoxplnContract.mjs`
   - Typical use: inspect vdeoxpln ids, semantic keys, source owners, local MCP/WebMCP/Pages tool projections, publish scopes, validation commands, optional generated `SKILL.md`-style Markdown, and a neutral intent/state routing plan
   - Routing ignores route names, file names, absolute paths, and URLs. Mutating browser-local vdeoxpln workflows still run through the existing MainPanel -> FloatingPanel Chat -> Workspace FS -> Source Files -> KGC -> Canvas path, with a source-backed run manifest persisted beside KGC workspace output.

All shipped local read-only Source Files tools declare no-auth `securitySchemes`. The UI-linked `knowgrph.vdeoxpln.list` tool also mirrors that scheme in `_meta.securitySchemes`, links `_meta.ui.resourceUri` to `ui://knowgrph/agent-ready`, and sets `_meta["openai/widgetAccessible"]` so Apps-capable hosts can let the resource call back through the MCP tool bridge. Resource templates are served through the standard MCP `resources` capability; Knowgrph does not define a custom resource-template capability.

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
- vdeoxpln routing prompt from the canonical registry
- KGC recovery and validation
- Workspace FS vdeoxpln run manifest and Source Files materialization
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
    "knowgrph": {
      "command": "node",
      "args": ["/ABS/PATH/TO/KNOWGRPH/mcp/server.js"],
      "env": {
        "KNOWGRPH_ROOT": "/ABS/PATH/TO/KNOWGRPH",
        "KNOWGRPH_PYTHON": "/ABS/PATH/TO/PYTHON",
        "KNOWGRPH_MCP_TIMEOUT_MS": "600000"
      }
    }
  }
}
```

Optional tool-specific host env remains server-owned, for example `KNOWGRPH_MEMORY_STORE_PATH`,
`KNOWGRPH_BROWSER_API_RUNTIME_URL`, `KNOWGRPH_PROBE_TREE_MODEL`, and
`KNOWGRPH_PROBE_TREE_MODEL_URL`.

Then you can call:

- `search` with `{ "query": "renderer architecture", "limit": 10 }`
- `fetch` with `{ "id": "kgdoc::docs%2Fexample.md" }`
- `knowgrph.ui.launch` with `{ "target": "workspaceEditor" }` (or `canvas` / `geospatial`)
- `knowgrph.pipeline` with `{ "mode": "pipeline", "inputPath": "data/outputs/graph.json", "outputDir": "data/outputs" }`
- `knowgrph.graphrag_pipeline` with `{ "inputDir": "data/raw", "outDir": "data/graphrag" }`
- `knowgrph.superagent.run` with `{ "inputPath": "docs/documents/my-input.md", "outputDir": "data/outputs/superagent-neutral-example", "runId": "superagent-neutral-example", "providerMode": "mock" }`
- `sealion.detect_language_variant` with `{ "text": "Saya nak buat onboarding agent untuk pengguna Singapura." }`
- `knowgrph.probe.generate` with `{ "thread_root_id": "support-intake", "current_node_id": "root", "context_text": "User needs help but has not stated constraints", "k": 3, "token_budget": 1200 }`
- `knowgrph.probe.select` with `{ "thread_root_id": "support-intake", "parent_node_id": "root", "chosen_option": { "id": "o1", "text": "Which constraint matters most right now?", "rationale": "Narrow the branch before handoff" } }`
- `knowgrph.probe.evolve` with `{ "thread_root_id": "support-intake", "terminal_node_id": "probe_node_...", "rating": 1 }`
- `knowgrph.video_remix.run` with `{ "mode": "live", "referenceUrl": "https://example.com/reference-video", "brief": "Remix this into a sellable launch teaser", "budgetUsd": 20 }`
- `knowgrph.video_remix.run` with `{ "mode": "live", "referenceUrl": "https://example.com/reference-video", "brief": "Remix this into a sellable launch teaser", "approvals": ["paid-model-call", "render-action", "payment-action", "cloud-deploy"], "sourceCards": [{ "url": "https://example.com/a" }, { "url": "https://example.com/b" }, { "url": "https://example.com/c" }] }`
- `knowgrph.browser_api.run` with `{ "operation": "resolve", "targetUrl": "<TARGET_URL>", "intent": "find the current account profile JSON endpoint" }`
- `knowgrph.browser_api.run` with `{ "operation": "execute", "skillId": "resolved-skill-id", "payload": {}, "dryRun": true, "confirmUnsafe": false, "confirmThirdPartyTerms": false }`
- `knowgrph.browser_api.run` with `{ "operation": "cookieImport", "targetUrl": "<TARGET_URL>", "dryRun": false, "confirmCookieImport": true, "confirmUnsafe": true, "confirmThirdPartyTerms": true }`
- `knowgrph.browser_api.run` with `{ "operation": "click", "sessionId": "session-id", "selector": "#submit", "dryRun": false, "confirmUnsafe": true }`
- `knowgrph.memory.add` with `{ "text": "Prefer local-first memory and operator-gated deploys.", "user_id": "runtime-user-id", "metadata": { "memory_key": "deployment-boundary" } }`
- `knowgrph.memory.search` with `{ "query": "Should deploys happen automatically?", "user_id": "runtime-user-id", "top_k": 3 }`
- `knowgrph.memory.assemble_prompt` with `{ "base_system_message": "Answer directly.", "memories": [{ "id": "memory-id", "memory": "Prefer local-first memory.", "score": 1, "created_at": "2026-06-13T00:00:00.000Z" }], "max_memory_tokens": 80 }`
- `knowgrph.showrunner.start_run` with `{ "brief_markdown": "---\\ncontract: knowgrph-showrunner-brief/v1\\n---\\n# Brief\\nDry-run a branching podcast pilot.", "dry_run": true }`
- `knowgrph.os.status` with `{ "view": "capabilities" }`
- `knowgrph.vdeoxpln.list` with `{ "includeMarkdown": true }`

## Relationship to MainPanel MCP

MainPanel `mcp` can show readiness and configuration snippets for external MCP surfaces such as:

- Knowgrph Tool Servers for external users connecting an agent to tools inside Knowgrph through local stdio (`mcp/server.js`) or read-only Pages HTTP (`search` / `fetch`) placeholders
- External MCP Tool Servers with provider-neutral stdio and Streamable HTTP templates, host-owned secrets, session-scoped allowlists, zero-token discovery, and deferred `knowgrph.tool.search` / `knowgrph.tool.describe` / `knowgrph.tool.call` schema access
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
