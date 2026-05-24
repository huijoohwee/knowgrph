# Knowgrph Storage Schemas & Route Contracts

**Context**: Schema appendix for the Knowgrph storage and sync system.
**Intent**: Single reference for all record shapes, D1 tables, browser-local cache collections, and API route contracts.
**Directive**: Keep this file as a pure reference; architectural decisions and runtime wiring live in `knowgrph-storage-sync.md`.

---

**Version**: 2.1.0
**Date**: 2026-05-13
**Canonical index**: `knowgrph-storage-sync-document.md`
**See also**: `knowgrph-multi-user-collaboration-prd.tad.md` (auth tables, role-based access extension)

## Schema Principles

- Keep Git markdown as authoring truth.
- Store raw markdown once per document revision.
- Persist chunks and graph snapshots separately.
- Keep stable ids and monotonic revisions.
- Use hashes for dedupe and bounded prompt reuse.
- Keep browser-local names stable across the persisted-cache contract.

---

## Shared Contract

Primary file: `canvas/src/lib/storage/knowgrphStorageSyncContract.ts`

```ts
export const KNOWGRPH_STORAGE_API_VERSION = '2026-05-04'

export const KNOWGRPH_STORAGE_ROUTE_PATHS = {
  push: '/api/storage/push',
  pull: '/api/storage/pull',
  exportPrefix: '/api/storage/export/',
} as const
```

### Remote Document Shape

```ts
type KgDocumentRecord = {
  id: string
  workspaceId: string
  canonicalPath: string
  title: string | null
  docType: string | null
  lang: string | null
  graphId: string | null
  sourceKind: 'markdown'
  contentMd: string
  contentHash: string
  parserVersion: string
  revision: number
  updatedAtMs: number
  deleted: boolean
}
```

### Remote Chunk Shape

```ts
type KgDocumentChunkRecord = {
  id: string
  documentId: string
  workspaceId: string
  chunkKey: string
  chunkOrder: number
  heading: string | null
  markdown: string
  tokenEstimate: number
  contentHash: string
  updatedAtMs: number
}
```

### Remote Graph Snapshot Shape

```ts
type KgGraphSnapshotRecord = {
  id: string
  documentId: string
  workspaceId: string
  graphRevision: number
  graphHash: string
  graphJson: Record<string, unknown>
  layoutJson: Record<string, unknown> | null
  derivedFromDocumentRevision: number
  updatedAtMs: number
}
```

### Outbox Shape

```ts
type KnowgrphStorageOutboxRecord = {
  id: string
  workspaceId: string
  deviceId: string
  entity: 'document' | 'documentChunk' | 'graphSnapshot'
  op: 'upsert' | 'delete'
  recordId: string
  baseRevision: number | null
  payload: Record<string, unknown>
  payloadHash: string
  attemptCount: number
  lastAckStatus: 'applied' | 'conflict' | 'rejected' | 'deferred' | ''
  lastAckMessage: string | null
  createdAtMs: number
  updatedAtMs: number
}
```

---

## Browser-Local Cache Schema

Primary file: `canvas/src/lib/storage/knowgrphStorageDb.ts`

### Why Local Shapes Differ

The local cache keeps existing browser-local field names, so the store uses:

- `documentRevision` instead of remote `revision`
- `isDeleted` instead of remote `deleted`

### Collections

1. `documents`
2. `documentChunks`
3. `graphSnapshots`
4. `syncOutbox`
5. `syncCursor`

### Local Document Shape

```ts
type KgDocumentLocalRecord = {
  id: string
  workspaceId: string
  canonicalPath: string
  title: string | null
  docType: string | null
  lang: string | null
  graphId: string | null
  sourceKind: 'markdown'
  contentMd: string
  contentHash: string
  parserVersion: string
  documentRevision: number
  updatedAtMs: number
  isDeleted: boolean
}
```

### Index Guidance

| Collection | Index fields |
|---|---|
| `documents` | `workspaceId`, `canonicalPath`, `updatedAtMs` |
| `documentChunks` | `documentId`, `[documentId, chunkKey]`, `updatedAtMs` |
| `graphSnapshots` | `documentId`, `graphRevision`, `updatedAtMs` |
| `syncOutbox` | `workspaceId`, `updatedAtMs` |
| `syncCursor` | `workspaceId` |

### Local Role

- Working copy store
- Offline restore cache
- Prompt reuse cache
- Mutation outbox
- Pull cursor cache

---

## Cloudflare D1 Schema

Primary migration: `cloudflare/d1/migrations/0001_knowgrph_storage.sql`

### Tables

```sql
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  canonical_path TEXT NOT NULL,
  title TEXT,
  doc_type TEXT,
  lang TEXT,
  graph_id TEXT,
  source_kind TEXT NOT NULL DEFAULT 'markdown',
  content_md TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  revision INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, canonical_path)
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  chunk_key TEXT NOT NULL,
  chunk_order INTEGER NOT NULL,
  heading TEXT,
  markdown TEXT NOT NULL,
  token_estimate INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE (document_id, chunk_key)
);

CREATE TABLE IF NOT EXISTS graph_snapshots (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  graph_revision INTEGER NOT NULL,
  graph_hash TEXT NOT NULL,
  graph_json TEXT NOT NULL,
  layout_json TEXT,
  derived_from_document_revision INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE (document_id, graph_revision)
);

CREATE TABLE IF NOT EXISTS sync_devices (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  device_label TEXT,
  last_pull_cursor TEXT,
  last_push_cursor TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sync_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES sync_devices(id) ON DELETE CASCADE
);
```

### Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_documents_workspace_updated
  ON documents(workspace_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_chunks_doc_order
  ON document_chunks(document_id, chunk_order ASC);

CREATE INDEX IF NOT EXISTS idx_document_chunks_doc_key
  ON document_chunks(document_id, chunk_key);

CREATE INDEX IF NOT EXISTS idx_graph_snapshots_doc_rev
  ON graph_snapshots(document_id, graph_revision DESC);

CREATE INDEX IF NOT EXISTS idx_sync_events_workspace_created
  ON sync_events(workspace_id, created_at DESC);
```

### D1 Table Reference

| Table | Purpose | Primary Key | Unique Constraint |
|---|---|---|---|
| `workspaces` | Workspace identity and metadata | `id` | `slug` |
| `documents` | Markdown source files with content and revision | `id` | `(workspace_id, canonical_path)` |
| `document_chunks` | Token-bounded document segments for search/RAG | `id` | `(document_id, chunk_key)` |
| `graph_snapshots` | Parsed graph JSON per document revision | `id` | `(document_id, graph_revision)` |
| `sync_devices` | Registered client devices per workspace | `id` | — |
| `sync_events` | Push-only audit log (24h TTL, pruned on each push) | `id` | — |

### D1 Role

- First shared operational store
- Cursor-based pull source
- Shared push target
- Conflict-check boundary
- Cloudflare-native low-TCO persistence

---

## Route Contracts

### Push Route

- **Method**: `POST`
- **Path**: `/api/storage/push`
- **Purpose**: Send batched local mutations to the shared store
- **Behavior**: Apply, reject, defer, or mark conflicts per mutation

Request:

```json
{
  "apiVersion": "2026-05-04",
  "workspaceId": "kgws:abc123",
  "deviceId": "dev:local-browser-1",
  "mutations": [
    {
      "entity": "document",
      "op": "upsert",
      "recordId": "sf:source-file-id",
      "baseRevision": 3,
      "record": {
        "id": "sf:source-file-id",
        "workspaceId": "kgws:abc123",
        "canonicalPath": "workspace:/README.md",
        "title": "README.md",
        "docType": "markdown",
        "contentMd": "# Hello",
        "contentHash": "sha256hex",
        "revision": 4,
        "updatedAtMs": 1778151345000,
        "deleted": false
      }
    }
  ]
}
```

Response:

```json
{
  "ok": true,
  "apiVersion": "2026-05-04",
  "workspaceId": "kgws:abc123",
  "ackCursor": "2026-05-07T00:00:00.000Z",
  "serverTimeMs": 1778151345000,
  "acknowledgements": [
    {
      "mutationId": "mut_doc_1",
      "recordId": "sf:source-file-id",
      "entity": "document",
      "status": "applied",
      "serverRevision": 4,
      "message": null
    }
  ]
}
```

Error handling: per-mutation conflicts are returned in `acknowledgements`; malformed requests return 400; unexpected worker/database failures return 500.

### Pull Route

- **Method**: `POST`
- **Path**: `/api/storage/pull`
- **Purpose**: Fetch changed records since the last cursor
- **Behavior**: Return documents, chunks, graph snapshots, and the next cursor. Read-optimized: no D1 writes when no changes exist (ensure* are read-first guards; sync_devices cursor and sync_events are skipped on empty pull).

Request:

```json
{
  "apiVersion": "2026-05-04",
  "workspaceId": "kgws:abc123",
  "deviceId": "dev:local-browser-2",
  "since": "2026-05-07T00:00:00.000Z"
}
```

Response:

```json
{
  "ok": true,
  "apiVersion": "2026-05-04",
  "workspaceId": "kgws:abc123",
  "nextCursor": "2026-05-07T00:00:30.000Z",
  "serverTimeMs": 1778151375000,
  "changes": {
    "documents": [{ "...": "..." }],
    "documentChunks": [{ "...": "..." }],
    "graphSnapshots": [{ "...": "..." }]
  }
}
```

Error handling: 400 on malformed request; 500 on worker/database failures.

### Export Route

- **Method**: `GET`
- **Path**: `/api/storage/export/:workspaceId`
- **Purpose**: Export a workspace archive from the shared store
- **Behavior**: Fail whole export on missing workspace; never silently drop records. Pure read — no D1 writes (no sync_device or sync_events side effects).

Error handling: 404 on unknown workspace; 500 on D1 failure.

---

## PostgreSQL Appendix (Deferred)

PostgreSQL remains deferred. Documented to preserve the future migration path.

### Adoption Gates

Adopt PostgreSQL only when one or more become materially true:

- Multiple users edit the same workspace concurrently
- Server-side retrieval queries outgrow D1 ergonomics or performance
- Vector search becomes a runtime requirement rather than an experiment
- Tenancy, analytics, or audit requirements justify managed DB overhead

### Deferred Shape Highlights

- UUID primary keys (vs TEXT in D1)
- `TIMESTAMPTZ` timestamps (vs TEXT in D1)
- `JSONB` for `graph_json` and `layout_json` (vs TEXT in D1)
- `VECTOR(1536)` embedding column on `document_chunks` (not in D1)
- `metadata_json JSONB` column on `documents` and `document_chunks` (not in D1)

---

## Continuation

Return to `knowgrph-storage-sync-document.md` for the canonical architecture, PRD, TAD, and conflict resolution flow.
