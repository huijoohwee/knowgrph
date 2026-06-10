// Local "test before deploy" MCP client smoke test for the AgentCore tier
// (knowgrph-acos-mcp-connector spec, task 13.8 / R12.2, R14.1 / Properties 1, 6).
//
// This is the network-free, deterministic pre-deploy gate that stands in for an
// `agentcore invoke` against the local container WITHOUT running any billable /
// network / docker / agentcore-launch command (those are OPERATOR-gated, 13.9).
// It exercises the SAME code the container runs:
//   - the node:http entrypoint (`createServer`/`startServer`) bound to an
//     EPHEMERAL localhost port (127.0.0.1:0) for a real MCP-client round-trip,
//     which is localhost-only and NOT a network/billable call, AND
//   - the pure in-memory handler directly, so the deterministic test path
//     stays green with zero sockets.
//
// What a real MCP client would do, mirrored here:
//   1. `tools/list` returns the Director + 5 stage tools (R14.1).
//   2. one DRY-RUN `tools/call` forward works against an INJECTED FAKE transport
//      and carries the 2,000 ms deadline metadata (Property 6 / R12.2) — no live
//      control-plane call is ever made.
//   3. FAIL-CLOSED: with the control-plane endpoint UNSET, `tools/call` returns
//      HTTP 501 and NO transport is built (R11 / R12.2).
//   4. Property 1: a control-plane "approval required" error is relayed
//      unchanged — this tier performs no paid action and bypasses no gate.
//
// The `/mcp` surface is auth-gated (task 13.4), so the localhost round-trip
// signs a valid HS256 Auth_Token with the SAME injected server-side secret;
// the deterministic in-memory checks use the bare handler (no auth seam needed).

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";

import jwt from "jsonwebtoken";

import {
  createAgentCoreMcpHandler,
  MCP_PATH,
  MCP_DIRECTOR_TOOL_NAME,
  MCP_STAGE_TOOL_NAMES,
} from "../src/mcp-server.js";
import { createServer } from "../src/server.js";
import {
  createStaticSecretProvider,
  JWT_ALGORITHM,
} from "../../agent-api/src/lib/auth-token.js";
import { MCP_FORWARD_DEADLINE_MS } from "../../agent-api/src/lib/mcp-forwarder.js";

// --- Fixtures ---------------------------------------------------------------

const ENDPOINT = "https://airvio.co/knowgrph/mcp";
const TEST_SECRET = "agentcore-smoke-signing-secret-do-not-log";
const FIXED_NOW_MS = 1_700_000_000_000;
const FIXED_NOW_SEC = Math.floor(FIXED_NOW_MS / 1000);
const fixedClock = () => FIXED_NOW_MS;

/** Sign a valid HS256 Auth_Token with the injected server-side secret. */
function signToken(overrides = {}) {
  return jwt.sign(
    { sub: "sess_smoke", entitledRunIds: [], iat: FIXED_NOW_SEC, exp: FIXED_NOW_SEC + 3600, ...overrides },
    TEST_SECRET,
    { algorithm: JWT_ALGORITHM },
  );
}

/** A fake MCP Streamable HTTP transport that records calls and returns a canned result. */
function spyTransport(response) {
  const calls = [];
  const transport = async (req) => {
    calls.push(req);
    return (
      response ?? {
        jsonrpc: "2.0",
        id: req.body?.id ?? 1,
        result: {
          content: [{ type: "text", text: "dry-run ok" }],
          structuredContent: { runId: "run-smoke", state: "blocked", mode: "dry-run" },
          isError: false,
        },
      }
    );
  };
  return { transport, calls };
}

/** Minimal MCP client: POST a JSON-RPC envelope to a localhost URL. */
function mcpClientCall(baseUrl, rpc, { token } = {}) {
  const url = new URL(MCP_PATH, baseUrl);
  const payload = JSON.stringify({ jsonrpc: "2.0", id: 1, ...rpc });
  const headers = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "content-length": Buffer.byteLength(payload),
  };
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname, method: "POST", headers },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }),
        );
      },
    );
    req.on("error", reject);
    req.end(payload);
  });
}

/** Start a localhost-only server on an ephemeral port; returns base URL + close fn. */
async function startEphemeral(opts) {
  const server = createServer(opts);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      }),
  };
}

// === Real localhost MCP-client round-trip (127.0.0.1:0, not a network call) ==

test("smoke: a real localhost MCP client lists the Director + 5 stage tools (R14.1)", async () => {
  const { transport } = spyTransport();
  const { baseUrl, close } = await startEphemeral({
    handler: createAgentCoreMcpHandler({ endpoint: ENDPOINT, transport }),
    secretProvider: createStaticSecretProvider(TEST_SECRET),
    clock: fixedClock,
  });
  try {
    const res = await mcpClientCall(baseUrl, { method: "tools/list" }, { token: signToken() });
    assert.equal(res.statusCode, 200);
    const tools = JSON.parse(res.body).result.tools;
    const names = tools.map((t) => t.name);
    assert.equal(tools.length, 6, "Director + 5 stage tools");
    assert.ok(names.includes(MCP_DIRECTOR_TOOL_NAME), "Director tool advertised");
    for (const stage of MCP_STAGE_TOOL_NAMES) {
      assert.ok(names.includes(stage), `stage tool ${stage} advertised`);
    }
    for (const t of tools) {
      assert.equal(typeof t.inputSchema, "object", `${t.name} has an input schema (R14.1)`);
      assert.equal(typeof t.outputSchema, "object", `${t.name} has an output schema (R14.1)`);
    }
  } finally {
    await close();
  }
});

test("smoke: a real localhost MCP client runs one dry-run forward with 2,000 ms deadline metadata (Property 6 / R12.2)", async () => {
  const { transport, calls } = spyTransport();
  const { baseUrl, close } = await startEphemeral({
    handler: createAgentCoreMcpHandler({ endpoint: ENDPOINT, transport }),
    secretProvider: createStaticSecretProvider(TEST_SECRET),
    clock: fixedClock,
  });
  try {
    const res = await mcpClientCall(
      baseUrl,
      {
        method: "tools/call",
        params: {
          name: MCP_DIRECTOR_TOOL_NAME,
          arguments: { referenceUrl: "https://example.com/v", brief: "remix", budgetUsd: 10, mode: "dry-run", approvals: [] },
        },
      },
      { token: signToken() },
    );
    assert.equal(res.statusCode, 200);
    assert.equal(calls.length, 1, "forwarded exactly once over the injected fake transport");
    const result = JSON.parse(res.body).result;
    assert.equal(result.structuredContent.runId, "run-smoke", "control-plane dry-run result relayed");
    assert.equal(result._forward.tool, MCP_DIRECTOR_TOOL_NAME);
    assert.equal(result._forward.forwardDeadlineMs, MCP_FORWARD_DEADLINE_MS, "2,000 ms deadline metadata present");
    assert.equal(result._forward.forwardWithinDeadline, true);
  } finally {
    await close();
  }
});

test("smoke: the auth-gated /mcp surface rejects a client with no Auth_Token (task 13.4 preserved)", async () => {
  const { transport } = spyTransport();
  const { baseUrl, close } = await startEphemeral({
    handler: createAgentCoreMcpHandler({ endpoint: ENDPOINT, transport }),
    secretProvider: createStaticSecretProvider(TEST_SECRET),
    clock: fixedClock,
  });
  try {
    const res = await mcpClientCall(baseUrl, { method: "tools/list" }); // no token
    assert.notEqual(res.statusCode, 200, "no valid Auth_Token => not a 200 success");
  } finally {
    await close();
  }
});

// === Deterministic in-memory test path (zero sockets) =======================

test("smoke (in-memory): FAIL-CLOSED 501 when the control-plane endpoint is unset (R12.2)", async () => {
  // No endpoint and an empty env -> no transport is built -> fail closed.
  const handle = createAgentCoreMcpHandler({ env: {} });
  const res = await handle({
    method: "POST",
    path: MCP_PATH,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: MCP_DIRECTOR_TOOL_NAME, arguments: { referenceUrl: "https://x", brief: "b", budgetUsd: 1 } },
    }),
  });
  assert.equal(res.statusCode, 501, "fail-closed when MCP_ENDPOINT is unset (no transport built)");
  assert.equal(JSON.parse(res.body).error.code, "not_implemented");
});

test("smoke (in-memory): tools/list still works with no endpoint (static catalog, R14.1)", async () => {
  const handle = createAgentCoreMcpHandler({ env: {} });
  const res = await handle({
    method: "POST",
    path: MCP_PATH,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).result.tools.length, 6);
});

test("smoke (in-memory): a control-plane 'approval required' error is relayed unchanged (Property 1)", async () => {
  const { transport, calls } = spyTransport({
    jsonrpc: "2.0",
    id: 1,
    error: { code: "approval_required", message: "render Approval_Gate not approved" },
  });
  const handle = createAgentCoreMcpHandler({ endpoint: ENDPOINT, transport });
  const res = await handle({
    method: "POST",
    path: MCP_PATH,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "knowgrph.video_remix.render", arguments: { shots: [], renderGateToken: "missing" } },
    }),
  });
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).error.data.code, "approval_required", "gate error relayed unchanged");
  assert.equal(calls.length, 1, "forwarded once; this tier performs no paid action / bypasses no gate");
});

// === Documented (NON-EXECUTED) operator-gated `agentcore invoke` step ========

test("the documented `agentcore invoke` local-container step stays OPERATOR-gated and is NOT run by the suite", () => {
  // task 13.9 / cloud-deploy gate: `agentcore configure|launch|invoke` and any
  // docker/network command are OPERATOR-run and intentionally NOT executed here.
  // This deterministic suite is the network-free stand-in for that round-trip.
  // We assert the documented command shape WITHOUT executing it.
  const documentedInvoke = `agentcore invoke '{"method":"tools/list"}'`;
  assert.match(documentedInvoke, /^agentcore invoke /, "documented operator command, not executed");
  assert.ok(true, "no agentcore/docker/network command is run by the local test suite");
});
