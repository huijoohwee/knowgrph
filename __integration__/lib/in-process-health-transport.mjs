// In-process cross-tier health-probe adapter
// (knowgrph-acos-mcp-connector spec, integration task 9.2 — R3.2, R3.4).
//
// PURPOSE: the REAL wiring of the Demo_Pack health-check retry/record loop to
// the AWS Agent_Api `GET /health` Lambda handler, exercised entirely in-process
// with ZERO live network calls:
//
//   Demo_Pack health-check loop  ───────►  Agent_Api GET /health handler
//   (mcp/video-remix/health-check.js          (aws/agent-api/src/handlers/
//    runHealthCheck → injectable attempts)     health.js createHealthHandler)
//
// `runHealthCheck` (and `buildDemoPack`) accept an INJECTABLE attempt source:
// either an array of attempt results or a `(index, url) => result` function.
// This adapter is that function: for each retry it INVOKES the real
// `GET /health` handler (the same pure `(event) => response` Lambda the
// deployed Agent_Api runs), reads the HTTP status + the structural
// `checkWithinDeadline` flag from the response body, and returns an attempt
// result the loop interprets as a PASS only on HTTP 200 within the 5s deadline
// (R3.4). No socket is opened and no real 5s timer runs — the per-attempt
// elapsed time is an injected structural signal.
//
// In task 11.4 the SAME loop is pointed at the deployed endpoint by swapping
// this in-process probe for a real `fetch` with a 5s deadline — no caller
// changes required.

import { createHealthHandler, HEALTH_DEADLINE_MS } from "../../aws/agent-api/src/handlers/health.js";

/**
 * Build an in-process `GET /health` probe to feed the Demo_Pack health-check
 * loop (`buildDemoPack({ healthAttempts })` / `runHealthCheck({ attempts })`).
 *
 * Each attempt invokes the REAL Agent_Api health Lambda with the per-attempt
 * injected elapsed signal, then maps the Lambda response to the attempt-result
 * shape the loop understands:
 *   - HTTP 200 AND within the 5s deadline -> `{ status: 200 }` (PASS, R3.4)
 *   - over the 5s deadline                -> `{ timedOut: true }` (FAIL, R3.5)
 *   - any non-200                         -> `{ status }` (FAIL)
 *
 * @param {object} [opts]
 * @param {number[]} [opts.elapsedPerAttempt] injected per-attempt elapsed ms
 *   (index-aligned). A value <= 5000 is healthy; > 5000 models a slow probe.
 *   Defaults to 0 (synchronous healthy probe) for every attempt.
 * @param {(event: object) => object} [opts.handler] override the health handler
 *   (defaults to the real `createHealthHandler()`); tests may inject a handler
 *   that models an unhealthy deployment.
 * @returns {{ probe: (index: number, url: string) => object, calls: object[] }}
 */
export function createInProcessHealthProbe(opts = {}) {
  const elapsedPerAttempt = Array.isArray(opts.elapsedPerAttempt) ? opts.elapsedPerAttempt : [];
  const calls = [];

  const probe = (index, url) => {
    const checkElapsedMs = Number.isFinite(elapsedPerAttempt[index]) ? elapsedPerAttempt[index] : 0;
    // Each attempt gets its own handler instance carrying that attempt's
    // injected elapsed signal (the real Lambda is a pure factory of seams).
    const handler = typeof opts.handler === "function" ? opts.handler : createHealthHandler({ checkElapsedMs });
    const event = { httpMethod: "GET", path: "/health", rawPath: "/health" };
    const response = handler(event);
    calls.push({ index, url, checkElapsedMs, statusCode: response.statusCode });

    let body = {};
    try {
      body = JSON.parse(response.body);
    } catch {
      body = {};
    }
    // A PASS is HTTP 200 AND the structural within-deadline flag (R3.4).
    if (response.statusCode === 200 && body.checkWithinDeadline === true) {
      return { status: 200 };
    }
    if (body.checkWithinDeadline === false || checkElapsedMs > HEALTH_DEADLINE_MS) {
      return { timedOut: true };
    }
    return { status: response.statusCode };
  };

  return { probe, calls };
}
