# Knowgrph Storage Document: Schemas and Topology

Continuation of `knowgrph-storage-document.md` covering the detailed schema appendix, route contracts, and deployment topology.

## Canonical Relationship

- Canonical index: `knowgrph-storage-document.md`
- This file: detailed schema and topology appendix
- Companion runtime file: `knowgrph-storage-document-runtime-and-conflict-ux.md`
- Companion publish-topology file: `knowgrph-cross-repo-publish-topology.md`

## Schema Principles

- Keep Git markdown as authoring truth.
- Store raw markdown once per document revision.
- Persist chunks and graph snapshots separately.
- Keep stable ids and monotonic revisions.
- Use hashes for dedupe and bounded prompt reuse.
- Keep browser-local names compatible with RxDB reserved-field rules.

## Shared Contract Snapshot

Primary shared contract file:

- `canvas/src/lib/storage/knowgrphStorageSyncContract.ts`

Current contract highlights:

```ts
export const KNOWGRPH_STORAGE_API_VERSION = '2026-05-04'

export const KNOWGRPH_STORAGE_ROUTE_PATHS = {
  push: '/api/storage/push',
  pull: '/api/storage/pull',
  exportPrefix: '/api/storage/export/',
} as const
```

### Canonical Remote Document Shape

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

### Canonical Remote Chunk Shape

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

### Canonical Remote Graph Snapshot Shape

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

### Canonical Outbox Shape

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

## RxDB Local Schema

Primary file:

- `canvas/src/lib/storage/knowgrphStorageRxdb.ts`

### Why Local Shapes Differ Slightly

RxDB reserves certain names, so the local store uses:

- `documentRevision` instead of remote `revision`
- `isDeleted` instead of remote `deleted`

This keeps the network contract canonical while keeping the browser store valid.

### Local Collections

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

### Local Index Guidance

- `documents`: `workspaceId`, `canonicalPath`, `updatedAtMs`
- `documentChunks`: `documentId`, `[documentId, chunkKey]`, `updatedAtMs`
- `graphSnapshots`: `documentId`, `graphRevision`, `updatedAtMs`
- `syncOutbox`: `workspaceId`, `updatedAtMs`
- `syncCursor`: `workspaceId`

### Local Role

- working copy store
- offline restore cache
- prompt reuse cache
- mutation outbox
- pull cursor cache

## Cloudflare D1 Schema

Primary migration:

- `cloudflare/d1/migrations/0001_knowgrph_storage.sql`

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

### D1 Indexes

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

### D1 Role

- first shared operational store
- cursor-based pull source
- shared push target
- conflict-check boundary
- Cloudflare-native low-TCO persistence

## PostgreSQL Appendix

PostgreSQL remains deferred.
It is documented to preserve the future migration path, not to change the current recommendation.

### Deferred PostgreSQL Shape

```sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE documents (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  canonical_path TEXT NOT NULL,
  title TEXT,
  doc_type TEXT,
  lang TEXT,
  graph_id TEXT,
  source_kind TEXT NOT NULL DEFAULT 'markdown',
  content_md TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  revision BIGINT NOT NULL,
  deleted BOOLEAN NOT NULL DEFAULT false,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, canonical_path)
);

CREATE TABLE document_chunks (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  chunk_key TEXT NOT NULL,
  chunk_order INTEGER NOT NULL,
  heading TEXT,
  markdown TEXT NOT NULL,
  token_estimate INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_key)
);

CREATE TABLE graph_snapshots (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  graph_revision BIGINT NOT NULL,
  graph_hash TEXT NOT NULL,
  graph_json JSONB NOT NULL,
  layout_json JSONB,
  derived_from_document_revision BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, graph_revision)
);
```

### PostgreSQL Adoption Gates

Adopt PostgreSQL only when one or more become materially true:

- multiple users edit the same workspace concurrently
- server-side retrieval queries outgrow D1 ergonomics or performance
- vector search becomes a runtime requirement rather than an experiment
- tenancy, analytics, or audit requirements justify managed DB overhead

## Worker Route Contracts

Primary files:

- `cloudflare/workers/knowgrph-storage/contract.ts`
- `cloudflare/workers/knowgrph-storage/index.ts`

### Push Route

- Method: `POST`
- Path: `/api/storage/push`
- Purpose: send batched local mutations to the shared store
- Behavior: apply, reject, defer, or mark conflicts per mutation

Example request:

```json
{
  "workspaceId": "wk_123",
  "deviceId": "dev_macbook_air",
  "mutations": [
    {
      "entity": "document",
      "op": "upsert",
      "recordId": "doc_abc",
      "baseRevision": 6,
      "record": {
        "id": "doc_abc",
        "workspaceId": "wk_123",
        "canonicalPath": "docs/demo.md",
        "sourceKind": "markdown",
        "contentMd": "# Demo",
        "contentHash": "sha256:...",
        "parserVersion": "v1",
        "revision": 7,
        "updatedAtMs": 1777860000000,
        "deleted": false,
        "title": "Demo",
        "docType": null,
        "lang": "en",
        "graphId": null
      }
    }
  ]
}
```

### Pull Route

- Method: `GET`
- Path: `/api/storage/pull`
- Purpose: fetch changed records since the last cursor
- Behavior: return documents, chunks, graph snapshots, and the next cursor

Example response:

```json
{
  "nextCursor": "2026-05-04T12:00:00Z",
  "changes": {
    "documents": [],
    "documentChunks": [],
    "graphSnapshots": []
  }
}
```

### Export Route

- Method: `GET`
- Path prefix: `/api/storage/export/`
- Purpose: export a workspace archive from the shared store
- Behavior: fail whole export on missing workspace, never silently drop records

## Topology Appendix

### Dev

```text
canonical docs: /Users/huijoohwee/Documents/GitHub/knowgrph/docs/**
local runtime: browser RxDB (IndexedDB)
optional local verification: SQLite fixture only
```

### Prod Mirror

```text
publish mirror: /Users/huijoohwee/Documents/GitHub/huijoohwee/knowgrph/**
rule: downstream publish surface only, never the authoring source
```

### Cloudflare

```text
UI: Cloudflare Pages
client cache: browser RxDB per device
API: Cloudflare Worker
shared DB: Cloudflare D1
optional blobs: Cloudflare R2
```

### Future Scale

```text
preserve the Worker sync contract
replace or augment D1 with PostgreSQL only when justified
```

## Storage Comparison

| Option | Primary role | TCO | Token economics | Performance fit | Recommendation |
|---|---|---:|---|---|---|
| RxDB | browser-local draft and cache store | Lowest | Strong via local chunk reuse | Best for editing and reactive UI | Required |
| SQLite / D1 | first shared store | Low | Strong via persisted chunks and revisions | Best first Cloudflare store | Recommended |
| PostgreSQL | high-scale shared backend | Highest | Strong for future server retrieval | Best for later collaboration scale | Deferred |

## Continuation

Return to `knowgrph-storage-document.md` for the canonical summary.

See continuation in `knowgrph-storage-document-runtime-and-conflict-ux.md` for runtime wiring, pulled-record application, conflict-action reuse, ADR snapshot, and focused validation.

See continuation in `knowgrph-cross-repo-publish-topology.md` for the shared publish-repo boundary, sibling-app route isolation, and cross-repo Cloudflare Pages ownership contract.
