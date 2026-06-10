// Tests for the AgentCore Runtime stage-transition observability relay
// (knowgrph-acos-mcp-connector spec, task 13.6 / R14.5, R15.7 / Property 27).
//
// The Cloudflare control plane is the SOURCE OF TRUTH for stage transitions
// (task 1.5); the thin AgentCore tier RELAYS the forwarded diagnostics through
// AgentCore's built-in observability path. These tests assert:
//   - a relayed diagnostic carries EXACTLY the five canonical R14.5 fields
//     `{ runId, fromStage, toStage, utcTimestamp, outcomeStatus }` (Property 27)
//   - non-canonical fields are dropped by construction
//   - emitting REDACTS/OMITS any Auth_Token / Approval_Token / Authorization /
//     secret material — fail-closed, never written to a trace/log (R15.7)
//   - the handler relays forwarded diagnostics via the injected sink WITHOUT
//     altering the relayed tools/call response
//
// All deterministic and NETWORK-FREE: the transport and the observability sink
// are injectable seams, so no live MCP/AWS call and no real log line occur.

import test from "node:test";
import assert from "node:assert/strict";

import {
  createAgentCoreMcpHandler,
  MCP_DIRECTOR_TOOL_NAME,
  MCP_PATH,
} from "../src/mcp-server.js";
import {
  createStageTransitionEmitter,
  toCanonicalDiagnostic,
  assertNoSecretMaterial,
  extractStageTransitions,
  STAGE_TRANSITION_FIELDS,
  DiagnosticRedactionError,
} from "../src/observability.js";

const ENDPOINT = "https://airvio.co/knowgrph/mcp";
const FIXED_NOW = Date.parse("2025-01-02T03:04:05.000Z");
const fixedClock = () => FIXED_NOW;

/** A transport seam returning a Director result carrying stageTransitions. */
function transportWithTransitions(stageTransitions, { wrap = "top" } = {}) {
  const structuredContent = { runId: "run-abc", state: "blocked" };
  const result =
    wrap === "structured"
      ? { content: [], structuredContent: { ...structuredContent, stageTransitions } }
      : { content: [], structuredContent, stageTransitions };
  return async (req) => ({ jsonrpc: "2.0", id: req.body?.id ?? 1, result });
}

function post(rpc, id = 1) {
  return { method: "POST", path: MCP_PATH, body: JSON.stringify({ jsonrpc: "2.0", id, ...rpc }) };
}

// --- Property 27: canonical five-field shape --------------------------------

test("toCanonicalDiagnostic keeps EXACTLY the five canonical R14.5 fields", () => {
  const raw = {
    runId: "run-1",
    fromStage: "research",
    toStage: "storyboard",
    utcTimestamp: "2025-01-01T00:00:00.000Z",
    outcomeStatus: "completed",
    // non-canonical noise that MUST be dropped:
    extra: "drop-me",
    Authorization: "Bearer should-not-survive",
  };
  const canonical = toCanonicalDiagnostic(raw, fixedClock);
  assert.deepEqual(Object.keys(canonical).sort(), [...STAGE_TRANSITION_FIELDS].sort());
  assert.equal(canonical.runId, "run-1");
  assert.equal(canonical.fromStage, "research");
  assert.equal(canonical.toStage, "storyboard");
  assert.equal(canonical.utcTimestamp, "2025-01-01T00:00:00.000Z");
  assert.equal(canonical.outcomeStatus, "completed");
});

test("toCanonicalDiagnostic fills missing utcTimestamp/outcomeStatus deterministically", () => {
  const canonical = toCanonicalDiagnostic({ runId: "r", fromStage: "render", toStage: "checkout" }, fixedClock);
  assert.equal(canonical.utcTimestamp, new Date(FIXED_NOW).toISOString());
  assert.equal(canonical.outcomeStatus, "unknown");
});

test("emit writes EXACTLY the five canonical fields to the sink (Property 27)", () => {
  const records = [];
  const emitter = createStageTransitionEmitter({ sink: (r) => records.push(r), clock: fixedClock });
  const { emitted, blocked } = emitter.emit([
    { runId: "run-1", fromStage: "research", toStage: "storyboard", utcTimestamp: "2025-01-01T00:00:00.000Z", outcomeStatus: "completed" },
  ]);

  assert.equal(blocked, 0);
  assert.equal(emitted.length, 1);
  assert.equal(records.length, 1);
  assert.equal(records[0].kind, "knowgrph.agentcore.stage_transition");
  assert.deepEqual(Object.keys(records[0].diagnostic).sort(), [...STAGE_TRANSITION_FIELDS].sort());
});

// --- R15.7: redaction / no secret material ----------------------------------

test("assertNoSecretMaterial throws for Auth_Token / Approval_Token / secret keys (R15.7)", () => {
  for (const bad of [
    { Authorization: "Bearer x" },
    { authToken: "abc" },
    { Approval_Token: "tok" },
    { secret: "shh" },
    { apiKey: "k" },
  ]) {
    assert.throws(() => assertNoSecretMaterial(bad), DiagnosticRedactionError);
  }
});

test("assertNoSecretMaterial throws when a JWT-looking blob hides inside a value (R15.7)", () => {
  const sneaky = {
    runId: "run-1",
    fromStage: "research",
    toStage: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payloadpart.signaturepart",
    utcTimestamp: "2025-01-01T00:00:00.000Z",
    outcomeStatus: "completed",
  };
  assert.throws(() => assertNoSecretMaterial(sneaky), DiagnosticRedactionError);
});

test("emit DROPS (never writes) a diagnostic carrying secret/token material (R15.7)", () => {
  const records = [];
  const emitter = createStageTransitionEmitter({ sink: (r) => records.push(r), clock: fixedClock });
  // outcomeStatus poisoned with bearer-token material — must be blocked.
  const { emitted, blocked } = emitter.emit([
    { runId: "run-1", fromStage: "research", toStage: "storyboard", outcomeStatus: "Bearer leaked-token" },
    { runId: "run-1", fromStage: "storyboard", toStage: "render", outcomeStatus: "completed" },
  ]);

  assert.equal(blocked, 1, "poisoned diagnostic blocked");
  assert.equal(emitted.length, 1, "clean diagnostic still emitted");
  assert.equal(records.length, 1, "only the clean diagnostic reached the sink");
  // Nothing written contains the leaked token.
  const serialized = JSON.stringify(records);
  assert.ok(!/Bearer/i.test(serialized), "no Bearer material reached the sink");
  assert.ok(!/leaked-token/.test(serialized), "no token value reached the sink");
});

// --- extraction from the forwarded control-plane result ---------------------

test("extractStageTransitions reads stageTransitions at top level and under structuredContent", () => {
  const arr = [{ runId: "r", fromStage: "a", toStage: "b" }];
  assert.deepEqual(extractStageTransitions({ stageTransitions: arr }), arr);
  assert.deepEqual(extractStageTransitions({ structuredContent: { stageTransitions: arr } }), arr);
  assert.deepEqual(extractStageTransitions({ content: [] }), []);
  assert.deepEqual(extractStageTransitions(null), []);
});

// --- handler integration: relay diagnostics without altering the response ---

test("handler relays forwarded stage transitions to the sink in canonical shape (R14.5)", async () => {
  const records = [];
  const handle = createAgentCoreMcpHandler({
    endpoint: ENDPOINT,
    transport: transportWithTransitions([
      { runId: "run-abc", fromStage: "research", toStage: "storyboard", utcTimestamp: "2025-01-01T00:00:00.000Z", outcomeStatus: "completed", noise: "x" },
      { runId: "run-abc", fromStage: "storyboard", toStage: "render", utcTimestamp: "2025-01-01T00:01:00.000Z", outcomeStatus: "blocked" },
    ]),
    diagnosticEmitter: createStageTransitionEmitter({ sink: (r) => records.push(r), clock: fixedClock }),
  });

  const res = await handle(post({ method: "tools/call", params: { name: MCP_DIRECTOR_TOOL_NAME, arguments: {} } }));

  assert.equal(res.statusCode, 200);
  assert.equal(records.length, 2, "both transitions relayed to observability");
  for (const rec of records) {
    assert.equal(rec.kind, "knowgrph.agentcore.stage_transition");
    assert.deepEqual(Object.keys(rec.diagnostic).sort(), [...STAGE_TRANSITION_FIELDS].sort());
    assert.equal(rec.diagnostic.runId, "run-abc");
  }
  // The relayed tools/call response is unchanged (forwarding is unaffected).
  const body = JSON.parse(res.body);
  assert.ok(body.result, "tools/call result still relayed");
});

test("handler emits nothing for a forwarded result with no stage transitions", async () => {
  const records = [];
  const handle = createAgentCoreMcpHandler({
    endpoint: ENDPOINT,
    transport: async (req) => ({ jsonrpc: "2.0", id: req.body?.id ?? 1, result: { content: [], structuredContent: { runId: "r" } } }),
    diagnosticEmitter: createStageTransitionEmitter({ sink: (r) => records.push(r), clock: fixedClock }),
  });
  const res = await handle(post({ method: "tools/call", params: { name: "knowgrph.video_remix.research", arguments: { referenceUrl: "https://example.com" } } }));
  assert.equal(res.statusCode, 200);
  assert.equal(records.length, 0, "no transitions => no diagnostics emitted");
});

test("handler does NOT leak secret material even if a forwarded diagnostic carries it (R15.7)", async () => {
  const records = [];
  const handle = createAgentCoreMcpHandler({
    endpoint: ENDPOINT,
    transport: transportWithTransitions([
      { runId: "run-abc", fromStage: "render", toStage: "checkout", outcomeStatus: "completed", Approval_Token: "tok-secret-123" },
    ]),
    diagnosticEmitter: createStageTransitionEmitter({ sink: (r) => records.push(r), clock: fixedClock }),
  });
  const res = await handle(post({ method: "tools/call", params: { name: MCP_DIRECTOR_TOOL_NAME, arguments: {} } }));

  assert.equal(res.statusCode, 200);
  // Canonical projection drops the Approval_Token key entirely; the clean
  // five-field diagnostic is emitted and carries no token material.
  assert.equal(records.length, 1);
  const serialized = JSON.stringify(records);
  assert.ok(!/Approval_Token/i.test(serialized), "Approval_Token key dropped");
  assert.ok(!/tok-secret-123/.test(serialized), "Approval_Token value never reached the sink");
});
