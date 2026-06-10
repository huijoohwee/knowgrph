// Canonical "run not found" 404 response builder for `GET /runs/{id}` on the
// AWS Agent-API tier.
//
// Spec: knowgrph-acos-mcp-connector, task 5.7 (R12.6; design Agent_Api
// `GET /runs/{id}`; Open Decisions -> Resolved Decision 0.2).
//
// WHY A SHARED CANONICAL BUILDER (resolves Decision 0.2 — no existence leak):
// the Agent_Api must return HTTP 404 for BOTH an unknown run id (task 5.7) and
// an authenticated-but-UNENTITLED run (task 6.4). If those two paths built their
// own 404s they could drift, and any difference (status, body shape, an extra
// field, even key ordering) would let a caller distinguish "this run does not
// exist" from "this run exists but is not yours" — leaking run existence across
// sessions/tenants (R15.4, R15.5). Routing both paths through this single
// builder makes the two responses BYTE-IDENTICAL for the same requested id, so
// they are indistinguishable by construction.
//
// NON-DISCLOSURE (R15.3, R15.6): the body is a fixed, minimal shape. It carries
// no stack trace, no internal config/stack/credential content, and no signal
// of whether the run exists or of the reason the read was denied. The
// denied-access audit that task 6.4 records is a SERVER-SIDE side effect — it
// is never reflected in this response body.

/** Stable error code returned for every not-found / unentitled `GET /runs/{id}`. */
export const RUN_NOT_FOUND_ERROR = "run_not_found";

/**
 * Stable, reason-agnostic message. Deliberately does NOT say whether the run is
 * unknown or merely unentitled — both read identically (Decision 0.2).
 */
export const RUN_NOT_FOUND_MESSAGE = "no run was found for the requested id";

const JSON_HEADERS = Object.freeze({
  "content-type": "application/json",
  "cache-control": "no-store",
});

/** Normalize a run id into a non-empty trimmed string, or `null`. */
function normalizeRunId(runId) {
  const id = String(runId ?? "").trim();
  return id || null;
}

/**
 * Build the canonical Run_Manifest-free 404 BODY object. Exported so callers
 * (and tests) can compare the two paths' bodies for shape identity without
 * re-parsing JSON. The shape is fixed:
 *   { error: "run_not_found", message: <reason-agnostic>, runId?: <id> }
 * The optional `runId` echoes only the CALLER-SUPPLIED id (never a disclosure of
 * existence) and is identical across the unknown and unentitled paths, so it
 * cannot be used to distinguish them.
 *
 * @param {object} [args]
 * @param {string} [args.runId] the caller-requested run id (echoed when present)
 * @returns {{ error: string, message: string, runId?: string }}
 */
export function buildRunNotFoundBody({ runId } = {}) {
  const body = { error: RUN_NOT_FOUND_ERROR, message: RUN_NOT_FOUND_MESSAGE };
  const id = normalizeRunId(runId);
  if (id) body.runId = id;
  return body;
}

/**
 * Build the canonical HTTP 404 API-Gateway proxy RESPONSE for a `GET /runs/{id}`
 * that resolves to no readable run — used by BOTH the unknown-run seam
 * (task 5.7) and the entitlement seam (task 6.4) so they can never drift and a
 * caller cannot tell unknown from unentitled (Decision 0.2; R12.6, R15.4,
 * R15.5).
 *
 * @param {object} [args]
 * @param {string} [args.runId] the caller-requested run id (echoed when present)
 * @returns {{ statusCode: 404, headers: object, body: string }}
 */
export function buildRunNotFoundResponse({ runId } = {}) {
  return {
    statusCode: 404,
    headers: { ...JSON_HEADERS },
    body: JSON.stringify(buildRunNotFoundBody({ runId })),
  };
}
