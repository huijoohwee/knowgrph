// Small pure string/number normalization helpers shared across the
// video-remix Director runtime modules. Extracted verbatim from
// `mcp/video-remix-runtime.js` (reuse-not-rebuild).

function cleanString(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function slugify(value, fallback = "video-remix") {
  const slug = cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || fallback;
}

function normalizeMoney(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function normalizeCount(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(1, Math.min(12, Math.floor(number)));
}

// Compose the human-readable Director run summary line block from the assembled
// Run_Manifest fields. Pure presentation — extracted from the Director runtime
// so the orchestrator stays focused on manifest assembly (and under its line
// ceiling). Appends the budget-exceeded message and the weak-signal
// awaiting-approval indication only when present.
function buildRunText({ runId, mode, state, sources, approvalGates, budgetMeters, budgetExceeded, weakSignalHalt }) {
  const lines = [
    `Video remix run: ${runId}`,
    `Mode: ${mode}`,
    `State: ${state}`,
    `Sources: ${Array.isArray(sources) ? sources.length : 0}`,
    `Approval gates: ${Array.isArray(approvalGates) ? approvalGates.length : 0}`,
    `Estimated cost: ${budgetMeters.estimatedCostUsd}`,
    `Paid-provider calls: ${budgetMeters.paidProviderCalls}`,
  ];
  if (budgetExceeded) lines.push(`Budget exceeded: ${budgetMeters.budgetExceededMessage}`);
  if (weakSignalHalt && weakSignalHalt.awaitingApprovalToContinue) {
    lines.push(`Weak signal: ${weakSignalHalt.summary.indication}`);
  }
  return lines.join("\n");
}

export { cleanString, slugify, normalizeMoney, normalizeCount, buildRunText };
