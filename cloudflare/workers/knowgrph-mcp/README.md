# knowgrph-mcp Worker

Cloudflare Worker that hosts the Agents SDK `McpAgent` for the
**knowgrph ↔ agentic-canvas-os MCP connector** control plane. Exposes the
Director tool (`knowgrph.video_remix.run`) plus the five stage tools
(`research`, `storyboard`, `render`, `publish`, `checkout`) over the
**MCP Streamable HTTP** transport at `https://airvio.co/knowgrph/mcp`.

Migrates the deployed plain-JSON-RPC HTTP MCP at
`cloudflare/pages/knowgrph-agent-ready.mjs` per **ADR-7** and
spec task 1.1 of `.kiro/specs/knowgrph-acos-mcp-connector` (Requirement
R14.1; Properties 1, 26).

## Layout

| File | Responsibility |
|---|---|
| `index.ts` | Worker entry. Defines `KnowgrphMcpAgent` (Agents SDK `McpAgent`), registers the 6 tools with the Streamable HTTP transport, routes `/knowgrph/mcp[*]` to `KnowgrphMcpAgent.serve(...)`, persists each Director Run_Manifest to the durable store, and serves `GET /knowgrph/mcp/runs/{id}` for read-back. |
| `tool-registry.mjs` | Pure-JS source of truth for the tool list, schemas, and approval-gate boundary. Imported by the Worker and by the Node `node:test` unit tests. Reuses `mcp/video-remix-runtime.js` for the Director tool. |
| `run-manifest-store.mjs` | Durable Run_Manifest persistence (task 1.2). `RunManifestStore` Durable Object plus pure helpers (`RunManifestPersistence`, `persistRunManifestThroughNamespace`, `readRunManifestThroughNamespace`). One DO instance per `runId`. |
| `wrangler.toml` | Worker bindings: route `airvio.co/knowgrph/mcp[*]`, Durable Object classes `KnowgrphMcpAgent` (transport sessions) and `RunManifestStore` (Run_Manifest persistence). |
| `__tests__/tool-registry.test.mjs` | Node-built-in unit tests for Property 26 (input + output schemas) and Property 1 (gate boundary). |
| `__tests__/run-manifest-store.test.mjs` | Node-built-in unit tests for Property 25 (durable persistence read-back consistency) against an in-memory storage shim. |

## Tool surface (Property 26 / R14.4)

| Tool | Required Approval_Gate | Schemas |
|---|---|---|
| `knowgrph.video_remix.run` | n/a (Director enforces gates per stage) | input + output (Run_Manifest) |
| `knowgrph.video_remix.research` | `paid-model-call` | input + output (Evidence_Pack) |
| `knowgrph.video_remix.storyboard` | `paid-model-call` | input + output (Kgc_Document + flow) |
| `knowgrph.video_remix.render` | `render-action` | input + output (assets + ledgerEventIds) |
| `knowgrph.video_remix.publish` | `cloud-deploy` | input + output (publishedUrls) |
| `knowgrph.video_remix.checkout` | `payment-action` | input + output (Stripe sessionId, payoutSettled) |

`buildKnowgrphMcpToolDefinitions()` in `tool-registry.mjs` is the canonical
builder; every entry carries both `inputSchema` and `outputSchema`.

## Durable Run_Manifest persistence (Property 25 / R14.2)

When the Director tool (`knowgrph.video_remix.run`) returns a Run_Manifest,
the Worker entry persists it to the `RUN_MANIFEST_STORE` Durable Object
keyed by `runId` before responding. Persistence is awaited inline; DO
writes complete in milliseconds, well within the 2,000 ms deadline imposed
by R14.2.

The `structuredContent` returned to the MCP caller is augmented with a
`persistence` block:

```json
{
  "persistence": {
    "persisted": true,
    "persistedAt": "2024-...Z",
    "readBackEndpoint": "/knowgrph/mcp/runs/<runId>",
    "deadlineMs": 2000,
    "error": null
  }
}
```

Read back the latest persisted state from any client:

```bash
curl -s https://airvio.co/knowgrph/mcp/runs/<runId>
```

Returns:

```json
{
  "runId": "<runId>",
  "persistedAt": "2024-...Z",
  "contractVersion": "knowgrph.video_remix/v0.1",
  "manifest": { /* full Run_Manifest */ }
}
```

`404 not_found` is returned when no manifest has been persisted for that
`runId` yet. Caller authentication and authorization on this read-back
path are enforced by the upstream AWS Agent_Api (R15) before forwarding.

The DO class lives in `run-manifest-store.mjs`. Pure persistence helpers
(`RunManifestPersistence`, `buildPersistenceRecord`,
`serializeManifestForStorage`, `extractRunId`) are exported for downstream
tasks (1.3 persistence-failure handling, 5.x Agent_Api forwarding,
9.x property-based and integration tests) to reuse.

## Approval-gate boundary (Property 1 / R14.6)

Stage tool calls flow through `executeKnowgrphMcpTool` in `tool-registry.mjs`.
Without a verified, unconsumed Approval_Token in `args.approvals[]` matching
the gate id from the table above, the call is withheld at the McpAgent
boundary and returns:

```json
{
  "status": "approval_required",
  "ok": false,
  "gateId": "<required gate>",
  "paidProviderCalls": 0,
  "runManifestStateChanged": false,
  "error": { "code": "approval_required", "message": "..." }
}
```

The Director tool (`knowgrph.video_remix.run`) reuses the existing gate
semantics from `mcp/video-remix-runtime.js` (`buildApprovalGates`,
live-without-approvals halt, dry-run resolution).

The full HITL_Gate_Service (token issuance, single-use enforcement, 15-min
validity window) is implemented in spec task 4.x. Stage harness wiring
(Exa / BytePlus / PixVerse / Stripe) lands in spec task 3.x.

## Local development

```bash
# from this directory
npm install
npm test                       # runs the Node-built-in unit tests
npx wrangler dev --config wrangler.toml
```

Hit the Streamable HTTP endpoint:

```bash
curl -sX POST http://localhost:8787/knowgrph/mcp \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Deployment

Gated by the `cloud-deploy` Approval_Gate (spec task 11.1):

```bash
npx wrangler deploy --config wrangler.toml
```

The route `airvio.co/knowgrph/mcp[*]` will route to this Worker, taking
precedence over the legacy `${APP_BASE_PATH}/mcp` handler in
`cloudflare/pages/knowgrph-agent-ready.mjs`. The Pages site continues to
serve discovery surfaces (`.well-known/*`, OpenAPI, A2A card, health).

## Notes for downstream tasks

- Task 1.2 (this task) added the `RunManifestStore` Durable Object and the
  `GET /knowgrph/mcp/runs/{id}` read-back route.
- Task 1.3 will tighten persistence-failure handling: retain the most
  recently persisted state, return a structured persistence-failure
  response, and emit an observability diagnostic. The current
  implementation surfaces failures as a non-null `persistence.error` on
  the tool response and keeps prior state intact (DO write is atomic).
- Task 1.4 will refine the tool listing endpoint to mirror the
  `tools/list` payload at `/knowgrph/mcp/tools` for non-MCP discovery
  callers; an initial JSON listing is already exposed.
- Task 1.5 will emit stage-transition diagnostics on stage transitions; the
  current Worker only handles boundary enforcement and tool dispatch.
- Tasks 4.1–4.5 implement Approval_Token issuance, single-use enforcement,
  and the 15-minute validity window. The boundary in
  `tool-registry.mjs` accepts any approved gate id today; tighter checks
  (signature, freshness, single-use) are deferred to those tasks.
