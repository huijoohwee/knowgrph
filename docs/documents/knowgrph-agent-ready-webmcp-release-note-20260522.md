# Knowgrph Agent-Ready WebMCP Release Note

## Summary

Knowgrph now ships a hardened, implementation-accurate agent-ready surface across:

- browser WebMCP via `navigator.modelContext`
- HTML-injected WebMCP fallback on the published Pages surface
- read-only HTTP MCP on `/knowgrph/mcp`
- implementation-accurate MCP and agent-ready PRD/TAD documentation

This rollout keeps the existing MainPanel `mcp` / `integrations` -> FloatingPanel Chat ->
Markdown YAML frontmatter -> Canvas pipeline as the canonical upstream flow. No second MCP-only
graph pipeline was introduced.

## Shipped Contract

### Browser WebMCP

- App runtime registers `knowgrph.list_source_files`, `knowgrph.read_source_file`, `knowgrph.read_shared_document`, `knowgrph.inspect_shared_document_structure`, `knowgrph.inspect_local_workspace_document`, `knowgrph.inspect_local_canvas_topology`, `knowgrph.inspect_local_canvas_snapshot`, and `knowgrph.inspect_agent_surface`
- Reuses the shared upstream tool contract in
  `canvas/src/features/agent-ready/knowgrphAgentReadyToolContract.mjs`
- Attempts `provideContext({ tools })`, then `registerTool(tool, { signal })`, then readable
  fallback `modelContext.tools`
- Supports bounded late binding when `navigator.modelContext` appears after startup
- Treats duplicate registration as duplicate-state handling instead of swallowing arbitrary errors
- Uses same-origin `/api/storage/*` paths on localhost and current-origin resolution with canonical
  fallback on preview/prod

### HTML Fallback WebMCP

- Injects the shared published five-tool read-only surface on the published Pages HTML shell
- Keeps lifecycle semantics aligned with the app runtime while excluding browser-local app-only tools
- Exposes `data-kg-webmcp-tools` and `data-kg-webmcp-context` for smoke verification

### HTTP MCP

- Serves read-only JSON-RPC transport on `https://airvio.co/knowgrph/mcp`
- Supports `initialize`, `tools/list`, and `tools/call`
- Shares tool names and input schemas with browser WebMCP

## Deployed URLs

- Live app: [airvio.co/knowgrph](https://airvio.co/knowgrph)
- Live MCP: [airvio.co/knowgrph/mcp](https://airvio.co/knowgrph/mcp)
- Preview alias used for rollout verification:
  [agent-ready-webmcp-preview.joohwee.pages.dev/knowgrph](https://agent-ready-webmcp-preview.joohwee.pages.dev/knowgrph)

## Commits

- Source repo `knowgrph`
  - `d666208d` `Harden WebMCP lifecycle and align MCP docs`
  - `43f1a9eb` `Log agent-ready WebMCP rollout`
- Publish repo `huijoohwee`
  - `321e4b4d` `Publish knowgrph agent-ready WebMCP update`

## Verification

### Focused local checks

```bash
cd /Users/huijoohwee/Documents/GitHub/knowgrph/canvas
node --preserve-symlinks --preserve-symlinks-main ./node_modules/tsx/dist/cli.cjs -e "Promise.all([import('./src/__tests__/webMcpRuntime.test.ts'), import('./src/__tests__/agentReadyWebMcpHtmlFallback.test.ts')]).then(async ([runtimeTest, htmlTest]) => { await runtimeTest.testWebMcpRuntimeLateBindsAndUsesSameOriginStoragePaths(); await htmlTest.testAgentReadyHtmlWebMcpFallbackLateBindsAndUsesSameOriginStoragePaths(); })"
```

### Preview smoke

```bash
cd /Users/huijoohwee/Documents/GitHub/knowgrph
KNOWGRPH_AGENT_READY_BASE_URL=https://agent-ready-webmcp-preview.joohwee.pages.dev/knowgrph node ./scripts/check-agent-ready.mjs
```

Expected result:

```text
[knowgrph] agent-ready smoke passed: 27/27
```

### Live smoke

```bash
cd /Users/huijoohwee/Documents/GitHub/knowgrph
node ./scripts/check-agent-ready.mjs
```

Expected result:

```text
[knowgrph] agent-ready smoke passed: 27/27
```

## Source Of Truth

- Agent-ready Pages route owner:
  `cloudflare/pages/knowgrph-agent-ready.mjs`
- Browser WebMCP runtime owner:
  `canvas/src/features/agent-ready/webMcpRuntime.ts`
- Shared read-only tool contract:
  `canvas/src/features/agent-ready/knowgrphAgentReadyToolContract.mjs`
- Agent-ready smoke owner:
  `scripts/check-agent-ready.mjs`
- Canonical implementation-accurate PRD/TAD:
  `docs/documents/knowgrph-agent-ready-prd-tad-proposed.md`
- Canonical MCP PRD/TAD:
  `docs/documents/knowgrph-mcp/knowgrph-mcp-service-prd-tad-proposed.md`

## Guardrails

- Do not add write-capable tools to browser WebMCP or Pages HTTP MCP without explicit auth and
  workspace-write design
- Do not fork a second LLM output -> Markdown -> Canvas pipeline outside the existing chat submit,
  validation, finalize, parser, and apply chain
- Do not reintroduce parallel grouping authoring aliases beside canonical `flow.subgraphs`
- Do not treat the publish mirror as a source-authoritative implementation surface
