// Tests for the AgentCore-compatible MCP-forwarding server
// (knowgrph-acos-mcp-connector spec, task 13.1 / R11.1, R11.2, R12.2, R14.1 /
// decision 13.0 / Correctness Properties 1, 6).
//
// All deterministic and NETWORK-FREE: an injectable transport seam stands in
// for the live `fetch` to the Cloudflare control plane, so no live MCP call is
// ever made. Covers:
//   - tools/list advertises the Director + 5 stage tools, each with input AND
//     output schema (R14.1)
//   - initialize / ping respond per the MCP contract
//   - tools/call forwards EXACTLY ONCE and carries the 2,000 ms deadline
//     metadata (R12.2 / Property 6) for both the Director and a stage tool
//   - FAIL-CLOSED: with no control-plane endpoint, tools/call returns HTTP 501
//     while tools/list still works (the catalog is static)
//   - a control-plane "approval required" error is RELAYED UNCHANGED, so the
//     AgentCore tier bypasses no Approval_Gate (Property 1)
//   - statelessness, routing (404 / 405), and unknown-tool handling
//   - R11 boundary: the source consumes NO model-provider env keys

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAgentCoreMcpHandler,
  TOOL_CATALOG,
  MCP_STAGE_TOOL_NAMES,
  MCP_DIRECTOR_TOOL_NAME,
  MCP_PATH,
  MCP_PROTOCOL_VERSION,
} from "../src/mcp-server.js";
import { MCP_FORWARD_DEADLINE_MS } from "../../agent-api/src/lib/mcp-forwarder.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, "..", "src");

const ENDPOINT = "https://airvio.co/knowgrph/mcp";

/** A fake transport seam that records calls and returns a canned response. */
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

function post(rpc, id = 1) {
  return { method: "POST", path: MCP_PATH, body: JSON.stringify({ jsonrpc: "2.0", id, ...rpc }) };
}

// --- R14.1: tool surface ----------------------------------------------------

test("tools/list advertises the Director + 5 stage tools, each with input and output schema", async () => {
  const handle = createAgentCoreMcpHandler({ endpoint: ENDPOINT, transport: spyTransport().transport });
  const res = await handle(post({ method: "tools/list" }));

  assert.equal(res.statusCode, 200);
  const tools = JSON.parse(res.body).result.tools;
  const names = tools.map((t) => t.name);

  assert.ok(names.includes(MCP_DIRECTOR_TOOL_NAME), "Director tool listed");
  for (const stage of MCP_STAGE_TOOL_NAMES) {
    assert.ok(names.includes(stage), `stage tool ${stage} listed`);
  }
  assert.equal(tools.length, 6, "Director + 5 stage tools");
  for (const t of tools) {
    assert.equal(typeof t.inputSchema, "object", `${t.name} has an input schema`);
    assert.equal(typeof t.outputSchema, "object", `${t.name} has an output schema (R14.1)`);
  }
});

test("the exported TOOL_CATALOG matches the advertised contract", () => {
  assert.equal(TOOL_CATALOG.length, 6);
  assert.equal(TOOL_CATALOG[0].name, MCP_DIRECTOR_TOOL_NAME);
});

// --- MCP lifecycle ----------------------------------------------------------

test("initialize returns the MCP protocol version and tool capability", async () => {
  const handle = createAgentCoreMcpHandler({ endpoint: ENDPOINT, transport: spyTransport().transport });
  const res = await handle(post({ method: "initialize" }));
  const result = JSON.parse(res.body).result;
  assert.equal(res.statusCode, 200);
  assert.equal(result.protocolVersion, MCP_PROTOCOL_VERSION);
  assert.ok(result.capabilities.tools, "advertises tools capability");
});

test("ping returns an empty result", async () => {
  const handle = createAgentCoreMcpHandler({ endpoint: ENDPOINT, transport: spyTransport().transport });
  const res = await handle(post({ method: "ping" }));
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body).result, {});
});

// --- R12.2 / Property 6: forwarding the Director tool -----------------------

test("tools/call for the Director tool forwards exactly once with 2,000 ms deadline metadata", async () => {
  const { transport, calls } = spyTransport();
  const handle = createAgentCoreMcpHandler({ endpoint: ENDPOINT, transport });

  const res = await handle(
    post({
      method: "tools/call",
      params: {
        name: MCP_DIRECTOR_TOOL_NAME,
        arguments: {
          referenceUrl: "https://example.com/v",
          brief: "remix",
          budgetUsd: 10,
          approvals: [],
        },
      },
    }),
  );

  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1, "forwarded exactly once");
  const result = JSON.parse(res.body).result;
  assert.equal(result.structuredContent.runId, "run-abc", "control-plane result relayed");
  assert.equal(result._forward.tool, MCP_DIRECTOR_TOOL_NAME);
  assert.equal(result._forward.forwardDeadlineMs, MCP_FORWARD_DEADLINE_MS);
  assert.equal(result._forward.forwardWithinDeadline, true);
  // The forwarded JSON-RPC envelope targets the Director tool over Streamable HTTP.
  assert.equal(calls[0].body.params.name, MCP_DIRECTOR_TOOL_NAME);
  assert.match(calls[0].headers.accept, /text\/event-stream/);
});

test("tools/call for a stage tool forwards the stage name and arguments unchanged", async () => {
  const { transport, calls } = spyTransport({
    jsonrpc: "2.0",
    id: 1,
    result: { content: [], structuredContent: { sources: [] }, isError: false },
  });
  const handle = createAgentCoreMcpHandler({ endpoint: ENDPOINT, transport });

  const res = await handle(
    post({
      method: "tools/call",
      params: { name: "knowgrph.video_remix.research", arguments: { referenceUrl: "https://x.y" } },
    }),
  );

  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.params.name, "knowgrph.video_remix.research");
  assert.equal(calls[0].body.params.arguments.referenceUrl, "https://x.y");
  assert.equal(JSON.parse(res.body).result._forward.forwardDeadlineMs, MCP_FORWARD_DEADLINE_MS);
});

// --- FAIL-CLOSED (R11 / R12.2) ----------------------------------------------

test("FAIL-CLOSED: tools/call returns HTTP 501 when the control-plane endpoint is unset", async () => {
  // No endpoint and an empty env -> no transport built -> fail closed.
  const handle = createAgentCoreMcpHandler({ env: {} });
  const res = await handle(
    post({
      method: "tools/call",
      params: { name: MCP_DIRECTOR_TOOL_NAME, arguments: { referenceUrl: "https://x", brief: "b", budgetUsd: 1 } },
    }),
  );
  assert.equal(res.statusCode, 501, "fail-closed when MCP_ENDPOINT is unset");
  assert.equal(JSON.parse(res.body).error.code, "not_implemented");
});

test("FAIL-CLOSED: tools/list still works without an endpoint (the catalog is static)", async () => {
  const handle = createAgentCoreMcpHandler({ env: {} });
  const res = await handle(post({ method: "tools/list" }));
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).result.tools.length, 6);
});

test("the endpoint is read from MCP_ENDPOINT when not passed explicitly", async () => {
  const { transport, calls } = spyTransport();
  const handle = createAgentCoreMcpHandler({ env: { MCP_ENDPOINT: ENDPOINT }, transport });
  const res = await handle(
    post({
      method: "tools/call",
      params: { name: MCP_DIRECTOR_TOOL_NAME, arguments: { referenceUrl: "https://x", brief: "b", budgetUsd: 1 } },
    }),
  );
  assert.equal(res.statusCode, 200);
  assert.equal(calls[0].url, ENDPOINT);
});

// --- Property 1: approval-gate invariant preserved by relaying --------------

test("a control-plane 'approval required' error is relayed unchanged (no gate bypass)", async () => {
  // The control plane withholds a paid action; the AgentCore tier must relay
  // the error and perform no paid action of its own (Property 1).
  const { transport, calls } = spyTransport({
    jsonrpc: "2.0",
    id: 1,
    error: { code: "approval_required", message: "render Approval_Gate not approved" },
  });
  const handle = createAgentCoreMcpHandler({ endpoint: ENDPOINT, transport });

  const res = await handle(
    post({
      method: "tools/call",
      params: { name: "knowgrph.video_remix.render", arguments: { shots: [], renderGateToken: "missing" } },
    }),
  );

  assert.equal(res.statusCode, 200);
  const error = JSON.parse(res.body).error;
  assert.equal(error.data.code, "approval_required", "control-plane gate error relayed unchanged");
  assert.equal(calls.length, 1, "forwarded once; no paid action taken locally");
});

// --- Routing / robustness ---------------------------------------------------

test("a non-/mcp path returns 404", async () => {
  const handle = createAgentCoreMcpHandler({ endpoint: ENDPOINT, transport: spyTransport().transport });
  const res = await handle({ method: "POST", path: "/other", body: "{}" });
  assert.equal(res.statusCode, 404);
});

test("GET /mcp returns 405 (Streamable HTTP MCP uses POST)", async () => {
  const handle = createAgentCoreMcpHandler({ endpoint: ENDPOINT, transport: spyTransport().transport });
  const res = await handle({ method: "GET", path: MCP_PATH, body: "" });
  assert.equal(res.statusCode, 405);
});

test("an unknown tool name returns a JSON-RPC method-not-found error", async () => {
  const handle = createAgentCoreMcpHandler({ endpoint: ENDPOINT, transport: spyTransport().transport });
  const res = await handle(post({ method: "tools/call", params: { name: "knowgrph.video_remix.unknown" } }));
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).error.code, -32601);
});

test("a malformed body returns a JSON-RPC parse error", async () => {
  const handle = createAgentCoreMcpHandler({ endpoint: ENDPOINT, transport: spyTransport().transport });
  const res = await handle({ method: "POST", path: MCP_PATH, body: "{not json" });
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).error.code, -32700);
});

test("the handler is stateless: two calls are handled independently", async () => {
  const { transport, calls } = spyTransport();
  const handle = createAgentCoreMcpHandler({ endpoint: ENDPOINT, transport });
  await handle(post({ method: "tools/list" }, 1));
  await handle(post({ method: "tools/list" }, 2));
  // tools/list never forwards; statelessness means no accumulation between calls.
  assert.equal(calls.length, 0);
});

// --- R11 boundary: no model-provider keys in env values ---------------------

test("R11: the AgentCore source consumes no model-provider env keys", () => {
  const allowedEnv = new Set(["MCP_ENDPOINT", "HOST", "PORT", "NODE_ENV"]);
  const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith(".js"));
  const envRef = /process\.env\.([A-Z0-9_]+)/g;
  const referenced = new Set();
  for (const f of files) {
    const text = fs.readFileSync(path.join(SRC_DIR, f), "utf8");
    let m;
    while ((m = envRef.exec(text)) !== null) referenced.add(m[1]);
  }
  for (const key of referenced) {
    assert.ok(allowedEnv.has(key), `unexpected env reference process.env.${key} (R11 boundary)`);
  }
  // Defensively assert no known provider key identifiers appear at all.
  const forbidden = [
    "BYTEPLUS_API_KEY",
    "MODELARK_API_KEY",
    "EXA_API_KEY",
    "STRIPE_SECRET_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
  ];
  for (const f of files) {
    const text = fs.readFileSync(path.join(SRC_DIR, f), "utf8");
    for (const key of forbidden) {
      assert.ok(!text.includes(key), `model-provider key ${key} must not appear in ${f}`);
    }
  }
});
