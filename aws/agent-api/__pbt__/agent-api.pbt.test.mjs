// =============================================================================
// Property-based tests — AWS Agent-API tier (spec task 9.1).
// Properties 6, 24, 28, 29, 30, 31. fast-check, >=100 runs each. Auth secrets,
// manifest store, and clock are injected via the tier's deterministic seams, so
// ZERO live network/AWS calls occur (tokens are signed in-process).
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";

import { validateRunRequest } from "../src/lib/run-request-schema.js";
import {
  mapMcpErrorToManifest,
  MCP_ERROR_DISPOSITION,
  MCP_APPROVAL_REQUIRED_STATUS,
} from "../src/lib/mcp-error-mapping.js";
import {
  mintAuthToken,
  createStaticSecretProvider,
  resolveExpiryWindowSeconds,
  MIN_EXPIRY_WINDOW_SECONDS,
  MAX_EXPIRY_WINDOW_SECONDS,
  DEFAULT_EXPIRY_WINDOW_SECONDS,
} from "../src/lib/auth-token.js";
import { withAuth, isWithinExpiryWindow } from "../src/lib/auth-verify.js";
import { createRunsHandler } from "../src/handlers/runs.js";
import { createInMemoryManifestStore } from "../src/lib/run-manifest-store.js";
import { createHealthHandler } from "../src/handlers/health.js";
import {
  createConcurrencyLimiter,
  RETRY_AFTER_MIN_SECONDS,
  RETRY_AFTER_MAX_SECONDS,
} from "../src/lib/concurrency-limiter.js";

// Shared, boundary-focused edge-case generators (spec task 9.4). Imported from
// the canonical mcp PBT arbitraries module so every tier consumes one source of
// truth rather than re-deriving generators.
import {
  authTokenStateArb,
  expiryWindowBoundaryArb,
  tokenAgeAroundExpiryArb,
  concurrencyAroundLimitArb,
} from "../../../mcp/__pbt__/arbitraries.mjs";

const RUNS = 150;
const SECRET = "test-signing-secret-aaaaaaaaaaaaaaaa";
const OTHER_SECRET = "different-secret-bbbbbbbbbbbbbbbbbbbb";
const NOW_MS = 1_700_000_000_000;

const wordArb = fc.string({ minLength: 1, maxLength: 16 }).map((s) => s.replace(/[^A-Za-z0-9]/g, "x") || "x");

// -----------------------------------------------------------------------------
// Feature: knowgrph-acos-mcp-connector, Property 6: For any POST /run request, it is forwarded to the Mcp_Agent iff it satisfies the schema (referenceUrl absolute URL <= 2,048 chars, brief 1-10,000 chars, budgetUsd in [0.01, 999,999,999.99], approvals[] 0-100 entries); any request failing the schema yields an HTTP 4xx naming each invalid field and reason, and no MCP call is forwarded.
// -----------------------------------------------------------------------------
test("Property 6: Agent_Api schema validation and forwarding decision", () => {
  const validBody = fc.record({
    referenceUrl: fc.constantFrom("https://example.com/v", "http://ref.test/a/b"),
    brief: fc.string({ minLength: 1, maxLength: 200 }).map((s) => (s.length >= 1 ? s : "brief")),
    budgetUsd: fc.double({ min: 0.01, max: 999_999_999.99, noNaN: true, noDefaultInfinity: true }).map((n) => Number(n.toFixed(2))),
    approvals: fc.array(wordArb, { maxLength: 5 }),
  });
  fc.assert(
    fc.property(validBody, (body) => {
      const r = validateRunRequest(body);
      assert.equal(r.valid, true, JSON.stringify(r.errors));
    }),
    { numRuns: RUNS },
  );

  // Invalid bodies: each carries the field expected to be named in the 4xx.
  const invalidArb = fc.oneof(
    fc.constant({ body: { brief: "ok", budgetUsd: 1 }, field: "referenceUrl" }),
    fc.constant({ body: { referenceUrl: "not-a-url", brief: "ok", budgetUsd: 1 }, field: "referenceUrl" }),
    fc.constant({ body: { referenceUrl: "ftp://x.co/a", brief: "ok", budgetUsd: 1 }, field: "referenceUrl" }),
    fc.constant({ body: { referenceUrl: "https://x.co", budgetUsd: 1 }, field: "brief" }),
    fc.constant({ body: { referenceUrl: "https://x.co", brief: "", budgetUsd: 1 }, field: "brief" }),
    fc.constant({ body: { referenceUrl: "https://x.co", brief: "ok", budgetUsd: 0 }, field: "budgetUsd" }),
    fc.constant({ body: { referenceUrl: "https://x.co", brief: "ok", budgetUsd: 1_000_000_000 }, field: "budgetUsd" }),
    fc.constant({ body: { referenceUrl: "https://x.co", brief: "ok", budgetUsd: 1, approvals: new Array(101).fill("g") }, field: "approvals" }),
  );
  fc.assert(
    fc.property(invalidArb, ({ body, field }) => {
      const r = validateRunRequest(body);
      assert.equal(r.valid, false);
      assert.ok(r.errors.some((e) => e.field === field || e.field.startsWith(field)));
      assert.ok(r.errors.every((e) => typeof e.reason === "string" && e.reason.length > 0));
    }),
    { numRuns: 100 },
  );

  // Saturation arm of the SAME POST /run forwarding-decision pipeline (R12.4):
  // a schema-valid request is forwarded only while the in-flight count is below
  // the configured concurrency limit; at/over it the adapter rejects (503 +
  // retry-after in [1,120]) without forwarding. The in-flight count straddles
  // the limit via the shared boundary generator (spec task 9.4).
  fc.assert(
    fc.property(concurrencyAroundLimitArb, ({ maxConcurrency, inFlight, expectSaturated }) => {
      const limiter = createConcurrencyLimiter({ maxConcurrency });
      const held = [];
      for (let i = 0; i < inFlight; i += 1) {
        const slot = limiter.tryAcquire();
        if (slot.admitted) held.push(slot);
      }
      const decision = limiter.tryAcquire();
      if (expectSaturated) {
        assert.equal(decision.admitted, false);
        assert.ok(decision.retryAfterSeconds >= RETRY_AFTER_MIN_SECONDS);
        assert.ok(decision.retryAfterSeconds <= RETRY_AFTER_MAX_SECONDS);
      } else {
        assert.equal(decision.admitted, true);
        decision.release();
      }
      held.forEach((s) => s.release());
    }),
    { numRuns: RUNS },
  );
});

// -----------------------------------------------------------------------------
// Feature: knowgrph-acos-mcp-connector, Property 24: For any typed MCP error returned by the Mcp_Agent, the Agent_Api maps it either to a gate prompt or to a failure record in the Run_Manifest and preserves the existing Run_Manifest state for that run.
// -----------------------------------------------------------------------------
test("Property 24: typed MCP error mapping preserves manifest state", () => {
  const manifestArb = fc.record({
    runId: wordArb,
    state: fc.constantFrom("running", "approval_required", "blocked", "completed"),
    approvalGates: fc.constant([]),
    failures: fc.constant([]),
  });
  const errorArb = fc.oneof(
    // approval-required (gate prompt)
    fc.record({
      kind: fc.constant("gate"),
      gateId: fc.constantFrom("paid-model-call", "render-action", "payment-action"),
    }).map((e) => ({ mcpError: { code: -32000, message: "approval required", data: { status: MCP_APPROVAL_REQUIRED_STATUS, gateId: e.gateId } }, expect: MCP_ERROR_DISPOSITION.GATE_PROMPT })),
    // generic typed error (failure record)
    fc.record({ message: fc.string({ minLength: 1, maxLength: 20 }), stageId: fc.constantFrom("research", "render", "checkout") })
      .map((e) => ({ mcpError: { code: -32001, message: e.message || "err", data: { stageId: e.stageId } }, expect: MCP_ERROR_DISPOSITION.FAILURE_RECORD })),
    // no error -> unchanged
    fc.constant({ mcpError: null, expect: MCP_ERROR_DISPOSITION.UNCHANGED }),
  );
  fc.assert(
    fc.property(manifestArb, errorArb, (manifest, { mcpError, expect }) => {
      const before = JSON.parse(JSON.stringify(manifest));
      const out = mapMcpErrorToManifest(manifest, mcpError, { stageId: "render" });
      assert.equal(out.disposition, expect);
      // Existing Run_Manifest state preserved (never overwritten).
      assert.equal(out.manifest.state, before.state);
      assert.equal(out.manifest.runId, before.runId);
      // Input manifest is never mutated.
      assert.deepEqual(manifest, before);
      if (expect === MCP_ERROR_DISPOSITION.GATE_PROMPT) {
        assert.ok(out.manifest.approvalGates.some((g) => g.approvalState === "pending"));
      } else if (expect === MCP_ERROR_DISPOSITION.FAILURE_RECORD) {
        assert.equal(out.manifest.failures.length, before.failures.length + 1);
      }
    }),
    { numRuns: RUNS },
  );
});

// -----------------------------------------------------------------------------
// Feature: knowgrph-acos-mcp-connector, Property 28: For any request to POST /run or GET /runs/{id} carrying a missing, malformed, invalid-signature, or expired Auth_Token, the Agent_Api responds with HTTP 401, performs no MCP forwarding, discloses no Run_Manifest data, and returns an error that reveals neither credential contents nor internal configuration.
// -----------------------------------------------------------------------------
test("Property 28: Agent_Api authentication rejection", async () => {
  const secretProvider = createStaticSecretProvider(SECRET);
  const clock = () => NOW_MS;

  await fc.assert(
    fc.asyncProperty(
      authTokenStateArb,
      wordArb,
      async (state, sub) => {
        let handlerCalls = 0;
        const inner = () => {
          handlerCalls += 1;
          return { statusCode: 200, headers: {}, body: JSON.stringify({ ok: true, secretRun: "manifest-data" }) };
        };
        const handler = withAuth(inner, { secretProvider, clock });

        let authHeader;
        if (state === "valid") {
          const { token } = await mintAuthToken({ secretProvider, clock, sessionId: `sess_${sub}` });
          authHeader = `Bearer ${token}`;
        } else if (state === "missing") {
          authHeader = undefined;
        } else if (state === "malformed") {
          authHeader = "Bearer not-a-jwt";
        } else if (state === "bad-signature") {
          const { token } = await mintAuthToken({ secretProvider: createStaticSecretProvider(OTHER_SECRET), clock, sessionId: `sess_${sub}` });
          authHeader = `Bearer ${token}`;
        } else {
          // expired: minted in the past, verified far beyond its window.
          const { token } = await mintAuthToken({
            secretProvider,
            clock: () => NOW_MS - 7200_000,
            expiryWindowSeconds: 300,
            sessionId: `sess_${sub}`,
          });
          authHeader = `Bearer ${token}`;
        }

        const event = { httpMethod: "POST", headers: authHeader ? { Authorization: authHeader } : {} };
        const res = await handler(event);

        if (state === "valid") {
          assert.equal(res.statusCode, 200);
          assert.equal(handlerCalls, 1);
        } else {
          assert.equal(res.statusCode, 401);
          assert.equal(handlerCalls, 0, "wrapped handler must not run -> no MCP forward / manifest read");
          const body = JSON.parse(res.body);
          // No Run_Manifest data, no credential/config disclosure.
          assert.equal(body.error, "unauthorized");
          assert.equal("manifest" in body, false);
          assert.ok(!JSON.stringify(body).includes(SECRET));
          assert.ok(!JSON.stringify(body).includes("manifest-data"));
        }
      },
    ),
    { numRuns: RUNS },
  );
});

// -----------------------------------------------------------------------------
// Feature: knowgrph-acos-mcp-connector, Property 29: For any authenticated Caller_Identity established from a valid Auth_Token, a GET /runs/{id} returns the Run_Manifest iff that identity is entitled to the run; for a run the identity is not entitled to (including unknown runs), the response is HTTP 403 or 404 with no Run_Manifest content and a recorded denied-access attempt, so no run data crosses tenant boundaries.
// -----------------------------------------------------------------------------
test("Property 29: cross-tenant run-manifest authorization", async () => {
  await fc.assert(
    fc.asyncProperty(
      wordArb,
      fc.array(wordArb, { maxLength: 4 }),
      fc.boolean(),
      fc.boolean(),
      async (runId, otherEntitled, runExists, entitled) => {
        const seededRunId = `run-${runId}`;
        const manifest = { runId: seededRunId, state: "completed", stages: [], approvalGates: [], budgetMeters: {} };
        const store = createInMemoryManifestStore(runExists ? { [seededRunId]: manifest } : {});

        const denials = [];
        const handler = createRunsHandler({
          store,
          enforceEntitlement: true,
          recordDeniedAccess: (entry) => denials.push(entry),
        });

        // Entitled iff the run id is in the caller's entitledRunIds.
        const entitledRunIds = entitled
          ? [...otherEntitled.map((r) => `run-${r}`), seededRunId]
          : otherEntitled.map((r) => `run-${r}`).filter((r) => r !== seededRunId);

        const event = {
          httpMethod: "GET",
          pathParameters: { id: seededRunId },
          callerIdentity: { principalId: "sess_x", entitledRunIds },
        };
        const res = await handler(event);

        if (runExists && entitled) {
          assert.equal(res.statusCode, 200);
          const body = JSON.parse(res.body);
          assert.equal(body.runId, seededRunId);
          assert.ok(body.manifest && body.manifest.runId === seededRunId);
        } else {
          // Unknown OR unentitled -> identical 404, no manifest content, denial recorded.
          assert.equal(res.statusCode, 404);
          const body = JSON.parse(res.body);
          assert.equal("manifest" in body, false);
          assert.equal(denials.length, 1);
          assert.equal(denials[0].runId, seededRunId);
        }
      },
    ),
    { numRuns: RUNS },
  );
});

// -----------------------------------------------------------------------------
// Feature: knowgrph-acos-mcp-connector, Property 30: For any configured expiry window, the Agent_Api treats an Auth_Token as expired exactly when its issuance age exceeds the window; the effective window is always within [5 minutes, 24 hours] and defaults to 60 minutes when unset.
// -----------------------------------------------------------------------------
test("Property 30: Auth_Token expiry window bounds", () => {
  // Requested window straddles the [300, 86400] bounds (plus unset/non-numeric)
  // and token age straddles the effective window, via the shared boundary
  // generators (spec task 9.4).
  fc.assert(
    fc.property(
      expiryWindowBoundaryArb,
      tokenAgeAroundExpiryArb,
      (requestedWindow, ageSeconds) => {
        const { seconds } = resolveExpiryWindowSeconds(requestedWindow);
        // Effective window always within [300, 86400]; defaults to 3600 when unset.
        assert.ok(seconds >= MIN_EXPIRY_WINDOW_SECONDS && seconds <= MAX_EXPIRY_WINDOW_SECONDS);
        if (requestedWindow === undefined || requestedWindow === null || Number.isNaN(Number(requestedWindow))) {
          assert.equal(seconds, DEFAULT_EXPIRY_WINDOW_SECONDS);
        }

        // Expired EXACTLY when issuance age exceeds the effective window.
        const nowSeconds = Math.floor(NOW_MS / 1000);
        const claims = { iat: nowSeconds - ageSeconds };
        const { expired } = isWithinExpiryWindow(claims, nowSeconds, requestedWindow);
        assert.equal(expired, ageSeconds > seconds);
      },
    ),
    { numRuns: RUNS },
  );
});

// -----------------------------------------------------------------------------
// Feature: knowgrph-acos-mcp-connector, Property 31: For any GET /health request (with or without an Auth_Token), the Agent_Api responds without requiring authentication and restricts the response to liveness status, disclosing no Run_Manifest data, credentials, or internal configuration values.
// -----------------------------------------------------------------------------
test("Property 31: liveness probe discloses nothing sensitive", () => {
  const handler = createHealthHandler();
  const ALLOWED_KEYS = new Set(["status", "transport", "checkElapsedMs", "checkWithinDeadline", "checkDeadlineMs"]);
  fc.assert(
    fc.property(
      fc.option(fc.string(), { nil: undefined }),
      fc.integer({ min: 0, max: 10000 }),
      (maybeToken, checkElapsedMs) => {
        const handlerWithDeps = createHealthHandler({ checkElapsedMs });
        const event = { httpMethod: "GET", headers: maybeToken ? { Authorization: `Bearer ${maybeToken}` } : {} };
        const res = handlerWithDeps(event);
        // Open probe: always 200 regardless of (absent/garbage) auth.
        assert.equal(res.statusCode, 200);
        const body = JSON.parse(res.body);
        // Liveness-only: no unexpected keys, no manifest/credential/config leak.
        for (const key of Object.keys(body)) assert.ok(ALLOWED_KEYS.has(key), `unexpected key: ${key}`);
        assert.equal("manifest" in body, false);
        assert.equal("secret" in body, false);
      },
    ),
    { numRuns: RUNS },
  );
  void handler;
});
