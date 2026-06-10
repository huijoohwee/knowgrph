// Tests for non-disclosing (safe) error responses across ALL Agent-API
// endpoints (knowgrph-acos-mcp-connector spec, task 5.10 / R15.3, R15.6 /
// design Agent_Api secret handling + auth non-disclosure / Correctness
// Property 31).
//
// Covers, with ZERO live network/AWS calls (every fault is injected through a
// seam):
//   1. the shared safe-error helper strips/never includes a stack trace,
//      internal path, env/config value, or secret/token/credential content even
//      when handed an Error whose own message + stack embed such text
//   2. an UNEXPECTED thrown error in EACH of the four handlers (`POST /run`,
//      `GET /runs/{id}`, `GET /health`, `POST /auth/session`) collapses to a
//      generic, byte-stable HTTP 500 with no stack/config/credential content
//   3. the existing tagged 4xx/404/405/503 bodies remain non-disclosing
//   4. the server-side `onError` sink receives the ORIGINAL error (so it can be
//      logged) while NOTHING from it reaches the response body

import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSafeErrorResponse,
  buildSafeErrorBody,
  withSafeErrors,
  withSafeErrorsSync,
  INTERNAL_ERROR_CODE,
  INTERNAL_ERROR_MESSAGE,
} from "../src/lib/safe-error-response.js";

import { createRunHandler } from "../src/handlers/run.js";
import { createRunsHandler } from "../src/handlers/runs.js";
import { createHealthHandler } from "../src/handlers/health.js";
import { createAuthSessionHandler } from "../src/handlers/auth-session.js";
import { createStaticSecretProvider, AuthSecretError } from "../src/lib/auth-token.js";

// --- Helpers ----------------------------------------------------------------

/** A secret-like value that must NEVER appear in any response body. */
const LEAKY_SECRET = "SUPER_SECRET_SIGNING_KEY_value";
/** A token-like value that must NEVER appear in any response body. */
const LEAKY_TOKEN = "eyJhbGciOiJIUzI1NiJ9.LEAKED.payload";

/**
 * Build an Error whose message + stack + attached fields embed every kind of
 * content the safe response must withhold: a stack trace, an internal file
 * path, an env/config value, and secret/token material.
 */
function buildLeakyError() {
  const err = new Error(
    `db connect failed secret=${LEAKY_SECRET} token=${LEAKY_TOKEN} ` +
      `at /Users/dev/knowgrph/aws/agent-api/src/handlers/run.js:42`,
  );
  err.stack =
    `Error: db connect failed secret=${LEAKY_SECRET}\n` +
    "    at runHandler (/Users/dev/knowgrph/aws/agent-api/src/handlers/run.js:99:7)\n" +
    "    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)";
  err.config = { AUTH_JWT_SECRET: LEAKY_SECRET, endpoint: "https://internal.mcp.example" };
  return err;
}

/**
 * Markers that would signal a disclosure leak if found in any error body
 * (R15.3, R15.6): stack-trace fragments, internal paths, env/config keys, and
 * secret/token content. None of these may appear in a non-disclosing body.
 */
const FORBIDDEN_TOKENS = [
  LEAKY_SECRET,
  LEAKY_TOKEN,
  "AUTH_JWT_SECRET",
  "process.env",
  "node:internal",
  "/Users/",
  "src/handlers",
  ".js:",
  "    at ",
  "runHandler",
  "stack",
  "internal.mcp.example",
];

/** Assert a JSON body string discloses none of the forbidden markers. */
function assertNoForbiddenTokens(bodyText, label = "body") {
  for (const tok of FORBIDDEN_TOKENS) {
    assert.equal(
      bodyText.includes(tok),
      false,
      `${label} must not disclose "${tok}" — got: ${bodyText}`,
    );
  }
}

/** Assert a response is the canonical non-disclosing 500. */
function assertCanonicalSafe500(res, label = "response") {
  assert.equal(res.statusCode, 500, `${label}: status 500`);
  const payload = JSON.parse(res.body);
  assert.deepEqual(
    Object.keys(payload).sort(),
    ["error", "message"],
    `${label}: body has only error+message keys`,
  );
  assert.equal(payload.error, INTERNAL_ERROR_CODE);
  assert.equal(payload.message, INTERNAL_ERROR_MESSAGE);
  assertNoForbiddenTokens(res.body, label);
}

// --- 1. Shared helper strips all sensitive content --------------------------

test("safe-error: builder never includes stack/path/env/secret even from a leaky error", () => {
  const res = buildSafeErrorResponse({ error: buildLeakyError() });
  assertCanonicalSafe500(res, "buildSafeErrorResponse");
  assert.equal(res.headers["content-type"], "application/json");
  assert.equal(res.headers["cache-control"], "no-store");
});

test("safe-error: body is a fixed reason-agnostic shape", () => {
  assert.deepEqual(buildSafeErrorBody(), {
    error: INTERNAL_ERROR_CODE,
    message: INTERNAL_ERROR_MESSAGE,
  });
});

test("safe-error: withSafeErrors converts an async throw into a safe 500 and logs server-side", async () => {
  const leaky = buildLeakyError();
  const seen = [];
  const wrapped = withSafeErrors(
    async () => {
      throw leaky;
    },
    { onError: (e) => seen.push(e) },
  );

  const res = await wrapped({});
  assertCanonicalSafe500(res, "withSafeErrors");
  // The ORIGINAL error reaches the server-side sink (for logging)…
  assert.equal(seen.length, 1);
  assert.equal(seen[0], leaky);
  // …but NOTHING from it reached the response body.
  assertNoForbiddenTokens(res.body);
});

test("safe-error: a throwing onError sink never breaks or leaks into the safe 500", async () => {
  const wrapped = withSafeErrors(
    async () => {
      throw buildLeakyError();
    },
    {
      onError: () => {
        throw new Error("logging blew up");
      },
    },
  );
  const res = await wrapped({});
  assertCanonicalSafe500(res, "withSafeErrors+throwing sink");
});

test("safe-error: withSafeErrors passes a normal (non-throwing) response through unchanged", async () => {
  const ok = { statusCode: 200, headers: {}, body: JSON.stringify({ ok: true }) };
  const wrapped = withSafeErrors(async () => ok);
  assert.deepEqual(await wrapped({}), ok);
});

test("safe-error: withSafeErrorsSync preserves a synchronous return and converts a sync throw", () => {
  const ok = { statusCode: 200, headers: {}, body: "{}" };
  const passthrough = withSafeErrorsSync(() => ok);
  const result = passthrough({});
  // Synchronous: the result is the response object itself, NOT a promise.
  assert.equal(typeof result.then, "undefined");
  assert.deepEqual(result, ok);

  const thrower = withSafeErrorsSync(() => {
    throw buildLeakyError();
  });
  assertCanonicalSafe500(thrower({}), "withSafeErrorsSync");
});

// --- 2. Unexpected throw in EACH handler -> safe 500 ------------------------

const VALID_RUN_BODY = Object.freeze({
  referenceUrl: "https://example.com/reference-video",
  brief: "remix this into a 30s teaser",
  budgetUsd: 25,
});

test("run: an unexpected throw from the forwarding seam becomes a non-disclosing 500", async () => {
  const seen = [];
  const handler = createRunHandler({
    onValidRequest: () => {
      throw buildLeakyError();
    },
    onError: (e) => seen.push(e),
  });

  const res = await handler({ httpMethod: "POST", path: "/run", body: JSON.stringify(VALID_RUN_BODY) });
  assertCanonicalSafe500(res, "POST /run");
  assert.equal(seen.length, 1, "original error logged server-side");
});

test("runs: an unexpected throw from the store read becomes a non-disclosing 500", async () => {
  const handler = createRunsHandler({
    store: {
      read() {
        throw buildLeakyError();
      },
    },
  });

  const res = await handler({ httpMethod: "GET", pathParameters: { id: "run-123" } });
  assertCanonicalSafe500(res, "GET /runs/{id}");
});

test("health: an unexpected throw becomes a non-disclosing 500 (and stays synchronous)", () => {
  const handler = createHealthHandler();
  // Force an unexpected fault inside the handler via a throwing property getter.
  const evilEvent = {};
  Object.defineProperty(evilEvent, "httpMethod", {
    get() {
      throw buildLeakyError();
    },
  });

  const res = handler(evilEvent);
  // Health is synchronous — the wrapped handler must NOT return a promise.
  assert.equal(typeof res.then, "undefined");
  assertCanonicalSafe500(res, "GET /health");
});

test("auth-session: an unexpected signer throw becomes a non-disclosing 500", async () => {
  const handler = createAuthSessionHandler({
    secretProvider: createStaticSecretProvider("unit-test-secret"),
    signer: () => {
      // A generic (non-AuthSecretError) fault that embeds secret material.
      throw buildLeakyError();
    },
  });

  const res = await handler({ httpMethod: "POST", path: "/auth/session", body: "{}" });
  assertCanonicalSafe500(res, "POST /auth/session");
});

// --- 3. Existing tagged 4xx/404/405/503 bodies remain non-disclosing --------

test("run: tagged 400 (schema) / 405 / 503 bodies disclose no stack/config/credential content", async () => {
  // 400 — schema validation failure (names invalid fields, nothing sensitive).
  const schemaHandler = createRunHandler();
  const r400 = await schemaHandler({ httpMethod: "POST", path: "/run", body: JSON.stringify({}) });
  assert.equal(r400.statusCode, 400);
  assertNoForbiddenTokens(r400.body, "run 400");

  // 405 — wrong method.
  const r405 = await schemaHandler({ httpMethod: "DELETE", path: "/run" });
  assert.equal(r405.statusCode, 405);
  assertNoForbiddenTokens(r405.body, "run 405");

  // 503 — saturation (deny via an always-full limiter), still non-disclosing.
  const saturated = createRunHandler({
    onValidRequest: () => ({ accepted: true }),
    limiter: { tryAcquire: () => ({ admitted: false, retryAfterSeconds: 30 }) },
  });
  const r503 = await saturated({ httpMethod: "POST", path: "/run", body: JSON.stringify(VALID_RUN_BODY) });
  assert.equal(r503.statusCode, 503);
  assertNoForbiddenTokens(r503.body, "run 503");
});

test("runs: tagged 404 (unknown run) and 405 bodies disclose nothing sensitive", async () => {
  const handler = createRunsHandler(); // not-wired store -> every read undefined -> 404
  const r404 = await handler({ httpMethod: "GET", pathParameters: { id: "missing-run" } });
  assert.equal(r404.statusCode, 404);
  assertNoForbiddenTokens(r404.body, "runs 404");

  const r405 = await handler({ httpMethod: "POST", pathParameters: { id: "x" } });
  assert.equal(r405.statusCode, 405);
  assertNoForbiddenTokens(r405.body, "runs 405");
});

test("health: tagged 405 body discloses nothing sensitive and stays a 200 on the happy path", () => {
  const handler = createHealthHandler();
  const r405 = handler({ httpMethod: "POST", path: "/health" });
  assert.equal(r405.statusCode, 405);
  assertNoForbiddenTokens(r405.body, "health 405");

  const ok = handler({ httpMethod: "GET", path: "/health" });
  assert.equal(ok.statusCode, 200);
  assertNoForbiddenTokens(ok.body, "health 200");
});

test("auth-session: tagged 405 and handled 'auth_unavailable' 500 disclose no secret content", async () => {
  // 405 — wrong method.
  const handler = createAuthSessionHandler({
    secretProvider: createStaticSecretProvider("unit-test-secret"),
  });
  const r405 = await handler({ httpMethod: "GET", path: "/auth/session" });
  assert.equal(r405.statusCode, 405);
  assertNoForbiddenTokens(r405.body, "auth 405");

  // Handled 500 — secret provider unavailable. The body is a generic
  // auth_unavailable message that never echoes the missing secret key/value.
  const noSecret = createAuthSessionHandler({
    secretProvider: {
      getSecret() {
        // A real AuthSecretError that references the secret only by KEY NAME.
        throw new AuthSecretError(`signing secret '${"AUTH_JWT_SECRET"}' is not configured`);
      },
    },
  });
  const r500 = await noSecret({ httpMethod: "POST", path: "/auth/session", body: "{}" });
  // The handled auth_unavailable 500 must disclose no secret/stack/config content.
  assert.equal(r500.statusCode, 500);
  assert.equal(JSON.parse(r500.body).error, "auth_unavailable");
  assertNoForbiddenTokens(r500.body, "auth 500");
});
