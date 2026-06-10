// Tests for MCP Streamable HTTP forwarding to the McpAgent
// (knowgrph-acos-mcp-connector spec, task 5.3 / R12.2 / design Agent_Api
// `POST /run` / Correctness Property 6).
//
// Covers the four focused behaviors the task calls out, with ZERO live
// network/AWS calls (an injectable transport seam stands in for the live
// `fetch` to airvio.co/knowgrph/mcp, wired in task 9.2):
//   1. a schema-passing request forwards EXACTLY ONCE via the injectable transport
//   2. the forwarding deadline metadata == 2,000 ms (R12.2)
//   3. an injected slow forward beyond 2,000 ms is flagged past-deadline
//   4. a schema-failing request does NOT forward (no transport call)
// plus the forwarded JSON-RPC envelope shape mirrors the control-plane worker.

import test from "node:test";
import assert from "node:assert/strict";

import {
  createMcpForwarder,
  buildForwardHttpRequest,
  buildVideoRemixRunRequest,
  MCP_FORWARD_DEADLINE_MS,
  MCP_DIRECTOR_TOOL_NAME,
  MCP_DEFAULT_ENDPOINT,
  MCP_TRANSPORT,
} from "../src/lib/mcp-forwarder.js";
import { createRunHandler, createForwardingRunHandler } from "../src/handlers/run.js";

// --- Helpers ----------------------------------------------------------------

/** A minimal fully-valid `POST /run` body; override individual fields. */
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
 * Build a fake MCP Streamable HTTP transport seam that records every call and
 * returns a canned JSON-RPC `tools/call` response. Makes ZERO network calls.
 */
function spyTransport(response) {
  const calls = [];
  const transport = async (req) => {
    calls.push(req);
    return (
      response ?? {
        jsonrpc: "2.0",
        id: req.body?.id ?? 1,
        result: {
          content: [{ type: "text", text: "ok" }],
          structuredContent: { runId: "run-abc", state: "blocked" },
          isError: false,
        },
      }
    );
  };
  return { transport, calls };
}

// --- 1. Exactly-once forwarding via the injectable transport ----------------

test("forwarder: a valid request forwards exactly once via the injectable transport", async () => {
  const { transport, calls } = spyTransport();
  const forward = createMcpForwarder({ transport });

  const result = await forward({ body: validBody() });

  assert.equal(calls.length, 1, "the transport seam is invoked exactly once");
  assert.equal(result.forwarded, true);
  assert.equal(result.tool, MCP_DIRECTOR_TOOL_NAME);
  assert.equal(result.transport, MCP_TRANSPORT);
  // The forwarded result carries the McpAgent's tools/call structuredContent.
  assert.equal(result.result.structuredContent.runId, "run-abc");
});

test("forwarder: the forwarded JSON-RPC envelope mirrors the McpAgent tools/call shape", async () => {
  const { transport, calls } = spyTransport();
  const forward = createMcpForwarder({ transport });

  await forward({ body: validBody({ approvals: ["payment-action"] }) });

  const req = calls[0];
  assert.equal(req.url, MCP_DEFAULT_ENDPOINT);
  assert.equal(req.method, "POST");
  // MCP Streamable HTTP clients negotiate JSON or SSE via the Accept header.
  assert.match(req.headers.accept, /application\/json/);
  assert.match(req.headers.accept, /text\/event-stream/);
  assert.equal(req.headers["content-type"], "application/json");

  const rpc = req.body;
  assert.equal(rpc.jsonrpc, "2.0");
  assert.equal(rpc.method, "tools/call");
  assert.equal(rpc.params.name, MCP_DIRECTOR_TOOL_NAME);
  // Only the validated fields are forwarded as arguments.
  assert.equal(rpc.params.arguments.referenceUrl, "https://example.com/reference-video");
  assert.equal(rpc.params.arguments.budgetUsd, 12.5);
  assert.deepEqual(rpc.params.arguments.approvals, ["payment-action"]);
});

test("buildVideoRemixRunRequest: defaults omitted approvals to an empty array", () => {
  const body = validBody();
  delete body.approvals;
  const rpc = buildVideoRemixRunRequest(body);
  assert.deepEqual(rpc.params.arguments.approvals, []);
});

test("buildForwardHttpRequest: honors a custom endpoint and Mcp-Session-Id", () => {
  const req = buildForwardHttpRequest(validBody(), {
    endpoint: "https://staging.example.com/knowgrph/mcp",
    sessionId: "sess-1",
  });
  assert.equal(req.url, "https://staging.example.com/knowgrph/mcp");
  assert.equal(req.headers["mcp-session-id"], "sess-1");
});

// --- 2. Forwarding deadline metadata == 2,000 ms ----------------------------

test("forwarder: the forwarding deadline metadata is 2000ms and within-deadline by default", async () => {
  const { transport } = spyTransport();
  const forward = createMcpForwarder({ transport });

  const result = await forward({ body: validBody() });

  assert.equal(MCP_FORWARD_DEADLINE_MS, 2000, "R12.2 deadline is 2,000 ms");
  assert.equal(result.forwardDeadlineMs, 2000);
  // Synchronous deterministic seam forwards immediately -> within the window.
  assert.equal(result.forwardElapsedMs, 0);
  assert.equal(result.forwardWithinDeadline, true);
});

test("forwarder: a forward exactly at the 2000ms deadline is still within-deadline", async () => {
  const { transport } = spyTransport();
  const forward = createMcpForwarder({ transport, forwardElapsedMs: MCP_FORWARD_DEADLINE_MS });

  const result = await forward({ body: validBody() });

  assert.equal(result.forwardElapsedMs, 2000);
  assert.equal(result.forwardWithinDeadline, true);
});

// --- 3. Injected slow forward beyond 2,000 ms is flagged past-deadline -------

test("forwarder: an injected slow forward beyond 2000ms is flagged past-deadline", async () => {
  const { transport, calls } = spyTransport();
  const forward = createMcpForwarder({
    transport,
    forwardElapsedMs: MCP_FORWARD_DEADLINE_MS + 1,
  });

  const result = await forward({ body: validBody() });

  assert.equal(calls.length, 1, "the request is still forwarded once");
  assert.equal(result.forwardElapsedMs, 2001);
  assert.equal(result.forwardWithinDeadline, false, "past the 2,000 ms deadline (R12.2)");
  assert.equal(result.forwardDeadlineMs, 2000);
});

// --- 4. A schema-failing request does NOT forward (no transport call) -------

test("handler: a schema-failing request does NOT forward (zero transport calls)", async () => {
  const { transport, calls } = spyTransport();
  const handler = createForwardingRunHandler({ transport });

  const res = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ referenceUrl: "", brief: "", budgetUsd: 0 }),
  });

  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0, "no MCP call is forwarded on schema failure (R12.3)");
  assert.equal(JSON.parse(res.body).error, "schema_validation_failed");
});

// --- Handler wiring: schema-passing request forwards exactly once -----------

test("handler: a schema-passing POST /run forwards exactly once and returns the forwarding result", async () => {
  const { transport, calls } = spyTransport();
  const handler = createForwardingRunHandler({ transport });

  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });

  assert.equal(res.statusCode, 202);
  assert.equal(calls.length, 1, "exactly one MCP forward for a schema-passing request");
  const payload = JSON.parse(res.body);
  assert.equal(payload.forwarded, true);
  assert.equal(payload.tool, MCP_DIRECTOR_TOOL_NAME);
  assert.equal(payload.forwardDeadlineMs, 2000);
  assert.equal(payload.result.structuredContent.runId, "run-abc");
});

test("handler: the default (un-wired) forwarder returns 501 not_implemented on a valid request", async () => {
  // The default handler export wires the forwarder with the not-implemented
  // transport seam; live `fetch` wiring is task 9.2.
  const handler = createRunHandler();
  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });
  assert.equal(res.statusCode, 501);
  assert.equal(JSON.parse(res.body).error, "not_implemented");
});

test("handler: a transport that surfaces a slow-forward flag still returns 202 with past-deadline metadata", async () => {
  const { transport } = spyTransport();
  const handler = createForwardingRunHandler({
    transport,
    forwardElapsedMs: MCP_FORWARD_DEADLINE_MS + 500,
  });

  const res = await handler({ httpMethod: "POST", body: JSON.stringify(validBody()) });

  assert.equal(res.statusCode, 202);
  const payload = JSON.parse(res.body);
  assert.equal(payload.forwardWithinDeadline, false);
  assert.equal(payload.forwardElapsedMs, 2500);
});
