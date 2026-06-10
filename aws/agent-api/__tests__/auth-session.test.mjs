// Tests for the `POST /auth/session` Lambda handler + Auth_Token mint logic
// (knowgrph-acos-mcp-connector spec, task 5.0 / R15.2 / R15.7 / R15.8 /
// Decision 0.1 / design Auth_Token + Property 30).
//
// Covers: a valid POST mints a verifiable HS256 JWT carrying `sub`, an empty
// `entitledRunIds`, `iat`, and `exp`; default expiry window is 3600s; an
// out-of-range expiry is clamped to [300, 86400]; the signing secret never
// appears in the response body or in logs; a token verifies with the same
// secret and fails verification with a wrong secret. All seams are injected so
// the suite makes ZERO live network calls.

import test from "node:test";
import assert from "node:assert/strict";

import jwt from "jsonwebtoken";

import { createAuthSessionHandler } from "../src/handlers/auth-session.js";
import {
  mintAuthToken,
  resolveExpiryWindowSeconds,
  createStaticSecretProvider,
  createEnvSecretProvider,
  AuthSecretError,
  DEFAULT_EXPIRY_WINDOW_SECONDS,
  MIN_EXPIRY_WINDOW_SECONDS,
  MAX_EXPIRY_WINDOW_SECONDS,
  JWT_ALGORITHM,
} from "../src/lib/auth-token.js";

const FIXED_NOW_MS = 1_700_000_000_000; // deterministic clock for the suite
const FIXED_NOW_SEC = Math.floor(FIXED_NOW_MS / 1000);
const TEST_SECRET = "test-signing-secret-do-not-log";
const WRONG_SECRET = "a-different-secret";

function makeHandler(overrides = {}) {
  return createAuthSessionHandler({
    secretProvider: createStaticSecretProvider(TEST_SECRET),
    clock: () => FIXED_NOW_MS,
    idGenerator: () => "sess_fixed_id",
    ...overrides,
  });
}

function postEvent(body) {
  return {
    httpMethod: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

// --- Valid POST mints a verifiable HS256 JWT (R15.2, R15.8, Property 30) -----

test("valid POST mints a verifiable HS256 JWT with sub, empty entitledRunIds, iat, exp", async () => {
  const handler = makeHandler();
  const res = await handler(postEvent({}));

  assert.equal(res.statusCode, 201);
  const payload = JSON.parse(res.body);

  assert.equal(typeof payload.token, "string");
  assert.ok(payload.token.length > 0, "a non-empty token is returned");
  assert.equal(payload.subject, "sess_fixed_id", "subject is the generated session id");
  assert.deepEqual(payload.entitledRunIds, [], "entitledRunIds starts empty (R15.4)");

  // The JWT verifies with the same secret and carries the expected claims.
  // `clockTimestamp` pins verification to the same deterministic instant the
  // token was minted at, so the suite is independent of wall-clock time.
  const decoded = jwt.verify(payload.token, TEST_SECRET, {
    algorithms: [JWT_ALGORITHM],
    clockTimestamp: FIXED_NOW_SEC,
  });
  assert.equal(decoded.sub, "sess_fixed_id");
  assert.deepEqual(decoded.entitledRunIds, []);
  assert.equal(decoded.iat, FIXED_NOW_SEC, "iat comes from the injected clock");
  assert.equal(decoded.exp, FIXED_NOW_SEC + DEFAULT_EXPIRY_WINDOW_SECONDS);
  assert.equal(payload.iat, decoded.iat);
  assert.equal(payload.exp, decoded.exp);
});

test("the minted JWT header advertises the HS256 algorithm", async () => {
  const handler = makeHandler();
  const res = await handler(postEvent({}));
  const { token } = JSON.parse(res.body);
  const [headerB64] = token.split(".");
  const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
  assert.equal(header.alg, "HS256");
  assert.equal(header.typ, "JWT");
});

// --- Default expiry window = 3600s (R15.8) ----------------------------------

test("default expiry window is 3600 seconds when unset", async () => {
  const handler = makeHandler();
  const res = await handler(postEvent({}));
  const payload = JSON.parse(res.body);
  assert.equal(payload.expiryWindowSeconds, 3600);
  assert.equal(payload.exp - payload.iat, 3600);
  assert.equal(payload.expiryWindowClamped, false);
});

test("an in-range expiry window is honored exactly", async () => {
  const handler = makeHandler();
  const res = await handler(postEvent({ expiryWindowSeconds: 900 }));
  const payload = JSON.parse(res.body);
  assert.equal(payload.expiryWindowSeconds, 900);
  assert.equal(payload.exp - payload.iat, 900);
  assert.equal(payload.expiryWindowClamped, false);
});

// --- Out-of-range expiry clamped to [300, 86400] (R15.8) --------------------

test("an expiry window below the minimum is clamped up to 300s", async () => {
  const handler = makeHandler();
  const res = await handler(postEvent({ expiryWindowSeconds: 5 }));
  const payload = JSON.parse(res.body);
  assert.equal(payload.expiryWindowSeconds, MIN_EXPIRY_WINDOW_SECONDS);
  assert.equal(payload.exp - payload.iat, 300);
  assert.equal(payload.expiryWindowClamped, true);
});

test("an expiry window above the maximum is clamped down to 86400s", async () => {
  const handler = makeHandler();
  const res = await handler(postEvent({ expiryWindowSeconds: 999_999 }));
  const payload = JSON.parse(res.body);
  assert.equal(payload.expiryWindowSeconds, MAX_EXPIRY_WINDOW_SECONDS);
  assert.equal(payload.exp - payload.iat, 86400);
  assert.equal(payload.expiryWindowClamped, true);
});

test("resolveExpiryWindowSeconds enforces the [300, 86400] bounds and 3600 default", () => {
  assert.deepEqual(resolveExpiryWindowSeconds(undefined), {
    seconds: 3600, clamped: false, defaulted: true,
  });
  assert.deepEqual(resolveExpiryWindowSeconds(null), {
    seconds: 3600, clamped: false, defaulted: true,
  });
  assert.deepEqual(resolveExpiryWindowSeconds("not-a-number"), {
    seconds: 3600, clamped: false, defaulted: true,
  });
  assert.equal(resolveExpiryWindowSeconds(299).seconds, MIN_EXPIRY_WINDOW_SECONDS);
  assert.equal(resolveExpiryWindowSeconds(300).seconds, 300);
  assert.equal(resolveExpiryWindowSeconds(86400).seconds, 86400);
  assert.equal(resolveExpiryWindowSeconds(86401).seconds, MAX_EXPIRY_WINDOW_SECONDS);
  // Boundary classification: exactly at the bounds is NOT clamped.
  assert.equal(resolveExpiryWindowSeconds(300).clamped, false);
  assert.equal(resolveExpiryWindowSeconds(86400).clamped, false);
});

// --- Token verifies with same secret, fails with wrong secret ---------------

test("token verifies with the same secret and fails verification with a wrong secret", async () => {
  const handler = makeHandler();
  const res = await handler(postEvent({}));
  const { token } = JSON.parse(res.body);

  // Same secret → verifies.
  const ok = jwt.verify(token, TEST_SECRET, {
    algorithms: [JWT_ALGORITHM],
    clockTimestamp: FIXED_NOW_SEC,
  });
  assert.equal(ok.sub, "sess_fixed_id");

  // Wrong secret → throws.
  assert.throws(
    () => jwt.verify(token, WRONG_SECRET, {
      algorithms: [JWT_ALGORITHM],
      clockTimestamp: FIXED_NOW_SEC,
    }),
    (err) => err && /signature/i.test(err.message),
  );
});

// --- Secret never appears in the response or logs (R15.7) -------------------

test("the signing secret never appears in the response body", async () => {
  const handler = makeHandler();
  const res = await handler(postEvent({ expiryWindowSeconds: 1200 }));
  assert.equal(res.body.includes(TEST_SECRET), false, "secret must not be in the body");
});

test("the signing secret is never written to console logs", async () => {
  const captured = [];
  const methods = ["log", "info", "warn", "error", "debug"];
  const originals = {};
  for (const m of methods) {
    originals[m] = console[m];
    console[m] = (...args) => {
      captured.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    };
  }
  try {
    const handler = makeHandler();
    await handler(postEvent({}));
  } finally {
    for (const m of methods) console[m] = originals[m];
  }
  const joined = captured.join("\n");
  assert.equal(joined.includes(TEST_SECRET), false, "secret must never be logged");
});

// --- Error / edge cases -----------------------------------------------------

test("a non-POST method is rejected with 405 and mints no token", async () => {
  const handler = makeHandler();
  const res = await handler({ httpMethod: "GET" });
  assert.equal(res.statusCode, 405);
  const payload = JSON.parse(res.body);
  assert.equal(payload.error, "method_not_allowed");
  assert.equal("token" in payload, false);
});

test("a malformed JSON body is rejected with 400 and mints no token", async () => {
  const handler = makeHandler();
  const res = await handler({ httpMethod: "POST", body: "{not json" });
  assert.equal(res.statusCode, 400);
  const payload = JSON.parse(res.body);
  assert.equal(payload.error, "invalid_request");
  assert.equal("token" in payload, false);
});

test("an absent body is treated as an empty request and mints a default token", async () => {
  const handler = makeHandler();
  const res = await handler({ httpMethod: "POST" });
  assert.equal(res.statusCode, 201);
  const payload = JSON.parse(res.body);
  assert.equal(payload.expiryWindowSeconds, 3600);
});

test("the v2 (HTTP API) event shape is supported and base64 bodies decode", async () => {
  const handler = makeHandler();
  const event = {
    requestContext: { http: { method: "POST" } },
    isBase64Encoded: true,
    body: Buffer.from(JSON.stringify({ expiryWindowSeconds: 600 }), "utf8").toString("base64"),
  };
  const res = await handler(event);
  assert.equal(res.statusCode, 201);
  assert.equal(JSON.parse(res.body).expiryWindowSeconds, 600);
});

test("an unavailable signing secret yields a non-disclosing 500", async () => {
  const handler = createAuthSessionHandler({
    secretProvider: createEnvSecretProvider({}, "AUTH_JWT_SECRET"),
    clock: () => FIXED_NOW_MS,
  });
  const res = await handler(postEvent({}));
  assert.equal(res.statusCode, 500);
  const payload = JSON.parse(res.body);
  assert.equal(payload.error, "auth_unavailable");
  assert.equal("token" in payload, false);
});

// --- mintAuthToken unit coverage (injectable seams) -------------------------

test("mintAuthToken uses an explicit sessionId and de-duplicates entitlements", async () => {
  const minted = await mintAuthToken({
    secretProvider: createStaticSecretProvider(TEST_SECRET),
    clock: () => FIXED_NOW_MS,
    sessionId: "sess_explicit",
    entitledRunIds: ["run-1", "run-1", "run-2", "", null],
  });
  assert.equal(minted.subject, "sess_explicit");
  assert.deepEqual(minted.entitledRunIds, ["run-1", "run-2"]);
  const decoded = jwt.verify(minted.token, TEST_SECRET, {
    algorithms: [JWT_ALGORITHM],
    clockTimestamp: FIXED_NOW_SEC,
  });
  assert.deepEqual(decoded.entitledRunIds, ["run-1", "run-2"]);
});

test("mintAuthToken requires a secret provider with getSecret()", async () => {
  await assert.rejects(
    () => mintAuthToken({ secretProvider: {} }),
    (err) => err instanceof AuthSecretError,
  );
});

test("an injectable signer seam receives the claims and server-side secret", async () => {
  let seenSecret = null;
  let seenClaims = null;
  const minted = await mintAuthToken({
    secretProvider: createStaticSecretProvider(TEST_SECRET),
    clock: () => FIXED_NOW_MS,
    idGenerator: () => "sess_seam",
    signer: (claims, secret) => {
      seenClaims = claims;
      seenSecret = secret;
      return "stub.jwt.token";
    },
  });
  assert.equal(minted.token, "stub.jwt.token");
  assert.equal(seenSecret, TEST_SECRET);
  assert.equal(seenClaims.sub, "sess_seam");
  assert.equal(seenClaims.iat, FIXED_NOW_SEC);
  assert.equal(seenClaims.exp, FIXED_NOW_SEC + DEFAULT_EXPIRY_WINDOW_SECONDS);
});

test("createStaticSecretProvider rejects an empty secret", () => {
  assert.throws(() => createStaticSecretProvider(""), (err) => err instanceof AuthSecretError);
});
