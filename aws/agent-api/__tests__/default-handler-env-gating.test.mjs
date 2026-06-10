// Tests for the env-gated default `POST /run` export
// (knowgrph-acos-mcp-connector runtime-readiness path / task 12.1 export swap).
//
// The default handler must FAIL CLOSED when no MCP endpoint/flag is configured
// (never an accidental live fetch) and go LIVE only when the env opts in. All
// network-free: a fake `fetch` stands in for the live transport.

import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

import { createDefaultRunHandler } from "../src/handlers/run.js";

const SECRET = "env-gating-test-secret";

function authedEvent() {
  const nowSec = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    { sub: "sess-eg", entitledRunIds: [], iat: nowSec, exp: nowSec + 3600 },
    SECRET,
    { algorithm: "HS256" },
  );
  return {
    httpMethod: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({
      referenceUrl: "https://example.com/ref",
      brief: "Remix into a short promo.",
      budgetUsd: 10,
      approvals: [],
    }),
  };
}

function jsonFetchResponse(body) {
  return {
    status: 200,
    headers: { get: (k) => (k.toLowerCase() === "content-type" ? "application/json" : null) },
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

test("default handler FAILS CLOSED (501) when no MCP endpoint/flag is set", async () => {
  let fetched = 0;
  const handler = createDefaultRunHandler({
    env: {}, // nothing configured
    fetchImpl: async () => {
      fetched += 1;
      return jsonFetchResponse({});
    },
    secretProvider: { getSecret: () => SECRET },
  });
  const res = await handler(authedEvent());
  assert.equal(res.statusCode, 501, "no live forward when un-configured");
  assert.equal(JSON.parse(res.body).error, "not_implemented");
  assert.equal(fetched, 0, "never makes an accidental live fetch");
});

test("default handler goes LIVE when MCP_ENDPOINT is set", async () => {
  let fetched = 0;
  const handler = createDefaultRunHandler({
    env: { MCP_ENDPOINT: "https://airvio.co/knowgrph/mcp" },
    fetchImpl: async () => {
      fetched += 1;
      return jsonFetchResponse({
        jsonrpc: "2.0",
        id: 1,
        result: { structuredContent: { runId: "run-eg", state: "blocked" } },
      });
    },
    secretProvider: { getSecret: () => SECRET },
  });
  const res = await handler(authedEvent());
  assert.equal(res.statusCode, 202, "live forward accepted");
  assert.equal(fetched, 1, "exactly one live forward");
  assert.equal(JSON.parse(res.body).result.structuredContent.runId, "run-eg");
});

test("default handler goes LIVE when AGENT_API_LIVE_FORWARDING flag is truthy", async () => {
  let fetched = 0;
  const handler = createDefaultRunHandler({
    env: { AGENT_API_LIVE_FORWARDING: "1" },
    fetchImpl: async () => {
      fetched += 1;
      return jsonFetchResponse({ jsonrpc: "2.0", id: 1, result: { structuredContent: {} } });
    },
    secretProvider: { getSecret: () => SECRET },
  });
  const res = await handler(authedEvent());
  assert.equal(res.statusCode, 202);
  assert.equal(fetched, 1);
});

test("env-gated live handler still enforces auth (401, no forward) on a missing token", async () => {
  let fetched = 0;
  const handler = createDefaultRunHandler({
    env: { MCP_ENDPOINT: "https://airvio.co/knowgrph/mcp" },
    fetchImpl: async () => {
      fetched += 1;
      return jsonFetchResponse({});
    },
    secretProvider: { getSecret: () => SECRET },
  });
  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ referenceUrl: "https://example.com/ref", brief: "x", budgetUsd: 1 }),
  });
  assert.equal(res.statusCode, 401);
  assert.equal(fetched, 0, "no live forward without a valid Auth_Token");
});
