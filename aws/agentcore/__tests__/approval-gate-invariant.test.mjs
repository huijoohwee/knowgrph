// Approval-gate invariant preserved THROUGH the AWS Bedrock AgentCore Runtime.
//
// Spec: knowgrph-acos-mcp-connector, task 13.5
// (R4.2, R4.3, R11.6, R14.6; Correctness Property 1 — the approval-gate
// invariant). Cross-ref: decision 13.0 (`docs/knowgrph-acos-topology-decision.md`
// › "AgentCore Runtime artifact shape") — the AgentCore artifact is a THIN
// MCP-forwarding adapter; ALL gate logic stays on the Cloudflare control plane
// (`Hitl_Gate_Service` + the `McpAgent` boundary in
// `cloudflare/workers/knowgrph-mcp`).
//
//   Property 1 (boundary slice through AgentCore): a tool invocation of an
//   approval-gated stage tool routed via the AgentCore-hosted MCP server
//   (`createAgentCoreMcpHandler`, task 13.1) BEFORE approval is WITHHELD, leaves
//   the forwarded Run_Manifest gate state UNCHANGED, performs ZERO paid-provider
//   calls, and returns "approval required". The AgentCore tier duplicates NO
//   gate logic — it forwards to the control plane and relays the verdict.
//
// These tests target the EXISTING task-13.1 forwarder (`src/mcp-server.js`)
// rather than re-deriving a parallel forward path (reuse-over-rebuild; 13.5
// forbids duplicating gate logic in the AgentCore tier). They are NETWORK-FREE
// and DETERMINISTIC: the "control plane" is mocked by an injected transport
// seam that runs the REAL control-plane gate logic (`executeKnowgrphMcpTool`
// from `cloudflare/workers/knowgrph-mcp`) and wraps its envelope in a JSON-RPC
// `tools/call` result. Using the actual control-plane enforcement as the mock
// backend is the strongest proof that the AgentCore tier adds NO gate logic of
// its own: the gate decision is made entirely on the control plane and the
// AgentCore handler relays it unchanged.
//
// Full property-based coverage of Property 1 (≥100 iterations, fast-check)
// lives in spec task 9.1; these are example/boundary checks for task 13.5.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createAgentCoreMcpHandler,
  MCP_PATH,
  MCP_STAGE_TOOL_NAMES,
} from "../src/mcp-server.js";

// The REAL control-plane gate logic + the canonical stage->gate map. Imported
// ONLY by this test to model the mocked control plane; the AgentCore handler
// (`src/mcp-server.js`) imports nothing from the control plane (R11 boundary).
import {
  executeKnowgrphMcpTool,
  KNOWGRPH_MCP_STAGE_GATES,
} from "../../../cloudflare/workers/knowgrph-mcp/tool-registry.mjs";

const ENDPOINT = "https://airvio.co/knowgrph/mcp";

/**
 * A mocked control-plane MCP Streamable HTTP transport. It receives the
 * JSON-RPC `tools/call` the AgentCore handler builds, runs the REAL
 * control-plane gate enforcement, and returns a JSON-RPC RESULT envelope
 * (the shape `executeKnowgrphMcpTool` produces — an `approval_required`
 * `structuredContent` with `ok: false`, NOT a JSON-RPC protocol error).
 *
 * It tracks the number of forwards (to prove the AgentCore tier FORWARDED
 * rather than short-circuiting with its own gate logic) and the total
 * paid-provider calls the control plane reports (to prove zero paid calls).
 */
function createMockControlPlane() {
  let forwardCount = 0;
  let paidProviderCalls = 0;
  const transport = async (httpRequest) => {
    forwardCount += 1;
    const params = httpRequest?.body?.params ?? {};
    const toolName = params.name;
    const args = params.arguments ?? {};
    const result = executeKnowgrphMcpTool(toolName, args);
    paidProviderCalls += Number(result.structuredContent?.paidProviderCalls ?? 0);
    return {
      jsonrpc: "2.0",
      id: httpRequest?.body?.id ?? 1,
      result: {
        content: [{ type: "text", text: result.text }],
        structuredContent: result.structuredContent,
        isError: result.ok === false,
      },
    };
  };
  return {
    transport,
    getForwardCount: () => forwardCount,
    getPaidProviderCalls: () => paidProviderCalls,
  };
}

/** Build a normalized AgentCore MCP `tools/call` request descriptor. */
function toolCall(name, args, id = 1) {
  return {
    method: "POST",
    path: MCP_PATH,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  };
}

// ── Property 1 (withheld path) for every approval-gated stage tool ──────────
for (const stageToolName of MCP_STAGE_TOOL_NAMES) {
  const expectedGateId = KNOWGRPH_MCP_STAGE_GATES[stageToolName];

  test(`Property 1 / R14.6: withheld ${stageToolName} via AgentCore returns approval_required, zero paid calls, manifest unchanged`, async () => {
    const controlPlane = createMockControlPlane();
    const handle = createAgentCoreMcpHandler({
      endpoint: ENDPOINT,
      transport: controlPlane.transport,
    });

    // Invoke the gated stage tool BEFORE approval (empty approvals[]).
    const res = await handle(toolCall(stageToolName, { approvals: [] }));

    // The AgentCore tier FORWARDED the call (it applied no gate logic of its
    // own); the control plane was reached exactly once.
    assert.equal(res.statusCode, 200);
    assert.equal(controlPlane.getForwardCount(), 1, "must forward exactly once");

    const body = JSON.parse(res.body);
    const envelope = body.result?.structuredContent;
    assert.ok(envelope, "control-plane envelope must be relayed");

    // (R14.6) "approval required" surfaced, relayed unchanged from the control
    // plane (R4.2 render gate, R4.3 payment gate, R11.6 token requirement).
    assert.equal(envelope.status, "approval_required");
    assert.equal(envelope.gateId, expectedGateId);
    assert.equal(envelope.error?.code, "approval_required");
    assert.match(body.result.content[0].text, /approval/i);

    // Zero paid-provider calls — as the control plane reports it and in total.
    assert.equal(envelope.paidProviderCalls, 0);
    assert.equal(controlPlane.getPaidProviderCalls(), 0);

    // The forwarded Run_Manifest gate state is left UNCHANGED.
    assert.equal(envelope.runManifestStateChanged, false);

    // No gate logic duplicated/altered in AgentCore: the relayed envelope is
    // byte-for-byte the control plane's own envelope.
    const controlPlaneEnvelope = executeKnowgrphMcpTool(stageToolName, {
      approvals: [],
    }).structuredContent;
    assert.deepEqual(envelope, controlPlaneEnvelope);
  });
}

// ── Contrast: the forward path is GENERAL — an approved stage call is relayed
//    just the same, proving the gate DECISION belongs to the control plane and
//    not to the AgentCore forwarder. ─────────────────────────────────────────
test("R14.6 contrast: an approved stage call via AgentCore is relayed (deferred_to_director), still zero paid calls", async () => {
  const controlPlane = createMockControlPlane();
  const handle = createAgentCoreMcpHandler({
    endpoint: ENDPOINT,
    transport: controlPlane.transport,
  });

  const res = await handle(
    toolCall("knowgrph.video_remix.research", {
      approvals: ["paid-model-call"],
      referenceUrl: "https://example.com/clip",
    }),
  );

  assert.equal(res.statusCode, 200);
  assert.equal(controlPlane.getForwardCount(), 1);
  const envelope = JSON.parse(res.body).result?.structuredContent;
  assert.ok(envelope);
  // The control plane (not AgentCore) decided the gate was satisfied.
  assert.equal(envelope.status, "deferred_to_director");
  assert.equal(envelope.paidProviderCalls, 0);
  assert.equal(envelope.runManifestStateChanged, false);
  assert.equal(controlPlane.getPaidProviderCalls(), 0);
});

// ── The AgentCore tier holds NO gate-decision authority: a render call carrying
//    a MISMATCHED approval is still withheld by the control plane and relayed. ─
test("Property 1: AgentCore relays the control plane's withhold even when a mismatched approval is present", async () => {
  const controlPlane = createMockControlPlane();
  const handle = createAgentCoreMcpHandler({
    endpoint: ENDPOINT,
    transport: controlPlane.transport,
  });

  // `render` requires `render-action`; present an unrelated gate id.
  const res = await handle(
    toolCall("knowgrph.video_remix.render", { approvals: ["payment-action"] }),
  );

  const envelope = JSON.parse(res.body).result?.structuredContent;
  assert.equal(envelope.status, "approval_required");
  assert.equal(envelope.gateId, KNOWGRPH_MCP_STAGE_GATES["knowgrph.video_remix.render"]);
  assert.equal(envelope.paidProviderCalls, 0);
  assert.equal(envelope.runManifestStateChanged, false);
  assert.equal(controlPlane.getPaidProviderCalls(), 0);
});

// ── Spend isolation / fail-closed (R11): with no control-plane endpoint wired,
//    a gated stage call must NOT silently succeed or make a live call — it fails
//    closed (HTTP 501), so no Approval_Gate can ever be bypassed on AWS. ───────
test("R11 fail-closed: un-wired AgentCore handler returns 501 for a gated stage call (no silent paid path)", async () => {
  const handle = createAgentCoreMcpHandler({ env: {} }); // no endpoint -> no transport
  const res = await handle(
    toolCall("knowgrph.video_remix.render", { approvals: [] }),
  );
  assert.equal(res.statusCode, 501);
  assert.equal(JSON.parse(res.body).error.code, "not_implemented");
});
