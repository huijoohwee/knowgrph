// INTEGRATION TEST (gated for live deployment) — Agent_Api -> McpAgent MCP
// Streamable HTTP forwarding (knowgrph-acos-mcp-connector spec, task 9.2 / R12.2).
//
// WHAT THIS EXERCISES (cross-tier, IN-PROCESS, ZERO live network):
//   The AWS Agent_Api `POST /run` forwarder is wired DIRECTLY to the Cloudflare
//   control-plane McpAgent tool-call dispatcher through the real in-process MCP
//   adapter (`createInProcessMcpTransport`). A schema-validated request flows
//   POST /run -> createForwardingRunHandler -> createMcpForwarder -> [MCP
//   Streamable HTTP `tools/call` envelope] -> dispatchKnowgrphMcpToolCall ->
//   tool-registry -> runVideoRemix (Director) -> real RunManifestStore durable
//   persistence, and the resulting Run_Manifest flows back through the forwarder
//   to the HTTP 202 response. This is a REAL wiring of the two tiers to each
//   other, not a spy.
//
// LIVE-DEPLOYMENT GATING: these run in-process here (no socket, structural 2s
// forwarding deadline asserted via injected elapsed signal). The SAME forwarder
// is pointed at airvio.co/knowgrph/mcp in task 11.4 by swapping the in-process
// transport for a real `fetch` — no caller changes.
//
// Examples (1-3): (1) end-to-end dry-run forward returns a real Run_Manifest;
// (2) live-without-approvals forward halts with zero spend across the seam;
// (3) the 2,000 ms forwarding-deadline metadata is carried across the boundary.

import test from "node:test";
import assert from "node:assert/strict";

import { createForwardingRunHandler } from "../aws/agent-api/src/handlers/run.js";
import { createMcpForwarder, MCP_FORWARD_DEADLINE_MS } from "../aws/agent-api/src/lib/mcp-forwarder.js";
import { createInProcessMcpTransport } from "./lib/in-process-mcp-adapter.mjs";
import { readRunManifestThroughNamespace } from "../cloudflare/workers/knowgrph-mcp/run-manifest/persistence.mjs";

function validBody(overrides = {}) {
  return {
    referenceUrl: "https://example.com/reference-video.mp4",
    brief: "Remix this reference into a 30s vertical promo with three shots.",
    budgetUsd: 25,
    approvals: [],
    ...overrides,
  };
}

// --- Example 1: end-to-end dry-run forward returns a real Run_Manifest -------

test("R12.2 integration: POST /run forwards across the tier seam to the Director and returns a real Run_Manifest", async () => {
  const { transport, calls, namespace } = createInProcessMcpTransport();
  const handler = createForwardingRunHandler({ transport });

  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify(validBody({ brief: "Dry-run remix planning across the tier boundary.", mode: "dry-run" })),
  });

  // The forward crossed the boundary exactly once and returned HTTP 202.
  assert.equal(res.statusCode, 202);
  assert.equal(calls.length, 1, "exactly one MCP Streamable HTTP forward");

  const payload = JSON.parse(res.body);
  assert.equal(payload.forwarded, true);
  assert.equal(payload.tool, "knowgrph.video_remix.run");

  // The structuredContent is the REAL Director Run_Manifest (not a stub).
  const manifest = payload.result.structuredContent;
  assert.ok(manifest.runId, "Director produced a runId");
  assert.equal(manifest.mode, "dry-run");
  assert.ok(Array.isArray(manifest.approvalGates) && manifest.approvalGates.length >= 5);

  // The cross-tier dispatch also persisted the manifest in the real DO store.
  const persisted = await readRunManifestThroughNamespace(namespace, manifest.runId);
  assert.ok(persisted, "Run_Manifest was persisted through the real durable store");
  assert.equal(persisted.manifest.runId, manifest.runId);
});

// --- Example 2: live-without-approvals halts with zero spend across the seam -

test("R12.2 integration: a live forward with empty approvals halts blocked with zero spend end-to-end (R2.3 across the seam)", async () => {
  const { transport } = createInProcessMcpTransport();
  const handler = createForwardingRunHandler({ transport });

  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify(validBody({ brief: "Live mode, no approval tokens supplied.", mode: "live", approvals: [] })),
  });

  assert.equal(res.statusCode, 202);
  const manifest = JSON.parse(res.body).result.structuredContent;
  assert.equal(manifest.state, "blocked");
  assert.equal(manifest.budgetMeters.estimatedCostUsd, 0);
  assert.equal(manifest.budgetMeters.paidProviderCalls, 0);
});

// --- Example 3: the 2,000 ms forwarding-deadline metadata crosses the boundary

test("R12.2 integration: the forwarding-deadline metadata is carried across the tier seam (within + past deadline)", async () => {
  const { transport } = createInProcessMcpTransport();

  // Within deadline (synchronous in-process dispatch).
  const within = await createMcpForwarder({ transport })({ body: validBody() });
  assert.equal(within.forwardDeadlineMs, MCP_FORWARD_DEADLINE_MS);
  assert.equal(within.forwardWithinDeadline, true);
  assert.equal(within.result.structuredContent.mode, "dry-run");

  // Injected slow forward beyond 2,000 ms is flagged past-deadline (R12.2),
  // while the request still completes across the boundary.
  const slow = await createMcpForwarder({ transport, forwardElapsedMs: MCP_FORWARD_DEADLINE_MS + 250 })({ body: validBody() });
  assert.equal(slow.forwardWithinDeadline, false);
  assert.equal(slow.forwardElapsedMs, 2250);
  assert.ok(slow.result.structuredContent.runId, "the forward still produced a Run_Manifest");
});
