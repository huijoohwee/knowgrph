---
title: "Knowgrph MCP Integration"
doc_type: "MCP Overview"
status: "active"
updated: "2026-06-08"
lang: "en-US"
frontmatter_contract: "required"
related:
  - "knowgrph-mcp-service-prd-tad.md"
  - "knowgrph-mcp-agentic-os-prd-tad.md"
  - "knowgrph-mcp-agentic-os-prd-tad.companion.md"
  - "knowgrph-mcp-service-prd-tad.companion.md"
---

# Knowgrph MCP Integration

**Context (deployment chain)**  
Dev repo `knowgrph` -> Prod repo mirror `huijoohwee/content/knowgrph` -> Cloudflare Pages `airvio.co/knowgrph`.

**Intent**
- keep shipped MCP surfaces truthful
- keep one canonical architecture contract
- frame Knowgrph MCP as an Agentic Canvas OS control plane for Canvas UI and cross-repo agent build dashboards
- keep MainPanel -> FloatingPanel Chat -> YAML frontmatter or MCP structured response -> Editor Workspace -> Canvas flow implementation-accurate
- forbid stale/conflicting MCP narratives

---

## Current Topology

| Surface | Status | Canonical owner | Notes |
|---|---|---|---|
| Local stdio MCP | Shipped | `mcp/server.js` + `mcp/local-tool-contract.js` + `knowgrphAgentReadyPromptContract.mjs` + `knowgrphAgentReadyResourceContract.mjs` | standard read-only `search`/`fetch`, prompt discovery, resource-template discovery, local UI launch, local pipelines, local browser bridge, and local MCP Apps resource support |
| Local SuperAgent harness | Shipped | `knowgrph_parser/superagent_harness.py` + `knowgrph_parser/superagent_plan.py` + `knowgrph_parser/superagent_tools.py` + `mcp/server.js` | CLI/local-MCP long-horizon research/code/create artifact runs through `knowgrph.superagent.run`; DeerFlow-inspired concepts only, no copied architecture |
| Pages HTTP MCP | Shipped | `cloudflare/pages/knowgrph-agent-ready.mjs` | read-only JSON-RPC MCP on `/knowgrph/mcp`, including tool/resource/prompt/template discovery and data-first `search`/`fetch` |
| MCP Apps resource/server-readiness | Shipped | `canvas/src/features/agent-ready/mcpAppsReadyContract.mjs` + `canvas/src/features/agent-ready/knowgrphAgentReadyResourceContract.mjs` + `cloudflare/pages/knowgrph-agent-ready.mjs` + `mcp/server.js` | native `io.modelcontextprotocol/ui` capability, `ui://knowgrph/agent-ready`, `text/html;profile=mcp-app`, `kgdoc://source-file/{id}`, mirrored no-auth `securitySchemes`, OpenAI output-template/widget metadata, Qwen Code HTTP setup metadata, Kimi CLI HTTP setup metadata, BytePlus ModelArk Responses API MCP setup metadata, `prompts/list`, `prompts/get`, `resources/templates/list`, `resources/list`, `resources/read`, and `mcpAppsServerReadiness` |
| Pages HTML WebMCP fallback | Shipped | `cloudflare/pages/knowgrph-agent-ready.mjs` | shared seven-tool WebMCP injection on `/knowgrph` HTML routes; `inspect_agent_surface` reads structured content through `/knowgrph/mcp` |
| Browser WebMCP | Shipped | `canvas/src/features/agent-ready/webMcpRuntime.ts` + `canvas/src/main.tsx` | page-load install with descriptor-complete shared tools, `provideContext({ tools })`, `registerTool(tool, { signal })`, late binding, and browser-local E2E readiness inspectors |
| MainPanel MCP / Integrations | Shipped | `canvas/src/features/panels/views/SettingsView.tsx` + `useSettingsChatAssist.tsx` | thin readiness and routing shell |
| Cloudflare AI Gateway MCP docs surface | Shipped | `canvas/src/features/panels/views/cloudflareAiGatewayMcpApiDocs.ts` | MainPanel MCP operator docs for `https://ai-gateway.mcp.cloudflare.com/mcp`, AI Gateway endpoint patterns, log-inspection tools, and secret/account boundary |
| FloatingPanel Chat -> Canvas pipeline | Shipped | `canvas/src/features/chat/*` + parser/store owners | validated KGC Markdown or literal MCP structured response -> Editor Workspace -> Canvas apply path |
| Agentic Canvas OS dashboard contract | Planned extension over shipped owners | `knowgrph-mcp-agentic-os-prd-tad.md` + companion | Canvas UI/cross-repo agent build and control dashboard; dry-run first; repo allowlist, HITL, TCO/token budgets, adapter plans, market/artifact/starter lanes, and learning-loop lane |
| Remote Worker MCP platform | Planned extension | none in repo yet | must not be documented as implemented |

---

## E2E Contract

The current shipped MCP-aware path is:

1. MainPanel `mcp` or `integrations`
2. shared settings and chat readiness
3. FloatingPanel Chat submit helpers
4. KGC recovery/validation or literal MCP structured-surface acceptance
5. canonical workspace finalize
6. `applyChatKgcWorkspaceDocumentToCanvas()`
7. `applyWorkspaceImportToCanvas()`
8. `setActiveMarkdownDocument({ applyToGraph: true })`
8. frontmatter-flow parsing and downstream subgraph/group/cluster projection

Guardrails:

- WebMCP is already implemented in repo and must not be described as future-only work.
- Local SuperAgent execution is already implemented in repo, but it remains a local CLI/stdio MCP surface and must not be described as a deployed public Pages/WebMCP mutation service.
- DeerFlow-inspired SuperAgent language is conceptual-reference-only: no copied DeerFlow code, copied architecture, DeerFlow-only parser, DeerFlow-only renderer, or DeerFlow-owned graph apply path.
- MCP Apps-ready means the shipped MCP servers expose a native UI resource and tool linkage; the repo does not copy the upstream `modelcontextprotocol/ext-apps` examples or add an ext-apps runtime dependency for the current resource.
- The canonical MCP Apps resource URI is `ui://knowgrph/agent-ready` and its MIME type is `text/html;profile=mcp-app`.
- The app resource HTML supports both host bridge shapes from the shared resource owner: OpenAI Apps `window.openai` globals / `openai:set_globals` for ChatGPT widgets and the native MCP Apps `ui/initialize` / `ui/notifications/initialized` lifecycle for extension-capable hosts.
- `search` and `fetch` are the canonical data-first published document tools for OpenAI Deep Research-style hosts, Claude, Qwen Code, Kimi CLI, BytePlus ModelArk, and generic MCP clients; Pages HTTP MCP, local stdio MCP, and WebMCP expose them as read-only tools returning stable `kgdoc:` Source File IDs, citation-ready result URLs, and complete markdown as both `content` and `text` without mutating graph state.
- Cloudflare AI Gateway MCP is documented as an external, account-scoped operator surface for gateway logs and request/response inspection. Knowgrph only renders non-secret setup and endpoint metadata; Cloudflare API tokens, provider keys, account IDs, and gateway IDs stay with the MCP host or server environment.
- `search` ranks Source Files with bounded content-aware scoring through the same storage reader used by `fetch`; it must not remain index-line-only because natural LLM queries often target terms inside markdown body content rather than filenames.
- Agentic Canvas OS does not add a second runtime. It is the operator-facing control-plane contract that composes current MCP, SuperAgent, MainPanel, FloatingPanel Chat, Source Files, and Canvas owners into cross-repo build dashboards for consumer repos such as `stryfork`.
- Agentic Canvas OS Dashboard is a Source Files Markdown document plus typed runtime manifest. Canvas renders it through existing frontmatter-flow and Flow Editor owners; runtime inspection is read-only until a source-owned approval/mutation contract exists.
- Agentic Canvas OS Market Radar, real-browser evidence, market-to-artifact, Starter Repo, and Learning Loop lane details live in `knowgrph-mcp-agentic-os-prd-tad.companion.md`; they remain planned, local-first where needed, source-backed, redacted, no-copy, and approval-gated.
- Cross-repo agent build workflows must be dry-run first, root-allowlisted, trace-emitting, and human-approved before file writes, deployment, paid model calls, or financial actions.
- Public retrieval and discovery tools declare complete read-only, non-destructive, non-open-world, idempotent annotations; browser-local inspectors remain read-only, non-destructive, non-open-world, and idempotent.
- `prompts/list` and `prompts/get` expose shared read-only host guidance prompts for Source Files research and agent-surface inspection; prompts tell hosts to use existing tools and do not create a second execution path.
- `resources/templates/list` exposes `kgdoc://source-file/{id}` from `knowgrphAgentReadyResourceContract.mjs`; `resources/read` resolves that URI through the existing `fetch` executor instead of creating a second Source Files read path.
- `inspect_agent_surface.structuredContent.mcpAppsServerReadiness` is the canonical server-readiness model for app tool/resource binding, Source Files resource-template discovery, OpenAI output-template/widget metadata, OpenAI widget bridge compatibility, Qwen Code HTTP setup metadata, Kimi CLI HTTP setup metadata, BytePlus ModelArk Responses API MCP setup metadata, mirrored no-auth `securitySchemes`, read-only annotations, widget accessibility, output schema, text fallback, structured content, sandbox/security metadata, prompt discovery, `search`/`fetch` output-schema readiness, Streamable HTTP JSON-RPC transport, and local stdio transport.
- Local stdio and Pages HTTP MCP both expose resource discovery, resource-template discovery, and resource read handling from shared MCP Apps-ready contracts.
- Browser WebMCP inspection now reaches Settings chat readiness plus chat validation/finalize/apply diagnostics while remaining read-only.
- `flow.subgraphs` is the sole upstream grouping authoring surface.
- Rendered groups and clusters are downstream projections, not a second authoring SSOT.
- Public/browser storage URLs stay canonical on `https://airvio.co/api/storage/*`; server-side reads use `https://knowgrph-storage.huijoohwee.workers.dev`.

---

## MCP Apps Reference Boundary

As of 2026-06-04, the upstream MCP Apps, OpenAI Apps, Qwen Code/Qwen-Agent, Kimi CLI, BytePlus ModelArk, and FastMCP reference points Knowgrph cares about are:

- MCP Apps is an optional MCP extension identified by `io.modelcontextprotocol/ui`.
- UI resources use the `ui://` scheme and HTML resources use `text/html;profile=mcp-app`.
- Tools link to UI resources through `_meta.ui.resourceUri`.
- OpenAI Apps-compatible tools also expose `_meta["openai/outputTemplate"]` pointing at the same UI resource.
- OpenAI Apps-compatible tool descriptors expose `securitySchemes` and mirror them in `_meta.securitySchemes`; Knowgrph currently declares no-auth because the shipped public retrieval/app tools do not require OAuth.
- Browser WebMCP and the Pages HTML fallback preserve shared `outputSchema`, `securitySchemes`, annotations, and `_meta` fields instead of narrowing descriptors per transport.
- UI-backed tools that the app resource can call expose `_meta["openai/widgetAccessible"] = true`.
- App resources declare sandbox/security metadata through `_meta.ui.csp`, border preference, and a derived `_meta.ui.domain` / `_meta["openai/widgetDomain"]` when the serving app URL has an origin.
- Remote HTTP MCP uses Streamable HTTP semantics; JSON-RPC requests use POST, metadata discovery can use JSON GET, client notifications/responses return 202 with no body, and GET with `Accept: text/event-stream` returns 405 because Knowgrph does not open an SSE stream. Local clients use stdio.
- Data-first MCP connectors expose read-only `search(query)` and `fetch(id)` tools when a host needs indexed retrieval plus full-content fetch; Knowgrph search uses bounded markdown-content scoring on top of Source Files index discovery.
- Multi-host MCP servers can expose prompt templates alongside tools and resources; Knowgrph uses prompts only for read-only guidance over existing tools.
- MCP resources use the standard `resources` capability; parameterized resources are discovered with `resources/templates/list`, not a separate capability.
- App resources are listed and read through MCP resource handlers, then sandboxed by the host; Source Files resources use `kgdoc://source-file/{id}` and return `text/markdown`.
- Tool results must remain useful without UI through text fallback and structured output.
- Qwen Code remote MCP clients install the Pages HTTP endpoint with `qwen mcp add --transport http knowgrph https://airvio.co/knowgrph/mcp` or equivalent `mcpServers.knowgrph.httpUrl`; Knowgrph exposes this setup through the shared server card and readiness payload instead of as a docs-only snippet.
- Kimi CLI remote MCP clients install the Pages HTTP endpoint with `kimi mcp add --transport http knowgrph https://airvio.co/knowgrph/mcp` or equivalent `~/.kimi/mcp.json` `mcpServers.knowgrph.url`; Knowgrph exposes this setup through the shared server card and readiness payload instead of as a docs-only snippet.
- BytePlus ModelArk invokes remote MCP through the Responses API with `ark-beta-mcp: true` and a `tools` item shaped as `{ "type": "mcp", "server_label": "knowgrph", "server_url": "https://airvio.co/knowgrph/mcp", "require_approval": "never" }`; BytePlus only invokes Cloud-deployed MCP/Remote MCP over Streamable HTTP, so Knowgrph exposes this setup through the shared server card and readiness payload.

Knowgrph implements those primitives natively through the owners above. The upstream `modelcontextprotocol/ext-apps` repository and docs are references only; they are not copied into this repo.

References: [MCP Apps overview](https://modelcontextprotocol.io/extensions/apps/overview), [MCP Apps specification](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx), [MCP Apps API docs](https://apps.extensions.modelcontextprotocol.io/api/), [OpenAI Apps SDK MCP server guide](https://developers.openai.com/apps-sdk/build/mcp-server), [OpenAI Apps SDK UI guide](https://developers.openai.com/apps-sdk/build/chatgpt-ui), [Qwen Code MCP guide](https://qwenlm.github.io/qwen-code-docs/en/users/features/mcp/), [Qwen-Agent MCP guide](https://qwenlm.github.io/Qwen-Agent/en/guide/core_moduls/mcp/), [Kimi CLI MCP guide](https://moonshotai.github.io/kimi-cli/en/customization/mcp.html), [BytePlus ModelArk remote MCP guide](https://docs.byteplus.com/en/docs/modelark/1827534), [FastMCP ChatGPT integration](https://github.com/prefecthq/fastmcp/blob/main/docs/integrations/chatgpt.mdx).

---

## Canonical Docs

This file is an overview and document index. The canonical detailed contracts live here:

- [knowgrph-mcp-service-prd-tad.md](knowgrph-mcp-service-prd-tad.md): product and architecture contract
- [knowgrph-mcp-agentic-os-prd-tad.md](knowgrph-mcp-agentic-os-prd-tad.md): Agentic Canvas OS PRD/TAD for Canvas UI and cross-repo agent build/control dashboards
- [knowgrph-mcp-agentic-os-prd-tad.companion.md](knowgrph-mcp-agentic-os-prd-tad.companion.md): Agentic Canvas OS lane contracts for market evidence, browser evidence, artifact generation, starter repositories, learning memory, skills, and identity facets
- [knowgrph-mcp-service-prd-tad.companion.md](knowgrph-mcp-service-prd-tad.companion.md): file-level owner map, WebMCP readiness owners, invariants, and forbidden architecture
- `mcp/README.md`: local stdio MCP server usage; shared local tool inventory lives in `mcp/local-tool-contract.js`

---

## Policy

- keep one SSOT contract per MCP surface
- keep local SuperAgent harness truth in `knowgrph-superagent-harness.md`, `knowgrph_parser/*`, and `mcp/local-tool-contract.js`
- keep Agentic Canvas OS truth in the parent PRD/TAD plus companion until repo-owned tool contracts exist
- reuse the shipped chat/validation/parser/apply chain instead of creating a second MCP-only graph pipeline
- introduce future remote tools as thin adapters over current owners
- remove stale/conflicting content instead of preserving parallel narratives
