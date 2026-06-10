// Failure-handling builder for the video-remix Director runtime: composes the
// bounded-retry model (tasks 2.6/2.7), the transient/fail-always injections,
// and the total-provider-unavailability degraded path (task 2.8). Extracted
// verbatim from `mcp/video-remix-runtime.js` (reuse-not-rebuild).

import {
  RUN_STATE_BLOCKED,
  FAILURE_REASON_EXHAUSTED,
  FAILURE_REASON_TRANSIENT,
  FAILURE_REASON_PROVIDER_UNAVAILABLE,
} from "./constants.js";
import { cleanString } from "./helpers.js";
import {
  computeRetryBackoffMs,
  retryRunStateFor,
  exhaustionRunState,
  deriveFailureStageId,
  buildBoundedRetryPlan,
} from "./retry.js";
import {
  normalizeUnavailableProviders,
  buildProviderUnavailabilityDegradedError,
} from "./provider-availability.js";

function buildFailureHandling(args, maxIterations) {
  const injectedTool = cleanString(args.failOnceTool);
  // Fail-always injection (spec task 2.7 / R5.4): the stage fails on EVERY
  // attempt, so its bounded retries exhaust at `maxIterations`. Distinct from
  // `failOnceTool` (a single transient failure that retries within the bound).
  // This drives the fail-closed exhaustion path deterministically and without
  // any real sleeping (the bounded-retry model is pure/timer-free).
  const failAlwaysTool = cleanString(args.failAlwaysTool);
  // Deterministic bounded-retry model (task 2.6 / R5.1–R5.3 / Property 8).
  // `maxIterations` is already normalized to [1,100] by the caller; pass it
  // through `buildBoundedRetryPlan` to attach the exponential-backoff schedule
  // so the policy is observable on the Run_Manifest and unit/property testable.
  const retryPlan = buildBoundedRetryPlan({ maxIterations });
  const bounded = retryPlan.maxIterations;

  const failures = [];

  // Transient injected failure (`failOnceTool`): one failure is recorded and
  // the stage retries within the bound. retryCount is 1 (+1 per attempt, R5.1).
  // While retryCount < maxIterations the retry stays `running` (R5.3) and NO
  // canonical exhaustion failure record is appended (it has not failed closed).
  // The entry carries the canonical `{ stageId, finalRetryCount, reason }`
  // fields PLUS retry diagnostics, so it shares one field set with the
  // top-level Run_Manifest `failures[]` (no divergent shapes).
  if (injectedTool) {
    const retryCount = 1;
    const exhausted = exhaustionRunState(retryCount, bounded) === RUN_STATE_BLOCKED;
    failures.push({
      toolName: injectedTool,
      stageId: deriveFailureStageId(injectedTool),
      failureKind: exhausted ? "injected_tool_failure_exhausted" : "injected_tool_failure",
      retryCount, // +1 per attempt (R5.1)
      finalRetryCount: retryCount,
      backoffMs: computeRetryBackoffMs(0), // first retry waits 1s (R5.1)
      // R5.3/R5.4: `running` while retryCount < maxIterations, else fail closed.
      runState: exhausted ? RUN_STATE_BLOCKED : retryRunStateFor(retryCount, bounded),
      exhausted,
      reason: exhausted ? FAILURE_REASON_EXHAUSTED : FAILURE_REASON_TRANSIENT,
      resolution: exhausted
        ? "failed closed: Run_State blocked, no unapproved spend executed"
        : "retry bounded, no unapproved spend executed",
    });
  }

  // Fail-always injection (`failAlwaysTool`): every attempt fails, so retries
  // exhaust at `maxIterations` and the stage FAILS CLOSED (R5.4 / task 2.7).
  // finalRetryCount == maxIterations; Run_State -> blocked; a canonical failure
  // record is appended to the top-level Run_Manifest `failures[]`.
  if (failAlwaysTool) {
    const finalRetryCount = bounded; // retries exhausted at the bound (R5.2)
    failures.push({
      toolName: failAlwaysTool,
      stageId: deriveFailureStageId(failAlwaysTool),
      failureKind: "injected_tool_failure_exhausted",
      retryCount: finalRetryCount,
      finalRetryCount,
      backoffMs: computeRetryBackoffMs(finalRetryCount - 1), // final attempt's backoff
      runState: RUN_STATE_BLOCKED, // exhausted -> fail closed (R5.4)
      exhausted: true,
      reason: FAILURE_REASON_EXHAUSTED,
      resolution: "failed closed: Run_State blocked, no unapproved spend executed",
    });
  }

  // Total-provider-unavailability injection (`unavailableProviders`): spec task
  // 2.8 / R5.5. This is a SEPARATE branch from the bounded-retry schedule — the
  // Ai_Gateway reporting that ALL providers are unavailable is not a transient
  // stage failure to retry; the affected harness returns a structured degraded
  // error identifying the unavailable providers and the Director FAILS CLOSED
  // to `blocked` WITHOUT consuming additional retries. Therefore:
  //   * `finalRetryCount` equals the stage's CURRENT retryCount (default 0; an
  //     optional `providerUnavailableAtRetryCount` models a stage already mid-
  //     retry) — it is NOT incremented and is NOT derived from `maxIterations`;
  //   * `backoffMs` is 0 (no retry is scheduled);
  //   * `exhausted` is false (the bounded retries were never advanced);
  //   * `degraded` / `providerUnavailability` mark the cause so it is
  //     distinguishable from a retry-exhaustion failure.
  const unavailableProviders = normalizeUnavailableProviders(args.unavailableProviders);
  if (unavailableProviders.length > 0) {
    const providerStageId = deriveFailureStageId(args.providerUnavailableTool) || "research";
    const currentRetryCount = Math.max(
      0,
      Math.min(bounded, Math.floor(Number(args.providerUnavailableAtRetryCount) || 0)),
    );
    const degradedError = buildProviderUnavailabilityDegradedError({
      stageId: providerStageId,
      providers: unavailableProviders,
      retryCount: currentRetryCount,
    });
    failures.push({
      toolName: cleanString(args.providerUnavailableTool, providerStageId),
      stageId: providerStageId,
      failureKind: "provider_unavailable_degraded",
      // No increment: finalRetryCount equals the CURRENT retryCount (R5.5).
      retryCount: currentRetryCount,
      finalRetryCount: currentRetryCount,
      backoffMs: 0, // no retry scheduled — retries are not consumed
      runState: RUN_STATE_BLOCKED, // R5.5: Director sets Run_State blocked
      exhausted: false, // bounded retries were never advanced
      degraded: true,
      providerUnavailability: true,
      unavailableProviders,
      degradedError,
      reason: FAILURE_REASON_PROVIDER_UNAVAILABLE,
      resolution:
        "failed closed: Run_State blocked, structured degraded error returned, no additional retries consumed",
    });
  }

  return {
    policy:
      "retry under maxIterations with exponential backoff (1s, doubling, capped 30s), then fail closed to blocked with evidence",
    maxIterations: bounded,
    // Backoff model (R5.1): base 1s, doubling per attempt, capped at 30s. The
    // schedule maps each bounded attempt -> { retryCount, delayMs, runState }.
    backoff: {
      baseMs: retryPlan.baseMs,
      capMs: retryPlan.capMs,
      schedule: retryPlan.schedule,
    },
    // Run_State once retries are exhausted (-> blocked). task 2.7 performs the
    // transition; this marks the seam value the model exposes.
    exhaustionRunState: retryPlan.exhaustionRunState,
    failures,
  };
}

export { buildFailureHandling };
