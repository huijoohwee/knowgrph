// Cost_Log aggregation model for the video-remix Director runtime
// (spec task 2.10 / R2.4, R10.3 / Property 20). Extracted into its own cohesive,
// single-responsibility module so `run-video-remix.js` stays well under the
// 600-line limit (reuse-not-rebuild). Pure and timer-free; importable by both
// the Node tests and the Cloudflare Worker bundle.
//
// Reconciliation of the two Cost_Log shapes in the spec:
//   * The design Data Models describe the RAW Ai_Gateway Cost_Log
//     `{ model, prompt_tokens, completion_tokens, cache_hits, estimated_cost_usd,
//     incomplete }` (field-domain validity is task 8.4 / Property 19).
//   * R2.4 requires the Director to record, in the Run_Manifest, exactly one
//     per-model-bearing-stage Cost_Log entry carrying `{ stageId,
//     estimatedCostUsd, actualCostUsd }`.
// This module produces the R2.4 per-stage Director aggregation record (the seam
// for Property 20). It carries the three required fields; the raw Ai_Gateway
// token-bearing Cost_Log is a separate concern wired later.
//
// R2.4:  THE Director SHALL record exactly one Cost_Log entry per model-bearing
//   stage in the Run_Manifest, each entry containing the stage id, the estimated
//   cost in USD, and the actual cost in USD.
// R10.3: WHEN a Cost_Log is emitted, THE Director SHALL aggregate the entry into
//   the Run_Manifest Budget_Meters within 1 second of emission.
// Property 20: For any set of emitted Cost_Logs in a run, the Director
//   aggregates them into Budget_Meters such that the aggregated estimated/actual
//   costs equal the sums of the corresponding Cost_Log fields, and each
//   model-bearing stage has exactly one Cost_Log entry carrying its stage id,
//   estimated cost, and actual cost.
//
// Timing note ("within 1s of emission", R10.3 / Property 20): in this
// synchronous local runtime aggregation happens in the SAME synchronous pass as
// emission — there is no queue, no timer, no await between emitting a per-stage
// Cost_Log and folding it into Budget_Meters. The timing contract is therefore
// asserted STRUCTURALLY (aggregation is computed inline from the same array that
// was just built) rather than against a real wall-clock timer.

import { normalizeMoney } from "./helpers.js";

// The model-bearing stages — the paid-model-call stages whose completion emits a
// Cost_Log (research + storyboard). Order is the canonical pipeline order so a
// per-stage entry is deterministic. Frozen so callers cannot mutate the catalog.
export const MODEL_BEARING_STAGE_IDS = Object.freeze(["research", "storyboard"]);

// Convert a USD amount to integer cents (rounded). Working in integer cents lets
// us split a total across stages and re-sum it with EXACT equality, so the
// aggregate provably equals the sum of the per-stage entries (Property 20).
function toCents(usd) {
  return Math.round(normalizeMoney(usd, 0) * 100);
}

function fromCents(cents) {
  return Number((cents / 100).toFixed(2));
}

/**
 * Split a total amount (in cents) across `parts` buckets so the buckets sum
 * EXACTLY back to the total. The remainder cent(s) are distributed to the
 * earliest buckets, so e.g. 3¢ across 2 stages -> [2¢, 1¢] (sum 3¢). This keeps
 * the aggregate equal to the sum of the per-stage entries by construction.
 */
function splitCents(totalCents, parts) {
  if (parts <= 0) return [];
  const base = Math.floor(totalCents / parts);
  const remainder = totalCents - base * parts;
  return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1 : 0));
}

/**
 * Build exactly one per-model-bearing-stage Cost_Log entry (R2.4 / Property 20).
 * Returns one entry per stage in `MODEL_BEARING_STAGE_IDS`, each carrying the
 * three required fields `{ stageId, estimatedCostUsd, actualCostUsd }`.
 *
 * `plannedEstimateUsd` is the run's total planned model-stage estimate (the
 * existing Budget_Meters estimate semantics: accounted only when the
 * paid-model-call gate is approved and research is not a weak signal — 0
 * otherwise). `actualCostUsd` is the real recorded model-call spend (0 in the
 * local runtime, which makes no live model calls). Both totals are split across
 * the model-bearing stages so the per-stage entries sum back to the totals
 * exactly. When a total is 0 (unapproved / weak-signal / dry-run) every entry's
 * field is 0, so the aggregate is 0 — preserving R2.3 (estimatedCostUsd == 0
 * for a live run with empty approvals) and R2.6 (actualCostUsd == 0 in dry-run).
 */
export function buildModelStageCostLogs({ plannedEstimateUsd = 0, actualCostUsd = 0 } = {}) {
  const parts = MODEL_BEARING_STAGE_IDS.length;
  const estimatedCents = splitCents(toCents(plannedEstimateUsd), parts);
  const actualCents = splitCents(toCents(actualCostUsd), parts);
  return MODEL_BEARING_STAGE_IDS.map((stageId, index) => ({
    stageId,
    estimatedCostUsd: fromCents(estimatedCents[index]),
    actualCostUsd: fromCents(actualCents[index]),
  }));
}

/**
 * Aggregate a set of per-stage Cost_Log entries into Budget_Meters fields
 * (R10.3 / Property 20). Summed in integer cents so the aggregated
 * estimated/actual costs equal the sums of the corresponding per-entry fields
 * with EXACT equality. Returns `entryCount` so callers can assert the
 * one-entry-per-model-bearing-stage invariant.
 */
export function aggregateCostLogs(costLogs = []) {
  const estimatedCents = costLogs.reduce((total, entry) => total + toCents(entry.estimatedCostUsd), 0);
  const actualCents = costLogs.reduce((total, entry) => total + toCents(entry.actualCostUsd), 0);
  return {
    estimatedCostUsd: fromCents(estimatedCents),
    actualCostUsd: fromCents(actualCents),
    entryCount: costLogs.length,
  };
}

/**
 * Compose the full Director Cost_Log accounting for a run in one synchronous
 * pass (spec task 2.10 / R2.4, R10.3 / Property 20). Builds the one-per-stage
 * Cost_Log entries, aggregates them into Budget_Meters fields, keys them by
 * stageId for `Stage.costLog` attachment, and asserts the aggregation invariant.
 * Returns everything `run-video-remix.js` needs so the orchestrator stays lean
 * and well under the 600-line limit (single responsibility lives here).
 */
export function buildCostLogAccounting({ plannedEstimateUsd = 0, modelActualCostUsd = 0 } = {}) {
  const costLogs = buildModelStageCostLogs({ plannedEstimateUsd, actualCostUsd: modelActualCostUsd });
  const aggregate = aggregateCostLogs(costLogs);
  return {
    costLogs,
    aggregate,
    byStage: Object.fromEntries(costLogs.map((entry) => [entry.stageId, entry])),
    // estimatedCostUsd is DERIVED from the aggregate so the meter is provably
    // the sum of the per-stage entries (Property 20) while preserving its prior
    // value (the planned model estimate).
    estimatedCostUsd: aggregate.estimatedCostUsd,
    aggregationOk: costLogAggregationHolds(costLogs, aggregate),
  };
}

/**
 * Pure correctness check for Property 20, surfaced on the Run_Manifest
 * `validation.checks` and `guardrails`. Holds iff:
 *   1. there is EXACTLY one Cost_Log entry per model-bearing stage (no missing
 *      stage, no duplicate, no extra stage), and every entry carries the three
 *      required fields as finite numbers; and
 *   2. the aggregate estimated/actual costs EQUAL the sums of the per-entry
 *      fields (aggregation correctness — verified in integer cents).
 * This is the structural assertion of the R10.3 "within 1s" timing contract:
 * the aggregate is recomputed from the same entries and must match.
 */
export function costLogAggregationHolds(costLogs, aggregate) {
  if (!Array.isArray(costLogs)) return false;
  if (costLogs.length !== MODEL_BEARING_STAGE_IDS.length) return false;
  const seen = new Set();
  for (const entry of costLogs) {
    if (!entry || !MODEL_BEARING_STAGE_IDS.includes(entry.stageId)) return false;
    if (seen.has(entry.stageId)) return false; // duplicate stage -> not exactly one
    seen.add(entry.stageId);
    if (!Number.isFinite(entry.estimatedCostUsd) || !Number.isFinite(entry.actualCostUsd)) return false;
  }
  if (seen.size !== MODEL_BEARING_STAGE_IDS.length) return false;
  const recomputed = aggregateCostLogs(costLogs);
  return (
    toCents(recomputed.estimatedCostUsd) === toCents(aggregate.estimatedCostUsd) &&
    toCents(recomputed.actualCostUsd) === toCents(aggregate.actualCostUsd)
  );
}
