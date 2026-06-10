// Run_Manifest read seam for the AWS Agent-API tier.
//
// Spec: knowgrph-acos-mcp-connector, task 5.6 (R12.5; design Agent_Api
// `GET /runs/{id}`; Data Models -> Run_Manifest).
//
// SCOPE OF THIS TASK (5.6): the `GET /runs/{id}` handler reads the current
// Run_Manifest for a KNOWN run id through an INJECTABLE manifest-store seam so
// the local runtime/tests make ZERO live network/AWS calls. The durable store
// wiring (DynamoDB / S3 / a fetch to the control-plane
// `GET /knowgrph/mcp/runs/{id}` route) is integration task 9.2 and is a drop-in
// swap for the default seam below.
//
// SHAPE REUSE (R11 stack boundary): this seam MIRRORS the durable Run_Manifest
// store record returned by the McpAgent worker
// (`cloudflare/workers/knowgrph-mcp/run-manifest/persistence.mjs`
// -> `RunManifestPersistence.get()` /
// `readRunManifestThroughNamespace`) without importing from the control plane.
// A persisted record is:
//   { runId, persistedAt, contractVersion, manifest }
// and an unknown run reads back as `undefined` (the worker store answers 404 /
// `null`). The Run_Manifest payload itself is the Director's
// `{ runId, state, mode, stages[], approvalGates[], budgetMeters, demoPack,
//    failures[], reconciliationFlags[] }` tree (design Data Models).

// --- Read deadline (R12.5) --------------------------------------------------

/**
 * Structural read deadline per R12.5: a `GET /runs/{id}` for a KNOWN run id
 * must return the current Run_Manifest within 1,000 ms. Timer-free here — the
 * deterministic in-memory seam reads synchronously; an injectable elapsed
 * signal (`readElapsedMs`) models a slow durable read so the metadata can be
 * asserted structurally, mirroring the render/commerce/forwarder deadline
 * pattern (`RENDER_DISPATCH_DEADLINE_MS` / `COMMERCE_CHECKOUT_DEADLINE_MS` /
 * `MCP_FORWARD_DEADLINE_MS`).
 */
export const RUN_MANIFEST_READ_DEADLINE_MS = 1000;

/**
 * Storage record field names mirrored from the worker durable store
 * (`RUN_MANIFEST_STORAGE_KEYS` in the control-plane `run-manifest/shared.mjs`).
 * Kept as a local constant so the thin product tier imports nothing from the
 * control plane (R11 stack boundary).
 */
export const RUN_MANIFEST_RECORD_FIELDS = Object.freeze([
  "runId",
  "persistedAt",
  "contractVersion",
  "manifest",
]);

/** Normalize a run id into a non-empty trimmed string, or `null`. */
export function normalizeRunId(runId) {
  const id = String(runId ?? "").trim();
  return id || null;
}

/**
 * Build a persistence record around a Run_Manifest, mirroring the worker
 * store's `RunManifestPersistence.get()` return shape. Used by the in-memory
 * seam (and tests) to seed known runs without duplicating the control-plane
 * store. The record's `runId` is taken from the manifest unless overridden.
 *
 * @param {object} manifest the Run_Manifest payload (design Data Models)
 * @param {object} [opts]
 * @param {string} [opts.runId] override the record runId (defaults to manifest.runId)
 * @param {string} [opts.persistedAt] ISO timestamp of the last persist
 * @param {string|null} [opts.contractVersion] manifest contract version
 * @returns {{ runId: string|null, persistedAt: string|null, contractVersion: string|null, manifest: object }}
 */
export function buildManifestRecord(manifest, opts = {}) {
  const runId = normalizeRunId(opts.runId ?? manifest?.runId);
  return {
    runId,
    persistedAt: typeof opts.persistedAt === "string" ? opts.persistedAt : null,
    contractVersion:
      opts.contractVersion !== undefined
        ? opts.contractVersion
        : manifest?.contractVersion ?? null,
    manifest,
  };
}

/**
 * Create a deterministic, in-memory manifest-store seam for local runtime and
 * tests. Makes ZERO network/AWS calls. `read(runId)` returns the persisted
 * record for a KNOWN run id, or `undefined` for an unknown one (mirroring the
 * worker store's 404 / `null` so the `GET /runs/{id}` handler can branch the
 * unknown-run 404 seam — task 5.7).
 *
 * @param {object} [seed] map of `runId -> (Run_Manifest | persistence record)`.
 *   A bare Run_Manifest is wrapped via `buildManifestRecord`; a full record
 *   (carrying a `manifest` field) is stored as-is.
 * @returns {{ read: (runId: string) => (object|undefined), seedRun: Function, has: Function }}
 */
export function createInMemoryManifestStore(seed = {}) {
  const records = new Map();

  function seedRun(runId, value) {
    const id = normalizeRunId(runId);
    if (!id) throw new Error("createInMemoryManifestStore: runId must be a non-empty string");
    const record =
      value && typeof value === "object" && "manifest" in value
        ? { ...value, runId: normalizeRunId(value.runId) ?? id }
        : buildManifestRecord(value, { runId: id });
    records.set(id, record);
  }

  for (const [runId, value] of Object.entries(seed)) seedRun(runId, value);

  return {
    /** Read the current persisted record for a run, or `undefined` if unknown. */
    read(runId) {
      const id = normalizeRunId(runId);
      if (!id) return undefined;
      return records.get(id);
    },
    /** Test/local helper: insert or replace a run's record. */
    seedRun,
    /** Whether a run id is known to the store. */
    has(runId) {
      const id = normalizeRunId(runId);
      return id ? records.has(id) : false;
    },
  };
}

/**
 * Default manifest-store seam for an un-wired deployment. Every read returns
 * `undefined` (no durable store is connected yet — task 9.2), so the handler
 * exercises its unknown-run 404 seam (task 5.7) until a real store is injected.
 * Makes ZERO network/AWS calls.
 */
export function createNotWiredManifestStore() {
  return {
    read() {
      return undefined;
    },
    has() {
      return false;
    },
  };
}
