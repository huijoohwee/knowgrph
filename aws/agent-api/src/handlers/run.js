// `POST /run` Lambda handler for the AWS Agent-API tier.
//
// Spec: knowgrph-acos-mcp-connector, task 5.2 (R12.1; design Agent_Api
// `POST /run`; Correctness Property 6).
//
// SCOPE OF THIS TASK (5.2): wire the pure `validateRunRequest` schema validator
// (R12.1) into the request pipeline and expose the validation decision as the
// integration point downstream tasks build on:
//   - task 5.3 forwards a `knowgrph.video_remix.run` MCP call when the schema
//     passes (the `onValidRequest` forwarding seam below), and
//   - task 5.4 shapes the HTTP 4xx response that names each invalid field.
//
// The handler is a PURE, API-Gateway-style `(event) => response` function with
// an injectable forwarding seam so it is unit-testable with ZERO live network
// calls. Auth_Token verification (task 6.x) sits in front of this handler and
// is out of scope here.

import { validateRunRequest } from "../lib/run-request-schema.js";
import { createMcpForwarder, createFetchMcpTransport } from "../lib/mcp-forwarder.js";
import { createConcurrencyLimiter } from "../lib/concurrency-limiter.js";
import { withSafeErrors } from "../lib/safe-error-response.js";
import { withAuth } from "../lib/auth-verify.js";
import { createEnvSecretProvider } from "../lib/auth-token.js";

const JSON_HEADERS = Object.freeze({
  "content-type": "application/json",
  "cache-control": "no-store",
});

/** Build a JSON API-Gateway proxy response. */
function jsonResponse(statusCode, payload, extraHeaders) {
  return {
    statusCode,
    headers: { ...JSON_HEADERS, ...(extraHeaders ?? {}) },
    body: JSON.stringify(payload),
  };
}

/**
 * Parse the request body from an API-Gateway proxy event. Returns `null` for an
 * absent body (so the schema validator reports it as a non-object) and throws a
 * tagged error for malformed JSON.
 */
function parseBody(event) {
  const raw = event && event.body;
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw === "object") return raw; // already-parsed (e.g. direct invoke)
  let text = raw;
  if (event.isBase64Encoded) {
    text = Buffer.from(raw, "base64").toString("utf8");
  }
  try {
    return JSON.parse(text);
  } catch {
    const err = new Error("request body is not valid JSON");
    err.code = "invalid_json";
    throw err;
  }
}

/** Extract the HTTP method across REST (v1) and HTTP (v2) API event shapes. */
function methodOf(event) {
  return event?.httpMethod || event?.requestContext?.http?.method || null;
}

/**
 * Default forwarding seam (task 5.3). A schema-passing request is forwarded to
 * the McpAgent over MCP Streamable HTTP via `createMcpForwarder`. The default
 * forwarder uses the not-implemented transport seam (live `fetch` wiring is task
 * 9.2), so an un-wired deployment surfaces a clearly-tagged not-implemented
 * signal (HTTP 501) rather than silently succeeding or making a live call. A
 * deployment (or test) injects a real/fake transport via `onValidRequest`.
 */
const defaultOnValidRequest = createMcpForwarder();

/**
 * Create the `POST /run` handler with injectable seams.
 *
 * @param {object} [deps]
 * @param {(args: { body: object }) => Promise<object> | object} [deps.onValidRequest]
 *   forwarding seam invoked only when the schema passes (task 5.3)
 * @param {{ tryAcquire: Function }} [deps.limiter]
 *   in-flight concurrency limiter (task 5.5 / R12.4). A schema-passing request
 *   acquires a slot BEFORE forwarding; at/over the configured max concurrency
 *   the handler returns HTTP 503 + `retry-after` (1..120s) WITHOUT forwarding.
 *   The slot is released when the forward settles (success or failure) so
 *   capacity is reclaimed. Defaults to a fresh limiter with safe defaults.
 * @param {(error: unknown) => void} [deps.onError] server-side-only error sink
 *   for the non-disclosing 500 catch-all (task 5.10 / R15.3). The original error
 *   is logged here only; it NEVER reaches the response body.
 * @returns {(event: object) => Promise<{ statusCode: number, headers: object, body: string }>}
 */
export function createRunHandler(deps = {}) {
  const onValidRequest = deps.onValidRequest ?? defaultOnValidRequest;
  const limiter = deps.limiter ?? createConcurrencyLimiter();

  // task 5.10 / R15.3, R15.6: any UNEXPECTED throw (a non-tagged error from the
  // forwarding seam re-thrown below, or any runtime fault) collapses to a
  // stable, non-disclosing HTTP 500 — never a raw stack/config/credential body.
  // The existing tagged 4xx/405/501/503 responses are RETURNED (not thrown), so
  // they pass through this wrapper unchanged.
  return withSafeErrors(async function runHandler(event = {}) {
    const method = methodOf(event);
    if (method && method.toUpperCase() !== "POST") {
      return jsonResponse(405, {
        error: "method_not_allowed",
        message: "POST /run only supports the POST method",
      });
    }

    let body;
    try {
      body = parseBody(event);
    } catch (err) {
      if (err.code === "invalid_json") {
        return jsonResponse(400, {
          error: "invalid_request",
          message: err.message,
        });
      }
      throw err;
    }

    // R12.1 / Property 6: validate the request schema before any forwarding.
    const { valid, errors } = validateRunRequest(body);
    if (!valid) {
      // Integration point for task 5.4: a 4xx that names each invalid field and
      // reason; critically, NO MCP call is forwarded (R12.3).
      return jsonResponse(400, {
        error: "schema_validation_failed",
        message: "the POST /run request failed schema validation",
        fields: errors,
      });
    }

    // Schema passed → admit against the in-flight concurrency limit (R12.4).
    // At/over the configured max concurrency the backend is saturated: return
    // 503 + retry-after (1..120s) and do NOT forward.
    const slot = limiter.tryAcquire();
    if (!slot.admitted) {
      return jsonResponse(
        503,
        {
          error: "service_unavailable",
          message: "the Agent-API is saturated; retry after the indicated delay",
          retryAfter: slot.retryAfterSeconds,
        },
        { "retry-after": String(slot.retryAfterSeconds) },
      );
    }

    // Admitted → hand off to the forwarding seam (task 5.3). The slot is
    // released whether the forward succeeds or fails so capacity is reclaimed.
    try {
      const result = await onValidRequest({ body });
      return jsonResponse(202, result ?? { accepted: true });
    } catch (err) {
      if (err.code === "not_implemented") {
        return jsonResponse(501, {
          error: "not_implemented",
          message: err.message,
        });
      }
      throw err;
    } finally {
      slot.release();
    }
  }, { onError: deps.onError });
}

/**
 * Convenience factory: a `POST /run` handler with the MCP forwarder wired as its
 * `onValidRequest` seam. Task 9.2 injects a live transport here for a drop-in
 * swap (e.g. `createForwardingRunHandler({ transport: realFetchTransport })`);
 * tests inject a fake transport to keep forwarding network-free.
 *
 * @param {object} [forwarderDeps] passed straight to `createMcpForwarder`
 *   (`transport`, `endpoint`, `forwardElapsedMs`, `sessionId`, `requestId`).
 *   The optional `limiter` is consumed here (task 5.5 / R12.4) and NOT passed to
 *   the forwarder; provide a `maxConcurrency` / `retryAfterSeconds` limiter to
 *   tune saturation handling.
 */
export function createForwardingRunHandler(forwarderDeps = {}) {
  const { limiter, ...transportDeps } = forwarderDeps;
  return createRunHandler({
    onValidRequest: createMcpForwarder(transportDeps),
    limiter,
  });
}

/**
 * Compose Auth_Token verification IN FRONT of a `POST /run` handler (task 6.1 /
 * R15.1, R15.3; Property 28). A missing/malformed/invalid-signature/expired
 * Auth_Token returns HTTP 401 and the inner handler is NEVER invoked, so NO MCP
 * call is forwarded and no Run_Manifest data is disclosed; a valid token passes
 * through with the verified claims under `event.auth`. This is pure
 * composition — it duplicates none of the run handler's logic.
 *
 * @param {object} [deps]
 * @param {{ getSecret: () => Promise<string>|string }} [deps.secretProvider]
 *   server-side HS256 secret provider (defaults to the Lambda-env provider;
 *   tests inject a static provider and sign tokens with the same secret).
 * @param {() => number} [deps.clock] ms-since-epoch clock seam for deterministic
 *   expiry handling in tests.
 * @param {unknown} [deps.expiryWindowSeconds] configured issuance-age expiry
 *   window (R15.8 / task 6.3); clamped to [300, 86400], default 3600 when unset.
 * @param {object} [deps.run] options forwarded to {@link createRunHandler}
 *   (`onValidRequest`, `limiter`, `onError`).
 * @param {(info: { reason: string }) => void} [deps.onAuthFailure]
 * @returns {(event: object) => Promise<{ statusCode: number, headers: object, body: string }>}
 */
export function createAuthedRunHandler(deps = {}) {
  const secretProvider = deps.secretProvider ?? createEnvSecretProvider();
  return withAuth(createRunHandler(deps.run ?? {}), {
    secretProvider,
    clock: deps.clock,
    expiryWindowSeconds: deps.expiryWindowSeconds,
    onAuthFailure: deps.onAuthFailure,
    onError: deps.onError,
  });
}

/**
 * Resolve the default `POST /run` handler from the environment (export-swap
 * for runtime-readiness step). The product tier must fail CLOSED locally and in
 * any un-configured deploy — never make an accidental live `fetch` — so the
 * branch is gated on an explicit endpoint/flag:
 *
 *   - When `MCP_ENDPOINT` is set (or `AGENT_API_LIVE_FORWARDING` is "1"/"true"),
 *     return the LIVE forwarding handler (real `fetch`, real 2,000 ms deadline).
 *   - Otherwise return the auth-gated handler whose forwarder is the inert
 *     not-implemented seam, so a valid request fails closed with HTTP 501.
 *
 * `env` / `fetchImpl` / `clock` stay injectable so the gating is unit-testable
 * with ZERO live calls.
 *
 * @param {object} [deps]
 * @param {Record<string,string|undefined>} [deps.env] environment (default `process.env`)
 * @param {typeof fetch} [deps.fetchImpl] fetch implementation (default global `fetch`)
 * @param {() => number} [deps.clock] ms clock for real elapsed measurement
 * @param {object} [deps.secretProvider] HS256 secret provider (default Lambda env)
 * @param {unknown} [deps.expiryWindowSeconds] Auth_Token expiry window (R15.8)
 * @param {{ tryAcquire: Function }} [deps.limiter] concurrency limiter (R12.4)
 * @param {(error: unknown) => void} [deps.onError] server-side-only error sink
 * @returns {(event: object) => Promise<{ statusCode: number, headers: object, body: string }>}
 */
export function createDefaultRunHandler(deps = {}) {
  const env = deps.env ?? (typeof process !== "undefined" ? process.env : {}) ?? {};
  const liveFlag = String(env.AGENT_API_LIVE_FORWARDING ?? "").toLowerCase();
  const liveForwarding =
    (typeof env.MCP_ENDPOINT === "string" && env.MCP_ENDPOINT.length > 0) ||
    liveFlag === "1" ||
    liveFlag === "true";

  if (liveForwarding) {
    return createLiveForwardingRunHandler({
      endpoint: env.MCP_ENDPOINT,
      fetchImpl: deps.fetchImpl,
      clock: deps.clock,
      secretProvider: deps.secretProvider,
      expiryWindowSeconds: deps.expiryWindowSeconds,
      limiter: deps.limiter,
      onError: deps.onError,
    });
  }
  // Fail-closed default: auth in front, inert not-implemented forwarder (501).
  return createAuthedRunHandler({
    secretProvider: deps.secretProvider,
    expiryWindowSeconds: deps.expiryWindowSeconds,
    clock: deps.clock,
    onError: deps.onError,
    run: { limiter: deps.limiter, onError: deps.onError },
  });
}

/**
 * Default Lambda export — Auth_Token-gated (task 6.1) and ENV-GATED for live
 * MCP forwarding (runtime-readiness step / task 12.1). With `MCP_ENDPOINT` set
 * in the deployed Lambda environment this forwards live to the control plane;
 * unset (local/test/un-configured deploy) it fails closed with HTTP 501 rather
 * than making an accidental live call.
 */
export const handler = createDefaultRunHandler();

/**
 * RUNTIME-READY live wiring (runtime-readiness path, step 3). Composes:
 *   Auth_Token verification  →  schema validation  →  concurrency admission  →
 *   a LIVE MCP Streamable HTTP forward (real `fetch`) to the deployed
 *   control-plane endpoint, with the REAL 2,000 ms forwarding deadline measured
 *   (R12.2). This replaces the inert not-implemented default for deployed use.
 *
 * The MCP endpoint is read from `MCP_ENDPOINT` (default airvio.co/knowgrph/mcp).
 * `fetchImpl` / `clock` stay injectable so the live handler is still unit
 * testable with a fake fetch and a deterministic clock (zero live calls).
 *
 * @param {object} [deps]
 * @param {string} [deps.endpoint] MCP endpoint (default `process.env.MCP_ENDPOINT` or airvio.co/knowgrph/mcp)
 * @param {typeof fetch} [deps.fetchImpl] fetch implementation (default global `fetch`)
 * @param {() => number} [deps.clock] ms clock for real elapsed measurement
 * @param {object} [deps.secretProvider] HS256 secret provider (default Lambda env)
 * @param {unknown} [deps.expiryWindowSeconds] Auth_Token expiry window (R15.8)
 * @param {{ tryAcquire: Function }} [deps.limiter] concurrency limiter (R12.4)
 * @param {(error: unknown) => void} [deps.onError] server-side-only error sink
 */
export function createLiveForwardingRunHandler(deps = {}) {
  const endpoint =
    deps.endpoint ||
    (typeof process !== "undefined" && process.env && process.env.MCP_ENDPOINT) ||
    undefined;
  const transport = createFetchMcpTransport({ fetchImpl: deps.fetchImpl });
  const onValidRequest = createMcpForwarder({
    transport,
    endpoint,
    measureElapsed: true, // enforce the REAL 2,000 ms deadline against live latency
    clock: deps.clock,
  });
  return createAuthedRunHandler({
    secretProvider: deps.secretProvider,
    expiryWindowSeconds: deps.expiryWindowSeconds,
    clock: deps.clock,
    onError: deps.onError,
    run: { onValidRequest, limiter: deps.limiter, onError: deps.onError },
  });
}
