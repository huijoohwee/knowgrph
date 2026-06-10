// Tests for the `POST /run` schema validator + handler integration point
// (knowgrph-acos-mcp-connector spec, task 5.2 / R12.1 / design Agent_Api
// `POST /run` / Correctness Property 6).
//
// Covers every field at its boundaries:
//   referenceUrl : empty, non-absolute/relative, non-http scheme, exactly 2048
//                  ok, 2049 fail
//   brief        : empty fail, 1 ok, 10000 ok, 10001 fail
//   budgetUsd    : 0.00 fail, 0.01 ok, 999999999.99 ok, 1e9+ fail, non-number fail
//   approvals    : 0 ok, 100 ok, 101 fail, non-array fail
// plus: a fully valid payload → valid:true with no errors, and the handler
// integration point (valid → forwarding seam invoked; invalid → 400 naming each
// field with NO forward). The suite makes ZERO live network calls.

import test from "node:test";
import assert from "node:assert/strict";

import {
  validateRunRequest,
  REFERENCE_URL_MAX_LENGTH,
  BRIEF_MAX_LENGTH,
  BUDGET_USD_MIN,
  BUDGET_USD_MAX,
  APPROVALS_MAX_ENTRIES,
} from "../src/lib/run-request-schema.js";
import { createRunHandler } from "../src/handlers/run.js";

// --- Helpers ----------------------------------------------------------------

/** A minimal fully-valid request body; override individual fields per test. */
function validBody(overrides = {}) {
  return {
    referenceUrl: "https://example.com/reference-video",
    brief: "Remix this reference into a 30s vertical promo.",
    budgetUsd: 12.5,
    approvals: [],
    ...overrides,
  };
}

/** Build a syntactically valid absolute https URL of exactly `length` chars. */
function urlOfLength(length) {
  const prefix = "https://example.com/";
  assert.ok(length >= prefix.length, "requested length too small for a valid URL");
  return prefix + "a".repeat(length - prefix.length);
}

/** True iff `errors` contains at least one entry naming `field`. */
function hasFieldError(errors, field) {
  return errors.some((e) => e.field === field);
}

// --- Fully valid payload ----------------------------------------------------

test("a fully valid payload is valid with no errors", () => {
  const { valid, errors } = validateRunRequest(validBody());
  assert.equal(valid, true);
  assert.deepEqual(errors, []);
});

// --- referenceUrl boundaries ------------------------------------------------

test("referenceUrl: empty string fails", () => {
  const { valid, errors } = validateRunRequest(validBody({ referenceUrl: "" }));
  assert.equal(valid, false);
  assert.ok(hasFieldError(errors, "referenceUrl"));
});

test("referenceUrl: missing fails", () => {
  const body = validBody();
  delete body.referenceUrl;
  const { valid, errors } = validateRunRequest(body);
  assert.equal(valid, false);
  assert.ok(hasFieldError(errors, "referenceUrl"));
});

test("referenceUrl: a relative (non-absolute) URL fails", () => {
  const { valid, errors } = validateRunRequest(validBody({ referenceUrl: "/videos/abc" }));
  assert.equal(valid, false);
  assert.ok(hasFieldError(errors, "referenceUrl"));
});

test("referenceUrl: a non-http(s) scheme fails", () => {
  const { valid, errors } = validateRunRequest(validBody({ referenceUrl: "ftp://example.com/x" }));
  assert.equal(valid, false);
  assert.ok(hasFieldError(errors, "referenceUrl"));
});

test("referenceUrl: exactly 2048 characters is accepted", () => {
  const url = urlOfLength(REFERENCE_URL_MAX_LENGTH);
  assert.equal(url.length, 2048);
  const { valid, errors } = validateRunRequest(validBody({ referenceUrl: url }));
  assert.equal(valid, true, JSON.stringify(errors));
});

test("referenceUrl: 2049 characters fails", () => {
  const url = urlOfLength(REFERENCE_URL_MAX_LENGTH + 1);
  assert.equal(url.length, 2049);
  const { valid, errors } = validateRunRequest(validBody({ referenceUrl: url }));
  assert.equal(valid, false);
  assert.ok(hasFieldError(errors, "referenceUrl"));
});

// --- brief boundaries -------------------------------------------------------

test("brief: empty string fails", () => {
  const { valid, errors } = validateRunRequest(validBody({ brief: "" }));
  assert.equal(valid, false);
  assert.ok(hasFieldError(errors, "brief"));
});

test("brief: exactly 1 character is accepted", () => {
  const { valid, errors } = validateRunRequest(validBody({ brief: "x" }));
  assert.equal(valid, true, JSON.stringify(errors));
});

test("brief: exactly 10000 characters is accepted", () => {
  const { valid, errors } = validateRunRequest(validBody({ brief: "b".repeat(BRIEF_MAX_LENGTH) }));
  assert.equal(valid, true, JSON.stringify(errors));
});

test("brief: 10001 characters fails", () => {
  const { valid, errors } = validateRunRequest(
    validBody({ brief: "b".repeat(BRIEF_MAX_LENGTH + 1) }),
  );
  assert.equal(valid, false);
  assert.ok(hasFieldError(errors, "brief"));
});

// --- budgetUsd boundaries ---------------------------------------------------

test("budgetUsd: 0.00 fails (below minimum)", () => {
  const { valid, errors } = validateRunRequest(validBody({ budgetUsd: 0.0 }));
  assert.equal(valid, false);
  assert.ok(hasFieldError(errors, "budgetUsd"));
});

test("budgetUsd: 0.01 (minimum) is accepted", () => {
  const { valid, errors } = validateRunRequest(validBody({ budgetUsd: BUDGET_USD_MIN }));
  assert.equal(valid, true, JSON.stringify(errors));
});

test("budgetUsd: 999999999.99 (maximum) is accepted", () => {
  const { valid, errors } = validateRunRequest(validBody({ budgetUsd: BUDGET_USD_MAX }));
  assert.equal(valid, true, JSON.stringify(errors));
});

test("budgetUsd: 1e9+ (above maximum) fails", () => {
  const { valid, errors } = validateRunRequest(validBody({ budgetUsd: 1_000_000_000 }));
  assert.equal(valid, false);
  assert.ok(hasFieldError(errors, "budgetUsd"));
});

test("budgetUsd: a non-number fails", () => {
  for (const bad of ["10", true, null, NaN, Infinity, {}]) {
    const { valid, errors } = validateRunRequest(validBody({ budgetUsd: bad }));
    assert.equal(valid, false, `expected ${String(bad)} to fail`);
    assert.ok(hasFieldError(errors, "budgetUsd"));
  }
});

// --- approvals boundaries ---------------------------------------------------

test("approvals: 0 entries (empty array) is accepted", () => {
  const { valid, errors } = validateRunRequest(validBody({ approvals: [] }));
  assert.equal(valid, true, JSON.stringify(errors));
});

test("approvals: omitted is treated as empty and accepted", () => {
  const body = validBody();
  delete body.approvals;
  const { valid, errors } = validateRunRequest(body);
  assert.equal(valid, true, JSON.stringify(errors));
});

test("approvals: exactly 100 entries is accepted", () => {
  const approvals = Array.from({ length: APPROVALS_MAX_ENTRIES }, (_, i) => `gate-${i}`);
  const { valid, errors } = validateRunRequest(validBody({ approvals }));
  assert.equal(valid, true, JSON.stringify(errors));
});

test("approvals: 101 entries fails", () => {
  const approvals = Array.from({ length: APPROVALS_MAX_ENTRIES + 1 }, (_, i) => `gate-${i}`);
  const { valid, errors } = validateRunRequest(validBody({ approvals }));
  assert.equal(valid, false);
  assert.ok(hasFieldError(errors, "approvals"));
});

test("approvals: a non-array fails", () => {
  const { valid, errors } = validateRunRequest(validBody({ approvals: "consumer-repo-write" }));
  assert.equal(valid, false);
  assert.ok(hasFieldError(errors, "approvals"));
});

test("approvals: object entries with a non-empty gateId are accepted", () => {
  const { valid, errors } = validateRunRequest(
    validBody({ approvals: [{ gateId: "payment-action" }, "render-action"] }),
  );
  assert.equal(valid, true, JSON.stringify(errors));
});

test("approvals: a malformed entry names approvals[index]", () => {
  const { valid, errors } = validateRunRequest(validBody({ approvals: ["ok", {}, 42] }));
  assert.equal(valid, false);
  assert.ok(hasFieldError(errors, "approvals[1]"));
  assert.ok(hasFieldError(errors, "approvals[2]"));
});

// --- Multiple invalid fields are all named ----------------------------------

test("every invalid field is named in a single validation pass", () => {
  const { valid, errors } = validateRunRequest({
    referenceUrl: "",
    brief: "",
    budgetUsd: 0,
    approvals: "nope",
  });
  assert.equal(valid, false);
  assert.ok(hasFieldError(errors, "referenceUrl"));
  assert.ok(hasFieldError(errors, "brief"));
  assert.ok(hasFieldError(errors, "budgetUsd"));
  assert.ok(hasFieldError(errors, "approvals"));
});

test("a non-object body is rejected", () => {
  for (const bad of [null, undefined, "x", 5, []]) {
    const { valid, errors } = validateRunRequest(bad);
    assert.equal(valid, false, `expected ${String(bad)} to fail`);
    assert.ok(errors.length >= 1);
  }
});

// --- Handler integration point (Property 6 forwarding decision) -------------

test("handler: a valid request invokes the forwarding seam and does not 4xx", async () => {
  let forwarded = null;
  const handler = createRunHandler({
    onValidRequest: async ({ body }) => {
      forwarded = body;
      return { runId: "run-123", accepted: true };
    },
  });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  assert.equal(res.statusCode, 202);
  assert.ok(forwarded, "the forwarding seam was invoked for a valid request");
  assert.equal(JSON.parse(res.body).runId, "run-123");
});

test("handler: an invalid request returns 400 naming each field and does NOT forward", async () => {
  let forwarded = false;
  const handler = createRunHandler({
    onValidRequest: async () => {
      forwarded = true;
      return {};
    },
  });
  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ referenceUrl: "", brief: "", budgetUsd: 0 }),
  });
  assert.equal(res.statusCode, 400);
  assert.equal(forwarded, false, "no MCP call is forwarded on schema failure (R12.3)");
  const payload = JSON.parse(res.body);
  assert.equal(payload.error, "schema_validation_failed");
  const fields = payload.fields.map((f) => f.field);
  assert.ok(fields.includes("referenceUrl"));
  assert.ok(fields.includes("brief"));
  assert.ok(fields.includes("budgetUsd"));
  for (const f of payload.fields) {
    assert.equal(typeof f.reason, "string");
    assert.ok(f.reason.length > 0, "each error carries a human-readable reason");
  }
});

test("handler: a malformed JSON body returns 400 and does not forward", async () => {
  let forwarded = false;
  const handler = createRunHandler({ onValidRequest: async () => { forwarded = true; } });
  const res = await handler({ httpMethod: "POST", body: "{not json" });
  assert.equal(res.statusCode, 400);
  assert.equal(forwarded, false);
  assert.equal(JSON.parse(res.body).error, "invalid_request");
});

test("handler: a non-POST method is rejected with 405", async () => {
  const handler = createRunHandler();
  const res = await handler({ httpMethod: "GET" });
  assert.equal(res.statusCode, 405);
});
