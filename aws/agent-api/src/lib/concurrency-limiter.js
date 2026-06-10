// In-flight concurrency limiter for the AWS Agent-API tier.
//
// Spec: knowgrph-acos-mcp-connector, task 5.5 (R12.4; design Agent_Api
// `POST /run` request pipeline -> `saturated -> 503 + retry-after`).
//
// SCOPE OF THIS TASK (5.5): the Agent_Api is a thin, stateless adapter that
// forwards `knowgrph.video_remix.run` MCP calls to the McpAgent (task 5.3). When
// the count of IN-FLIGHT forwarded MCP calls reaches a CONFIGURED MAXIMUM
// CONCURRENCY, the backend is "saturated" and the `POST /run` handler must
// return HTTP 503 with a `retry-after` value in [1, 120] seconds WITHOUT
// forwarding (R12.4). When a forward completes (success OR failure), the
// in-flight count decrements so capacity is reclaimed.
//
// This module is a small, deterministic SEAM: it tracks active in-flight
// forwards against a configurable max and exposes a configurable retry-after
// (clamped into [1, 120]). It owns NO timers and makes ZERO network/AWS calls,
// so saturation is simulated in tests by holding forwards open via controllable
// promises and asserting the admit/reject decision structurally.

// --- retry-after bounds (R12.4) ---------------------------------------------

// A saturation `retry-after` is an integer number of seconds in [1, 120].
export const RETRY_AFTER_MIN_SECONDS = 1;
export const RETRY_AFTER_MAX_SECONDS = 120;

// Defaults keep an un-tuned deployment safe: a small free-tier-friendly
// concurrency ceiling and a mid-window retry-after hint.
export const DEFAULT_MAX_CONCURRENCY = 16;
export const DEFAULT_RETRY_AFTER_SECONDS = 5;

/**
 * Clamp a requested retry-after into the [1, 120]-second window (R12.4). Any
 * non-finite value falls back to the default; the result is always a whole
 * number of seconds within the bounds.
 *
 * @param {unknown} value requested retry-after in seconds
 * @param {number} [fallback] value to use when `value` is non-finite
 * @returns {number} an integer in [RETRY_AFTER_MIN_SECONDS, RETRY_AFTER_MAX_SECONDS]
 */
export function clampRetryAfterSeconds(value, fallback = DEFAULT_RETRY_AFTER_SECONDS) {
  const base = Number.isFinite(value) ? value : fallback;
  const rounded = Math.round(base);
  if (rounded < RETRY_AFTER_MIN_SECONDS) return RETRY_AFTER_MIN_SECONDS;
  if (rounded > RETRY_AFTER_MAX_SECONDS) return RETRY_AFTER_MAX_SECONDS;
  return rounded;
}

/**
 * Normalize a configured max concurrency into a positive integer. Non-finite or
 * sub-1 values fall back to the default so the limiter never admits an unbounded
 * (or zero-capacity) number of in-flight forwards by misconfiguration.
 *
 * @param {unknown} value configured maximum concurrency
 * @returns {number} a positive integer >= 1
 */
export function normalizeMaxConcurrency(value) {
  if (!Number.isFinite(value)) return DEFAULT_MAX_CONCURRENCY;
  const rounded = Math.floor(value);
  return rounded >= 1 ? rounded : DEFAULT_MAX_CONCURRENCY;
}

/**
 * Create an in-flight concurrency limiter.
 *
 * The limiter tracks the number of ACTIVE forwarded MCP calls. `tryAcquire()`
 * admits a forward while the active count is BELOW the configured max and hands
 * back a single-use `release()` that decrements the count when the forward
 * completes (success or failure). At/over the max it rejects with the clamped
 * `retryAfterSeconds` and does NOT increment the count, so the caller can return
 * 503 without forwarding (R12.4).
 *
 * Deterministic and timer-free: tests simulate concurrency by acquiring slots
 * and only calling `release()` when they choose, mirroring forwards held open
 * via controllable promises.
 *
 * @param {object} [config]
 * @param {number} [config.maxConcurrency] max simultaneous in-flight forwards
 * @param {number} [config.retryAfterSeconds] retry-after hint, clamped to [1,120]
 * @returns {{
 *   tryAcquire: () => ({ admitted: true, release: () => void }
 *                     | { admitted: false, retryAfterSeconds: number }),
 *   activeCount: () => number,
 *   maxConcurrency: number,
 *   retryAfterSeconds: number,
 * }}
 */
export function createConcurrencyLimiter(config = {}) {
  const maxConcurrency = normalizeMaxConcurrency(config.maxConcurrency);
  const retryAfterSeconds = clampRetryAfterSeconds(config.retryAfterSeconds);

  let active = 0;

  function tryAcquire() {
    // Saturated: the active count has reached the configured ceiling. Reject
    // WITHOUT incrementing so no phantom capacity is consumed (R12.4).
    if (active >= maxConcurrency) {
      return { admitted: false, retryAfterSeconds };
    }

    active += 1;
    let released = false;
    const release = () => {
      // Single-use: a forward releases its slot exactly once (success OR
      // failure). Guard against double-release so capacity is reclaimed by
      // exactly one unit per admitted forward.
      if (released) return;
      released = true;
      active = Math.max(0, active - 1);
    };

    return { admitted: true, release };
  }

  return {
    tryAcquire,
    activeCount: () => active,
    maxConcurrency,
    retryAfterSeconds,
  };
}
