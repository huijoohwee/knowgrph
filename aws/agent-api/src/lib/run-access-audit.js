// Denied-access audit seam for `GET /runs/{id}` on the AWS Agent-API tier.
//
// Spec: knowgrph-acos-mcp-connector, task 6.4 (R15.4, R15.5, R12.6; design
// Agent_Api `GET /runs/{id}` entitlement; Correctness Property 29; Open
// Decisions -> Resolved Decision 0.2).
//
// WHY A SERVER-SIDE-ONLY SEAM:
// when a `GET /runs/{id}` resolves to a run the established Caller_Identity may
// NOT read — either because the run is UNKNOWN or because it EXISTS but is not
// in the caller's `entitledRunIds` — the Agent_Api must (a) return the canonical
// HTTP 404 (built by `run-not-found-response.js`, byte-identical across both
// cases so run existence never leaks, Decision 0.2) AND (b) RECORD the denied
// access attempt for server-side observability/forensics (Property 29).
//
// The record is a SERVER-SIDE side effect ONLY. It is NEVER reflected in the
// response body (which stays the reason-agnostic canonical 404), so the audit
// can carry the true reason (`unknown_run` vs `unentitled`) for operators
// without that reason ever crossing the tenant boundary to the caller.
//
// This module is PURE plumbing over an injectable sink so the local runtime and
// tests make ZERO live network/AWS calls — a test injects an in-memory spy; a
// later integration task swaps in a real audit sink (CloudWatch / structured
// log / DynamoDB) behind the same `record(entry)` seam without touching the
// handler.

/** Reason recorded when the requested run id is unknown to the store. */
export const DENIED_REASON_UNKNOWN_RUN = "unknown_run";

/**
 * Reason recorded when the run EXISTS but the established Caller_Identity is not
 * entitled to read it (cross-tenant denial, R15.5).
 */
export const DENIED_REASON_UNENTITLED = "unentitled";

/** The full set of denied-access reasons this seam records (server-side only). */
export const DENIED_ACCESS_REASONS = Object.freeze([
  DENIED_REASON_UNKNOWN_RUN,
  DENIED_REASON_UNENTITLED,
]);

/**
 * Normalize a denied-access record to the fixed, minimal shape
 * `{ runId, principalId, reason }` so every sink sees a consistent entry. The
 * `runId` and `principalId` are coerced to a string or `null`; the `reason` is
 * passed through (callers use the exported constants).
 *
 * @param {object} [entry]
 * @param {string} [entry.runId]      the caller-requested run id
 * @param {string} [entry.principalId] the established Caller_Identity principal
 * @param {string} [entry.reason]     one of {@link DENIED_ACCESS_REASONS}
 * @returns {{ runId: string|null, principalId: string|null, reason: string|null }}
 */
export function buildDeniedAccessRecord({ runId, principalId, reason } = {}) {
  const normalizeStr = (value) => {
    const s = typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
    return s.length > 0 ? s : null;
  };
  return {
    runId: normalizeStr(runId),
    principalId: normalizeStr(principalId),
    reason: reason ?? null,
  };
}

/**
 * Default no-op audit sink. Used when no sink is injected so the handler always
 * has a callable seam; a real deployment injects a sink that persists/emits the
 * entry. The returned object exposes `record(entry)` and is frozen.
 *
 * @returns {{ record: (entry: object) => void }}
 */
export function createNoopAccessAuditSink() {
  return Object.freeze({
    record() {
      // Intentionally does nothing — server-side audit wiring is injected.
    },
  });
}

/**
 * In-memory denied-access audit sink for local runtime and tests. Captures each
 * recorded entry (normalized) so a test can assert that a denied read was
 * recorded with the expected `{ runId, principalId, reason }` WITHOUT any live
 * network/AWS call. The captured entries are NEVER surfaced in any response.
 *
 * @returns {{ record: (entry: object) => void, entries: Array<object> }}
 */
export function createInMemoryAccessAuditSink() {
  const entries = [];
  return {
    entries,
    record(entry) {
      entries.push(buildDeniedAccessRecord(entry));
    },
  };
}

/**
 * Resolve a caller-supplied audit seam into a uniform `record(entry)` callback.
 * Accepts either a function (`recordDeniedAccess(entry)` / `onAccessDenied`) or
 * a sink object exposing `record(entry)`. When nothing is provided, a no-op
 * sink is used. The returned callback NEVER throws into the request path: a
 * faulting sink is swallowed so audit logging can never break or leak into the
 * canonical 404 response.
 *
 * @param {((entry: object) => void) | { record: (entry: object) => void } | undefined} seam
 * @returns {(entry: object) => void}
 */
export function resolveAccessAuditRecorder(seam) {
  let record;
  if (typeof seam === "function") {
    record = seam;
  } else if (seam && typeof seam.record === "function") {
    record = (entry) => seam.record(entry);
  } else {
    record = createNoopAccessAuditSink().record;
  }
  return function recordDeniedAccess(entry) {
    try {
      record(buildDeniedAccessRecord(entry));
    } catch {
      // A faulting audit sink must never break the request or leak into the
      // response. Denied-access auditing is best-effort and server-side only.
    }
  };
}
