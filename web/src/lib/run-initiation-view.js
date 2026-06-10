// Run-initiation display view-model for the agentic-canvas-os Vercel Frontend.
//
// Spec: knowgrph-acos-mcp-connector, task 7.3 (R1.3; design Correctness
// Property 32; design Frontend `renderManifest`).
//
// R1.3: "WHEN a run is initiated, THE Frontend SHALL display each planned stage
// and the budget cap BEFORE any Approval_Gate is approved." This module is the
// PURE, framework-agnostic, ZERO-network/ZERO-browser view-model builder that
// turns a Run_Manifest (or a run-initiation payload) into a render-ready view:
//
//   { stages: [...], budgetCapUsd, anyGateApproved, ... }
//
// listing EVERY planned creative stage (research -> storyboard -> render ->
// publish -> checkout) IN ORDER plus the run's budget cap, suitable for
// rendering the moment a run is initiated and BEFORE any gate is approved.
//
// SCHEMA REUSE (do NOT fork): the canonical stage order and per-stage gate ids
// MIRROR the worker tier's single source of truth in
// `mcp/director-workflow.js` (`DIRECTOR_STAGE_ORDER`, `DIRECTOR_STAGE_GATES`)
// and the durable Run_Manifest shape in the design Data Models
// (`{ stages[], approvalGates[], budgetMeters, ... }`, with an `ingest`
// preflight stage prepended by the runtime). The constants below are a
// product-tier mirror — they intentionally match the worker definitions rather
// than re-deriving a different schema.
//
// STACK BOUNDARY (R11): the product tier holds no model provider keys; this
// builder reads only manifest data and performs no I/O.

// --- Canonical schema mirror (single source of truth: mcp/director-workflow.js)

/**
 * The five planned creative pipeline stages, in canonical execution order
 * (R4.1). MIRRORS `DIRECTOR_STAGE_ORDER` in `mcp/director-workflow.js`. The
 * runtime prepends an `ingest` preflight bookkeeping stage to the durable
 * Run_Manifest `stages[]`; `ingest` is NOT a planned creative stage and is
 * excluded from the run-initiation display.
 */
export const PLANNED_STAGE_ORDER = Object.freeze([
  "research",
  "storyboard",
  "render",
  "publish",
  "checkout",
]);

/**
 * The runtime preflight stage excluded from the planned-stage display.
 * MIRRORS `DIRECTOR_PREFLIGHT_STAGE` in `mcp/director-workflow.js`.
 */
export const PREFLIGHT_STAGE_ID = "ingest";

/**
 * Gate id guarding each planned stage. MIRRORS `DIRECTOR_STAGE_GATES` in
 * `mcp/director-workflow.js` so the run-initiation display names the same gate
 * the worker enforces at each spend boundary.
 */
export const PLANNED_STAGE_GATES = Object.freeze({
  research: "paid-model-call",
  storyboard: "paid-model-call",
  render: "render-action",
  publish: "cloud-deploy",
  checkout: "payment-action",
});

/** Human-readable labels for the planned stages (display only). */
export const PLANNED_STAGE_LABELS = Object.freeze({
  research: "Research",
  storyboard: "Storyboard",
  render: "Render",
  publish: "Publish",
  checkout: "Checkout",
});

/** Status shown for a planned stage that has no manifest status yet. */
export const DEFAULT_PLANNED_STATUS = "planned";

// --- Helpers ----------------------------------------------------------------

/**
 * Index `stages[]` from a manifest by stage id, tolerating a missing/empty or
 * non-array `stages` field (a minimal/empty manifest). Returns a Map so a
 * later lookup of a planned stage is O(1) and absent stages fall back cleanly.
 *
 * @param {unknown} manifest
 * @returns {Map<string, object>}
 */
function indexManifestStages(manifest) {
  const byId = new Map();
  const stages =
    manifest && typeof manifest === "object" && Array.isArray(manifest.stages)
      ? manifest.stages
      : [];
  for (const stage of stages) {
    if (stage && typeof stage === "object" && typeof stage.id === "string") {
      // First occurrence wins; the runtime emits at most one entry per stage.
      if (!byId.has(stage.id)) byId.set(stage.id, stage);
    }
  }
  return byId;
}

/**
 * Resolve the run's budget cap (USD) from a Run_Manifest or run-initiation
 * payload, WITHOUT forking the schema. The cap is sought in priority order:
 *   1. an explicit top-level `budgetCapUsd`
 *   2. the run-initiation `budgetUsd` (Director input field, R2.1)
 *   3. the runtime `ingest` stage artifact `{ referenceUrl, budgetUsd }`
 *      (see `mcp/video-remix/run-video-remix.js`)
 *   4. `budgetMeters.budgetCapUsd` if a future manifest surfaces it there
 *
 * Returns a finite, non-negative number when a usable cap is present, else
 * `null` (a minimal/empty manifest carries no cap — the UI then shows "no cap"
 * rather than a fabricated value).
 *
 * @param {unknown} manifest
 * @returns {number|null}
 */
export function resolveBudgetCapUsd(manifest) {
  if (!manifest || typeof manifest !== "object") return null;

  const ingest =
    indexManifestStages(manifest).get(PREFLIGHT_STAGE_ID) || null;
  const ingestArtifact =
    ingest && ingest.artifact && typeof ingest.artifact === "object"
      ? ingest.artifact
      : ingest && typeof ingest === "object"
        ? ingest
        : null;
  const budgetMeters =
    manifest.budgetMeters && typeof manifest.budgetMeters === "object"
      ? manifest.budgetMeters
      : null;

  const candidates = [
    manifest.budgetCapUsd,
    manifest.budgetUsd,
    ingestArtifact ? ingestArtifact.budgetUsd : undefined,
    budgetMeters ? budgetMeters.budgetCapUsd : undefined,
  ];

  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  return null;
}

/**
 * True iff ANY Approval_Gate in the manifest is already approved. Used to flag
 * the run-initiation precondition (R1.3 is a "before any gate is approved"
 * display); tolerates a missing/empty `approvalGates`.
 *
 * @param {unknown} manifest
 * @returns {boolean}
 */
export function anyGateApproved(manifest) {
  const gates =
    manifest && typeof manifest === "object" && Array.isArray(manifest.approvalGates)
      ? manifest.approvalGates
      : [];
  return gates.some(
    (g) => g && typeof g === "object" && g.approvalState === "approved",
  );
}

// --- Public API -------------------------------------------------------------

/**
 * Build the run-initiation display view-model from a Run_Manifest (or a
 * run-initiation payload).
 *
 * The result ALWAYS lists EVERY planned creative stage in canonical order
 * (research -> storyboard -> render -> publish -> checkout), regardless of how
 * sparse the input is — a minimal/empty manifest still yields the full planned
 * sequence so the creator sees the complete plan before approving spend (R1.3 /
 * Property 32). Per-stage `status` is taken from the manifest when present and
 * defaults to `"planned"` otherwise; the guarding gate id is surfaced so the UI
 * can label each spend boundary. The run's `budgetCapUsd` is surfaced (or
 * `null` when the input carries no cap). `anyGateApproved` records the R1.3
 * precondition so a renderer can assert it is displaying a pre-approval plan.
 *
 * Pure and deterministic: performs no I/O, never mutates the input, and never
 * throws for malformed input.
 *
 * @param {unknown} manifest Run_Manifest or run-initiation payload
 * @returns {{
 *   stages: Array<{
 *     id: string,
 *     label: string,
 *     order: number,
 *     status: string,
 *     gateId: string|null,
 *   }>,
 *   stageCount: number,
 *   budgetCapUsd: number|null,
 *   anyGateApproved: boolean,
 * }}
 */
export function buildRunInitiationView(manifest) {
  const safeManifest =
    manifest && typeof manifest === "object" && !Array.isArray(manifest)
      ? manifest
      : {};
  const stagesById = indexManifestStages(safeManifest);

  const stages = PLANNED_STAGE_ORDER.map((id, index) => {
    const manifestStage = stagesById.get(id) || null;
    const status =
      manifestStage && typeof manifestStage.status === "string"
        ? manifestStage.status
        : DEFAULT_PLANNED_STATUS;
    return {
      id,
      label: PLANNED_STAGE_LABELS[id] || id,
      order: index,
      status,
      gateId: PLANNED_STAGE_GATES[id] || null,
    };
  });

  return {
    stages,
    stageCount: stages.length,
    budgetCapUsd: resolveBudgetCapUsd(safeManifest),
    anyGateApproved: anyGateApproved(safeManifest),
  };
}
