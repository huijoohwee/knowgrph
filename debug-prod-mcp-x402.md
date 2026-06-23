# Debug Session: prod-mcp-x402

- Status: OPEN
- Started: 2026-06-23
- Scope: Production MCP `406` responses on `airvio.co/knowgrph` and x402 fallback pay-to configuration.
- Constraints: No business-logic changes before runtime evidence confirms root cause.

## Hypotheses

1. Pages MCP content negotiation is rejecting the headers used by `agent-ready:check`.
2. Published Pages worker output differs from the source MCP route contract.
3. Production MCP route wiring is correct, but JSON-RPC method handling rejects the probe envelope.
4. x402 failures come from missing `X402_PAY_TO_ADDRESS` Worker vars, independent from MCP.
5. Cloudflare route precedence is sending MCP traffic to a non-MCP handler.

## Evidence Log

- Confirmed production route conflict before fix:
  - `POST https://airvio.co/knowgrph/mcp` with `Accept: application/json` returned `406 text/plain` and `Not Acceptable: Client must accept text/event-stream`.
  - `POST https://airvio.co/knowgrph/mcp` with `Accept: application/json, text/event-stream` returned `200 text/event-stream` from `serverInfo.name = "knowgrph-control-plane"`.
  - `GET https://b4dc0523.joohwee.pages.dev/knowgrph/mcp` returned the expected Pages JSON surface with `x-knowgrph-route-owner: knowgrph-agent-ready-pages`.
- Confirmed source ownership mismatch:
  - `cloudflare/workers/knowgrph-mcp/wrangler.toml` was routing the control-plane Worker on `airvio.co/knowgrph/mcp[*]`.
  - `cloudflare/pages/knowgrph-agent-ready.mjs` and `scripts/check-agent-ready.mjs` both expect the public agent-ready MCP surface on `/knowgrph/mcp`.
- Confirmed payment readiness root cause:
  - `GET https://airvio.co/api` returned `402` with a deterministic fallback `payTo`.
  - `cloudflare/workers/knowgrph-payment/wrangler.toml` still declares placeholder `X402_PAY_TO_ADDRESS = "0x0000000000000000000000000000000000000000"`.

## Fix Summary

- Moved the dedicated control-plane Worker route from `/knowgrph/mcp[*]` to `/knowgrph/control-plane/mcp[*]`.
- Updated the control-plane Worker source, run-manifest path references, runtime-proof defaults, deploy runbook, and focused docs/scripts to use the dedicated control-plane path.
- Redeployed:
  - `knowgrph-mcp` Worker version `91641d1d-eb75-45bd-bd9a-c3cea2c31e9c`
  - Pages preview `https://2a7cf1a1.joohwee.pages.dev`

## Post-Fix Verification

- `GET https://airvio.co/knowgrph/mcp` now returns `200 application/json` with `x-knowgrph-route-owner: knowgrph-agent-ready-pages`.
- `POST https://airvio.co/knowgrph/mcp` `initialize` now returns the expected Pages agent-ready MCP JSON response.
- `GET https://airvio.co/knowgrph/control-plane/mcp/health` returns `200` and `service = "knowgrph-mcp-worker"`.
- `POST https://airvio.co/knowgrph/control-plane/mcp` `initialize` returns `200 text/event-stream` with `serverInfo.name = "knowgrph-control-plane"`.
- `KNOWGRPH_AGENT_READY_BASE_URL=https://airvio.co/knowgrph npm run agent-ready:check` now passes `60/62`; the only remaining failures are:
  - `commerce-x402-payment-required`
  - `commerce-x402-api-root`

## Current Status

- Status: OPEN
- MCP route conflict: fixed and verified live.
- x402 production authority: still blocked on an operator-owned `X402_PAY_TO_ADDRESS`.

## Next Steps

1. Reproduce MCP failures with explicit request headers and bodies.
2. Compare source Pages/MCP handlers with generated `huijoohwee/_worker.js`.
3. Inspect payment worker x402 env handling and deployment path.
4. Implement minimal fixes after evidence confirms the root cause.
