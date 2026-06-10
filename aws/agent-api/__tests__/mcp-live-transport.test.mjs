// Tests for the LIVE MCP Streamable HTTP transport seam + real-elapsed timing
// (knowgrph-acos-mcp-connector runtime-readiness path, step 3 / R12.2).
//
// These exercise the drop-in `createFetchMcpTransport` and the real elapsed
// measurement in `createMcpForwarder({ measureElapsed: true })` with a FAKE
// `fetch` and a deterministic clock — ZERO live network calls. They prove the
// previously-inert forwarder spine now performs a real POST and parses both a
// JSON and an SSE (`text/event-stream`) JSON-RPC reply.

import test from "node:test";
import assert from "node:assert/strict";

import {
  createFetchMcpTransport,
  parseSseJsonRpc,
  createMcpForwarder,
  buildForwardHttpRequest,
  MCP_FORWARD_DEADLINE_MS,
  MCP_DIRECTOR_TOOL_NAME,
  McpForwardError,
} from "../src/lib/mcp-forwarder.js";
import { createLiveForwardingRunHandler } from "../src/handlers/run.js";

// --- fake fetch helpers (network-free) --------------------------------------

function jsonFetchResponse(body, { status = 200 } = {}) {
  return {
    status,
    headers: { get: (k) => (k.toLowerCase() === "content-type" ? "application/json" : null) },
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

function sseFetchResponse(frames, { status = 200 } = {}) {
  const text = frames.map((f) => `data: ${JSON.stringify(f)}`).join("\n\n") + "\n\n";
  return {
    status,
    headers: { get: (k) => (k.toLowerCase() === "content-type" ? "text/event-stream" : null) },
    async json() {
      throw new Error("SSE body is not JSON");
    },
    async text() {
      return text;
    },
  };
}

function validBody(overrides = {}) {
  return {
    referenceUrl: "https://example.com/reference-video",
    brief: "Remix this reference into a 30s vertical promo.",
    budgetUsd: 12.5,
    approvals: [],
    ...overrides,
  };
}

// --- SSE parsing -------------------------------------------------------------

test("parseSseJsonRpc: returns the last parseable data frame", () => {
  const text =
    "data: {\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"a\":1}}\n\n" +
    ": keep-alive comment\n\n" +
    "data: {\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"a\":2}}\n\n" +
    "data: [DONE]\n\n";
  const frame = parseSseJsonRpc(text);
  assert.equal(frame.result.a, 2);
});

test("parseSseJsonRpc: tolerates empty / non-string input", () => {
  assert.equal(parseSseJsonRpc(""), null);
  assert.equal(parseSseJsonRpc(undefined), null);
});

// --- live transport: JSON reply ---------------------------------------------

test("createFetchMcpTransport: performs one POST and returns the JSON-RPC body", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return jsonFetchResponse({
      jsonrpc: "2.0",
      id: 1,
      result: { structuredContent: { runId: "run-live", state: "blocked" } },
    });
  };
  const transport = createFetchMcpTransport({ fetchImpl });
  const req = buildForwardHttpRequest(validBody());

  const res = await transport(req);

  assert.equal(calls.length, 1, "exactly one live POST");
  assert.equal(calls[0].url, req.url);
  assert.equal(calls[0].init.method, "POST");
  assert.match(calls[0].init.headers.accept, /text\/event-stream/);
  assert.equal(typeof calls[0].init.body, "string", "body is serialized JSON");
  assert.equal(res.result.structuredContent.runId, "run-live");
});

// --- live transport: SSE reply ----------------------------------------------

test("createFetchMcpTransport: parses an SSE (text/event-stream) reply", async () => {
  const fetchImpl = async () =>
    sseFetchResponse([
      { jsonrpc: "2.0", id: 1, result: { structuredContent: { runId: "run-sse" } } },
    ]);
  const transport = createFetchMcpTransport({ fetchImpl });
  const res = await transport(buildForwardHttpRequest(validBody()));
  assert.equal(res.result.structuredContent.runId, "run-sse");
});

// --- live transport: non-2xx fails closed -----------------------------------

test("createFetchMcpTransport: a non-2xx response throws a tagged forward error", async () => {
  const fetchImpl = async () => jsonFetchResponse({ error: "boom" }, { status: 502 });
  const transport = createFetchMcpTransport({ fetchImpl });
  await assert.rejects(
    () => transport(buildForwardHttpRequest(validBody())),
    (err) => err instanceof McpForwardError && err.code === "mcp_forward_failed",
  );
});

test("createFetchMcpTransport: a network throw surfaces as mcp_forward_failed", async () => {
  const fetchImpl = async () => {
    throw new Error("ECONNREFUSED");
  };
  const transport = createFetchMcpTransport({ fetchImpl });
  await assert.rejects(
    () => transport(buildForwardHttpRequest(validBody())),
    (err) => err instanceof McpForwardError && err.code === "mcp_forward_failed",
  );
});

// --- real elapsed measurement (opt-in) --------------------------------------

test("createMcpForwarder: measureElapsed records REAL transport latency vs the 2000ms deadline", async () => {
  let now = 1000;
  const clock = () => now;
  const transport = async () => {
    now += 1500; // simulate 1.5s of live forward latency
    return { jsonrpc: "2.0", id: 1, result: { structuredContent: {} } };
  };
  const forward = createMcpForwarder({ transport, measureElapsed: true, clock });

  const result = await forward({ body: validBody() });

  assert.equal(result.forwardElapsedMs, 1500, "measured the real elapsed");
  assert.equal(result.forwardWithinDeadline, true);
  assert.equal(result.forwardDeadlineMs, MCP_FORWARD_DEADLINE_MS);
});

test("createMcpForwarder: measured latency beyond 2000ms is flagged past-deadline", async () => {
  let now = 0;
  const clock = () => now;
  const transport = async () => {
    now += 2500;
    return { jsonrpc: "2.0", id: 1, result: {} };
  };
  const forward = createMcpForwarder({ transport, measureElapsed: true, clock });
  const result = await forward({ body: validBody() });
  assert.equal(result.forwardElapsedMs, 2500);
  assert.equal(result.forwardWithinDeadline, false);
});

// --- live forwarding handler end-to-end (auth + live transport, fake fetch) -

test("createLiveForwardingRunHandler: authed valid request forwards live and returns 202", async () => {
  const secret = "test-signing-secret";
  const secretProvider = { getSecret: () => secret };

  // Mint a valid Auth_Token with the same secret the verifier will use.
  const jwt = (await import("jsonwebtoken")).default;
  const nowSec = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    { sub: "session-1", entitledRunIds: [], iat: nowSec, exp: nowSec + 3600 },
    secret,
    { algorithm: "HS256" },
  );

  let posted = 0;
  const fetchImpl = async () => {
    posted += 1;
    return jsonFetchResponse({
      jsonrpc: "2.0",
      id: 1,
      result: { structuredContent: { runId: "run-live", state: "blocked" } },
    });
  };

  const handler = createLiveForwardingRunHandler({
    fetchImpl,
    secretProvider,
    endpoint: "https://airvio.co/knowgrph/mcp",
  });

  const res = await handler({
    httpMethod: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(validBody()),
  });

  assert.equal(res.statusCode, 202, "live forward accepted");
  assert.equal(posted, 1, "exactly one live POST to the control plane");
  const payload = JSON.parse(res.body);
  assert.equal(payload.forwarded, true);
  assert.equal(payload.tool, MCP_DIRECTOR_TOOL_NAME);
  assert.equal(payload.result.structuredContent.runId, "run-live");
});

test("createLiveForwardingRunHandler: a missing Auth_Token returns 401 and never forwards", async () => {
  let posted = 0;
  const fetchImpl = async () => {
    posted += 1;
    return jsonFetchResponse({});
  };
  const handler = createLiveForwardingRunHandler({
    fetchImpl,
    secretProvider: { getSecret: () => "s" },
  });
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  assert.equal(res.statusCode, 401);
  assert.equal(posted, 0, "no live forward without a valid Auth_Token (R15.1)");
});
