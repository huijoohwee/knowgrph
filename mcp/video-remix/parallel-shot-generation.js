import { cleanString } from "./helpers.js";
import { runRenderHarnessAsync } from "./render-harness.js";

export const DEFAULT_PARALLEL_SHOT_CONCURRENCY = 4;
export const DEFAULT_PARALLEL_SHOT_BATCH_SIZE = 4;

function plainRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function boundedInteger(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, Math.floor(number))) : fallback;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

export function normalizeParallelShotPolicy(value = {}) {
  const input = plainRecord(value);
  return {
    enabled: input.enabled !== false,
    maxConcurrency: boundedInteger(input.maxConcurrency, DEFAULT_PARALLEL_SHOT_CONCURRENCY, 1, 8),
    maxBatchSize: boundedInteger(input.maxBatchSize, DEFAULT_PARALLEL_SHOT_BATCH_SIZE, 1, 16),
    requireSameScene: input.requireSameScene !== false,
    maxCostCentsPerShot: boundedInteger(input.maxCostCentsPerShot, 0, 0, 1_000_000),
  };
}

function cameraIdFor(shot) {
  return cleanString(shot?.cameraAssignment?.cameraId, cleanString(shot?.cameraId));
}

function sceneIdFor(shot) {
  return cleanString(shot?.sceneId, cleanString(shot?.spatialBlocking?.sceneId));
}

function explicitDependencies(shot) {
  return Array.isArray(shot?.dependencyShotIds)
    ? [...new Set(shot.dependencyShotIds.map((shotId) => cleanString(shotId)).filter(Boolean))]
    : [];
}

function scheduleInputKey(shots, policy) {
  return JSON.stringify(stableValue({
    policy,
    shots: shots.map((shot) => ({
      shotId: cleanString(shot.shotId),
      cameraId: cameraIdFor(shot),
      sceneId: sceneIdFor(shot),
      dependencyShotIds: explicitDependencies(shot),
      transitionReason: cleanString(shot.transitionReason),
      parallelSafe: shot.parallelSafe !== false,
    })),
  }));
}

function canJoinBatch(batch, shot, policy) {
  if (!policy.enabled || shot.parallelSafe === false || cleanString(shot.transitionReason)) return false;
  if (!cameraIdFor(shot) || cameraIdFor(shot) !== batch.cameraId) return false;
  if (policy.requireSameScene && sceneIdFor(shot) !== batch.sceneId) return false;
  if (explicitDependencies(shot).length) return false;
  return batch.shotIds.length < policy.maxBatchSize;
}

function annotateShots(shots, batches) {
  const assignmentByShotId = new Map(batches.flatMap((batch, batchIndex) =>
    batch.shotIds.map((shotId, position) => [shotId, {
      batchId: batch.batchId,
      batchIndex,
      position,
      mode: batch.mode,
      cameraId: batch.cameraId,
    }]),
  ));
  return shots.map((shot) => ({ ...shot, parallelShot: assignmentByShotId.get(cleanString(shot.shotId)) }));
}

export function buildParallelShotPlan({ plannedShots, policy: policyInput, priorPlan } = {}) {
  const policy = normalizeParallelShotPolicy(policyInput);
  const source = Array.isArray(plannedShots) ? plannedShots : [];
  const inputKey = scheduleInputKey(source, policy);
  if (priorPlan?.inputKey === inputKey && Array.isArray(priorPlan?.batches)) {
    return { ...priorPlan, policy, shots: annotateShots(source, priorPlan.batches), reused: true };
  }
  const shotIndexes = new Map(source.map((shot, index) => [cleanString(shot.shotId), index]));
  const issues = source.flatMap((shot, index) => explicitDependencies(shot)
    .filter((dependencyShotId) => (shotIndexes.get(dependencyShotId) ?? -1) >= index)
    .map((dependencyShotId) => ({ severity: "error", code: "forward_render_dependency", shotId: shot.shotId, dependencyShotId })));
  const batches = [];
  source.forEach((shot) => {
    const shotId = cleanString(shot.shotId);
    const current = batches.at(-1);
    if (current && canJoinBatch(current, shot, policy)) {
      current.shotIds.push(shotId);
      current.mode = "parallel";
      return;
    }
    batches.push({
      batchId: `render-batch-${batches.length + 1}`,
      shotIds: [shotId],
      cameraId: cameraIdFor(shot),
      sceneId: sceneIdFor(shot),
      mode: "serial",
      boundary: explicitDependencies(shot).length ? "explicit_dependency" : cleanString(shot.transitionReason) ? "transition" : cameraIdFor(shot) ? "camera_or_scene" : "camera_unassigned",
    });
  });
  const shots = annotateShots(source, batches);
  return {
    policy,
    inputKey,
    batches,
    shots,
    issues,
    coverage: {
      shotCount: source.length,
      batchCount: batches.length,
      parallelBatchCount: batches.filter((batch) => batch.mode === "parallel").length,
      parallelShotCount: batches.filter((batch) => batch.mode === "parallel").reduce((sum, batch) => sum + batch.shotIds.length, 0),
    },
    reused: false,
    ok: issues.every((issue) => issue.severity !== "error"),
  };
}

export function projectParallelShotPlan(plan, shots) {
  const source = Array.isArray(shots) ? shots : [];
  const pendingIds = new Set(source.map((shot) => cleanString(shot.shotId)));
  const batches = (plan?.batches || []).map((batch) => ({
    ...batch,
    shotIds: batch.shotIds.filter((shotId) => pendingIds.has(shotId)),
  })).filter((batch) => batch.shotIds.length).map((batch) => ({ ...batch, mode: batch.shotIds.length > 1 ? "parallel" : "serial" }));
  return {
    ...(plan || {}),
    batches,
    shots: annotateShots(source, batches),
    coverage: {
      shotCount: source.length,
      batchCount: batches.length,
      parallelBatchCount: batches.filter((batch) => batch.mode === "parallel").length,
      parallelShotCount: batches.filter((batch) => batch.mode === "parallel").reduce((sum, batch) => sum + batch.shotIds.length, 0),
    },
    projected: true,
  };
}

function mergeRenderResults(results, schedule, maxObservedConcurrency) {
  const completed = results.flat();
  const failureResult = completed.find((result) => result.failure);
  return {
    status: failureResult ? "failed" : "complete",
    gateId: completed[0]?.gateId || "render-action",
    dispatched: completed.some((result) => result.dispatched),
    dispatchElapsedMs: Math.max(0, ...completed.map((result) => Number(result.dispatchElapsedMs) || 0)),
    dispatchWithinDeadline: completed.every((result) => result.dispatchWithinDeadline !== false),
    dispatchDeadlineMs: completed[0]?.dispatchDeadlineMs,
    completionTimeoutMs: completed[0]?.completionTimeoutMs,
    assets: completed.flatMap((result) => result.assets || []),
    ledgerEvents: completed.flatMap((result) => result.ledgerEvents || []),
    providerDispatchCalls: completed.reduce((sum, result) => sum + (Number(result.providerDispatchCalls) || 0), 0),
    paidProviderCalls: completed.reduce((sum, result) => sum + (Number(result.paidProviderCalls) || 0), 0),
    providerSpendCents: completed.reduce((sum, result) => sum + (Number(result.providerSpendCents) || 0), 0),
    failure: failureResult?.failure || null,
    parallelExecution: { ...schedule.coverage, maxObservedConcurrency, batches: schedule.batches },
  };
}

export async function runParallelShotGeneration({ shots, plan, renderDeps, runId, now, budgetCapCents, renderTokenFactory } = {}) {
  const source = Array.isArray(shots) ? shots : [];
  const effectivePlan = Array.isArray(plan?.batches) ? plan : buildParallelShotPlan({ plannedShots: source, policy: { enabled: false } });
  const schedule = projectParallelShotPlan(effectivePlan, source);
  const shotsById = new Map(schedule.shots.map((shot) => [cleanString(shot.shotId), shot]));
  const policy = normalizeParallelShotPolicy(effectivePlan.policy);
  const configuredMaxCost = policy.maxCostCentsPerShot || Number(renderDeps?.queueClient?.maxCostCentsPerShot) || 0;
  const results = [];
  let spentCents = 0;
  let active = 0;
  let maxObservedConcurrency = 0;
  let halted = false;
  for (const batch of schedule.batches) {
    if (halted) break;
    const batchResults = [];
    for (let offset = 0; offset < batch.shotIds.length;) {
      const remainingBudget = Number.isFinite(Number(budgetCapCents)) ? Math.max(0, Number(budgetCapCents) - spentCents) : Infinity;
      const budgetConcurrency = configuredMaxCost > 0 ? Math.floor(remainingBudget / configuredMaxCost) : 1;
      const concurrency = Math.max(1, Math.min(policy.maxConcurrency, batch.shotIds.length - offset, budgetConcurrency || 1));
      const chunk = batch.shotIds.slice(offset, offset + concurrency);
      offset += concurrency;
      const perShotBudgetCap = configuredMaxCost > 0
        ? remainingBudget >= configuredMaxCost ? configuredMaxCost : 0
        : budgetCapCents;
      const chunkResults = await Promise.all(chunk.map(async (shotId) => {
        active += 1;
        maxObservedConcurrency = Math.max(maxObservedConcurrency, active);
        try {
          return await runRenderHarnessAsync(
            { shots: [shotsById.get(shotId)], renderGateToken: renderTokenFactory() },
            { ...renderDeps, runId, now, budgetCapCents: perShotBudgetCap },
          );
        } finally {
          active -= 1;
        }
      }));
      batchResults.push(...chunkResults);
      spentCents += chunkResults.reduce((sum, result) => sum + (Number(result.providerSpendCents) || 0), 0);
      if (chunkResults.some((result) => result.failure)) { halted = true; break; }
    }
    results.push(batchResults);
  }
  return mergeRenderResults(results, schedule, maxObservedConcurrency);
}
