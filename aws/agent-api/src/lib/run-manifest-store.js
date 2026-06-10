// Run_Manifest persistence seam for the AWS Agent-API tier.
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

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

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

/** Internal-only metadata used for same-session run ownership checks. */
export const RUN_OWNER_PRINCIPAL_FIELD = "ownerPrincipalId";

/** Default S3 prefix for persisted Run_Manifest records. */
export const DEFAULT_MANIFEST_STORE_PREFIX = "runs";

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
    ownerPrincipalId:
      typeof opts.ownerPrincipalId === "string" && opts.ownerPrincipalId.length > 0
        ? opts.ownerPrincipalId
        : null,
  };
}

function normalizeManifestStorePrefix(prefix) {
  const value = String(prefix ?? "").trim().replace(/^\/+|\/+$/g, "");
  return value || DEFAULT_MANIFEST_STORE_PREFIX;
}

export function buildManifestStorageKey(runId, prefix = DEFAULT_MANIFEST_STORE_PREFIX) {
  const id = normalizeRunId(runId);
  if (!id) return null;
  return `${normalizeManifestStorePrefix(prefix)}/${encodeURIComponent(id)}.json`;
}

function normalizeManifestRecord(value) {
  if (!value || typeof value !== "object") {
    throw new Error("run manifest record must be an object");
  }
  if ("manifest" in value) {
    return buildManifestRecord(value.manifest, {
      runId: value.runId,
      persistedAt: value.persistedAt,
      contractVersion: value.contractVersion,
      ownerPrincipalId: value.ownerPrincipalId,
    });
  }
  return buildManifestRecord(value);
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
 * @returns {{ read: (runId: string) => (object|undefined), write: (record: object) => object, seedRun: Function, has: Function }}
 */
export function createInMemoryManifestStore(seed = {}) {
  const records = new Map();

  function seedRun(runId, value) {
    const id = normalizeRunId(runId);
    if (!id) throw new Error("createInMemoryManifestStore: runId must be a non-empty string");
    const record = normalizeManifestRecord(
      value && typeof value === "object" && "manifest" in value
        ? { ...value, runId: normalizeRunId(value.runId) ?? id }
        : { runId: id, manifest: value },
    );
    records.set(id, record);
    return record;
  }

  for (const [runId, value] of Object.entries(seed)) seedRun(runId, value);

  return {
    /** Read the current persisted record for a run, or `undefined` if unknown. */
    read(runId) {
      const id = normalizeRunId(runId);
      if (!id) return undefined;
      return records.get(id);
    },
    /** Insert or replace a run's record using the shared persistence shape. */
    write(record) {
      const normalized = normalizeManifestRecord(record);
      if (!normalized.runId) {
        throw new Error("createInMemoryManifestStore.write: record must carry a non-empty runId");
      }
      records.set(normalized.runId, normalized);
      return normalized;
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
    async write(record) {
      return normalizeManifestRecord(record);
    },
    has() {
      return false;
    },
  };
}

function isMissingObjectError(err) {
  const code = String(err?.name ?? err?.Code ?? err?.code ?? "");
  return code === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404;
}

function parseStoredRecord(text) {
  const parsed = JSON.parse(text);
  return normalizeManifestRecord(parsed);
}

/**
 * S3-backed durable Run_Manifest store for deployed Agent-API runtimes.
 *
 * Reads/writes a JSON record per run under:
 *   `<prefix>/<encodeURIComponent(runId)>.json`
 *
 * The stored shape mirrors the worker persistence record and adds one
 * Agent-API-only field, `ownerPrincipalId`, which is used only for same-session
 * read authorization and is never reflected in the `GET /runs/{id}` response.
 *
 * @param {{ bucket: string, prefix?: string, client?: S3Client }} params
 * @returns {{ read: (runId: string) => Promise<object|undefined>, write: (record: object) => Promise<object>, has: (runId: string) => Promise<boolean> }}
 */
export function createS3ManifestStore(params = {}) {
  const bucket = String(params.bucket ?? "").trim();
  if (!bucket) {
    throw new Error("createS3ManifestStore: bucket is required");
  }
  const prefix = normalizeManifestStorePrefix(params.prefix);
  const client = params.client ?? new S3Client({});

  return {
    async read(runId) {
      const key = buildManifestStorageKey(runId, prefix);
      if (!key) return undefined;
      try {
        const response = await client.send(new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        }));
        const text = await response.Body?.transformToString?.();
        if (typeof text !== "string" || text.length === 0) {
          return undefined;
        }
        return parseStoredRecord(text);
      } catch (err) {
        if (isMissingObjectError(err)) return undefined;
        throw err;
      }
    },
    async write(record) {
      const normalized = normalizeManifestRecord(record);
      if (!normalized.runId) {
        throw new Error("createS3ManifestStore.write: record must carry a non-empty runId");
      }
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: buildManifestStorageKey(normalized.runId, prefix),
        Body: JSON.stringify(normalized),
        ContentType: "application/json",
      }));
      return normalized;
    },
    async has(runId) {
      return (await this.read(runId)) !== undefined;
    },
  };
}

/**
 * Resolve the deployed/default manifest store from environment.
 *
 * `ARTIFACT_BUCKET` present -> S3-backed durable store
 * absent -> not-wired store (fail closed to the unknown-run seam)
 *
 * @param {{ env?: Record<string, string|undefined>, client?: S3Client, prefix?: string }} [params]
 * @returns {ReturnType<typeof createS3ManifestStore> | ReturnType<typeof createNotWiredManifestStore>}
 */
export function createDefaultManifestStore(params = {}) {
  const env = params.env ?? (typeof process !== "undefined" ? process.env : {}) ?? {};
  const bucket = String(env.ARTIFACT_BUCKET ?? "").trim();
  if (!bucket) {
    return createNotWiredManifestStore();
  }
  return createS3ManifestStore({
    bucket,
    prefix: params.prefix ?? env.RUN_MANIFEST_PREFIX,
    client: params.client,
  });
}
