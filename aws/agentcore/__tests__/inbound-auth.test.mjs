// Tests for the AgentCore Runtime inbound auth verifying layer
// (knowgrph-acos-mcp-connector spec, task 13.4 / R15.1, R15.2, R15.3, R15.9 /
// Properties 1, 28, 29).
//
// The AgentCore tier is a thin MCP-forwarding adapter. Its inbound auth is a
// thin verifying layer that reuses the agent-api verification primitives and
// performs the SAME R15 verification before any forwarding. These tests assert:
//   1. valid Auth_Token  -> forward happens once, Caller_Identity established
//      BEFORE forwarding (R15.2 / Property 29)
//   2. missing token     -> 401, NO forward, NO Run_Manifest disclosure
//   3. malformed token   -> 401, NO forward
//   4. bad-signature     -> 401, NO forward
//   5. expired token     -> 401, NO forward
//   6. every 401 body discloses no credential / config / Run_Manifest content
//      (R15.1, R15.3 / Property 28)
//   7. auth != approval: a verified call is forwarded EXACTLY as
//      authenticated-but-unapproved; this tier performs no approval logic and
//      substitutes no Approval_Token (R15.9 / Property 1)
//   8. server-side signing secret unavailable -> non-disclosing 500 (not 401)
//
// All ZERO live network/AWS calls (injected static secret provider + fixed
// clock; test tokens are signed with the SAME secret).

import test from "node:test";
import assert from "node:assert/strict";

import jwt from "jsonwebtoken";

import { withInboundAuth } from "../src/inbound-auth.js";
import {
  createStaticSecretProvider,
  createEnvSecretProvider,
  JWT_ALGORITHM,
} from "../../agent-api/src/lib/auth-token.js";
import { UNAUTHORIZED_ERROR } from "../../agent-api/src/lib/auth-verify.js";

// --- Fixtures ---------------------------------------------------------------

const FIXED_NOW_MS = 1_700_000_000_000;
const FIXED_NOW_SEC = Math.floor(FIXED_NOW_MS / 1000);
const TEST_SECRET = "agentcore-test-signing-secret-do-not-log";
const WRONG_SECRET = "a-different-secret-entirely";

const fixedClock = () => FIXED_NOW_MS;

/** Sign a valid HS256 Auth_Token with the given secret + claims. */
function signToken(secret = TEST_SECRET, overrides = {}) {
  const claims = {
    sub: "sess_caller_1",
    entitledRunIds: [],
    iat: FIXED_NOW_SEC,
    exp: FIXED_NOW_SEC + 3600,
    ...overrides,
  };
  return jwt.sign(claims, secret, { algorithm: JWT_ALGORITHM });
}

/** A forwarded MCP `knowgrph.video_remix.run` request body. */
function mcpRequest({ token } = {}) {
  const request = {
    method: "POST",
    path: "/mcp",
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "knowgrph.video_remix.run", arguments: { mode: "live", approvals: [] } },
    }),
    headers: {},
  };
  if (token !== undefined) request.headers.authorization = `Bearer ${token}`;
  return request;
}

/**
 * Build the inbound-auth-wrapped forward seam with a RECORDING forward so we can
 * assert whether (and with what) the MCP forward fired. The forward returns a
 * Run_Manifest-shaped body so we can prove rejection paths never disclose it.
 */
function makeAuthedForward({ secret = TEST_SECRET } = {}) {
  const forwards = [];
  const handler = withInboundAuth(
    async (request) => {
      forwards.push(request);
      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          runId: "run-new",
          state: "blocked",
          approvalGates: [{ gateId: "render-action", approvalState: "pending" }],
          budgetMeters: { estimatedCostUsd: 0 },
          stages: [],
          demoPack: null,
        }),
      };
    },
    { secretProvider: createStaticSecretProvider(secret), clock: fixedClock },
  );
  return { handler, forwards };
}

/** Assert a body discloses no credential / config / Run_Manifest content. */
function assertNonDisclosing(bodyText) {
  assert.equal(bodyText.includes(TEST_SECRET), false, "no signing secret in body");
  assert.equal(bodyText.includes(WRONG_SECRET), false, "no secret material in body");
  assert.equal(/AUTH_JWT_SECRET/.test(bodyText), false, "no secret key name in body");
  assert.equal(/stack|process\.env|node_modules|\/src\//i.test(bodyText), false, "no stack/config/path in body");
  for (const field of ["approvalGates", "budgetMeters", "stages", "demoPack", '"state"', "render-action"]) {
    assert.equal(bodyText.includes(field), false, `no Run_Manifest field '${field}' in body`);
  }
}

// === 1. Valid token -> forward + Caller_Identity established ================

test("valid Auth_Token forwards exactly once and establishes Caller_Identity first", async () => {
  const { handler, forwards } = makeAuthedForward();
  const res = await handler(mcpRequest({ token: signToken(TEST_SECRET, { sub: "sess_xyz", entitledRunIds: ["run-1"] }) }));

  assert.equal(res.statusCode, 200, "valid token -> forward proceeds");
  assert.equal(forwards.length, 1, "exactly one MCP forward for a valid token");

  // R15.2 / Property 29: Caller_Identity established from claims BEFORE forward.
  const forwarded = forwards[0];
  assert.ok(forwarded.callerIdentity, "callerIdentity attached before forwarding");
  assert.equal(forwarded.callerIdentity.subject, "sess_xyz");
  assert.equal(forwarded.callerIdentity.principalId, "sess_xyz");
  assert.deepEqual(forwarded.callerIdentity.entitledRunIds, ["run-1"]);
  // The verified-claims seam is also present for downstream use.
  assert.equal(forwarded.auth.claims.sub, "sess_xyz");
});

// === 2-5. Rejection classes -> 401, NO forward, NO manifest disclosure ======

test("missing Auth_Token returns 401 and performs NO MCP forward", async () => {
  const { handler, forwards } = makeAuthedForward();
  const res = await handler(mcpRequest()); // no Authorization header
  assert.equal(res.statusCode, 401);
  assert.equal(JSON.parse(res.body).error, UNAUTHORIZED_ERROR);
  assert.equal(forwards.length, 0, "no forward on a missing token");
});

test("empty Bearer value (no token) returns 401 with no forward", async () => {
  const { handler, forwards } = makeAuthedForward();
  const res = await handler({ method: "POST", path: "/mcp", headers: { authorization: "Bearer " }, body: "{}" });
  assert.equal(res.statusCode, 401);
  assert.equal(forwards.length, 0);
});

test("malformed Auth_Token returns 401 and performs NO forward", async () => {
  const { handler, forwards } = makeAuthedForward();
  const res = await handler(mcpRequest({ token: "not-a-valid-jwt" }));
  assert.equal(res.statusCode, 401);
  assert.equal(forwards.length, 0);
});

test("a non-Bearer Authorization scheme returns 401 with no forward", async () => {
  const { handler, forwards } = makeAuthedForward();
  const res = await handler({ method: "POST", path: "/mcp", headers: { authorization: signToken() }, body: "{}" });
  assert.equal(res.statusCode, 401);
  assert.equal(forwards.length, 0);
});

test("bad-signature Auth_Token (wrong secret) returns 401 and performs NO forward", async () => {
  const { handler, forwards } = makeAuthedForward(); // server secret = TEST_SECRET
  const res = await handler(mcpRequest({ token: signToken(WRONG_SECRET) }));
  assert.equal(res.statusCode, 401);
  assert.equal(forwards.length, 0);
});

test("alg:none token is rejected (HS256 pinned) with no forward", async () => {
  const { handler, forwards } = makeAuthedForward();
  const noneToken = jwt.sign({ sub: "x", iat: FIXED_NOW_SEC, exp: FIXED_NOW_SEC + 3600 }, "", { algorithm: "none" });
  const res = await handler(mcpRequest({ token: noneToken }));
  assert.equal(res.statusCode, 401);
  assert.equal(forwards.length, 0);
});

test("expired Auth_Token returns 401 and performs NO forward", async () => {
  const { handler, forwards } = makeAuthedForward();
  const expired = signToken(TEST_SECRET, { iat: FIXED_NOW_SEC - 7200, exp: FIXED_NOW_SEC - 600 });
  const res = await handler(mcpRequest({ token: expired }));
  assert.equal(res.statusCode, 401);
  assert.equal(forwards.length, 0);
});

test("a token whose issuance age exceeds the configured window is expired (R15.8)", async () => {
  const forwards = [];
  const handler = withInboundAuth(
    async (request) => { forwards.push(request); return { statusCode: 200, headers: {}, body: "{}" }; },
    { secretProvider: createStaticSecretProvider(TEST_SECRET), clock: fixedClock, expiryWindowSeconds: 300 },
  );
  // iat is 10 min old but the token's own exp is far in the future; the 5-min
  // window must still reject it.
  const old = signToken(TEST_SECRET, { iat: FIXED_NOW_SEC - 600, exp: FIXED_NOW_SEC + 100000 });
  const res = await handler(mcpRequest({ token: old }));
  assert.equal(res.statusCode, 401);
  assert.equal(forwards.length, 0);
});

test("verified-claims-without-subject cannot establish identity -> 401, no forward", async () => {
  const { handler, forwards } = makeAuthedForward();
  // Sign a structurally valid token but with no `sub` claim.
  const noSub = jwt.sign({ iat: FIXED_NOW_SEC, exp: FIXED_NOW_SEC + 3600 }, TEST_SECRET, { algorithm: JWT_ALGORITHM });
  const res = await handler(mcpRequest({ token: noSub }));
  assert.equal(res.statusCode, 401);
  assert.equal(forwards.length, 0, "no forward when Caller_Identity cannot be established");
});

// === 6. Non-disclosure across all 401s (Property 28) ========================

test("every 401 body discloses no credential / config / Run_Manifest content", async () => {
  const { handler } = makeAuthedForward();
  const cases = [
    await handler(mcpRequest()),                                   // missing
    await handler(mcpRequest({ token: "garbage" })),               // malformed
    await handler(mcpRequest({ token: signToken(WRONG_SECRET) })), // bad signature
    await handler(mcpRequest({ token: signToken(TEST_SECRET, { iat: FIXED_NOW_SEC - 7200, exp: FIXED_NOW_SEC - 600 }) })), // expired
  ];
  for (const res of cases) {
    assert.equal(res.statusCode, 401);
    const payload = JSON.parse(res.body);
    assert.equal(payload.error, UNAUTHORIZED_ERROR);
    // Reason-agnostic: never say WHY (no missing/expired/signature/malformed leak).
    assert.equal(/expired|signature|malformed|missing/i.test(payload.message), false);
    assertNonDisclosing(res.body);
  }
});

// === 7. Auth != approval (R15.9 / Property 1) ===============================

test("a verified Auth_Token is forwarded as authenticated-but-unapproved; no approval substitution", async () => {
  // The forward seam stands in for the Cloudflare McpAgent boundary. The
  // inbound-auth layer must hand it a request carrying NO approval material and
  // perform NO approval logic of its own — every spend boundary stays gated
  // downstream. We assert the forwarded request has the auth seam but contains
  // no Approval_Token / approved-gate substitution injected by this tier.
  const { handler, forwards } = makeAuthedForward();
  const res = await handler(mcpRequest({ token: signToken() }));
  assert.equal(res.statusCode, 200);
  assert.equal(forwards.length, 1);

  const forwarded = forwards[0];
  // The tier adds ONLY `auth` + `callerIdentity`; it injects no approval token
  // and no approved gate state.
  assert.ok(forwarded.auth, "auth seam present");
  assert.ok(forwarded.callerIdentity, "callerIdentity present");
  assert.equal("approvalToken" in forwarded, false, "no Approval_Token injected by the auth tier");
  assert.equal("approvals" in forwarded, false, "no approvals injected by the auth tier");
  // The original request payload (which carries empty approvals) is forwarded
  // unchanged, so the downstream Approval_Gate still runs and would block.
  const params = JSON.parse(forwarded.body).params;
  assert.deepEqual(params.arguments.approvals, [], "forwarded approvals unchanged (still empty)");
});

// === 8. Server-side secret unavailable -> non-disclosing 500 (not 401) ======

test("an unavailable signing secret maps to a non-disclosing 500, not a 401", async () => {
  const forwards = [];
  const handler = withInboundAuth(
    async (request) => { forwards.push(request); return { statusCode: 200, headers: {}, body: "{}" }; },
    { secretProvider: createEnvSecretProvider({}, "AUTH_JWT_SECRET"), clock: fixedClock },
  );
  const res = await handler(mcpRequest({ token: signToken() }));
  assert.equal(res.statusCode, 500);
  const payload = JSON.parse(res.body);
  assert.equal(payload.error, "auth_unavailable");
  assert.equal(forwards.length, 0, "no forward when the secret is unavailable");
  assertNonDisclosing(res.body);
});

// === Construction guard =====================================================

test("withInboundAuth requires a forward seam function", () => {
  assert.throws(() => withInboundAuth(undefined, {}), TypeError);
  assert.throws(() => withInboundAuth("nope", {}), TypeError);
});

// === 9. Server entry routing: /mcp is auth-gated, other paths bypass ========
// (task 13.4 wiring at the entry of the AgentCore-hosted MCP server)

import { createRoutedHandler } from "../src/server.js";
import { MCP_PATH } from "../src/mcp-server.js";

/** A stand-in inner MCP handler that records whether it was reached. */
function makeInnerHandler() {
  const reached = [];
  const handler = async (req) => {
    reached.push(req.path);
    return { statusCode: 200, headers: { "content-type": "application/json" }, body: JSON.stringify({ ok: true, path: req.path }) };
  };
  return { handler, reached };
}

function mcpToolsCall({ token } = {}) {
  const req = { method: "POST", path: MCP_PATH, headers: {}, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) };
  if (token !== undefined) req.headers.authorization = `Bearer ${token}`;
  return req;
}

test("routing: POST /mcp without an Auth_Token is gated 401 and never reaches the MCP handler", async () => {
  const { handler, reached } = makeInnerHandler();
  const routed = createRoutedHandler({ handler, secretProvider: createStaticSecretProvider(TEST_SECRET), clock: fixedClock });
  const res = await routed(mcpToolsCall()); // no token
  assert.equal(res.statusCode, 401);
  assert.equal(reached.length, 0, "the MCP handler is never reached without a valid token");
});

test("routing: POST /mcp with a valid Auth_Token reaches the MCP handler once", async () => {
  const { handler, reached } = makeInnerHandler();
  const routed = createRoutedHandler({ handler, secretProvider: createStaticSecretProvider(TEST_SECRET), clock: fixedClock });
  const res = await routed(mcpToolsCall({ token: signToken() }));
  assert.equal(res.statusCode, 200);
  assert.deepEqual(reached, [MCP_PATH], "valid token -> handler reached once");
});

test("routing: a non-/mcp path (e.g. /ping liveness) bypasses auth and reaches the handler open", async () => {
  const { handler, reached } = makeInnerHandler();
  const routed = createRoutedHandler({ handler, secretProvider: createStaticSecretProvider(TEST_SECRET), clock: fixedClock });
  const res = await routed({ method: "GET", path: "/ping", headers: {}, body: "" }); // no token
  assert.equal(res.statusCode, 200, "open route reachable without an Auth_Token (R15.6 liveness)");
  assert.deepEqual(reached, ["/ping"]);
});
