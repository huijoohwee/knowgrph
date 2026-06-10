// Tests for the configurable Auth_Token expiry-WINDOW policy enforced at
// verification time (knowgrph-acos-mcp-connector spec, task 6.3 / R15.8 /
// design Property 30).
//
// Property 30 (Auth_Token expiry window bounds): for any configured expiry
// window, the Agent_Api treats an Auth_Token as expired EXACTLY when its
// issuance age (now - iat) exceeds the window; the effective window is always
// within [5 minutes, 24 hours] and defaults to 60 minutes when unset.
//
// The policy reuses the SAME mint-side clamp/default logic
// (`resolveExpiryWindowSeconds`) so issuance and enforcement agree. All tests
// make ZERO live network/AWS calls: a fixed clock + an injected static secret
// provider sign test tokens with the SAME secret.
//
// Focused behaviors covered:
//   1. default 60-min (3600s) window when unset
//   2. a configurable window is honored
//   3. the window is clamped to [300, 86400]
//   4. issuance age EXACTLY at the window -> valid (exact boundary)
//   5. issuance age one second past the window -> expired (401)
//   6. consistency with the token's own `exp`

import test from "node:test";
import assert from "node:assert/strict";

import jwt from "jsonwebtoken";

import {
  verifyAuthToken,
  createAuthVerifier,
  isWithinExpiryWindow,
  withAuth,
  WINDOW_EXPIRED_REASON,
  UNAUTHORIZED_ERROR,
} from "../src/lib/auth-verify.js";
import { createAuthedRunHandler } from "../src/handlers/run.js";
import { createAuthedRunsHandler } from "../src/handlers/runs.js";
import {
  createStaticSecretProvider,
  JWT_ALGORITHM,
  DEFAULT_EXPIRY_WINDOW_SECONDS,
  MIN_EXPIRY_WINDOW_SECONDS,
  MAX_EXPIRY_WINDOW_SECONDS,
} from "../src/lib/auth-token.js";
import { createInMemoryManifestStore } from "../src/lib/run-manifest-store.js";

// --- Fixtures ---------------------------------------------------------------

const FIXED_NOW_MS = 1_700_000_000_000;
const FIXED_NOW_SEC = Math.floor(FIXED_NOW_MS / 1000);
const TEST_SECRET = "test-signing-secret-do-not-log";

const fixedClock = () => FIXED_NOW_MS;

/**
 * Sign an HS256 token issued `ageSeconds` BEFORE the fixed clock instant, with
 * a far-future `exp` (so the token's own `exp` never trips) unless an override
 * is supplied. This isolates the WINDOW policy from the token's own `exp`.
 */
function signAged(ageSeconds, overrides = {}) {
  const iat = FIXED_NOW_SEC - ageSeconds;
  const claims = {
    sub: "sess_window",
    entitledRunIds: [],
    iat,
    exp: FIXED_NOW_SEC + MAX_EXPIRY_WINDOW_SECONDS, // far-future; window owns expiry
    ...overrides,
  };
  return jwt.sign(claims, TEST_SECRET, { algorithm: JWT_ALGORITHM });
}

function postRunEvent(token) {
  return {
    httpMethod: "POST",
    path: "/run",
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
    body: JSON.stringify({
      referenceUrl: "https://example.com/reference.mp4",
      brief: "Make a 15-second remix highlighting the product.",
      budgetUsd: 25.0,
      approvals: [],
    }),
  };
}

function getRunsEvent(runId, token) {
  return {
    httpMethod: "GET",
    path: `/runs/${runId}`,
    pathParameters: { id: runId },
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
  };
}

function sampleRecord() {
  return {
    "run-abc": {
      runId: "run-abc",
      manifest: { runId: "run-abc", state: "blocked" },
      persistedAt: FIXED_NOW_SEC,
      contractVersion: "v1",
    },
  };
}

/** Authed `POST /run` with a recording forward seam + a configurable window. */
function makeAuthedRun(expiryWindowSeconds) {
  const forwards = [];
  const handler = createAuthedRunHandler({
    secretProvider: createStaticSecretProvider(TEST_SECRET),
    clock: fixedClock,
    expiryWindowSeconds,
    run: {
      onValidRequest: async ({ body }) => {
        forwards.push(body);
        return { accepted: true, runId: "run-new" };
      },
    },
  });
  return { handler, forwards };
}

/** Authed `GET /runs/{id}` with a recording store seam + a configurable window. */
function makeAuthedRuns(expiryWindowSeconds) {
  const reads = [];
  const inner = createInMemoryManifestStore(sampleRecord());
  const handler = createAuthedRunsHandler({
    secretProvider: createStaticSecretProvider(TEST_SECRET),
    clock: fixedClock,
    expiryWindowSeconds,
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

// === 1. Default 60-minute (3600s) window when unset =========================

test("default window is 60 minutes (3600s) when expiryWindowSeconds is unset", () => {
  assert.equal(DEFAULT_EXPIRY_WINDOW_SECONDS, 3600, "default window is 60 minutes");

  // Age just under default -> valid; age just over default -> expired.
  const withinDefault = signAged(DEFAULT_EXPIRY_WINDOW_SECONDS - 1);
  const pastDefault = signAged(DEFAULT_EXPIRY_WINDOW_SECONDS + 1);

  assert.equal(
    verifyAuthToken({ token: withinDefault, secret: TEST_SECRET, clock: fixedClock }).valid,
    true,
    "age < default window is valid",
  );
  const past = verifyAuthToken({ token: pastDefault, secret: TEST_SECRET, clock: fixedClock });
  assert.equal(past.valid, false, "age > default window is expired");
  assert.equal(past.reason, WINDOW_EXPIRED_REASON);
});

test("the default window also applies through withAuth -> 401 with no forward", async () => {
  const { handler, forwards } = makeAuthedRun(undefined); // unset -> default 3600
  const res = await handler(postRunEvent(signAged(DEFAULT_EXPIRY_WINDOW_SECONDS + 60)));
  assert.equal(res.statusCode, 401);
  assert.equal(JSON.parse(res.body).error, UNAUTHORIZED_ERROR);
  assert.equal(forwards.length, 0, "no forward when the issuance age exceeds the window");
});

// === 2. A configurable window is honored ====================================

test("a configured window is honored (verifier level)", () => {
  const window = 600; // 10 minutes
  const verifier = createAuthVerifier({
    secretProvider: createStaticSecretProvider(TEST_SECRET),
    clock: fixedClock,
    expiryWindowSeconds: window,
  });

  // age 599s < 600 -> valid; age 601s > 600 -> expired. (Default 3600 would
  // have accepted both, proving the configured window is what's enforced.)
  return Promise.all([
    verifier(postRunEvent(signAged(window - 1))).then((r) => assert.equal(r.valid, true)),
    verifier(postRunEvent(signAged(window + 1))).then((r) => {
      assert.equal(r.valid, false);
      assert.equal(r.reason, WINDOW_EXPIRED_REASON);
    }),
  ]);
});

test("a configured window is honored end-to-end (401 + no manifest read)", async () => {
  const window = 600;
  const { handler, reads } = makeAuthedRuns(window);
  // age 1200s exceeds the 600s window even though the default 3600 would accept.
  const res = await handler(getRunsEvent("run-abc", signAged(1200)));
  assert.equal(res.statusCode, 401);
  assert.equal(reads.length, 0, "no manifest read when the issuance age exceeds the window");
});

// === 3. The window is clamped to [300, 86400] ===============================

test("a sub-minimum window is clamped up to 300s (5 minutes)", () => {
  // Request 60s; clamps to MIN 300s. A token aged 200s is within 300 -> valid;
  // a token aged 301s exceeds 300 -> expired. If 60 were honored, 200s would
  // have been expired, so this proves the clamp.
  const verifyWithin = verifyAuthToken({ token: signAged(200), secret: TEST_SECRET, clock: fixedClock, expiryWindowSeconds: 60 });
  const verifyPast = verifyAuthToken({ token: signAged(MIN_EXPIRY_WINDOW_SECONDS + 1), secret: TEST_SECRET, clock: fixedClock, expiryWindowSeconds: 60 });
  assert.equal(verifyWithin.valid, true, "aged 200s within clamped 300s window");
  assert.equal(verifyPast.valid, false, "aged 301s exceeds clamped 300s window");
  assert.equal(verifyPast.reason, WINDOW_EXPIRED_REASON);
});

test("a super-maximum window is clamped down to 86400s (24 hours)", () => {
  // Request 10 days; clamps to MAX 86400s. A token aged 86401s exceeds it.
  const past = verifyAuthToken({
    token: signAged(MAX_EXPIRY_WINDOW_SECONDS + 1, { exp: FIXED_NOW_SEC + 10 * MAX_EXPIRY_WINDOW_SECONDS }),
    secret: TEST_SECRET,
    clock: fixedClock,
    expiryWindowSeconds: 10 * 86400,
  });
  assert.equal(past.valid, false, "aged 86401s exceeds clamped 86400s window");
  assert.equal(past.reason, WINDOW_EXPIRED_REASON);

  const within = verifyAuthToken({
    token: signAged(MAX_EXPIRY_WINDOW_SECONDS - 1, { exp: FIXED_NOW_SEC + 10 * MAX_EXPIRY_WINDOW_SECONDS }),
    secret: TEST_SECRET,
    clock: fixedClock,
    expiryWindowSeconds: 10 * 86400,
  });
  assert.equal(within.valid, true, "aged 86399s within clamped 86400s window");
});

// === 4. Issuance age EXACTLY at the window -> valid (exact boundary) =========

test("issuance age exactly equal to the window is VALID (age == window)", () => {
  const window = 1800; // 30 minutes
  const exactly = verifyAuthToken({ token: signAged(window), secret: TEST_SECRET, clock: fixedClock, expiryWindowSeconds: window });
  assert.equal(exactly.valid, true, "age == window is still valid (exact boundary)");

  // Boundary also holds at the default window.
  const defaultExact = verifyAuthToken({ token: signAged(DEFAULT_EXPIRY_WINDOW_SECONDS), secret: TEST_SECRET, clock: fixedClock });
  assert.equal(defaultExact.valid, true, "age == default window is valid");
});

// === 5. Issuance age one second past the window -> expired (401) ============

test("issuance age one second past the window is EXPIRED (age > window) -> 401", async () => {
  const window = 1800;
  const result = verifyAuthToken({ token: signAged(window + 1), secret: TEST_SECRET, clock: fixedClock, expiryWindowSeconds: window });
  assert.equal(result.valid, false, "age one second past the window is expired");
  assert.equal(result.reason, WINDOW_EXPIRED_REASON);

  // End-to-end: a one-second-past token returns the canonical 401, no forward.
  const { handler, forwards } = makeAuthedRun(window);
  const res = await handler(postRunEvent(signAged(window + 1)));
  assert.equal(res.statusCode, 401);
  assert.equal(JSON.parse(res.body).error, UNAUTHORIZED_ERROR);
  assert.equal(forwards.length, 0);
});

// === 6. Consistency with the token's own `exp` ==============================

test("the token's own exp still expires a token even within the window", () => {
  // Token aged only 10s (well within any window) BUT its own exp is in the past
  // -> jwt.verify rejects on exp before the window check runs.
  const expiredByExp = jwt.sign(
    { sub: "s", iat: FIXED_NOW_SEC - 10, exp: FIXED_NOW_SEC - 5 },
    TEST_SECRET,
    { algorithm: JWT_ALGORITHM },
  );
  const result = verifyAuthToken({ token: expiredByExp, secret: TEST_SECRET, clock: fixedClock, expiryWindowSeconds: 3600 });
  assert.equal(result.valid, false, "token's own exp takes effect");
  assert.equal(result.reason, "expired", "exp rejection keeps its own reason, distinct from window");
});

test("the tighter of (exp, window) wins: window expires a token whose exp is still future", () => {
  // exp far in the future, but the issuance age exceeds the (small) window.
  const window = 600;
  const result = verifyAuthToken({
    token: signAged(window + 5, { exp: FIXED_NOW_SEC + 100000 }),
    secret: TEST_SECRET,
    clock: fixedClock,
    expiryWindowSeconds: window,
  });
  assert.equal(result.valid, false, "window expires the token even though exp is future");
  assert.equal(result.reason, WINDOW_EXPIRED_REASON);
});

// === isWithinExpiryWindow unit coverage (pure boundary logic) ===============

test("isWithinExpiryWindow resolves + clamps the window and computes the exact boundary", () => {
  // default when unset
  const def = isWithinExpiryWindow({ iat: FIXED_NOW_SEC }, FIXED_NOW_SEC, undefined);
  assert.equal(def.windowSeconds, DEFAULT_EXPIRY_WINDOW_SECONDS);
  assert.equal(def.ageSeconds, 0);
  assert.equal(def.expired, false);

  // clamp up / down
  assert.equal(isWithinExpiryWindow({ iat: FIXED_NOW_SEC }, FIXED_NOW_SEC, 1).windowSeconds, MIN_EXPIRY_WINDOW_SECONDS);
  assert.equal(isWithinExpiryWindow({ iat: FIXED_NOW_SEC }, FIXED_NOW_SEC, 10 ** 9).windowSeconds, MAX_EXPIRY_WINDOW_SECONDS);

  // exact boundary: age == window valid; age == window + 1 expired
  const w = 1000;
  assert.equal(isWithinExpiryWindow({ iat: FIXED_NOW_SEC - w }, FIXED_NOW_SEC, w).expired, false);
  assert.equal(isWithinExpiryWindow({ iat: FIXED_NOW_SEC - (w + 1) }, FIXED_NOW_SEC, w).expired, true);

  // no usable iat -> window check is skipped (defers to the token's own exp)
  const noIat = isWithinExpiryWindow({}, FIXED_NOW_SEC, 600);
  assert.equal(noIat.ageSeconds, null);
  assert.equal(noIat.expired, false);
});
