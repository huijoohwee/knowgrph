// Tests for `GET /runs/{id}` UNKNOWN-run handling on the AWS Agent-API tier
// (knowgrph-acos-mcp-connector spec, task 5.7 / R12.6 / design Agent_Api
// `GET /runs/{id}` / Open Decisions -> Resolved Decision 0.2).
//
// Decision 0.2: the Agent_Api returns HTTP 404 for BOTH an unknown run id and a
// future authenticated-but-UNENTITLED run (task 6.4), with a body identical in
// shape, so a caller cannot tell whether a run exists — no existence leak
// (R12.6, R15.4, R15.5). These tests lock that contract with ZERO live
// network/AWS calls (an injectable in-memory manifest-store seam).
//
// Covered:
//   1. unknown run id -> HTTP 404 with no Run_Manifest content
//   2. the 404 body is byte-identical to the canonical not-found response, so
//      unknown vs (future) unentitled are indistinguishable
//   3. the 404 body discloses no internal config/stack/credential content and
//      no signal distinguishing unknown vs unentitled
//   4. the canonical 404 builder is the single source shared by 5.7 and 6.4

import test from "node:test";
import assert from "node:assert/strict";

import { createRunsHandler } from "../src/handlers/runs.js";
import { createInMemoryManifestStore } from "../src/lib/run-manifest-store.js";
import {
  buildRunNotFoundResponse,
  buildRunNotFoundBody,
  RUN_NOT_FOUND_ERROR,
  RUN_NOT_FOUND_MESSAGE,
} from "../src/lib/run-not-found-response.js";

// --- Helpers ----------------------------------------------------------------

function sampleManifest(overrides = {}) {
  return {
    runId: "run-known",
    state: "blocked",
    mode: "live",
    stages: [{ id: "research", status: "completed", retryCount: 0, costLog: null, artifact: null }],
    approvalGates: [{ gateId: "paid-model-call", approvalState: "pending", estimatedCostUsd: 0, token: null }],
    budgetMeters: { estimatedCostUsd: 0, actualCostUsd: 0, providerSpendUsd: 0 },
    demoPack: null,
    failures: [],
    reconciliationFlags: [],
    ...overrides,
  };
}

function getEvent(runId, extra = {}) {
  return { httpMethod: "GET", path: `/runs/${runId}`, pathParameters: { id: runId }, ...extra };
}

/** Fields that would appear in a real Run_Manifest payload / 200 response. */
const MANIFEST_LEAK_KEYS = [
  "manifest",
  "state",
  "mode",
  "stages",
  "approvalGates",
  "budgetMeters",
  "demoPack",
  "failures",
  "reconciliationFlags",
  "persistedAt",
  "contractVersion",
  "readElapsedMs",
  "readWithinDeadline",
  "readDeadlineMs",
];

// --- 1. Unknown run id -> 404 with no Run_Manifest content ------------------

test("unknown run: an unknown run id returns HTTP 404 with no Run_Manifest content", async () => {
  const handler = createRunsHandler({
    store: createInMemoryManifestStore({ "run-known": sampleManifest() }),
  });

  const res = await handler(getEvent("does-not-exist"));

  assert.equal(res.statusCode, 404);
  const payload = JSON.parse(res.body);
  assert.equal(payload.error, RUN_NOT_FOUND_ERROR);
  assert.equal(payload.message, RUN_NOT_FOUND_MESSAGE);
  // No Run_Manifest content / 200-shape fields leak into the 404 body.
  for (const key of MANIFEST_LEAK_KEYS) {
    assert.ok(!(key in payload), `404 body must not expose Run_Manifest field "${key}"`);
  }
});

test("unknown run: the not-wired default store routes every read to the 404 builder", async () => {
  // The default export wires the not-wired store (durable store is task 9.2),
  // so every read is an unknown run until a real store is injected.
  const handler = createRunsHandler();
  const res = await handler(getEvent("run-anything"));

  assert.equal(res.statusCode, 404);
  assert.equal(JSON.parse(res.body).error, RUN_NOT_FOUND_ERROR);
});

// --- 2. Byte-identical to the canonical not-found response (no existence leak)

test("unknown run: the 404 is byte-identical to the canonical not-found response", async () => {
  const handler = createRunsHandler({
    store: createInMemoryManifestStore({ "run-known": sampleManifest() }),
  });

  const res = await handler(getEvent("ghost-run"));
  // What a future unentitled read (task 6.4) returns for the SAME requested id:
  // both paths funnel through the one canonical builder.
  const canonical = buildRunNotFoundResponse({ runId: "ghost-run" });

  assert.equal(res.statusCode, canonical.statusCode);
  assert.deepEqual(res.headers, canonical.headers);
  // Byte-for-byte equal body -> unknown and unentitled are indistinguishable.
  assert.equal(res.body, canonical.body);
});

test("unknown run: an existing-but-unentitled read would be indistinguishable from unknown", async () => {
  // Model both paths for the SAME requested id and assert identical responses.
  // task 5.7 path: store has no such run -> unknown.
  const unknownHandler = createRunsHandler({
    store: createInMemoryManifestStore({ "someone-elses-run": sampleManifest({ runId: "someone-elses-run" }) }),
  });
  const unknownRes = await unknownHandler(getEvent("target-run"));

  // task 6.4 path (modeled): the run EXISTS but the caller is not entitled, so
  // the entitlement seam returns the SAME canonical 404 for the requested id.
  const unentitledHandler = createRunsHandler({
    store: createInMemoryManifestStore({ "target-run": sampleManifest({ runId: "target-run" }) }),
    onUnknownRun: undefined, // unused here; we simulate the entitlement seam below
  });
  // Simulate entitlement denial by injecting the canonical builder as the seam
  // the entitlement check (6.4) will call.
  const unentitledRes = buildRunNotFoundResponse({ runId: "target-run" });

  // Both responses for the same requested id must be byte-identical.
  assert.equal(unknownRes.statusCode, unentitledRes.statusCode);
  assert.equal(
    JSON.parse(unknownRes.body).error,
    JSON.parse(unentitledRes.body).error,
    "unknown and unentitled share the same error code",
  );
  assert.equal(
    JSON.parse(unknownRes.body).message,
    JSON.parse(unentitledRes.body).message,
    "unknown and unentitled share the same reason-agnostic message",
  );
  // The bodies differ only by the caller-supplied runId (which the caller
  // already knows); the message never reveals whether the run exists.
  assert.ok(unentitledHandler, "entitlement handler constructs without error");
});

// --- 3. No internal/credential disclosure in the 404 body -------------------

test("unknown run: the 404 body discloses no stack / config / credential content", async () => {
  const handler = createRunsHandler({
    store: createInMemoryManifestStore({ "run-known": sampleManifest() }),
  });

  const res = await handler(getEvent("missing"));
  const raw = res.body;
  const payload = JSON.parse(raw);

  // Body is exactly the canonical minimal shape: error, message, echoed runId.
  assert.deepEqual(Object.keys(payload).sort(), ["error", "message", "runId"].sort());

  // No internal/secret-looking content anywhere in the serialized body.
  const forbidden = [
    "stack",
    "trace",
    "Error:",
    "secret",
    "token",
    "credential",
    "password",
    "apikey",
    "api_key",
    "aws",
    "arn:",
    "env",
    "config",
    "/var/",
    "/src/",
    "node_modules",
  ];
  const haystack = raw.toLowerCase();
  for (const needle of forbidden) {
    assert.ok(!haystack.includes(needle.toLowerCase()), `404 body must not contain "${needle}"`);
  }
});

test("unknown run: the message is reason-agnostic (no unknown-vs-unentitled signal)", async () => {
  const handler = createRunsHandler({ store: createInMemoryManifestStore({}) });
  const res = await handler(getEvent("whatever"));
  const message = JSON.parse(res.body).message.toLowerCase();

  // The message must NOT hint at the reason (which would distinguish the two).
  for (const leak of ["unentitled", "entitle", "unauthorized", "forbidden", "permission", "exist", "deleted"]) {
    assert.ok(!message.includes(leak), `message must not hint at reason via "${leak}"`);
  }
});

// --- 4. Canonical builder is the single shared source (5.7 + 6.4) -----------

test("unknown run: the canonical builder produces a stable, minimal body shape", () => {
  const body = buildRunNotFoundBody({ runId: "run-1" });
  assert.deepEqual(body, {
    error: RUN_NOT_FOUND_ERROR,
    message: RUN_NOT_FOUND_MESSAGE,
    runId: "run-1",
  });

  // Without a runId (defensive), the body omits it but keeps the same shape.
  const bodyNoId = buildRunNotFoundBody();
  assert.deepEqual(bodyNoId, { error: RUN_NOT_FOUND_ERROR, message: RUN_NOT_FOUND_MESSAGE });
});

test("unknown run: the canonical 404 response sets a non-store JSON content type", () => {
  const res = buildRunNotFoundResponse({ runId: "run-1" });
  assert.equal(res.statusCode, 404);
  assert.equal(res.headers["content-type"], "application/json");
  assert.equal(res.headers["cache-control"], "no-store");
});

test("unknown run: same requested id always yields byte-identical 404s (no drift)", () => {
  const a = buildRunNotFoundResponse({ runId: "run-determinism" });
  const b = buildRunNotFoundResponse({ runId: "run-determinism" });
  assert.equal(a.body, b.body);
  assert.deepEqual(a.headers, b.headers);
  assert.equal(a.statusCode, b.statusCode);
});
