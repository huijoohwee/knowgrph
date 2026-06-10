// LIVE stage clients for the video-remix Director runtime — Storyboard
// (BytePlus chat via Cloudflare AI Gateway), Render (Strytree/BytePlus queue),
// and Commerce (Stripe via the payment worker)
// (knowgrph-acos-mcp-connector runtime-readiness path, task 12.4).
//
// These are the drop-in replacements for the deterministic in-memory mocks in
// `storyboard-harness.js`, `render-harness.js`, and `commerce-harness.js`. Each
// matches the EXACT injectable client seam the corresponding harness expects,
// performs a single real HTTP call through an injectable `fetchImpl`, maps the
// response into the harness contract shape, and FAILS CLOSED with a typed error
// so the harness's defined fallback path engages (storyboard single-node
// fallback R7.5; render mock-provider fallback R8.5/R8.6; commerce gate
// rejection / R9.4 failure). Model routing stays on the Cloudflare control
// plane (R11): these clients live only on the control-plane tier.
//
// ── Harness async constraint (RESOLVED by task 12.4a) ────────────────────────
//   * `runStoryboardHarness` is ASYNC and `await`s `chatClient.plan(...)`, so
//     the live BytePlus storyboard client below is consumable via that harness.
//   * The Render + Commerce live clients are async (real network calls). The
//     synchronous `runRenderHarness` / `runCheckout` / `runPublish` cannot
//     consume them, so task 12.4a added ASYNC sibling entry points —
//     `runRenderHarnessAsync`, `runCheckoutAsync`, `runPublishAsync` — that
//     `await` these seams. The live wiring layer must call those async variants
//     (the `requiresAsyncHarness: true` flag marks clients that require them).
//     The deterministic sync harnesses remain the default for the Director/test
//     path. These clients are exported + unit-tested in isolation and surfaced
//     by `resolveStageClients`; threading them into the deployed Director run is
//     the remaining live-wiring step (task 12.5 extension).
//
// Pure / SDK-agnostic apart from the injected `fetchImpl`: importable by both
// the Node tests and the Cloudflare Worker bundle, and unit-testable with a
// fake `fetch` (ZERO live calls).

import { cleanString } from "./helpers.js";

// Default endpoints / models. Kept as local constants (same discipline as the
// Exa client) so this JS module imports nothing from the TS SSOTs at runtime.
export const DEFAULT_AI_GATEWAY_CHAT_PATH = "/chat/completions";
export const DEFAULT_BYTEPLUS_CHAT_MODEL = "skylark-chat";

/** Typed errors so each harness routes to its defined fallback path. */
export class StoryboardClientError extends Error {
  constructor(message, code = "storyboard_request_failed") {
    super(message);
    this.name = "StoryboardClientError";
    this.code = code;
  }
}
export class RenderClientError extends Error {
  constructor(message, code = "render_dispatch_failed") {
    super(message);
    this.name = "RenderClientError";
    this.code = code;
  }
}
export class CommerceClientError extends Error {
  constructor(message, code = "commerce_request_failed") {
    super(message);
    this.name = "CommerceClientError";
    this.code = code;
  }
}

/** Resolve a fetch implementation or throw a typed error for the given ErrorCtor. */
function resolveFetch(fetchImpl, ErrorCtor) {
  const impl = typeof fetchImpl === "function" ? fetchImpl : globalThis.fetch;
  if (typeof impl !== "function") {
    throw new ErrorCtor("no fetch implementation available for the live client");
  }
  return impl;
}

/** POST JSON and return the parsed JSON body; throw the typed error on non-2xx. */
async function postJson(fetchImpl, url, { headers, body }, ErrorCtor) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(headers ?? {}) },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new ErrorCtor(`request failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  const status = typeof response?.status === "number" ? response.status : 0;
  if (status && (status < 200 || status >= 300)) {
    throw new ErrorCtor(`request returned HTTP ${status}`);
  }
  try {
    return await response.json();
  } catch {
    throw new ErrorCtor("response was not valid JSON");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Storyboard — BytePlus chat via Cloudflare AI Gateway (USABLE NOW; async seam)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a shot plan `{ shots: [{ prompt, sourceCardIds }] }` out of an
 * OpenAI-compatible chat completion. The model is prompted to answer with a
 * JSON object `{ shots: [...] }`; we read `choices[0].message.content` and parse
 * it. Tolerates content already being an object (some gateways return parsed).
 */
export function parseStoryboardCompletion(completion) {
  const choice = Array.isArray(completion?.choices) ? completion.choices[0] : null;
  const content = choice?.message?.content;
  let parsed = null;
  if (content && typeof content === "object") {
    parsed = content;
  } else if (typeof content === "string" && content.trim()) {
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = null;
    }
  }
  const shots = Array.isArray(parsed?.shots) ? parsed.shots : [];
  return shots.map((shot) => ({
    prompt: cleanString(shot?.prompt),
    sourceCardIds: Array.isArray(shot?.sourceCardIds)
      ? shot.sourceCardIds.map((id) => cleanString(id)).filter(Boolean)
      : [],
  }));
}

/**
 * Build a LIVE BytePlus storyboard chat client exposing the
 * `plan({ brief, sourceIds, shotCount }) -> { shots: [...] }` seam that
 * `runStoryboardHarness` awaits. Routes through the Cloudflare AI Gateway chat
 * endpoint. Throws `StoryboardClientError` on transport/HTTP/parse failure so
 * the harness emits its single-node fallback (R7.5).
 *
 * @param {object} [opts]
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {string} [opts.endpoint] AI Gateway chat completions URL (required for live use)
 * @param {string} [opts.model] BytePlus chat model id (default `skylark-chat`)
 * @param {string} [opts.apiKey] bearer token for the gateway/provider
 */
export function createByteplusStoryboardClient(opts = {}) {
  const fetchImpl = resolveFetch(opts.fetchImpl, StoryboardClientError);
  const endpoint = cleanString(opts.endpoint);
  const model = cleanString(opts.model) || DEFAULT_BYTEPLUS_CHAT_MODEL;
  return {
    isDeterministicMock: false,
    requiresAsyncHarness: false, // runStoryboardHarness already awaits plan()
    async plan({ brief, sourceIds, shotCount }) {
      if (!endpoint) {
        throw new StoryboardClientError("no AI Gateway chat endpoint configured", "storyboard_unconfigured");
      }
      const headers = {};
      if (cleanString(opts.apiKey)) headers.authorization = `Bearer ${opts.apiKey}`;
      const ids = Array.isArray(sourceIds) ? sourceIds : [];
      const instruction =
        `You are a video-remix storyboard planner. Produce exactly ${shotCount} shots as ` +
        `JSON {"shots":[{"prompt":string,"sourceCardIds":string[]}]}. Each shot's ` +
        `sourceCardIds MUST be drawn only from this evidence id set: ${JSON.stringify(ids)}. ` +
        `Brief: ${cleanString(brief)}`;
      const completion = await postJson(
        fetchImpl,
        endpoint,
        {
          headers,
          body: {
            model,
            messages: [
              { role: "system", content: "Respond ONLY with the requested JSON object." },
              { role: "user", content: instruction },
            ],
            response_format: { type: "json_object" },
          },
        },
        StoryboardClientError,
      );
      const shots = parseStoryboardCompletion(completion);
      if (shots.length === 0) {
        // No usable shots → fail closed so the harness emits its fallback (R7.5).
        throw new StoryboardClientError("model returned no usable shots", "storyboard_empty_plan");
      }
      return { shots };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Render — Strytree/BytePlus queue (SCAFFOLD: needs async render harness)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a LIVE Strytree/BytePlus render-queue client exposing the
 * `dispatch({ shot, runId }) -> { assetUrl, costCents, provider, objectKey,
 * bucket }` seam `runRenderHarness` expects. Dispatches one generation request
 * to the payment-worker render endpoint and maps the response.
 *
 * Consumable via the task 12.4a async render entry point `runRenderHarnessAsync`
 * (the synchronous `runRenderHarness` cannot await a network seam).
 * `requiresAsyncHarness: true` marks that. Throwing routes the harness to its
 * zero-spend mock fallback (R8.5/R8.6).
 *
 * @param {object} [opts]
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {string} [opts.endpoint] render-queue dispatch URL
 * @param {string} [opts.apiKey] bearer token for the payment worker
 * @param {string} [opts.provider] provider identity recorded on the ledger event
 */
export function createStrytreeRenderQueueClient(opts = {}) {
  const fetchImpl = resolveFetch(opts.fetchImpl, RenderClientError);
  const endpoint = cleanString(opts.endpoint);
  const provider = cleanString(opts.provider) || "byteplus-video";
  return {
    isDeterministicMock: false,
    requiresAsyncHarness: true,
    provider,
    async dispatch({ shot, runId }) {
      if (!endpoint) {
        throw new RenderClientError("no render-queue endpoint configured", "render_unconfigured");
      }
      const headers = {};
      if (cleanString(opts.apiKey)) headers.authorization = `Bearer ${opts.apiKey}`;
      const body = await postJson(
        fetchImpl,
        endpoint,
        {
          headers,
          body: {
            runId: cleanString(runId),
            shotId: cleanString(shot?.shotId),
            prompt: cleanString(shot?.prompt),
          },
        },
        RenderClientError,
      );
      const assetUrl = cleanString(body?.assetUrl);
      if (!assetUrl) {
        // No asset → treated by the harness as a no-asset failure (R8.6).
        throw new RenderClientError("render dispatch returned no assetUrl", "render_no_asset");
      }
      return {
        assetUrl,
        costCents: Number.isFinite(body?.costCents) ? Math.max(0, Math.round(body.costCents)) : 0,
        provider: cleanString(body?.provider) || provider,
        objectKey: cleanString(body?.objectKey) || null,
        bucket: cleanString(body?.bucket) || null,
      };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Commerce — Stripe via the payment worker (SCAFFOLD: needs async commerce harness)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build LIVE commerce clients — `{ stripeClient, payoutClient, publishClient }`
 * — matching the seams `runCheckout`/`runPublish` expect:
 *   stripeClient.createCheckoutSession({...}) -> { session: { id, amountTotal, currency }, body }
 *   payoutClient.settle({...})                -> { settled, payoutState }
 *   publishClient.publish({ asset, runId })   -> { publishedUrl }
 *
 * Consumable via the task 12.4a async commerce entry points `runCheckoutAsync`
 * / `runPublishAsync` (the synchronous `runCheckout`/`runPublish` cannot await a
 * network seam). `requiresAsyncHarness: true` marks that. Throwing routes the
 * harness to its gate-rejection / R9.4 failure path.
 *
 * @param {object} [opts]
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {string} [opts.endpoint] payment-worker base URL
 * @param {string} [opts.apiKey] bearer token for the payment worker
 */
export function createStripeCommerceClients(opts = {}) {
  const fetchImpl = resolveFetch(opts.fetchImpl, CommerceClientError);
  const base = cleanString(opts.endpoint).replace(/\/+$/, "");
  const authHeaders = () => {
    const h = {};
    if (cleanString(opts.apiKey)) h.authorization = `Bearer ${opts.apiKey}`;
    return h;
  };
  const requireBase = () => {
    if (!base) throw new CommerceClientError("no payment-worker endpoint configured", "commerce_unconfigured");
    return base;
  };

  return {
    requiresAsyncHarness: true,
    stripeClient: {
      isDeterministicMock: false,
      async createCheckoutSession({ runId, assetUrl, priceId, amountTotal, currency }) {
        const body = await postJson(
          fetchImpl,
          `${requireBase()}/checkout/session`,
          {
            headers: authHeaders(),
            body: {
              runId: cleanString(runId),
              assetUrl: cleanString(assetUrl),
              priceId: cleanString(priceId) || undefined,
              amountTotal,
              currency,
            },
          },
          CommerceClientError,
        );
        const id = cleanString(body?.id || body?.sessionId);
        if (!id) {
          throw new CommerceClientError("checkout session create returned no id", "commerce_no_session");
        }
        return {
          session: {
            id,
            amountTotal: Number.isFinite(body?.amount_total ?? body?.amountTotal)
              ? (body.amount_total ?? body.amountTotal)
              : amountTotal,
            currency: cleanString(body?.currency || currency) || "usd",
          },
          body,
        };
      },
    },
    payoutClient: {
      isDeterministicMock: false,
      async settle({ sessionId, runId, amountTotal, currency }) {
        const body = await postJson(
          fetchImpl,
          `${requireBase()}/payout/settle`,
          {
            headers: authHeaders(),
            body: { sessionId: cleanString(sessionId), runId: cleanString(runId), amountTotal, currency },
          },
          CommerceClientError,
        );
        return {
          settled: Boolean(body?.settled),
          payoutState: cleanString(body?.payoutState) || "settled",
          confirmation: body?.confirmation ?? null,
        };
      },
    },
    publishClient: {
      isDeterministicMock: false,
      async publish({ asset, runId }) {
        const body = await postJson(
          fetchImpl,
          `${requireBase()}/publish`,
          {
            headers: authHeaders(),
            body: { runId: cleanString(runId), assetUrl: cleanString(asset?.assetUrl), shotId: cleanString(asset?.shotId) },
          },
          CommerceClientError,
        );
        const publishedUrl = cleanString(body?.publishedUrl) || cleanString(asset?.assetUrl);
        return { publishedUrl };
      },
    },
  };
}
