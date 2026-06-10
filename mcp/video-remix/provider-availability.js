// Total-provider-unavailability degraded-error model for the video-remix
// Director runtime (spec task 2.8 / R5.5). Extracted verbatim from
// `mcp/video-remix-runtime.js` (reuse-not-rebuild). Pure and timer-free;
// importable by both the Node tests and the Cloudflare Worker bundle.

import { FAILURE_REASON_PROVIDER_UNAVAILABLE } from "./constants.js";
import { cleanString } from "./helpers.js";

/**
 * Normalize a caller-supplied `unavailableProviders` value into a de-duplicated
 * list of clean provider-name strings (spec task 2.8 / R5.5).
 *
 * Accepts a single name, an array of names, or an array of objects carrying a
 * `provider` / `name` / `id` field (so the injection seam can name providers
 * however the upstream Ai_Gateway error surfaces them). Empty / blank entries
 * are dropped and order is preserved. This is the SEPARATE injection used to
 * model total provider unavailability — it deliberately does NOT flow through
 * the bounded-retry schedule (`buildBoundedRetryPlan`), so it consumes no
 * retries.
 */
export function normalizeUnavailableProviders(value) {
  const list = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  const seen = new Set();
  const providers = [];
  for (const entry of list) {
    const name =
      typeof entry === "string"
        ? cleanString(entry)
        : cleanString(entry?.provider || entry?.name || entry?.id);
    if (name && !seen.has(name)) {
      seen.add(name);
      providers.push(name);
    }
  }
  return providers;
}

/**
 * Build the structured degraded error a harness returns when the Ai_Gateway
 * reports that ALL providers are unavailable (spec task 2.8 / R5.5).
 *
 * R5.5: IF the Ai_Gateway reports that all providers are unavailable, THEN the
 * affected harness SHALL return a structured degraded error identifying the
 * unavailable providers, and the Director SHALL set Run_State `blocked` WITHOUT
 * consuming additional retries.
 *
 * The error explicitly NAMES the unavailable providers (`unavailableProviders`)
 * and carries `retriesConsumed: 0` plus a `finalRetryCount` equal to the stage's
 * CURRENT retryCount (no increment) so "without consuming additional retries"
 * is observable. It is structured (not thrown) because, unlike the Director
 * input-validation gate, this is a graceful degradation the Director records on
 * the Run_Manifest rather than a rejected call.
 */
export function buildProviderUnavailabilityDegradedError({ stageId, providers, retryCount } = {}) {
  const unavailableProviders = normalizeUnavailableProviders(providers);
  const count = Math.max(0, Math.floor(Number(retryCount) || 0));
  return {
    kind: "degraded_error",
    code: "all_providers_unavailable",
    degraded: true,
    stageId: cleanString(stageId, "unknown_stage"),
    unavailableProviders,
    // No additional retries are consumed (R5.5): finalRetryCount stays at the
    // current count and retriesConsumed is explicitly 0.
    finalRetryCount: count,
    retriesConsumed: 0,
    reason: FAILURE_REASON_PROVIDER_UNAVAILABLE,
    message: unavailableProviders.length
      ? `Ai_Gateway reports all providers unavailable: ${unavailableProviders.join(", ")}.`
      : "Ai_Gateway reports all providers unavailable.",
  };
}
