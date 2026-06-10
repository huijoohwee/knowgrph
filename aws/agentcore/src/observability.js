// AgentCore Runtime observability for the knowgrph MCP-forwarding adapter.
//
// Spec: knowgrph-acos-mcp-connector, task 13.6 (R14.5, R15.7; design
// "Mcp_Agent › Observability"; Correctness Property 27). Audit decision 13.0:
// the AgentCore Runtime artifact is a THIN MCP-FORWARDING ADAPTER — the
// Cloudflare control plane is the SOURCE OF TRUTH for stage transitions (it
// emits the canonical diagnostic on task 1.5). This module RELAYS those
// forwarded stage-transition diagnostics through AgentCore's BUILT-IN
// observability path (a structured stdout / OTEL-friendly sink that the
// AgentCore Runtime container ships to CloudWatch / OTEL).
//
// The canonical R14.5 diagnostic shape is EXACTLY the five fields
// `{ runId, fromStage, toStage, utcTimestamp, outcomeStatus }` (Property 27).
// This module enforces that shape by PICKING ONLY those five fields and then
// asserts — fail-closed — that NO credential, Auth_Token, Approval_Token, or
// other secret material is present before anything reaches a trace/log (R15.7).
//
// The emitter is PURE + injectable: the structured-log sink and the clock are
// seams, so the local runtime/tests make ZERO live calls and never write a real
// log line during tests.

/**
 * The canonical R14.5 stage-transition diagnostic field set (Property 27).
 * A diagnostic emitted from this tier carries EXACTLY these five keys.
 */
export const STAGE_TRANSITION_FIELDS = Object.freeze([
  "runId",
  "fromStage",
  "toStage",
  "utcTimestamp",
  "outcomeStatus",
]);

/**
 * Forbidden key/value patterns that must NEVER reach a trace/log (R15.7). These
 * cover Auth_Token / Approval_Token material, raw bearer credentials, and
 * generic secret/credential markers. The redaction guard is a fail-closed
 * safety net: the canonical projection already drops every non-canonical key,
 * so a leak would require a secret embedded INSIDE a canonical value.
 */
const FORBIDDEN_PATTERNS = Object.freeze([
  /authorization/i,
  /auth[_-]?token/i,
  /approval[_-]?token/i,
  /\bbearer\b/i,
  /secret/i,
  /password/i,
  /passphrase/i,
  /credential/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /\btoken\b/i,
  /\beyJ[A-Za-z0-9_-]{6,}\b/, // a JWT-looking blob (header.payload.signature)
]);

/**
 * Thrown when a diagnostic about to be emitted contains secret/token material.
 * The message NEVER echoes the offending value — only the field name — so the
 * error itself cannot leak a credential (R15.7).
 */
export class DiagnosticRedactionError extends Error {
  constructor(field) {
    super(`stage-transition diagnostic blocked: field "${field}" contains secret/token material`);
    this.name = "DiagnosticRedactionError";
    this.code = "diagnostic_redaction";
    this.field = field;
  }
}

/** True when a string contains any forbidden secret/token marker. */
function containsForbidden(value) {
  if (typeof value !== "string") return false;
  return FORBIDDEN_PATTERNS.some((re) => re.test(value));
}

/**
 * Assert a canonical diagnostic carries NO secret/token/Authorization material
 * in any key OR value (R15.7). Throws `DiagnosticRedactionError` (fail-closed)
 * naming only the offending field. Pure; no I/O.
 *
 * @param {Record<string, unknown>} diagnostic
 * @returns {Record<string, unknown>} the same diagnostic when clean
 */
export function assertNoSecretMaterial(diagnostic) {
  if (!diagnostic || typeof diagnostic !== "object") {
    throw new DiagnosticRedactionError("(root)");
  }
  for (const [key, value] of Object.entries(diagnostic)) {
    if (containsForbidden(key)) throw new DiagnosticRedactionError(key);
    if (containsForbidden(value)) throw new DiagnosticRedactionError(key);
  }
  return diagnostic;
}

/** Coerce a stage-id-like field to a string or null (never an arbitrary object). */
function asStageString(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

/**
 * Project an arbitrary forwarded diagnostic onto EXACTLY the five canonical
 * R14.5 fields (Property 27), dropping every other key by construction. Any
 * missing `utcTimestamp` is filled from the injected clock; a missing
 * `outcomeStatus` falls back to `"unknown"` (mirrors the control-plane builder).
 *
 * @param {Record<string, unknown>} raw
 * @param {() => number} clock ms clock seam
 * @returns {{ runId: string|null, fromStage: string|null, toStage: string|null, utcTimestamp: string, outcomeStatus: string }}
 */
export function toCanonicalDiagnostic(raw, clock) {
  const source = raw && typeof raw === "object" ? raw : {};
  const ts =
    typeof source.utcTimestamp === "string" && source.utcTimestamp.length > 0
      ? source.utcTimestamp
      : new Date(clock()).toISOString();
  const outcome =
    typeof source.outcomeStatus === "string" && source.outcomeStatus.length > 0
      ? source.outcomeStatus
      : "unknown";
  return {
    runId: asStageString(source.runId),
    fromStage: asStageString(source.fromStage),
    toStage: asStageString(source.toStage),
    utcTimestamp: ts,
    outcomeStatus: outcome,
  };
}

/**
 * Locate the stage-transition diagnostics carried on a forwarded control-plane
 * `tools/call` result. The Director output advertises them under
 * `stageTransitions` (control-plane tool-registry schema); they may sit at the
 * top level OR under `structuredContent` depending on the MCP envelope. Returns
 * `[]` when none are present (a non-Director stage tool carries none).
 *
 * @param {unknown} result the control-plane tools/call result
 * @returns {Array<Record<string, unknown>>}
 */
export function extractStageTransitions(result) {
  if (!result || typeof result !== "object") return [];
  const candidates = [
    result.stageTransitions,
    result.structuredContent && typeof result.structuredContent === "object"
      ? result.structuredContent.stageTransitions
      : undefined,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((d) => d && typeof d === "object");
    }
  }
  return [];
}

/**
 * The default structured-log sink: a single JSON line on stdout, which the
 * AgentCore Runtime container forwards to its built-in observability backend
 * (CloudWatch Logs / OTEL). The line is tagged so downstream pipelines can
 * route it. No secrets reach here — the emitter asserts redaction first.
 */
function defaultSink(record) {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(record));
}

/**
 * Create the redaction-safe stage-transition diagnostic emitter.
 *
 * The returned `emit(rawDiagnostics)` function:
 *   1. projects each forwarded diagnostic onto the EXACTLY five canonical R14.5
 *      fields (Property 27), dropping all other keys by construction;
 *   2. asserts — fail-closed — that no Auth_Token / Approval_Token / secret /
 *      Authorization material is present (R15.7); a blocked diagnostic is
 *      skipped (never logged) and recorded as `blocked`;
 *   3. writes each clean diagnostic to the structured-log/OTEL sink, tagged
 *      `knowgrph.agentcore.stage_transition`.
 *
 * @param {object} [deps]
 * @param {(record: object) => void} [deps.sink] structured-log sink (default stdout JSON)
 * @param {() => number} [deps.clock] ms clock seam (default `Date.now`)
 * @returns {{ emit: (rawDiagnostics: unknown) => { emitted: Array<object>, blocked: number } }}
 */
export function createStageTransitionEmitter(deps = {}) {
  const sink = typeof deps.sink === "function" ? deps.sink : defaultSink;
  const clock = typeof deps.clock === "function" ? deps.clock : () => Date.now();

  function emit(rawDiagnostics) {
    const list = Array.isArray(rawDiagnostics) ? rawDiagnostics : [];
    const emitted = [];
    let blocked = 0;
    for (const raw of list) {
      const canonical = toCanonicalDiagnostic(raw, clock);
      try {
        assertNoSecretMaterial(canonical);
      } catch (err) {
        // Fail-closed: a diagnostic that would leak secret material is DROPPED
        // (never written) — the relay tier must not emit it (R15.7).
        if (err instanceof DiagnosticRedactionError) {
          blocked += 1;
          continue;
        }
        throw err;
      }
      sink({ kind: "knowgrph.agentcore.stage_transition", diagnostic: canonical });
      emitted.push(canonical);
    }
    return { emitted, blocked };
  }

  return { emit };
}
