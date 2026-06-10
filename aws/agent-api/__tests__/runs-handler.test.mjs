// Tests for `GET /runs/{id}` known-run handling on the AWS Agent-API tier
// (knowgrph-acos-mcp-connector spec, task 5.6 / R12.5 / design Agent_Api
// `GET /runs/{id}` / Data Models -> Run_Manifest).
//
// Covers the focused behaviors the task calls out, with ZERO live network/AWS
// calls (an injectable in-memory manifest-store seam stands in for the durable
// store wired in task 9.2):
//   1. a KNOWN run id -> HTTP 200 with the current Run_Manifest body
//   2. the 1,000 ms read-deadline metadata (R12.5)
//   3. an injected slow read beyond 1,000 ms is flagged past-deadline
//   4. GET method only (405 for others)
//   5. the manifest is read via the injectable store (zero live calls)

import test from "node:test";
import assert from "node:assert/strict";

import { createRunsHandler } from "../src/handlers/runs.js";
import {
  createInMemoryManifestStore,
  buildManifestRecord,
  RUN_MANIFEST_READ_DEADLINE_MS,
} from "../src/lib/run-manifest-store.js";

// --- Helpers ----------------------------------------------------------------

/** A representative Run_Manifest payload (design Data Models). */
function sampleManifest(overrides = {}) {
  return {
    runId: "run-abc",
    state: "blocked",
    mode: "live",
    stages: [
      { id: "research", status: "completed", retryCount: 0, costLog: null, artifact: null },
      { id: "storyboard", status: "approval_required", retryCount: 0, costLog: null, artifact: {} },
    ],
    approvalGates: [
      { gateId: "paid-model-call", approvalState: "pending", estimatedCostUsd: 0, token: null },
    ],
    budgetMeters: { estimatedCostUsd: 0, actualCostUsd: 0, providerSpendUsd: 0 },
    demoPack: null,
    failures: [],
    reconciliationFlags: [],
    ...overrides,
  };
}

/** An API-Gateway proxy GET event for `/runs/{id}`. */
function getEvent(runId, extra = {}) {
  return {
    httpMethod: "GET",
    path: `/runs/${runId}`,
    pathParameters: { id: runId },
    ...extra,
  };
}

/**
 * Wrap an in-memory store so every `read` is recorded — lets a test assert the
 * manifest is read through the injected seam and that ZERO live calls occur.
 */
function spyStore(seed) {
  const inner = createInMemoryManifestStore(seed);
  const reads = [];
  return {
    reads,
    store: {
      read(runId) {
        reads.push(runId);
        return inner.read(runId);
      },
    },
  };
}

// --- 1. Known run id -> 200 with the current Run_Manifest body --------------

test("runs: a known run id returns HTTP 200 with the current Run_Manifest body", async () => {
  const manifest = sampleManifest();
  const handler = createRunsHandler({
    store: createInMemoryManifestStore({ "run-abc": manifest }),
  });

  const res = await handler(getEvent("run-abc"));

  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  assert.equal(payload.runId, "run-abc");
  // The returned body carries the CURRENT Run_Manifest (R12.5).
  assert.deepEqual(payload.manifest, manifest);
  assert.equal(payload.manifest.state, "blocked");
  assert.equal(payload.manifest.approvalGates[0].gateId, "paid-model-call");
});

test("runs: a seeded persistence record echoes persistedAt and contractVersion", async () => {
  const record = buildManifestRecord(sampleManifest(), {
    runId: "run-xyz",
    persistedAt: "2024-01-01T00:00:00.000Z",
    contractVersion: "kgc-run-manifest/v1",
  });
  const handler = createRunsHandler({
    store: createInMemoryManifestStore({ "run-xyz": record }),
  });

  const res = await handler(getEvent("run-xyz"));
  const payload = JSON.parse(res.body);

  assert.equal(res.statusCode, 200);
  assert.equal(payload.persistedAt, "2024-01-01T00:00:00.000Z");
  assert.equal(payload.contractVersion, "kgc-run-manifest/v1");
});

// --- 2. 1,000 ms read-deadline metadata (R12.5) -----------------------------

test("runs: the read-deadline metadata is 1000ms and within-deadline by default", async () => {
  const handler = createRunsHandler({
    store: createInMemoryManifestStore({ "run-abc": sampleManifest() }),
  });

  const res = await handler(getEvent("run-abc"));
  const payload = JSON.parse(res.body);

  assert.equal(RUN_MANIFEST_READ_DEADLINE_MS, 1000, "R12.5 deadline is 1,000 ms");
  assert.equal(payload.readDeadlineMs, 1000);
  // Synchronous in-memory seam reads immediately -> within the window.
  assert.equal(payload.readElapsedMs, 0);
  assert.equal(payload.readWithinDeadline, true);
});

test("runs: a read exactly at the 1000ms deadline is still within-deadline", async () => {
  const handler = createRunsHandler({
    store: createInMemoryManifestStore({ "run-abc": sampleManifest() }),
    readElapsedMs: RUN_MANIFEST_READ_DEADLINE_MS,
  });

  const res = await handler(getEvent("run-abc"));
  const payload = JSON.parse(res.body);

  assert.equal(payload.readElapsedMs, 1000);
  assert.equal(payload.readWithinDeadline, true);
});

// --- 3. Injected slow read beyond 1,000 ms is flagged past-deadline ---------

test("runs: an injected slow read beyond 1000ms is flagged past-deadline", async () => {
  const handler = createRunsHandler({
    store: createInMemoryManifestStore({ "run-abc": sampleManifest() }),
    readElapsedMs: RUN_MANIFEST_READ_DEADLINE_MS + 1,
  });

  const res = await handler(getEvent("run-abc"));
  const payload = JSON.parse(res.body);

  // Still returns the manifest with 200, but flags past-deadline (R12.5).
  assert.equal(res.statusCode, 200);
  assert.equal(payload.readElapsedMs, 1001);
  assert.equal(payload.readWithinDeadline, false, "past the 1,000 ms deadline (R12.5)");
  assert.equal(payload.readDeadlineMs, 1000);
});

// --- 4. GET method only (405 for others) ------------------------------------

test("runs: a non-GET method returns HTTP 405 without reading the store", async () => {
  const { store, reads } = spyStore({ "run-abc": sampleManifest() });
  const handler = createRunsHandler({ store });

  for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
    const res = await handler(getEvent("run-abc", { httpMethod: method }));
    assert.equal(res.statusCode, 405, `${method} -> 405`);
    assert.equal(JSON.parse(res.body).error, "method_not_allowed");
  }
  assert.equal(reads.length, 0, "the store is never read for a disallowed method");
});

test("runs: a missing run id returns HTTP 400", async () => {
  const handler = createRunsHandler({
    store: createInMemoryManifestStore({ "run-abc": sampleManifest() }),
  });
  const res = await handler({ httpMethod: "GET", path: "/runs/", pathParameters: {} });
  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.body).error, "invalid_request");
});

// --- 5. Manifest read via the injectable store (zero live calls) ------------

test("runs: the manifest is read through the injectable store seam exactly once", async () => {
  const { store, reads } = spyStore({ "run-abc": sampleManifest() });
  const handler = createRunsHandler({ store });

  await handler(getEvent("run-abc"));

  assert.equal(reads.length, 1, "the store seam is read exactly once");
  assert.equal(reads[0], "run-abc");
});

test("runs: the handler resolves the run id from the API-Gateway path when no pathParameters", async () => {
  const { store, reads } = spyStore({ "run-from-path": sampleManifest({ runId: "run-from-path" }) });
  const handler = createRunsHandler({ store });

  // HTTP API (v2) shape: rawPath + requestContext.http.method, no pathParameters.id.
  const res = await handler({
    rawPath: "/runs/run-from-path",
    requestContext: { http: { method: "GET" } },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(reads[0], "run-from-path");
});

// --- Unknown-run seam (task 5.7 slots in here) ------------------------------

test("runs: an unknown run id routes through the default unknown-run seam (404)", async () => {
  // Task 5.6 implements the known-run happy path; the store returns `undefined`
  // for an unknown id and the handler routes it through the unknown-run seam
  // (refined by task 5.7). Asserted here to lock the seam contract.
  const handler = createRunsHandler({
    store: createInMemoryManifestStore({ "run-abc": sampleManifest() }),
  });

  const res = await handler(getEvent("does-not-exist"));

  assert.equal(res.statusCode, 404);
  assert.equal(JSON.parse(res.body).error, "run_not_found");
});

test("runs: the default (not-wired) store routes every read to the unknown-run seam", async () => {
  // The default handler export wires the not-wired store (durable store is
  // task 9.2), so every read surfaces the unknown-run 404 seam.
  const handler = createRunsHandler();
  const res = await handler(getEvent("run-abc"));
  assert.equal(res.statusCode, 404);
});
