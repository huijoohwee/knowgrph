// Tests for the run-initiation display view-model
// (knowgrph-acos-mcp-connector spec, task 7.3 / R1.3 / design Correctness
// Property 32 / design Frontend `renderManifest`).
//
// Covers:
//   - the view lists EVERY planned stage in canonical order
//     (research -> storyboard -> render -> publish -> checkout)
//   - the budget cap is surfaced from the manifest
//   - the view is correct BEFORE any Approval_Gate is approved
//   - a minimal / empty manifest is tolerated gracefully (still lists all
//     planned stages; budget cap resolves to null)
//   - the guarding gate id is surfaced per stage and mirrors the worker tier
//
// ZERO network / ZERO browser.

import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRunInitiationView,
  resolveBudgetCapUsd,
  anyGateApproved,
  PLANNED_STAGE_ORDER,
  PLANNED_STAGE_GATES,
} from "../src/lib/run-initiation-view.js";

// --- Fixtures ---------------------------------------------------------------

/**
 * A live-without-approvals Run_Manifest as the Director emits at run initiation:
 * the runtime prepends an `ingest` stage carrying `{ referenceUrl, budgetUsd }`,
 * all spend gates are still `pending`, and budgetMeters are zeroed (Property 2).
 */
function initiatedManifest(overrides = {}) {
  return {
    runId: "run-init-1",
    state: "blocked",
    mode: "live",
    stages: [
      { id: "ingest", status: "complete", artifact: { referenceUrl: "https://example.com/v", budgetUsd: 42.5 } },
      { id: "research", status: "approval_required", retryCount: 0, costLog: null, artifact: {} },
      { id: "storyboard", status: "pending", retryCount: 0, costLog: null, artifact: null },
      { id: "render", status: "pending", retryCount: 0, costLog: null, artifact: null },
      { id: "publish", status: "pending", retryCount: 0, costLog: null, artifact: null },
      { id: "checkout", status: "pending", retryCount: 0, costLog: null, artifact: null },
    ],
    approvalGates: [
      { gateId: "paid-model-call", approvalState: "pending", estimatedCostUsd: 0, token: null },
      { gateId: "render-action", approvalState: "pending", estimatedCostUsd: 0, token: null },
      { gateId: "cloud-deploy", approvalState: "pending", estimatedCostUsd: 0, token: null },
      { gateId: "payment-action", approvalState: "pending", estimatedCostUsd: 0, token: null },
      { gateId: "authenticated-browser", approvalState: "pending", estimatedCostUsd: 0, token: null },
    ],
    budgetMeters: { estimatedCostUsd: 0, actualCostUsd: 0, providerSpendUsd: 0 },
    demoPack: null,
    failures: [],
    reconciliationFlags: [],
    ...overrides,
  };
}

// --- Every planned stage, in order ------------------------------------------

test("lists every planned stage in canonical order", () => {
  const view = buildRunInitiationView(initiatedManifest());
  assert.deepEqual(
    view.stages.map((s) => s.id),
    ["research", "storyboard", "render", "publish", "checkout"],
  );
  assert.equal(view.stageCount, 5);
  // `order` is strictly increasing and matches the canonical index.
  view.stages.forEach((s, i) => assert.equal(s.order, i));
});

test("order matches the worker-tier canonical stage order (no fork)", () => {
  const view = buildRunInitiationView(initiatedManifest());
  assert.deepEqual(view.stages.map((s) => s.id), [...PLANNED_STAGE_ORDER]);
});

test("the ingest preflight stage is excluded from the planned display", () => {
  const view = buildRunInitiationView(initiatedManifest());
  assert.ok(!view.stages.some((s) => s.id === "ingest"));
});

test("per-stage status is taken from the manifest when present", () => {
  const view = buildRunInitiationView(initiatedManifest());
  const research = view.stages.find((s) => s.id === "research");
  assert.equal(research.status, "approval_required");
  const render = view.stages.find((s) => s.id === "render");
  assert.equal(render.status, "pending");
});

test("each planned stage surfaces its guarding gate id (mirrors worker tier)", () => {
  const view = buildRunInitiationView(initiatedManifest());
  for (const s of view.stages) {
    assert.equal(s.gateId, PLANNED_STAGE_GATES[s.id]);
  }
});

test("each planned stage carries a human-readable label", () => {
  const view = buildRunInitiationView(initiatedManifest());
  for (const s of view.stages) {
    assert.equal(typeof s.label, "string");
    assert.ok(s.label.length > 0);
  }
});

// --- Budget cap surfaced ----------------------------------------------------

test("budget cap is surfaced from the ingest stage artifact", () => {
  const view = buildRunInitiationView(initiatedManifest());
  assert.equal(view.budgetCapUsd, 42.5);
});

test("budget cap is surfaced from a top-level budgetUsd payload (run-initiation)", () => {
  const view = buildRunInitiationView({ budgetUsd: 100, stages: [] });
  assert.equal(view.budgetCapUsd, 100);
});

test("an explicit top-level budgetCapUsd takes precedence", () => {
  const view = buildRunInitiationView(
    initiatedManifest({ budgetCapUsd: 7.5 }),
  );
  assert.equal(view.budgetCapUsd, 7.5);
});

test("resolveBudgetCapUsd returns null when no cap is present", () => {
  assert.equal(resolveBudgetCapUsd({ stages: [] }), null);
  assert.equal(resolveBudgetCapUsd({}), null);
});

test("resolveBudgetCapUsd rejects a non-finite / negative cap", () => {
  assert.equal(resolveBudgetCapUsd({ budgetUsd: "abc" }), null);
  assert.equal(resolveBudgetCapUsd({ budgetUsd: -5 }), null);
  assert.equal(resolveBudgetCapUsd({ budgetUsd: Infinity }), null);
});

// --- Correct before any gate approved ---------------------------------------

test("at initiation no gate is approved and the full plan is still shown", () => {
  const manifest = initiatedManifest();
  assert.equal(anyGateApproved(manifest), false);

  const view = buildRunInitiationView(manifest);
  assert.equal(view.anyGateApproved, false);
  // The full planned sequence and the budget cap are present pre-approval.
  assert.equal(view.stageCount, 5);
  assert.equal(view.budgetCapUsd, 42.5);
});

test("anyGateApproved flips true once a gate is approved", () => {
  const manifest = initiatedManifest();
  manifest.approvalGates[0].approvalState = "approved";
  assert.equal(anyGateApproved(manifest), true);
  // The planned list is unchanged regardless of approval state.
  const view = buildRunInitiationView(manifest);
  assert.equal(view.anyGateApproved, true);
  assert.equal(view.stageCount, 5);
});

// --- Minimal / empty manifest tolerated -------------------------------------

test("an empty manifest still yields the full planned stage list", () => {
  const view = buildRunInitiationView({});
  assert.deepEqual(
    view.stages.map((s) => s.id),
    ["research", "storyboard", "render", "publish", "checkout"],
  );
  assert.equal(view.stageCount, 5);
  assert.equal(view.budgetCapUsd, null);
  assert.equal(view.anyGateApproved, false);
  // Default status is applied when the manifest carries no stage entry.
  for (const s of view.stages) assert.equal(s.status, "planned");
});

test("a manifest with no stages[] is tolerated gracefully", () => {
  const view = buildRunInitiationView({ runId: "x", budgetUsd: 9.99 });
  assert.equal(view.stageCount, 5);
  assert.equal(view.budgetCapUsd, 9.99);
});

test("non-object / malformed input never throws and yields the full plan", () => {
  for (const bad of [null, undefined, 5, "x", [], true]) {
    const view = buildRunInitiationView(bad);
    assert.equal(view.stageCount, 5);
    assert.equal(view.budgetCapUsd, null);
    assert.equal(view.anyGateApproved, false);
  }
});

test("malformed stages entries are skipped without throwing", () => {
  const view = buildRunInitiationView({
    stages: [null, 5, { status: "running" }, { id: "render", status: "running" }],
  });
  assert.equal(view.stageCount, 5);
  const render = view.stages.find((s) => s.id === "render");
  assert.equal(render.status, "running");
});
