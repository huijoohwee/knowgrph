import { validateCostLog } from "../../contracts/cost-log.schema.js";
import { cleanString } from "./helpers.js";
import { runWithBoundedRetry } from "./retry.js";

export const DEFAULT_NARRATIVE_QUALITY_THRESHOLD = 0.7;
export const DEFAULT_VISUAL_QUALITY_THRESHOLD = 0.75;

function threshold(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
}

export function buildVisualReviewPackets({ plannedShots, assets, continuity } = {}) {
  const assetsByShotId = new Map((Array.isArray(assets) ? assets : []).map((asset) => [asset.shotId, asset]));
  const continuityByShotId = new Map((continuity?.states || []).map((state) => [state.shotId, state]));
  return (Array.isArray(plannedShots) ? plannedShots : []).flatMap((shot) => {
    const asset = assetsByShotId.get(shot.shotId);
    if (!asset) return [];
    return [{
      shotId: shot.shotId,
      prompt: cleanString(shot.renderPrompt, shot.prompt),
      assetUrl: cleanString(asset.durableR2Url || asset.assetUrl || asset.storageUri),
      expectedContinuity: {
        ...(continuityByShotId.get(shot.shotId) || {}),
        cameraAssignment: shot.cameraAssignment || null,
        spatialBlocking: shot.spatialBlocking || null,
        referenceSelection: shot.referenceSelection || null,
        imageGeneration: shot.imageGeneration || null,
        imageConsistency: shot.imageConsistency || null,
      },
    }];
  });
}

function normalizeReview(packet, result, policy) {
  const narrativeScore = threshold(result?.narrativeScore, 0);
  const visualScore = threshold(result?.visualScore, 0);
  const accepted = narrativeScore >= policy.narrativeThreshold && visualScore >= policy.visualThreshold;
  return {
    shotId: packet.shotId,
    narrativeScore,
    visualScore,
    accepted,
    findings: Array.isArray(result?.findings) ? result.findings.map((finding) => cleanString(finding)).filter(Boolean) : [],
    proposedPrompt: accepted ? "" : cleanString(result?.proposedPrompt),
    costLog: result?.costLog || null,
  };
}

function validateReviewCostLogs(reviews) {
  const costLogs = [];
  const failures = [];
  for (const review of reviews) {
    if (!review.costLog) continue;
    const validation = validateCostLog(review.costLog);
    if (validation.valid) costLogs.push(review.costLog);
    else failures.push({ shotId: review.shotId, costLog: review.costLog, validation });
  }
  return { costLogs, costLogValidationFailures: failures };
}

export async function runVisualQualityMonitor({ packets, reviewClient, policy = {}, maxIterations, wait } = {}) {
  const list = Array.isArray(packets) ? packets : [];
  const resolvedPolicy = {
    narrativeThreshold: threshold(policy.narrativeThreshold, DEFAULT_NARRATIVE_QUALITY_THRESHOLD),
    visualThreshold: threshold(policy.visualThreshold, DEFAULT_VISUAL_QUALITY_THRESHOLD),
  };
  if (!reviewClient || typeof reviewClient.review !== "function") {
    return {
      status: "unverified",
      policy: resolvedPolicy,
      reviews: [],
      findings: [{ code: "vlm_review_client_unavailable" }],
      proposedRevisions: {},
      paidProviderCalls: 0,
      costLogs: [],
      costLogValidationFailures: [],
      retryTrace: [],
    };
  }
  const reviews = [];
  const retryTrace = [];
  for (const packet of list) {
    const result = await runWithBoundedRetry(() => reviewClient.review(packet), {
      maxIterations,
      wait,
      onRetry: (entry) => retryTrace.push({ shotId: packet.shotId, ...entry }),
    });
    retryTrace.push(...result.attempts.filter((entry) => entry.status === "complete").map((entry) => ({ shotId: packet.shotId, ...entry })));
    if (!result.ok) {
      const accounting = validateReviewCostLogs(reviews);
      return {
        status: "failed",
        policy: resolvedPolicy,
        reviews,
        findings: [{ code: "vlm_review_exhausted", shotId: packet.shotId }],
        proposedRevisions: {},
        paidProviderCalls: reviews.length,
        ...accounting,
        retryTrace,
      };
    }
    reviews.push(normalizeReview(packet, result.value, resolvedPolicy));
  }
  const proposedRevisions = Object.fromEntries(reviews.filter((review) => !review.accepted && review.proposedPrompt).map((review) => [review.shotId, review.proposedPrompt]));
  const findings = reviews.flatMap((review) => review.findings.map((finding) => ({ shotId: review.shotId, finding })));
  const accounting = validateReviewCostLogs(reviews);
  return {
    status: reviews.every((review) => review.accepted) ? "complete" : "revise",
    policy: resolvedPolicy,
    reviews,
    findings,
    proposedRevisions,
    paidProviderCalls: reviews.length,
    ...accounting,
    retryTrace,
  };
}
