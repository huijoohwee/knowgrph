// Ledger-vs-meters reconciliation model for the video-remix Director runtime
// (spec task 2.12 / R10.4, R10.5 / Property 21). Extracted into its own
// cohesive, single-responsibility module so `run-video-remix.js` stays under
// the 600-line limit (reuse-not-rebuild). Pure and timer-free; importable by
// both the Node tests and the Cloudflare Worker bundle. Works in integer cents
// — the same cents-exact technique as `cost-log.js` / `budget-meters.js` — so
// the ±0.01 USD tolerance is evaluated with no float drift.
//
// R10.4: THE Credit_Ledger SHALL remain consistent such that the sum of
//   recorded ledger events equals the total provider spend reported in
//   Budget_Meters within a tolerance of ±0.01 USD.
// R10.5: IF the sum of recorded Credit_Ledger events deviates from the total
//   provider spend reported in Budget_Meters by more than ±0.01 USD, THEN THE
//   Director SHALL flag a reconciliation discrepancy and preserve both the
//   Credit_Ledger events and Budget_Meters values without modification.
// Property 21: For any run, either the sum of recorded Credit_Ledger events
//   equals the total provider spend reported in Budget_Meters within ±0.01 USD,
//   or — when the deviation exceeds ±0.01 USD — the Director flags a
//   reconciliation discrepancy and preserves both the Credit_Ledger events and
//   the Budget_Meters values without modification.
//
// The Credit_Ledger events are DERIVED from the run's render assets: each asset
// carries a `ledgerEventId`, a `costCents`, and a provider identity (R8.3,
// R8.4). Their summed `costCents` is the ledger total; it is compared against
// the meters-side provider spend (`budgetMeters.providerSpendCents`). The
// reconciliation is purely OBSERVATIONAL — it appends a flag and surfaces a
// check, but never mutates the ledger events or the Budget_Meters values
// (do not auto-correct, R10.5).

// ±0.01 USD expressed in integer cents. A deviation of EXACTLY 1 cent (0.01
// USD) is WITHIN tolerance (no flag); a deviation strictly greater than 1 cent
// is flagged (R10.5 "more than ±0.01 USD").
export const RECONCILIATION_TOLERANCE_CENTS = 1;
export const RECONCILIATION_FLAG_REASON = "credit_ledger_meters_deviation_exceeds_tolerance";
export const RECONCILIATION_CHECK_ID = "credit_ledger_consistency_or_reconciliation_flag";

// Coerce a value to a safe integer cent count. Non-finite -> fallback.
function toSafeCents(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.round(number);
}

function centsToUsdString(cents) {
  return (cents / 100).toFixed(2);
}

/**
 * Derive the Credit_Ledger events from a run's render assets (R8.3, R8.4).
 * Each produced asset carries a `ledgerEventId`, a `costCents`, and a provider
 * identity; a zero-spend asset is the deterministic mock provider (R8.5). Only
 * assets that actually carry a `ledgerEventId` are treated as ledger events.
 * Returns fresh objects (never mutates the input assets).
 */
export function deriveLedgerEventsFromAssets(assets = []) {
  if (!Array.isArray(assets)) return [];
  return assets
    .filter((asset) => asset && asset.ledgerEventId)
    .map((asset) => {
      const costCents = toSafeCents(asset.costCents, 0);
      return {
        ledgerEventId: String(asset.ledgerEventId),
        shotId: asset.shotId ?? null,
        // Provider identity (R8.4): use the asset's provider when present,
        // otherwise a zero-spend ledger event is the deterministic mock
        // provider (R8.5).
        provider: asset.provider ?? (costCents > 0 ? "unknown" : "mock"),
        costCents,
      };
    });
}

/**
 * Build the human-readable reconciliation discrepancy flag string appended to
 * the Run_Manifest `reconciliationFlags[]` (per the design data model:
 * `reconciliationFlags: string[]` — run ids / notes). Records the run id, both
 * deviating totals, and an explicit "both records preserved" note so the
 * fail-closed, evidence-preserving discipline is observable (R10.5).
 */
export function buildReconciliationFlag({ runId, ledgerSumCents, metersProviderSpendCents, deviationCents }) {
  return (
    `reconciliation-discrepancy run=${runId || "unknown"}: ` +
    `credit-ledger sum $${centsToUsdString(ledgerSumCents)} deviates from ` +
    `budget-meters provider spend $${centsToUsdString(metersProviderSpendCents)} ` +
    `by $${centsToUsdString(deviationCents)} (> $0.01 tolerance); ` +
    `both Credit_Ledger events and Budget_Meters values preserved unchanged`
  );
}

/**
 * Reconcile the summed Credit_Ledger events against the meters-side provider
 * spend with the ±0.01 USD tolerance, in integer cents (R10.4, R10.5 /
 * Property 21). Within tolerance -> `consistent` with no flag; deviation
 * greater than the tolerance -> a single discrepancy flag, both records
 * preserved unchanged. Pure: never mutates its inputs.
 */
export function reconcileLedgerVsMeters({
  ledgerEvents = [],
  metersProviderSpendCents = 0,
  runId = "",
  toleranceCents = RECONCILIATION_TOLERANCE_CENTS,
} = {}) {
  const ledgerSumCents = ledgerEvents.reduce((total, event) => total + toSafeCents(event.costCents, 0), 0);
  const metersCents = toSafeCents(metersProviderSpendCents, 0);
  const deviationCents = Math.abs(ledgerSumCents - metersCents);
  const consistent = deviationCents <= toleranceCents;
  const flags = consistent
    ? []
    : [buildReconciliationFlag({ runId, ledgerSumCents, metersProviderSpendCents: metersCents, deviationCents })];
  return {
    ledgerSumCents,
    metersProviderSpendCents: metersCents,
    deviationCents,
    toleranceCents,
    consistent,
    flags,
  };
}

/**
 * Pure correctness check for Property 21, surfaced on the Run_Manifest
 * `validation.checks` and `guardrails`. Holds iff EITHER the totals are within
 * tolerance AND no flag was raised, OR the deviation exceeds tolerance AND
 * exactly one discrepancy flag was raised. Because the reconciliation never
 * mutates the ledger events or the meters value, "preserve both records
 * unchanged" holds by construction whenever the flagged branch is taken.
 */
export function ledgerReconciliationHolds({ consistent, flags } = {}) {
  if (consistent) return Array.isArray(flags) && flags.length === 0;
  return Array.isArray(flags) && flags.length === 1;
}

/**
 * Compose the full ledger-vs-meters reconciliation for a run in one synchronous
 * pass (spec task 2.12 / R10.4, R10.5 / Property 21). Derives the Credit_Ledger
 * events from the render assets, resolves the meters-side provider spend
 * (defaulting to the ledger-derived `budgetMeters.providerSpendCents`; an
 * injectable, timer-free signal can simulate a Budget_Meters reading that
 * diverges from the ledger WITHOUT any real provider call so the discrepancy
 * path is observable), reconciles within ±0.01 USD, and returns everything
 * `run-video-remix.js` needs — the preserved ledger events, the `flags[]`,
 * a `summary` for `budgetMeters.reconciliation`, the Property-21 guardrail
 * boolean, and the ready-to-push `validationCheck` — so the orchestrator stays
 * lean and well under the 600-line limit (single responsibility lives here).
 */
export function buildLedgerReconciliation({
  assets = [],
  metersProviderSpendCents = 0,
  runId = "",
  simulatedMetersProviderSpendCents,
} = {}) {
  const ledgerEvents = deriveLedgerEventsFromAssets(assets);
  const metersCents = Number.isFinite(Number(simulatedMetersProviderSpendCents))
    ? Math.round(Number(simulatedMetersProviderSpendCents))
    : toSafeCents(metersProviderSpendCents, 0);
  const result = reconcileLedgerVsMeters({ ledgerEvents, metersProviderSpendCents: metersCents, runId });
  const holds = ledgerReconciliationHolds(result);
  return {
    // Preserved Credit_Ledger events (fresh copies; the source assets are never
    // mutated). `ledgerEventCount` lets callers assert preservation.
    ledgerEvents,
    flags: result.flags,
    summary: {
      ledgerSumCents: result.ledgerSumCents,
      providerSpendCents: result.metersProviderSpendCents,
      deviationCents: result.deviationCents,
      toleranceCents: result.toleranceCents,
      consistent: result.consistent,
      ledgerEventCount: ledgerEvents.length,
      flagged: result.flags.length > 0,
    },
    guardrailOk: holds,
    validationCheck: { id: RECONCILIATION_CHECK_ID, ok: holds },
  };
}
