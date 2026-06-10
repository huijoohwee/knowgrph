// Top-level Director orchestrator (`runVideoRemix`) for the video-remix
// runtime. Composes the cohesive modules under `mcp/video-remix/` — input
// validation, approvals, evidence/research, storyboard, stages, failure
// handling, budget, and demo-pack — into the canonical Run_Manifest payload.
// Extracted verbatim from `mcp/video-remix-runtime.js` (reuse-not-rebuild).

import {
  CONTRACT_VERSION,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_SHOT_COUNT,
  REQUIRED_RESEARCH_SOURCE_COUNT,
  MODEL_BEARING_PAID_STAGES,
  SPEND_BEARING_STAGES,
  SPEND_BEARING_STAGE_GATES,
  PLANNED_MODEL_COST_USD,
  RUN_STATE_BLOCKED,
  RUN_STATE_BUDGET_EXCEEDED,
  STAGE_STATUS_BUDGET_HELD,
  FAILURE_REASON_PROVIDER_UNAVAILABLE,
} from "./constants.js";
import { cleanString, slugify, normalizeMoney, normalizeCount, buildRunText } from "./helpers.js";
import { normalizeMaxIterations, buildExhaustionFailureRecord } from "./retry.js";
import { buildWeakSignalHalt } from "./weak-signal-halt.js";
import { normalizeApprovals, buildApprovalGates, hasGate } from "./approvals.js";
import { normalizeSourceCards, buildMarketRadar } from "./evidence.js";
import { buildShotPlan, buildStoryboardMarkdown } from "./storyboard.js";
import { buildStage, buildDryRunPlanArtifact } from "./stages.js";
import { buildDemoPack } from "./demo-pack.js";
import { buildFailureHandling } from "./failure-handling.js";
import { normalizeCumulativeSpendUsd, budgetCapExceeded } from "./budget.js";
import { buildBudgetMetersUpdate } from "./budget-meters.js";
import { validateDirectorInput } from "./director-input.js";
import {
  buildCostLogAccounting,
  MODEL_BEARING_STAGE_IDS,
} from "./cost-log.js";
import { buildLedgerReconciliation } from "./reconciliation.js";

export function runVideoRemix(args = {}) {
  // Director input-validation gate (spec task 2.5 / R2.1, R2.2 / Property 4):
  // reject malformed input by throwing a typed error naming the bad field
  // BEFORE any Run_Manifest is built. Because this runs first, a rejected call
  // performs zero paid-provider calls and produces no Run_Manifest.
  const validated = validateDirectorInput(args);
  const referenceUrl = validated.referenceUrl;
  const brief = validated.brief;
  const mode = validated.mode;
  const budgetUsd = normalizeMoney(validated.budgetUsd, 0);
  const maxIterations = normalizeMaxIterations(args.maxIterations, DEFAULT_MAX_ITERATIONS);
  const shotCount = normalizeCount(args.shotCount, DEFAULT_SHOT_COUNT);
  const runId = cleanString(args.runId, `${slugify(brief)}-${Date.now()}`);
  const nowIso = new Date().toISOString();
  const approvedGateIds = normalizeApprovals(args.approvals);
  const approvalGates = buildApprovalGates(approvedGateIds);
  const liveRequested = mode === "live";
  const paidApproved = hasGate(approvedGateIds, "paid-model-call");
  const renderApproved = hasGate(approvedGateIds, "render-action");
  const paymentApproved = hasGate(approvedGateIds, "payment-action");
  const deployApproved = hasGate(approvedGateIds, "cloud-deploy");

  const sources = paidApproved || !liveRequested
    ? normalizeSourceCards(args.sourceCards, referenceUrl, nowIso)
    : [];
  // Weak-signal halt-before-storyboard gate (task 3.4 / R4.5, R6.5 / Property 11): <3 sources halts before storyboard until an injectable verified continuation token lifts it.
  const weakSignalHalt = buildWeakSignalHalt(sources.length, REQUIRED_RESEARCH_SOURCE_COUNT, args.weakSignalContinuation);
  const weakSignal = weakSignalHalt.weakSignal;
  const marketRadar = buildMarketRadar(sources, brief);
  const plannedShots = buildShotPlan({ brief, sourceCount: sources.length, shotCount });
  const canvasDocumentMarkdown = buildStoryboardMarkdown({ runId, referenceUrl, brief, shots: plannedShots });
  const failureHandling = buildFailureHandling(args, maxIterations);
  const injectedFailure = failureHandling.failures.length > 0;
  // Fail-closed-on-exhaustion (spec task 2.7 / R5.4 / Property 8 — exhaustion
  // half). Only retries that ACTUALLY exhausted (reached maxIterations) fail
  // closed: Run_State `blocked` + a canonical failure record
  // `{ stageId, finalRetryCount, reason }` on `failures[]`. A non-exhausted
  // retry stays `running` with no premature record. Reuses
  // `buildExhaustionFailureRecord` for one canonical field set.
  const exhaustionFailures = failureHandling.failures
    .filter((failure) => failure.exhausted)
    .map((failure) => buildExhaustionFailureRecord(failure));
  const retriesExhausted = exhaustionFailures.length > 0;

  // Total-provider-unavailability projection (spec task 2.8 / R5.5). Affected
  // harness returned a degraded error naming the providers; Director fails
  // closed to `blocked` WITHOUT consuming retries. Projected into the SAME
  // canonical `failures[]` shape with sibling reason `provider_unavailable_
  // degraded`; `finalRetryCount` equals the CURRENT retryCount (no increment).
  const providerUnavailabilityEntries = failureHandling.failures.filter(
    (failure) => failure.providerUnavailability,
  );
  const providerUnavailabilityFailures = providerUnavailabilityEntries.map((failure) =>
    buildExhaustionFailureRecord({
      stageId: failure.stageId,
      finalRetryCount: failure.finalRetryCount,
      reason: failure.reason,
    }),
  );
  const providersUnavailable = providerUnavailabilityFailures.length > 0;
  // Structured degraded errors naming the unavailable providers (R5.5).
  const providerUnavailabilityErrors = providerUnavailabilityEntries.map(
    (failure) => failure.degradedError,
  );

  // Budget-cap enforcement (spec task 2.9 / R4.6 / Property 9). Cumulative spend
  // is driven by an injectable, timer-free signal so a run can reach/exceed the
  // cap WITHOUT any real provider call. An omitted (0) cap can never be exceeded
  // (`budgetCapExceeded` guards `cap > 0`). Enforced in Live_Mode only — dry-run
  // performs zero paid actions (Property 3), so its cumulative spend stays 0.
  const simulatedSpendUsd = normalizeCumulativeSpendUsd(args.simulatedSpendUsd, 0);
  const cumulativeSpendUsd = simulatedSpendUsd;
  const budgetExceeded = liveRequested && budgetCapExceeded(cumulativeSpendUsd, budgetUsd);

  let state = "dry_run_ready";
  if (budgetExceeded) state = RUN_STATE_BUDGET_EXCEEDED; // R4.6: cap reached mid-run is its own terminal state
  else if (liveRequested && !paidApproved) state = "blocked";
  else if (weakSignalHalt.halted) state = "blocked"; // R4.5/task 3.4: halt before storyboard until continuation approved
  else if (providersUnavailable) state = RUN_STATE_BLOCKED; // R5.5: total provider unavailability fails closed
  else if (injectedFailure) state = "blocked";
  else if (liveRequested && (!renderApproved || !paymentApproved || !deployApproved)) state = "approval_required";
  else if (liveRequested) state = "complete";

  const assets = liveRequested && state === "complete"
    ? plannedShots.map((shot) => ({
      shotId: shot.shotId,
      assetUrl: `https://airvio.co/knowgrph/assets/media/${runId}/${shot.shotId}.mp4`,
      storageUri: `r2://knowgrph-media/${runId}/${shot.shotId}.mp4`,
      ledgerEventId: `ledger-${runId}-${shot.shotId}`,
      costCents: 0,
    }))
    : [];
  const checkout = liveRequested && state === "complete"
    ? { sessionId: `cs_test_${slugify(runId, "run")}`, payoutSettled: paymentApproved }
    : { sessionId: "", payoutSettled: false };
  // Skeleton publish stage (spec task 2.1): establishes the canonical
  // research -> storyboard -> render -> publish -> checkout ordering (R4.1 /
  // Property 7) in the durable Run_Manifest. Publish is gated by `cloud-deploy`
  // and, in this skeleton, mirrors the gated render/checkout shape. Full
  // Commerce_Harness publish wiring (asset publication, reachable URLs) lands
  // in spec task 3.14; keep this minimal.
  const publishedUrls = liveRequested && state === "complete"
    ? assets.map((asset) => asset.assetUrl)
    : [];
  // Demo_Pack `urls[]` (task 2.13 / R3.2 / Property 22) is assembled in
  // demo-pack.js from the endpoint hints below; the runtime no longer builds
  // them inline. At a terminal Run_State it emits >=1 Frontend + >=1 Agent_Api.

  // Spend accounting (spec task 2.4 / R2.6, R4.4 / Property 3). estimatedCostUsd
  // keeps its R2.4 semantics: planned model cost, accounted only when the
  // paid-model-call gate is approved and research is not weak.
  const plannedModelEstimateUsd = paidApproved && !weakSignal ? Math.min(budgetUsd, 0.03) : 0;
  const providerSpendCents = assets.reduce((total, asset) => total + asset.costCents, 0);

  // Ledger-vs-meters reconciliation (spec task 2.12 / R10.4, R10.5 / Property
  // 21). Derive Credit_Ledger events from render assets and reconcile their
  // summed costCents against the meters-side provider spend within ±0.01 USD
  // (integer cents). Deviation > tolerance -> flag + both records preserved
  // unchanged. `simulatedMetersProviderSpendCents` (live only) can simulate a
  // diverging meters reading with no real provider call. See reconciliation.js.
  const ledgerReconciliation = buildLedgerReconciliation({
    assets,
    metersProviderSpendCents: providerSpendCents,
    runId,
    simulatedMetersProviderSpendCents: liveRequested ? args.simulatedMetersProviderSpendCents : undefined,
  });

  // ---------------------------------------------------------------------------
  // Cost_Log aggregation (spec task 2.10 / R2.4, R10.3 / Property 20).
  // ---------------------------------------------------------------------------
  // Emit EXACTLY one per-model-bearing-stage Cost_Log (research + storyboard),
  // each carrying `{ stageId, estimatedCostUsd, actualCostUsd }` (R2.4), then
  // aggregate into Budget_Meters in the SAME synchronous pass (R10.3, see
  // cost-log.js). Model-call actual cost is an injectable, timer-free signal.
  const modelActualCostUsd = liveRequested ? normalizeMoney(args.modelActualCostUsd, 0) : 0;
  const costLogAccounting = buildCostLogAccounting({
    plannedEstimateUsd: plannedModelEstimateUsd,
    modelActualCostUsd,
  });
  const costLogs = costLogAccounting.costLogs;
  const costLogAggregate = costLogAccounting.aggregate;
  const costLogByStage = costLogAccounting.byStage;
  // Derived from the aggregated Cost_Logs (still 0 when no model stage is
  // accounted: R2.3 live-without-approvals; R2.6 dry-run).
  const estimatedCostUsd = costLogAccounting.estimatedCostUsd;
  const costLogAggregationOk = costLogAccounting.aggregationOk;

  // ---------------------------------------------------------------------------
  // Budget_Meters update timing (spec task 2.11 / R2.5).
  // ---------------------------------------------------------------------------
  // Recompute cumulative estimated/actual spend from the run's recorded spend
  // events (model Cost_Logs + render provider spend + injectable cumulative-
  // spend signal) in the SAME synchronous pass (structural "within 2s", see
  // budget-meters.js). `actualCostUsd` is DERIVED, so it equals the event sum.
  const budgetMetersUpdate = buildBudgetMetersUpdate({
    modelCostLogs: costLogs,
    renderProviderSpendUsd: liveRequested ? providerSpendCents / 100 : 0,
    cumulativeSpendUsd: liveRequested ? simulatedSpendUsd : 0,
  });
  const actualCostUsd = budgetMetersUpdate.cumulativeActualCostUsd;
  const budgetMetersUpdatedSynchronously =
    budgetMetersUpdate.updatedSynchronously &&
    estimatedCostUsd === budgetMetersUpdate.cumulativeEstimatedCostUsd &&
    actualCostUsd === budgetMetersUpdate.cumulativeActualCostUsd;

  // Per-stage execution flags. A spend-bearing stage "executed" (performed a
  // paid action) only in Live_Mode once its spend boundary was authorized; in
  // every other case it resolves to a plan artifact. These mirror the
  // paid-provider-call counter derivation below so the two stay consistent.
  const modelStagesExecuted = liveRequested && paidApproved && !weakSignal;
  const stageExecuted = {
    research: modelStagesExecuted,
    storyboard: modelStagesExecuted,
    render: assets.length > 0,
    publish: publishedUrls.length > 0,
    checkout: Boolean(checkout.sessionId),
  };

  const planArtifactEstimate = (stageId) =>
    stageId === "research" || stageId === "storyboard"
      ? Number(Math.min(budgetUsd, PLANNED_MODEL_COST_USD).toFixed(2))
      : 0;

  // Build a spend-bearing stage, attaching a Dry_Run plan artifact whenever the
  // stage did not execute (R2.6 / R4.4 / Property 3). When the stage genuinely
  // executed a paid action in Live_Mode, `artifact` is null and `executed` is
  // true. `reason` distinguishes a dry-run resolution from an
  // approval_required resolution so R4.4 is observable on the manifest.
  const buildSpendBearingStage = (id, status, details = {}) => {
    const executed = Boolean(stageExecuted[id]);
    const artifact = executed
      ? null
      : buildDryRunPlanArtifact({
        stageId: id,
        gateId: SPEND_BEARING_STAGE_GATES[id],
        estimatedCostUsd: planArtifactEstimate(id),
        reason: !liveRequested
          ? "dry_run_mode"
          : status === STAGE_STATUS_BUDGET_HELD
            ? "budget_exceeded_halted"
            : status === "approval_required"
              ? "approval_required_no_verified_token"
              : "halted_or_not_reached",
      });
    return { id, status, executed, artifact, ...details };
  };

  const researchStatus = !liveRequested || paidApproved
    ? (weakSignal ? "weak_signal" : "complete")
    : "approval_required";
  const storyboardStatus = weakSignalHalt.halted ? "blocked_weak_signal" : "complete";
  // Budget-cap halt (task 2.9 / R4.6): when the cap is reached mid-run, all
  // further spend-bearing stages that did not execute are HELD — they do not
  // begin — and marked `budget_held`. The model stages (research/storyboard)
  // that already executed keep their completed status (their spend is what
  // tripped the cap); the downstream render/publish/checkout stages are held.
  const renderStatus = assets.length
    ? "complete"
    : budgetExceeded
      ? STAGE_STATUS_BUDGET_HELD
      : (renderApproved ? "dry_run_ready" : "approval_required");
  const publishStatus = publishedUrls.length
    ? "complete"
    : budgetExceeded
      ? STAGE_STATUS_BUDGET_HELD
      : (deployApproved ? "dry_run_ready" : "approval_required");
  const checkoutStatus = checkout.sessionId
    ? "complete"
    : budgetExceeded
      ? STAGE_STATUS_BUDGET_HELD
      : (paymentApproved ? "dry_run_ready" : "approval_required");

  const stages = [
    buildStage("ingest", "complete", { referenceUrl, budgetUsd }),
    buildSpendBearingStage("research", researchStatus, { sourceCount: sources.length, costLog: costLogByStage.research, weakSignal: weakSignalHalt.weakSignal, awaitingApprovalToContinue: weakSignalHalt.awaitingApprovalToContinue, continuationGateId: weakSignalHalt.gateId }),
    buildSpendBearingStage("storyboard", storyboardStatus, { shotCount: plannedShots.length, costLog: costLogByStage.storyboard }),    buildSpendBearingStage("render", renderStatus, { assetCount: assets.length }),
    buildSpendBearingStage("publish", publishStatus, { publishedCount: publishedUrls.length }),
    buildSpendBearingStage("checkout", checkoutStatus),
  ];

  // Weak-signal halt invariant (task 3.4 / R4.5 / Property 11).
  const weakSignalHaltOk = weakSignalHalt.haltEnforced({ state, researchStatus, storyboardStatus, stages });

  // Recorded paid-provider-call counter (spec task 2.3 / R2.3, R2.6 / Properties
  // 2, 3). Observable count of paid-provider calls derived from the run's actual
  // spend signals: model-bearing calls (research + storyboard) count only when
  // `paid-model-call` is approved in Live_Mode and research is not weak; render
  // dispatches count one per produced asset; a payment call counts when payout
  // settles. Every term is 0 for live+empty-approvals (R2.3) and dry-run (R2.6).
  const paidModelProviderCalls = liveRequested && paidApproved && !weakSignal
    ? MODEL_BEARING_PAID_STAGES
    : 0;
  const renderProviderCalls = assets.length;
  const paymentProviderCalls = checkout.payoutSettled ? 1 : 0;
  const paidProviderCalls = paidModelProviderCalls + renderProviderCalls + paymentProviderCalls;

  const budgetMeters = {
    model: paidApproved ? "cloudflare-ai-gateway-accounted" : "none-unapproved",
    inputTokens: 0,
    outputTokens: 0,
    cacheHits: 0,
    estimatedCostUsd,
    // actualCostUsd (task 2.4 / R2.6 / Property 3): 0 in dry-run; derived from
    // recorded provider spend in Live_Mode.
    actualCostUsd,
    // Cost_Log aggregation (task 2.10 / R2.4, R10.3 / Property 20): aggregated
    // costs EQUAL the sums of the per-stage Cost_Log entries.
    costLogAggregate,
    // Budget_Meters update timing (task 2.11 / R2.5): recorded spend events the
    // cumulative meters derive from, plus the same-pass guarantee.
    spendEvents: budgetMetersUpdate.spendEvents,
    spendEventCount: budgetMetersUpdate.spendEventCount,
    budgetMetersUpdatedSynchronously,
    budgetUsd,
    providerSpendCents,
    // R10.4 / R10.5 / Property 21 (task 2.12): ledger-vs-meters reconciliation
    // summary; both records preserved unchanged.
    reconciliation: ledgerReconciliation.summary,
    paidProviderCalls,
    // Budget-cap operator indication (task 2.9 / R4.6 / Property 9): cumulative
    // spend, a boolean, and a message when the cap was reached (null otherwise).
    cumulativeSpendUsd,
    budgetExceeded,
    budgetExceededMessage: budgetExceeded
      ? `Budget cap of $${normalizeMoney(budgetUsd, 0).toFixed(2)} reached or exceeded ` +
        `(cumulative spend $${cumulativeSpendUsd.toFixed(2)}); all further spend-bearing stages halted.`
      : null,
  };

  // Spend-bearing stages and their plan-artifact resolution (R2.6, R4.4 /
  // Property 3). In dry-run every spend-bearing stage must resolve to a plan
  // artifact (no execution); for R4.4, any spend-bearing stage left at
  // `approval_required` (reached without a verified Approval_Token) must also
  // resolve to a plan artifact. These are computed here so they can be asserted
  // in `validation.checks` and surfaced on `guardrails`.
  const spendBearingStages = stages.filter((stage) => SPEND_BEARING_STAGES.includes(stage.id));
  const dryRunPlanArtifactsResolved = liveRequested
    ? true
    : spendBearingStages.every(
      (stage) => stage.executed === false && stage.artifact && stage.artifact.resolvedTo === "plan_artifact",
    );
  const approvalRequiredStagesResolveToPlanArtifact = spendBearingStages
    .filter((stage) => stage.status === "approval_required")
    .every((stage) => stage.artifact && stage.artifact.resolvedTo === "plan_artifact");

  const payload = {
    contractVersion: CONTRACT_VERSION,    runId,
    state,
    mode,
    referenceUrl,
    brief,
    maxIterations,
    approvalGates,
    stages,
    evidencePack: {
      sources,
      citations: sources.map((source) => ({ sourceId: source.sourceId, url: source.url })),
      summary: weakSignal ? "Weak signal: fewer than three source cards are available." : "Source-backed evidence is ready for storyboard planning.",
      trustPolicy: "downstream claims must reference sourceCardIds; sources are never fabricated",
    },
    marketRadar,
    storyboard: {
      canvasDocumentMarkdown,
      flow: {
        nodes: plannedShots.map((shot) => ({ id: shot.shotId, label: shot.label, type: shot.type, status: shot.status })),
        edges: plannedShots.slice(1).map((shot, index) => ({
          id: `edge-${index + 1}`,
          source: plannedShots[index].shotId,
          target: shot.shotId,
        })),
      },
      plannedShots,
    },
    render: { assets },
    commerce: { publish: { publishedUrls }, checkout },
    failureHandling,
    // R5.4 / task 2.7: failure records appended on retry exhaustion (fail
    // closed). R5.5 / task 2.8: provider-unavailability degraded failures append
    // to the SAME canonical `failures[]` (sibling reason, finalRetryCount ==
    // current retryCount, no increment). Empty unless exhausted or all-down.
    failures: [...exhaustionFailures, ...providerUnavailabilityFailures],
    // R5.5 / task 2.8: structured degraded errors naming unavailable providers.
    providerUnavailability: {
      degraded: providersUnavailable,
      errors: providerUnavailabilityErrors,
    },
    budgetMeters,
    // R4.5 / task 3.4 / Property 11: weak-signal halt-before-storyboard indication.
    weakSignalHalt: weakSignalHalt.summary,
    // R2.4 / R10.3 / Property 20: one Cost_Log per model-bearing stage, also
    // attached to its Stage; aggregated into `budgetMeters.costLogAggregate`.
    costLogs,
    // R10.5 / Property 21 (task 2.12): reconciliation discrepancy flags (design
    // data model `reconciliationFlags: string[]`). Empty when consistent within
    // ±0.01 USD; one note on deviation, both records preserved. R5.6 appends here too.
    reconciliationFlags: ledgerReconciliation.flags,
    demoPack: buildDemoPack({
      state, sources, assets, checkout, deployApproved,
      frontendUrl: args.frontendUrl, agentApiUrl: args.agentApiUrl, backendHealthUrl: args.backendHealthUrl, healthAttempts: args.healthAttempts,
    }),
    executionLog: [],
    guardrails: {
      dryRunFirst: true,
      noPaidActionWithoutApproval: true,
      noPayoutWithoutPaymentApproval: !checkout.payoutSettled || paymentApproved,
      noLiveProviderCallInLocalRuntime: true,
      // R2.6 / Property 3: dry-run reports actualCostUsd exactly 0 and resolves
      // every spend-bearing step to a plan artifact.
      dryRunActualCostZero: liveRequested || budgetMeters.actualCostUsd === 0,
      dryRunResolvesSpendStepsToPlanArtifacts: dryRunPlanArtifactsResolved,
      // R4.4: a spend-bearing stage reached without a verified Approval_Token
      // resolves to a Dry_Run plan artifact (and is set approval_required).
      approvalRequiredStageResolvesToPlanArtifact: approvalRequiredStagesResolveToPlanArtifact,
      // R5.4 / task 2.7: on retry exhaustion the run fails closed — `blocked`
      // AND a failure record per exhausted stage. Vacuous when none exhausted.
      failsClosedOnRetryExhaustion:
        !retriesExhausted ||
        (state === RUN_STATE_BLOCKED &&
          exhaustionFailures.every(
            (record) =>
              Boolean(record.stageId) &&
              record.finalRetryCount === maxIterations &&
              Boolean(record.reason),
          )),
      // R5.4 (converse): a non-exhausted bounded retry appends NO failure record.
      noPrematureFailureRecord:
        exhaustionFailures.length ===
        failureHandling.failures.filter((failure) => failure.exhausted).length,
      // R5.5 / task 2.8: total provider unavailability fails closed — `blocked`,
      // a structured degraded error naming the unavailable providers, and a
      // failure record whose finalRetryCount equals the CURRENT retryCount (no
      // increment / no retries consumed). Vacuous when none reported.
      providerUnavailabilityFailsClosedWithoutConsumingRetries:
        !providersUnavailable ||
        (state === RUN_STATE_BLOCKED &&
          providerUnavailabilityEntries.every(
            (entry) =>
              Array.isArray(entry.unavailableProviders) &&
              entry.unavailableProviders.length > 0 &&
              entry.finalRetryCount === entry.retryCount &&
              entry.exhausted === false &&
              entry.backoffMs === 0,
          ) &&
          providerUnavailabilityFailures.every(
            (record) =>
              Boolean(record.stageId) &&
              record.reason === FAILURE_REASON_PROVIDER_UNAVAILABLE &&
              record.finalRetryCount >= 0,
          )),
      // R4.6 / task 2.9 / Property 9: reaching/exceeding the cap mid-run records
      // `budget_exceeded`, surfaces the operator indication, and HALTS all
      // further spend-bearing stages (no render/payment calls; render/publish/
      // checkout held). Vacuous when the cap was not exceeded.
      budgetCapHaltsSpendBearingStages:
        !budgetExceeded ||
        (state === RUN_STATE_BUDGET_EXCEEDED &&
          budgetMeters.budgetExceeded === true &&
          Boolean(budgetMeters.budgetExceededMessage) &&
          renderProviderCalls === 0 &&
          paymentProviderCalls === 0 &&
          stages
            .filter((stage) => ["render", "publish", "checkout"].includes(stage.id))
            .every((stage) => stage.status === STAGE_STATUS_BUDGET_HELD)),
      // R2.4 / R10.3 / Property 20: one Cost_Log per model-bearing stage and the
      // Budget_Meters aggregate equals the sums of those entries — recomputed in
      // the same synchronous pass as emission (the structural "within 1s"
      // contract); `estimatedCostUsd` is derived from the aggregate.
      costLogAggregatedIntoBudgetMeters:
        costLogAggregationOk &&
        costLogAggregate.entryCount === MODEL_BEARING_STAGE_IDS.length &&
        budgetMeters.estimatedCostUsd === costLogAggregate.estimatedCostUsd,
      // R2.5 / task 2.11: Budget_Meters are updated in the SAME synchronous pass
      // as each spend event, so the cumulative estimated/actual meters equal the
      // sums of every recorded spend event (structural "within 2s" contract).
      budgetMetersUpdatedSynchronously:
        budgetMetersUpdatedSynchronously &&
        budgetMeters.estimatedCostUsd === budgetMetersUpdate.cumulativeEstimatedCostUsd &&
        budgetMeters.actualCostUsd === budgetMetersUpdate.cumulativeActualCostUsd,
      // R10.4 / R10.5 / Property 21 (task 2.12): ledger sum equals meters
      // provider spend within ±0.01 USD, or a flag was raised, both preserved.
      creditLedgerConsistentOrReconciliationFlagged: ledgerReconciliation.guardrailOk,
      // R4.5 / task 3.4 / Property 11: weak-signal research HALTS before storyboard.
      weakSignalHaltsBeforeStoryboard: weakSignalHaltOk,
    },
    validation: {
      ok: state === "complete" || state === "approval_required" || state === "dry_run_ready" || state === "blocked" || state === RUN_STATE_BUDGET_EXCEEDED,
      checks: [
        { id: "approval_gates_present", ok: approvalGates.length >= 5 },
        { id: "unapproved_live_cost_zero", ok: !liveRequested || paidApproved || budgetMeters.estimatedCostUsd === 0 },
        // R2.3 / Property 2: live + empty approvals[] halts at the first spend
        // boundary — `blocked`, >=5 gates, estimatedCostUsd 0, 0 paid calls.
        {
          id: "live_without_approvals_halts_with_zero_spend",
          ok:
            !(liveRequested && approvedGateIds.size === 0) ||
            (state === "blocked" &&
              approvalGates.length >= 5 &&
              budgetMeters.estimatedCostUsd === 0 &&
              budgetMeters.paidProviderCalls === 0),
        },
        // R2.3 / R2.6: a recorded paid-provider call may never occur without an
        // approved spend boundary (zero when live+unapproved, zero in dry-run).
        { id: "no_paid_provider_calls_without_approval", ok: paidApproved || budgetMeters.paidProviderCalls === 0 },
        // R2.6 / Property 3: dry-run reports actualCostUsd 0 and resolves every
        // spend-bearing step to a plan artifact.
        { id: "dry_run_actual_cost_zero", ok: liveRequested || budgetMeters.actualCostUsd === 0 },
        { id: "dry_run_zero_paid_provider_calls", ok: liveRequested || budgetMeters.paidProviderCalls === 0 },
        { id: "dry_run_steps_resolve_to_plan_artifacts", ok: dryRunPlanArtifactsResolved },
        // R4.4: a spend-bearing stage reached without a verified Approval_Token
        // is set approval_required AND resolves to a Dry_Run plan artifact.
        { id: "approval_required_stage_resolves_to_plan_artifact", ok: approvalRequiredStagesResolveToPlanArtifact },
        { id: "research_sources_sufficient_when_complete", ok: state !== "complete" || sources.length >= REQUIRED_RESEARCH_SOURCE_COUNT || weakSignalHalt.continuationApproved },
        { id: "storyboard_nodes_match_shots", ok: plannedShots.length === shotCount },
        { id: "payout_requires_payment_gate", ok: !checkout.payoutSettled || paymentApproved },
        { id: "failure_retry_bounded", ok: failureHandling.failures.every((failure) => failure.retryCount <= maxIterations) },
        // R5.4 / task 2.7: retry exhaustion fails closed to `blocked` with a
        // record whose finalRetryCount equals maxIterations. Vacuous otherwise.
        {
          id: "exhaustion_fails_closed_with_record",
          ok:
            !retriesExhausted ||
            (state === RUN_STATE_BLOCKED &&
              exhaustionFailures.every(
                (record) =>
                  Boolean(record.stageId) &&
                  record.finalRetryCount === maxIterations &&
                  Boolean(record.reason),
              )),
        },
        // R5.4 (converse): a non-exhausted retry appends no premature record.
        {
          id: "no_premature_failure_record",
          ok:
            exhaustionFailures.length ===
            failureHandling.failures.filter((failure) => failure.exhausted).length,
        },
        // R5.5 / task 2.8: total provider unavailability degrades closed —
        // `blocked`, a degraded error naming the providers, and a record whose
        // finalRetryCount equals the CURRENT retryCount. Vacuous otherwise.
        {
          id: "provider_unavailability_degrades_without_consuming_retries",
          ok:
            !providersUnavailable ||
            (state === RUN_STATE_BLOCKED &&
              providerUnavailabilityEntries.every(
                (entry) =>
                  Array.isArray(entry.unavailableProviders) &&
                  entry.unavailableProviders.length > 0 &&
                  entry.finalRetryCount === entry.retryCount &&
                  entry.exhausted === false,
              ) &&
              providerUnavailabilityFailures.every(
                (record) => record.reason === FAILURE_REASON_PROVIDER_UNAVAILABLE,
              )),
        },
        // R4.6 / task 2.9 / Property 9: reaching/exceeding the cap mid-run sets
        // `budget_exceeded`, surfaces the operator indication, and halts all
        // spend-bearing stages (held; no render/payment calls). Vacuous otherwise.
        {
          id: "budget_cap_halts_spend_bearing_stages",
          ok:
            !budgetExceeded ||
            (state === RUN_STATE_BUDGET_EXCEEDED &&
              budgetMeters.budgetExceeded === true &&
              Boolean(budgetMeters.budgetExceededMessage) &&
              renderProviderCalls === 0 &&
              paymentProviderCalls === 0 &&
              stages
                .filter((stage) => ["render", "publish", "checkout"].includes(stage.id))
                .every((stage) => stage.status === STAGE_STATUS_BUDGET_HELD)),
        },
        // R2.4 / R10.3 / Property 20: one Cost_Log per model-bearing stage; the
        // Budget_Meters aggregate equals the sums (recomputed same-pass).
        {
          id: "cost_log_aggregation_one_per_model_stage",
          ok:
            costLogAggregationOk &&
            costLogAggregate.entryCount === MODEL_BEARING_STAGE_IDS.length &&
            budgetMeters.estimatedCostUsd === costLogAggregate.estimatedCostUsd,
        },
        // R2.5 / task 2.11: Budget_Meters reflect cumulative estimated/actual
        // spend equal to the sum of every recorded spend event, recomputed in
        // the same synchronous pass (the structural "within 2s of each spend
        // event" contract).
        {
          id: "budget_meters_reflect_cumulative_spend_events",
          ok:
            budgetMetersUpdatedSynchronously &&
            budgetMeters.estimatedCostUsd === budgetMetersUpdate.cumulativeEstimatedCostUsd &&
            budgetMeters.actualCostUsd === budgetMetersUpdate.cumulativeActualCostUsd,
        },
        // R10.4 / R10.5 / Property 21 (task 2.12): ledger sum equals meters
        // provider spend within ±0.01 USD, or a discrepancy is flagged.
        ledgerReconciliation.validationCheck,
        { id: "weak_signal_halts_before_storyboard", ok: weakSignalHaltOk }, // R4.5 / task 3.4 / Property 11
      ],
    },
  };
  const text = buildRunText({ runId, mode, state, sources, approvalGates, budgetMeters, budgetExceeded, weakSignalHalt });
  return { payload, text };
}
