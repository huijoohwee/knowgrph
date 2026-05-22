# Knowgrph MCP Integration

**Context (deployment chain)**  
Dev repo `knowgrph` -> Prod repo mirror `huijoohwee/content/knowgrph` -> Cloudflare Pages `airvio.co/knowgrph`.

**Intent**
- keep MCP as the SSOT tool layer where it adds real leverage
- keep shipped surfaces truthful
- forbid stale/conflicting architecture
- align future MCP work with the existing MainPanel -> FloatingPanel Chat -> YAML frontmatter -> Canvas graph pipeline

---

## 1) Current MCP surfaces

### 1.1 Local stdio MCP

**Status**: shipped  
**Owner**: `mcp/server.js`

Current local tools:
- `knowgrph.ui.launch`
- `knowgrph.ui.stop`
- `knowgrph.pipeline`
- `knowgrph.graphrag_pipeline`
- `knowgrph.superagent.run`
- `knowgrph.browser_api.run`

This is the richest implemented MCP surface in the repo today, but it is local-only and stdio-only.

### 1.2 Pages and browser read-only MCP

**Status**: shipped  
**Owners**:
- `cloudflare/pages/knowgrph-agent-ready.mjs`
- `canvas/src/features/agent-ready/webMcpRuntime.ts`
- `canvas/src/features/agent-ready/knowgrphAgentReadyToolContract.mjs`

Current shared read-only tools:
- `knowgrph.list_source_files`
- `knowgrph.read_source_file`
- `knowgrph.read_shared_document`

This surface is intentionally narrow and storage-backed. It is not the same thing as the richer future remote MCP platform proposed in the PRD/TAD.

### 1.3 MainPanel MCP and Integrations readiness

**Status**: shipped  
**Owners**:
- `canvas/src/features/panels/views/McpHubView.tsx`
- `canvas/src/features/panels/views/IntegrationsHubView.tsx`
- `canvas/src/features/panels/views/SettingsView.tsx`
- `canvas/src/features/panels/views/useSettingsChatAssist.tsx`

Important detail: MainPanel `mcp` and MainPanel `integrations` are thin shells over shared settings and chat-readiness owners. They are not separate orchestration stacks.

### 1.4 Browser-local chat to canvas pipeline

**Status**: shipped  
**Owners**:
- `canvas/src/features/chat/sidePanelChat/useSidePanelChatSubmit.ts`
- `canvas/src/features/chat/sidePanelChat/sidePanelChatSubmitCoordinator.ts`
- `canvas/src/features/chat/chatMarkdownValidation.ts`
- `canvas/src/features/chat/sidePanelChat/useFinalizeAssistantSuccess.ts`
- `canvas/src/features/chat/chatKgcCanvasApply.ts`
- `canvas/src/features/parsers/default.ts`
- `canvas/src/features/parsers/markdownFrontmatterFlowGraph.*`

This is the existing E2E path for:
- MainPanel MCP / Integrations readiness
- FloatingPanel Chat UI
- LLM output
- YAML frontmatter KGC Markdown
- Canvas nodes / edges / subgraphs / groups / clusters

---

## 2) Repo-accurate architecture

### 2.1 Shipped topology

| Surface | Role | Owner |
|---|---|---|
| Local stdio MCP | local automation and dev workflows | `mcp/server.js` |
| Pages HTTP MCP | published-document read-only access | `cloudflare/pages/knowgrph-agent-ready.mjs` |
| Browser WebMCP | in-browser read-only access | `webMcpRuntime.ts` |
| MainPanel MCP / Integrations | readiness, docs, routing, provider config | `SettingsView` + `useSettingsChatAssist.tsx` |
| FloatingPanel Chat | validated KGC generation and canvas apply | `sidePanelChat/*` + parser/store owners |

### 2.2 Storage boundary

For published Source Files and shared-doc reads:
- public and browser-visible URLs remain canonical on `https://airvio.co/api/storage/*`
- server-side reads from Pages or a future remote MCP worker should target `https://knowgrph-storage.huijoohwee.workers.dev`

This boundary is already proven by the shipped agent-ready Pages surface and must not drift.

---

## 3) MCP design rules

### 3.1 Keep surfaces separate

Do not conflate:
- local stdio MCP
- shipped read-only Pages/browser MCP
- future remote Worker MCP service

### 3.2 Reuse the current E2E pipeline

Future richer MCP tools must reuse the current browser-local chain:
- MainPanel `mcp` / `integrations`
- shared settings and chat readiness
- FloatingPanel Chat submit helpers
- KGC recovery and validation
- finalize to workspace
- `applyChatKgcWorkspaceDocumentToCanvas()`
- `setActiveMarkdownDocument({ applyToGraph: true })`
- frontmatter-flow parsing and subgraph/group projection

### 3.3 Keep grouping SSOT upstream

Canonical grouping authoring surface:
- `flow.subgraphs`

Forbidden as parallel upstream authoring channels:
- `kg:subgraphs`
- `clusters`
- `groups`
- `layers`

### 3.4 Keep tool contracts small

- one SSOT contract per tool surface
- typed input/output
- no stale aliases
- no duplicate per-transport semantics

---

## 4) What is proposed next

The next MCP phase should add value in this order:

1. Harden browser WebMCP lifecycle without changing the current shared read-only contract.
2. Keep MainPanel readiness docs aligned with actual shared settings and chat owners.
3. Introduce remote read-oriented tools before remote mutating tools.
4. If richer remote pipeline tools are added, make them thin adapters over the existing KGC validation and canvas-apply path rather than a second graph pipeline.

---

## 5) Forbidden architecture

Explicitly forbidden:
- claiming nonexistent remote MCP Worker modules are already implemented
- creating a second MainPanel MCP routing/config system
- creating a second LLM -> Markdown -> Canvas graph pipeline
- using the prod mirror as deploy authority
- reintroducing server-side custom-domain self-fetch for storage-backed document reads
- reintroducing parallel grouping authoring aliases beside `flow.subgraphs`

---

## 6) Minimal acceptance bar

A good future MCP change:
- preserves the shipped local stdio and read-only Pages/browser surfaces
- keeps MainPanel and FloatingPanel ownership thin and upstream
- reuses the existing KGC validation and parser/apply contracts
- keeps tool schemas stable and small
- does not add stale/conflicting architecture to the docs
