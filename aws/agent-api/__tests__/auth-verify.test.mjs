// Tests for Auth_Token verification + the `withAuth` middleware gate on
// `POST /run` and `GET /runs/{id}` (knowgrph-acos-mcp-connector spec, task 6.1 /
// R15.1 / R15.3 / design Auth_Token verification + Property 28).
//
// Property 28 (Agent_Api authentication rejection): for any request to
// `POST /run` or `GET /runs/{id}` carrying a missing, malformed,
// invalid-signature, or expired Auth_Token, the Agent_Api responds with HTTP
// 401, performs NO MCP forwarding, discloses NO Run_Manifest data, and returns
// an error that reveals neither credential contents nor internal config.
//
// Covers the focused behaviors the task calls out, all with ZERO live
// network/AWS calls (injected static secret provider + a fixed clock; test
// tokens are signed with the SAME secret):
//   1. valid Bearer token -> handler proceeds (forwards / reads)
//   2. missing token -> 401, no forward / no read
//   3. malformed token -> 401
//   4. bad-signature token (signed with the wrong secret) -> 401
//   5. expired token -> 401
//   6. every 401 body discloses no credential / config / Run_Manifest content
//   7. GET /health and POST /auth/session remain open (no auth)

import test from "node:test";
import assert from "node:assert/strict";

import jwt from "jsonwebtoken";

import { createAuthedRunHandler } from "../src/handlers/run.js";
import { createAuthedRunsHandler } from "../src/handlers/runs.js";
import { createHealthHandler } from "../src/handlers/health.js";
import { createAuthSessionHandler } from "../src/handlers/auth-session.js";
import {
  withAuth,
  verifyAuthToken,
  extractBearerToken,
  createAuthVerifier,
  buildUnauthorizedResponse,
  UNAUTHORIZED_ERROR,
} from "../src/lib/auth-verify.js";
import {
  createStaticSecretProvider,
  createEnvSecretProvider,
  JWT_ALGORITHM,
} from "../src/lib/auth-token.js";
import { createInMemoryManifestStore } from "../src/lib/run-manifest-store.js";

// --- Fixtures ---------------------------------------------------------------

const FIXED_NOW_MS = 1_700_000_000_000;
const FIXED_NOW_SEC = Math.floor(FIXED_NOW_MS / 1000);
const TEST_SECRET = "test-signing-secret-do-not-log";
const WRONG_SECRET = "a-different-secret-entirely";

const fixedClock = () => FIXED_NOW_MS;

/** Sign a valid HS256 Auth_Token with the given secret + claims. */
function signToken(secret = TEST_SECRET, overrides = {}) {
  const claims = {
    sub: "sess_caller_1",
    entitledRunIds: [],
    iat: FIXED_NOW_SEC,
    exp: FIXED_NOW_SEC + 3600,
    ...overrides,
  };
  return jwt.sign(claims, secret, { algorithm: JWT_ALGORITHM });
}

/** A valid `POST /run` body (passes the schema). */
function validRunBody() {
  return {
    referenceUrl: "https://example.com/reference.mp4",
    brief: "Make a 15-second remix highlighting the product.",
    budgetUsd: 25.0,
    approvals: [],
  };
}

function postRunEvent({ token, body = validRunBody() } = {}) {
  const event = { httpMethod: "POST", path: "/run", body: JSON.stringify(body), headers: {} };
  if (token !== undefined) event.headers.authorization = `Bearer ${token}`;
  return event;
}

function getRunsEvent(runId, { token } = {}) {
  const event = { httpMethod: "GET", path: `/runs/${runId}`, pathParameters: { id: runId }, headers: {} };
  if (token !== undefined) event.headers.authorization = `Bearer ${token}`;
  return event;
}

function sampleManifest(overrides = {}) {
  return {
    runId: "run-abc",
    state: "blocked",
    mode: "live",
    stages: [],
    approvalGates: [],
    budgetMeters: { estimatedCostUsd: 0, actualCostUsd: 0, providerSpendUsd: 0 },
    demoPack: null,
    failures: [],
    reconciliationFlags: [],
    ...overrides,
  };
}

/** Build an authed `POST /run` handler with a recording forwarding seam. */
function makeAuthedRun({ secret = TEST_SECRET } = {}) {
  const forwards = [];
  const handler = createAuthedRunHandler({
    secretProvider: createStaticSecretProvider(secret),
    clock: fixedClock,
    run: {
      onValidRequest: async ({ body }) => {
        forwards.push(body);
        return { accepted: true, runId: "run-new" };
      },
    },
  });
  return { handler, forwards };
}

/** Build an authed `GET /runs/{id}` handler with a recording store seam. */
function makeAuthedRuns({ secret = TEST_SECRET, seed = { "run-abc": sampleManifest() } } = {}) {
  const reads = [];
  const inner = createInMemoryManifestStore(seed);
  const handler = createAuthedRunsHandler({
    secretProvider: createStaticSecretProvider(secret),
    clock: fixedClock,
    runs: {
      store: {
        read(runId) {
          reads.push(runId);
          return inner.read(runId);
        },
      },
    },
  });
  return { handler, reads };
}

/** Assert a body discloses no credential / config / Run_Manifest content. */
function assertNonDisclosing(bodyText) {
  assert.equal(bodyText.includes(TEST_SECRET), false, "no signing secret in body");
  assert.equal(bodyText.includes(WRONG_SECRET), false, "no secret material in body");
  assert.equal(/AUTH_JWT_SECRET/.test(bodyText), false, "no secret key name in body");
  assert.equal(/stack|process\.env|node_modules|\/src\//i.test(bodyText), false, "no stack/config/path in body");
  // No Run_Manifest field leakage.
  for (const field of ["approvalGates", "budgetMeters", "stages", "demoPack", '"state"']) {
    assert.equal(bodyText.includes(field), false, `no Run_Manifest field '${field}' in body`);
  }
}

// === 1. Valid Bearer token -> handler proceeds ==============================

test("run: a valid Bearer token passes through and the MCP forward happens once", async () => {
  const { handler, forwards } = makeAuthedRun();
  const res = await handler(postRunEvent({ token: signToken() }));

  assert.equal(res.statusCode, 202, "valid token -> handler proceeds (forwards)");
  assert.equal(forwards.length, 1, "exactly one MCP forward for a valid token");
  assert.equal(JSON.parse(res.body).runId, "run-new");
});

test("runs: a valid Bearer token passes through and the manifest is read once", async () => {
  const { handler, reads } = makeAuthedRuns();
  // task 6.4: the authed runs handler now authorizes the read against the
  // caller's entitlements, so a pass-through to the 200 path requires a token
  // entitled to the run. The auth gate still admits the request and the store
  // is read exactly once.
  const res = await handler(
    getRunsEvent("run-abc", { token: signToken(TEST_SECRET, { entitledRunIds: ["run-abc"] }) }),
  );

  assert.equal(res.statusCode, 200, "valid + entitled token -> handler proceeds (reads)");
  assert.equal(reads.length, 1, "exactly one store read for a valid token");
  assert.deepEqual(reads, ["run-abc"]);
  assert.equal(JSON.parse(res.body).runId, "run-abc");
});

test("withAuth attaches the verified claims under event.auth for Caller_Identity (6.2 seam)", async () => {
  let seenAuth;
  const handler = withAuth((event) => {
    seenAuth = event.auth;
    return { statusCode: 200, headers: {}, body: "{}" };
  }, { secretProvider: createStaticSecretProvider(TEST_SECRET), clock: fixedClock });

  await handler(postRunEvent({ token: signToken(TEST_SECRET, { sub: "sess_xyz" }) }));
  assert.ok(seenAuth, "event.auth seam present on success");
  assert.equal(seenAuth.claims.sub, "sess_xyz");
});

// === 2. Missing token -> 401, no forward / no read ==========================

test("run: a missing Auth_Token returns 401 and performs NO MCP forward", async () => {
  const { handler, forwards } = makeAuthedRun();
  const res = await handler(postRunEvent()); // no token header at all

  assert.equal(res.statusCode, 401);
  assert.equal(JSON.parse(res.body).error, UNAUTHORIZED_ERROR);
  assert.equal(forwards.length, 0, "no forward on a missing token");
});

test("runs: a missing Auth_Token returns 401 and performs NO store read", async () => {
  const { handler, reads } = makeAuthedRuns();
  const res = await handler(getRunsEvent("run-abc")); // no token header

  assert.equal(res.statusCode, 401);
  assert.equal(reads.length, 0, "no manifest read on a missing token");
});

test("run: an empty Bearer value (no token) returns 401 with no forward", async () => {
  const { handler, forwards } = makeAuthedRun();
  const res = await handler({ httpMethod: "POST", path: "/run", headers: { authorization: "Bearer " }, body: JSON.stringify(validRunBody()) });
  assert.equal(res.statusCode, 401);
  assert.equal(forwards.length, 0);
});

// === 3. Malformed token -> 401 ==============================================

test("run: a malformed Auth_Token returns 401 and performs NO forward", async () => {
  const { handler, forwards } = makeAuthedRun();
  const res = await handler(postRunEvent({ token: "not-a-valid-jwt" }));
  assert.equal(res.statusCode, 401);
  assert.equal(forwards.length, 0);
});

test("runs: a malformed Authorization header (no Bearer scheme) returns 401, no read", async () => {
  const { handler, reads } = makeAuthedRuns();
  const res = await handler({ httpMethod: "GET", pathParameters: { id: "run-abc" }, headers: { authorization: signToken() } });
  assert.equal(res.statusCode, 401);
  assert.equal(reads.length, 0);
});

// === 4. Bad-signature token (wrong secret) -> 401 ===========================

test("run: a token signed with the WRONG secret returns 401 and performs NO forward", async () => {
  const { handler, forwards } = makeAuthedRun(); // server secret = TEST_SECRET
  const res = await handler(postRunEvent({ token: signToken(WRONG_SECRET) }));
  assert.equal(res.statusCode, 401);
  assert.equal(forwards.length, 0);
});

test("runs: a token signed with the WRONG secret returns 401 and performs NO read", async () => {
  const { handler, reads } = makeAuthedRuns();
  const res = await handler(getRunsEvent("run-abc", { token: signToken(WRONG_SECRET) }));
  assert.equal(res.statusCode, 401);
  assert.equal(reads.length, 0);
});

// === 5. Expired token -> 401 ================================================

test("run: an expired Auth_Token returns 401 and performs NO forward", async () => {
  const { handler, forwards } = makeAuthedRun();
  // exp is 10 minutes BEFORE the fixed clock instant.
  const expired = signToken(TEST_SECRET, { iat: FIXED_NOW_SEC - 7200, exp: FIXED_NOW_SEC - 600 });
  const res = await handler(postRunEvent({ token: expired }));
  assert.equal(res.statusCode, 401);
  assert.equal(forwards.length, 0);
});

test("runs: an expired Auth_Token returns 401 and performs NO read", async () => {
  const { handler, reads } = makeAuthedRuns();
  const expired = signToken(TEST_SECRET, { iat: FIXED_NOW_SEC - 7200, exp: FIXED_NOW_SEC - 600 });
  const res = await handler(getRunsEvent("run-abc", { token: expired }));
  assert.equal(res.statusCode, 401);
  assert.equal(reads.length, 0);
});

// === 6. All 401 bodies disclose nothing sensitive (Property 28) =============

test("every 401 body discloses no credential / config / Run_Manifest content", async () => {
  const { handler: runH } = makeAuthedRun();
  const { handler: runsH } = makeAuthedRuns();

  const cases = [
    await runH(postRunEvent()),                                   // missing
    await runH(postRunEvent({ token: "garbage" })),               // malformed
    await runH(postRunEvent({ token: signToken(WRONG_SECRET) })), // bad signature
    await runsH(getRunsEvent("run-abc")),                         // missing
    await runsH(getRunsEvent("run-abc", { token: "garbage" })),   // malformed
    await runsH(getRunsEvent("run-abc", { token: signToken(TEST_SECRET, { iat: FIXED_NOW_SEC - 7200, exp: FIXED_NOW_SEC - 600 }) })), // expired
  ];

  for (const res of cases) {
    assert.equal(res.statusCode, 401);
    const payload = JSON.parse(res.body);
    assert.equal(payload.error, UNAUTHORIZED_ERROR);
    // Reason-agnostic: the body never says WHY (no missing/expired/signature leak).
    assert.equal(/expired|signature|malformed|missing/i.test(payload.message), false);
    assertNonDisclosing(res.body);
  }
});

test("the canonical 401 sets a non-disclosing WWW-Authenticate challenge", () => {
  const res = buildUnauthorizedResponse();
  assert.equal(res.statusCode, 401);
  assert.equal(res.headers["www-authenticate"], "Bearer");
  assertNonDisclosing(res.body);
});

// === 7. GET /health and POST /auth/session remain OPEN ======================

test("GET /health stays open: HTTP 200 with NO Auth_Token", async () => {
  const health = createHealthHandler();
  const res = await health({ httpMethod: "GET" }); // no Authorization header
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).status, "ok");
});

test("POST /auth/session stays open: mints a token with NO Auth_Token", async () => {
  const session = createAuthSessionHandler({
    secretProvider: createStaticSecretProvider(TEST_SECRET),
    clock: fixedClock,
    idGenerator: () => "sess_open",
  });
  const res = await session({ httpMethod: "POST", body: JSON.stringify({}) }); // no Authorization
  assert.equal(res.statusCode, 201);
  assert.equal(typeof JSON.parse(res.body).token, "string");
});

// === Verifier unit coverage (injectable seams) ==============================

test("verifyAuthToken returns valid+claims for a good token and a reason otherwise", () => {
  const ok = verifyAuthToken({ token: signToken(), secret: TEST_SECRET, clock: fixedClock });
  assert.equal(ok.valid, true);
  assert.equal(ok.claims.sub, "sess_caller_1");

  assert.deepEqual(verifyAuthToken({ token: null, secret: TEST_SECRET, clock: fixedClock }), {
    valid: false,
    reason: "missing_token",
  });
  assert.equal(verifyAuthToken({ token: "not-a-jwt", secret: TEST_SECRET, clock: fixedClock }).reason, "malformed");
  assert.equal(verifyAuthToken({ token: "x.y.z", secret: TEST_SECRET, clock: fixedClock }).valid, false);
  assert.equal(verifyAuthToken({ token: signToken(WRONG_SECRET), secret: TEST_SECRET, clock: fixedClock }).reason, "invalid_signature");
  const expired = signToken(TEST_SECRET, { iat: FIXED_NOW_SEC - 7200, exp: FIXED_NOW_SEC - 600 });
  assert.equal(verifyAuthToken({ token: expired, secret: TEST_SECRET, clock: fixedClock }).reason, "expired");
});

test("verifyAuthToken pins HS256 so an alg:none token is rejected", () => {
  const noneToken = jwt.sign({ sub: "x", iat: FIXED_NOW_SEC, exp: FIXED_NOW_SEC + 3600 }, "", { algorithm: "none" });
  const result = verifyAuthToken({ token: noneToken, secret: TEST_SECRET, clock: fixedClock });
  assert.equal(result.valid, false);
});

test("extractBearerToken reads the token case-insensitively and across header shapes", () => {
  assert.equal(extractBearerToken({ headers: { Authorization: "Bearer abc.def.ghi" } }).token, "abc.def.ghi");
  assert.equal(extractBearerToken({ headers: { authorization: "bearer abc" } }).token, "abc");
  assert.equal(extractBearerToken({ multiValueHeaders: { Authorization: ["Bearer m.v.h"] } }).token, "m.v.h");
  assert.equal(extractBearerToken({ headers: {} }).token, null);
  assert.equal(extractBearerToken({ headers: { authorization: "Basic creds" } }).token, null);
});

test("createAuthVerifier maps an unavailable env secret to a thrown AuthSecretError", async () => {
  const verify = createAuthVerifier({ secretProvider: createEnvSecretProvider({}, "AUTH_JWT_SECRET"), clock: fixedClock });
  await assert.rejects(() => verify(postRunEvent({ token: signToken() })));
});

test("withAuth maps an unavailable signing secret to a non-disclosing 500 (not a 401)", async () => {
  const handler = withAuth(() => ({ statusCode: 200, headers: {}, body: "{}" }), {
    secretProvider: createEnvSecretProvider({}, "AUTH_JWT_SECRET"),
    clock: fixedClock,
  });
  const res = await handler(postRunEvent({ token: signToken() }));
  assert.equal(res.statusCode, 500);
  const payload = JSON.parse(res.body);
  assert.equal(payload.error, "auth_unavailable");
  assertNonDisclosing(res.body);
});
