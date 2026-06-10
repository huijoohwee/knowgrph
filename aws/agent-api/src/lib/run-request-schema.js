// `POST /run` request schema validation for the AWS Agent-API tier.
//
// Spec: knowgrph-acos-mcp-connector, task 5.2 (R12.1; design Agent_Api
// `POST /run`; Correctness Property 6).
//
// Pure, deterministic, ZERO-dependency, ZERO-network validator for the
// `POST /run` request body. It returns a structured result
//   { valid: boolean, errors: Array<{ field, reason }> }
// where each error names the offending field and the reason it failed, so the
// schema-failure response (task 5.4) can render an HTTP 4xx that names every
// invalid field, and the forwarding step (task 5.3) can gate on `valid`.
//
// Schema (R12.1):
//   - referenceUrl : required, non-empty, absolute http/https URL, ≤ 2,048 chars
//   - brief        : required string, length 1..10,000 chars
//   - budgetUsd    : number in [0.01, 999,999,999.99]
//   - approvals[]  : array with 0..100 entries (each a gate id string or a
//                    descriptor object carrying a non-empty `gateId`)

// --- Schema bounds (single source of truth) ---------------------------------

/** Maximum length of `referenceUrl`, in characters. */
export const REFERENCE_URL_MAX_LENGTH = 2048;
/** Minimum length of `brief`, in characters. */
export const BRIEF_MIN_LENGTH = 1;
/** Maximum length of `brief`, in characters. */
export const BRIEF_MAX_LENGTH = 10_000;
/** Minimum permitted `budgetUsd` value (inclusive). */
export const BUDGET_USD_MIN = 0.01;
/** Maximum permitted `budgetUsd` value (inclusive). */
export const BUDGET_USD_MAX = 999_999_999.99;
/** Minimum number of `approvals[]` entries. */
export const APPROVALS_MIN_ENTRIES = 0;
/** Maximum number of `approvals[]` entries. */
export const APPROVALS_MAX_ENTRIES = 100;

/** Absolute-URL schemes accepted for `referenceUrl`. */
const ALLOWED_URL_PROTOCOLS = Object.freeze(["http:", "https:"]);

// --- Field validators (each pushes 0..n structured errors) ------------------

/**
 * Validate `referenceUrl`: required, non-empty, an absolute http/https URL of
 * at most REFERENCE_URL_MAX_LENGTH characters.
 *
 * @param {unknown} value
 * @param {Array<{ field: string, reason: string }>} errors
 */
function validateReferenceUrl(value, errors) {
  const field = "referenceUrl";

  if (value === undefined || value === null) {
    errors.push({ field, reason: "referenceUrl is required" });
    return;
  }
  if (typeof value !== "string") {
    errors.push({ field, reason: "referenceUrl must be a string" });
    return;
  }
  if (value.length === 0) {
    errors.push({ field, reason: "referenceUrl must not be empty" });
    return;
  }
  if (value.length > REFERENCE_URL_MAX_LENGTH) {
    errors.push({
      field,
      reason: `referenceUrl must be at most ${REFERENCE_URL_MAX_LENGTH} characters (got ${value.length})`,
    });
    return;
  }

  let parsed;
  try {
    // The URL constructor throws on relative/invalid URLs, giving us an
    // "absolute URL" check with zero dependencies and zero network calls.
    parsed = new URL(value);
  } catch {
    errors.push({ field, reason: "referenceUrl must be an absolute URL" });
    return;
  }
  if (!ALLOWED_URL_PROTOCOLS.includes(parsed.protocol)) {
    errors.push({
      field,
      reason: "referenceUrl must use the http or https scheme",
    });
  }
}

/**
 * Validate `brief`: required string of length BRIEF_MIN_LENGTH..BRIEF_MAX_LENGTH.
 *
 * @param {unknown} value
 * @param {Array<{ field: string, reason: string }>} errors
 */
function validateBrief(value, errors) {
  const field = "brief";

  if (value === undefined || value === null) {
    errors.push({ field, reason: "brief is required" });
    return;
  }
  if (typeof value !== "string") {
    errors.push({ field, reason: "brief must be a string" });
    return;
  }
  if (value.length < BRIEF_MIN_LENGTH) {
    errors.push({ field, reason: "brief must not be empty" });
    return;
  }
  if (value.length > BRIEF_MAX_LENGTH) {
    errors.push({
      field,
      reason: `brief must be at most ${BRIEF_MAX_LENGTH} characters (got ${value.length})`,
    });
  }
}

/**
 * Validate `budgetUsd`: a finite number in [BUDGET_USD_MIN, BUDGET_USD_MAX].
 *
 * @param {unknown} value
 * @param {Array<{ field: string, reason: string }>} errors
 */
function validateBudgetUsd(value, errors) {
  const field = "budgetUsd";

  if (value === undefined || value === null) {
    errors.push({ field, reason: "budgetUsd is required" });
    return;
  }
  // Reject booleans, strings, NaN, Infinity — only finite numbers qualify.
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push({ field, reason: "budgetUsd must be a finite number" });
    return;
  }
  if (value < BUDGET_USD_MIN || value > BUDGET_USD_MAX) {
    errors.push({
      field,
      reason: `budgetUsd must be between ${BUDGET_USD_MIN} and ${BUDGET_USD_MAX} inclusive (got ${value})`,
    });
  }
}

/**
 * Validate `approvals[]`: an array of APPROVALS_MIN_ENTRIES..APPROVALS_MAX_ENTRIES
 * entries. `approvals` is optional; an absent value is treated as an empty
 * array. Each present entry must be a non-empty gate-id string or a descriptor
 * object carrying a non-empty `gateId` (light per-entry shape check).
 *
 * @param {unknown} value
 * @param {Array<{ field: string, reason: string }>} errors
 */
function validateApprovals(value, errors) {
  const field = "approvals";

  // Optional: omitted approvals is equivalent to an empty array (0 entries).
  if (value === undefined || value === null) return;

  if (!Array.isArray(value)) {
    errors.push({ field, reason: "approvals must be an array" });
    return;
  }
  if (value.length > APPROVALS_MAX_ENTRIES) {
    errors.push({
      field,
      reason: `approvals must contain at most ${APPROVALS_MAX_ENTRIES} entries (got ${value.length})`,
    });
    return;
  }

  // Light per-entry shape check.
  for (let i = 0; i < value.length; i += 1) {
    const entry = value[i];
    const isGateIdString = typeof entry === "string" && entry.length > 0;
    const isGateIdObject =
      entry !== null &&
      typeof entry === "object" &&
      typeof entry.gateId === "string" &&
      entry.gateId.length > 0;
    if (!isGateIdString && !isGateIdObject) {
      errors.push({
        field: `approvals[${i}]`,
        reason: "each approval must be a non-empty gate id string or an object with a non-empty gateId",
      });
    }
  }
}

// --- Public API -------------------------------------------------------------

/**
 * Validate a `POST /run` request body against the R12.1 schema.
 *
 * Pure and deterministic: it performs no I/O and never throws for malformed
 * input — every problem is reported as a structured `{ field, reason }` entry.
 *
 * @param {unknown} body the parsed request body
 * @returns {{ valid: boolean, errors: Array<{ field: string, reason: string }> }}
 */
export function validateRunRequest(body) {
  const errors = [];

  if (body === undefined || body === null || typeof body !== "object" || Array.isArray(body)) {
    errors.push({ field: "body", reason: "request body must be a JSON object" });
    return { valid: false, errors };
  }

  validateReferenceUrl(body.referenceUrl, errors);
  validateBrief(body.brief, errors);
  validateBudgetUsd(body.budgetUsd, errors);
  validateApprovals(body.approvals, errors);

  return { valid: errors.length === 0, errors };
}
