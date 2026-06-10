// Tests for `GET /health` on the AWS Agent-API tier
// (knowgrph-acos-mcp-connector spec, task 5.8 / R3.4, R15.6 / design Agent_Api
// `GET /health` / Correctness Property 31).
//
// Covers the focused behaviors the task calls out, with ZERO live network/AWS
// calls (the liveness check is timer-free; the elapsed signal is injected):
//   1. HTTP 200 when healthy
//   2. the 5,000 ms deadline metadata + a past-deadline flag for a slow check
//   3. the body carries ONLY liveness status — no Run_Manifest / credential /
//      config tokens (asserted against a forbidden-token list)
//   4. NO auth required — a request with no Auth_Token still returns 200
//   5. GET only (405 otherwise)

import test from "node:test";
import assert from "node:assert/strict";

import {
  createHealthHandler,
  handler as defaultHealthHandler,
  HEALTH_DEADLINE_MS,
  HEALTH_TRANSPORT,
} from "../src/handlers/health.js";

// --- Helpers ----------------------------------------------------------------

/** An API-Gateway proxy GET event for `/health` (no Auth_Token by default). */
function getEvent(extra = {}) {
  return { httpMethod: "GET", path: "/health", ...extra };
}

/**
 * Tokens that would signal a disclosure leak if they appeared anywhere in the
 * liveness response body (Property 31 / R15.6): Run_Manifest data, credentials,
 * or internal configuration. The body must contain NONE of these.
 */
const FORBIDDEN_TOKENS = [
  // Run_Manifest data
  "manifest",
  "runId",
  "stages",
  "approvalGates",
  "budgetMeters",
  "demoPack",
  // credentials / auth material
  "token",
  "auth",
  "authorization",
  "secret",
  "jwt",
  "signature",
  "credential",
  "password",
  "apiKey",
  "api_key",
  "bearer",
  // internal config / endpoint internals
  "env",
  "config",
  "endpoint",
  "mcp",
  "process",
  "AWS_",
  "arn:",
];

/** Assert a JSON body string discloses none of the forbidden tokens. */
function assertNoForbiddenTokens(bodyText) {
  const haystack = bodyText.toLowerCase();
  for (const tok of FORBIDDEN_TOKENS) {
    assert.equal(
      haystack.includes(tok.toLowerCase()),
      false,
      `liveness body must not disclose "${tok}" — got: ${bodyText}`,
    );
  }
}

// --- 1. HTTP 200 when healthy -----------------------------------------------

test("health: returns HTTP 200 with liveness 'ok' when healthy", () => {
  const handler = createHealthHandler();
  const res = handler(getEvent());

  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  assert.equal(payload.status, "ok");
  assert.equal(payload.transport, HEALTH_TRANSPORT);
  assert.equal(payload.checkWithinDeadline, true);
});

test("health: the default Lambda export answers 200 with no wiring", () => {
  const res = defaultHealthHandler(getEvent());
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).status, "ok");
});

// --- 2. 5,000 ms deadline metadata + past-deadline flag ---------------------

test("health: the deadline metadata is 5000ms and within-deadline by default", () => {
  const handler = createHealthHandler();
  const payload = JSON.parse(handler(getEvent()).body);

  assert.equal(HEALTH_DEADLINE_MS, 5000, "R3.4 deadline is 5,000 ms");
  assert.equal(payload.checkDeadlineMs, 5000);
  assert.equal(payload.checkElapsedMs, 0);
  assert.equal(payload.checkWithinDeadline, true);
});

test("health: a check exactly at the 5000ms deadline is still healthy", () => {
  const handler = createHealthHandler({ checkElapsedMs: HEALTH_DEADLINE_MS });
  const payload = JSON.parse(handler(getEvent()).body);

  assert.equal(payload.checkElapsedMs, 5000);
  assert.equal(payload.checkWithinDeadline, true);
  assert.equal(payload.status, "ok");
});

test("health: an injected slow check beyond 5000ms is flagged past-deadline", () => {
  const handler = createHealthHandler({ checkElapsedMs: HEALTH_DEADLINE_MS + 1 });
  const res = handler(getEvent());
  const payload = JSON.parse(res.body);

  // Still a 200 liveness response, but flags past-deadline (R3.4 pattern).
  assert.equal(res.statusCode, 200);
  assert.equal(payload.checkElapsedMs, 5001);
  assert.equal(payload.checkWithinDeadline, false, "past the 5,000 ms deadline (R3.4)");
  assert.equal(payload.checkDeadlineMs, 5000);
  assert.equal(payload.status, "degraded");
});

// --- 3. Body carries ONLY liveness status (no sensitive disclosure) ---------

test("health: the body discloses no Run_Manifest / credential / config tokens", () => {
  const handler = createHealthHandler();
  const res = handler(getEvent());

  assertNoForbiddenTokens(res.body);

  // The liveness body keys are restricted to the fixed non-sensitive set.
  const payload = JSON.parse(res.body);
  assert.deepEqual(
    Object.keys(payload).sort(),
    ["checkDeadlineMs", "checkElapsedMs", "checkWithinDeadline", "status", "transport"].sort(),
  );
});

test("health: even an event carrying tokens/manifest data leaks nothing into the body", () => {
  const handler = createHealthHandler();
  // A hostile/curious caller stuffs sensitive-looking material onto the event.
  const res = handler(
    getEvent({
      headers: { authorization: "Bearer super-secret-jwt", "x-api-key": "leak-me" },
      pathParameters: { runId: "run-should-not-appear" },
      body: JSON.stringify({ secret: "nope", manifest: { stages: [] } }),
    }),
  );

  assert.equal(res.statusCode, 200);
  assertNoForbiddenTokens(res.body);
});

// --- 4. NO auth required ------------------------------------------------------

test("health: no Auth_Token in the event still returns HTTP 200 (open probe)", () => {
  const handler = createHealthHandler();
  // No headers, no authorization, no token whatsoever.
  const res = handler({ httpMethod: "GET", rawPath: "/health" });

  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).status, "ok");
});

test("health: resolves via the HTTP API (v2) event shape without auth", () => {
  const handler = createHealthHandler();
  const res = handler({ rawPath: "/health", requestContext: { http: { method: "GET" } } });

  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).status, "ok");
});

// --- 5. GET only (405 otherwise) --------------------------------------------

test("health: a non-GET method returns HTTP 405", () => {
  const handler = createHealthHandler();
  for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
    const res = handler(getEvent({ httpMethod: method }));
    assert.equal(res.statusCode, 405, `${method} -> 405`);
    assert.equal(JSON.parse(res.body).error, "method_not_allowed");
  }
});
