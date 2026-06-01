# Knowgrph MCP Integration

**Context (deployment chain)**  
Dev repo `knowgrph` -> Prod repo mirror `huijoohwee/content/knowgrph` -> Cloudflare Pages `airvio.co/knowgrph`.

**Intent**
- keep shipped MCP surfaces truthful
- keep one canonical architecture contract
- keep MainPanel -> FloatingPanel Chat -> YAML frontmatter -> Canvas flow implementation-accurate
- forbid stale/conflicting MCP narratives

---

## Current Topology

| Surface | Status | Canonical owner | Notes |
|---|---|---|---|
| Local stdio MCP | Shipped | `mcp/server.js` + `mcp/local-tool-contract.js` | local UI launch, local pipelines, local browser bridge, and local MCP Apps resource support |
| Pages HTTP MCP | Shipped | `cloudflare/pages/knowgrph-agent-ready.mjs` | read-only JSON-RPC MCP on `/knowgrph/mcp`, including tool and resource discovery |
| MCP Apps resource/server-readiness | Shipped | `canvas/src/features/agent-ready/mcpAppsReadyContract.mjs` + `cloudflare/pages/knowgrph-agent-ready.mjs` + `mcp/server.js` | native `io.modelcontextprotocol/ui` capability, `ui://knowgrph/agent-ready`, `text/html;profile=mcp-app`, `resources/list`, `resources/read`, and `mcpAppsServerReadiness` |
| Pages HTML WebMCP fallback | Shipped | `cloudflare/pages/knowgrph-agent-ready.mjs` | shared five-tool WebMCP injection on `/knowgrph` HTML routes |
| Browser WebMCP | Shipped | `canvas/src/features/agent-ready/webMcpRuntime.ts` + `canvas/src/main.tsx` | page-load install with `provideContext({ tools })`, `registerTool(tool, { signal })`, late binding, and browser-local E2E readiness inspectors |
| MainPanel MCP / Integrations | Shipped | `canvas/src/features/panels/views/SettingsView.tsx` + `useSettingsChatAssist.tsx` | thin readiness and routing shell |
| FloatingPanel Chat -> Canvas pipeline | Shipped | `canvas/src/features/chat/*` + parser/store owners | validated KGC Markdown -> Canvas apply path |
| Remote Worker MCP platform | Planned extension | none in repo yet | must not be documented as implemented |

---

## E2E Contract

The current shipped MCP-aware path is:

1. MainPanel `mcp` or `integrations`
2. shared settings and chat readiness
3. FloatingPanel Chat submit helpers
4. KGC recovery and validation
5. canonical workspace finalize
6. `applyChatKgcWorkspaceDocumentToCanvas()`
7. `setActiveMarkdownDocument({ applyToGraph: true })`
8. frontmatter-flow parsing and downstream subgraph/group/cluster projection

Guardrails:

- WebMCP is already implemented in repo and must not be described as future-only work.
- MCP Apps-ready means the shipped MCP servers expose a native UI resource and tool linkage; the repo does not copy the upstream `modelcontextprotocol/ext-apps` examples or add an ext-apps runtime dependency for the current resource.
- The canonical MCP Apps resource URI is `ui://knowgrph/agent-ready` and its MIME type is `text/html;profile=mcp-app`.
- `inspect_agent_surface.structuredContent.mcpAppsServerReadiness` is the canonical server-readiness model for app tool/resource binding, output schema, text fallback, structured content, sandbox metadata, HTTP JSON-RPC transport, and local stdio transport.
- Local stdio and Pages HTTP MCP both expose resource discovery and resource read handling from the shared MCP Apps-ready contract.
- Browser WebMCP inspection now reaches Settings chat readiness plus chat validation/finalize/apply diagnostics while remaining read-only.
- `flow.subgraphs` is the sole upstream grouping authoring surface.
- Rendered groups and clusters are downstream projections, not a second authoring SSOT.
- Public/browser storage URLs stay canonical on `https://airvio.co/api/storage/*`; server-side reads use `https://knowgrph-storage.huijoohwee.workers.dev`.

---

## MCP Apps Reference Boundary

As of 2026-05-31, the upstream MCP Apps reference points Knowgrph cares about are:

- MCP Apps is an optional MCP extension identified by `io.modelcontextprotocol/ui`.
- UI resources use the `ui://` scheme and HTML resources use `text/html;profile=mcp-app`.
- Tools link to UI resources through `_meta.ui.resourceUri`.
- App resources are listed and read through MCP resource handlers, then sandboxed by the host.
- Tool results must remain useful without UI through text fallback and structured output.

Knowgrph implements those primitives natively through the owners above. The upstream `modelcontextprotocol/ext-apps` repository and docs are references only; they are not copied into this repo.

References: [MCP Apps overview](https://modelcontextprotocol.io/extensions/apps/overview), [MCP Apps specification](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx), [MCP Apps API docs](https://apps.extensions.modelcontextprotocol.io/api/).

---

## Canonical Docs

This file is an overview and document index. The canonical detailed contracts live here:

- [knowgrph-mcp-service-prd-tad.md](knowgrph-mcp-service-prd-tad.md): product and architecture contract
- [knowgrph-mcp-service-prd-tad.companion.md](knowgrph-mcp-service-prd-tad.companion.md): file-level owner map, WebMCP readiness owners, invariants, and forbidden architecture
- `mcp/README.md`: local stdio MCP server usage; shared local tool inventory lives in `mcp/local-tool-contract.js`

---

## Policy

- keep one SSOT contract per MCP surface
- reuse the shipped chat/validation/parser/apply chain instead of creating a second MCP-only graph pipeline
- introduce future remote tools as thin adapters over current owners
- remove stale/conflicting content instead of preserving parallel narratives
