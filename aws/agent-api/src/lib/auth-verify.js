// Auth_Token verification + `withAuth` middleware for the AWS Agent-API tier.
//
// Spec: knowgrph-acos-mcp-connector, task 6.1 (R15.1, R15.3; design Auth_Token
// verification + Agent_Api request pipeline; Correctness Property 28).
//
// SCOPE OF THIS TASK (6.1): the 401-on-failure verification GATE that sits in
// front of the spend/state endpoints `POST /run` and `GET /runs/{id}`. It:
//   - verifies the HS256 JWT presented as `Authorization: Bearer <token>`
//     against the SERVER-SIDE signing secret (the same secret the issuer
//     `mintAuthToken` signs with) using the FOSS `jsonwebtoken` library, and
//   - on a MISSING, MALFORMED, INVALID-SIGNATURE, or EXPIRED token returns
//     HTTP 401, performs NO MCP forwarding and NO manifest store read (the
//     wrapped handler is never invoked), discloses NO Run_Manifest data, and
//     returns an error free of credential / config detail (Property 28).
//   - on a VALID token, passes the request through to the wrapped handler with
//     a clean `event.auth` seam carrying the verified claims.
//
// CLEAN SEAMS LEFT FOR LATER TASKS (intentionally NOT implemented here):
//   - 6.2 establishing the full Caller_Identity from the verified claims is now
//     DONE: `withAuth` attaches `event.callerIdentity` (built by
//     `caller-identity.js`) BEFORE invoking the wrapped handler, strictly
//     before any MCP forward / store read. The raw `event.auth = { claims }`
//     seam is retained for backward compatibility;
//   - 6.3 expiry-window enforcement policy (verification already honors the
//     token's own `exp`, but the configurable-window policy is 6.3);
//   - 6.4 entitlement / cross-tenant 404 on `GET /runs/{id}` (reads
//     `event.callerIdentity.entitledRunIds` established here);
//   - 6.5 the auth-vs-approval invariant (auth never substitutes for an
//     Approval_Token at a spend boundary).
//
// All seams (secret provider, clock) are injectable so the suite signs test
// tokens with the same secret and makes ZERO live network/AWS calls.

import jwt from "jsonwebtoken";

import {
  JWT_ALGORITHM,
  AuthSecretError,
  resolveExpiryWindowSeconds,
} from "./auth-token.js";
import { buildCallerIdentity, CallerIdentityError } from "./caller-identity.js";

const JSON_HEADERS = Object.freeze({
  "content-type": "application/json",
  "cache-control": "no-store",
});

// --- Non-disclosing 401 (Property 28 / R15.3) -------------------------------

/** Stable error code for every authentication rejection. */
export const UNAUTHORIZED_ERROR = "unauthorized";

/**
 * Stable, reason-agnostic 401 message. Deliberately reveals nothing about WHY
 * verification failed (missing vs malformed vs bad-signature vs expired), the
 * token contents, or any server config — so it discloses neither credential
 * contents nor internal configuration (Property 28).
 */
export const UNAUTHORIZED_MESSAGE = "authentication is required";

/** Stable code/message for an unavailable server-side signing secret. */
export const AUTH_UNAVAILABLE_ERROR = "auth_unavailable";
export const AUTH_UNAVAILABLE_MESSAGE = "authentication is not available";

/**
 * Build the canonical non-disclosing 401 BODY object. Exported so handlers and
 * tests can assert the shape without re-parsing. The shape is fixed and carries
 * nothing derived from the token or the failure reason:
 *   { error: "unauthorized", message: <fixed reason-agnostic> }
 */
export function buildUnauthorizedBody() {
  return { error: UNAUTHORIZED_ERROR, message: UNAUTHORIZED_MESSAGE };
}

/**
 * Build the canonical non-disclosing HTTP 401 API-Gateway proxy RESPONSE for an
 * Auth_Token that is missing, malformed, has an invalid signature, or is
 * expired (Property 28 / R15.1, R15.3). The body never contains a stack trace,
 * internal path, env/config value, the token, or any credential content. A
 * standards-compliant `WWW-Authenticate: Bearer` challenge header is included;
 * it discloses nothing sensitive.
 *
 * @returns {{ statusCode: 401, headers: object, body: string }}
 */
export function buildUnauthorizedResponse() {
  return {
    statusCode: 401,
    headers: { ...JSON_HEADERS, "www-authenticate": "Bearer" },
    body: JSON.stringify(buildUnauthorizedBody()),
  };
}

/**
 * Build the non-disclosing HTTP 500 RESPONSE used when the SERVER-SIDE signing
 * secret is unavailable. This is a server-config fault, not a caller auth
 * failure, so it is a 500 (mirroring `POST /auth/session`) — never a 401 that
 * would imply the caller could fix it. Discloses no secret/config content.
 *
 * @returns {{ statusCode: 500, headers: object, body: string }}
 */
export function buildAuthUnavailableResponse() {
  return {
    statusCode: 500,
    headers: { ...JSON_HEADERS },
    body: JSON.stringify({ error: AUTH_UNAVAILABLE_ERROR, message: AUTH_UNAVAILABLE_MESSAGE }),
  };
}

// --- Bearer-token extraction ------------------------------------------------

/**
 * Case-insensitively read a single header value across the API-Gateway event
 * shapes the Agent_Api may receive: REST (v1) / HTTP (v2) `headers`, and the
 * REST `multiValueHeaders` fallback.
 */
function readHeader(event, name) {
  const want = name.toLowerCase();
  const headers = event?.headers;
  if (headers && typeof headers === "object") {
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === want) {
        const value = headers[key];
        if (typeof value === "string") return value;
      }
    }
  }
  const multi = event?.multiValueHeaders;
  if (multi && typeof multi === "object") {
    for (const key of Object.keys(multi)) {
      if (key.toLowerCase() === want) {
        const values = multi[key];
        if (Array.isArray(values) && values.length > 0 && typeof values[0] === "string") {
          return values[0];
        }
      }
    }
  }
  return null;
}

/**
 * Extract the bearer token from the `Authorization` header.
 *
 * @param {object} event API-Gateway proxy event
 * @returns {{ token: string|null, reason: string|null }}
 *   `token` is the raw JWT when a well-formed `Bearer <token>` header is
 *   present; otherwise `token` is `null` and `reason` tags the failure
 *   (`missing_header` / `malformed_header`) for SERVER-SIDE logging only — it
 *   never reaches the response body.
 */
export function extractBearerToken(event) {
  const raw = readHeader(event ?? {}, "authorization");
  if (raw === null || raw.trim() === "") {
    return { token: null, reason: "missing_header" };
  }
  const match = /^Bearer[ \t]+(\S.*)$/i.exec(raw.trim());
  if (!match) {
    return { token: null, reason: "malformed_header" };
  }
  return { token: match[1].trim(), reason: null };
}

// --- Token verification -----------------------------------------------------

// --- Configurable expiry-WINDOW policy (R15.8 / task 6.3 / Property 30) ------

/**
 * Server-side-only reason tag for a token rejected by the configurable
 * expiry-window policy (distinct from the token's own `exp` `expired` tag so
 * logs can tell the two apart). Like every other rejection reason it NEVER
 * reaches the response body — `withAuth` collapses all failures to the
 * reason-agnostic 401 (Property 28).
 */
export const WINDOW_EXPIRED_REASON = "window_expired";

/**
 * Enforce the configurable issuance-age expiry WINDOW (R15.8 / Property 30).
 *
 * An Auth_Token is expired EXACTLY when its issuance age (`now - iat`) exceeds
 * the effective window. The effective window is resolved by the SAME mint-side
 * clamp/default logic (`resolveExpiryWindowSeconds`) so issuance and enforcement
 * always agree: configurable within [300, 86400] seconds, defaulting to 3600
 * (60 minutes) when unset/invalid. The boundary is EXACT — `age == window` is
 * still valid; only `age > window` is expired.
 *
 * This runs AFTER `jwt.verify` (which already honors the token's own `exp`), so
 * the two checks are consistent: whichever bound is tighter wins. A token whose
 * claims carry no usable `iat` cannot have its issuance age measured, so the
 * window check is skipped and only the token's own `exp` applies.
 *
 * @param {object} claims verified JWT claims (carries `iat` in seconds)
 * @param {number} nowSeconds current time floored to whole seconds
 * @param {unknown} expiryWindowSeconds requested window (clamped per R15.8)
 * @returns {{ expired: boolean, windowSeconds: number, ageSeconds: number|null }}
 */
export function isWithinExpiryWindow(claims, nowSeconds, expiryWindowSeconds) {
  const { seconds: windowSeconds } = resolveExpiryWindowSeconds(expiryWindowSeconds);
  const iat = claims && typeof claims.iat === "number" && Number.isFinite(claims.iat)
    ? claims.iat
    : null;
  if (iat === null) {
    // No measurable issuance instant -> defer entirely to the token's own exp.
    return { expired: false, windowSeconds, ageSeconds: null };
  }
  const ageSeconds = nowSeconds - iat;
  // Exact boundary: age == window is valid; age > window is expired.
  return { expired: ageSeconds > windowSeconds, windowSeconds, ageSeconds };
}

/** Map a thrown `jsonwebtoken` error to a stable, server-side-only reason tag. */
function reasonForVerifyError(err) {
  if (!err || typeof err !== "object") return "invalid";
  if (err.name === "TokenExpiredError") return "expired";
  if (err.name === "NotBeforeError") return "not_active";
  if (err.name === "JsonWebTokenError") {
    const message = String(err.message || "").toLowerCase();
    if (message.includes("malformed")) return "malformed";
    if (message.includes("signature")) return "invalid_signature";
    return "invalid";
  }
  return "invalid";
}

/**
 * Verify an HS256 Auth_Token against the server-side secret using the FOSS
 * `jsonwebtoken` library. Establishes the result `{ valid, claims | reason }`.
 *
 * A pinned `algorithms: ["HS256"]` constraint prevents an `alg: none` or
 * algorithm-confusion bypass. The token's own `exp` is enforced; an injectable
 * `clock` (ms-since-epoch) makes expiry deterministic in tests via
 * `clockTimestamp`.
 *
 * On top of the token's own `exp`, the configurable issuance-age expiry WINDOW
 * (R15.8 / task 6.3 / Property 30) is enforced: a token is also expired when its
 * issuance age (`now - iat`) exceeds the effective window. The window is
 * resolved by the SAME mint-side clamp/default logic so issuance and
 * enforcement agree — configurable within [300, 86400] seconds, default 3600
 * when unset. The boundary is exact (`age == window` valid; `age > window`
 * expired).
 *
 * @param {object} params
 * @param {string|null} params.token  the raw JWT (or `null` when absent)
 * @param {string} params.secret      the server-side HS256 signing secret
 * @param {() => number} [params.clock] ms-since-epoch clock seam (default Date.now)
 * @param {unknown} [params.expiryWindowSeconds] configured window (clamped per
 *   R15.8); defaults to 3600 (60 min) when unset/invalid
 * @returns {{ valid: true, claims: object } | { valid: false, reason: string }}
 */
export function verifyAuthToken({ token, secret, clock = Date.now, expiryWindowSeconds } = {}) {
  if (typeof token !== "string" || token.length === 0) {
    return { valid: false, reason: "missing_token" };
  }
  if (typeof secret !== "string" || secret.length === 0) {
    // Surfaced as a server-config fault by the caller (not a caller 401).
    throw new AuthSecretError("a non-empty signing secret is required to verify");
  }
  const nowSeconds = Math.floor(clock() / 1000);
  let claims;
  try {
    claims = jwt.verify(token, secret, {
      algorithms: [JWT_ALGORITHM],
      clockTimestamp: nowSeconds,
    });
  } catch (err) {
    return { valid: false, reason: reasonForVerifyError(err) };
  }
  // Enforce the configurable issuance-age expiry window in addition to / in a
  // way consistent with the token's own `exp` (R15.8 / Property 30).
  const window = isWithinExpiryWindow(claims, nowSeconds, expiryWindowSeconds);
  if (window.expired) {
    return { valid: false, reason: WINDOW_EXPIRED_REASON };
  }
  return { valid: true, claims };
}

/**
 * Create an event-level verifier bound to a secret provider + clock seam. It
 * extracts the bearer token, resolves the server-side secret, and verifies the
 * token, returning `{ valid, claims | reason }`. A thrown `AuthSecretError`
 * (secret unavailable) propagates so `withAuth` can map it to a 500 rather than
 * a misleading 401.
 *
 * @param {object} deps
 * @param {{ getSecret: () => Promise<string>|string }} deps.secretProvider
 * @param {() => number} [deps.clock] ms-since-epoch clock seam
 * @param {unknown} [deps.expiryWindowSeconds] configured issuance-age expiry
 *   window (R15.8 / task 6.3); clamped to [300, 86400], default 3600 when unset
 * @returns {(event: object) => Promise<{ valid: true, claims: object } | { valid: false, reason: string }>}
 */
export function createAuthVerifier({ secretProvider, clock = Date.now, expiryWindowSeconds } = {}) {
  if (!secretProvider || typeof secretProvider.getSecret !== "function") {
    throw new AuthSecretError("a secret provider with getSecret() is required");
  }
  return async function verify(event = {}) {
    const secret = await secretProvider.getSecret();
    const { token, reason } = extractBearerToken(event);
    if (token === null) {
      // Absent / malformed Authorization header -> treat as a missing token.
      return { valid: false, reason: reason ?? "missing_token" };
    }
    return verifyAuthToken({ token, secret, clock, expiryWindowSeconds });
  };
}

// --- `withAuth` middleware ---------------------------------------------------

/**
 * Compose Auth_Token verification IN FRONT of a handler. On a missing /
 * malformed / invalid-signature / expired token the wrapped handler is NEVER
 * invoked — so there is NO MCP forwarding (run) and NO manifest store read
 * (runs) — and the gate returns the canonical non-disclosing 401 (Property 28).
 * On a valid token the request passes through to the handler with a clean
 * `event.auth = { claims }` seam AND an established `event.callerIdentity`
 * (task 6.2 / R15.2) derived from the verified claims, attached strictly BEFORE
 * the handler runs so downstream processing (entitlement task 6.4) reads it. If
 * the verified claims cannot establish a principal (no subject), the request is
 * treated as a 401 — an authenticated-but-identity-less request must not
 * forward or read.
 *
 * This is a thin COMPOSITION wrapper: it duplicates none of the wrapped
 * handler's logic. It is applied to `POST /run` and `GET /runs/{id}`; the open
 * routes `GET /health` and `POST /auth/session` are NOT wrapped and stay open
 * (R15.6).
 *
 * @template {(event: object) => any} H
 * @param {H} handler the inner endpoint handler `(event) => response`
 * @param {object} deps
 * @param {{ getSecret: () => Promise<string>|string }} deps.secretProvider
 *   server-side secret provider (reuse `createStaticSecretProvider` /
 *   `createEnvSecretProvider` from `auth-token.js`)
 * @param {() => number} [deps.clock] ms-since-epoch clock seam (default Date.now)
 * @param {unknown} [deps.expiryWindowSeconds] configured issuance-age expiry
 *   window (R15.8 / task 6.3); clamped to [300, 86400], default 3600 when unset.
 *   A token whose issuance age exceeds the effective window is treated as
 *   expired and yields the canonical non-disclosing 401.
 * @param {(info: { reason: string }) => void} [deps.onAuthFailure]
 *   server-side-only sink for the failure reason (e.g. metrics). The reason is
 *   NEVER placed in the response body.
 * @param {(error: unknown) => void} [deps.onError] server-side-only error sink
 *   for an unavailable signing secret. Never reflected in the response.
 * @returns {(event: object) => Promise<{ statusCode: number, headers: object, body: string }>}
 */
export function withAuth(handler, deps = {}) {
  if (typeof handler !== "function") {
    throw new TypeError("withAuth requires a handler function to wrap");
  }
  const verify = createAuthVerifier({
    secretProvider: deps.secretProvider,
    clock: deps.clock,
    expiryWindowSeconds: deps.expiryWindowSeconds,
  });
  const onAuthFailure = typeof deps.onAuthFailure === "function" ? deps.onAuthFailure : null;
  const onError = typeof deps.onError === "function" ? deps.onError : null;

  return async function authedHandler(event = {}) {
    let result;
    try {
      result = await verify(event);
    } catch (err) {
      // Server-side signing-secret fault -> non-disclosing 500 (not a 401).
      if (onError) {
        try {
          onError(err);
        } catch {
          // Logging must never break or leak into the safe response.
        }
      }
      return buildAuthUnavailableResponse();
    }

    if (!result.valid) {
      if (onAuthFailure) {
        try {
          onAuthFailure({ reason: result.reason });
        } catch {
          // Logging must never break or leak into the 401.
        }
      }
      // Gate closed: the wrapped handler is NOT invoked, so there is no MCP
      // forward and no manifest read, and no Run_Manifest data is disclosed.
      return buildUnauthorizedResponse();
    }

    // Gate open: ESTABLISH the Caller_Identity from the verified claims BEFORE
    // invoking the wrapped handler (task 6.2 / R15.2), strictly before any MCP
    // forward / manifest read. If the verified claims cannot establish a
    // principal (e.g. no subject), treat it as an auth failure rather than
    // forwarding/reading on behalf of an unidentifiable caller.
    let callerIdentity;
    try {
      callerIdentity = buildCallerIdentity(result.claims);
    } catch (err) {
      if (err instanceof CallerIdentityError) {
        if (onAuthFailure) {
          try {
            onAuthFailure({ reason: "identity_unestablished" });
          } catch {
            // Logging must never break or leak into the 401.
          }
        }
        return buildUnauthorizedResponse();
      }
      throw err;
    }

    // Pass through with the verified claims under a clean seam AND the
    // established Caller_Identity. A shallow copy avoids mutating the caller's
    // event object.
    return handler({ ...event, auth: { claims: result.claims }, callerIdentity });
  };
}
