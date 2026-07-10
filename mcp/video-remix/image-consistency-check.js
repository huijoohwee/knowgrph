import { cleanString } from "./helpers.js";
import { runWithBoundedRetry } from "./retry.js";
import { validateCostLog } from "../../contracts/cost-log.schema.js";

export const DEFAULT_IMAGE_CANDIDATE_COUNT = 4;
export const DEFAULT_IMAGE_CANDIDATE_CONCURRENCY = 4;
export const DEFAULT_IMAGE_CONSISTENCY_THRESHOLD = 0.75;
export const DEFAULT_IMAGE_CONSISTENCY_WEIGHTS = Object.freeze({ identity: 0.3, environment: 0.2, spatial: 0.25, temporal: 0.15, technical: 0.1 });

function plainRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function boundedNumber(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}

function score(value, fallback = 0) {
  return boundedNumber(value, fallback, 0, 1);
}

function normalizeWeights(value) {
  const input = plainRecord(value);
  const raw = Object.fromEntries(Object.entries(DEFAULT_IMAGE_CONSISTENCY_WEIGHTS).map(([key, fallback]) => [key, boundedNumber(input[key], fallback, 0, 1)]));
  const total = Object.values(raw).reduce((sum, weight) => sum + weight, 0);
  return total > 0
    ? Object.fromEntries(Object.entries(raw).map(([key, weight]) => [key, Number((weight / total).toFixed(6))]))
    : { ...DEFAULT_IMAGE_CONSISTENCY_WEIGHTS };
}

export function normalizeImageConsistencyPolicy(value = {}) {
  const input = plainRecord(value);
  const candidateCount = Math.floor(boundedNumber(input.candidateCount, DEFAULT_IMAGE_CANDIDATE_COUNT, 2, 8));
  return {
    enabled: input.enabled !== false,
    required: input.required === true,
    candidateCount,
    minimumSuccessfulCandidates: Math.floor(boundedNumber(input.minimumSuccessfulCandidates, 2, 1, candidateCount)),
    maxConcurrency: Math.floor(boundedNumber(input.maxConcurrency, DEFAULT_IMAGE_CANDIDATE_CONCURRENCY, 1, candidateCount)),
    consistencyThreshold: boundedNumber(input.consistencyThreshold, DEFAULT_IMAGE_CONSISTENCY_THRESHOLD, 0, 1),
    metricWeights: normalizeWeights(input.metricWeights),
  };
}

function candidateInputKey(shot, policy) {
  return JSON.stringify({
    imagePromptInputKey: cleanString(shot?.imageGeneration?.inputKey),
    imagePrompt: cleanString(shot?.imagePrompt),
    referenceIds: (shot?.firstFrameReferences || []).map((reference) => cleanString(reference.referenceId)).filter(Boolean),
    selectionPolicy: {
      candidateCount: policy.candidateCount,
      minimumSuccessfulCandidates: policy.minimumSuccessfulCandidates,
      consistencyThreshold: policy.consistencyThreshold,
      metricWeights: policy.metricWeights,
    },
  });
}

async function boundedParallel(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
  return results;
}

function normalizeCandidate(shotId, variantIndex, result) {
  const assetUrl = cleanString(result?.assetUrl || result?.durableR2Url || result?.url);
  if (!assetUrl) return null;
  return {
    candidateId: `${shotId}:candidate:${variantIndex + 1}`,
    shotId,
    variantIndex,
    assetUrl,
    durableR2Url: cleanString(result?.durableR2Url, assetUrl),
    provider: cleanString(result?.provider),
    costLog: result?.costLog || null,
  };
}

function normalizeReview(candidate, result, weights) {
  const visualFallback = score(result?.visualScore);
  const metrics = {
    identity: score(result?.identityScore, visualFallback),
    environment: score(result?.environmentScore, visualFallback),
    spatial: score(result?.spatialScore, visualFallback),
    temporal: score(result?.temporalScore, visualFallback),
    technical: score(result?.technicalScore, visualFallback),
  };
  const weightedScore = Number((
    (metrics.identity * weights.identity) +
    (metrics.environment * weights.environment) +
    (metrics.spatial * weights.spatial) +
    (metrics.temporal * weights.temporal) +
    (metrics.technical * weights.technical)
  ).toFixed(6));
  return {
    candidateId: candidate.candidateId,
    consistencyScore: score(result?.consistencyScore, weightedScore),
    metrics,
    findings: Array.isArray(result?.findings) ? result.findings.map((finding) => cleanString(finding)).filter(Boolean) : [],
    costLog: result?.costLog || null,
  };
}

function selectedShot(shot, selection) {
  if (!selection?.selectedCandidate) return shot;
  const selectedReference = {
    referenceId: selection.selectedCandidate.candidateId,
    assetUrl: selection.selectedCandidate.assetUrl,
    kind: "generated_first_frame",
  };
  const supporting = (shot.firstFrameReferences || []).filter((reference) => reference.assetUrl !== selectedReference.assetUrl);
  return {
    ...shot,
    primaryReference: selectedReference,
    firstFrameReferences: [selectedReference, ...supporting],
    imageConsistency: selection,
  };
}

function unavailableResult(source, policy, code) {
  const issues = policy.required ? [{ severity: "error", code }] : [{ severity: "warning", code }];
  return {
    status: policy.required ? "failed" : "unverified",
    policy,
    selections: [],
    shots: source,
    issues,
    costLogs: [],
    costLogValidationFailures: [],
    candidateProviderCalls: 0,
    reviewProviderCalls: 0,
    retryTrace: [],
    coverage: { shotCount: source.length, selectedCount: 0, reusedCount: 0 },
    ok: !policy.required,
  };
}

export async function runImageConsistencyCheck({
  plannedShots,
  imageClient,
  reviewClient,
  priorResult,
  policy: policyInput,
  runId,
  maxIterations,
  wait,
} = {}) {
  const policy = normalizeImageConsistencyPolicy(policyInput);
  const source = Array.isArray(plannedShots) ? plannedShots : [];
  if (!policy.enabled) return { ...unavailableResult(source, policy, "image_consistency_disabled"), status: "skipped", issues: [], ok: true };
  if (!imageClient || typeof imageClient.generate !== "function") return unavailableResult(source, policy, "image_generation_client_unavailable");
  const review = typeof reviewClient?.reviewCandidate === "function" ? reviewClient.reviewCandidate.bind(reviewClient) : reviewClient?.review?.bind(reviewClient);
  if (!review) return unavailableResult(source, policy, "image_consistency_review_client_unavailable");

  const priorByShotId = new Map((priorResult?.selections || []).map((selection) => [cleanString(selection.shotId), selection]));
  const issues = [];
  const retryTrace = [];
  const costLogs = [];
  let candidateProviderCalls = 0;
  let reviewProviderCalls = 0;
  const selections = [];

  for (const shot of source) {
    const shotId = cleanString(shot.shotId);
    const inputKey = candidateInputKey(shot, policy);
    const prior = priorByShotId.get(shotId);
    if (prior?.inputKey === inputKey && prior?.accepted && cleanString(prior?.selectedCandidate?.assetUrl)) {
      selections.push({ ...prior, reused: true });
      continue;
    }
    const variants = Array.from({ length: policy.candidateCount }, (_, variantIndex) => variantIndex);
    const generated = await boundedParallel(variants, policy.maxConcurrency, async (variantIndex) => {
      const attempt = await runWithBoundedRetry(() => imageClient.generate({
        runId,
        shotId,
        variantIndex,
        prompt: cleanString(shot.imagePrompt, shot.renderPrompt),
        primaryReference: shot.primaryReference || null,
        referenceImages: shot.firstFrameReferences || [],
      }), { maxIterations, wait, onRetry: (entry) => retryTrace.push({ stageId: "image_generation", shotId, variantIndex, ...entry }) });
      retryTrace.push(...attempt.attempts.filter((entry) => entry.status === "complete").map((entry) => ({ stageId: "image_generation", shotId, variantIndex, ...entry })));
      if (!attempt.ok) return null;
      candidateProviderCalls += 1;
      const candidate = normalizeCandidate(shotId, variantIndex, attempt.value);
      if (candidate?.costLog) costLogs.push(candidate.costLog);
      return candidate;
    });
    const candidates = generated.filter(Boolean);
    if (candidates.length < policy.minimumSuccessfulCandidates) {
      issues.push({ severity: "error", code: "insufficient_image_candidates", shotId, successfulCount: candidates.length, requiredCount: policy.minimumSuccessfulCandidates });
      selections.push({ shotId, inputKey, candidates, reviews: [], selectedCandidate: null, accepted: false, reused: false });
      continue;
    }
    const reviews = await boundedParallel(candidates, policy.maxConcurrency, async (candidate) => {
      const attempt = await runWithBoundedRetry(() => review({
        shotId,
        candidateId: candidate.candidateId,
        assetUrl: candidate.assetUrl,
        prompt: cleanString(shot.imagePrompt, shot.renderPrompt),
        expectedContinuity: {
          imageGeneration: shot.imageGeneration || null,
          referenceSelection: shot.referenceSelection || null,
          spatialBlocking: shot.spatialBlocking || null,
          cameraAssignment: shot.cameraAssignment || null,
        },
      }), { maxIterations, wait, onRetry: (entry) => retryTrace.push({ stageId: "image_consistency_review", shotId, candidateId: candidate.candidateId, ...entry }) });
      retryTrace.push(...attempt.attempts.filter((entry) => entry.status === "complete").map((entry) => ({ stageId: "image_consistency_review", shotId, candidateId: candidate.candidateId, ...entry })));
      if (!attempt.ok) return null;
      reviewProviderCalls += 1;
      const normalized = normalizeReview(candidate, attempt.value, policy.metricWeights);
      if (normalized.costLog) costLogs.push(normalized.costLog);
      return normalized;
    });
    const ranked = reviews.filter(Boolean).sort((left, right) =>
      right.consistencyScore - left.consistencyScore || left.candidateId.localeCompare(right.candidateId),
    );
    const winningReview = ranked[0] || null;
    const selectedCandidate = candidates.find((candidate) => candidate.candidateId === winningReview?.candidateId) || null;
    const accepted = Boolean(selectedCandidate && winningReview.consistencyScore >= policy.consistencyThreshold);
    if (!accepted) issues.push({ severity: "error", code: "no_consistent_first_frame_candidate", shotId, bestScore: winningReview?.consistencyScore || 0, threshold: policy.consistencyThreshold });
    selections.push({ shotId, inputKey, candidates, reviews: ranked, selectedCandidate: accepted ? selectedCandidate : null, selectedReview: winningReview, accepted, reused: false });
  }

  const selectionsByShotId = new Map(selections.map((selection) => [selection.shotId, selection]));
  const shots = source.map((shot) => selectedShot(shot, selectionsByShotId.get(cleanString(shot.shotId))));
  const ok = issues.every((issue) => issue.severity !== "error");
  const costLogValidationFailures = costLogs
    .map((costLog) => ({ costLog, validation: validateCostLog(costLog) }))
    .filter(({ validation }) => !validation.valid);
  return {
    status: ok ? "complete" : "failed",
    policy,
    selections,
    shots,
    issues,
    costLogs,
    costLogValidationFailures,
    candidateProviderCalls,
    reviewProviderCalls,
    retryTrace,
    coverage: { shotCount: source.length, selectedCount: selections.filter((selection) => selection.accepted).length, reusedCount: selections.filter((selection) => selection.reused).length },
    ok,
  };
}
