// INTEGRATION TEST (gated for live deployment) — Budget_Meters update timing on
// live spend events (knowgrph-acos-mcp-connector spec, task 9.2 / R2.5).
//
// WHAT THIS EXERCISES (cross-tier, IN-PROCESS, ZERO live network):
//   R2.5: WHILE Run_State is in-progress, THE Director SHALL update
//   Budget_Meters within 2 seconds of each spend event. A LIVE, fully-approved
//   Director run with injected spend signals (model actual cost, render provider
//   spend, cumulative spend) is driven across the Agent_Api -> McpAgent seam via
//   the real in-process MCP adapter, and the resulting Run_Manifest Budget_Meters
//   are asserted to reflect EVERY recorded spend event in the same synchronous
//   pass — the structural realization of the "within 2s of each spend event"
//   contract (no real timer; the live scheduler enforces the wall-clock bound,
//   wired in task 11.4).
//
// LIVE-DEPLOYMENT GATING: the timing contract is asserted structurally here. In
// task 11.4 the same Director runs against live spend events on the deployed
// control plane; this test pins the same-pass update invariant so a live
// regression (stale meters lagging a spend event) is caught.
//
// Examples (1-3): (1) a live run's meters reflect every spend event end-to-end
// across the seam (R2.5); (2) the same-pass guarantee holds directly on the
// budget-meters module for injected live spend events; (3) the cumulative meters
// equal the spend-event sums exactly (the structural within-2s check).

import test from "node:test";
import assert from "node:assert/strict";

import { createForwardingRunHandler } from "../aws/agent-api/src/handlers/run.js";
import { createInProcessMcpTransport } from "./lib/in-process-mcp-adapter.mjs";
import {
  buildBudgetMetersUpdate,
  aggregateSpendEvents,
  budgetMetersReflectSpendEvents,
} from "../mcp/video-remix/budget-meters.js";

// A fully-approved live run so spend boundaries are crossed and spend events
// (model Cost_Logs + render provider spend + cumulative spend) are recorded.
function liveSpendBody(overrides = {}) {
  return {
    referenceUrl: "https://example.com/reference-video.mp4",
    brief: "Live, approved remix with observable spend events for Budget_Meters timing.",
    budgetUsd: 500,
    mode: "live",
    approvals: ["paid-model-call", "render-action", "payment-action", "cloud-deploy"],
    sourceCards: [
      { url: "https://example.com/a", platform: "web" },
      { url: "https://example.com/b", platform: "web" },
      { url: "https://example.com/c", platform: "web" },
    ],
    // Injected, timer-free live spend signals.
    modelActualCostUsd: 0.42,
    simulatedSpendUsd: 1.25,
    ...overrides,
  };
}

// --- Example 1: a live run's meters reflect every spend event across the seam

test("R2.5 integration: a live run's Budget_Meters reflect every spend event end-to-end across the tier seam", async () => {
  const { transport } = createInProcessMcpTransport();
  const handler = createForwardingRunHandler({ transport });

  const res = await handler({ httpMethod: "POST", body: JSON.stringify(liveSpendBody()) });
  assert.equal(res.statusCode, 202);

  const manifest = JSON.parse(res.body).result.structuredContent;
  const meters = manifest.budgetMeters;

  // The Director surfaced the recorded spend events and the same-pass guarantee.
  assert.ok(Array.isArray(meters.spendEvents) && meters.spendEvents.length > 0, "spend events were recorded");
  assert.equal(meters.budgetMetersUpdatedSynchronously, true, "meters updated in the same pass as each spend event (R2.5)");
  assert.equal(
    manifest.guardrails.budgetMetersUpdatedSynchronously,
    true,
    "the within-2s structural guardrail holds end-to-end",
  );

  // The cumulative meters equal the recorded spend-event sums (the structural
  // realization of "within 2s of each spend event").
  assert.equal(budgetMetersReflectSpendEvents(meters.spendEvents, meters), true);
});

// --- Example 2: the same-pass guarantee on injected live spend events --------

test("R2.5 integration: buildBudgetMetersUpdate reflects injected live spend events in one synchronous pass", () => {
  const update = buildBudgetMetersUpdate({
    modelCostLogs: [
      { stageId: "research", estimatedCostUsd: 0.02, actualCostUsd: 0.21 },
      { stageId: "storyboard", estimatedCostUsd: 0.01, actualCostUsd: 0.21 },
    ],
    renderProviderSpendUsd: 0.5,
    cumulativeSpendUsd: 1.25,
  });

  assert.equal(update.updatedSynchronously, true, "same-pass update reflects every spend event (R2.5)");
  assert.ok(update.spendEventCount >= 3, "model + render + cumulative spend events recorded");
  assert.equal(
    budgetMetersReflectSpendEvents(update.spendEvents, {
      estimatedCostUsd: update.cumulativeEstimatedCostUsd,
      actualCostUsd: update.cumulativeActualCostUsd,
    }),
    true,
  );
});

// --- Example 3: cumulative meters equal the spend-event sums exactly ---------

test("R2.5 integration: cumulative Budget_Meters equal the spend-event sums exactly (structural within-2s)", () => {
  const events = [
    { kind: "model_call", estimatedCostUsd: 0.03, actualCostUsd: 0.42 },
    { kind: "render_provider", estimatedCostUsd: 0, actualCostUsd: 0.5 },
    { kind: "cumulative_spend", estimatedCostUsd: 0, actualCostUsd: 1.25 },
  ];
  const aggregate = aggregateSpendEvents(events);

  // Estimated == sum of estimated; actual == sum of actual (exact cents).
  assert.equal(aggregate.estimatedCostUsd, 0.03);
  assert.equal(aggregate.actualCostUsd, 2.17);
  assert.equal(aggregate.eventCount, 3);
  assert.equal(
    budgetMetersReflectSpendEvents(events, {
      estimatedCostUsd: aggregate.estimatedCostUsd,
      actualCostUsd: aggregate.actualCostUsd,
    }),
    true,
  );
});
