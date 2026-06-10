// Caller_Identity derivation for the AWS Agent-API tier.
//
// Spec: knowgrph-acos-mcp-connector, task 6.2 (R15.2; design Auth_Token /
// Caller_Identity data model; Correctness Property 29).
//
// SCOPE OF THIS TASK (6.2): once `withAuth` (task 6.1) has VERIFIED an HS256
// Auth_Token, this module establishes a first-class `Caller_Identity` from the
// verified claims BEFORE any further processing (MCP forward / manifest read).
// It is the authenticated principal the rest of the pipeline authorizes
// against — most notably the `GET /runs/{id}` entitlement check (task 6.4,
// Property 29), which reads `entitledRunIds` from this established identity.
//
// The Auth_Token claims minted by `auth-token.js` carry:
//   - `sub`            session id  -> Caller_Identity subject / principalId
//   - `entitledRunIds` runs the session may read (array; empty at mint)
//   - `iat` / `exp`    issuance + expiry (seconds since epoch)
//
// This is PURE logic over already-verified claims (no I/O, no clock, no secret)
// so it is fully unit-testable with ZERO live network/AWS calls. It mirrors the
// design Caller_Identity schema and never re-verifies the signature — signature
// + expiry verification is `auth-verify.js`'s job and has already happened by
// the time this runs.

/** Raised when verified claims cannot establish a usable Caller_Identity. */
export class CallerIdentityError extends Error {
  constructor(message) {
    super(message);
    this.name = "CallerIdentityError";
    this.code = "caller_identity_unestablished";
  }
}

/**
 * Normalize an `entitledRunIds` claim to a de-duplicated array of non-empty
 * strings. Mirrors the mint-time normalization in `auth-token.js` so the
 * established identity and the minted token agree on entitlement shape. A
 * missing / non-array claim yields an empty entitlement set (R15.4 — a fresh
 * session is entitled to nothing until runs are created within it).
 *
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizeEntitledRunIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id) => typeof id === "string" && id.length > 0))];
}

/**
 * Derive the effective expiry window (seconds) from the verified `iat`/`exp`
 * claims. This is the token's ACTUAL lifetime (`exp - iat`), surfaced on the
 * Caller_Identity for observability / downstream policy. Returns `null` when
 * either timestamp is absent or the pair is non-sensical (exp <= iat), rather
 * than guessing a window — the authoritative window policy lives in
 * `auth-token.js` (mint) and task 6.3 (enforcement).
 *
 * @param {number|undefined} iat
 * @param {number|undefined} exp
 * @returns {number|null}
 */
function deriveExpiryWindowSeconds(iat, exp) {
  if (!Number.isFinite(iat) || !Number.isFinite(exp)) return null;
  const window = Math.trunc(exp) - Math.trunc(iat);
  return window > 0 ? window : null;
}

/**
 * Establish a first-class `Caller_Identity` from VERIFIED Auth_Token claims
 * (R15.2). The returned object mirrors the design Caller_Identity schema and is
 * frozen so it cannot be mutated downstream:
 *
 *   {
 *     subject: string,              // session id (claims.sub)
 *     principalId: string,          // alias of subject (design field name)
 *     entitledRunIds: string[],     // de-duplicated; basis for run authz (R15.4/6.4)
 *     issuedAt: number|null,        // claims.iat (seconds since epoch)
 *     expiryWindowSeconds: number|null, // exp - iat when derivable
 *   }
 *
 * The `subject` is REQUIRED: an Auth_Token minted by this tier always carries a
 * non-empty `sub`, so its absence means the claims cannot establish a principal
 * and a `CallerIdentityError` is thrown. `withAuth` maps that to a 401 — an
 * authenticated-but-identity-less request must not proceed to forward/read.
 *
 * @param {object} claims verified JWT claims (output of a successful verify)
 * @returns {Readonly<{ subject: string, principalId: string, entitledRunIds: string[], issuedAt: number|null, expiryWindowSeconds: number|null }>}
 */
export function buildCallerIdentity(claims) {
  if (!claims || typeof claims !== "object") {
    throw new CallerIdentityError("verified claims are required to establish a Caller_Identity");
  }

  const subject = claims.sub;
  if (typeof subject !== "string" || subject.length === 0) {
    throw new CallerIdentityError("verified claims must carry a non-empty subject (sub)");
  }

  const issuedAt = Number.isFinite(claims.iat) ? Math.trunc(claims.iat) : null;
  const expiryWindowSeconds = deriveExpiryWindowSeconds(claims.iat, claims.exp);

  return Object.freeze({
    subject,
    principalId: subject,
    entitledRunIds: normalizeEntitledRunIds(claims.entitledRunIds),
    issuedAt,
    expiryWindowSeconds,
  });
}

/**
 * Convenience predicate used by the run-manifest authorization seam (task 6.4):
 * is the established identity entitled to read a given run id? Kept here so the
 * entitlement basis lives with the identity it is derived from.
 *
 * @param {{ entitledRunIds?: string[] }} callerIdentity
 * @param {string} runId
 * @returns {boolean}
 */
export function isEntitledToRun(callerIdentity, runId) {
  if (!callerIdentity || !Array.isArray(callerIdentity.entitledRunIds)) return false;
  if (typeof runId !== "string" || runId.length === 0) return false;
  return callerIdentity.entitledRunIds.includes(runId);
}
