// Tests for `GET /runs/{id}` run-manifest AUTHORIZATION on the AWS Agent-API
// tier (knowgrph-acos-mcp-connector spec, task 6.4 / R15.4 / R15.5 / R12.6 /
// design Agent_Api `GET /runs/{id}` entitlement / Correctness Property 29 /
// Open Decisions -> Resolved Decision 0.2).
//
// Property 29 (cross-tenant run-manifest authorization): for any authenticated
// Caller_Identity, `GET /runs/{id}` returns the Run_Manifest IFF that identity
// is entitled to the run; for a run it is not entitled to (INCLUDING unknown
// runs) the response is HTTP 404 with NO Run_Manifest content and a recorded
// denied-access attempt, so no run data crosses tenant boundaries.
//
// All behaviors are exercised with ZERO live network/AWS calls: an injected
// static secret provider + a fixed clock sign test Auth_Tokens with the SAME
// secret, an in-memory manifest-store seam stands in for the durable store
// (task 9.2), and an in-memory audit sink captures denied-access records.
//
// Covered:
//   1. entitled caller + known run -> HTTP 200 with the current Run_Manifest
//   2. unentitled caller + existing run -> canonical 404, no manifest content,
//      denied-access recorded (reason `unentitled`)
//   3. unknown run -> canonical 404, denied-access recorded (reason
//      `unknown_run`)
//   4. the 404 bodies for unentitled vs unknown are BYTE-IDENTICAL (no
//      existence leak, Decision 0.2)
//   5. a missing Auth_Token still yields 401 before any entitlement check

import test from "node:test";
import assert from "node:assert/strict";

import jwt from "jsonwebtoken";

import { createAuthedRunsHandler, createRunsHandler } from "../src/handlers/runs.js";
import { createInMemoryManifestStore } from "../src/lib/run-manifest-store.js";
import { createStaticSecretProvider, JWT_ALGORITHM } from "../src/lib/auth-token.js";
import {
  buildRunNotFoundResponse,
  RUN_NOT_FOUND_ERROR,
} from "../src/lib/run-not-found-response.js";
import {
  createInMemoryAccessAuditSink,
  DENIED_REASON_UNKNOWN_RUN,
  DENIED_REASON_UNENTITLED,
} from "../src/lib/run-access-audit.js";

// --- Fixtures ---------------------------------------------------------------

const FIXED_NOW_MS = 1_700_000_000_000;
const FIXED_NOW_SEC = Math.floor(FIXED_NOW_MS / 1000);
const TEST_SECRET = "test-signing-secret-do-not-log";

const fixedClock = () => FIXED_NOW_MS;

/** Sign a valid HS256 Auth_Token carrying the given entitlements + subject. */
function signToken({ sub = "sess_caller_1", entitledRunIds = [] } = {}) {
  return jwt.sign(
    { sub, entitledRunIds, iat: FIXED_NOW_SEC, exp: FIXED_NOW_SEC + 3600 },
    TEST_SECRET,
    { algorithm: JWT_ALGORITHM },
  );
}

/** A representative Run_Manifest payload (design Data Models). */
function sampleManifest(overrides = {}) {
  return {
    runId: "run-abc",
    state: "blocked",
    mode: "live",
    stages: [
      { id: "research", status: "completed", retryCount: 0, costLog: null, artifact: null },
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

/** An authenticated API-Gateway GET event for `/runs/{id}`. */
function authedGetEvent(runId, token, extra = {}) {
  return {
    httpMethod: "GET",
    path: `/runs/${runId}`,
    pathParameters: { id: runId },
    headers: { authorization: `Bearer ${token}` },
    ...extra,
  };
}

/** Fields that would only appear in a real Run_Manifest 200 response. */
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

/** Build the authed handler with injected seams (no live network/AWS calls). */
function buildHandler({ seed = {}, audit } = {}) {
  return createAuthedRunsHandler({
    secretProvider: createStaticSecretProvider(TEST_SECRET),
    clock: fixedClock,
    recordDeniedAccess: audit,
    runs: { store: createInMemoryManifestStore(seed) },
  });
}

// --- 1. Entitled caller + known run -> 200 with the manifest ----------------

test("authz: an entitled caller reading a known run gets HTTP 200 with the manifest", async () => {
  const audit = createInMemoryAccessAuditSink();
  const handler = buildHandler({ seed: { "run-abc": sampleManifest() }, audit });
  const token = signToken({ sub: "sess_owner", entitledRunIds: ["run-abc"] });

  const res = await handler(authedGetEvent("run-abc", token));

  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  assert.equal(payload.runId, "run-abc");
  assert.deepEqual(payload.manifest, sampleManifest());
  // An authorized read records NO denied-access attempt.
  assert.equal(audit.entries.length, 0, "an entitled read records no denial");
});

test("authz: entitlement is scoped per-run — a caller entitled to one run cannot read another", async () => {
  const audit = createInMemoryAccessAuditSink();
  const handler = buildHandler({
    seed: { "run-a": sampleManifest({ runId: "run-a" }), "run-b": sampleManifest({ runId: "run-b" }) },
    audit,
  });
  const token = signToken({ sub: "sess_owner", entitledRunIds: ["run-a"] });

  const ok = await handler(authedGetEvent("run-a", token));
  assert.equal(ok.statusCode, 200);

  const denied = await handler(authedGetEvent("run-b", token));
  assert.equal(denied.statusCode, 404, "not entitled to run-b -> 404");
  assert.equal(audit.entries.length, 1);
  assert.equal(audit.entries[0].reason, DENIED_REASON_UNENTITLED);
  assert.equal(audit.entries[0].runId, "run-b");
});

// --- 2. Unentitled caller + existing run -> canonical 404, denial recorded --

test("authz: an unentitled caller reading an EXISTING run gets the canonical 404 with no manifest content", async () => {
  const audit = createInMemoryAccessAuditSink();
  const handler = buildHandler({
    seed: { "run-secret": sampleManifest({ runId: "run-secret", state: "completed" }) },
    audit,
  });
  // Caller is authenticated but NOT entitled to run-secret.
  const token = signToken({ sub: "sess_intruder", entitledRunIds: ["some-other-run"] });

  const res = await handler(authedGetEvent("run-secret", token));

  assert.equal(res.statusCode, 404);
  const payload = JSON.parse(res.body);
  assert.equal(payload.error, RUN_NOT_FOUND_ERROR);
  // No Run_Manifest content leaks into the 404 body.
  for (const key of MANIFEST_LEAK_KEYS) {
    assert.ok(!(key in payload), `404 body must not expose Run_Manifest field "${key}"`);
  }
  // The denied access attempt is recorded server-side (Property 29).
  assert.equal(audit.entries.length, 1);
  assert.deepEqual(audit.entries[0], {
    runId: "run-secret",
    principalId: "sess_intruder",
    reason: DENIED_REASON_UNENTITLED,
  });
});

// --- 3. Unknown run -> canonical 404, denial recorded -----------------------

test("authz: an unknown run gets the canonical 404 and records a denied-access attempt", async () => {
  const audit = createInMemoryAccessAuditSink();
  const handler = buildHandler({
    seed: { "run-known": sampleManifest({ runId: "run-known" }) },
    audit,
  });
  const token = signToken({ sub: "sess_caller", entitledRunIds: ["run-known"] });

  const res = await handler(authedGetEvent("ghost-run", token));

  assert.equal(res.statusCode, 404);
  assert.equal(JSON.parse(res.body).error, RUN_NOT_FOUND_ERROR);
  assert.equal(audit.entries.length, 1);
  assert.deepEqual(audit.entries[0], {
    runId: "ghost-run",
    principalId: "sess_caller",
    reason: DENIED_REASON_UNKNOWN_RUN,
  });
});

// --- 4. Unentitled vs unknown 404 bodies are byte-identical (no leak) -------

test("authz: the 404 for an unentitled existing run is BYTE-IDENTICAL to the 404 for an unknown run", async () => {
  const audit = createInMemoryAccessAuditSink();
  // Same requested id `target-run` in both worlds; only existence differs.
  const existsHandler = buildHandler({
    seed: { "target-run": sampleManifest({ runId: "target-run" }) },
    audit,
  });
  const unknownHandler = buildHandler({
    seed: { "someone-elses-run": sampleManifest({ runId: "someone-elses-run" }) },
    audit,
  });
  // The caller is entitled to neither requested id in each world.
  const token = signToken({ sub: "sess_caller", entitledRunIds: ["unrelated"] });

  const unentitledRes = await existsHandler(authedGetEvent("target-run", token));
  const unknownRes = await unknownHandler(authedGetEvent("target-run", token));

  // Byte-for-byte identical: status, headers, and body (Decision 0.2).
  assert.equal(unentitledRes.statusCode, unknownRes.statusCode);
  assert.deepEqual(unentitledRes.headers, unknownRes.headers);
  assert.equal(unentitledRes.body, unknownRes.body, "unentitled vs unknown 404 bodies must be byte-identical");

  // And both equal the canonical builder's output for the same requested id.
  const canonical = buildRunNotFoundResponse({ runId: "target-run" });
  assert.equal(unentitledRes.body, canonical.body);
  assert.equal(unknownRes.body, canonical.body);

  // The two cases recorded DIFFERENT reasons server-side, but that distinction
  // never reached the (identical) response bodies.
  const reasons = audit.entries.map((e) => e.reason).sort();
  assert.deepEqual(reasons, [DENIED_REASON_UNENTITLED, DENIED_REASON_UNKNOWN_RUN].sort());
});

// --- 5. Auth gate still precedes entitlement (missing token -> 401) ---------

test("authz: a missing Auth_Token yields 401 before any entitlement check or store read", async () => {
  const audit = createInMemoryAccessAuditSink();
  let reads = 0;
  const handler = createAuthedRunsHandler({
    secretProvider: createStaticSecretProvider(TEST_SECRET),
    clock: fixedClock,
    recordDeniedAccess: audit,
    runs: {
      store: {
        read(runId) {
          reads += 1;
          return runId === "run-abc" ? sampleManifest() : undefined;
        },
      },
    },
  });

  const res = await handler({ httpMethod: "GET", path: "/runs/run-abc", pathParameters: { id: "run-abc" } });

  assert.equal(res.statusCode, 401);
  assert.equal(reads, 0, "no store read occurs when auth fails");
  assert.equal(audit.entries.length, 0, "no denial recorded — the auth gate closed first");
});

// --- 6. The bare (unauthenticated) handler keeps task 5.6 behavior ----------

test("authz: a bare createRunsHandler (no entitlement) still returns 200 for a known run", async () => {
  // Local/unit affordance: without entitlement enforcement the handler keeps
  // its task 5.6 known-run behavior. In production it is always composed behind
  // withAuth via createAuthedRunsHandler, which turns entitlement on.
  const handler = createRunsHandler({
    store: createInMemoryManifestStore({ "run-abc": sampleManifest() }),
  });
  const res = await handler({ httpMethod: "GET", path: "/runs/run-abc", pathParameters: { id: "run-abc" } });
  assert.equal(res.statusCode, 200);
});
