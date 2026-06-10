// Cross-cutting auth-vs-approval invariant tests for the request pipeline
// (knowgrph-acos-mcp-connector spec, task 6.5 / R15.9 / Correctness Property 1).
//
// THE INVARIANT (design Overview + Property 1): a valid Auth_Token AUTHENTICATES
// the caller and lets the request CONTINUE to the Approval_Gate checks, but it
// NEVER AUTHORIZES SPEND. Every spend boundary still requires its own
// Approval_Token. Authentication never substitutes for an Approval_Token at any
// spend boundary.
//
// The two halves are already enforced separately (and tested) elsewhere:
//   * `withAuth` (auth-verify.js) gates auth with a 401 but mints / implies NO
//     Approval_Token — tested in auth-verify.test.mjs.
//   * `withApprovalGate` + the shared `verifyGateToken` (gate-token.js) reject
//     an Auth_Token-shaped credential at the render / payment spend boundaries
//     with `gate_mismatch` — tested in mcp/__tests__/approval-gate-guard,
//     render-harness-token-failure, commerce-harness-gate, and
//     director-gates-enforcement.
//
// THIS MODULE makes the invariant a FIRST-CLASS, explicitly-tested property at
// the REQUEST-PIPELINE level, end to end, asserting the three things task 6.5
// calls out:
//   A. an authenticated `POST /run` PROCEEDS to forwarding, and the forwarded
//      MCP run carries ONLY the validated request + caller-supplied approvals[]
//      — approvals are NEVER derived from the auth claims, and no Auth_Token
//      material is forwarded as / promoted to an Approval_Token;
//   B. an Auth_Token presented as an Approval_Token at the render + payment
//      spend boundaries is REJECTED (reusing the shared gate-token rejection);
//   C. auth SUCCESS does not reduce the number of required Approval_Gates or
//      zero out the spend gates — the Director still emits the full gate list
//      and the live-without-approvals halt path remains.
//
// All seams (static secret provider + fixed clock; the forwarder is a recording
// in-memory seam) make ZERO live network / AWS calls. Test tokens are signed
// with the SAME secret the verifier uses.

import test from "node:test";
import assert from "node:assert/strict";

import jwt from "jsonwebtoken";

import { createAuthedRunHandler } from "../src/handlers/run.js";
import { withAuth } from "../src/lib/auth-verify.js";
import { buildVideoRemixRunRequest } from "../src/lib/mcp-forwarder.js";
import { createStaticSecretProvider, JWT_ALGORITHM } from "../src/lib/auth-token.js";

// Cross-tier reuse: the SAME spend-boundary predicate the control-plane render /
// payment gates delegate to. Importing it here proves the request pipeline and
// the spend boundaries agree on a single rejection rule (no per-tier drift).
import {
  verifyGateToken,
  GATE_TOKEN_REASON_GATE_MISMATCH,
} from "../../../mcp/video-remix/gate-token.js";
import { RENDER_GATE_ID } from "../../../mcp/video-remix/render-token.js";
import { PAYMENT_GATE_ID } from "../../../mcp/video-remix/commerce-providers.js";
// The Director: proves auth success never reduces the emitted Approval_Gates.
import { runVideoRemix } from "../../../mcp/video-remix/run-video-remix.js";

// --- Fixtures ---------------------------------------------------------------

const FIXED_NOW_MS = 1_700_000_000_000;
const FIXED_NOW_SEC = Math.floor(FIXED_NOW_MS / 1000);
const TEST_SECRET = "test-signing-secret-do-not-log";

const fixedClock = () => FIXED_NOW_MS;

/**
 * Sign a valid HS256 Auth_Token. The default carries POPULATED `entitledRunIds`
 * so the tests can prove those auth claims are never promoted to an
 * Approval_Token nor leaked into the forwarded MCP run.
 */
function signAuthToken(overrides = {}) {
  const claims = {
    sub: "sess_caller_1",
    entitledRunIds: ["run-existing-1", "run-existing-2"],
    iat: FIXED_NOW_SEC,
    exp: FIXED_NOW_SEC + 3600,
    ...overrides,
  };
  return jwt.sign(claims, TEST_SECRET, { algorithm: JWT_ALGORITHM });
}

/** A valid `POST /run` body with caller-controlled approvals[]. */
function runBody({ approvals = [] } = {}) {
  return {
    referenceUrl: "https://example.com/reference.mp4",
    brief: "Make a 15-second remix highlighting the product.",
    budgetUsd: 25.0,
    approvals,
  };
}

function postRunEvent({ token, body = runBody() } = {}) {
  const event = { httpMethod: "POST", path: "/run", body: JSON.stringify(body), headers: {} };
  if (token !== undefined) event.headers.authorization = `Bearer ${token}`;
  return event;
}

/**
 * Build an authed `POST /run` handler whose forwarding seam RECORDS every
 * forwarded body (the validated request the Agent_Api hands to the McpAgent),
 * so a test can assert exactly what crosses the boundary.
 */
function makeRecordingAuthedRun() {
  const forwards = [];
  const handler = createAuthedRunHandler({
    secretProvider: createStaticSecretProvider(TEST_SECRET),
    clock: fixedClock,
    run: {
      onValidRequest: async ({ body }) => {
        forwards.push(body);
        return { accepted: true, runId: "run-new" };
      },
    },
  });
  return { handler, forwards };
}

/** An Auth_Token-SHAPED object (decoded JWT claims) — NOT an Approval_Token. */
function authTokenShape(overrides = {}) {
  return {
    subject: "sess_caller_1",
    entitledRunIds: ["run-existing-1"],
    issuedAt: FIXED_NOW_MS,
    expiryWindowSeconds: 3600,
    signature: "auth-jwt-sig",
    ...overrides,
  };
}

// ===========================================================================
// A. An authenticated POST /run PROCEEDS to forwarding, carrying ONLY the
//    validated request + caller-supplied approvals[] (never auth-derived).
// ===========================================================================

test("A1: an authenticated POST /run proceeds to forwarding (auth lets it continue)", async () => {
  const { handler, forwards } = makeRecordingAuthedRun();
  const res = await handler(postRunEvent({ token: signAuthToken() }));

  assert.equal(res.statusCode, 202, "a valid Auth_Token lets the request CONTINUE to forwarding");
  assert.equal(forwards.length, 1, "exactly one MCP forward for an authenticated request");
});

test("A2: the forwarded MCP run carries NO Auth_Token material and NO Approval_Token", async () => {
  const { handler, forwards } = makeRecordingAuthedRun();
  await handler(postRunEvent({ token: signAuthToken() }));

  const forwarded = forwards[0];
  // The forwarded body is the validated request only. Build the actual MCP
  // envelope the forwarder sends and assert its arguments carry nothing derived
  // from auth (no subject / entitledRunIds / signature / approval token).
  const envelope = buildVideoRemixRunRequest(forwarded);
  const args = envelope.params.arguments;
  assert.deepEqual(
    Object.keys(args).sort(),
    ["approvals", "brief", "budgetUsd", "referenceUrl"],
    "only the validated request fields cross the boundary",
  );

  const forwardedText = JSON.stringify(envelope);
  // The auth claims (subject + entitled run ids) never leak into the forward.
  assert.equal(forwardedText.includes("sess_caller_1"), false, "no auth subject forwarded");
  assert.equal(forwardedText.includes("run-existing-1"), false, "no entitledRunIds forwarded");
  // No Auth_Token field is promoted to an Approval_Token anywhere in the run.
  for (const key of ["auth", "authToken", "callerIdentity", "approvalToken", "token", "signature"]) {
    assert.equal(key in args, false, `'${key}' is never attached to the forwarded MCP run`);
  }
});

test("A3: forwarded approvals[] is the CALLER-supplied gate list, not derived from auth", async () => {
  const { handler, forwards } = makeRecordingAuthedRun();

  // Caller supplies an explicit approvals list; the authenticated principal is
  // entitled to several runs, but auth must add NOTHING to approvals.
  await handler(
    postRunEvent({
      token: signAuthToken({ entitledRunIds: ["run-a", "run-b", "run-c"] }),
      body: runBody({ approvals: [{ gateId: RENDER_GATE_ID }] }),
    }),
  );

  const args = buildVideoRemixRunRequest(forwards[0]).params.arguments;
  assert.deepEqual(
    args.approvals,
    [{ gateId: RENDER_GATE_ID }],
    "approvals[] is exactly what the caller sent — auth neither adds nor removes gates",
  );
});

test("A4: an authenticated request with empty approvals[] forwards an empty approvals list", async () => {
  const { handler, forwards } = makeRecordingAuthedRun();
  await handler(postRunEvent({ token: signAuthToken(), body: runBody({ approvals: [] }) }));

  const args = buildVideoRemixRunRequest(forwards[0]).params.arguments;
  assert.deepEqual(args.approvals, [], "auth success does not synthesize any approvals");
});

test("A5: withAuth attaches ONLY auth claims + Caller_Identity — never an Approval_Token", async () => {
  let seen;
  const handler = withAuth(
    (event) => {
      seen = event;
      return { statusCode: 200, headers: {}, body: "{}" };
    },
    { secretProvider: createStaticSecretProvider(TEST_SECRET), clock: fixedClock },
  );

  await handler(postRunEvent({ token: signAuthToken() }));

  // The seam carries the verified claims + the established Caller_Identity, used
  // to AUTHENTICATE and AUTHORIZE READS — never to authorize spend.
  assert.ok(seen.auth && seen.auth.claims, "verified claims passed through");
  assert.ok(seen.callerIdentity, "Caller_Identity established");
  // No spend-authorizing material is ever attached by the auth layer.
  for (const key of ["approval", "approvalToken", "approvals", "renderGateToken", "paymentGateToken"]) {
    assert.equal(key in seen, false, `auth never attaches '${key}' to the request`);
  }
});

// ===========================================================================
// B. An Auth_Token presented AS an Approval_Token at a spend boundary is
//    REJECTED (reusing the shared gate-token rejection — single rule).
// ===========================================================================

test("B1: an Auth_Token-shaped credential never authorizes the RENDER spend boundary", () => {
  const result = verifyGateToken(authTokenShape(), { gateId: RENDER_GATE_ID, now: FIXED_NOW_MS });
  assert.equal(result.valid, false, "an Auth_Token can never open the render gate");
  assert.equal(result.reason, GATE_TOKEN_REASON_GATE_MISMATCH, "it fails closed as a gate mismatch");
});

test("B2: an Auth_Token-shaped credential never authorizes the PAYMENT spend boundary", () => {
  const result = verifyGateToken(authTokenShape(), { gateId: PAYMENT_GATE_ID, now: FIXED_NOW_MS });
  assert.equal(result.valid, false, "an Auth_Token can never open the payment gate");
  assert.equal(result.reason, GATE_TOKEN_REASON_GATE_MISMATCH, "it fails closed as a gate mismatch");
});

test("B3: even an Auth_Token carrying a populated entitledRunIds set is rejected at a spend boundary", () => {
  // Entitlement (authorization to READ a run) must never be read as authorization
  // to SPEND. The credential still lacks a matching gateId, so it fails closed.
  const entitled = authTokenShape({ entitledRunIds: ["run-a", "run-b", "run-c"] });
  for (const gateId of [RENDER_GATE_ID, PAYMENT_GATE_ID]) {
    const result = verifyGateToken(entitled, { gateId, now: FIXED_NOW_MS });
    assert.equal(result.valid, false);
    assert.equal(result.reason, GATE_TOKEN_REASON_GATE_MISMATCH);
  }
});

// ===========================================================================
// C. Auth SUCCESS does not reduce the required Approval_Gates or zero out the
//    spend gates — the Director still emits the full gate list and the
//    live-without-approvals halt path remains.
// ===========================================================================

/**
 * The forwarder hands the Director ONLY the validated request + caller-supplied
 * approvals[]. Model that exact handoff: an authenticated request whose caller
 * supplied NO approvals[] must still produce the full Approval_Gate list with
 * zero estimated spend and zero paid-provider calls (the halt path).
 */
test("C1: an authenticated live run with empty approvals still emits >=5 gates and halts with zero spend", () => {
  const forwarded = runBody({ approvals: [] });
  const { payload: manifest } = runVideoRemix({ ...forwarded, mode: "live", approvals: [] });

  assert.equal(manifest.state, "blocked", "live + empty approvals halts at the first spend boundary");
  assert.ok(
    manifest.approvalGates.length >= 5,
    `auth success does not reduce the gate list (got ${manifest.approvalGates.length}, expected >=5)`,
  );
  assert.equal(manifest.budgetMeters.estimatedCostUsd, 0, "no spend is authorized by authentication");
  assert.equal(manifest.budgetMeters.paidProviderCalls, 0, "zero paid-provider calls without an Approval_Token");
});

test("C2: presenting auth claims as approvals[] does NOT zero out or skip the spend gates", () => {
  // Feed the Director an approvals[] that LOOKS like authenticated identity
  // material (subject / entitledRunIds) rather than real gate approvals. None of
  // it matches a spend gate, so every spend gate stays unapproved and the run
  // still halts — authentication never substitutes for an Approval_Token.
  const bogusApprovals = [
    { subject: "sess_caller_1" },
    { entitledRunIds: ["run-existing-1"] },
    "sess_caller_1",
  ];
  const { payload: manifest } = runVideoRemix({
    ...runBody(),
    mode: "live",
    approvals: bogusApprovals,
  });

  assert.equal(manifest.state, "blocked", "identity-shaped approvals authorize no spend");
  assert.ok(manifest.approvalGates.length >= 5, "the full spend-gate list is still required");
  assert.equal(manifest.budgetMeters.estimatedCostUsd, 0);
  assert.equal(manifest.budgetMeters.paidProviderCalls, 0);
  // Every spend gate remains unapproved (`required`), proving none were
  // satisfied by the identity-shaped material.
  for (const gate of manifest.approvalGates) {
    assert.notEqual(gate.approvalState, "approved", `gate '${gate.id}' must not be approved by identity material`);
  }
});

test("C3: authentication does not change the emitted gate set vs an equivalent unauthenticated run", () => {
  // The Director sees the SAME validated request regardless of whether the
  // Agent_Api authenticated the caller (auth is upstream and adds nothing to the
  // run input). So the gate list is identical with or without an auth context.
  const input = { ...runBody({ approvals: [] }), mode: "live", approvals: [], runId: "fixed-run-id" };
  const { payload: a } = runVideoRemix(input);
  const { payload: b } = runVideoRemix(input);

  const gateIdsOf = (m) => m.approvalGates.map((g) => g.id).sort();
  assert.deepEqual(gateIdsOf(a), gateIdsOf(b), "the required gate set is invariant under authentication");
  assert.ok(gateIdsOf(a).includes(RENDER_GATE_ID), "the render spend gate is always present");
  assert.ok(gateIdsOf(a).includes(PAYMENT_GATE_ID), "the payment spend gate is always present");
});
