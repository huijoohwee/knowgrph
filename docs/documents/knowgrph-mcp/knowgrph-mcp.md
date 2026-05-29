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
| Local stdio MCP | Shipped | `mcp/server.js` + `mcp/local-tool-contract.js` | local UI launch, local pipelines, local browser bridge |
| Pages HTTP MCP | Shipped | `cloudflare/pages/knowgrph-agent-ready.mjs` | read-only JSON-RPC MCP on `/knowgrph/mcp` |
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
- Browser WebMCP inspection now reaches Settings chat readiness plus chat validation/finalize/apply diagnostics while remaining read-only.
- `flow.subgraphs` is the sole upstream grouping authoring surface.
- Rendered groups and clusters are downstream projections, not a second authoring SSOT.
- Public/browser storage URLs stay canonical on `https://airvio.co/api/storage/*`; server-side reads use `https://knowgrph-storage.huijoohwee.workers.dev`.

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
