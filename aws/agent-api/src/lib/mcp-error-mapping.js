// Typed-MCP-error mapping for the AWS Agent-API tier.
//
// Spec: knowgrph-acos-mcp-connector, task 5.9 (R12.7; design Agent_Api
// "MCP error mapping"; Correctness Property 24).
//
// SCOPE OF THIS TASK (5.9): the MCP forwarder (`src/lib/mcp-forwarder.js`)
// returns a result that may carry an `mcpError` (a JSON-RPC error surfaced by
// the McpAgent). This module is a PURE, deterministic mapper — it makes ZERO
// live network/AWS calls — that classifies a returned typed MCP error into one
// of two dispositions and derives an updated Run_Manifest:
//
//   - An "approval required" / gate-prompt error  -> mapped to a gate prompt:
//     a PENDING Approval_Gate appended to the manifest's `approvalGates[]` so
//     the Frontend can render the pending gate (R13.1). The McpAgent boundary
//     already emits an "approval required" signal for gated stage tools
//     (worker tier task 1.6 -> `buildApprovalRequiredEnvelope`).
//   - Any other typed MCP error  -> mapped to a FAILURE RECORD appended to the
//     manifest's `failures[]` (the `{ stageId, finalRetryCount, reason }` shape
//     the Director/worker tier uses; design Data Models -> Run_Manifest).
//
// In BOTH cases the EXISTING Run_Manifest state is PRESERVED (R12.7 /
// Property 24): the mapping APPENDS/DERIVES onto a deep COPY of the input
// manifest; it never overwrites prior `state`, `stages`, `approvalGates`,
// `budgetMeters`, `failures`, or any other field, and it never mutates the
// caller's manifest object. When the forwarder result carries no `mcpError`
// the manifest is returned unchanged (a structurally-equal derived copy).
//
// SHAPE REUSE (R11 stack boundary / reuse-not-rebuild): the Approval_Gate and
// failure-record shapes mirror the control-plane worker
// (`cloudflare/workers/knowgrph-mcp/tool-registry.mjs`
// -> `buildApprovalRequiredEnvelope` and design Data Models -> Run_Manifest)
// WITHOUT importing from the control plane, exactly as the sibling
// `mcp-forwarder.js` / `run-manifest-store.js` seams do.

// --- Disposition + classification constants ---------------------------------

/**
 * The "approval required" status string emitted by the McpAgent gate boundary
 * (worker `buildApprovalRequiredEnvelope` -> `status: "approval_required"` and
 * `error.code: "approval_required"`). Kept as a local constant so the thin
 * product tier imports nothing from the control plane (R11 stack boundary).
 */
export const MCP_APPROVAL_REQUIRED_STATUS = "approval_required";

/** Disposition tags returned by {@link mapMcpErrorToManifest}. */
export const MCP_ERROR_DISPOSITION = Object.freeze({
  /** Mapped to a pending Approval_Gate (gate prompt) for the Frontend. */
  GATE_PROMPT: "gate_prompt",
  /** Mapped to a failure record appended to `failures[]`. */
  FAILURE_RECORD: "failure_record",
  /** No typed MCP error present -> manifest returned unchanged. */
  UNCHANGED: "unchanged",
});

/** Approval-gate states (design Data Models -> ApprovalGate.approvalState). */
export const APPROVAL_GATE_STATE = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});

// --- Internal helpers -------------------------------------------------------

/**
 * Deep-copy a Run_Manifest so the mapping derives a fresh object and never
 * mutates the caller's manifest (Property 24 immutability). Uses the native
 * `structuredClone` when available, falling back to JSON round-trip (the
 * manifest is JSON-serializable by contract — design Data Models).
 */
function cloneManifest(manifest) {
  if (manifest === null || manifest === undefined) return manifest;
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(manifest);
    } catch {
      /* fall through to JSON clone for non-cloneable inputs */
    }
  }
  return JSON.parse(JSON.stringify(manifest));
}

/** Whether a value is a usable (non-null) plain object. */
function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** First defined, non-empty trimmed string among the candidates, else null. */
function firstString(...candidates) {
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
}

/** Coerce a value to a finite non-negative integer, else the fallback. */
function toNonNegativeInt(value, fallback = 0) {
  const n = Number(value);
  if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  return fallback;
}

/** Coerce a value to a finite non-negative decimal, else the fallback. */
function toNonNegativeDecimal(value, fallback = 0) {
  const n = Number(value);
  if (Number.isFinite(n) && n >= 0) return n;
  return fallback;
}

/**
 * Normalize the several shapes a typed MCP error may take into a flat view the
 * classifier/builders read from. A JSON-RPC error is `{ code, message, data }`;
 * the McpAgent commonly nests its structured envelope under `data` (and may
 * further nest an `error: { code, message }`). This collects the status/code,
 * gate id, stage id, retry count, cost and message from wherever they appear.
 *
 * @param {unknown} mcpError a JSON-RPC error (or already-unwrapped envelope)
 * @returns {{
 *   present: boolean,
 *   statusCandidates: string[],
 *   gateId: string|null,
 *   stageId: string|null,
 *   finalRetryCount: number,
 *   estimatedCostUsd: number,
 *   message: string,
 *   code: (string|number|null),
 * }}
 */
function normalizeMcpError(mcpError) {
  if (!isObject(mcpError)) {
    return {
      present: false,
      statusCandidates: [],
      gateId: null,
      stageId: null,
      finalRetryCount: 0,
      estimatedCostUsd: 0,
      message: "",
      code: null,
    };
  }

  const data = isObject(mcpError.data) ? mcpError.data : {};
  const nestedError = isObject(data.error) ? data.error : {};

  // Collect every place a "status"/"code" discriminator may live so the
  // approval-required signal is detected regardless of nesting depth.
  const statusCandidates = [
    mcpError.status,
    mcpError.code,
    data.status,
    data.code,
    nestedError.code,
    nestedError.status,
  ].filter((value) => typeof value === "string");

  const gateId = firstString(mcpError.gateId, data.gateId, nestedError.gateId);
  const stageId = firstString(
    mcpError.stageId,
    data.stageId,
    nestedError.stageId,
    data.stage,
  );
  const finalRetryCount = toNonNegativeInt(
    mcpError.finalRetryCount ??
      data.finalRetryCount ??
      mcpError.retryCount ??
      data.retryCount,
    0,
  );
  const estimatedCostUsd = toNonNegativeDecimal(
    mcpError.estimatedCostUsd ?? data.estimatedCostUsd,
    0,
  );
  const message =
    firstString(
      mcpError.message,
      nestedError.message,
      data.message,
      typeof mcpError.code === "string" ? mcpError.code : null,
    ) || "unknown MCP error";

  const code =
    typeof mcpError.code === "string" || typeof mcpError.code === "number"
      ? mcpError.code
      : null;

  return {
    present: true,
    statusCandidates,
    gateId,
    stageId,
    finalRetryCount,
    estimatedCostUsd,
    message,
    code,
  };
}

// --- Public classification + builders ---------------------------------------

/**
 * Whether a typed MCP error is an "approval required" / gate-prompt signal.
 * True when any status/code discriminator (at any nesting depth) equals
 * `"approval_required"` (the McpAgent gate-boundary signal, worker task 1.6).
 *
 * @param {unknown} mcpError
 * @returns {boolean}
 */
export function isApprovalRequiredError(mcpError) {
  const view = normalizeMcpError(mcpError);
  return view.statusCandidates.includes(MCP_APPROVAL_REQUIRED_STATUS);
}

/**
 * Build a PENDING Approval_Gate (gate prompt) from an approval-required MCP
 * error, mirroring the design Data Models `ApprovalGate` shape so the Frontend
 * renders it like any Director-emitted pending gate (R13.1).
 *
 * @param {unknown} mcpError
 * @returns {{ gateId: string|null, approvalState: "pending", estimatedCostUsd: number, token: null }}
 */
export function buildGatePromptFromMcpError(mcpError) {
  const view = normalizeMcpError(mcpError);
  return {
    gateId: view.gateId,
    approvalState: APPROVAL_GATE_STATE.PENDING,
    estimatedCostUsd: view.estimatedCostUsd,
    token: null,
  };
}

/**
 * Build a failure record from a (non-approval) typed MCP error, mirroring the
 * Director/worker `failures[]` entry shape `{ stageId, finalRetryCount, reason }`
 * (design Data Models -> Run_Manifest; R5.4).
 *
 * @param {unknown} mcpError
 * @param {{ stageId?: string }} [opts] caller-supplied stage id fallback (e.g.
 *   the stage the forward targeted) when the error carries none
 * @returns {{ stageId: string, finalRetryCount: number, reason: string }}
 */
export function buildFailureRecordFromMcpError(mcpError, opts = {}) {
  const view = normalizeMcpError(mcpError);
  return {
    stageId: view.stageId || firstString(opts.stageId) || "unknown",
    finalRetryCount: view.finalRetryCount,
    reason: view.message,
  };
}

/**
 * Map a typed MCP error onto a Run_Manifest, preserving the existing manifest
 * state (R12.7 / Property 24). The input manifest is NEVER mutated — a deep
 * copy is derived, the gate prompt / failure record is APPENDED, and prior
 * fields are left intact.
 *
 *   - approval-required error -> append a pending Approval_Gate (gate prompt).
 *     If an equivalent pending gate for the same `gateId` already exists, it is
 *     NOT duplicated (idempotent append).
 *   - any other error         -> append a failure record to `failures[]`.
 *   - no error (null/undefined/non-object) -> the manifest is returned
 *     unchanged (a structurally-equal derived copy).
 *
 * @param {object|null|undefined} manifest the existing Run_Manifest for the run
 * @param {unknown} mcpError the forwarder's `mcpError` (JSON-RPC error) or null
 * @param {{ stageId?: string }} [opts] stage-id fallback for failure records
 * @returns {{
 *   disposition: "gate_prompt"|"failure_record"|"unchanged",
 *   manifest: object|null|undefined,
 *   gatePrompt: object|null,
 *   failureRecord: object|null,
 * }}
 */
export function mapMcpErrorToManifest(manifest, mcpError, opts = {}) {
  const derived = cloneManifest(manifest);

  // No typed error -> manifest unchanged (derived copy, prior state preserved).
  if (!isObject(mcpError)) {
    return {
      disposition: MCP_ERROR_DISPOSITION.UNCHANGED,
      manifest: derived,
      gatePrompt: null,
      failureRecord: null,
    };
  }

  // The derived value is only mutated below; the caller's `manifest` is intact.
  const target = isObject(derived) ? derived : {};

  if (isApprovalRequiredError(mcpError)) {
    const gatePrompt = buildGatePromptFromMcpError(mcpError);
    const gates = Array.isArray(target.approvalGates)
      ? target.approvalGates
      : (target.approvalGates = []);
    // Idempotent append: don't duplicate an existing pending gate for the same
    // gateId (the McpAgent may re-signal the same gate across retries).
    const alreadyPending = gates.some(
      (gate) =>
        isObject(gate) &&
        gate.gateId === gatePrompt.gateId &&
        gate.approvalState === APPROVAL_GATE_STATE.PENDING,
    );
    if (!alreadyPending) gates.push(gatePrompt);
    return {
      disposition: MCP_ERROR_DISPOSITION.GATE_PROMPT,
      manifest: target,
      gatePrompt,
      failureRecord: null,
    };
  }

  // Any other typed MCP error -> append a failure record to failures[].
  const failureRecord = buildFailureRecordFromMcpError(mcpError, opts);
  const failures = Array.isArray(target.failures)
    ? target.failures
    : (target.failures = []);
  failures.push(failureRecord);
  return {
    disposition: MCP_ERROR_DISPOSITION.FAILURE_RECORD,
    manifest: target,
    gatePrompt: null,
    failureRecord,
  };
}

/**
 * Convenience: map a forwarder RESULT (the `{ ..., mcpError, result }` object
 * returned by `createMcpForwarder`) directly onto a manifest. Extracts the
 * `mcpError` field and delegates to {@link mapMcpErrorToManifest}.
 *
 * @param {object|null|undefined} manifest
 * @param {{ mcpError?: unknown }|null|undefined} forwarderResult
 * @param {{ stageId?: string }} [opts]
 */
export function mapForwarderResultToManifest(manifest, forwarderResult, opts = {}) {
  const mcpError = isObject(forwarderResult) ? forwarderResult.mcpError : null;
  return mapMcpErrorToManifest(manifest, mcpError, opts);
}
