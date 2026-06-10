// STATIC-SCAN SMOKE — no auth secret in the Frontend client bundle, logs, or
// responses (knowgrph-acos-mcp-connector spec, task 9.3 / R15.7, R14.1 /
// design Agent_Api "Secret handling (R15.7)": Auth_Token verification material
// and all authentication secrets are SERVER-SIDE ONLY — never in the client
// bundle, logs, or any response).
//
// The Frontend (web/) attaches the caller's Auth_Token to its requests but
// holds NONE of the server-side verification material: the HS256 signing secret
// lives only in the Agent_Api (AWS Secrets Manager / Lambda env). This suite is
// the Frontend-tier slice of that guarantee:
//   1. the real Frontend source tree (web/src) carries NO hard-coded auth
//      secret literal;
//   2. the built Frontend bundle (task 11.3 Vercel build target -> web/dist)
//      carries no auth secret — a REAL, non-vacuous scan of the emitted
//      artifacts (and still holds vacuously on a fresh checkout before a build);
//   3. the scan is MEANINGFUL: the same detector catches a PLANTED inlined
//      secret and a planted secret inside a PRESENT bundle artifact.
//
// REUSE-NOT-REBUILD: every check is the reusable `secret-hygiene.js` scanner
// (aws/agent-api/src/lib) — no fork. ZERO live network/AWS calls.

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  findHardcodedSecretLiterals,
  scanSourceTreeForHardcodedLiterals,
  scanBundleForSecret,
  responseContainsSecret,
} from "../aws/agent-api/src/lib/secret-hygiene.js";
import { FRONTEND_SRC_ROOT, FRONTEND_BUNDLE_DIRS } from "./lib/cross-tier-scan.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** A KNOWN, obviously-fake auth signing secret used ONLY by this suite. */
const KNOWN_AUTH_SECRET = "hs256-frontend-smoke-secret-NEVER-REAL-0a1b2c3d4e5f60718293a4b5c6d7e8f9";

// --- 1. Frontend source tree carries NO hard-coded auth secret literal ------

test("web/src holds no hard-coded auth secret literal (R15.7)", () => {
  const result = scanSourceTreeForHardcodedLiterals(FRONTEND_SRC_ROOT);
  assert.equal(result.scanned, true, "web/src must be present and scanned");
  assert.ok(result.files.length > 0, "scanned at least one Frontend source file");
  assert.deepEqual(
    result.findings,
    [],
    `the Frontend tier must hold no auth secret literal; found: ${JSON.stringify(result.findings, null, 2)}`,
  );
});

// --- 2. Frontend bundle scan: REAL, non-vacuous pass against the built bundle -

test("the built Frontend bundle carries no auth secret (R15.7)", () => {
  const result = scanBundleForSecret({
    bundleDirs: [...FRONTEND_BUNDLE_DIRS],
    secret: KNOWN_AUTH_SECRET,
  });
  // The Vercel build target (task 11.3) emits a static bundle to web/dist, so
  // this scan TIGHTENS from the former vacuous pass into a REAL assertion: the
  // built artifacts are scanned and must carry no auth secret (R15.7).
  assert.equal(result.leaked, false, "the built Frontend bundle must carry no auth secret");
  if (result.present) {
    // A built bundle is present: prove the scan is non-vacuous — it actually
    // walked real artifacts rather than passing because there was nothing.
    assert.ok(result.files.length > 0, "the present bundle was scanned (non-vacuous)");
    assert.deepEqual(result.hits, [], "no built artifact carries the auth secret");
  }
  // When no bundle has been built yet (fresh checkout, no `npm run build`), the
  // scan still holds vacuously and tightens automatically once a bundle lands.
});

// --- 3. The scan is MEANINGFUL (not vacuously passing) -----------------------

test("detector catches a PLANTED inlined auth secret literal", () => {
  const leaky = `const jwtSigningSecret = "${KNOWN_AUTH_SECRET}";`;
  const found = findHardcodedSecretLiterals(leaky);
  assert.equal(found.length, 1, "a planted inlined secret literal must be caught");
  assert.equal(found[0].identifier, "jwtSigningSecret");
});

test("bundle scan TIGHTENS to catch a secret inside a PRESENT bundle artifact", () => {
  // Use this __smoke__ dir as a stand-in "present bundle": this test file
  // contains KNOWN_AUTH_SECRET, so a present-bundle scan must report a leak —
  // proving the same reusable check is not vacuously passing.
  const result = scanBundleForSecret({
    bundleDirs: [HERE],
    secret: KNOWN_AUTH_SECRET,
    extensions: [".mjs"],
  });
  assert.equal(result.present, true, "a present bundle dir is scanned");
  assert.equal(result.leaked, true, "a secret in a present bundle artifact IS caught");
  assert.ok(result.hits.length >= 1, "the offending artifact is reported");
});

test("a simulated Frontend response/log never carries the auth secret", () => {
  // The Frontend only ever attaches the caller's Auth_Token (a bearer it was
  // handed) and renders Run_Manifest data — never the server-side signing
  // secret. Simulate the surfaces a leak could occur on and assert absence.
  const responseLike = {
    statusCode: 200,
    headers: { "content-type": "application/json", authorization: "Bearer caller.jwt.token" },
    body: JSON.stringify({ runId: "run_123", state: "running", budgetMeters: { estimatedCostUsd: 0 } }),
  };
  const logLine = "[frontend] submitted run run_123 with Auth_Token (redacted) to POST /run";
  assert.equal(responseContainsSecret(responseLike, KNOWN_AUTH_SECRET), false);
  assert.equal(responseContainsSecret(logLine, KNOWN_AUTH_SECRET), false);
});
