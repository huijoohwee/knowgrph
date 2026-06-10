// Tests for typed-MCP-error mapping in the AWS Agent-API tier
// (knowgrph-acos-mcp-connector spec, task 5.9 / R12.7 / design Agent_Api
// "MCP error mapping" / Correctness Property 24).
//
// Covers the focused behaviors the task calls out, with ZERO live network/AWS
// calls (the mapper is a pure, deterministic function):
//   1. an "approval required" MCP error -> gate prompt (pending approvalGate),
//      prior manifest state preserved
//   2. a generic MCP error -> failure record appended to failures[], prior
//      state preserved
//   3. no MCP error -> manifest unchanged
//   4. the mapping NEVER mutates the input manifest (returns a derived copy)

import test from "node:test";
import assert from "node:assert/strict";

import {
  mapMcpErrorToManifest,
  mapForwarderResultToManifest,
  isApprovalRequiredError,
  buildGatePromptFromMcpError,
  buildFailureRecordFromMcpError,
  MCP_ERROR_DISPOSITION,
  MCP_APPROVAL_REQUIRED_STATUS,
  APPROVAL_GATE_STATE,
} from "../src/lib/mcp-error-mapping.js";

// --- Helpers ----------------------------------------------------------------

/**
 * A representative existing Run_Manifest with prior state across every field
 * the mapping must preserve (design Data Models -> Run_Manifest).
 */
function existingManifest() {
  return {
    runId: "run-xyz",
    state: "running",
    mode: "live",
    stages: [
      { id: "research", status: "completed", retryCount: 0 },
      { id: "storyboard", status: "running", retryCount: 1 },
    ],
    approvalGates: [
      { gateId: "paid-model-call", approvalState: "approved", estimatedCostUsd: 0.5, token: { sig: "t1" } },
    ],
    budgetMeters: { estimatedCostUsd: 0.5, actualCostUsd: 0.25, providerSpendUsd: 0.25 },
    demoPack: null,
    failures: [{ stageId: "render", finalRetryCount: 3, reason: "earlier failure" }],
    reconciliationFlags: ["run-xyz:note"],
  };
}

/**
 * An "approval required" typed MCP error mirroring the McpAgent gate-boundary
 * envelope (worker `buildApprovalRequiredEnvelope`) surfaced as a JSON-RPC
 * error nesting the structured envelope under `data`.
 */
function approvalRequiredError() {
  return {
    code: -32001,
    message: "Stage tool render is gated by render-action.",
    data: {
      status: MCP_APPROVAL_REQUIRED_STATUS,
      gateId: "render-action",
      estimatedCostUsd: 4.2,
      error: { code: MCP_APPROVAL_REQUIRED_STATUS, message: "approval required" },
    },
  };
}

/** A generic (non-approval) typed MCP error. */
function genericError() {
  return {
    code: "render_failed",
    message: "provider returned no asset within deadline",
    data: { stageId: "render", finalRetryCount: 8 },
  };
}

// --- 1. Approval-required error -> gate prompt, prior state preserved -------

test("approval-required MCP error maps to a pending gate prompt", () => {
  const manifest = existingManifest();
  const { disposition, manifest: out, gatePrompt } = mapMcpErrorToManifest(
    manifest,
    approvalRequiredError(),
  );

  assert.equal(disposition, MCP_ERROR_DISPOSITION.GATE_PROMPT);
  // A new pending Approval_Gate is appended for the Frontend to render.
  const pending = out.approvalGates.find((g) => g.gateId === "render-action");
  assert.ok(pending, "a render-action gate was appended");
  assert.equal(pending.approvalState, APPROVAL_GATE_STATE.PENDING);
  assert.equal(pending.estimatedCostUsd, 4.2);
  assert.equal(pending.token, null);
  assert.deepEqual(gatePrompt, pending);
});

test("approval-required mapping preserves prior manifest state", () => {
  const manifest = existingManifest();
  const before = JSON.parse(JSON.stringify(manifest));
  const { manifest: out } = mapMcpErrorToManifest(manifest, approvalRequiredError());

  // Run_State and all prior fields untouched; only an append happened.
  assert.equal(out.state, before.state);
  assert.deepEqual(out.stages, before.stages);
  assert.deepEqual(out.budgetMeters, before.budgetMeters);
  assert.deepEqual(out.failures, before.failures);
  assert.deepEqual(out.reconciliationFlags, before.reconciliationFlags);
  // Prior approval gate retained, plus exactly one appended.
  assert.equal(out.approvalGates.length, before.approvalGates.length + 1);
  assert.deepEqual(out.approvalGates[0], before.approvalGates[0]);
});

test("approval-required append is idempotent for the same pending gate", () => {
  const manifest = existingManifest();
  const once = mapMcpErrorToManifest(manifest, approvalRequiredError()).manifest;
  const twice = mapMcpErrorToManifest(once, approvalRequiredError()).manifest;
  const renderGates = twice.approvalGates.filter((g) => g.gateId === "render-action");
  assert.equal(renderGates.length, 1, "no duplicate pending gate for the same gateId");
});

// --- 2. Generic error -> failure record appended, prior state preserved -----

test("generic MCP error maps to a failure record appended to failures[]", () => {
  const manifest = existingManifest();
  const { disposition, manifest: out, failureRecord } = mapMcpErrorToManifest(
    manifest,
    genericError(),
  );

  assert.equal(disposition, MCP_ERROR_DISPOSITION.FAILURE_RECORD);
  assert.equal(out.failures.length, 2, "prior failure retained, one appended");
  const appended = out.failures[out.failures.length - 1];
  assert.equal(appended.stageId, "render");
  assert.equal(appended.finalRetryCount, 8);
  assert.equal(appended.reason, "provider returned no asset within deadline");
  assert.deepEqual(failureRecord, appended);
});

test("generic-error mapping preserves prior manifest state", () => {
  const manifest = existingManifest();
  const before = JSON.parse(JSON.stringify(manifest));
  const { manifest: out } = mapMcpErrorToManifest(manifest, genericError());

  assert.equal(out.state, before.state);
  assert.deepEqual(out.stages, before.stages);
  assert.deepEqual(out.approvalGates, before.approvalGates);
  assert.deepEqual(out.budgetMeters, before.budgetMeters);
  assert.deepEqual(out.reconciliationFlags, before.reconciliationFlags);
  // Prior failure retained as the first entry.
  assert.deepEqual(out.failures[0], before.failures[0]);
});

test("generic error without a stageId falls back to the provided stage id", () => {
  const record = buildFailureRecordFromMcpError(
    { code: "boom", message: "kaboom" },
    { stageId: "checkout" },
  );
  assert.equal(record.stageId, "checkout");
  assert.equal(record.finalRetryCount, 0);
  assert.equal(record.reason, "kaboom");
});

test("generic error with no stage id anywhere uses 'unknown'", () => {
  const record = buildFailureRecordFromMcpError({ code: "boom", message: "kaboom" });
  assert.equal(record.stageId, "unknown");
});

// --- 3. No MCP error -> manifest unchanged ----------------------------------

for (const noError of [null, undefined, false, 0, ""]) {
  test(`no MCP error (${JSON.stringify(noError)}) leaves the manifest unchanged`, () => {
    const manifest = existingManifest();
    const before = JSON.parse(JSON.stringify(manifest));
    const { disposition, manifest: out } = mapMcpErrorToManifest(manifest, noError);

    assert.equal(disposition, MCP_ERROR_DISPOSITION.UNCHANGED);
    assert.deepEqual(out, before, "manifest is structurally unchanged");
  });
}

test("a forwarder result with no mcpError leaves the manifest unchanged", () => {
  const manifest = existingManifest();
  const before = JSON.parse(JSON.stringify(manifest));
  const forwarderResult = { forwarded: true, mcpError: null, result: { structuredContent: {} } };
  const { disposition, manifest: out } = mapForwarderResultToManifest(manifest, forwarderResult);

  assert.equal(disposition, MCP_ERROR_DISPOSITION.UNCHANGED);
  assert.deepEqual(out, before);
});

test("mapForwarderResultToManifest extracts and maps a carried mcpError", () => {
  const manifest = existingManifest();
  const forwarderResult = { forwarded: true, mcpError: genericError(), result: null };
  const { disposition, manifest: out } = mapForwarderResultToManifest(manifest, forwarderResult);
  assert.equal(disposition, MCP_ERROR_DISPOSITION.FAILURE_RECORD);
  assert.equal(out.failures.length, 2);
});

// --- 4. The mapping never mutates the input manifest ------------------------

test("mapping never mutates the input manifest (approval-required path)", () => {
  const manifest = existingManifest();
  const snapshot = JSON.parse(JSON.stringify(manifest));
  const { manifest: out } = mapMcpErrorToManifest(manifest, approvalRequiredError());

  // Input untouched.
  assert.deepEqual(manifest, snapshot, "input manifest is not mutated");
  // Output is a distinct object (derived copy), and nested arrays are clones.
  assert.notEqual(out, manifest);
  assert.notEqual(out.approvalGates, manifest.approvalGates);
  out.approvalGates.push({ gateId: "scribble" });
  assert.deepEqual(manifest, snapshot, "post-hoc mutation of output never leaks to input");
});

test("mapping never mutates the input manifest (failure-record path)", () => {
  const manifest = existingManifest();
  const snapshot = JSON.parse(JSON.stringify(manifest));
  const { manifest: out } = mapMcpErrorToManifest(manifest, genericError());

  assert.deepEqual(manifest, snapshot, "input manifest is not mutated");
  assert.notEqual(out.failures, manifest.failures);
  out.failures.push({ stageId: "scribble", finalRetryCount: 0, reason: "x" });
  assert.deepEqual(manifest, snapshot, "post-hoc mutation of output never leaks to input");
});

// --- Classification + helper coverage ---------------------------------------

test("isApprovalRequiredError detects the status at several nesting depths", () => {
  assert.equal(isApprovalRequiredError({ code: MCP_APPROVAL_REQUIRED_STATUS }), true);
  assert.equal(isApprovalRequiredError({ data: { status: MCP_APPROVAL_REQUIRED_STATUS } }), true);
  assert.equal(
    isApprovalRequiredError({ data: { error: { code: MCP_APPROVAL_REQUIRED_STATUS } } }),
    true,
  );
  assert.equal(isApprovalRequiredError({ code: "render_failed" }), false);
  assert.equal(isApprovalRequiredError(null), false);
});

test("buildGatePromptFromMcpError defaults estimatedCostUsd to 0 when absent", () => {
  const gate = buildGatePromptFromMcpError({
    data: { status: MCP_APPROVAL_REQUIRED_STATUS, gateId: "payment-action" },
  });
  assert.equal(gate.gateId, "payment-action");
  assert.equal(gate.approvalState, APPROVAL_GATE_STATE.PENDING);
  assert.equal(gate.estimatedCostUsd, 0);
  assert.equal(gate.token, null);
});

test("mapping seeds approvalGates/failures arrays when the manifest lacks them", () => {
  const gateOut = mapMcpErrorToManifest({ runId: "r1", state: "running" }, approvalRequiredError());
  assert.ok(Array.isArray(gateOut.manifest.approvalGates));
  assert.equal(gateOut.manifest.approvalGates.length, 1);

  const failOut = mapMcpErrorToManifest({ runId: "r1", state: "running" }, genericError());
  assert.ok(Array.isArray(failOut.manifest.failures));
  assert.equal(failOut.manifest.failures.length, 1);
});
