# Knowgrph Storage Document

**Context**: Canonical markdown documents, local-first canvas state, and optional shared persistence across Dev, Prod, and Cloudflare  
**Intent**: Define a measurable PRD and a concrete TAD for RxDB vs SQLite vs PostgreSQL so Knowgrph can persist documents, graph snapshots, and sync metadata with low TCO and low token waste  
**Directive**: Keep canonical documents in `knowgrph/docs/**`, keep browser editing local-first through RxDB, recommend SQLite on Cloudflare as the first shared store, and defer PostgreSQL until multi-user collaboration or server-side retrieval materially requires it

---

**Version**: 1.0.0  
**Date**: 2026-05-04  
**Status**: Proposed  
**Owner**: Knowgrph canonical docs  
**Scope**: `knowgrph/docs/documents/knowgrph-storage-document.md`

---

## PART I: PRODUCT REQUIREMENTS DOCUMENT (PRD)

### Feature: Storage Topology and Persistence Strategy

#### Problem Statement

Knowgrph already behaves like a local-first canvas, but its storage story is split across canonical markdown files, browser persistence, publish mirrors, and future cloud sync requirements. Without a single storage specification:

- documents risk drifting between upstream source and publish mirrors
- token spend increases because full markdown blobs are resent instead of chunked and reused
- shared persistence decisions can become backend-first and overbuilt
- Cloudflare deployment can add infrastructure that does not match current product value

Users need a storage model that preserves local editing speed, keeps the canonical source in Git-managed markdown, supports optional cross-device sync, and adds server cost only when shared workflows justify it.

#### User Pain Points

- Single-user authors need edits to survive refreshes and offline sessions without waiting on a server.
- Operators need one authoritative source path for docs and one deterministic sync path to publish surfaces.
- AI-assisted workflows need section-level retrieval so prompts reuse only the required chunks rather than the full document.
- Cloudflare deployments need a topology that works with static Pages and only adds an API/runtime when it delivers real value.

#### Product Goal

Define a storage strategy that:

- preserves Git markdown as the canonical document authority
- uses RxDB as the browser-local working store
- uses SQLite as the first shared server store for Cloudflare deployment
- keeps PostgreSQL as an explicit future path, not a premature dependency

---

### User Stories

#### Epic: Canonical Document Persistence

**PRD-STO-E001-S001: Canonical Markdown Authority**

**As a** documentation owner  
**I want** Knowgrph documents to remain canonical in upstream markdown files  
**So that** Dev, Prod, and publish mirrors do not compete as sources of truth

**Acceptance Criteria**:

- **Given** a document under `knowgrph/docs/documents`
- **When** the document is updated
- **Then** the canonical edit occurs in `knowgrph/docs/**` before any downstream sync
- **And** no storage recommendation treats `huijoohwee/knowgrph/**` as the authoring source

---

**PRD-STO-E001-S002: Local-First Draft Persistence**

**As a** canvas user  
**I want** my imported markdown document and graph edits to persist locally in the browser  
**So that** I can continue editing without network dependency

**Acceptance Criteria**:

- **Given** a user imports or edits a markdown-backed graph document
- **When** the browser reloads offline
- **Then** the latest local working copy restores from browser persistence within 1 second for a single document under 100 KB
- **And** graph snapshot, chunk metadata, and UI state restore without requiring a network round trip

---

**PRD-STO-E001-S003: Token-Efficient Retrieval**

**As a** prompt-driven user  
**I want** Knowgrph to persist document chunks and graph derivatives separately  
**So that** prompts can reuse only the relevant sections and reduce token spend

**Acceptance Criteria**:

- **Given** a markdown document with frontmatter and section bodies
- **When** Knowgrph stores the document
- **Then** it persists the raw markdown, extracted metadata, chunk records, and graph snapshot as separate addressable records
- **And** retrieval can request one section, one shot, or one graph snapshot without loading the full markdown body

---

#### Epic: Shared Persistence and Publish

**PRD-STO-E002-S001: Cross-Device Sync**

**As a** returning user  
**I want** an optional shared store for documents and graph snapshots  
**So that** I can continue work across devices when I choose to sync

**Acceptance Criteria**:

- **Given** a workspace with sync enabled
- **When** a second device pulls changes
- **Then** it receives changed documents, chunks, and graph snapshots since the last sync cursor
- **And** the client merges them into its local RxDB store

---

**PRD-STO-E002-S002: Cloudflare-Compatible Runtime**

**As a** operator  
**I want** a storage topology that fits Cloudflare Pages constraints  
**So that** shared persistence does not require an unrelated hosting stack

**Acceptance Criteria**:

- **Given** Knowgrph is deployed on Cloudflare Pages
- **When** shared persistence is enabled
- **Then** the architecture uses a Cloudflare-compatible API runtime and shared store
- **And** the default recommendation does not require PostgreSQL

---

**PRD-STO-E002-S003: Cost-Bounded Server Adoption**

**As a** maintainer  
**I want** PostgreSQL adoption to be gated behind explicit scale needs  
**So that** the team does not pay operational cost before product value demands it

**Acceptance Criteria**:

- **Given** the product remains primarily single-user or low-write collaborative
- **When** storage is selected for production
- **Then** SQLite remains the recommended shared store
- **And** PostgreSQL is documented as a future option for multi-user analytics, vector retrieval, or heavy server-side querying

---

### Success Metrics

- Metric: Local restore time | Baseline: undefined | Target: `<1s` for one document under `100 KB` | Timeline: first storage milestone
- Metric: Prompt payload size | Baseline: full-document sends | Target: section-level retrieval for `>80%` of prompt paths | Timeline: first storage milestone
- Metric: Cloud persistence TCO | Baseline: undefined | Target: SQLite-first shared store before PostgreSQL adoption | Timeline: initial cloud release
- Metric: Canonical source drift | Baseline: manual risk | Target: `0` mirror-first document edits in storage workflow | Timeline: ongoing

---

### MoSCoW Prioritization

#### Must

- Git markdown remains canonical.
- RxDB remains the browser-local working store.
- Shared schema separates raw markdown, metadata, chunks, and graph snapshots.
- Cloudflare topology supports Pages plus an API runtime only when shared sync is enabled.

#### Should

- Shared store uses SQLite-compatible schema first.
- Sync API is batch-oriented and cursor-based.
- Storage records track hashes and revision metadata for dedupe.

#### Could

- Optional embeddings table for later retrieval ranking.
- Optional blob store for large exported assets and generated media.
- Optional audit/event stream for sync diagnostics.

#### Won't For MVP

- Full real-time CRDT collaboration
- PostgreSQL as a required baseline dependency
- vector indexing as a mandatory first release feature

---

### Out of Scope

- detailed auth provider selection
- large-binary asset processing pipelines
- implementation-specific ORM choice
- replacing Git-backed canonical docs with database-only authoring

---

### Dependencies

- Canonical docs in `knowgrph/docs/**`
- Browser-local persistence already implemented via RxDB-backed adapters in `canvas/src/lib/storage/**`
- Publish mirror flow to `huijoohwee/knowgrph/**`
- Cloudflare Pages for static delivery

---

### Open Questions

- Should shared sync be workspace-scoped only, or document-scoped from day one?
- Should exported HTML/PDF artifacts live in DB rows or move immediately to blob storage?
- When sync is enabled, should conflict handling begin as last-write-wins plus audit or require manual reconciliation for selected record types?

---

## PART II: TECHNICAL ARCHITECTURE DOCUMENT (TAD)

## Architecture: Knowgrph Storage Topology

### Architecture Overview

**From canonical markdown to cloud-backed canvas state**: Git markdown authority → parser and chunker → RxDB local working set → optional sync API → SQLite shared store on Cloudflare → publish and reload flows for downstream use.

The architecture keeps one upstream owner and two storage layers:

1. **Canonical authoring layer**
   - Git-managed markdown in `knowgrph/docs/**`
   - versioned through repository workflow

2. **Runtime persistence layer**
   - RxDB in the browser for drafts, graph snapshots, chunk cache, and sync cursors
   - SQLite in the cloud as the first shared authoritative operational store when cross-device sync is enabled

3. **Scale-up layer**
   - PostgreSQL only when collaboration density, analytics, or retrieval requirements exceed SQLite limits

---

### Recommended Decision

#### Recommendation Summary

- **Client local store**: RxDB
- **Shared cloud store**: SQLite
- **Cloudflare deployment shape**: Cloudflare Pages + Cloudflare Worker API + Cloudflare D1
- **Deferred option**: PostgreSQL behind a later migration boundary

#### Why This Is The Default

- RxDB already exists in the codebase and matches current canvas behavior.
- SQLite offers the lowest operational TCO for a shared store and fits Cloudflare D1.
- PostgreSQL adds operational complexity before current product needs clearly require it.
- Token savings come from chunking and derivation reuse, not from switching directly to PostgreSQL.

---

### Storage Comparison

| Option | Primary Role | TCO | Token Economics | Performance Fit | Recommendation |
|---|---|---:|---|---|---|
| RxDB | Browser-local draft and cache store | Lowest | Strong when chunk cache lives client-side | Best for local editing and reactive UI | Required |
| SQLite | Shared sync and publish store | Low | Strong when chunks and revisions are persisted server-side | Best first server store | Recommended |
| PostgreSQL | High-scale collaborative and analytical store | Highest | Strong only when server retrieval, analytics, or vector workflows are active | Best for advanced multi-user backend | Deferred |

---

### Component Specifications

**Component**: Canonical Document Source  
**Responsibility**: Stores authoritative markdown documents in Git-managed paths and feeds all downstream derivations.  
**Interfaces**: file read, file write, repo sync workflow  
**Dependencies**: `knowgrph/docs/**`  
**Configuration**: canonical path roots, document naming rules

**Component**: Document Parser and Chunker  
**Responsibility**: Converts markdown into frontmatter metadata, section chunks, and graph-ready derivatives.  
**Interfaces**: `parse(document)` → `{ metadata, chunks, graphSnapshot }`  
**Dependencies**: parser modules, markdown import pipeline  
**Configuration**: chunking policy, section key rules, parser version

**Component**: RxDB Client Store  
**Responsibility**: Persists local working copies, graph snapshots, chunk cache, UI state, and sync cursors in the browser.  
**Interfaces**: reactive collection queries, upsert, batch write, outbox enqueue  
**Dependencies**: IndexedDB via Dexie when available, local fallback when unavailable  
**Configuration**: collection schema versions, compaction policy, sync enable flag

**Component**: Sync API  
**Responsibility**: Accepts batched pushes, returns cursor-based pulls, and enforces workspace/document contracts.  
**Interfaces**: `POST /api/storage/push`, `GET /api/storage/pull`, `GET /api/storage/export`  
**Dependencies**: Worker runtime, shared database  
**Configuration**: batch size, cursor policy, auth mode, conflict mode

**Component**: Shared SQLite Store  
**Responsibility**: Persists shared documents, revisions, chunks, graph snapshots, and sync metadata with low-cost relational access.  
**Interfaces**: SQL tables and indexes  
**Dependencies**: Cloudflare D1 or equivalent SQLite runtime  
**Configuration**: retention policy, index strategy, optional blob indirection

**Component**: Shared PostgreSQL Store  
**Responsibility**: Replaces or augments SQLite only when collaborative scale, advanced analytics, or vector retrieval requires it.  
**Interfaces**: SQL tables, JSONB, optional vector indexing  
**Dependencies**: managed PostgreSQL provider  
**Configuration**: pooling, partitions, JSONB indexes, optional pgvector

---

### Data Model Principles

- Store raw markdown once.
- Derive metadata, chunks, and graph snapshots as separate rows or documents.
- Use stable document IDs plus monotonic revision numbers.
- Track `content_hash` to avoid duplicate prompt preparation and redundant sync writes.
- Use explicit `chunk_key` values such as `frontmatter`, `director_brief`, `shots.S01`, `shots.S02`.
- Keep blob-sized media references outside the main markdown row when asset sizes grow beyond practical database payloads.

---

### Concrete Schema Proposal: RxDB

#### RxDB Collections

1. `documents`
2. `documentChunks`
3. `graphSnapshots`
4. `syncOutbox`
5. `syncCursor`

#### RxDB Document Shapes

```ts
type KgDocumentRecord = {
  id: string
  workspaceId: string
  canonicalPath: string
  title: string | null
  docType: string | null
  lang: string | null
  sourceKind: 'markdown'
  contentMd: string
  contentHash: string
  parserVersion: string
  graphId: string | null
  revision: number
  updatedAtMs: number
  deleted: boolean
}

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

#### RxDB Index Proposal

- `documents`: `workspaceId`, `canonicalPath`, `updatedAtMs`
- `documentChunks`: `documentId`, `[documentId, chunkKey]`, `updatedAtMs`
- `graphSnapshots`: `documentId`, `graphRevision`, `updatedAtMs`
- `syncOutbox`: `workspaceId`, `updatedAtMs`
- `syncCursor`: `workspaceId`

#### RxDB Role

- working copy
- offline cache
- prompt reuse cache
- sync staging store

---

### Concrete Schema Proposal: SQLite

#### SQLite Tables

```sql
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
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
  UNIQUE(workspace_id, canonical_path)
);

CREATE TABLE document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  chunk_key TEXT NOT NULL,
  chunk_order INTEGER NOT NULL,
  heading TEXT,
  markdown TEXT NOT NULL,
  token_estimate INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(document_id, chunk_key)
);

CREATE TABLE graph_snapshots (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  graph_revision INTEGER NOT NULL,
  graph_hash TEXT NOT NULL,
  graph_json TEXT NOT NULL,
  layout_json TEXT,
  derived_from_document_revision INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(document_id, graph_revision)
);

CREATE TABLE sync_devices (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  device_label TEXT,
  last_pull_cursor TEXT,
  last_push_cursor TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE sync_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  device_id TEXT NOT NULL REFERENCES sync_devices(id),
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

#### SQLite Index Proposal

```sql
CREATE INDEX idx_documents_workspace_updated
  ON documents(workspace_id, updated_at DESC);

CREATE INDEX idx_document_chunks_doc_order
  ON document_chunks(document_id, chunk_order ASC);

CREATE INDEX idx_document_chunks_doc_key
  ON document_chunks(document_id, chunk_key);

CREATE INDEX idx_graph_snapshots_doc_rev
  ON graph_snapshots(document_id, graph_revision DESC);

CREATE INDEX idx_sync_events_workspace_created
  ON sync_events(workspace_id, created_at DESC);
```

#### SQLite Role

- first shared operational store
- sync source of record
- low-cost cloud persistence for Cloudflare

---

### Concrete Schema Proposal: PostgreSQL

#### PostgreSQL Tables

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

CREATE TABLE sync_events (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  actor_id UUID,
  device_id TEXT,
  event_type TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### PostgreSQL Index Proposal

```sql
CREATE INDEX idx_documents_workspace_updated
  ON documents(workspace_id, updated_at DESC);

CREATE INDEX idx_documents_metadata_json
  ON documents USING GIN (metadata_json);

CREATE INDEX idx_document_chunks_doc_key
  ON document_chunks(document_id, chunk_key);

CREATE INDEX idx_document_chunks_metadata_json
  ON document_chunks USING GIN (metadata_json);

CREATE INDEX idx_graph_snapshots_doc_rev
  ON graph_snapshots(document_id, graph_revision DESC);
```

#### PostgreSQL Role

- advanced shared persistence
- server-side search and analytics
- optional vector retrieval for agentic workflows

#### PostgreSQL Adoption Gate

Adopt PostgreSQL only when at least one of these becomes true:

- multiple users edit the same workspace concurrently
- server-side retrieval queries exceed SQLite performance or indexing ergonomics
- vector search becomes a first-class runtime requirement
- audit, tenancy, and analytics needs justify managed database overhead

---

### Recommended Topology: Dev -> Prod -> Cloudflare

#### Precise Topology

```text
Dev
  canonical docs: /Users/huijoohwee/Documents/GitHub/knowgrph/docs/**
  local runtime: browser RxDB (IndexedDB/Dexie)
  optional local verification: SQLite file for sync-contract tests only

Prod Repo Mirror
  publish mirror: /Users/huijoohwee/Documents/GitHub/huijoohwee/knowgrph/**
  rule: generated/synced surface only, not authoring source

Cloudflare
  UI: Cloudflare Pages serves static Knowgrph bundle
  client cache: browser RxDB per device
  API: Cloudflare Worker exposes storage sync endpoints
  shared DB: Cloudflare D1 (SQLite)
  optional blobs: Cloudflare R2 for large exported media or generated assets

Future Scale
  replace or augment D1 with PostgreSQL only when collaboration/search scale requires it
```

#### Topology Recommendation

- **Dev**: Git markdown + browser RxDB
- **Prod**: synced publish mirror + browser RxDB
- **Cloudflare shared persistence**: Pages + Worker + D1
- **Future expansion**: Worker + PostgreSQL behind the same sync contract

---

### Deployment Strategy

#### Default Deployment

- **Static UI delivery**: Cloudflare Pages
- **Optional shared persistence**: Cloudflare Worker
- **Shared DB**: Cloudflare D1
- **Large asset spillover**: Cloudflare R2

#### Rationale

- Pages matches the existing static deployment surface.
- Worker keeps the sync API close to the edge without introducing a separate app server.
- D1 keeps cost and operational surface smaller than PostgreSQL for the current product stage.
- The API contract remains database-agnostic enough to allow later PostgreSQL migration.

---

### Integration Contracts

**Interface**: Storage Push  
**Protocol**: HTTPS JSON  
**Data Format**: JSON  
**Error Handling**: Return per-record conflict or validation errors; forbid silent drops

```json
{
  "workspaceId": "wk_123",
  "deviceId": "dev_macbook_air",
  "mutations": [
    {
      "entity": "document",
      "op": "upsert",
      "record": {
        "id": "doc_abc",
        "revision": 7,
        "contentHash": "sha256:..."
      }
    }
  ]
}
```

**Interface**: Storage Pull  
**Protocol**: HTTPS GET  
**Data Format**: JSON  
**Error Handling**: Return cursor plus changed records; return empty set for no-op pulls

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

**Interface**: Storage Export  
**Protocol**: HTTPS GET  
**Data Format**: JSON archive  
**Error Handling**: Fail whole export on missing workspace; forbid partial silent exports

---

### Token-Economics Design

#### Storage-Level Token Controls

- persist `content_hash` on document and chunk rows
- persist `token_estimate` on chunk rows
- persist `derived_from_document_revision` on graph snapshots
- address chunks by semantic keys rather than byte offsets

#### Retrieval Rules

- use raw markdown only for full export and exact round-trip
- use chunk rows for prompt assembly
- use graph snapshots for render and graph reasoning
- avoid resending unchanged chunks when `content_hash` matches

#### Example For `knowgrph-video-demo.md`

- `frontmatter`
- `director_brief`
- `shots.S01`
- `shots.S02`
- `shots.S03`
- `shots.S04`
- `shots.S05`
- `pipeline`
- `flow`
- `mermaid`

This chunk map is materially better for prompt cost than storing only one monolithic markdown blob.

---

### Architectural Decisions

## ADR-001: Keep RxDB As The Client Working Store

**Status**: Accepted  
**Date**: 2026-05-04  
**Deciders**: Knowgrph maintainers

### Context

The browser already persists multiple workspaces through RxDB-backed adapters, and the canvas requires local-first responsiveness.

### Decision

Keep RxDB as the mandatory local persistence layer for documents, chunks, graph snapshots, and sync cursors.

### Alternatives Considered

1. LocalStorage only: too small, weak querying, poor structure.
2. SQLite in WASM only: possible, but adds complexity without replacing the reactive client value already present in RxDB.

### Rationale

RxDB is already aligned to current runtime behavior and has the lowest migration cost.

### Consequences

- **Positive**: preserves offline-first UX and reuses existing code paths
- **Negative**: introduces dual-store thinking when shared persistence exists
- **Neutral**: does not prevent later adoption of SQLite or PostgreSQL on the server

---

## ADR-002: Choose SQLite As The First Shared Cloud Store

**Status**: Accepted  
**Date**: 2026-05-04  
**Deciders**: Knowgrph maintainers

### Context

Knowgrph deploys to Cloudflare Pages, and the team needs a shared store with lower TCO than PostgreSQL.

### Decision

Use SQLite-compatible schema on Cloudflare D1 for the first shared persistence layer.

### Alternatives Considered

1. PostgreSQL first: stronger advanced querying, but higher operational cost.
2. RxDB-only with no server store: lowest cost, but no cross-device shared state.

### Rationale

SQLite is enough for current document, chunk, graph snapshot, and sync metadata needs while fitting Cloudflare infrastructure directly.

### Consequences

- **Positive**: lower TCO, simpler deployment, Cloudflare-native fit
- **Negative**: less ergonomic than PostgreSQL for advanced analytics and vector search
- **Neutral**: schema can later migrate to PostgreSQL behind stable API contracts

---

## ADR-003: Defer PostgreSQL Until Retrieval Or Collaboration Scale Requires It

**Status**: Accepted  
**Date**: 2026-05-04  
**Deciders**: Knowgrph maintainers

### Context

PostgreSQL is attractive for JSONB, tenancy, and vector workflows, but the current product scope does not yet require it.

### Decision

Document PostgreSQL as a phase-two backend, not the MVP default.

### Alternatives Considered

1. Adopt PostgreSQL immediately.
2. Avoid documenting PostgreSQL at all.

### Rationale

Immediate adoption overbuilds the current system, while omitting it entirely would leave the scale path undefined.

### Consequences

- **Positive**: keeps near-term infra lean while preserving a scale path
- **Negative**: requires a later migration step when demand arrives
- **Neutral**: sync contracts remain stable if designed well now

---

### Quality Attributes

- **Performance**
  - Scenario: Under a single active document under `100 KB`, browser restore completes in `<1s`
  - Pattern: RxDB local cache + derived chunk rows + no network requirement for restore
  - Validation: focused browser restore test with one imported document

- **Scalability**
  - Scenario: Shared store supports thousands of documents and chunk rows per workspace without mandatory PostgreSQL
  - Pattern: normalized SQLite schema + targeted indexes + cursor-based sync
  - Validation: bounded sync and query test against representative fixture data

- **Security**
  - Scenario: Client bundle contains no database secrets and cannot write to shared persistence without the API contract
  - Pattern: Pages for static UI, Worker for controlled access, server-side credentials only
  - Validation: deployment review and secret-scan checks

- **Observability**
  - Scenario: Sync failures are diagnosable by workspace, device, and event type
  - Pattern: `sync_events` plus per-request status codes and payload metadata
  - Validation: focused API integration tests and sampled logs

---

### Migration Path

#### Phase 0: Current Lean State

- canonical markdown in Git
- browser RxDB for local persistence
- no mandatory shared server store

#### Phase 1: Recommended Shared Cloud State

- keep canonical markdown in Git
- add Worker sync API
- add D1 with SQLite schema in this document
- sync documents, chunks, graph snapshots, and cursors

#### Phase 2: Scale State

- preserve API contract
- move shared relational store from D1/SQLite to PostgreSQL where needed
- keep RxDB client schema stable where possible
- add vector or analytics extensions only after usage validates the need

---

### Requirement Traceability

| PRD ID | Requirement | TAD Component / Decision |
|---|---|---|
| PRD-STO-E001-S001 | Canonical markdown authority | Canonical Document Source |
| PRD-STO-E001-S002 | Local-first draft persistence | RxDB Client Store, ADR-001 |
| PRD-STO-E001-S003 | Token-efficient retrieval | Document Parser and Chunker, RxDB and SQLite schemas |
| PRD-STO-E002-S001 | Cross-device sync | Sync API, Shared SQLite Store |
| PRD-STO-E002-S002 | Cloudflare-compatible runtime | Recommended Topology, Deployment Strategy, ADR-002 |
| PRD-STO-E002-S003 | Cost-bounded server adoption | Storage Comparison, ADR-003 |

---

### Validation Checklist

- [ ] Canonical docs remain upstream in `knowgrph/docs/**`
- [ ] RxDB schema covers local document, chunk, graph, and sync state
- [ ] SQLite schema covers first shared-store needs on Cloudflare
- [ ] PostgreSQL schema is documented as a future-compatible migration path
- [ ] Topology is explicit for Dev, Prod mirror, and Cloudflare
- [ ] Token-economics controls are built into the schema, not left implicit

---

### Final Recommendation

For Knowgrph, the recommended storage topology is:

1. **Canonical source**: Git markdown in `knowgrph/docs/**`
2. **Per-device working state**: RxDB in the browser
3. **First shared cloud store**: SQLite on Cloudflare D1 behind a Worker sync API
4. **Optional blob storage**: Cloudflare R2 for large generated assets
5. **Future scale-up path**: PostgreSQL only after collaboration, retrieval, or analytics justify it

This keeps the system Lean, local-first, Cloudflare-compatible, and aligned with current token economics.
