// Shared non-disclosing (safe) error response builder for the AWS Agent-API
// tier.
//
// Spec: knowgrph-acos-mcp-connector, task 5.10 (R15.3, R15.6; design Agent_Api
// secret handling + auth non-disclosure; Correctness Property 31).
//
// PURPOSE: every Agent_Api endpoint (`POST /run`, `GET /runs/{id}`,
// `GET /health`, `POST /auth/session`) must produce NON-DISCLOSING error
// responses. An UNEXPECTED thrown error (a bug, a downstream throw, a runtime
// fault) must never surface a raw stack trace, an internal file path, an
// environment value, or any secret/token/credential material to the caller. It
// must instead collapse to a stable, generic HTTP 500 with a fixed code and a
// safe message.
//
// WHY A SHARED BUILDER: routing every handler's catch-all through this single
// helper guarantees the four endpoints can never drift in what they disclose on
// an unexpected fault. The shape is fixed:
//   { error: "internal_error", message: <fixed, reason-agnostic> }
// The original Error — including its `message`, `stack`, and any attached
// fields — is NEVER copied into the response body. The original error is
// returned alongside the response so the caller (the handler) can log it
// SERVER-SIDE only; logging is the handler's responsibility and is never
// reflected in the HTTP body.
//
// NON-DISCLOSURE (R15.3, R15.6): the body carries no stack trace, no internal
// path, no `process.env` / config value, and no secret/token/credential
// content even when the thrown Error's own message embeds such text. The
// message is a constant; nothing from the thrown error reaches the wire.

/** Stable error code for every unexpected-fault 500 across all endpoints. */
export const INTERNAL_ERROR_CODE = "internal_error";

/**
 * Stable, reason-agnostic message. Deliberately reveals nothing about the
 * underlying fault, the failing component, or any internal detail.
 */
export const INTERNAL_ERROR_MESSAGE = "an unexpected error occurred";

const JSON_HEADERS = Object.freeze({
  "content-type": "application/json",
  "cache-control": "no-store",
});

/**
 * Build the canonical non-disclosing 500 BODY object. The shape is FIXED and
 * carries nothing derived from the thrown error:
 *   { error: "internal_error", message: <fixed reason-agnostic> }
 *
 * Exported so handlers/tests can assert on the body shape without re-parsing.
 *
 * @returns {{ error: string, message: string }}
 */
export function buildSafeErrorBody() {
  return { error: INTERNAL_ERROR_CODE, message: INTERNAL_ERROR_MESSAGE };
}

/**
 * Build the canonical non-disclosing HTTP 500 API-Gateway proxy RESPONSE for an
 * unexpected thrown error. The thrown error (if any) is accepted ONLY so the
 * caller can decide to log it server-side; NOTHING from it is placed in the
 * response body. By construction the body never contains a stack trace,
 * internal path, env/config value, or secret/token/credential content.
 *
 * @param {object} [args]
 * @param {unknown} [args.error] the original thrown error (ignored for the body;
 *   never serialized). Present so callers may log it server-side.
 * @returns {{ statusCode: 500, headers: object, body: string }}
 */
export function buildSafeErrorResponse({ error } = {}) {
  // `error` is intentionally NOT read into the body. Referencing the parameter
  // documents intent without leaking it onto the wire.
  void error;
  return {
    statusCode: 500,
    headers: { ...JSON_HEADERS },
    body: JSON.stringify(buildSafeErrorBody()),
  };
}

/**
 * Wrap a handler so any error it throws (or any rejected promise it returns)
 * collapses to the canonical non-disclosing 500. Handlers keep their existing
 * tagged 4xx/404/405/503/501 responses (those are already non-disclosing and
 * are returned, not thrown); only an UNEXPECTED throw is caught here and routed
 * through {@link buildSafeErrorResponse}.
 *
 * The optional `onError` seam lets a deployment record the original error
 * SERVER-SIDE (e.g. structured logs / metrics) without it ever reaching the
 * response body. Any failure inside `onError` is swallowed so logging can never
 * itself leak or break the safe response.
 *
 * @template {(...args: any[]) => any} H
 * @param {H} handler the inner handler `(event) => response | Promise<response>`
 * @param {object} [deps]
 * @param {(error: unknown) => void} [deps.onError] server-side-only error sink
 * @returns {(...args: Parameters<H>) => Promise<{ statusCode: number, headers: object, body: string }>}
 */
export function withSafeErrors(handler, deps = {}) {
  const onError = typeof deps.onError === "function" ? deps.onError : null;
  return async function safeHandler(...args) {
    try {
      return await handler(...args);
    } catch (error) {
      if (onError) {
        try {
          onError(error);
        } catch {
          // Logging must never break or leak into the safe response.
        }
      }
      return buildSafeErrorResponse({ error });
    }
  };
}

/**
 * Synchronous counterpart to {@link withSafeErrors} for a SYNCHRONOUS handler
 * (e.g. `GET /health`, which returns its response directly rather than as a
 * promise). Preserves the handler's synchronous return type — it does not wrap
 * the result in a promise — so callers/tests that read `handler(event).body`
 * directly keep working. Any thrown error collapses to the canonical
 * non-disclosing 500 (task 5.10 / R15.3, R15.6).
 *
 * @template {(...args: any[]) => any} H
 * @param {H} handler the inner synchronous handler `(event) => response`
 * @param {object} [deps]
 * @param {(error: unknown) => void} [deps.onError] server-side-only error sink
 * @returns {(...args: Parameters<H>) => { statusCode: number, headers: object, body: string }}
 */
export function withSafeErrorsSync(handler, deps = {}) {
  const onError = typeof deps.onError === "function" ? deps.onError : null;
  return function safeHandlerSync(...args) {
    try {
      return handler(...args);
    } catch (error) {
      if (onError) {
        try {
          onError(error);
        } catch {
          // Logging must never break or leak into the safe response.
        }
      }
      return buildSafeErrorResponse({ error });
    }
  };
}
