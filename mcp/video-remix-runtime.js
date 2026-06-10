// Public entry for the video-remix Director runtime.
//
// The implementation was split into cohesive, single-responsibility modules
// under `mcp/video-remix/` (input validation, approvals, evidence/research,
// storyboard, stages, failure handling, budget, demo-pack, and the top-level
// `runVideoRemix` orchestrator) so every source file stays under the 600-line
// limit. This module preserves the original public surface by re-exporting the
// same named symbols the rest of the codebase imports, so NO importing file or
// test needs to change.
//
// Pure / SDK-agnostic: importable by both the Node tests and the Cloudflare
// Worker bundle.

export {
  normalizeMaxIterations,
  computeRetryBackoffMs,
  retryRunStateFor,
  exhaustionRunState,
  buildExhaustionFailureRecord,
  buildBoundedRetryPlan,
} from "./video-remix/retry.js";

export {
  normalizeUnavailableProviders,
  buildProviderUnavailabilityDegradedError,
} from "./video-remix/provider-availability.js";

export {
  normalizeCumulativeSpendUsd,
  budgetCapExceeded,
} from "./video-remix/budget.js";

export {
  buildSpendEvents,
  aggregateSpendEvents,
  budgetMetersReflectSpendEvents,
  buildBudgetMetersUpdate,
} from "./video-remix/budget-meters.js";

export {
  MODEL_BEARING_STAGE_IDS,
  buildModelStageCostLogs,
  aggregateCostLogs,
  costLogAggregationHolds,
  buildCostLogAccounting,
} from "./video-remix/cost-log.js";

export {
  RECONCILIATION_TOLERANCE_CENTS,
  RECONCILIATION_FLAG_REASON,
  RECONCILIATION_CHECK_ID,
  deriveLedgerEventsFromAssets,
  buildReconciliationFlag,
  reconcileLedgerVsMeters,
  ledgerReconciliationHolds,
  buildLedgerReconciliation,
} from "./video-remix/reconciliation.js";

export {
  DirectorInputValidationError,
  validateDirectorInput,
} from "./video-remix/director-input.js";

export {
  RESEARCH_MAX_RESULTS,
  RESEARCH_MIN_RESULTS,
  RESEARCH_MIN_SOURCE_CARDS,
  RESEARCH_MAX_SOURCE_CARDS,
  RESEARCH_DEFAULT_MAX_RESULTS,
  RESEARCH_DEADLINE_MS,
  RESEARCH_GATE_ID,
  RESEARCH_DEGRADE_EXA_ERROR,
  RESEARCH_DEGRADE_DEADLINE,
  RESEARCH_DEGRADE_INSUFFICIENT_SOURCES,
  ResearchHarnessInputError,
  clampMaxResults,
  validateResearchInput,
  createDeterministicExaClient,
  createDeterministicSummaryClient,
  runResearchHarness,
} from "./video-remix/research-harness.js";

export { runVideoRemix } from "./video-remix/run-video-remix.js";

export {
  KGC_COMPUTING_FLOW_SCHEMA,
  STORYBOARD_GATE_ID,
  STORYBOARD_MIN_SHOTS,
  STORYBOARD_MAX_SHOTS,
  STORYBOARD_DEFAULT_SHOT_COUNT,
  STORYBOARD_BRIEF_MAX_LENGTH,
  STORYBOARD_STATUS_COMPLETE,
  STORYBOARD_STATUS_REJECTED,
  STORYBOARD_STATUS_FALLBACK,
  STORYBOARD_STATUS_UNRESOLVED_SOURCE,
  StoryboardHarnessInputError,
  StoryboardSchemaValidationError,
  StoryboardUnresolvedSourceError,
  clampShotCount,
  collectEvidenceSourceIds,
  validateStoryboardInput,
  createDeterministicStoryboardClient,
  validateKgcComputingFlowV1,
  emitValidatedStoryboard,
  runStoryboardHarness,
} from "./video-remix/storyboard-harness.js";

export {
  FALLBACK_SHOT_COUNT,
  FALLBACK_REASON,
  reasoningSignaledFailure,
  fallbackReasonFrom,
  buildFallbackStoryboardDocument,
  serializeFlow,
  parseFlow,
  flowEquivalent,
  flowRoundTripEquivalent,
} from "./video-remix/storyboard-fallback.js";

export {
  collectClaimSourceIds,
  findUnresolvedSourceReferences,
  checkSourceReferentialIntegrity,
  buildUnresolvedSourceResult,
} from "./video-remix/storyboard-references.js";

export {
  WEAK_SIGNAL_CONTINUE_GATE_ID,
  verifyContinuationApproval,
  buildWeakSignalHalt,
} from "./video-remix/weak-signal-halt.js";

export {
  RENDER_GATE_ID,
  RENDER_TOKEN_TTL_MS,
  RENDER_TOKEN_REASON_ABSENT,
  RENDER_TOKEN_REASON_MALFORMED,
  RENDER_TOKEN_REASON_GATE_MISMATCH,
  RENDER_TOKEN_REASON_INVALID_SIGNATURE,
  RENDER_TOKEN_REASON_EXPIRED,
  RENDER_TOKEN_REASON_CONSUMED,
  verifyRenderToken,
} from "./video-remix/render-token.js";

export {
  MEDIA_BUCKET_PREFIX,
  DEFAULT_MEDIA_BUCKET,
  PROVIDER_BYTEPLUS_QUEUE,
  PROVIDER_MOCK,
  DEFAULT_SHOT_SPEND_CENTS,
  mediaObjectKey,
  buildMediaAssetReference,
  renderJobId,
  renderLedgerEventId,
  createDeterministicRenderQueueClient,
  createDeterministicMockProviderClient,
  createDeterministicLedgerClient,
  selectRenderProvider,
} from "./video-remix/render-providers.js";

export {
  RENDER_DISPATCH_DEADLINE_MS,
  RENDER_COMPLETION_TIMEOUT_MS,
  RenderHarnessInputError,
  validateRenderInput,
  runRenderHarness,
} from "./video-remix/render-harness.js";

export {
  DEFAULT_GATE_TOKEN_TTL_MS,
  GATE_TOKEN_REASON_ABSENT,
  GATE_TOKEN_REASON_MALFORMED,
  GATE_TOKEN_REASON_GATE_MISMATCH,
  GATE_TOKEN_REASON_INVALID_SIGNATURE,
  GATE_TOKEN_REASON_EXPIRED,
  GATE_TOKEN_REASON_CONSUMED,
  verifyGateToken,
} from "./video-remix/gate-token.js";

export {
  APPROVAL_GATE_IDS,
  APPROVAL_TOKEN_TTL_MS,
  ApprovalTokenIssueError,
  isCanonicalGateId,
  createInMemoryApprovalTokenStore,
  createApprovalTokenIssuer,
} from "./video-remix/approval-token-issuer.js";

export {
  APPROVAL_GATE_GUARD_TTL_MS,
  verifyImmediatelyBeforeSpend,
  withApprovalGate,
} from "./video-remix/approval-gate-guard.js";

export {
  DIRECTOR_RENDER_GATE_ID,
  DIRECTOR_PAYMENT_GATE_ID,
  enforceRenderGate,
  enforceCheckoutGate,
  recordRenderGate,
  recordCheckoutGate,
  enforceDirectorRenderGate,
  enforceDirectorCheckoutGate,
} from "./video-remix/director-gates.js";

export {
  APPROVAL_REJECTION_ERROR_CODE,
  APPROVAL_REJECTION_DESCRIPTIONS,
  describeApprovalRejection,
  buildApprovalRejectionError,
} from "./video-remix/approval-rejection.js";

export {
  PAYMENT_GATE_ID,
  COMMERCE_CHECKOUT_DEADLINE_MS,
  STRIPE_SESSION_STATUS_OPEN,
  STRIPE_SESSION_PAYMENT_STATUS_UNPAID,
  STRIPE_CHECKOUT_MODE_PAYMENT,
  STRIPE_DEFAULT_CURRENCY,
  PAYOUT_STATE_PRE_CHECKOUT,
  PAYOUT_STATE_SETTLED,
  PROVIDER_STRIPE,
  DEFAULT_CHECKOUT_AMOUNT_TOTAL,
  stripeSessionId,
  stripeCheckoutUrl,
  createDeterministicStripeClient,
  createDeterministicPayoutClient,
  createDeterministicPublishClient,
} from "./video-remix/commerce-providers.js";

export {
  CommerceHarnessInputError,
  validatePublishInput,
  validateCheckoutInput,
  runPublish,
  runCheckout,
} from "./video-remix/commerce-harness.js";

export {
  WEBHOOK_SIGNATURE_TOLERANCE_SECONDS,
  WEBHOOK_RECONCILIATION_FLAG_REASON,
  WEBHOOK_RECONCILIATION_CHECK_ID,
  WEBHOOK_MISMATCH_REASON_SIGNATURE,
  WEBHOOK_MISMATCH_REASON_UNKNOWN_SESSION,
  WEBHOOK_MISMATCH_REASON_AMOUNT,
  WEBHOOK_MISMATCH_REASON_CURRENCY,
  PAYOUT_DISPOSITION_WITHHELD,
  PAYOUT_DISPOSITION_SETTLEMENT_ALLOWED,
  extractWebhookSessionId,
  indexVerifiedSessions,
  createDeterministicWebhookVerifier,
  buildWebhookReconciliationFlag,
  matchWebhookToVerifiedSession,
  reconcileStripeWebhook,
  webhookReconciliationHolds,
} from "./video-remix/commerce-webhook.js";
