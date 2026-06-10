// `GET /health` Lambda handler for the AWS Agent-API tier.
//
// Spec: knowgrph-acos-mcp-connector, task 5.8 (R3.4, R15.6; design Agent_Api
// `GET /health`; Correctness Property 31).
//
// SCOPE (5.8): an OPEN liveness probe — no Auth_Token required, no auth
// middleware in front of it (R15.6). It returns HTTP 200 within a structural
// 5,000 ms deadline when healthy (R3.4) and restricts the body to LIVENESS
// status only, disclosing NO Run_Manifest data, NO credentials, and NO internal
// configuration (no env, no secret, no endpoint internals) — Property 31.
//
// The handler is a PURE, API-Gateway-style `(event) => response` function,
// mirroring `src/handlers/run.js` and `src/handlers/runs.js`. The 5,000 ms
// deadline is recorded as STRUCTURAL METADATA (no real timer): an injectable
// `checkElapsedMs` signal models a slow liveness check, mirroring the
// run/manifest/forwarder deadline pattern. Local runtime/tests make ZERO live
// network/AWS calls.
//
// NON-DISCLOSURE (R15.6, Property 31): the body is a fixed, minimal liveness
// shape. It mirrors the worker health-body shape where sensible
// (`{ status: "ok", transport, ... }`) but is constrained to non-sensitive,
// liveness-only fields. No code path here reads `process.env`, secrets, run
// manifests, or internal endpoint configuration, so none can leak into the
// response.

import { withSafeErrorsSync } from "../lib/safe-error-response.js";
import { buildCorsHeaders } from "../lib/cors.js";

/** The structural liveness deadline for `GET /health` (R3.4). */
export const HEALTH_DEADLINE_MS = 5000;

/** Transport advertised by the liveness probe (non-sensitive, fixed). */
export const HEALTH_TRANSPORT = "streamable-http";

const JSON_HEADERS = Object.freeze({
  "content-type": "application/json",
  "cache-control": "no-store",
  ...buildCorsHeaders(),
});

/** Build a JSON API-Gateway proxy response. */
function jsonResponse(statusCode, payload, extraHeaders) {
  return {
    statusCode,
    headers: { ...JSON_HEADERS, ...(extraHeaders ?? {}) },
    body: JSON.stringify(payload),
  };
}

/** Extract the HTTP method across REST (v1) and HTTP (v2) API event shapes. */
function methodOf(event) {
  return event?.httpMethod || event?.requestContext?.http?.method || null;
}

/** Resolve the (timer-free) check-elapsed signal for the 5,000 ms deadline. */
function resolveCheckElapsedMs(value) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Create the `GET /health` handler with injectable seams.
 *
 * The probe is OPEN by construction: no Auth_Token is read, parsed, or required
 * (R15.6), so a request that carries no token still returns HTTP 200. The
 * response body is constrained to liveness status only — it never references a
 * Run_Manifest, credential, or internal config value (Property 31).
 *
 * @param {object} [deps]
 * @param {number} [deps.checkElapsedMs] injected elapsed signal modelling a slow
 *   liveness check for the 5,000 ms deadline assertion (default 0 —
 *   synchronous). A value at/under {@link HEALTH_DEADLINE_MS} is healthy; a
 *   value over it is flagged past-deadline.
 * @returns {(event: object) => { statusCode: number, headers: object, body: string }}
 */
export function createHealthHandler(deps = {}) {
  return withSafeErrorsSync(function healthHandler(event = {}) {
    const method = methodOf(event);
    if (method && method.toUpperCase() !== "GET") {
      return jsonResponse(405, {
        error: "method_not_allowed",
        message: "GET /health only supports the GET method",
      });
    }

    // Structural 5,000 ms liveness deadline (R3.4). Timer-free: the elapsed
    // signal is injected so the local runtime/tests stay deterministic and make
    // ZERO live calls. Healthy iff the check resolved within the deadline.
    const checkElapsedMs = resolveCheckElapsedMs(deps.checkElapsedMs);
    const withinDeadline = checkElapsedMs <= HEALTH_DEADLINE_MS;

    // LIVENESS-ONLY body (Property 31 / R15.6). No Run_Manifest data, no
    // credentials, no internal config — only fixed liveness fields. Mirrors the
    // worker health-body shape (`{ status, transport, ... }`) where sensible.
    return jsonResponse(200, {
      status: withinDeadline ? "ok" : "degraded",
      transport: HEALTH_TRANSPORT,
      checkElapsedMs,
      checkWithinDeadline: withinDeadline,
      checkDeadlineMs: HEALTH_DEADLINE_MS,
    });
  }, { onError: deps.onError });
}

/** Default Lambda export. The probe is open and requires no wiring. */
export const handler = createHealthHandler();
