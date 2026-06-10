// Server-side-only secret hygiene — build/CI assertion for the Agent-API tier
// (knowgrph-acos-mcp-connector spec, task 6.6 / R15.7 / design Agent_Api
// "Secret handling (R15.7)" + Authentication & Authorization layer).
//
// R15.7: Auth_Token verification material and any authentication secrets are
// SERVER-SIDE ONLY — never in the Frontend client bundle, the logs, or any
// Agent_Api response. The HS256 signing secret is read server-side only via the
// secret-provider seam (`auth-token.js`) and is referenced only by its env KEY
// NAME, never echoed (verified in 5.0 / 6.1).
//
// THIS suite is the deterministic build/CI assertion built on the reusable
// `secret-hygiene.js` scanner. It uses a KNOWN test secret, mints a real token
// with it, and asserts the secret NEVER surfaces:
//   1. in ANY Agent_Api response body/headers across the run/runs/health/
//      auth-session handlers, on SUCCESS and ERROR paths;
//   2. the signing secret is referenced only by env KEY NAME — no inlined
//      secret literal in the Agent_Api OR worker source trees;
//   3. no hard-coded auth secret literal exists in those tiers;
//   4. the frontend-bundle scan is a NO-OP PASS when no bundle exists yet, but
//      is structured to assert (and would catch a leak) the moment one lands.
//
// ZERO live network/AWS calls: all seams (secret provider, clock, forwarder,
// store, id generator) are injected; the known secret is used end-to-end and
// asserted absent from every surfaced output.

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { mintAuthToken, createStaticSecretProvider, createEnvSecretProvider } from "../src/lib/auth-token.js";
import { createAuthSessionHandler } from "../src/handlers/auth-session.js";
import { createHealthHandler } from "../src/handlers/health.js";
import { createAuthedRunHandler } from "../src/handlers/run.js";
import { createAuthedRunsHandler } from "../src/handlers/runs.js";
import { createInMemoryManifestStore } from "../src/lib/run-manifest-store.js";
import {
  responseContainsSecret,
  collectResponseText,
  findHardcodedSecretLiterals,
  scanSourceTreeForInlinedSecret,
  scanSourceTreeForHardcodedLiterals,
  scanBundleForSecret,
} from "../src/lib/secret-hygiene.js";

// --- Fixtures ----------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AGENT_API_SRC = path.resolve(HERE, "../src");
const WORKER_TIER = path.resolve(HERE, "../../../cloudflare/workers/knowgrph-mcp");

/**
 * A KNOWN, obviously-fake signing secret used ONLY in this suite. It is long
 * and high-entropy so the source-tree scan would flag it if anyone inlined it,
 * yet it is never a real credential. It must NEVER appear in any response.
 */
const KNOWN_SECRET = "hs256-test-only-secret-NEVER-REAL-9f3c1a7b8e2d4506aa11bb22cc33dd44";

/** Frozen wall clock so minted tokens are deterministically unexpired. */
const FIXED_NOW_MS = 1_700_000_000_000;
const fixedClock = () => FIXED_NOW_MS;

const secretProvider = createStaticSecretProvider(KNOWN_SECRET);

/** Mint a real Auth_Token signed with the known secret. */
async function mintToken({ entitledRunIds = [] } = {}) {
  const minted = await mintAuthToken({
    secretProvider,
    clock: fixedClock,
    idGenerator: () => "sess_test_fixed",
    entitledRunIds,
  });
  return minted.token;
}

function bearer(token) {
  return { authorization: `Bearer ${token}` };
}

// --- 1. Secret never appears in ANY Agent_Api response ----------------------

test("auth-session: secret never appears in success or error responses", async () => {
  const handler = createAuthSessionHandler({
    secretProvider,
    clock: fixedClock,
    idGenerator: () => "sess_test_fixed",
  });

  // Success (201): the response carries the signed token + non-secret metadata.
  const ok = await handler({ httpMethod: "POST", body: JSON.stringify({}) });
  assert.equal(ok.statusCode, 201);
  assert.ok(JSON.parse(ok.body).token, "mints a token");
  assert.equal(responseContainsSecret(ok, KNOWN_SECRET), false, "201 body must not echo the secret");

  // Error: wrong method (405), malformed JSON (400).
  const m405 = await handler({ httpMethod: "GET" });
  const b400 = await handler({ httpMethod: "POST", body: "{not-json" });
  assert.equal(m405.statusCode, 405);
  assert.equal(b400.statusCode, 400);
  assert.equal(responseContainsSecret(m405, KNOWN_SECRET), false);
  assert.equal(responseContainsSecret(b400, KNOWN_SECRET), false);

  // Error: signing secret unavailable (500) — must reveal nothing.
  const unavailable = createAuthSessionHandler({
    secretProvider: createEnvSecretProvider({}, "AUTH_JWT_SECRET"),
    clock: fixedClock,
  });
  const e500 = await unavailable({ httpMethod: "POST", body: JSON.stringify({}) });
  assert.equal(e500.statusCode, 500);
  assert.equal(responseContainsSecret(e500, KNOWN_SECRET), false);
  // The env KEY NAME is also not leaked into the response body.
  assert.equal(collectResponseText(e500).includes("AUTH_JWT_SECRET"), false);
});

test("POST /run: secret never appears across 401 / 400 / 202 responses", async () => {
  const token = await mintToken();
  const handler = createAuthedRunHandler({
    secretProvider,
    clock: fixedClock,
    run: { onValidRequest: () => ({ accepted: true, runId: "run_xyz" }) },
  });

  // 401 — no Auth_Token.
  const u401 = await handler({ httpMethod: "POST", body: JSON.stringify(validRunBody()) });
  assert.equal(u401.statusCode, 401);

  // 400 — authenticated but schema invalid.
  const b400 = await handler({
    httpMethod: "POST",
    headers: bearer(token),
    body: JSON.stringify({ referenceUrl: "not-a-url" }),
  });
  assert.equal(b400.statusCode, 400);

  // 202 — authenticated + valid body forwards (fake seam).
  const ok = await handler({
    httpMethod: "POST",
    headers: bearer(token),
    body: JSON.stringify(validRunBody()),
  });
  assert.equal(ok.statusCode, 202);

  for (const res of [u401, b400, ok]) {
    assert.equal(responseContainsSecret(res, KNOWN_SECRET), false, `secret leaked in ${res.statusCode} response`);
  }
});

test("GET /runs/{id}: secret never appears across 401 / 404 / 200 responses", async () => {
  const entitledRun = "run_entitled_1";
  const token = await mintToken({ entitledRunIds: [entitledRun] });
  const store = createInMemoryManifestStore({
    [entitledRun]: { runId: entitledRun, state: "completed", stages: [], approvalGates: [] },
    run_other: { runId: "run_other", state: "running", stages: [] },
  });
  const handler = createAuthedRunsHandler({ secretProvider, clock: fixedClock, runs: { store } });

  // 401 — no token.
  const u401 = await handler({ httpMethod: "GET", pathParameters: { id: entitledRun } });
  assert.equal(u401.statusCode, 401);

  // 404 — authenticated but unentitled (run exists, not in entitledRunIds).
  const f404 = await handler({ httpMethod: "GET", headers: bearer(token), pathParameters: { id: "run_other" } });
  assert.equal(f404.statusCode, 404);

  // 200 — entitled read.
  const ok = await handler({ httpMethod: "GET", headers: bearer(token), pathParameters: { id: entitledRun } });
  assert.equal(ok.statusCode, 200);

  for (const res of [u401, f404, ok]) {
    assert.equal(responseContainsSecret(res, KNOWN_SECRET), false, `secret leaked in ${res.statusCode} response`);
  }
});

test("GET /health: open liveness response never carries the secret", () => {
  const res = createHealthHandler()({ httpMethod: "GET", headers: bearer("anything") });
  assert.equal(res.statusCode, 200);
  assert.equal(responseContainsSecret(res, KNOWN_SECRET), false);
});

// --- 2 & 3. Source-tree scans: key-name-only, no inlined secret literal -----

test("Agent-API source references the secret only by KEY NAME (no inlined literal)", () => {
  const inlined = scanSourceTreeForInlinedSecret(AGENT_API_SRC, KNOWN_SECRET);
  assert.equal(inlined.scanned, true, "Agent-API src must be scanned");
  assert.ok(inlined.files.length > 0, "scanned at least one source file");
  assert.deepEqual(inlined.hits, [], "no source file may inline the known secret");

  const literals = scanSourceTreeForHardcodedLiterals(AGENT_API_SRC);
  assert.equal(literals.scanned, true);
  assert.deepEqual(
    literals.findings,
    [],
    `no hard-coded auth secret literal allowed; found: ${JSON.stringify(literals.findings)}`,
  );
});

test("worker tier carries no inlined auth secret / hard-coded secret literal", () => {
  const inlined = scanSourceTreeForInlinedSecret(WORKER_TIER, KNOWN_SECRET, {
    extensions: [".js", ".mjs", ".cjs", ".ts", ".tsx"],
  });
  // The worker tier exists in this repo; assert it is scanned and clean.
  assert.equal(inlined.scanned, true, "worker tier must be present and scanned");
  assert.deepEqual(inlined.hits, [], "worker source must not inline the known secret");

  const literals = scanSourceTreeForHardcodedLiterals(WORKER_TIER, {
    extensions: [".js", ".mjs", ".cjs", ".ts", ".tsx"],
  });
  assert.deepEqual(
    literals.findings,
    [],
    `worker tier must hold no hard-coded auth secret literal; found: ${JSON.stringify(literals.findings)}`,
  );
});

test("literal detector flags an inlined secret but allows env KEY-NAME references", () => {
  // Positive: an actual inlined secret value is flagged.
  const leaky = `const jwtSecret = "${KNOWN_SECRET}";`;
  const found = findHardcodedSecretLiterals(leaky);
  assert.equal(found.length, 1);
  assert.equal(found[0].identifier, "jwtSecret");

  // Negative: referencing the secret by KEY NAME / env is NOT a finding (R15.7).
  const clean = [
    'const key = "AUTH_JWT_SECRET";',
    'const secret = process.env.AUTH_JWT_SECRET;',
    'const apiKey = env["AUTH_JWT_SECRET"];',
    'const password = "";',
  ].join("\n");
  assert.deepEqual(findHardcodedSecretLiterals(clean), []);
});

// --- 4. Frontend bundle scan: no-op pass today, tightens when it lands -------

test("frontend bundle scan no-op passes when no bundle exists yet", () => {
  const candidateDirs = [
    path.resolve(HERE, "../../../apps/web/.next"),
    path.resolve(HERE, "../../../apps/web/dist"),
    path.resolve(HERE, "../../../../agentic-canvas-os/apps/web/.next"),
    path.resolve(HERE, "../../../../agentic-canvas-os/apps/web/dist"),
  ];
  const result = scanBundleForSecret({ bundleDirs: candidateDirs, secret: KNOWN_SECRET });

  // Today: no bundle present -> vacuous, structured pass.
  assert.equal(result.present, false, "no frontend bundle is expected yet (Section 7)");
  assert.equal(result.leaked, false, "the bundle assertion holds (vacuously) today");
});

test("frontend bundle scan TIGHTENS to catch a leak once a bundle is present", () => {
  // Structural proof the same reusable check asserts a real leak when a bundle
  // exists: scanning a directory that DOES exist and contains the secret would
  // report `leaked: true`. We use the Agent-API __tests__ dir as a stand-in
  // "present bundle" and this very test file (which contains KNOWN_SECRET) as
  // the artifact, confirming the detector is not vacuously passing.
  const result = scanBundleForSecret({
    bundleDirs: [HERE],
    secret: KNOWN_SECRET,
    extensions: [".mjs"],
  });
  assert.equal(result.present, true, "a present bundle dir is scanned");
  assert.equal(result.leaked, true, "a secret in a present bundle artifact IS caught");
  assert.ok(result.hits.length >= 1, "the offending artifact is reported");
});

// --- Helpers -----------------------------------------------------------------

function validRunBody() {
  return {
    referenceUrl: "https://example.com/reference-video",
    brief: "Remix this reference into a 15s vertical promo.",
    budgetUsd: 12.5,
    approvals: [],
  };
}
