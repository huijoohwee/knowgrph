// `GET /runs/{id}` Lambda handler for the AWS Agent-API tier.
//
// Spec: knowgrph-acos-mcp-connector, tasks 5.6 (R12.5) and 5.7 (R12.6; design
// Agent_Api `GET /runs/{id}`; Data Models -> Run_Manifest; Open Decisions ->
// Resolved Decision 0.2).
//
// SCOPE (5.6): for a KNOWN run id, return the current Run_Manifest with HTTP 200
// within a structural 1,000 ms deadline (R12.5).
// SCOPE (5.7): for an UNKNOWN run id (store returns `undefined`), return HTTP
// 404 indicating the run was not found, with a body that is BYTE-IDENTICAL to
// the response a future authenticated-but-UNENTITLED read (task 6.4) returns,
// so a caller cannot distinguish "unknown" from "unentitled" — no run-existence
// leak (Decision 0.2; R12.6, R15.4, R15.5). The shared canonical 404 builder
// (`run-not-found-response.js`) guarantees the two paths can never drift.
//
// The manifest is read through an INJECTABLE manifest-store seam
// (`run-manifest-store.js`) so the local runtime/tests make ZERO live
// network/AWS calls; durable store / DynamoDB / S3 wiring is integration task
// 9.2.
//
// The handler is a PURE, API-Gateway-style `(event) => response` function,
// mirroring `src/handlers/run.js`. The 1,000 ms read deadline is recorded as
// STRUCTURAL METADATA (no real timer) — an injectable `readElapsedMs` signal
// models a slow durable read, mirroring the render/commerce/forwarder pattern.
//
// SCOPE (6.4 — THIS TASK): run-manifest AUTHORIZATION. Once `withAuth` (task
// 6.1) has established `event.callerIdentity` (subject + entitledRunIds, task
// 6.2), the manifest is returned ONLY when that identity is entitled to the
// requested run (`isEntitledToRun`, R15.4). For an authenticated-but-UNENTITLED
// caller (run exists but is not in `entitledRunIds`) OR an UNKNOWN run, the
// handler returns the SAME canonical HTTP 404 (byte-identical via
// `buildRunNotFoundResponse`, so run existence never leaks — Decision 0.2;
// R15.5, R12.6), discloses NO Run_Manifest content, AND records the denied
// access attempt through a SERVER-SIDE audit seam (`run-access-audit.js`) that
// is never reflected in the response body (Correctness Property 29).
//
// Entitlement enforcement is gated behind `enforceEntitlement` (wired on by
// `createAuthedRunsHandler`) so a bare, unauthenticated `createRunsHandler`
// keeps its task 5.6 known-run behavior for local/unit use; in production the
// handler is ALWAYS composed behind `withAuth`, which both establishes the
// Caller_Identity and turns entitlement on.

import {
  createDefaultManifestStore,
  createNotWiredManifestStore,
  RUN_MANIFEST_READ_DEADLINE_MS,
} from "../lib/run-manifest-store.js";
import { buildRunNotFoundResponse } from "../lib/run-not-found-response.js";
import { withSafeErrors } from "../lib/safe-error-response.js";
import { withAuth } from "../lib/auth-verify.js";
import { createEnvSecretProvider } from "../lib/auth-token.js";
import { isEntitledToRun } from "../lib/caller-identity.js";
import {
  resolveAccessAuditRecorder,
  DENIED_REASON_UNKNOWN_RUN,
  DENIED_REASON_UNENTITLED,
} from "../lib/run-access-audit.js";
import { buildCorsHeaders } from "../lib/cors.js";

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

/**
 * Extract the `{id}` path parameter across the event shapes the Agent_Api may
 * receive: API-Gateway proxy `pathParameters` (REST v1 / HTTP v2), or a raw
 * `/runs/{id}` path on `rawPath` / `path` as a fallback for direct invokes.
 */
function runIdOf(event) {
  const fromParams =
    event?.pathParameters?.id ??
    event?.pathParameters?.runId ??
    event?.pathParameters?.proxy;
  if (fromParams !== undefined && fromParams !== null && String(fromParams).trim() !== "") {
    return String(fromParams).trim();
  }
  const path = event?.rawPath || event?.path || "";
  const match = /\/runs\/([^/?#]+)/.exec(path);
  if (match) {
    try {
      return decodeURIComponent(match[1]).trim();
    } catch {
      return match[1].trim();
    }
  }
  return null;
}

/** Resolve the (timer-free) read-elapsed signal for the 1,000 ms deadline. */
function resolveReadElapsedMs(value) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function isReadableByCaller(record, callerIdentity, runId) {
  if (isEntitledToRun(callerIdentity, runId)) return true;
  const ownerPrincipalId = record?.ownerPrincipalId;
  return (
    typeof ownerPrincipalId === "string" &&
    ownerPrincipalId.length > 0 &&
    ownerPrincipalId === callerIdentity?.principalId
  );
}

/**
 * Default unknown-run seam (task 5.7). Delegates to the shared canonical 404
 * builder so the unknown-run response is byte-identical to the entitlement 404
 * (task 6.4) — no field distinguishes unknown from unentitled, so run existence
 * is never leaked (Decision 0.2; R12.6, R15.4, R15.5). The body carries no
 * Run_Manifest content and no internal config/stack/credential detail.
 */
function defaultOnUnknownRun({ runId }) {
  return buildRunNotFoundResponse({ runId });
}

/**
 * Create the `GET /runs/{id}` handler with injectable seams.
 *
 * @param {object} [deps]
 * @param {{ read: (runId: string) => (object|undefined) }} [deps.store]
 *   injectable manifest-store seam. `read(runId)` returns the persisted record
 *   `{ runId, persistedAt, contractVersion, manifest }` for a known run, or
 *   `undefined` for an unknown one. Defaults to the not-wired store (every read
 *   `undefined`) so an un-wired deployment surfaces the unknown-run 404 seam
 *   until task 9.2 injects a durable store. Tests inject an in-memory store to
 *   keep reads network-free.
 * @param {number} [deps.readElapsedMs] injected elapsed signal modelling durable
 *   read latency for the 1,000 ms deadline assertion (default 0 — synchronous).
 * @param {(args: { runId: string, event: object }) => object} [deps.onUnknownRun]
 *   seam invoked when the store returns `undefined` (task 5.7 / 6.4). Defaults
 *   to a minimal HTTP 404 placeholder.
 * @param {boolean} [deps.enforceEntitlement] when true (wired on by
 *   {@link createAuthedRunsHandler}), the handler authorizes the read against
 *   `event.callerIdentity.entitledRunIds` (R15.4): the manifest is returned only
 *   for an entitled caller; an unentitled caller (run exists, not entitled) and
 *   an unknown run BOTH return the same canonical 404 and record a denied-access
 *   attempt (Property 29). Defaults to `false` so a bare handler keeps its
 *   task 5.6 known-run behavior for local/unit use.
 * @param {((entry: object) => void) | { record: (entry: object) => void }} [deps.recordDeniedAccess]
 *   server-side-only denied-access audit seam invoked for both unentitled and
 *   unknown reads with `{ runId, principalId, reason }` (R15.4, R15.5; Property
 *   29). Never reflected in the response body. Accepts a function or a sink
 *   object; defaults to a no-op. Alias: `deps.onAccessDenied`.
 * @param {(error: unknown) => void} [deps.onError] server-side-only error sink
 *   for the non-disclosing 500 catch-all (task 5.10 / R15.3). The original error
 *   is logged here only; it NEVER reaches the response body.
 * @returns {(event: object) => Promise<{ statusCode: number, headers: object, body: string }>}
 */
export function createRunsHandler(deps = {}) {
  const store = deps.store ?? createNotWiredManifestStore();
  const onUnknownRun = typeof deps.onUnknownRun === "function" ? deps.onUnknownRun : defaultOnUnknownRun;
  const enforceEntitlement = deps.enforceEntitlement === true;
  const recordDeniedAccess = resolveAccessAuditRecorder(
    deps.recordDeniedAccess ?? deps.onAccessDenied,
  );

  // task 5.10 / R15.3, R15.6: any UNEXPECTED throw (e.g. a faulting store read)
  // collapses to a stable, non-disclosing HTTP 500 — never a raw stack/config/
  // credential body. The tagged 405/400 and canonical 404 responses are RETURNED
  // (not thrown), so they pass through this wrapper unchanged and stay
  // byte-identical with the entitlement 404 (Decision 0.2).
  return withSafeErrors(async function runsHandler(event = {}) {
    const method = methodOf(event);
    if (method && method.toUpperCase() !== "GET") {
      return jsonResponse(405, {
        error: "method_not_allowed",
        message: "GET /runs/{id} only supports the GET method",
      });
    }

    const runId = runIdOf(event);
    if (!runId) {
      return jsonResponse(400, {
        error: "invalid_request",
        message: "GET /runs/{id} requires a non-empty run id path parameter",
      });
    }

    // Read the current Run_Manifest through the injectable store seam. ZERO
    // live network/AWS calls in the local runtime/tests (R12.5); the durable
    // read is task 9.2.
    const record = await store.read(runId);

    // Unknown run -> route through the unknown-run seam (task 5.7 / 6.4). The
    // store answers `undefined` for an id it has never persisted. When
    // entitlement is enforced, record the denied access attempt server-side
    // first (Property 29) — the reason (`unknown_run`) never reaches the
    // canonical 404 body, so unknown stays indistinguishable from unentitled.
    if (record === undefined || record === null) {
      if (enforceEntitlement) {
        recordDeniedAccess({
          runId,
          principalId: event?.callerIdentity?.principalId,
          reason: DENIED_REASON_UNKNOWN_RUN,
        });
      }
      return onUnknownRun({ runId, event });
    }

    // Run EXISTS -> authorize the read against the established Caller_Identity
    // (task 6.4 / R15.4, R15.5). An unentitled caller gets the SAME canonical
    // 404 as an unknown run (byte-identical, Decision 0.2) with NO Run_Manifest
    // content, and the denied access attempt is recorded server-side
    // (Property 29). Entitlement is enforced only when wired on (always in
    // production via `createAuthedRunsHandler`); a bare handler keeps its
    // task 5.6 known-run behavior.
    if (enforceEntitlement && !isReadableByCaller(record, event?.callerIdentity, runId)) {
      recordDeniedAccess({
        runId,
        principalId: event?.callerIdentity?.principalId,
        reason: DENIED_REASON_UNENTITLED,
      });
      return onUnknownRun({ runId, event });
    }

    // Known run + entitled caller -> return the CURRENT Run_Manifest with HTTP
    // 200 (R12.5). The record mirrors the worker durable store shape; the body
    // is the manifest payload plus the structural 1,000 ms read-deadline
    // metadata.
    const readElapsedMs = resolveReadElapsedMs(deps.readElapsedMs);
    const manifest = record.manifest ?? record;

    return jsonResponse(200, {
      runId: record.runId ?? runId,
      manifest,
      persistedAt: record.persistedAt ?? null,
      contractVersion: record.contractVersion ?? manifest?.contractVersion ?? null,
      readElapsedMs,
      readWithinDeadline: readElapsedMs <= RUN_MANIFEST_READ_DEADLINE_MS,
      readDeadlineMs: RUN_MANIFEST_READ_DEADLINE_MS,
    });
  }, { onError: deps.onError });
}

/**
 * Compose Auth_Token verification IN FRONT of a `GET /runs/{id}` handler
 * (task 6.1 / R15.1, R15.3; Property 28). A missing/malformed/invalid-signature/
 * expired Auth_Token returns HTTP 401 and the inner handler is NEVER invoked,
 * so NO manifest store read occurs and no Run_Manifest data is disclosed; a
 * valid token passes through with the verified claims under `event.auth` (the
 * basis for the entitlement check in task 6.4). Pure composition — it
 * duplicates none of the runs handler's logic.
 *
 * @param {object} [deps]
 * @param {{ getSecret: () => Promise<string>|string }} [deps.secretProvider]
 *   server-side HS256 secret provider (defaults to the Lambda-env provider;
 *   tests inject a static provider and sign tokens with the same secret).
 * @param {() => number} [deps.clock] ms-since-epoch clock seam.
 * @param {unknown} [deps.expiryWindowSeconds] configured issuance-age expiry
 *   window (R15.8 / task 6.3); clamped to [300, 86400], default 3600 when unset.
 * @param {object} [deps.runs] options forwarded to {@link createRunsHandler}
 *   (`store`, `readElapsedMs`, `onUnknownRun`, `onError`). Entitlement
 *   enforcement (task 6.4) is turned ON here so the authed handler authorizes
 *   every read against the established Caller_Identity.
 * @param {((entry: object) => void) | { record: (entry: object) => void }} [deps.recordDeniedAccess]
 *   server-side-only denied-access audit seam forwarded to the runs handler
 *   (R15.4, R15.5; Property 29). Alias: `deps.onAccessDenied`.
 * @param {(info: { reason: string }) => void} [deps.onAuthFailure]
 * @returns {(event: object) => Promise<{ statusCode: number, headers: object, body: string }>}
 */
export function createAuthedRunsHandler(deps = {}) {
  const secretProvider = deps.secretProvider ?? createEnvSecretProvider();
  // Compose entitlement enforcement (task 6.4) onto the runs handler: once
  // `withAuth` establishes `event.callerIdentity`, the handler returns the
  // manifest ONLY for an entitled caller and otherwise emits the canonical 404
  // while recording the denied access attempt server-side (R15.4, R15.5;
  // Property 29). The audit seam is reused from the authed deps so a single
  // sink covers both the unentitled and unknown-run denials.
  const runsDeps = {
    ...(deps.runs ?? {}),
    enforceEntitlement: true,
    recordDeniedAccess:
      deps.recordDeniedAccess ?? deps.onAccessDenied ?? deps.runs?.recordDeniedAccess ?? deps.runs?.onAccessDenied,
  };
  return withAuth(createRunsHandler(runsDeps), {
    secretProvider,
    clock: deps.clock,
    expiryWindowSeconds: deps.expiryWindowSeconds,
    onAuthFailure: deps.onAuthFailure,
    onError: deps.onError,
  });
}

export function createDefaultRunsHandler(deps = {}) {
  const env = deps.env ?? (typeof process !== "undefined" ? process.env : {}) ?? {};
  const store = deps.store ?? createDefaultManifestStore({ env, client: deps.client });
  return createAuthedRunsHandler({
    secretProvider: deps.secretProvider,
    clock: deps.clock,
    expiryWindowSeconds: deps.expiryWindowSeconds,
    onAuthFailure: deps.onAuthFailure,
    onError: deps.onError,
    recordDeniedAccess: deps.recordDeniedAccess,
    runs: {
      ...(deps.runs ?? {}),
      store,
    },
  });
}

/**
 * Default Lambda export — Auth_Token-gated (task 6.1). Durable store wiring is
 * injected by task 9.2; auth verification is always in front.
 */
export const handler = createDefaultRunsHandler();
