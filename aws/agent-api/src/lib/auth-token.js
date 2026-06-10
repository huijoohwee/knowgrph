// Auth_Token minting + expiry-window policy for the AWS Agent-API tier.
//
// Spec: knowgrph-acos-mcp-connector, task 5.0 (R15.2, R15.7, R15.8; Decision
// 0.1; design Auth_Token data model + Property 30).
//
// The Auth_Token is a stateless HMAC-signed JWT (HS256) minted by the Agent_Api
// itself (no external IdP, no per-user DB). It carries:
//   - `sub`            session id, used as Caller_Identity (R15.2)
//   - `entitledRunIds` runs the session may read; empty at mint time (R15.4)
//   - `iat` / `exp`    issuance + expiry honoring the configured window (R15.8)
//
// The signing secret is server-side only: it is supplied through an injectable
// secret-provider seam and is NEVER logged and NEVER returned to a caller
// (R15.7). Pure logic + injectable seams (clock, secret provider, signer, id
// generator) keep this module unit-testable with ZERO live network calls.

import { randomUUID } from "node:crypto";

import jwt from "jsonwebtoken";

// --- Expiry-window policy (R15.8) ------------------------------------------

/** Default Auth_Token lifetime when the caller does not request one: 60 min. */
export const DEFAULT_EXPIRY_WINDOW_SECONDS = 3600;
/** Minimum configurable lifetime: 5 minutes. */
export const MIN_EXPIRY_WINDOW_SECONDS = 300;
/** Maximum configurable lifetime: 24 hours. */
export const MAX_EXPIRY_WINDOW_SECONDS = 86400;

/** JWT signing algorithm — symmetric HMAC-SHA256 per Decision 0.1. */
export const JWT_ALGORITHM = "HS256";

/**
 * Resolve a requested expiry window to the effective window, clamped to
 * [MIN, MAX] and defaulting to DEFAULT when unset/invalid (R15.8).
 *
 * Decision (recorded): out-of-range values are CLAMPED to the nearest bound
 * rather than rejected, and the effective value is echoed back to the caller in
 * the response (`expiryWindowSeconds`). This keeps `POST /auth/session` a
 * forgiving session-mint endpoint while still guaranteeing the window invariant
 * the rest of the system relies on. A non-numeric / non-finite / non-integer
 * request falls back to the default.
 *
 * @param {unknown} requested
 * @returns {{ seconds: number, clamped: boolean, defaulted: boolean }}
 */
export function resolveExpiryWindowSeconds(requested) {
  if (requested === undefined || requested === null) {
    return { seconds: DEFAULT_EXPIRY_WINDOW_SECONDS, clamped: false, defaulted: true };
  }

  const numeric = typeof requested === "number" ? requested : Number(requested);
  if (!Number.isFinite(numeric)) {
    return { seconds: DEFAULT_EXPIRY_WINDOW_SECONDS, clamped: false, defaulted: true };
  }

  // Whole seconds only; truncate fractional requests toward zero.
  const whole = Math.trunc(numeric);

  if (whole < MIN_EXPIRY_WINDOW_SECONDS) {
    return { seconds: MIN_EXPIRY_WINDOW_SECONDS, clamped: true, defaulted: false };
  }
  if (whole > MAX_EXPIRY_WINDOW_SECONDS) {
    return { seconds: MAX_EXPIRY_WINDOW_SECONDS, clamped: true, defaulted: false };
  }
  return { seconds: whole, clamped: false, defaulted: false };
}

// --- Errors -----------------------------------------------------------------

/** Raised when the server-side signing secret is unavailable. */
export class AuthSecretError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthSecretError";
    this.code = "auth_secret_unavailable";
  }
}

async function defaultFetchSecretFromArn(secretArn) {
  const { SecretsManagerClient, GetSecretValueCommand } = await import("@aws-sdk/client-secrets-manager");
  const client = new SecretsManagerClient({});
  const response = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
  if (typeof response.SecretString === "string" && response.SecretString.length > 0) {
    return response.SecretString;
  }
  if (response.SecretBinary) {
    return Buffer.from(response.SecretBinary).toString("utf8");
  }
  throw new AuthSecretError(`signing secret '${secretArn}' has no readable value`);
}

// --- Secret-provider seams (server-side only; never logged/returned) --------

/**
 * Static secret provider — primarily for deterministic tests. The secret is
 * captured in a closure and is never enumerable on the returned object.
 *
 * @param {string} secret
 */
export function createStaticSecretProvider(secret) {
  if (typeof secret !== "string" || secret.length === 0) {
    throw new AuthSecretError("static secret provider requires a non-empty secret");
  }
  return Object.freeze({
    async getSecret() {
      return secret;
    },
  });
}

/**
 * Lambda-environment secret provider (R15.7). Reads the HS256 signing secret
 * from `process.env` (default key `AUTH_JWT_SECRET`). When the inline secret is
 * absent but the corresponding ARN key exists (`AUTH_JWT_SECRET_ARN`), it
 * fetches the value from AWS Secrets Manager through an injectable seam. This
 * lets the deployed Lambda use the ARN-based CDK wiring while local tests keep
 * using a plain env secret.
 *
 * @param {Record<string, string | undefined>} [env]
 * @param {string} [key]
 * @param {{
 *   secretArnKey?: string,
 *   fetchSecretFromArn?: (secretArn: string) => Promise<string>|string,
 * }} [options]
 */
export function createEnvSecretProvider(env = process.env, key = "AUTH_JWT_SECRET", options = {}) {
  const secretArnKey =
    typeof options.secretArnKey === "string" && options.secretArnKey.length > 0
      ? options.secretArnKey
      : `${key}_ARN`;
  const fetchSecretFromArn =
    typeof options.fetchSecretFromArn === "function"
      ? options.fetchSecretFromArn
      : defaultFetchSecretFromArn;
  let cachedArnSecretPromise = null;
  return Object.freeze({
    async getSecret() {
      const secret = env[key];
      if (typeof secret === "string" && secret.length > 0) {
        return secret;
      }
      const secretArn = env[secretArnKey];
      if (typeof secretArn === "string" && secretArn.length > 0) {
        if (!cachedArnSecretPromise) {
          cachedArnSecretPromise = Promise.resolve(fetchSecretFromArn(secretArn)).then((resolved) => {
            if (typeof resolved !== "string" || resolved.length === 0) {
              throw new AuthSecretError(`signing secret '${secretArnKey}' resolved to an empty value`);
            }
            return resolved;
          });
        }
        return cachedArnSecretPromise;
      }
      // Note: we reference the secret only by KEY NAME, never its value.
      throw new AuthSecretError(`signing secret '${key}' is not configured`);
    },
  });
}

// --- Default injectable seams ----------------------------------------------

/** Default signer seam: delegates to jsonwebtoken (HS256). */
export function defaultSigner(claims, secret) {
  // No `expiresIn` option: `iat`/`exp` are carried explicitly in `claims` so the
  // injected clock fully determines the token's time window (deterministic).
  return jwt.sign(claims, secret, { algorithm: JWT_ALGORITHM });
}

/** Default clock seam: wall-clock milliseconds since epoch. */
export function defaultClock() {
  return Date.now();
}

/** Default session-id generator seam. */
export function defaultIdGenerator() {
  return `sess_${randomUUID()}`;
}

// --- Core mint logic --------------------------------------------------------

/**
 * Mint a stateless HS256 Auth_Token.
 *
 * @param {object} params
 * @param {{ getSecret: () => Promise<string> | string }} params.secretProvider
 * @param {() => number} [params.clock]            ms-since-epoch clock seam
 * @param {(claims: object, secret: string) => string} [params.signer]
 * @param {() => string} [params.idGenerator]      session-id generator seam
 * @param {string} [params.sessionId]              explicit subject (overrides generator)
 * @param {string[]} [params.entitledRunIds]       initial entitlements (default [])
 * @param {unknown} [params.expiryWindowSeconds]   requested window (clamped per R15.8)
 * @returns {Promise<{
 *   token: string, subject: string, entitledRunIds: string[],
 *   iat: number, exp: number, expiresAt: string,
 *   expiryWindowSeconds: number, expiryWindowClamped: boolean,
 *   expiryWindowDefaulted: boolean
 * }>}
 */
export async function mintAuthToken({
  secretProvider,
  clock = defaultClock,
  signer = defaultSigner,
  idGenerator = defaultIdGenerator,
  sessionId,
  entitledRunIds = [],
  expiryWindowSeconds,
} = {}) {
  if (!secretProvider || typeof secretProvider.getSecret !== "function") {
    throw new AuthSecretError("a secret provider with getSecret() is required");
  }

  const subject = typeof sessionId === "string" && sessionId.length > 0
    ? sessionId
    : idGenerator();

  // Normalize entitlements to a de-duplicated array of strings. At mint time
  // this is initially empty (R15.4); it is populated as runs are created.
  const entitlements = Array.isArray(entitledRunIds)
    ? [...new Set(entitledRunIds.filter((id) => typeof id === "string" && id.length > 0))]
    : [];

  const window = resolveExpiryWindowSeconds(expiryWindowSeconds);
  const iat = Math.floor(clock() / 1000);
  const exp = iat + window.seconds;

  const claims = {
    sub: subject,
    entitledRunIds: entitlements,
    iat,
    exp,
  };

  // The secret lives only in this local — it is never logged nor returned.
  const secret = await secretProvider.getSecret();
  const token = signer(claims, secret);

  return {
    token,
    subject,
    entitledRunIds: entitlements,
    iat,
    exp,
    expiresAt: new Date(exp * 1000).toISOString(),
    expiryWindowSeconds: window.seconds,
    expiryWindowClamped: window.clamped,
    expiryWindowDefaulted: window.defaulted,
  };
}
