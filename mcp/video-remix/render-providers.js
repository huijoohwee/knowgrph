// Injectable provider / R2-media / Credit_Ledger seams for the video-remix
// Render_Harness (knowgrph-acos-mcp-connector spec, task 3.9 / R8.1, R8.3,
// R8.4, R8.5 / Properties 15, 16). These are the SEAMS that integration task
// 9.2 swaps for the live wiring into
// `cloudflare/workers/knowgrph-payment/strytreeApi.ts` — the BytePlus/PixVerse
// generation queue (`STRYTREE_GENERATION_QUEUE`), the R2 media bucket
// (`STRYTREE_MEDIA_BUCKET`), and the `StrytreeCreditLedgerActor`
// (`STRYTREE_CREDIT_LEDGER`). Here every default is a DETERMINISTIC, in-memory
// mock so the local runtime makes ZERO live network calls (reuse-not-rebuild:
// the live module already owns the real dispatch/storage/ledger logic).
//
// The seam shapes mirror the live wiring exactly so 9.2 is a drop-in swap:
//   * queue client : `dispatch({ shot, runId, idempotencyKey })` ->
//     `{ assetUrl, objectKey, bucket, providerJobId, provider, costCents }`
//     (the live client enqueues `strytree.generation_job.created` and resolves
//     the stored R2 object key `strytree/generation/<jobId>/video.json`).
//   * ledger client: `record({ ledgerEventId, runId, shotId, provider,
//     providerSpendCents })` -> the recorded Credit_Ledger event (the live
//     client calls `writeLedgerEvent` against the `StrytreeCreditLedgerActor`).
//
// Pure / SDK-agnostic apart from the injected clients: importable by both the
// Node tests and the Cloudflare Worker bundle.

import { cleanString, slugify } from "./helpers.js";

// R2 media object-key prefix — matches the live `completeGenerationJobSuccess`
// key shape `strytree/generation/<jobId>/video.json` in strytreeApi.ts so an
// asset reference produced here is resolvable under the knowgrph media bucket
// (R8.3) once the live R2 binding is wired in task 9.2.
export const MEDIA_BUCKET_PREFIX = "strytree/generation";
export const DEFAULT_MEDIA_BUCKET = "strytree-media";

// Provider identities (R8.4). The deterministic LIVE-path mock represents the
// BytePlus/PixVerse render queue; the zero-spend mock is the R8.5 fallback.
export const PROVIDER_BYTEPLUS_QUEUE = "byteplus-queue";
export const PROVIDER_MOCK = "mock";

// Deterministic per-shot provider spend (in integer cents) charged on the
// live-path mock so the success path exercises a non-zero Credit_Ledger event
// (R8.4 / Property 15). Cents-exact, matching the cost-log/reconciliation
// modules so ledger sums reconcile without float drift. The zero-spend mock
// always charges 0 (R8.5 / Property 16).
export const DEFAULT_SHOT_SPEND_CENTS = 12;

/**
 * Build the canonical R2 media object key for a render job (R8.3). Mirrors the
 * live `videoObjectKey` shape in strytreeApi.ts.
 */
export function mediaObjectKey(jobId) {
  return `${MEDIA_BUCKET_PREFIX}/${jobId}/video.json`;
}

/**
 * Build a resolvable asset reference under the knowgrph media bucket (R8.3).
 * Returns `{ assetUrl, objectKey, bucket }`. The `assetUrl` is an `r2://`
 * reference so it is unambiguously a media-bucket object (not a public URL);
 * task 9.2 can map it to a signed/public URL when the live binding is wired.
 */
export function buildMediaAssetReference(jobId, bucket = DEFAULT_MEDIA_BUCKET) {
  const objectKey = mediaObjectKey(jobId);
  return {
    assetUrl: `r2://${bucket}/${objectKey}`,
    objectKey,
    bucket,
  };
}

/**
 * Deterministic render-job id for a shot within a run. Stable for a given
 * (runId, shotId) so a replay is reproducible and the media key is stable.
 */
export function renderJobId(runId, shotId) {
  return `genshot_${slugify(runId, "run")}_${slugify(shotId, "shot")}`;
}

/**
 * Deterministic Credit_Ledger event id for a shot within a run. Mirrors the
 * live `buildId('ledger_generation', ...)` convention in strytreeApi.ts so the
 * id is stable and run/shot-scoped.
 */
export function renderLedgerEventId(runId, shotId) {
  return `ledger_render_${slugify(runId, "run")}_${slugify(shotId, "shot")}`;
}

/**
 * Build the DEFAULT deterministic render-queue client (the BytePlus/PixVerse
 * live-path seam). It performs NO network call: it synchronously resolves a
 * stable media asset reference and a fixed per-shot provider spend, modeling
 * what the live queue + R2 round-trip WOULD produce. Integration task 9.2
 * injects the real client via `deps.queueClient`.
 *
 * @param {object} [options]
 * @param {number} [options.spendCents] - per-shot provider spend (cents).
 * @param {string} [options.bucket]     - media bucket name.
 * @param {string} [options.provider]   - provider identity recorded on assets.
 */
export function createDeterministicRenderQueueClient(options = {}) {
  const spendCents = Number.isFinite(options.spendCents)
    ? Math.max(0, Math.round(options.spendCents))
    : DEFAULT_SHOT_SPEND_CENTS;
  const bucket = cleanString(options.bucket, DEFAULT_MEDIA_BUCKET);
  const provider = cleanString(options.provider, PROVIDER_BYTEPLUS_QUEUE);
  return {
    isDeterministicMock: true,
    provider,
    dispatch({ shot, runId }) {
      const shotId = shot.shotId;
      const jobId = renderJobId(runId, shotId);
      const media = buildMediaAssetReference(jobId, bucket);
      return {
        ...media,
        providerJobId: jobId,
        provider,
        costCents: spendCents,
      };
    },
  };
}

/**
 * Build the DETERMINISTIC zero-spend mock provider client (R8.5 / Property 16).
 * Used when no provider key is available OR the run's cumulative provider spend
 * has reached/exceeded the budget cap. Produces a resolvable media asset
 * reference but records ZERO provider spend.
 */
export function createDeterministicMockProviderClient(options = {}) {
  const bucket = cleanString(options.bucket, DEFAULT_MEDIA_BUCKET);
  return {
    isDeterministicMock: true,
    isZeroSpendMock: true,
    provider: PROVIDER_MOCK,
    dispatch({ shot, runId }) {
      const shotId = shot.shotId;
      const jobId = `${renderJobId(runId, shotId)}_mock`;
      const media = buildMediaAssetReference(jobId, bucket);
      return {
        ...media,
        providerJobId: jobId,
        provider: PROVIDER_MOCK,
        costCents: 0,
      };
    },
  };
}

/**
 * Build the DEFAULT deterministic Credit_Ledger client (the
 * `StrytreeCreditLedgerActor` seam, R8.4). It records the event in memory and
 * returns it; the live client (task 9.2) writes through `writeLedgerEvent` to
 * the Durable Object. The recorded event captures the provider identity and the
 * provider spend (in cents) for the shot (R8.4 / Property 15).
 */
export function createDeterministicLedgerClient() {
  const events = [];
  return {
    isDeterministicMock: true,
    record({ ledgerEventId, runId, shotId, provider, providerSpendCents }) {
      const event = {
        ledgerEventId,
        runId,
        shotId,
        provider: cleanString(provider, PROVIDER_MOCK),
        providerSpendCents: Number.isFinite(providerSpendCents)
          ? Math.max(0, Math.round(providerSpendCents))
          : 0,
      };
      events.push(event);
      return event;
    },
    // Test/inspection helper — the in-memory record of everything written.
    recordedEvents: events,
  };
}

/**
 * Decide which provider a shot routes to (R8.5 / Property 16). Routes to the
 * zero-spend mock when NO provider key is available OR the run's cumulative
 * recorded provider spend already meets/exceeds the configured budget cap;
 * otherwise routes to the live-path queue provider.
 *
 * @param {object} args
 * @param {boolean} args.providerKeyAvailable - whether a provider key exists.
 * @param {number} args.cumulativeSpendCents  - run's recorded provider spend.
 * @param {number} [args.budgetCapCents]      - configured cap (cents); omitted
 *   / non-finite means "no cap".
 * @returns {{ useMock: boolean, reason: string|null }}
 */
export function selectRenderProvider({ providerKeyAvailable, cumulativeSpendCents, budgetCapCents }) {
  if (!providerKeyAvailable) {
    return { useMock: true, reason: "no_provider_key" };
  }
  const cap = Number(budgetCapCents);
  if (Number.isFinite(cap) && Number(cumulativeSpendCents) >= cap) {
    return { useMock: true, reason: "budget_cap_reached" };
  }
  return { useMock: false, reason: null };
}
