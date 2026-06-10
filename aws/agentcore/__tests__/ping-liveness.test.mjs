// Tests for the AgentCore container `GET /ping` liveness endpoint
// (knowgrph-acos-mcp-connector spec, task 13.7 / R3.4, R15.6 / Property 31).
//
// Reconciled with the agent-api `GET /health` discipline (task 5.8): the probe
// is OPEN (no Auth_Token), returns HTTP 200 quickly when healthy, and discloses
// LIVENESS STATUS ONLY — no Run_Manifest data, no credentials, no internal
// config. All tests are deterministic and NETWORK-FREE: the handler is pure and
// the liveness deadline is modelled by an injectable elapsed signal, so no live
// MCP/AWS call is ever made.
//
// The endpoint is verified BOTH on the bare MCP handler (which serves `/ping`)
// AND through `createRoutedHandler`, asserting `/ping` bypasses the R15 inbound
// auth layer (task 13.4) while `/mcp` stays gated.

import test from "node:test";
import assert from "node:assert/strict";

import {
  createAgentCoreMcpHandler,
  PING_PATH,
  PING_DEADLINE_MS,
  MCP_PATH,
} from "../src/mcp-server.js";
import { createRoutedHandler } from "../src/server.js";

const ENDPOINT = "https://airvio.co/knowgrph/mcp";

/** Sensitive substrings that the liveness body must never disclose (Property 31). */
const FORBIDDEN_SUBSTRINGS = [
  ENDPOINT,
  "airvio.co",
  "MCP_ENDPOINT",
  "AUTH_JWT_SECRET",
  "secret",
  "token",
  "Bearer",
  "runId",
  "run-",
  "Run_Manifest",
  "manifest",
  "budget",
];

function assertNoDisclosure(body) {
  for (const needle of FORBIDDEN_SUBSTRINGS) {
    assert.ok(
      !body.toLowerCase().includes(needle.toLowerCase()),
      `liveness body must not disclose "${needle}" (Property 31 / R15.6)`,
    );
  }
}

// --- R3.4 / R15.6 / Property 31: GET /ping liveness -------------------------

test("GET /ping returns HTTP 200 with a healthy liveness status", async () => {
  const handle = createAgentCoreMcpHandler({ endpoint: ENDPOINT });
  const res = await handle({ method: "GET", path: PING_PATH, body: "" });

  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.status, "ok");
  assert.equal(body.checkWithinDeadline, true);
  assert.equal(body.checkDeadlineMs, PING_DEADLINE_MS);
});

test("GET /ping is OPEN: it succeeds with NO Authorization header / Auth_Token", async () => {
  // No endpoint, no env, no auth — the open liveness probe must still answer 200.
  const handle = createAgentCoreMcpHandler({ env: {} });
  const res = await handle({ method: "GET", path: PING_PATH, headers: {}, body: "" });
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).status, "ok");
});

test("GET /ping body discloses NOTHING sensitive (no manifest, credentials, or config)", async () => {
  const handle = createAgentCoreMcpHandler({ endpoint: ENDPOINT, env: { MCP_ENDPOINT: ENDPOINT } });
  const res = await handle({ method: "GET", path: PING_PATH, body: "" });

  assertNoDisclosure(res.body);
  // Body keys are constrained to the fixed liveness shape only.
  const keys = Object.keys(JSON.parse(res.body)).sort();
  assert.deepEqual(keys, ["checkDeadlineMs", "checkElapsedMs", "checkWithinDeadline", "status"]);
});

test("GET /ping returns 200 within the 5,000 ms structural deadline when healthy", async () => {
  const handle = createAgentCoreMcpHandler({ endpoint: ENDPOINT, pingCheckElapsedMs: PING_DEADLINE_MS });
  const res = await handle({ method: "GET", path: PING_PATH, body: "" });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.status, "ok", "at/under the deadline is healthy");
  assert.equal(body.checkWithinDeadline, true);
});

test("GET /ping flags 'degraded' past the deadline but still returns HTTP 200", async () => {
  const handle = createAgentCoreMcpHandler({ endpoint: ENDPOINT, pingCheckElapsedMs: PING_DEADLINE_MS + 1 });
  const res = await handle({ method: "GET", path: PING_PATH, body: "" });
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).status, "degraded");
});

test("a non-GET method on /ping returns 405 (liveness is GET-only)", async () => {
  const handle = createAgentCoreMcpHandler({ endpoint: ENDPOINT });
  const res = await handle({ method: "POST", path: PING_PATH, body: "{}" });
  assert.equal(res.statusCode, 405);
});

// --- Routing (task 13.4): /ping is open, /mcp stays auth-gated --------------

test("createRoutedHandler serves /ping OPEN (bypasses inbound auth) with HTTP 200", async () => {
  // A routed handler with a secret configured: /mcp would require a valid
  // Auth_Token, but /ping must bypass auth entirely.
  const routed = createRoutedHandler({
    secretProvider: { getSecret: () => "test-secret" },
  });
  const res = await routed({ method: "GET", path: PING_PATH, headers: {}, body: "" });
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).status, "ok");
  assertNoDisclosure(res.body);
});

test("createRoutedHandler keeps /mcp auth-gated (no token => not 200 liveness)", async () => {
  const routed = createRoutedHandler({
    secretProvider: { getSecret: () => "test-secret" },
  });
  // No Authorization header on the gated MCP surface — must NOT be a 200 success.
  const res = await routed({ method: "POST", path: MCP_PATH, headers: {}, body: "{}" });
  assert.notEqual(res.statusCode, 200, "/mcp without a valid Auth_Token is rejected (13.4 preserved)");
});
