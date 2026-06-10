// AgentCore Runtime inbound auth — R15 Auth_Token reconciliation.
//
// Spec: knowgrph-acos-mcp-connector, task 13.4 (R15.1, R15.2, R15.3, R15.9;
// design Auth_Token verification + Agent_Api request pipeline; Correctness
// Properties 1, 28, 29).
//
// ============================================================================
// WHY A THIN VERIFYING LAYER (and NOT AgentCore's native JWT authorizer)
// ============================================================================
// Amazon Bedrock AgentCore Runtime supports an inbound JWT authorizer
// (`customJWTAuthorizer`), but it is purpose-built for OIDC providers: it
// requires a `discoveryUrl` (an OIDC `.well-known` endpoint exposing a JWKS of
// ASYMMETRIC public keys, e.g. RS256) plus an allowed-clients / audience list,
// and validates the token against that issuer's published keys.
//
// The R15 Auth_Token (Decision 0.1) is a STATELESS, SYMMETRIC **HS256** JWT
// minted by the Agent_Api itself (`POST /auth/session`) with a SERVER-SIDE
// shared secret (`auth-token.js` / `mintAuthToken`). There is no external OIDC
// issuer, no `.well-known` discovery document, and no JWKS of public keys for
// AgentCore's native authorizer to fetch. AgentCore's native JWT authorizer
// therefore CANNOT verify an HS256 shared-secret token cleanly.
//
// Resolution (recorded in this tier's README): we keep R15 verification
// IDENTICAL to the agent-api middleware by running a **thin verifying layer at
// the entry of the AgentCore-hosted MCP server** that performs the SAME R15
// verification BEFORE any forwarding. It does so by REUSING the agent-api
// verification primitives (`createAuthVerifier`, `buildCallerIdentity`, the
// non-disclosing response builders) rather than duplicating the JWT logic — so
// the two tiers can never drift in how they verify a token or what they
// disclose on rejection.
//
// ============================================================================
// BEHAVIOR (R15.1, R15.2, R15.3, R15.9)
// ============================================================================
//   - MISSING / MALFORMED / INVALID-SIGNATURE / EXPIRED Auth_Token -> HTTP 401,
//     the MCP forward seam is NEVER invoked (NO MCP forwarding), NO Run_Manifest
//     data is disclosed, and the error reveals neither credential contents nor
//     internal config (R15.1, R15.3 / Property 28).
//   - VALID Auth_Token -> establish Caller_Identity from the verified claims
//     BEFORE forwarding (R15.2 / Property 29), attach it to the forwarded
//     request, then forward to the Cloudflare McpAgent.
//   - AUTH != APPROVAL (R15.9 / Property 1): a verified Auth_Token authorizes
//     only ACCESS to the forward; it NEVER substitutes for an Approval_Token at
//     a spend boundary. This tier performs NO paid action and NO approval logic
//     — every spend boundary stays gated downstream at the Cloudflare
//     Hitl_Gate_Service (see task 13.5). The verified request is forwarded
//     exactly as an authenticated-but-unapproved call, so the control-plane
//     Approval_Gate still runs unchanged.
//
// All seams (secret provider, clock, forward) are injectable so the suite makes
// ZERO live network/AWS calls.

import { createAuthVerifier, buildUnauthorizedResponse, buildAuthUnavailableResponse } from "../../agent-api/src/lib/auth-verify.js";
import { buildCallerIdentity, CallerIdentityError } from "../../agent-api/src/lib/caller-identity.js";
import { createEnvSecretProvider } from "../../agent-api/src/lib/auth-token.js";

/**
 * Compose R15 Auth_Token verification IN FRONT of the AgentCore MCP-forwarding
 * seam. This is the AgentCore-tier analogue of the agent-api `withAuth`
 * middleware, built by REUSING the same verification primitives.
 *
 * On a missing / malformed / invalid-signature / expired Auth_Token the forward
 * seam is NEVER invoked — so there is NO MCP forwarding and NO Run_Manifest
 * disclosure — and the gate returns the canonical non-disclosing 401
 * (Property 28). On a valid token it establishes the Caller_Identity (R15.2 /
 * Property 29) and forwards with that identity attached.
 *
 * @template {(request: object) => any} F
 * @param {F} forward the inner MCP-forward seam `(request) => response`. It is
 *   invoked ONLY for a verified, identity-established request. It receives the
 *   request with a clean `request.auth = { claims }` seam and an established
 *   `request.callerIdentity`. It MUST NOT perform any paid action or approval
 *   substitution — spend boundaries stay gated at the Cloudflare control plane
 *   (R15.9 / Property 1).
 * @param {object} deps
 * @param {{ getSecret: () => Promise<string>|string }} [deps.secretProvider]
 *   server-side HS256 secret provider (defaults to the container-env provider;
 *   tests inject a static provider and sign tokens with the same secret). The
 *   secret is the SAME server-side material the Agent_Api signs with — never in
 *   the image, build args, logs, or any response (R15.7 / R11).
 * @param {() => number} [deps.clock] ms-since-epoch clock seam (default Date.now)
 * @param {unknown} [deps.expiryWindowSeconds] configured issuance-age expiry
 *   window (R15.8); clamped to [300, 86400], default 3600 when unset.
 * @param {(info: { reason: string }) => void} [deps.onAuthFailure]
 *   server-side-only sink for the failure reason. NEVER placed in the response.
 * @param {(error: unknown) => void} [deps.onError] server-side-only error sink
 *   for an unavailable signing secret. Never reflected in the response.
 * @returns {(request: object) => Promise<{ statusCode: number, headers: object, body: string }>}
 */
export function withInboundAuth(forward, deps = {}) {
  if (typeof forward !== "function") {
    throw new TypeError("withInboundAuth requires a forward seam function to wrap");
  }
  const secretProvider = deps.secretProvider ?? createEnvSecretProvider();
  const verify = createAuthVerifier({
    secretProvider,
    clock: deps.clock,
    expiryWindowSeconds: deps.expiryWindowSeconds,
  });
  const onAuthFailure = typeof deps.onAuthFailure === "function" ? deps.onAuthFailure : null;
  const onError = typeof deps.onError === "function" ? deps.onError : null;

  return async function authedForward(request = {}) {
    let result;
    try {
      result = await verify(request);
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
      // Gate closed: the forward seam is NOT invoked, so there is NO MCP
      // forward and NO Run_Manifest disclosure (R15.1, R15.3 / Property 28).
      return buildUnauthorizedResponse();
    }

    // Gate open: ESTABLISH the Caller_Identity from the verified claims BEFORE
    // forwarding (R15.2 / Property 29). An authenticated-but-identity-less
    // request (no subject) must not forward.
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

    // Forward with the verified claims + established Caller_Identity. The
    // forwarded call is still subject to every downstream Approval_Gate at the
    // Cloudflare control plane — authentication NEVER substitutes for an
    // Approval_Token (R15.9 / Property 1). A shallow copy avoids mutating the
    // caller's request object.
    return forward({ ...request, auth: { claims: result.claims }, callerIdentity });
  };
}

// Re-export the reused primitives so AgentCore-tier callers/tests can assert on
// the shared verification surface without reaching across tiers themselves.
export {
  createAuthVerifier,
  buildUnauthorizedResponse,
  buildAuthUnavailableResponse,
} from "../../agent-api/src/lib/auth-verify.js";
export { buildCallerIdentity } from "../../agent-api/src/lib/caller-identity.js";
