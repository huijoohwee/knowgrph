// INTEGRATION TEST (gated for live deployment) — Demo_Pack URL reachability and
// `GET /health` 200 within 5s (knowgrph-acos-mcp-connector spec, task 9.2 /
// R3.2, R3.4).
//
// WHAT THIS EXERCISES (cross-tier, IN-PROCESS, ZERO live network):
//   The Demo_Pack health-check retry/record loop (mcp/video-remix/demo-pack.js
//   buildDemoPack + health-check.js runHealthCheck) is wired DIRECTLY to the
//   AWS Agent_Api `GET /health` Lambda handler (aws/agent-api/src/handlers/
//   health.js) through the real in-process health probe
//   (`createInProcessHealthProbe`). The loop's injectable attempts INVOKE the
//   real liveness handler and interpret a PASS as HTTP 200 within the structural
//   5s deadline (R3.4). The Demo_Pack `urls[]` always carries >=1 Frontend URL
//   and >=1 Agent_Api endpoint at a terminal Run_State (R3.2).
//
// LIVE-DEPLOYMENT GATING: in-process here (no socket, structural 5s deadline via
// injected per-attempt elapsed). In task 11.4 the same loop is pointed at the
// deployed `GET /health` by swapping the probe for a real `fetch` with a 5s
// deadline — no caller changes.
//
// Examples (1-3): (1) Demo_Pack `urls[]` carries the required Frontend +
// Agent_Api endpoints at a terminal state (R3.2); (2) the health loop records a
// PASS when the real handler returns 200 within 5s (R3.4); (3) a slow (>5s)
// liveness check is retried up to 3x and records a failure (R3.5 boundary).

import test from "node:test";
import assert from "node:assert/strict";

import { buildDemoPack, runHealthCheck } from "../mcp/video-remix/demo-pack.js";
import { createInProcessHealthProbe } from "./lib/in-process-health-transport.mjs";

const HEALTH_URL = "https://agentic-canvas-os.example.aws/health";

// --- Example 1: Demo_Pack urls[] carries Frontend + Agent_Api at terminal ----

test("R3.2 integration: a terminal-state Demo_Pack lists >=1 Frontend URL and >=1 Agent_Api endpoint", () => {
  const demoPack = buildDemoPack({
    state: "complete",
    sources: [{ sourceId: "s1", url: "https://example.com/a" }],
    assets: [{ shotId: "shot-1", assetUrl: "https://airvio.co/asset.mp4", ledgerEventId: "led-1" }],
    checkout: { sessionId: "cs_test_int" },
  });

  const kinds = demoPack.urls.map((u) => u.kind);
  assert.ok(kinds.includes("frontend"), ">=1 Frontend URL (R3.2)");
  assert.ok(
    kinds.includes("agent-api") || kinds.includes("agent-api-health"),
    ">=1 Agent_Api endpoint (R3.2)",
  );
  assert.ok(demoPack.urls.length >= 2);
});

// --- Example 2: the health loop records a PASS on real-handler 200 within 5s -

test("R3.4 integration: the health loop records a PASS when the real GET /health handler returns 200 within 5s", () => {
  // The probe invokes the REAL Agent_Api liveness Lambda; a fast (0ms) check
  // returns HTTP 200 within the 5s deadline, so the loop passes on attempt 1.
  const { probe, calls } = createInProcessHealthProbe({ elapsedPerAttempt: [0] });

  const healthCheck = runHealthCheck({ deployApproved: true, url: HEALTH_URL, attempts: probe });

  assert.equal(healthCheck.probed, true);
  assert.equal(healthCheck.passed, true, "real handler returned 200 within 5s (R3.4)");
  assert.equal(healthCheck.attempts, 1, "passed on the first attempt");
  assert.equal(healthCheck.failureRecorded, false);
  assert.equal(healthCheck.deadlineMs, 5000);
  assert.equal(calls.length, 1, "the real GET /health handler was invoked once");
  assert.equal(calls[0].statusCode, 200);
});

// --- Example 3: a slow (>5s) liveness check retries 3x and records a failure -

test("R3.5 integration boundary: a >5s liveness check is retried up to 3 times and records a health-check failure", () => {
  // Every attempt models a check that exceeded the 5s deadline (handler still
  // returns 200 but flags checkWithinDeadline:false -> not a PASS, R3.4/R3.5).
  const { probe, calls } = createInProcessHealthProbe({ elapsedPerAttempt: [6000, 6000, 6000] });

  const demoPack = buildDemoPack({
    state: "complete",
    deployApproved: true,
    backendHealthUrl: HEALTH_URL,
    healthAttempts: probe,
  });

  assert.equal(demoPack.healthCheck.probed, true);
  assert.equal(demoPack.healthCheck.passed, false);
  assert.equal(demoPack.healthCheck.attempts, 3, "retried up to 3 times (R3.5)");
  assert.equal(demoPack.healthCheck.failureRecorded, true, "all retries failed -> failure recorded (R3.5)");
  assert.equal(calls.length, 3, "the real GET /health handler was invoked 3 times");
});
