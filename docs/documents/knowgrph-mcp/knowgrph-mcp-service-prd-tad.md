---
title: Knowgrph MCP Service - PRD & TAD
id: md:knowgrph-mcp-service-prd-tad-proposed
author: joohwee
date: 2026-05-20
updated: 2026-05-23
version: 0.4.14
status: proposed
kgDocumentSemanticMode: document
kgFrontmatterModeEnabled: true
kgCanvasSurfaceMode: 2d
kgCanvas2dRenderer: flowEditor
kgDocumentStructureBaselineLock: false
kgSchema: kgc-computing-flow/v1
traceability:
  prd: PRD-MCP
  tad: TAD-MCP
  repo: huijoohwee/knowgrph
  repoPath: mcp/
linkedDocs:
  - "{{md:knowgrph-agent-ready-prd-tad-proposed}}"
  - "{{md:knowgrph-llm-prompt-contract-prd-tad-proposed}}"
  - "{{md:kgc-ai-pipeline-prd-tad}}"
changelog:
  - version: 0.4.14
    date: 2026-05-23
    summary: >
      Added browser-local `inspect_local_settings_chat_readiness` plus chat
      pipeline validation/finalize/apply diagnostics so WebMCP covers the real
      Settings -> FloatingPanel Chat -> YAML frontmatter -> Canvas readiness
      seams without adding a second mutating MCP pipeline.
  - version: 0.4.13
    date: 2026-05-23
    summary: >
      Added browser-local WebMCP inspection tools for MainPanel state, Editor
      Workspace and Markdown pane state, and FloatingPanel chat pipeline state
      so the shipped browser runtime covers the full MainPanel -> FloatingPanel
      Chat -> Editor Workspace -> Canvas inspection chain.
  - version: 0.4.12
    date: 2026-05-23
    summary: >
      Recorded `mcp/local-tool-contract.js` as the shipped local stdio tool
      contract owner and aligned local MCP docs and regression coverage with the
      shared browser bridge tool inventory.
  - version: 0.4.11
    date: 2026-05-23
    summary: >
      Consolidated the overview doc back into the canonical MCP PRD/TAD and
      companion, marked shipped WebMCP readiness as implementation truth instead
      of future work, and aligned stale path references to the canonical files.
  - version: 0.4.10
    date: 2026-05-23
    summary: >
      Tightened the implementation-accurate WebMCP story to include app bootstrap,
      deployed HTML fallback, A2A and agent-skills metadata coverage for the five
      shared tools, and explicit notes that downstream parser compatibility seams
      are not upstream authoring contracts.
  - version: 0.4.9
    date: 2026-05-22
    summary: >
      Added the browser-local `inspect_local_source_files_snapshot` WebMCP tool
      to the app runtime while keeping the shared deployed Pages/HTTP contract
      on the published five-tool read-only surface.
  - version: 0.4.8
    date: 2026-05-22
    summary: >
      Added the browser-local `inspect_local_2d_zoom_viewport` WebMCP tool to
      the app runtime while keeping the shared deployed Pages/HTTP contract on
      the published five-tool read-only surface.
  - version: 0.4.7
    date: 2026-05-22
    summary: >
      Added the browser-local `inspect_local_3d_layout_positions` WebMCP tool
      to the app runtime while keeping the shared deployed Pages/HTTP contract
      on the published five-tool read-only surface.
  - version: 0.4.6
    date: 2026-05-22
    summary: >
      Added the browser-local `inspect_local_3d_camera_pose` WebMCP tool to
      the app runtime while keeping the shared deployed Pages/HTTP contract on
      the published five-tool read-only surface.
  - version: 0.4.5
    date: 2026-05-22
    summary: >
      Added the browser-local `inspect_local_canvas_snapshot` WebMCP tool to
      the app runtime while keeping the shared deployed Pages/HTTP contract on
      the published five-tool read-only surface.
  - version: 0.4.4
    date: 2026-05-22
    summary: >
      Added the browser-local `inspect_local_canvas_topology` WebMCP tool to
      the app runtime while keeping the shared deployed Pages/HTTP contract on
      the published five-tool read-only surface.
  - version: 0.4.3
    date: 2026-05-22
    summary: >
      Added the browser-local `inspect_local_workspace_document` WebMCP tool
      to the app runtime while keeping the shared deployed Pages/HTTP contract
      on the published five-tool read-only surface.
  - version: 0.4.2
    date: 2026-05-22
    summary: >
      Added `inspect_shared_document_structure` to the shipped read-only
      Pages/browser MCP surface so agents can inspect published shared-document
      frontmatter/body structure through the canonical share identity and
      storage-read path.
  - version: 0.4.1
    date: 2026-05-22
    summary: >
      Rebased the PRD/TAD on the real repo: local stdio MCP is shipped,
      Pages/browser read-only MCP is shipped, MainPanel MCP and Integrations are
      shipped as SettingsView shells, and the FloatingPanel Chat to YAML
      frontmatter to Canvas pipeline is shipped in-browser. Removed stale claims
      that nonexistent remote Worker modules or D1 shadow graph services are
      already implemented. Marked WebMCP lifecycle hardening as shipped and
      aligned the browser MCP contract to late binding, `AbortController`
      registration, and localhost/current-origin storage resolution.
---

# Knowgrph MCP Service - PRD & TAD

> **Document type**: Combined PRD + TAD  
> **Phase**: Implementation-aligned baseline plus proposed next phase  
> **Version**: 0.4.14

---

## Executive Summary

This document defines the next MCP phase for Knowgrph, but it starts from the current repo truth instead of older roadmap assumptions.

### Repo Truth Baseline

| Surface | Current state | Canonical owner | Notes |
|---|---|---|---|
| Local stdio MCP server | Shipped | `mcp/server.js` + `mcp/local-tool-contract.js` | `server.js` owns stdio handling; `local-tool-contract.js` owns the shared tool inventory |
| Browser WebMCP | Shipped | `canvas/src/features/agent-ready/webMcpRuntime.ts` | Registers sixteen read-only tools in the app runtime, including browser-local Settings chat readiness, MainPanel, Editor Workspace, chat pipeline, workspace, canvas, 3d, 2d viewport, and Source Files snapshot inspectors |
| Browser WebMCP bootstrap | Shipped | `canvas/src/main.tsx` | Installs WebMCP on page load |
| Pages HTTP MCP | Shipped | `cloudflare/pages/knowgrph-agent-ready.mjs` | JSON-RPC read-only MCP on `/knowgrph/mcp` |
| Pages HTML WebMCP fallback | Shipped | `cloudflare/pages/knowgrph-agent-ready.mjs` | Injects the shared five-tool WebMCP surface on `/knowgrph` HTML routes |
| Agent-ready metadata | Shipped | `cloudflare/pages/knowgrph-agent-ready.mjs` | Health, API catalog, OpenAPI, MCP server card, A2A card, and agent-skills |
| MainPanel `mcp` | Shipped | `canvas/src/features/panels/views/McpHubView.tsx` | Thin `SettingsView mode="mcp"` shell |
| MainPanel `integrations` | Shipped | `canvas/src/features/panels/views/IntegrationsHubView.tsx` | Thin `SettingsView mode="integrations"` shell |
| Shared chat readiness | Shipped | `canvas/src/features/panels/views/useSettingsChatAssist.tsx` | Chat preset, routing, model readiness owner |
| FloatingPanel Chat -> Canvas pipeline | Shipped | `canvas/src/features/chat/*` + parser/store owners | Browser-local validated KGC path |
| Full remote Worker MCP platform | Proposed only | This document | Not implemented in repo today |

### Primary Correction

The repo does **not** currently contain the previously described remote Worker modules such as:

- `cloudflare/workers/mcp-gateway.ts`
- `cloudflare/workers/mcp-router.ts`
- `cloudflare/workers/kgc-pipeline-mcp.ts`
- a shipped D1-backed server shadow graph for the browser pipeline

Those modules remain proposed. Any document or implementation note that treats them as already implemented is stale and forbidden.

### Product Direction

Knowgrph should evolve toward a richer MCP platform, but only by:

- preserving the already shipped stdio server and read-only Pages/browser MCP surfaces as truthful baselines
- keeping current WebMCP readiness implementation-accurate: tool definitions stay shared, typed, page-load installed, and lifecycle-managed through `provideContext({ tools })` and `registerTool(tool, { signal })`
- keeping MainPanel `mcp` and `integrations` as thin shells over shared settings and chat-routing owners
- reusing the shipped FloatingPanel Chat -> KGC validation -> Canvas apply helpers instead of introducing a second MCP-only graph pipeline
- keeping `flow.subgraphs` as the sole upstream grouping authoring surface
- separating shipped implementation from proposed remote-service work at every layer, document, and deploy description

---

## Problem Discovery

### Problem Statement

Knowgrph already exposes useful MCP-ready surfaces, but they are fragmented:

1. `mcp/server.js` is useful for local power users and automation, but it is stdio-only and local-root scoped.
2. `/knowgrph/mcp` and browser WebMCP are deployed and agent-ready, but intentionally limited to read-only published-document tools.
3. MainPanel `mcp` and `integrations` already guide users toward MCP and integration readiness, yet the MCP docs underdescribe how those surfaces feed the richer FloatingPanel Chat -> KGC -> Canvas pipeline.
4. Older MCP proposals blur the line between what is shipped and what is still proposed, which risks duplicate architecture, stale code planning, and downstream patching.

### Desired Outcome

Future MCP work must unify these surfaces into one consistent story:

- local stdio MCP remains the local execution and automation surface
- Pages/browser MCP remains the public read-only discovery and published-doc surface
- MainPanel `mcp` and `integrations` remain the UX bridge into MCP-aware settings, readiness, and chat orchestration
- any richer remote MCP service wraps the same upstream chat, validation, workspace, parser, and canvas owners that already materialize structured KGC Markdown into nodes, edges, subgraphs, groups, and cluster projections

---

## PRD — Product Requirements

### Product Goals

Knowgrph MCP must:

- expose truthful shipped MCP surfaces without conflating them with proposed remote services
- support seamless E2E flow across MainPanel `mcp` and MainPanel `integrations` -> FloatingPanel Chat UI -> LLM output -> YAML frontmatter -> Canvas nodes / edges / subgraphs / groups / clusters
- keep one canonical KGC contract where output starts at YAML frontmatter and `flow.subgraphs` is the only upstream grouping authoring surface
- keep one canonical graph-apply path through existing chat finalize and parser/store actions
- preserve zero- or near-zero fixed-cost deployment bias for remote surfaces
- keep tool contracts SSOT, small, typed, and reusable across stdio, browser, and future remote transports

### Non-Goals

This document does not claim that the following are already implemented:

- a deployed remote Worker MCP gateway with mutating graph or pipeline tools
- a server-side D1 shadow of browser `graphDataSlice` that is already wired into live canvas sync
- a shipped OAuth 2.1 remote auth flow for Knowgrph-specific tools
- a shipped Stripe-backed remote MCP monetization surface beyond the MainPanel readiness/docs layer

### Personas

- **Persona A - Local MCP power user**: runs `mcp/server.js` from Claude Code, Cursor, or another local MCP host to launch the UI, run parser pipelines, run the superagent harness, or drive the browser API bridge.
- **Persona B - Published-doc agent**: connects to deployed Pages/browser agent-ready surfaces to discover `knowgrph.list_source_files`, `knowgrph.read_source_file`, `knowgrph.read_shared_document`, `knowgrph.inspect_shared_document_structure`, and `knowgrph.inspect_agent_surface`; when running inside the full app runtime it can additionally inspect Settings chat readiness with `knowgrph.inspect_local_settings_chat_readiness`, the active MainPanel state with `knowgrph.inspect_local_mainpanel_state`, the active Editor Workspace and Markdown pane state with `knowgrph.inspect_local_editor_workspace_state`, the active FloatingPanel chat pipeline state with `knowgrph.inspect_local_chat_pipeline_state`, the active local workspace document with `knowgrph.inspect_local_workspace_document`, the active local canvas with `knowgrph.inspect_local_canvas_topology`, the active local canvas snapshot with `knowgrph.inspect_local_canvas_snapshot`, the active local 3d camera pose with `knowgrph.inspect_local_3d_camera_pose`, the active local 3d layout positions with `knowgrph.inspect_local_3d_layout_positions`, the active local 2d zoom viewport with `knowgrph.inspect_local_2d_zoom_viewport`, and the active local Source Files snapshot with `knowgrph.inspect_local_source_files_snapshot`.
- **Persona C - MainPanel operator**: configures MCP, integrations, provider presets, and chat routing through shared MainPanel settings.
- **Persona D - FloatingPanel Chat user**: asks the LLM to generate canonical KGC Markdown and expects the result to materialize on the Canvas without a second manual import path.
- **Persona E - Future remote MCP client**: should eventually trigger selected richer flows remotely, but only through thin adapters over existing browser/local owners.

### User Journeys

#### Journey A - Local stdio workflow

| Stage | Action | Touchpoint | Current owner | Gap |
|---|---|---|---|---|
| Discover | MCP client lists tools | `mcp/server.js` + `mcp/local-tool-contract.js` | `ListToolsRequestSchema` backed by the shared local tool contract | No remote transport |
| Launch | User opens Canvas or Workspace Editor | `knowgrph.ui.launch` | `mcp/server.js` | Local-only dev workflow |
| Execute | User runs harness or pipeline | local MCP tools | `mcp/server.js` | Local-root and subprocess bound |
| Inspect | User inspects outputs | local files / summaries | `mcp/server.js` + parser outputs | No public remote artifact contract |

#### Journey B - Deployed read-only workflow

| Stage | Action | Touchpoint | Current owner | Gap |
|---|---|---|---|---|
| Discover | Agent hits `/knowgrph/` | Pages Link headers and docs | `cloudflare/pages/knowgrph-agent-ready.mjs` | Read-only only |
| List tools | Agent calls `/knowgrph/mcp` | JSON-RPC MCP | `cloudflare/pages/knowgrph-agent-ready.mjs` | Shared five-tool read-only contract only |
| Use tools | Agent reads docs | storage-backed routes | Pages + storage worker | No richer workspace/chat/canvas integration |
| In browser | Agent sees WebMCP tools | `navigator.modelContext` | `webMcpRuntime.ts` + `main.tsx` | Shared five-tool deployed surface; full app runtime adds browser-local inspect tools |

#### Journey C - MainPanel to chat orchestration

| Stage | Action | Touchpoint | Current owner | Gap |
|---|---|---|---|---|
| Configure | User opens MainPanel `mcp` or `integrations` | thin shell tabs | `McpHubView.tsx`, `IntegrationsHubView.tsx` | Docs previously overstated separate MCP orchestration |
| Prepare | User applies chat preset or routing | shared settings helpers | `useSettingsChatAssist.tsx` | Needs stronger MCP doc alignment |
| Open chat | User opens FloatingPanel chat | shared open-panel helpers | settings constants + FloatingPanel | Must remain shared path |
| Submit | User asks for knowledge graph output | chat submit shell | `useSidePanelChatSubmit.ts` | Future remote adapters must reuse this path |

#### Journey D - FloatingPanel Chat to Canvas graph

| Stage | Action | Touchpoint | Current owner | Gap |
|---|---|---|---|---|
| Stream | Assistant draft streams | chat streaming helper | `sidePanelChatStreaming.ts` | Not yet formalized as transport-agnostic contract |
| Validate | KGC is recovered and validated | KGC retry + validation helpers | `sidePanelChatKgcAttempt.ts`, `chatMarkdownValidation.ts` | Docs previously proposed parallel pipelines |
| Finalize | KGC persists to workspace | finalize helper | `useFinalizeAssistantSuccess.ts` | Must remain canonical write path |
| Apply | Canvas graph materializes | parser/store apply chain | `chatKgcCanvasApply.ts` -> `setActiveMarkdownDocument()` -> frontmatter-flow parser | Remote MCP future must wrap, not fork |

### Epics And Stories

#### Epic MCP-1 - Truthful Surface Separation

- **PRD-MCP1-S1**: As a maintainer, I want all MCP docs to distinguish shipped stdio MCP, shipped read-only Pages/browser MCP, and proposed future remote MCP service so that no stale architecture is treated as implementation truth.
- **PRD-MCP1-S2**: As a maintainer, I want explicit forbidden-architecture rules so future changes do not reintroduce conflicting pipeline, grouping, or deploy authority narratives.

#### Epic MCP-2 - MainPanel Readiness Alignment

- **PRD-MCP2-S1**: As a MainPanel operator, I want `mcp` and `integrations` documented as thin shared settings shells so that MCP readiness stays anchored to one upstream settings owner.
- **PRD-MCP2-S2**: As a maintainer, I want chat routing, presets, and provider configuration documented as shared prerequisites for MCP-aware workflows so that new MCP features do not fork provider state.

#### Epic MCP-3 - E2E Pipeline Reuse

- **PRD-MCP3-S1**: As a FloatingPanel Chat user, I want future MCP-aligned workflows to reuse the existing chat submit, KGC validation, and canvas apply pipeline so that LLM output reaches Canvas through the same validated path.
- **PRD-MCP3-S2**: As a maintainer, I want `flow.subgraphs` documented as the sole upstream grouping authoring surface so that no MCP layer reintroduces `clusters`, `groups`, `layers`, or `kg:subgraphs` as parallel authoring channels.

#### Epic MCP-4 - Future Remote MCP Direction

- **PRD-MCP4-S1**: As a future remote MCP client, I want richer graph and pipeline tools to be introduced as thin adapters over existing helpers so that remote execution preserves the current KGC contract.
- **PRD-MCP4-S2**: As an operator, I want remote server-side fetches to reuse the shipped storage-worker boundary so that Pages and future remote MCP workers do not regress into custom-domain self-fetch rewrite failures.

### Acceptance Criteria

#### PRD-MCP1-S1 - Surface separation

**Given** the repo as of 2026-05-23,  
**When** an engineer reads the MCP docs,  
**Then** the docs clearly separate:
- shipped local stdio MCP in `mcp/server.js`
- shipped read-only Pages/browser MCP in `cloudflare/pages/knowgrph-agent-ready.mjs` and `webMcpRuntime.ts`
- proposed future remote MCP service work that is not yet implemented

#### PRD-MCP1-S2 - Forbidden architecture

**Given** a future design or implementation proposal,  
**When** it claims a second graph pipeline, second grouping contract, mirror-owned deploy authority, or already-shipped remote Worker modules,  
**Then** the docs classify that architecture as forbidden until real upstream owners exist in the repo.

#### PRD-MCP2-S1 - MainPanel shell ownership

**Given** MainPanel `mcp` and `integrations`,  
**When** they are documented,  
**Then** the docs identify them as `SettingsView` shells instead of independent configuration or orchestration stacks.

#### PRD-MCP2-S2 - Shared chat readiness

**Given** chat provider, preset, and integration routing configuration,  
**When** MCP readiness is documented,  
**Then** the docs point to `useSettingsChatAssist.tsx` and shared open-panel helpers as the upstream owners instead of inventing separate MCP-only routing config.

#### PRD-MCP3-S1 - E2E pipeline reuse

**Given** any future MCP trigger for graph creation or graph import,  
**When** it reaches the Canvas,  
**Then** it reuses the existing submit, validation, finalize, parser, and apply pipeline or equally thin adapters over those helpers, rather than creating a separate serializer or graph importer.

#### PRD-MCP3-S2 - Grouping SSOT

**Given** a canonical KGC Markdown document,  
**When** it is accepted for canvas apply,  
**Then** `flow.subgraphs` is the only upstream grouping authoring surface and parallel grouping aliases are rejected or normalized upstream before graph apply.

#### PRD-MCP4-S1 - Future remote tools

**Given** future richer remote MCP tools,  
**When** they are introduced,  
**Then** they wrap existing workspace, chat, parser, and graph owners and keep tool schemas small, typed, and transport-agnostic.

#### PRD-MCP4-S2 - Storage boundary reuse

**Given** a server-side fetch for published Source Files or shared-doc markdown,  
**When** it is performed by Pages or a future remote MCP worker,  
**Then** it targets `https://knowgrph-storage.huijoohwee.workers.dev` for server-side reads while browser/public URLs remain canonical on `https://airvio.co/api/storage/*`.

---

## TAD — Technical Architecture

### Current Canonical Owners

| Concern | Canonical owner | Status | Notes |
|---|---|---|---|
| Local MCP transport and tools | `mcp/server.js` + `mcp/local-tool-contract.js` | Shipped | stdio only |
| Local MCP docs | `mcp/README.md` | Shipped | must stay aligned with `server.js` |
| Pages agent-ready MCP route | `cloudflare/pages/knowgrph-agent-ready.mjs` | Shipped | JSON-RPC read-only transport |
| Pages HTML WebMCP fallback | `cloudflare/pages/knowgrph-agent-ready.mjs` | Shipped | shared five-tool injected WebMCP surface |
| Browser WebMCP install | `canvas/src/features/agent-ready/webMcpRuntime.ts` | Shipped | `provideContext` / `registerTool(tool, { signal })` / fallback / late binding |
| Browser WebMCP bootstrap | `canvas/src/main.tsx` | Shipped | installs runtime on page load |
| Shared read-only tool contract | `canvas/src/features/agent-ready/knowgrphAgentReadyToolContract.mjs` | Shipped | five shared read-only tools |
| Agent-ready metadata | `cloudflare/pages/knowgrph-agent-ready.mjs` | Shipped | health, OpenAPI, MCP server card, A2A, agent-skills |
| MainPanel MCP shell | `canvas/src/features/panels/views/McpHubView.tsx` | Shipped | thin shell |
| MainPanel Integrations shell | `canvas/src/features/panels/views/IntegrationsHubView.tsx` | Shipped | thin shell |
| Shared settings/chat readiness owner | `canvas/src/features/panels/views/SettingsView.tsx` + `useSettingsChatAssist.tsx` | Shipped | chat preset/routing/model readiness |
| Stripe MCP readiness docs | `canvas/src/features/panels/views/stripeMcpApiDocs.ts` | Shipped | readiness/docs, not remote service implementation |
| Crawler Access MCP readiness docs | `canvas/src/features/panels/views/crawlerAccessMcpApiDocs.ts` | Shipped | readiness/docs, not a separate tool server |
| FloatingPanel chat shell | `canvas/src/features/chat/SidePanelChat.tsx` | Shipped | interactive chat UI |
| Chat submit shell | `canvas/src/features/chat/sidePanelChat/useSidePanelChatSubmit.ts` | Shipped | thin shell |
| Chat coordinator | `canvas/src/features/chat/sidePanelChat/sidePanelChatSubmitCoordinator.ts` | Shipped | request/stream/retry/finalize |
| KGC validation | `canvas/src/features/chat/chatMarkdownValidation.ts` | Shipped | frontmatter-first, canonical grouping |
| KGC recovery | `canvas/src/features/chat/chatHistoryWorkspace.kgc.recovery.ts` | Shipped | wrapper salvage, alias stripping |
| Chat finalize -> canvas bridge | `canvas/src/features/chat/sidePanelChat/useFinalizeAssistantSuccess.ts` + `chatKgcCanvasApply.ts` | Shipped | canonical workspace write then graph apply |
| Structured Markdown parse priority | `canvas/src/features/parsers/default.ts` | Shipped | frontmatter-flow first |
| Frontmatter-flow graph compose | `canvas/src/features/parsers/markdownFrontmatterFlowGraph.core.ts` + helpers | Shipped | edges + subgraphs + cluster merge |
| Canvas group projection | `canvas/src/lib/graph/subgraphs.ts` + `canvas/src/components/GraphCanvas/layout/graphGroups.ts` | Shipped | downstream rendered grouping |

### Current Runtime Contracts

#### Contract A - Shipped stdio MCP

- Transport: stdio only.
- Tool surface: UI launch/stop, pipeline, GraphRAG pipeline, superagent harness, browser API bridge.
- Deploy model: local process in an MCP client host.
- Constraints: rooted to `KNOWGRPH_ROOT`; subprocess-based; not public remote transport.

#### Contract B - Shipped read-only Pages/browser MCP

- Transport: JSON-RPC over `/knowgrph/mcp` and browser WebMCP via `navigator.modelContext`.
- Tool surface: shared deployed contract = `knowgrph.list_source_files`, `knowgrph.read_source_file`, `knowgrph.read_shared_document`, `knowgrph.inspect_shared_document_structure`, `knowgrph.inspect_agent_surface`; app-installed browser runtime additionally exposes `knowgrph.inspect_local_settings_chat_readiness`, `knowgrph.inspect_local_mainpanel_state`, `knowgrph.inspect_local_editor_workspace_state`, `knowgrph.inspect_local_chat_pipeline_state`, `knowgrph.inspect_local_workspace_document`, `knowgrph.inspect_local_canvas_topology`, `knowgrph.inspect_local_canvas_snapshot`, `knowgrph.inspect_local_3d_camera_pose`, `knowgrph.inspect_local_3d_layout_positions`, `knowgrph.inspect_local_2d_zoom_viewport`, and `knowgrph.inspect_local_source_files_snapshot`.
- Data source: published Source Files and storage-backed markdown doc reads.
- Constraints: read-only by design; lifecycle now includes late binding, duplicate-state handling, and localhost/current-origin storage resolution.

#### Contract B1 - WebMCP readiness and discovery

- App bootstrap owner: `canvas/src/main.tsx` installs `installKnowgrphWebMcpRuntime()` on page load.
- Runtime owner: `webMcpRuntime.ts` builds tool definitions from the shared contract, including `name`, `description`, `inputSchema`, `execute`, and read-only hints for the published and browser-local tool set.
- Lifecycle contract: `webMcpLifecycle.mjs` prefers `navigator.modelContext.provideContext({ tools })` when available and also registers each tool with `registerTool(tool, { signal })`.
- Cleanup and late binding: `AbortController` is used for registration cleanup; late binding supports `navigator.modelContext` appearing after startup; duplicate registrations are tolerated via `InvalidStateError` handling.
- Deployed HTML contract: `cloudflare/pages/knowgrph-agent-ready.mjs` injects a shared five-tool WebMCP fallback only on `/knowgrph` HTML surfaces.
- Discovery contract: the same Pages owner also ships health, API catalog, OpenAPI, MCP server card, A2A card, and agent-skills metadata, and those metadata surfaces must describe all five shared tools truthfully.
- Truthfulness rule: any doc that describes Knowgrph WebMCP as missing, future-only, or implemented outside the current shared tool/lifecycle owners is stale.

#### Contract C - Shipped in-browser chat-to-canvas pipeline

- Start points: MainPanel `mcp`, MainPanel `integrations`, or FloatingPanel Chat.
- Chat readiness owner: `useSettingsChatAssist.tsx`.
- Submit owner: `useSidePanelChatSubmit.ts` -> `sidePanelChatSubmitCoordinator.ts`.
- Validation owner: `sidePanelChatKgcAttempt.ts` + `chatMarkdownValidation.ts` + shared KGC recovery helpers.
- Apply owner: `useFinalizeAssistantSuccess.ts` -> `applyChatKgcWorkspaceDocumentToCanvas()` -> `setActiveMarkdownDocument({ applyToGraph: true })`.
- Parse owner: `tryParseMarkdownFrontmatterFlowGraph()` and related compose helpers.

### Forbidden Architecture

The following are forbidden until the repo gains real upstream owners for them:

- claiming a remote Worker MCP gateway or pipeline-worker module is already implemented when its files do not exist
- creating a second MainPanel MCP configuration stack outside `SettingsView` and `useSettingsChatAssist()`
- creating a second LLM output -> Markdown -> Canvas path outside the current chat submit, validation, finalize, parser, and apply chain
- using `clusters`, `groups`, `layers`, or `kg:subgraphs` as upstream grouping authoring channels alongside canonical `flow.subgraphs`
- treating downstream parser compatibility such as `frontmatter:chatKnowgrphRelaxed` as an upstream authoring contract
- treating the prod mirror as deploy authority instead of `knowgrph` source + publish sync + `huijoohwee` root control files
- performing Pages or future MCP server-side storage reads through the custom-domain self-fetch path instead of the storage-worker origin

### Known Compatibility Seams

- `chatHistoryWorkspace.kgc.recovery.ts` still strips legacy grouping aliases upstream before validation retry
- `markdownFrontmatterFlowGraph.*` still contains downstream parser compatibility for legacy cluster/group material
- `frontmatter:chatKnowgrphRelaxed` still exists as a parser leniency seam

These are implementation facts, but they are compatibility debt rather than approved upstream authoring surfaces.

### Future Remote MCP Architecture Direction

The next remote MCP layer is still proposed. When it is implemented, it should follow these rules:

| Concern | Required direction | Forbidden shortcut |
|---|---|---|
| Tool contracts | reuse one SSOT manifest or builder shared across transports | per-transport drifted schemas |
| Auth | add explicit remote auth only for future remote tools | rewriting or weakening shipped read-only Pages/browser flows |
| Published-doc reads | reuse existing storage worker and route contract | new ad hoc document fetchers |
| Chat orchestration | wrap `useSettingsChatAssist`-owned routing semantics and existing chat submit helpers | new MCP-only provider config or submit loop |
| KGC validation | reuse shared recovery + validation rules | accepting prose wrappers or parallel grouping aliases downstream |
| Canvas apply | reuse existing graph apply boundary and parser owners | new serializer/importer that bypasses `setActiveMarkdownDocument()` |
| Group rendering | keep subgraphs as source, rendered groups as projection | writing rendered group state as a second source of truth |

### Architecture Diagram

```mermaid
flowchart LR
  A["MainPanel integrations"] --> C["SettingsView"]
  B["MainPanel mcp"] --> C
  C --> D["useSettingsChatAssist()"]
  D --> E["FloatingPanel Chat"]
  E --> F["useSidePanelChatSubmit()"]
  F --> G["sidePanelChatSubmitCoordinator.ts"]
  G --> H["Streaming draft + KGC retry"]
  H --> I["chatMarkdownValidation.ts"]
  I --> J["useFinalizeAssistantSuccess()"]
  J --> K["applyChatKgcWorkspaceDocumentToCanvas()"]
  K --> L["setActiveMarkdownDocument(applyToGraph)"]
  L --> M["tryParseMarkdownFrontmatterFlowGraph()"]
  M --> N["edges + subgraphs + cluster merge"]
  N --> O["Canvas nodes / edges / groups"]
```

### Open Questions

| ID | Question | Why it remains open |
|---|---|---|
| OQ-1 | What is the thinnest future remote tool contract that can safely reuse the current chat pipeline without duplicating browser-only UI responsibilities? | needed before richer remote mutating tools |
| OQ-2 | Which helper logic is safe to extract into shared transport-agnostic modules for future remote execution? | needed to avoid hook- or UI-only coupling |
| OQ-3 | Should future remote graph mutation operate on canonical Markdown, canonical graph payloads, or both? | needed to preserve SSOT and avoid format drift |
| OQ-4 | How should future remote auth and entitlements compose with existing Stripe readiness docs and Pages/public surfaces? | needed before shipping monetized remote tools |
| OQ-5 | Which remote inspection tools deliver the best value before any mutating remote tool is added? | needed to keep rollout incremental and low-risk |

---

## Delivery Plan

### Phase 0 - Documentation truthfulness

- keep this PRD/TAD aligned with the current repo
- keep `knowgrph-mcp.md` as a short topology/index doc that points to this PRD/TAD and its companion
- keep the companion focused on owner maps and forbidden architecture

### Phase 1 - Shared contract hardening

- preserve shipped browser WebMCP lifecycle parity across app runtime, injected HTML fallback, and discovery metadata without changing the shared read-only tool contract
- identify which tool-schema builder or manifest can be reused by stdio, browser, Pages, and future remote surfaces
- keep MainPanel readiness docs aligned with Stripe MCP and crawler-access MCP SSOT modules

### Phase 2 - Remote inspection first

- introduce remote read-oriented tools first
- reuse existing storage worker boundaries and published-doc contracts
- avoid mutating graph or chat actions until shared helper extraction is explicit and tested

### Phase 3 - Remote pipeline bridge

- add thin remote adapters for selected pipeline stages only after they reuse current validation and parser contracts
- keep canonical KGC Markdown and `flow.subgraphs` invariants upstream
- add targeted validation around transport parity and canvas materialization correctness

---

## Validation Checklist

- [x] Distinguishes shipped stdio MCP, shipped read-only Pages/browser MCP, and proposed future remote MCP
- [x] Documents MainPanel `mcp` and `integrations` as thin `SettingsView` shells
- [x] Documents `useSettingsChatAssist.tsx` as the shared chat readiness owner
- [x] Documents `useSidePanelChatSubmit.ts` as a thin shell over the coordinator/helper stack
- [x] Documents canonical KGC validation and recovery before canvas apply
- [x] Documents `flow.subgraphs` as the sole upstream grouping authoring surface
- [x] Forbids stale remote Worker module claims and duplicate graph pipelines
- [x] Reuses the storage-worker origin rule for future server-side reads
- [x] Keeps future remote MCP work explicitly proposed rather than shipped

---

*Document ID: `md:knowgrph-mcp-service-prd-tad-proposed` · Version: 0.4.14 · Updated: 2026-05-23*
