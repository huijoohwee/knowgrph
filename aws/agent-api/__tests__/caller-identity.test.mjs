// Tests for Caller_Identity establishment from a verified Auth_Token
// (knowgrph-acos-mcp-connector spec, task 6.2 / R15.2 / design Caller_Identity
// data model + Correctness Property 29 basis).
//
// Property 29 (basis): for any authenticated Caller_Identity established from a
// valid Auth_Token, the identity carries the principal (subject/principalId)
// and `entitledRunIds` that downstream run-manifest authorization (task 6.4)
// reads. This task establishes that identity STRICTLY BEFORE any further
// processing (MCP forward / manifest read).
//
// Focused behaviors (all with ZERO live network/AWS calls — injected static
// secret provider + a fixed clock; test tokens are signed with the SAME
// secret):
//   1. buildCallerIdentity derives subject/principalId, entitledRunIds (array),
//      issuedAt, and expiryWindowSeconds from verified claims (unit).
//   2. a valid token establishes event.callerIdentity for the wrapped handler.
//   3. the Caller_Identity is established STRICTLY BEFORE the handler forwards /
//      reads (ordering).
//   4. an invalid token => no Caller_Identity, handler NOT run, HTTP 401.
//   5. a verified-but-subjectless token => no Caller_Identity, 401.

import test from "node:test";
import assert from "node:assert/strict";

import jwt from "jsonwebtoken";

import {
  buildCallerIdentity,
  isEntitledToRun,
  CallerIdentityError,
} from "../src/lib/caller-identity.js";
import { withAuth, UNAUTHORIZED_ERROR } from "../src/lib/auth-verify.js";
import { createStaticSecretProvider, JWT_ALGORITHM } from "../src/lib/auth-token.js";

// --- Fixtures ---------------------------------------------------------------

const FIXED_NOW_MS = 1_700_000_000_000;
const FIXED_NOW_SEC = Math.floor(FIXED_NOW_MS / 1000);
const TEST_SECRET = "test-signing-secret-do-not-log";
const WRONG_SECRET = "a-different-secret-entirely";

const fixedClock = () => FIXED_NOW_MS;

/** Sign a valid HS256 Auth_Token with the given secret + claim overrides. */
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

function postRunEvent({ token } = {}) {
  const event = { httpMethod: "POST", path: "/run", headers: {}, body: "{}" };
  if (token !== undefined) event.headers.authorization = `Bearer ${token}`;
  return event;
}

const secretProvider = createStaticSecretProvider(TEST_SECRET);

// === 1. buildCallerIdentity unit coverage ===================================

test("buildCallerIdentity derives subject/principalId, entitledRunIds, issuedAt, expiryWindowSeconds", () => {
  const id = buildCallerIdentity({
    sub: "sess_xyz",
    entitledRunIds: ["run-1", "run-2"],
    iat: FIXED_NOW_SEC,
    exp: FIXED_NOW_SEC + 3600,
  });

  assert.equal(id.subject, "sess_xyz");
  assert.equal(id.principalId, "sess_xyz", "principalId aliases subject (design field)");
  assert.deepEqual(id.entitledRunIds, ["run-1", "run-2"]);
  assert.equal(id.issuedAt, FIXED_NOW_SEC);
  assert.equal(id.expiryWindowSeconds, 3600, "exp - iat");
});

test("buildCallerIdentity de-duplicates entitledRunIds and drops non-strings/empties", () => {
  const id = buildCallerIdentity({
    sub: "s",
    entitledRunIds: ["run-1", "run-1", "", 42, null, "run-2"],
    iat: FIXED_NOW_SEC,
    exp: FIXED_NOW_SEC + 600,
  });
  assert.deepEqual(id.entitledRunIds, ["run-1", "run-2"]);
});

test("buildCallerIdentity defaults entitledRunIds to [] for a fresh session (R15.4)", () => {
  const id = buildCallerIdentity({ sub: "s", iat: FIXED_NOW_SEC, exp: FIXED_NOW_SEC + 600 });
  assert.deepEqual(id.entitledRunIds, []);
});

test("buildCallerIdentity yields null issuedAt/expiryWindow when timestamps are absent or non-sensical", () => {
  const noTimes = buildCallerIdentity({ sub: "s" });
  assert.equal(noTimes.issuedAt, null);
  assert.equal(noTimes.expiryWindowSeconds, null);

  const badWindow = buildCallerIdentity({ sub: "s", iat: FIXED_NOW_SEC, exp: FIXED_NOW_SEC });
  assert.equal(badWindow.expiryWindowSeconds, null, "exp <= iat => null window");
});

test("buildCallerIdentity returns a frozen, non-mutable identity", () => {
  const id = buildCallerIdentity({ sub: "s", iat: FIXED_NOW_SEC, exp: FIXED_NOW_SEC + 600 });
  assert.equal(Object.isFrozen(id), true);
});

test("buildCallerIdentity throws CallerIdentityError when no subject can be established", () => {
  assert.throws(() => buildCallerIdentity({ iat: FIXED_NOW_SEC, exp: FIXED_NOW_SEC + 600 }), CallerIdentityError);
  assert.throws(() => buildCallerIdentity({ sub: "" }), CallerIdentityError);
  assert.throws(() => buildCallerIdentity(null), CallerIdentityError);
});

test("isEntitledToRun reflects the established entitlement set", () => {
  const id = buildCallerIdentity({ sub: "s", entitledRunIds: ["run-1"], iat: FIXED_NOW_SEC, exp: FIXED_NOW_SEC + 600 });
  assert.equal(isEntitledToRun(id, "run-1"), true);
  assert.equal(isEntitledToRun(id, "run-2"), false);
  assert.equal(isEntitledToRun(id, ""), false);
  assert.equal(isEntitledToRun({}, "run-1"), false);
});

// === 2. A valid token establishes event.callerIdentity =====================

test("withAuth: a valid token establishes Caller_Identity on the event for the handler", async () => {
  let seen;
  const handler = withAuth((event) => {
    seen = event.callerIdentity;
    return { statusCode: 200, headers: {}, body: "{}" };
  }, { secretProvider, clock: fixedClock });

  const token = signToken(TEST_SECRET, {
    sub: "sess_abc",
    entitledRunIds: ["run-7"],
    iat: FIXED_NOW_SEC,
    exp: FIXED_NOW_SEC + 3600,
  });
  const res = await handler(postRunEvent({ token }));

  assert.equal(res.statusCode, 200);
  assert.ok(seen, "event.callerIdentity is present for the handler");
  assert.equal(seen.subject, "sess_abc");
  assert.equal(seen.principalId, "sess_abc");
  assert.deepEqual(seen.entitledRunIds, ["run-7"]);
  assert.equal(seen.issuedAt, FIXED_NOW_SEC);
  assert.equal(seen.expiryWindowSeconds, 3600);
});

test("withAuth: the raw event.auth.claims seam is retained alongside event.callerIdentity", async () => {
  let seen;
  const handler = withAuth((event) => {
    seen = event;
    return { statusCode: 200, headers: {}, body: "{}" };
  }, { secretProvider, clock: fixedClock });

  await handler(postRunEvent({ token: signToken(TEST_SECRET, { sub: "sess_q" }) }));
  assert.equal(seen.auth.claims.sub, "sess_q", "backward-compatible auth.claims seam");
  assert.equal(seen.callerIdentity.subject, "sess_q");
});

// === 3. Caller_Identity established STRICTLY BEFORE forward / read ==========

test("withAuth: Caller_Identity is established BEFORE the handler forwards/reads (ordering)", async () => {
  const events = [];
  // The wrapped handler models the downstream forward (run) / store read (runs).
  // It records whether the identity was already present at the instant it
  // "forwards" — proving establishment happened strictly first.
  const handler = withAuth(async (event) => {
    // entry: identity must already be on the event
    events.push({ step: "handler-entry", hasIdentity: Boolean(event.callerIdentity) });
    // simulate the MCP forward / manifest read happening inside the handler
    await Promise.resolve();
    events.push({ step: "forward", hasIdentity: Boolean(event.callerIdentity) });
    return { statusCode: 202, headers: {}, body: "{}" };
  }, { secretProvider, clock: fixedClock });

  const res = await handler(postRunEvent({ token: signToken() }));
  assert.equal(res.statusCode, 202);
  assert.deepEqual(events, [
    { step: "handler-entry", hasIdentity: true },
    { step: "forward", hasIdentity: true },
  ], "identity present at handler entry and at the forward boundary");
});

// === 4. Invalid token => no Caller_Identity, handler not run, 401 ==========

test("withAuth: an invalid-signature token establishes NO Caller_Identity and the handler is NOT run (401)", async () => {
  let ran = false;
  const handler = withAuth((event) => {
    ran = true;
    return { statusCode: 200, headers: {}, body: JSON.stringify({ id: event.callerIdentity }) };
  }, { secretProvider, clock: fixedClock });

  const res = await handler(postRunEvent({ token: signToken(WRONG_SECRET) }));
  assert.equal(res.statusCode, 401);
  assert.equal(JSON.parse(res.body).error, UNAUTHORIZED_ERROR);
  assert.equal(ran, false, "no Caller_Identity, handler never invoked");
});

test("withAuth: a missing token establishes NO Caller_Identity and the handler is NOT run (401)", async () => {
  let ran = false;
  const handler = withAuth(() => { ran = true; return { statusCode: 200, headers: {}, body: "{}" }; },
    { secretProvider, clock: fixedClock });
  const res = await handler(postRunEvent()); // no Authorization header
  assert.equal(res.statusCode, 401);
  assert.equal(ran, false);
});

test("withAuth: an expired token establishes NO Caller_Identity and the handler is NOT run (401)", async () => {
  let ran = false;
  const handler = withAuth(() => { ran = true; return { statusCode: 200, headers: {}, body: "{}" }; },
    { secretProvider, clock: fixedClock });
  const expired = signToken(TEST_SECRET, { iat: FIXED_NOW_SEC - 7200, exp: FIXED_NOW_SEC - 600 });
  const res = await handler(postRunEvent({ token: expired }));
  assert.equal(res.statusCode, 401);
  assert.equal(ran, false);
});

// === 5. Verified-but-subjectless token => no Caller_Identity, 401 ==========

test("withAuth: a verified token with NO subject cannot establish identity => 401, handler NOT run", async () => {
  let ran = false;
  const reasons = [];
  const handler = withAuth(() => { ran = true; return { statusCode: 200, headers: {}, body: "{}" }; }, {
    secretProvider,
    clock: fixedClock,
    onAuthFailure: ({ reason }) => reasons.push(reason),
  });

  // A correctly-signed, unexpired token that simply lacks `sub`.
  const subjectless = jwt.sign(
    { entitledRunIds: [], iat: FIXED_NOW_SEC, exp: FIXED_NOW_SEC + 3600 },
    TEST_SECRET,
    { algorithm: JWT_ALGORITHM },
  );
  const res = await handler(postRunEvent({ token: subjectless }));

  assert.equal(res.statusCode, 401, "identity-less request must not proceed");
  assert.equal(ran, false, "handler never invoked when no principal can be established");
  assert.deepEqual(reasons, ["identity_unestablished"], "failure reason is server-side only");
});
