// `POST /auth/session` Lambda handler for the AWS Agent-API tier.
//
// Spec: knowgrph-acos-mcp-connector, task 5.0 (R15.2, R15.7, R15.8; Decision
// 0.1; design Auth_Token + Agent_Api; Property 30).
//
// Mints a stateless HS256 JWT (the Auth_Token) carrying `sub` (session id),
// `entitledRunIds` (initially empty), `iat`, and `exp`. The response contains
// only the signed token and NON-SECRET metadata — never the signing secret.
//
// The handler is a PURE, API-Gateway-style `(event) => response` function built
// from injectable seams (secret provider, clock, signer, id generator) so it is
// unit-testable with ZERO live network calls. The CDK infra wiring (API
// Gateway + Lambda + Secrets Manager) is deferred to task 5.1.

import {
  mintAuthToken,
  createEnvSecretProvider,
  defaultClock,
  defaultSigner,
  defaultIdGenerator,
  AuthSecretError,
} from "../lib/auth-token.js";
import { withSafeErrors } from "../lib/safe-error-response.js";

const JSON_HEADERS = Object.freeze({
  "content-type": "application/json",
  "cache-control": "no-store",
});

/** Build a JSON API-Gateway proxy response. */
function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: { ...JSON_HEADERS },
    body: JSON.stringify(payload),
  };
}

/**
 * Parse the request body from an API-Gateway proxy event. Returns `{}` for an
 * absent body and throws a tagged error for malformed JSON.
 */
function parseBody(event) {
  const raw = event && event.body;
  if (raw === undefined || raw === null || raw === "") return {};
  if (typeof raw === "object") return raw; // already-parsed (e.g. direct invoke)
  let text = raw;
  if (event.isBase64Encoded) {
    text = Buffer.from(raw, "base64").toString("utf8");
  }
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    const err = new Error("request body is not valid JSON");
    err.code = "invalid_json";
    throw err;
  }
}

/** Extract the HTTP method across REST (v1) and HTTP (v2) API event shapes. */
function methodOf(event) {
  return (
    event?.httpMethod ||
    event?.requestContext?.http?.method ||
    null
  );
}

/**
 * Create the `POST /auth/session` handler with injectable seams.
 *
 * @param {object} [deps]
 * @param {{ getSecret: () => Promise<string> | string }} [deps.secretProvider]
 * @param {() => number} [deps.clock]
 * @param {(claims: object, secret: string) => string} [deps.signer]
 * @param {() => string} [deps.idGenerator]
 * @returns {(event: object) => Promise<{ statusCode: number, headers: object, body: string }>}
 */
export function createAuthSessionHandler(deps = {}) {
  const secretProvider = deps.secretProvider ?? createEnvSecretProvider();
  const clock = deps.clock ?? defaultClock;
  const signer = deps.signer ?? defaultSigner;
  const idGenerator = deps.idGenerator ?? defaultIdGenerator;

  // task 5.10 / R15.3, R15.6: any UNEXPECTED throw (a fault outside the handled
  // AuthSecretError path) collapses to a stable, non-disclosing HTTP 500 — never
  // a raw stack/config/credential body. The tagged 405/400 and the handled
  // `auth_unavailable` 500 are RETURNED (not thrown), so they pass through
  // unchanged; in particular the signing secret never reaches any response.
  return withSafeErrors(async function authSessionHandler(event = {}) {
    const method = methodOf(event);
    if (method && method.toUpperCase() !== "POST") {
      return jsonResponse(405, {
        error: "method_not_allowed",
        message: "POST /auth/session only supports the POST method",
      });
    }

    let body;
    try {
      body = parseBody(event);
    } catch (err) {
      if (err.code === "invalid_json") {
        return jsonResponse(400, { error: "invalid_request", message: err.message });
      }
      throw err;
    }

    try {
      const minted = await mintAuthToken({
        secretProvider,
        clock,
        signer,
        idGenerator,
        sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
        // Runs are entitled as they are created within the session; a freshly
        // minted session token starts with an empty entitlement set (R15.4).
        entitledRunIds: [],
        expiryWindowSeconds: body.expiryWindowSeconds,
      });

      // Response carries ONLY the signed token and non-secret metadata (R15.7).
      return jsonResponse(201, {
        token: minted.token,
        subject: minted.subject,
        entitledRunIds: minted.entitledRunIds,
        iat: minted.iat,
        exp: minted.exp,
        expiresAt: minted.expiresAt,
        expiryWindowSeconds: minted.expiryWindowSeconds,
        expiryWindowClamped: minted.expiryWindowClamped,
      });
    } catch (err) {
      if (err instanceof AuthSecretError) {
        // Do not leak the secret or its value — only a generic server error.
        return jsonResponse(500, {
          error: "auth_unavailable",
          message: "session token signing is not available",
        });
      }
      throw err;
    }
  }, { onError: deps.onError });
}

/**
 * Default Lambda export, wired to the environment secret provider (R15.7).
 * Real Secrets Manager wiring is injected by the CDK stack in task 5.1.
 */
export const handler = createAuthSessionHandler();
