// Budget-cap enforcement model for the video-remix Director runtime
// (spec task 2.9 / R4.6 / Property 9). Extracted verbatim from
// `mcp/video-remix-runtime.js` (reuse-not-rebuild). DETERMINISTIC and
// timer-free; importable by both the Node tests and the Cloudflare Worker
// bundle.

import { normalizeMoney } from "./helpers.js";

/**
 * Normalize an injectable cumulative-spend signal into a non-negative USD
 * amount rounded to cents (spec task 2.9 / R4.6 / Property 9).
 *
 * This is the DETERMINISTIC, timer-free driver for budget-cap enforcement: it
 * lets a caller (or test) push the run's cumulative spend to or past the cap
 * WITHOUT any real provider call. In production the same accumulation is fed by
 * recorded provider spend + model spend already tracked in Budget_Meters.
 */
export function normalizeCumulativeSpendUsd(value, fallback = 0) {
  const amount = normalizeMoney(value, fallback);
  return Number(amount.toFixed(2));
}

/**
 * Pure budget-cap decision (spec task 2.9 / R4.6 / Property 9).
 *
 * Returns true WHEN a positive budget cap is configured AND cumulative spend
 * reaches or exceeds it (`cumulativeSpendUsd >= budgetUsd`). A non-positive /
 * unconfigured cap (`budgetUsd <= 0`, e.g. an omitted budget normalized to 0)
 * can never be "exceeded", so the gate is inert — this prevents a 0-spend run
 * with an omitted budget from falsely tripping (`0 >= 0`).
 *
 * Pure and timer-free, so the cap policy is unit/property testable.
 */
export function budgetCapExceeded(cumulativeSpendUsd, budgetUsd) {
  const spend = normalizeCumulativeSpendUsd(cumulativeSpendUsd, 0);
  const cap = normalizeMoney(budgetUsd, 0);
  return cap > 0 && spend >= cap;
}
