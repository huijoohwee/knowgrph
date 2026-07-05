// Video_Agent render -> edit execution helper for the Director.
//
// Keeps the top-level run manifest assembly lean while ensuring the normal
// Director path uses the shared Render_Harness and Editing_Stage harness instead
// of synthetic asset/edit references.

import { buildDurableR2Url, mediaObjectKey } from "../../contracts/media-artifact.schema.js";
import { validateCostLog } from "../../contracts/cost-log.schema.js";
import {
  creditLedgerEventFromRenderEvent,
  validateCreditLedgerEvent,
} from "../../contracts/credit-ledger.schema.js";
import { cleanString } from "./helpers.js";
import { RENDER_GATE_ID } from "./render-token.js";
import { runRenderHarness, runRenderHarnessAsync } from "./render-harness.js";
import { runEditingHarness, runEditingHarnessSync } from "./editing-harness.js";
import { FAILURE_REASON_EXHAUSTED, RUN_STATE_BLOCKED } from "./constants.js";
import { computeRetryBackoffMs } from "./retry.js";

const DEFAULT_ASSET_DURATION_MS = 1000;

function approvedRenderToken(renderApproved, nowMs) {
  if (!renderApproved) return undefined;
  return {
    gateId: RENDER_GATE_ID,
    issuedAt: nowMs,
    consumed: false,
    verified: true,
  };
}

function createManifestReferencePersister() {
  let persistCallCount = 0;
  return {
    get persistCallCount() {
      return persistCallCount;
    },
    persist({ runId, stageId, shotId, ext, contentType }) {
      persistCallCount += 1;
      const keyArgs = {
        runId: cleanString(runId, "video-remix-run"),
        stageId: cleanString(stageId, "edit"),
        shotId: cleanString(shotId, "manifest"),
        ext: cleanString(ext, "json"),
      };
      return {
        durableR2Url: buildDurableR2Url(keyArgs),
        objectKey: mediaObjectKey(keyArgs),
        contentType: cleanString(contentType, "application/json"),
      };
    },
  };
}

function normalizeAsset(asset) {
  const durationMs = Number.isFinite(Number(asset?.durationMs))
    ? Math.max(1, Math.round(Number(asset.durationMs)))
    : DEFAULT_ASSET_DURATION_MS;
  const assetUrl = cleanString(asset?.durableR2Url || asset?.assetUrl);
  return {
    ...asset,
    assetUrl,
    durableR2Url: cleanString(asset?.durableR2Url || assetUrl, assetUrl),
    storageUri: cleanString(asset?.storageUri || asset?.assetUrl || asset?.durableR2Url, assetUrl),
    durationMs,
  };
}

function assetDurationsByShot(assets) {
  return Object.fromEntries(assets.map((asset) => [asset.shotId, asset.durationMs]));
}

function buildVideoCostLog(renderResult) {
  const estimatedCostUsd = Number(((Number(renderResult?.providerSpendCents) || 0) / 100).toFixed(2));
  return {
    model: "byteplus-video",
    prompt_tokens: "unknown",
    completion_tokens: "unknown",
    cache_hits: 0,
    estimated_cost_usd: estimatedCostUsd,
    incomplete: true,
  };
}

function buildVideoAccounting(renderResult) {
  if (!renderResult || renderResult.dispatched !== true) {
    return {
      costLogs: [],
      costLogValidationFailures: [],
      creditLedgerEvents: [],
      creditLedgerValidationFailures: [],
    };
  }
  const costLog = buildVideoCostLog(renderResult);
  const costLogValidation = validateCostLog(costLog);
  const creditLedgerEvents = (Array.isArray(renderResult.ledgerEvents) ? renderResult.ledgerEvents : [])
    .map(creditLedgerEventFromRenderEvent);
  const creditLedgerValidationFailures = creditLedgerEvents
    .map((event) => ({ event, validation: validateCreditLedgerEvent(event) }))
    .filter(({ validation }) => !validation.valid);
  return {
    costLogs: costLogValidation.valid ? [costLog] : [],
    costLogValidationFailures: costLogValidation.valid ? [] : [{ costLog, validation: costLogValidation }],
    creditLedgerEvents,
    creditLedgerValidationFailures,
  };
}

export function executeVideoAgentStages({
  liveRequested,
  state,
  renderApproved,
  plannedShots,
  runId,
  nowMs,
  budgetUsd,
  renderDeps,
  mediaPersister,
  maxIterations,
} = {}) {
  const shouldRender = liveRequested && state === "complete" && renderApproved;
  let renderResult = null;
  let assets = [];

  if (shouldRender) {
    renderResult = runRenderHarness(
      {
        shots: plannedShots,
        renderGateToken: approvedRenderToken(renderApproved, nowMs),
      },
      {
        runId,
        now: nowMs,
        providerKeyAvailable: false,
        budgetCapCents: Math.round((Number(budgetUsd) || 0) * 100),
        ...(renderDeps && typeof renderDeps === "object" ? renderDeps : {}),
      },
    );
    assets = renderResult.status === "complete"
      ? renderResult.assets.map(normalizeAsset)
      : [];
  }

  const persister = mediaPersister || createManifestReferencePersister();
  const editResult = runEditingHarnessSync(
    {
      plannedShots,
      renderAssets: assets,
      assetDurationsMs: assetDurationsByShot(assets),
    },
    { runId, mediaPersister: persister },
  );

  const editedUrl = editResult.status === "complete"
    ? cleanString(editResult.editedVideoReference?.durableR2Url)
    : "";
  const publishedUrls = editedUrl ? [editedUrl] : [];
  const videoAccounting = buildVideoAccounting(renderResult);

  return {
    renderResult,
    assets,
    editResult,
    publishedUrls,
    providerSpendCents: Number(renderResult?.providerSpendCents) || 0,
    renderProviderCalls: Number(renderResult?.paidProviderCalls) || 0,
    videoAccounting,
    manifestPersistCallCount: Number(editResult.persistCallCount || persister.persistCallCount || 0),
    executionFailure: buildVideoAgentExecutionFailure({ renderResult, editResult, maxIterations }),
  };
}

export async function executeVideoAgentStagesAsync({
  liveRequested,
  state,
  renderApproved,
  plannedShots,
  runId,
  nowMs,
  budgetUsd,
  renderDeps,
  mediaPersister,
  maxIterations,
} = {}) {
  const shouldRender = liveRequested && state === "complete" && renderApproved;
  let renderResult = null;
  let assets = [];

  if (shouldRender) {
    renderResult = await runRenderHarnessAsync(
      {
        shots: plannedShots,
        renderGateToken: approvedRenderToken(renderApproved, nowMs),
      },
      {
        runId,
        now: nowMs,
        providerKeyAvailable: false,
        budgetCapCents: Math.round((Number(budgetUsd) || 0) * 100),
        ...(renderDeps && typeof renderDeps === "object" ? renderDeps : {}),
      },
    );
    assets = renderResult.status === "complete"
      ? renderResult.assets.map(normalizeAsset)
      : [];
  }

  const persister = mediaPersister || createManifestReferencePersister();
  const editResult = await runEditingHarness(
    {
      plannedShots,
      renderAssets: assets,
      assetDurationsMs: assetDurationsByShot(assets),
    },
    { runId, mediaPersister: persister },
  );

  const editedUrl = editResult.status === "complete"
    ? cleanString(editResult.editedVideoReference?.durableR2Url)
    : "";
  const publishedUrls = editedUrl ? [editedUrl] : [];
  const videoAccounting = buildVideoAccounting(renderResult);

  return {
    renderResult,
    assets,
    editResult,
    publishedUrls,
    providerSpendCents: Number(renderResult?.providerSpendCents) || 0,
    renderProviderCalls: Number(renderResult?.paidProviderCalls) || 0,
    videoAccounting,
    manifestPersistCallCount: Number(editResult.persistCallCount || persister.persistCallCount || 0),
    executionFailure: buildVideoAgentExecutionFailure({ renderResult, editResult, maxIterations }),
  };
}

export function buildVideoAgentExecutionFailure({ renderResult, editResult, maxIterations } = {}) {
  const stageId = renderResult?.status === "failed" || renderResult?.status === "rejected"
    ? "render"
    : editResult?.status === "failed" || editResult?.status === "rejected"
      ? "edit"
      : "";
  if (!stageId) return null;
  const finalRetryCount = Math.max(1, Math.floor(Number(maxIterations) || 1));
  return {
    toolName: `knowgrph.video_remix.${stageId}`,
    stageId,
    failureKind: `${stageId}_stage_failure_exhausted`,
    retryCount: finalRetryCount,
    finalRetryCount,
    backoffMs: computeRetryBackoffMs(finalRetryCount - 1),
    runState: RUN_STATE_BLOCKED,
    exhausted: true,
    reason: FAILURE_REASON_EXHAUSTED,
    resolution: "failed closed: Run_State blocked, downstream stages halted, prior artifacts preserved",
  };
}
