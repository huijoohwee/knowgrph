// Tests for the `POST /run` schema-failure response
// (knowgrph-acos-mcp-connector spec, task 5.4 / R12.3 / design Agent_Api
// `POST /run` / Correctness Property 6; non-disclosure ties to task 5.10).
//
// R12.3: IF a `POST /run` request fails schema validation, THEN the Agent_Api
// SHALL return an HTTP 4xx response that names EACH invalid field and the reason
// it failed, and SHALL NOT forward any MCP call to the Mcp_Agent.
//
// This suite focuses on the SHAPE and SAFETY of the failure response (the field
// boundaries themselves live in run-request-schema.test.mjs). It proves:
//   1. the status is in the 4xx range (HTTP 400)
//   2. every distinct schema violation is named (field + non-empty reason)
//   3. a multi-field failure names ALL invalid fields, including approvals[index]
//   4. ZERO transport/forward calls occur on schema failure (spy transport)
//   5. the response body discloses no stack trace / internal config / credential
//      content (ties to task 5.10)
//
// The suite makes ZERO live network/AWS calls — the forwarding seam is a
// deterministic spy that records (and would fail the test if) it is ever called.

import test from "node:test";
import assert from "node:assert/strict";

import { createRunHandler, createForwardingRunHandler } from "../src/handlers/run.js";
import {
  REFERENCE_URL_MAX_LENGTH,
  BRIEF_MAX_LENGTH,
  APPROVALS_MAX_ENTRIES,
} from "../src/lib/run-request-schema.js";

// --- Helpers ----------------------------------------------------------------

/** A fully-valid `POST /run` body; override individual fields per test. */
function validBody(overrides = {}) {
  return {
    referenceUrl: "https://example.com/reference-video",
    brief: "Remix this reference into a 30s vertical promo.",
    budgetUsd: 12.5,
    approvals: [],
    ...overrides,
  };
}

/**
 * A forwarding spy that records every invocation. Used as the handler's
 * `onValidRequest` seam so any forward on a schema-failing request is observable
 * (and fails the test). Makes ZERO network calls.
 */
function forwardSpy() {
  const calls = [];
  const onValidRequest = async ({ body }) => {
    calls.push(body);
    return { runId: "should-not-happen", accepted: true };
  };
  return { onValidRequest, calls };
}

/** A transport spy for the wired forwarder; ZERO network calls. */
function transportSpy() {
  const calls = [];
  const transport = async (req) => {
    calls.push(req);
    return { jsonrpc: "2.0", id: req.body?.id ?? 1, result: { isError: false } };
  };
  return { transport, calls };
}

/** Invoke the handler with a JSON body over a POST event. */
async function postJson(handler, body) {
  return handler({ httpMethod: "POST", body: JSON.stringify(body) });
}

/** Collect the set of field names named in a failure response body. */
function namedFields(parsedBody) {
  assert.ok(Array.isArray(parsedBody.fields), "failure response carries a fields[] array");
  return parsedBody.fields.map((f) => f.field);
}

// --- 1. The failure status is in the 4xx range ------------------------------

test("schema failure returns an HTTP 4xx status (400)", async () => {
  const { onValidRequest } = forwardSpy();
  const handler = createRunHandler({ onValidRequest });
  const res = await postJson(handler, { brief: "" }); // missing/invalid fields

  assert.ok(res.statusCode >= 400 && res.statusCode < 500, `expected 4xx, got ${res.statusCode}`);
  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.body).error, "schema_validation_failed");
});

// --- 2. Every distinct violation is named with a non-empty reason -----------

test("every invalid field is named with a human-readable reason", async () => {
  const { onValidRequest } = forwardSpy();
  const handler = createRunHandler({ onValidRequest });

  const res = await postJson(handler, {
    referenceUrl: "ftp://example.com/x", // wrong scheme
    brief: "b".repeat(BRIEF_MAX_LENGTH + 1), // too long
    budgetUsd: 0, // below minimum
  });

  assert.equal(res.statusCode, 400);
  const payload = JSON.parse(res.body);
  const fields = namedFields(payload);
  assert.ok(fields.includes("referenceUrl"));
  assert.ok(fields.includes("brief"));
  assert.ok(fields.includes("budgetUsd"));
  // Each named field carries a non-empty reason string.
  for (const f of payload.fields) {
    assert.equal(typeof f.field, "string");
    assert.ok(f.field.length > 0, "each error names a field");
    assert.equal(typeof f.reason, "string");
    assert.ok(f.reason.length > 0, "each error carries a reason");
  }
});

// --- 3. A multi-field failure names ALL invalid fields ----------------------

test("a multi-field failure names every invalid field, including approvals[index]", async () => {
  const { onValidRequest } = forwardSpy();
  const handler = createRunHandler({ onValidRequest });

  const res = await postJson(handler, {
    referenceUrl: "", // empty
    brief: "", // empty
    budgetUsd: "not-a-number", // wrong type
    approvals: ["ok", {}, 42], // entries 1 and 2 malformed
  });

  assert.equal(res.statusCode, 400);
  const fields = namedFields(JSON.parse(res.body));
  for (const expected of ["referenceUrl", "brief", "budgetUsd", "approvals[1]", "approvals[2]"]) {
    assert.ok(fields.includes(expected), `failure response names ${expected}`);
  }
});

test("an all-fields-invalid payload names all four top-level fields at once", async () => {
  const { onValidRequest } = forwardSpy();
  const handler = createRunHandler({ onValidRequest });

  const res = await postJson(handler, {
    referenceUrl: "a".repeat(REFERENCE_URL_MAX_LENGTH + 1),
    brief: "b".repeat(BRIEF_MAX_LENGTH + 1),
    budgetUsd: 1_000_000_000,
    approvals: Array.from({ length: APPROVALS_MAX_ENTRIES + 1 }, (_, i) => `g-${i}`),
  });

  assert.equal(res.statusCode, 400);
  const fields = new Set(namedFields(JSON.parse(res.body)));
  for (const expected of ["referenceUrl", "brief", "budgetUsd", "approvals"]) {
    assert.ok(fields.has(expected), `failure response names ${expected}`);
  }
});

// --- 4. ZERO transport/forward calls on schema failure ----------------------

test("schema failure performs ZERO forward-seam invocations", async () => {
  const { onValidRequest, calls } = forwardSpy();
  const handler = createRunHandler({ onValidRequest });

  await postJson(handler, { referenceUrl: "", brief: "", budgetUsd: 0 });

  assert.equal(calls.length, 0, "no MCP call is forwarded on schema failure (R12.3)");
});

test("schema failure performs ZERO transport calls on the wired forwarder (spy transport)", async () => {
  const { transport, calls } = transportSpy();
  const handler = createForwardingRunHandler({ transport });

  const res = await postJson(handler, {
    referenceUrl: "not a url",
    brief: "",
    budgetUsd: -5,
    approvals: "nope",
  });

  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0, "the MCP Streamable HTTP transport is never touched on schema failure");
});

test("a non-object body is rejected with 4xx and never forwarded", async () => {
  const { transport, calls } = transportSpy();
  const handler = createForwardingRunHandler({ transport });

  // An array body is not a valid JSON object per the schema.
  const res = await handler({ httpMethod: "POST", body: JSON.stringify([1, 2, 3]) });

  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0);
  const payload = JSON.parse(res.body);
  assert.equal(payload.error, "schema_validation_failed");
  assert.ok(namedFields(payload).includes("body"));
});

// --- 5. The failure response discloses no stack / config / credential -------

/**
 * Tokens that would indicate an internal-detail leak in a client-facing error.
 * (Ties task 5.4's failure response to the non-disclosure rule of task 5.10.)
 */
const DISCLOSURE_TOKENS = [
  "at Object.", // V8 stack frame
  "at async", // async stack frame
  ".js:", // file:line reference
  "/src/", // internal source path
  "/var/task", // Lambda runtime path
  "node_modules",
  "Error:", // raw Error string
  "stack",
  "secret",
  "credential",
  "password",
  "token", // no auth/approval token material in a schema-failure body
  "aws_",
  "process.env",
  "API_KEY",
  "endpoint", // no internal MCP endpoint disclosure
  "airvio.co",
];

test("the schema-failure response body discloses no stack trace, internal config, or credential content", async () => {
  const { onValidRequest } = forwardSpy();
  const handler = createRunHandler({ onValidRequest });

  const res = await postJson(handler, {
    referenceUrl: "ftp://internal-host/x",
    brief: "",
    budgetUsd: 0,
    approvals: [{}],
  });

  assert.equal(res.statusCode, 400);
  const lower = res.body.toLowerCase();
  for (const tokenText of DISCLOSURE_TOKENS) {
    assert.ok(
      !lower.includes(tokenText.toLowerCase()),
      `failure body must not disclose "${tokenText}"; body=${res.body}`,
    );
  }
});

test("the failure response body is well-formed JSON with only safe top-level keys", async () => {
  const { onValidRequest } = forwardSpy();
  const handler = createRunHandler({ onValidRequest });

  const res = await postJson(handler, { referenceUrl: "", brief: "", budgetUsd: 0 });
  const payload = JSON.parse(res.body);

  // Only error / message / fields are exposed — no internal diagnostic keys.
  assert.deepEqual(new Set(Object.keys(payload)), new Set(["error", "message", "fields"]));
  // Each field entry exposes exactly { field, reason } — nothing else.
  for (const f of payload.fields) {
    assert.deepEqual(new Set(Object.keys(f)), new Set(["field", "reason"]));
  }
});

test("a malformed-JSON body returns 4xx, never forwards, and discloses no internals", async () => {
  const { transport, calls } = transportSpy();
  const handler = createForwardingRunHandler({ transport });

  const res = await handler({ httpMethod: "POST", body: "{not valid json" });

  assert.ok(res.statusCode >= 400 && res.statusCode < 500);
  assert.equal(calls.length, 0, "malformed JSON is never forwarded");
  const payload = JSON.parse(res.body);
  assert.equal(payload.error, "invalid_request");
  const lower = res.body.toLowerCase();
  for (const tokenText of ["stack", ".js:", "/src/", "node_modules", "at object."]) {
    assert.ok(!lower.includes(tokenText), `malformed-JSON error must not disclose "${tokenText}"`);
  }
});
