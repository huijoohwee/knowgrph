import test from "node:test";
import assert from "node:assert/strict";

import jwt from "jsonwebtoken";

import { createLiveForwardingRunHandler } from "../src/handlers/run.js";
import { createAuthedRunsHandler } from "../src/handlers/runs.js";
import { createInMemoryManifestStore } from "../src/lib/run-manifest-store.js";

const SECRET = "run-persistence-secret";

function signToken({ sub = "sess_owner", entitledRunIds = [] } = {}) {
  const nowSec = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { sub, entitledRunIds, iat: nowSec, exp: nowSec + 3600 },
    SECRET,
    { algorithm: "HS256" },
  );
}

function validBody() {
  return {
    referenceUrl: "https://example.com/reference-video",
    brief: "Remix into a short promo.",
    budgetUsd: 10,
    approvals: [],
  };
}

function jsonFetchResponse(body) {
  return {
    status: 200,
    headers: { get: (key) => (String(key).toLowerCase() === "content-type" ? "application/json" : null) },
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

test("live run persistence: POST /run stores the returned manifest and same-session GET /runs/{id} reads it back", async () => {
  const store = createInMemoryManifestStore();
  const token = signToken({ sub: "sess_owner", entitledRunIds: [] });

  const runHandler = createLiveForwardingRunHandler({
    fetchImpl: async () =>
      jsonFetchResponse({
        jsonrpc: "2.0",
        id: 1,
        result: {
          structuredContent: {
            runId: "run-persisted",
            state: "blocked",
            mode: "live",
            stages: [],
            approvalGates: [],
            budgetMeters: { estimatedCostUsd: 0, actualCostUsd: 0, providerSpendUsd: 0 },
            demoPack: null,
            failures: [],
            reconciliationFlags: [],
          },
        },
      }),
    secretProvider: { getSecret: () => SECRET },
    endpoint: "https://airvio.co/knowgrph/mcp",
    manifestStore: store,
    clock: () => 1_700_000_000_000,
  });

  const runResponse = await runHandler({
    httpMethod: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(validBody()),
  });

  assert.equal(runResponse.statusCode, 202);
  const stored = await store.read("run-persisted");
  assert.equal(stored.runId, "run-persisted");
  assert.equal(stored.ownerPrincipalId, "sess_owner");
  assert.equal(stored.persistedAt, "2023-11-14T22:13:20.000Z");

  const runsHandler = createAuthedRunsHandler({
    secretProvider: { getSecret: () => SECRET },
    runs: { store },
    clock: () => 1_700_000_000_000,
  });

  const getResponse = await runsHandler({
    httpMethod: "GET",
    pathParameters: { id: "run-persisted" },
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(getResponse.statusCode, 200);
  const payload = JSON.parse(getResponse.body);
  assert.equal(payload.runId, "run-persisted");
  assert.equal(payload.manifest.runId, "run-persisted");
  assert.equal("ownerPrincipalId" in payload, false);
});
