# Knowgrph MCP Service - PRD & TAD Companion

Implementation-accurate supplement to [knowgrph-mcp-service-prd-tad.md](knowgrph-mcp-service-prd-tad.md).

**Document Version**: 0.4.16  
**Date**: 2026-05-31
**Status**: Implementation-aligned supplement

---

## Purpose

This companion keeps the main PRD/TAD honest at the file-owner, WebMCP-readiness, and architecture-invariant level.

It answers five questions:

1. What MCP surfaces are actually shipped today?
2. Which files currently own WebMCP readiness and discovery?
3. Which files currently own MCP Apps-ready tool/resource/server-readiness behavior?
4. Which files currently own the MainPanel -> FloatingPanel Chat -> KGC -> Canvas flow?
5. Which stale or conflicting architectures are forbidden?

---

## Shipped Vs Planned

| Surface | Status | Canonical owner | Contract |
|---|---|---|---|
| Local stdio MCP transport | Shipped | `mcp/server.js` | stdio request handling and tool execution |
| Local stdio MCP tool contract | Shipped | `mcp/local-tool-contract.js` | shared local tool names, descriptions, and `inputSchema` inventory |
| Local stdio MCP Apps resource | Shipped | `mcp/server.js` + `mcp/local-tool-contract.js` + `canvas/src/features/agent-ready/mcpAppsReadyContract.mjs` | advertises `io.modelcontextprotocol/ui`, exposes `resources/list` and `resources/read`, and links `knowgrph.vdeoxpln.list` to `ui://knowgrph/agent-ready` |
| Local stdio MCP docs | Shipped | `mcp/README.md` | local configuration and usage |
| Pages HTTP MCP | Shipped | `cloudflare/pages/knowgrph-agent-ready.mjs` | read-only JSON-RPC MCP with tools and resources |
| MCP Apps-ready shared contract | Shipped | `canvas/src/features/agent-ready/mcpAppsReadyContract.mjs` | `io.modelcontextprotocol/ui`, `text/html;profile=mcp-app`, `ui://knowgrph/agent-ready`, resource descriptor/read result, app HTML, tool metadata, output schema, and readiness payload |
| MCP Apps-ready inspection payload | Shipped | `canvas/src/features/agent-ready/agentSurfaceInspection.mjs` | adds `mcpAppsServerReadiness` to `inspect_agent_surface.structuredContent` |
| MCP Apps static artifact | Shipped | `cloudflare/pages/knowgrph-agent-ready.mjs` | publishes `.well-known/mcp/apps/knowgrph-agent-ready.html` from the shared resource contract |
| Pages HTML WebMCP fallback | Shipped | `cloudflare/pages/knowgrph-agent-ready.mjs` | injects shared five-tool WebMCP into `/knowgrph` HTML surfaces |
| Browser WebMCP | Shipped | `canvas/src/features/agent-ready/webMcpRuntime.ts` | app runtime registers read-only tools including `knowgrph.inspect_local_settings_chat_readiness`, `knowgrph.inspect_local_mainpanel_state`, `knowgrph.inspect_local_editor_workspace_state`, `knowgrph.inspect_local_chat_pipeline_state`, `knowgrph.inspect_local_mainpanel_chat_canvas_pipeline`, `knowgrph.inspect_local_workspace_document`, `knowgrph.inspect_local_canvas_topology`, `knowgrph.inspect_local_canvas_snapshot`, `knowgrph.inspect_local_3d_camera_pose`, `knowgrph.inspect_local_3d_layout_positions`, `knowgrph.inspect_local_2d_zoom_viewport`, and `knowgrph.inspect_local_source_files_snapshot` |
| Browser-local WebMCP state snapshots | Shipped | `canvas/src/features/agent-ready/browserLocalSurfaceSnapshots.ts` | shared browser-local Settings chat readiness, MainPanel, Editor Workspace, and chat pipeline state publication for app-runtime inspection tools, including KGC validation and finalize/apply diagnostics |
| Browser WebMCP lifecycle | Shipped | `canvas/src/features/agent-ready/webMcpLifecycle.mjs` | `provideContext({ tools })`, `registerTool(tool, { signal })`, late binding, duplicate registration tolerance |
| Browser WebMCP bootstrap | Shipped | `canvas/src/main.tsx` | installs app-runtime WebMCP on page load |
| Shared read-only tool contract | Shipped | `canvas/src/features/agent-ready/knowgrphAgentReadyToolContract.mjs` | published Pages/HTTP tool set = `knowgrph.list_source_files`, `knowgrph.read_source_file`, `knowgrph.read_shared_document`, `knowgrph.inspect_shared_document_structure`, `knowgrph.inspect_agent_surface` |
| Vdeoxpln registry | Shipped | `canvas/src/features/agent-ready/knowgrphVdeoxplnContract.mjs` | canonical vdeoxpln ids, semantic keys, source owners, tool projections, neutral routing, run manifest builder, and generated agent-skill Markdown |
| Vdeoxpln run manifests | Shipped | `canvas/src/features/chat/knowgrphVdeoxplnChatArtifacts.ts` | writes KGC companion manifests through Workspace FS and host mirror after FloatingPanel Chat finalization |
| Agent-ready metadata | Shipped | `cloudflare/pages/knowgrph-agent-ready.mjs` | health, API catalog, OpenAPI, MCP server card, A2A agent card, agent-skills |
| Agent-skills discovery metadata | Shipped | `cloudflare/pages/knowgrph-agent-ready-discovery.mjs` | agent-skills index and metadata expectations for published discovery |
| MainPanel MCP | Shipped | `canvas/src/features/panels/views/McpHubView.tsx` | thin `SettingsView mode="mcp"` shell |
| MainPanel Integrations | Shipped | `canvas/src/features/panels/views/IntegrationsHubView.tsx` | thin `SettingsView mode="integrations"` shell |
| Shared MainPanel chat readiness | Shipped | `canvas/src/features/panels/views/useSettingsChatAssist.tsx` | presets, routing, model refresh |
| Stripe MCP readiness docs | Shipped | `canvas/src/features/panels/views/stripeMcpApiDocs.ts` | readiness/config only |
| Crawler Access MCP readiness docs | Shipped | `canvas/src/features/panels/views/crawlerAccessMcpApiDocs.ts` | readiness/config only |
| FloatingPanel Chat -> Canvas flow | Shipped | `canvas/src/features/chat/*` + parser/store owners | browser-local validated KGC pipeline |
| Remote Worker MCP gateway / pipeline platform | Planned extension | none in repo yet | must not be described as implemented |

---

## WebMCP Readiness Owners

### Browser Runtime

| Concern | Owner | Notes |
|---|---|---|
| Page-load install | `canvas/src/main.tsx` | calls `installKnowgrphWebMcpRuntime()` at app startup |
| Tool contract builder | `canvas/src/features/agent-ready/knowgrphAgentReadyToolContract.mjs` | shared source for names, descriptions, `inputSchema`, and browser-only gate |
| Tool executor assembly | `canvas/src/features/agent-ready/webMcpRuntime.ts` | builds WebMCP tool objects with `name`, `description`, `inputSchema`, `execute`, and read-only hints |
| Lifecycle controller | `canvas/src/features/agent-ready/webMcpLifecycle.mjs` | prefers `provideContext({ tools })`, also calls `registerTool(tool, { signal })`, and falls back to readable `modelContext.tools` state |
| Late binding | `canvas/src/features/agent-ready/webMcpLifecycle.mjs` | supports `navigator.modelContext` appearing after bootstrap |
| Runtime markers | `canvas/src/features/agent-ready/webMcpRuntime.ts` | writes `data-kg-webmcp-tools` and `data-kg-webmcp-context` on the document root |

### Deployed Discovery

| Concern | Owner | Notes |
|---|---|---|
| HTML fallback injection | `cloudflare/pages/knowgrph-agent-ready.mjs` | injects the shared five-tool WebMCP surface on `/knowgrph` HTML routes |
| Agent-skills index | `cloudflare/pages/knowgrph-agent-ready.mjs` + `cloudflare/pages/knowgrph-agent-ready-discovery.mjs` | publishes `/.well-known/agent-skills/index.json` under `/knowgrph` |
| Vdeoxpln markdown | `cloudflare/pages/knowgrph-agent-ready.mjs` + `canvas/src/features/agent-ready/knowgrphVdeoxplnContract.mjs` | publishes generated `/.well-known/agent-skills/{vdeoxpln-id}.md` routes from the canonical registry |
| HTTP MCP / server card parity | `cloudflare/pages/knowgrph-agent-ready.mjs` | metadata surfaces must stay contract-equal with the shared published five-tool contract |

### MCP Apps Server-Readiness Owners

| Concern | Owner | Notes |
|---|---|---|
| Extension constants | `canvas/src/features/agent-ready/mcpAppsReadyContract.mjs` | `io.modelcontextprotocol/ui`, `2026-01-26`, `text/html;profile=mcp-app`, and `ui://knowgrph/agent-ready` |
| Server capability builder | `canvas/src/features/agent-ready/mcpAppsReadyContract.mjs` | `buildKnowgrphMcpAppsCapabilities()` is reused by Pages HTTP MCP and local stdio MCP |
| Tool metadata builder | `canvas/src/features/agent-ready/mcpAppsReadyContract.mjs` | `buildKnowgrphMcpAppsToolMeta()` owns `_meta.ui.resourceUri` and app/model visibility |
| Resource descriptor and read result | `canvas/src/features/agent-ready/mcpAppsReadyContract.mjs` | owns `resources/list` descriptor shape and `resources/read` HTML payload |
| Resource HTML view | `canvas/src/features/agent-ready/mcpAppsReadyContract.mjs` | native inline HTML implements the MCP Apps host bridge and readiness view |
| Pages resource route | `cloudflare/pages/knowgrph-agent-ready.mjs` | handles `resources/list`, `resources/read`, static app artifact, and `tools/call` text fallback plus structured content |
| Local resource route | `mcp/server.js` | handles `ListResourcesRequestSchema` and `ReadResourceRequestSchema` for stdio clients |
| Pages app tool | `canvas/src/features/agent-ready/knowgrphAgentReadyToolContract.mjs` | links `inspect_agent_surface` to the shared app resource and output schema |
| Local app tool | `mcp/local-tool-contract.js` | links `knowgrph.vdeoxpln.list` to the shared app resource and output schema |
| Server-readiness payload | `canvas/src/features/agent-ready/agentSurfaceInspection.mjs` | builds `mcpAppsServerReadiness` from current tools, resources, server card, base URL, and local stdio support |
| Focused coverage | `canvas/src/__tests__/agentReadyHttpMcpParity.test.ts` + `canvas/src/__tests__/mcpLocalToolContract.test.ts` + `scripts/check-agent-ready.mjs` | checks resource linkage, MIME type, output schema, static artifact, and live readiness |

### Readiness Invariants

- Browser WebMCP is already implemented and must not be described as future-only work.
- Shipped readiness follows the current WebMCP guidance: tools expose `name`, `description`, `inputSchema`, and `execute`.
- Runtime installation occurs on page load, not after a user manually opens a separate MCP panel.
- Lifecycle cleanup uses `AbortController` so tool registration can be released cleanly.
- Shared deployed WebMCP stays on the published five-tool read-only contract.
- Browser-local inspect tools remain app-runtime only unless a future shared contract explicitly promotes them.
- MCP Apps-ready resource delivery stays server-owned through `resources/list` and `resources/read`; do not inline app HTML in tool results as a second resource path.
- The app resource URI stays `ui://knowgrph/agent-ready`; the HTML MIME type stays `text/html;profile=mcp-app`.
- Tool results keep a text fallback and structured output so non-UI hosts and app-capable hosts share the same source payload.
- `mcpAppsServerReadiness` is the canonical readiness payload; downstream pages or docs should not recalculate a second checklist.
- The current implementation is native in-repo; upstream `modelcontextprotocol/ext-apps` is a reference, not source code to copy or vendor.

---

## E2E Owner Map

### MainPanel And Settings

| Stage | Owner | Notes |
|---|---|---|
| MainPanel tab registration | `canvas/src/features/panels/MainPanel.tsx` | owns `mcp` and `integrations` tab presence |
| MCP shell | `canvas/src/features/panels/views/McpHubView.tsx` | no separate business logic |
| Integrations shell | `canvas/src/features/panels/views/IntegrationsHubView.tsx` | no separate business logic |
| Shared settings owner | `canvas/src/features/panels/views/SettingsView.tsx` | filters and renders settings content |
| Chat readiness owner | `canvas/src/features/panels/views/useSettingsChatAssist.tsx` | presets, context scope, integration enablement, model discovery |
| Settings readiness WebMCP snapshot | `canvas/src/features/panels/views/useSettingsChatAssist.tsx` + `canvas/src/features/agent-ready/browserLocalSurfaceSnapshots.ts` | publishes provider/routing/model-discovery state for browser agents |

### FloatingPanel Chat

| Stage | Owner | Notes |
|---|---|---|
| Floating panel container | `canvas/src/components/ui/FloatingPanel.tsx` | UI container |
| Chat mounting surface | `canvas/src/features/chat/FloatingPanelChat.tsx` | interactive chat state and UI |
| Submit shell | `canvas/src/features/chat/floatingPanelChat/useFloatingPanelChatSubmit.ts` | thin shell by design |
| Submit coordinator | `canvas/src/features/chat/floatingPanelChat/floatingPanelChatSubmitCoordinator.ts` | request lifecycle owner |
| Vdeoxpln routing prompt | `canvas/src/features/chat/floatingPanelChat/floatingPanelChatSubmitRequest.ts` | injects the selected canonical vdeoxpln plan into provider-bound chat requests |
| Streaming | `canvas/src/features/chat/floatingPanelChat/floatingPanelChatStreaming.ts` | assistant draft flush and stream parsing |
| KGC attempt / retry | `canvas/src/features/chat/floatingPanelChat/floatingPanelChatKgcAttempt.ts` | validation and correction retry |
| Browser chat pipeline snapshot | `canvas/src/features/chat/FloatingPanelChat.tsx` + `canvas/src/features/agent-ready/browserLocalSurfaceSnapshots.ts` | publishes FloatingPanel runtime state and workspace follow/draft state for browser agents |

### KGC Validation And Canvas Apply

| Stage | Owner | Notes |
|---|---|---|
| KGC recovery | `canvas/src/features/chat/chatHistoryWorkspace.kgc.recovery.ts` | strips wrappers and legacy grouping aliases upstream |
| KGC validation | `canvas/src/features/chat/chatMarkdownValidation.ts` | frontmatter-first and `flow.subgraphs` enforcement |
| Validation snapshot publish | `canvas/src/features/chat/floatingPanelChat/floatingPanelChatSubmitCoordinator.ts` | publishes retry, failed-rule, and validated-YAML readiness state for WebMCP inspection |
| Finalize write | `canvas/src/features/chat/floatingPanelChat/useFinalizeAssistantSuccess.ts` | canonical workspace KGC persistence |
| Vdeoxpln run manifest write | `canvas/src/features/chat/knowgrphVdeoxplnChatArtifacts.ts` | source-backed KGC companion output with selected vdeoxpln id, semantic run key, status, provider/model/cost fields, and Canvas apply result |
| Canvas apply bridge | `canvas/src/features/chat/chatKgcCanvasApply.ts` | calls `setActiveMarkdownDocument()` |
| Finalize/apply snapshot publish | `canvas/src/features/chat/floatingPanelChat/useFinalizeAssistantSuccess.ts` | publishes persisted path and apply outcome for WebMCP inspection |
| Graph apply action | `canvas/src/hooks/store/graph-data-slice/graphDataDocumentActions.ts` | canonical graph apply gateway |
| Parse priority | `canvas/src/features/parsers/default.ts` | frontmatter-flow parser first |
| Graph composition | `canvas/src/features/parsers/markdownFrontmatterFlowGraph.core.ts` + helpers | edge/subgraph/cluster compose |
| Group projection | `canvas/src/lib/graph/subgraphs.ts` + `canvas/src/components/GraphCanvas/layout/graphGroups.ts` | subgraph metadata -> rendered groups and clusters |

---

## Known Compatibility Seams

These exist in code today but are not canonical architecture:

- parser compatibility still recognizes legacy downstream grouping material such as `clusters` in `markdownFrontmatterFlowGraph.*`
- chat recovery still strips `kg:subgraphs`, `clusters`, `groups`, and `layers` upstream before validation retry
- `frontmatter:chatKnowgrphRelaxed` remains a downstream parser leniency seam and must not be treated as a second upstream authoring contract

These seams are compatibility debt, not an approved authoring surface.

---

## E2E Contract

```mermaid
flowchart LR
  A["MainPanel mcp"] --> C["SettingsView"]
  B["MainPanel integrations"] --> C
  C --> D["useSettingsChatAssist()"]
  D --> E["FloatingPanel Chat"]
  E --> F["useFloatingPanelChatSubmit()"]
  F --> G["Coordinator + streaming"]
  G --> H["Vdeoxpln routing prompt"]
  H --> I["KGC recovery + validation"]
  I --> J["Finalize assistant success"]
  J --> K["Workspace FS run manifest"]
  J --> L["applyChatKgcWorkspaceDocumentToCanvas()"]
  L --> M["setActiveMarkdownDocument(applyToGraph)"]
  M --> N["Frontmatter-flow parse"]
  N --> O["Nodes / edges / subgraphs / groups"]
```

### Architectural Invariants

- MainPanel `mcp` and `integrations` stay thin shells over `SettingsView`.
- Chat routing and presets stay owned by `useSettingsChatAssist()`.
- Browser-local settings readiness inspection reuses `useSettingsChatAssist()` output instead of creating a second settings/readiness source of truth.
- `useFloatingPanelChatSubmit()` stays a thin shell; complexity remains in dedicated helpers.
- Canonical KGC output starts at YAML frontmatter.
- `flow.subgraphs` is the only upstream grouping authoring surface.
- Canvas graph apply goes through `applyChatKgcWorkspaceDocumentToCanvas()` and `setActiveMarkdownDocument({ applyToGraph: true })`.
- Browser-local chat pipeline inspection may expose validation and finalize/apply diagnostics, but must remain read-only and must not introduce a second mutating MCP pipeline.
- Rendered groups and clusters are downstream projection, not a second authoring SSOT.

---

## Forbidden Architecture

The following are explicitly forbidden:

- documenting nonexistent remote MCP Worker modules as if they are already implemented
- documenting Knowgrph WebMCP as missing when the shipped runtime already installs it through `canvas/src/main.tsx`, `webMcpRuntime.ts`, and `webMcpLifecycle.mjs`
- copying, vendoring, or alias-stacking upstream MCP Apps example servers instead of extending `mcpAppsReadyContract.mjs`
- adding a second MCP Apps resource URI, MIME-type constant, resource-read path, or server-readiness checklist outside the shared contract
- adding a second MainPanel MCP config or routing surface outside `SettingsView` and `useSettingsChatAssist()`
- adding a second LLM output -> Markdown -> Canvas pipeline outside the current chat submit, KGC validation, finalize, and parser/apply owners
- treating `kg:subgraphs`, `clusters`, `groups`, or `layers` as upstream authoring alternatives to `flow.subgraphs`
- treating downstream parser compatibility such as `frontmatter:chatKnowgrphRelaxed` as an upstream contract
- treating the prod mirror as canonical deploy authority
- reintroducing server-side custom-domain self-fetch for storage-backed document reads

---

## Future Remote MCP Rules

If a future remote MCP service is added, it must:

- introduce richer tools as thin adapters over current owners
- keep tool-schema SSOT shared across stdio, browser, Pages, and remote transport
- keep MCP Apps resources predeclared and read through standard MCP resource handlers
- add read-oriented tools before mutating tools where possible
- reuse the storage-worker origin for server-side published-doc reads
- preserve browser performance by avoiding unnecessary downstream remapping or duplicate graph recomputation

---

## Review Checklist

- [x] Companion aligns with the main PRD/TAD `0.4.16`
- [x] Owner map points only to files that actually exist in the repo
- [x] WebMCP readiness ownership is implementation-accurate
- [x] MCP Apps-ready resource, capability, tool metadata, and server-readiness owners are documented
- [x] Shipped vs planned boundary is explicit
- [x] E2E MainPanel -> FloatingPanel Chat -> KGC -> Canvas contract is documented
- [x] Forbidden architecture list blocks stale/conflicting narratives

---

*Document Version: 0.4.16 · Updated: 2026-05-31*
