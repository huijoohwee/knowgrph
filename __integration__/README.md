# Integration tests — knowgrph ↔ agentic-canvas-os MCP connector (spec task 9.2)

These are **integration-style tests** (1–3 examples each) that wire the
production modules of the connector **to each other in-process**, across the
AWS ↔ Cloudflare ↔ Vercel tier boundaries, with **ZERO live network/AWS calls**.

> **Gated for live deployment.** Each test runs in-process here using the real
> modules wired through deterministic seams (injected clocks / elapsed signals,
> an in-memory durable store, in-process tool dispatch). The **same wiring** is
> pointed at the live endpoints in **spec task 11.4** (post-deploy verification)
> by swapping the in-process transport/probe for a real `fetch`/AWS call — no
> caller changes required. Timing contracts (the 2,000 ms forward deadline, the
> 5 s health deadline, the 2 s Budget_Meters update) are asserted **structurally**
> (no real timers); the live scheduler enforces the wall-clock bounds in 11.4.

## What each suite exercises (real cross-tier wiring)

| File | Requirements | In-process wiring |
|---|---|---|
| `agent-api-mcp-forwarding.integration.test.mjs` | R12.2 | Agent_Api `POST /run` forwarder → **in-process MCP adapter** → McpAgent `dispatchKnowgrphMcpToolCall` → Director `runVideoRemix` → real `RunManifestStore` durable persistence |
| `ai-gateway-routing.integration.test.mjs` | R11.2, R11.4 | Control-plane/Frontend model-call routing through the real `routeThroughAiGateway` helper; asserts the model call targets the Cloudflare AI Gateway host only and the Agent_Api forward never targets a paid-provider host |
| `demo-pack-health.integration.test.mjs` | R3.2, R3.4 | Demo_Pack `buildDemoPack` / `runHealthCheck` retry loop → **in-process health probe** → real Agent_Api `GET /health` Lambda; asserts 200 within the 5 s deadline and the required Demo_Pack `urls[]` |
| `budget-meters-timing.integration.test.mjs` | R2.5 | Live, approved Director run with injected spend events driven across the Agent_Api → McpAgent seam; asserts Budget_Meters reflect every spend event in the same synchronous pass |

## Shared in-process adapters (`lib/`)

- `lib/in-process-mcp-adapter.mjs` — the real transport seam wiring the Agent_Api
  forwarder to the McpAgent worker dispatch (plus an in-memory `RUN_MANIFEST_STORE`
  namespace built from the real `RunManifestStore` DO class).
- `lib/in-process-health-transport.mjs` — the real probe wiring the Demo_Pack
  health-check loop to the Agent_Api `GET /health` Lambda.

## Running

```bash
node --test __integration__/*.integration.test.mjs
```

These complement (do not replace) the per-tier unit suites (`__tests__/`) and the
property-based suites (`__pbt__/`).
