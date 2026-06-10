// INTEGRATION TEST (gated for live deployment) — control-plane model calls
// route through the Cloudflare AI Gateway (knowgrph-acos-mcp-connector spec,
// task 9.2 / R11.2, R11.4).
//
// WHAT THIS EXERCISES (IN-PROCESS, ZERO live network):
//   The control plane (and the product Frontend) MUST route EVERY model call
//   through the single Cloudflare AI Gateway control plane; no model call may
//   target a paid-provider host directly (R11.4), and the Agent_Api tier never
//   issues a paid-provider request (R11.2). This wires the real AI Gateway
//   routing helper (`web/src/lib/ai-gateway.js routeThroughAiGateway`) and
//   asserts a constructed model-call URL targets the gateway host ONLY, and
//   that a direct paid-provider host is rejected at the chokepoint.
//
// LIVE-DEPLOYMENT GATING: the routing helper is host-pure (no network). In task
// 11.4 the same constructed gateway URL is used by the live model client; this
// integration test pins the routing contract so the live call cannot regress to
// a direct provider host.
//
// Examples (1-3): (1) a control-plane model call targets the gateway host only
// (R11.4); (2) a direct paid-provider host is rejected (R11.2/R11.4 boundary);
// (3) the forwarded Agent_Api envelope carries no model-provider host (R11.2).

import test from "node:test";
import assert from "node:assert/strict";

import {
  routeThroughAiGateway,
  assertAiGatewayUrl,
  isAiGatewayUrl,
  isPaidProviderHost,
  hostOf,
  CLOUDFLARE_AI_GATEWAY_HOST,
  AiGatewayRoutingError,
  PAID_PROVIDER_HOSTS,
} from "../web/src/lib/ai-gateway.js";
import { buildForwardHttpRequest } from "../aws/agent-api/src/lib/mcp-forwarder.js";

const GATEWAY_IDS = { accountId: "acct-int-9p2", gatewayId: "knowgrph-gw" };

// --- Example 1: a control-plane model call targets the gateway host only -----

test("R11.4 integration: a routed model call targets the Cloudflare AI Gateway host ONLY", () => {
  // A storyboard/research model call the control plane would issue, routed
  // through the gateway helper (the single model chokepoint).
  const url = routeThroughAiGateway({ ...GATEWAY_IDS, provider: "openai", path: "chat/completions" });

  assert.equal(hostOf(url), CLOUDFLARE_AI_GATEWAY_HOST, "model call host is the AI Gateway host");
  assert.equal(isAiGatewayUrl(url), true);
  assert.equal(isPaidProviderHost(hostOf(url)), false, "the gateway host is not a paid-provider host");
  // The path the gateway proxies upstream is preserved after the gateway base.
  assert.match(url, /\/v1\/acct-int-9p2\/knowgrph-gw\/openai\/chat\/completions$/);
  // Defense-in-depth assertion the helper itself enforces.
  assert.equal(assertAiGatewayUrl(url), url);
});

// --- Example 2: a direct paid-provider host is rejected at the chokepoint ----

test("R11.2/R11.4 integration: a direct paid-provider host is rejected by the routing chokepoint", () => {
  // No routing path can ever produce a direct provider URL: asserting one
  // throws the typed routing error (the gateway is the only allowed host).
  for (const host of ["api.openai.com", "ark.cn-beijing.volces.com", "api.stripe.com"]) {
    assert.ok(PAID_PROVIDER_HOSTS.includes(host), `${host} is a known paid-provider host`);
    assert.throws(
      () => assertAiGatewayUrl(`https://${host}/v1/chat/completions`),
      (err) => err instanceof AiGatewayRoutingError && err.code === "direct_provider_host",
      `${host} must be rejected as a direct provider host`,
    );
  }
});

// --- Example 3: the Agent_Api forward carries no model-provider host (R11.2) -

test("R11.2 integration: the Agent_Api MCP forward targets the control plane, not any paid-provider host", () => {
  // The Agent_Api tier never calls a paid model provider directly; it forwards
  // to the McpAgent. The forward envelope's destination must not be a provider.
  const req = buildForwardHttpRequest({
    referenceUrl: "https://example.com/ref.mp4",
    brief: "Forward to the control plane, never a provider.",
    budgetUsd: 10,
    approvals: [],
  });

  const forwardHost = hostOf(req.url);
  assert.equal(isPaidProviderHost(forwardHost), false, "Agent_Api never forwards to a paid-provider host (R11.2)");
  assert.equal(forwardHost, "airvio.co", "the forward targets the control-plane MCP endpoint");
});
