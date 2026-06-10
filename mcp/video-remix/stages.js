// Pipeline stage + Dry_Run plan-artifact builders for the video-remix Director
// runtime (spec task 2.4 / R2.6, R4.4 / Property 3). Extracted verbatim from
// `mcp/video-remix-runtime.js` (reuse-not-rebuild).

import { cleanString, normalizeMoney } from "./helpers.js";

function buildStage(id, status, details = {}) {
  return { id, status, ...details };
}

/**
 * Build a Dry_Run plan artifact for a spend-bearing stage (spec task 2.4 /
 * R2.6, R4.4 / Property 3). A plan artifact is the observable proof that a
 * spend-bearing step RESOLVED to a plan rather than EXECUTING: it performed no
 * paid-provider call and incurred `actualCostUsd === 0`. It is attached to the
 * stage (`Stage.artifact`, per the design Run_Manifest data model) whenever a
 * spend-bearing stage does not actually execute — i.e. in `mode:"dry-run"` for
 * every spend-bearing stage, and in Live_Mode for any spend-bearing stage
 * reached without a verified Approval_Token (R4.4).
 */
function buildDryRunPlanArtifact({ stageId, gateId, estimatedCostUsd = 0, reason }) {
  return {
    kind: "dry_run_plan",
    stageId,
    gateId: gateId ?? null,
    resolvedTo: "plan_artifact",
    executed: false,
    // A plan artifact never spends: estimated cost is what the step WOULD cost;
    // actual cost is always exactly 0 because nothing executed.
    estimatedCostUsd: normalizeMoney(estimatedCostUsd, 0),
    actualCostUsd: 0,
    paidProviderCalls: 0,
    reason: cleanString(reason, "dry_run_mode"),
    planSummary: `Planned ${stageId} step resolved to a plan artifact; no paid execution performed.`,
  };
}

export { buildStage, buildDryRunPlanArtifact };
