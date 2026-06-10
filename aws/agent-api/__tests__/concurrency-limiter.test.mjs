// Tests for in-flight saturation handling on the AWS Agent-API tier
// (knowgrph-acos-mcp-connector spec, task 5.5 / R12.4 / design Agent_Api
// `POST /run` request pipeline `saturated -> 503 + retry-after`).
//
// Covers the four focused behaviors the task calls out, with ZERO live
// network/AWS calls. Concurrency is SIMULATED deterministically by holding
// forwards open via controllable (deferred) promises and only resolving them
// when the test chooses:
//   1. below-limit requests forward normally (slot admitted; forward happens)
//   2. at/over max concurrency -> 503 with retry-after in [1,120] and NO forward
//   3. the in-flight count decrements after a forward completes so capacity is
//      reclaimed
//   4. a configured retry-after outside [1,120] is clamped into the window

import test from "node:test";
import assert from "node:assert/strict";

import {
  createConcurrencyLimiter,
  clampRetryAfterSeconds,
  normalizeMaxConcurrency,
  RETRY_AFTER_MIN_SECONDS,
  RETRY_AFTER_MAX_SECONDS,
  DEFAULT_MAX_CONCURRENCY,
} from "../src/lib/concurrency-limiter.js";
import { createForwardingRunHandler } from "../src/handlers/run.js";

// --- Helpers ----------------------------------------------------------------

/** A minimal fully-valid `POST /run` body; override individual fields. */
function validBody(overrides = {}) {
  return {
    referenceUrl: "https://example.com/reference-video",
    brief: "Remix this reference into a 30s vertical promo.",
    budgetUsd: 12.5,
    approvals: [],
    ...overrides,
  };
}

/** A deferred promise with externally-callable resolve/reject. */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * A controllable MCP transport seam that records calls and HOLDS each forward
 * open until the test resolves the matching deferred. This is how we simulate
 * N forwards in-flight at once with ZERO real concurrency/timers.
 */
function holdableTransport() {
  const gates = [];
  const transport = (req) => {
    const gate = deferred();
    gates.push(gate);
    return gate.promise.then(() => ({
      jsonrpc: "2.0",
      id: req.body?.id ?? 1,
      result: { structuredContent: { runId: `run-${gates.length}` }, isError: false },
    }));
  };
  return { transport, gates };
}

const postRun = (body = validBody()) => ({ httpMethod: "POST", body: JSON.stringify(body) });

// --- pure clamp / normalize helpers (retry-after window R12.4) --------------

test("clampRetryAfterSeconds: clamps below/above the [1,120] window", () => {
  assert.equal(clampRetryAfterSeconds(0), RETRY_AFTER_MIN_SECONDS);
  assert.equal(clampRetryAfterSeconds(-5), RETRY_AFTER_MIN_SECONDS);
  assert.equal(clampRetryAfterSeconds(1000), RETRY_AFTER_MAX_SECONDS);
  assert.equal(clampRetryAfterSeconds(121), RETRY_AFTER_MAX_SECONDS);
  // In-window values are preserved (rounded to whole seconds).
  assert.equal(clampRetryAfterSeconds(30), 30);
  assert.equal(clampRetryAfterSeconds(2.4), 2);
  assert.equal(clampRetryAfterSeconds(119.6), 120);
});

test("clampRetryAfterSeconds: non-finite values fall back into the window", () => {
  assert.ok(clampRetryAfterSeconds(undefined) >= RETRY_AFTER_MIN_SECONDS);
  assert.ok(clampRetryAfterSeconds(NaN) <= RETRY_AFTER_MAX_SECONDS);
  assert.equal(clampRetryAfterSeconds("nope", 7), 7);
});

test("normalizeMaxConcurrency: rejects sub-1 / non-finite to the default", () => {
  assert.equal(normalizeMaxConcurrency(0), DEFAULT_MAX_CONCURRENCY);
  assert.equal(normalizeMaxConcurrency(-3), DEFAULT_MAX_CONCURRENCY);
  assert.equal(normalizeMaxConcurrency(NaN), DEFAULT_MAX_CONCURRENCY);
  assert.equal(normalizeMaxConcurrency(4), 4);
  assert.equal(normalizeMaxConcurrency(4.9), 4);
});

// --- limiter unit: admit below the limit, reject at/over it -----------------

test("limiter: admits below the limit and rejects at/over the configured max", () => {
  const limiter = createConcurrencyLimiter({ maxConcurrency: 2, retryAfterSeconds: 10 });
  assert.equal(limiter.activeCount(), 0);

  const a = limiter.tryAcquire();
  const b = limiter.tryAcquire();
  assert.equal(a.admitted, true);
  assert.equal(b.admitted, true);
  assert.equal(limiter.activeCount(), 2, "two forwards in-flight == the configured max");

  // At the max: the next acquire is rejected with the clamped retry-after and
  // does NOT consume capacity.
  const c = limiter.tryAcquire();
  assert.equal(c.admitted, false);
  assert.equal(c.retryAfterSeconds, 10);
  assert.equal(limiter.activeCount(), 2, "a rejected acquire does not increment the count");
});

test("limiter: release reclaims exactly one unit of capacity (idempotent)", () => {
  const limiter = createConcurrencyLimiter({ maxConcurrency: 1 });
  const a = limiter.tryAcquire();
  assert.equal(a.admitted, true);
  assert.equal(limiter.tryAcquire().admitted, false, "saturated at 1 in-flight");

  a.release();
  assert.equal(limiter.activeCount(), 0, "capacity reclaimed after release");
  // Double-release must not push the count negative or free phantom capacity.
  a.release();
  assert.equal(limiter.activeCount(), 0);

  assert.equal(limiter.tryAcquire().admitted, true, "capacity available again");
});

// --- 1. below-limit requests forward normally -------------------------------

test("handler: a below-limit request forwards normally and returns 202", async () => {
  const { transport, gates } = holdableTransport();
  const limiter = createConcurrencyLimiter({ maxConcurrency: 2 });
  const handler = createForwardingRunHandler({ transport, limiter });

  const inflight = handler(postRun());
  // One forward is in-flight (held open), so the transport was invoked.
  assert.equal(gates.length, 1, "the forward reached the transport seam");

  gates[0].resolve();
  const res = await inflight;
  assert.equal(res.statusCode, 202);
  assert.equal(JSON.parse(res.body).forwarded, true);
  assert.equal(limiter.activeCount(), 0, "slot released after the forward settled");
});

// --- 2. at/over max concurrency -> 503 + retry-after in [1,120], no forward --

test("handler: at the max concurrency a new request returns 503 + retry-after and does NOT forward", async () => {
  const { transport, gates } = holdableTransport();
  const limiter = createConcurrencyLimiter({ maxConcurrency: 1, retryAfterSeconds: 30 });
  const handler = createForwardingRunHandler({ transport, limiter });

  // First request occupies the only slot and is held open in-flight.
  const inflight = handler(postRun());
  assert.equal(gates.length, 1, "first request forwarded");

  // Second request arrives while saturated -> 503 with retry-after, no forward.
  const saturated = await handler(postRun());
  assert.equal(saturated.statusCode, 503);
  assert.equal(gates.length, 1, "saturated request is NOT forwarded (R12.4)");

  const payload = JSON.parse(saturated.body);
  assert.equal(payload.error, "service_unavailable");
  assert.ok(
    payload.retryAfter >= RETRY_AFTER_MIN_SECONDS && payload.retryAfter <= RETRY_AFTER_MAX_SECONDS,
    "retry-after body value is within [1,120]",
  );
  assert.equal(payload.retryAfter, 30);

  // The `retry-after` HTTP header carries the same in-window value.
  const header = saturated.headers["retry-after"];
  assert.equal(header, "30");
  const headerSeconds = Number(header);
  assert.ok(headerSeconds >= RETRY_AFTER_MIN_SECONDS && headerSeconds <= RETRY_AFTER_MAX_SECONDS);

  // Drain the held forward so nothing leaks between tests.
  gates[0].resolve();
  await inflight;
});

// --- 3. in-flight count decrements after a forward completes -> reclaimed ----

test("handler: capacity is reclaimed after a forward completes (success)", async () => {
  const { transport, gates } = holdableTransport();
  const limiter = createConcurrencyLimiter({ maxConcurrency: 1, retryAfterSeconds: 15 });
  const handler = createForwardingRunHandler({ transport, limiter });

  // Saturate with one held forward.
  const first = handler(postRun());
  assert.equal((await handler(postRun())).statusCode, 503, "saturated while first is in-flight");

  // Complete the first forward -> slot released -> capacity reclaimed.
  gates[0].resolve();
  await first;
  assert.equal(limiter.activeCount(), 0);

  // A subsequent request is admitted again.
  const second = handler(postRun());
  assert.equal(gates.length, 2, "second forward admitted after capacity reclaimed");
  gates[1].resolve();
  assert.equal((await second).statusCode, 202);
});

test("handler: capacity is reclaimed even when a forward FAILS", async () => {
  // A transport that rejects on the first call and succeeds on the second.
  let call = 0;
  const transport = async () => {
    call += 1;
    if (call === 1) throw new Error("forward boom");
    return { jsonrpc: "2.0", id: 1, result: { structuredContent: { runId: "run-ok" } } };
  };
  const limiter = createConcurrencyLimiter({ maxConcurrency: 1 });
  const handler = createForwardingRunHandler({ transport, limiter });

  // task 5.10 (R15.3, R15.6): an unexpected forward failure no longer
  // propagates a raw error; it collapses to a non-disclosing HTTP 500. The
  // slot must still be released so capacity is reclaimed.
  const failed = await handler(postRun());
  assert.equal(failed.statusCode, 500, "failed forward -> non-disclosing 500");
  const body = JSON.parse(failed.body);
  assert.equal(body.error, "internal_error");
  assert.equal(failed.body.includes("forward boom"), false, "no raw error message leaked");
  assert.equal(limiter.activeCount(), 0, "slot released after a failed forward");

  // Capacity reclaimed -> the next request is admitted and succeeds.
  const res = await handler(postRun());
  assert.equal(res.statusCode, 202);
});

// --- 4. retry-after clamped into [1,120] at the handler boundary ------------

test("handler: an out-of-range configured retry-after is clamped into [1,120]", async () => {
  const { transport, gates } = holdableTransport();
  // Configure an absurd retry-after; it must be clamped to 120 at the boundary.
  const limiter = createConcurrencyLimiter({ maxConcurrency: 1, retryAfterSeconds: 9999 });
  const handler = createForwardingRunHandler({ transport, limiter });

  const inflight = handler(postRun());
  const saturated = await handler(postRun());

  assert.equal(saturated.statusCode, 503);
  assert.equal(saturated.headers["retry-after"], String(RETRY_AFTER_MAX_SECONDS));
  assert.equal(JSON.parse(saturated.body).retryAfter, RETRY_AFTER_MAX_SECONDS);

  gates[0].resolve();
  await inflight;
});

test("handler: a too-small configured retry-after is clamped up to 1 second", async () => {
  const { transport, gates } = holdableTransport();
  const limiter = createConcurrencyLimiter({ maxConcurrency: 1, retryAfterSeconds: 0 });
  const handler = createForwardingRunHandler({ transport, limiter });

  const inflight = handler(postRun());
  const saturated = await handler(postRun());

  assert.equal(saturated.statusCode, 503);
  assert.equal(saturated.headers["retry-after"], String(RETRY_AFTER_MIN_SECONDS));

  gates[0].resolve();
  await inflight;
});
