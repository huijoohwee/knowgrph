# Knowgrph Storage Document

**Context**: Canonical markdown documents, local-first canvas state, optional shared persistence, and Cloudflare deployment.
**Intent**: Keep one canonical storage decision, one shared sync contract, and one conflict-resolution UX path.
**Directive**: Keep Git markdown canonical, keep browser editing local-first through RxDB, use Cloudflare Worker + D1 as the first shared store, and defer PostgreSQL until collaboration or server retrieval materially requires it.

---

**Version**: 1.1.0
**Date**: 2026-05-04
**Status**: Implemented and documented
**Owner**: Knowgrph canonical docs
**Canonical File**: `knowgrph/docs/documents/knowgrph-storage-document.md`

## Canonical Split

This file is the canonical sub-600-line index.

Detailed continuations live in:

- `knowgrph-storage-document-schemas-and-topology.md`
- `knowgrph-storage-document-runtime-and-conflict-ux.md`
- `knowgrph-cross-repo-publish-topology.md`

Use this file for the decision summary, current implementation shape, and cross-repo traceability.
Use the companions for the longer schema, topology, runtime, and validation detail.

## Product Decision

Knowgrph storage now follows one storage ladder:

1. **Canonical authoring source**: Git markdown in `knowgrph/docs/**`
2. **Per-device working store**: RxDB in the browser
3. **First shared cloud store**: Cloudflare D1 through a Cloudflare Worker sync API
4. **Optional large-asset spillover**: Cloudflare R2 when assets stop fitting cleanly in document rows
5. **Future scale-up path**: PostgreSQL only when multi-user collaboration or server-side retrieval clearly outgrows D1

## Why This Remains The Default

- Git markdown stays the authoring source of truth, so docs do not drift into a database-first workflow.
- RxDB matches the current canvas runtime and preserves refresh-safe, offline-first editing.
- D1 keeps the first shared-store step operationally lean on Cloudflare.
- Token savings come from chunk reuse, graph snapshot reuse, and bounded pull/push contracts, not from prematurely adopting PostgreSQL.
- Conflict handling now stays inside the existing toast/log/runtime path, so storage sync does not create a second UX system.

## PRD Summary

### Problem

Knowgrph needed one storage design that could cover:

- canonical markdown authority
- local-first editing persistence
- optional shared sync across devices
- Cloudflare-compatible deployment
- token-efficient reuse of markdown chunks and graph snapshots
- bounded conflict handling without duplicate UI flows

### User Needs

- Authors need offline-safe browser persistence.
- Maintainers need one canonical source path.
- Cross-device users need optional push/pull sync.
- Prompt-driven flows need chunk-level reuse instead of whole-document resends.
- Operators need Cloudflare-native shared persistence before taking on PostgreSQL overhead.
- Users need conflict actions without a storage-only modal or side panel.

### Acceptance Summary

The storage design is considered correct when:

- canonical edits still happen in `knowgrph/docs/**`
- browser working state restores from RxDB without a network dependency
- push/pull sync moves only changed records since the last cursor
- pulled remote changes can re-enter visible `sourceFiles`
- conflict records remain retained locally until resolved
- conflict actions reuse the shared toast/log/runtime path
- PostgreSQL remains documented as deferred rather than required

## Implemented Outcome

### Shared Contract

The shared storage contract now defines:

- API versioning and stable route paths
- document, chunk, graph-snapshot, cursor, and outbox record shapes
- outbox acknowledgement states including `applied`, `conflict`, `rejected`, and `deferred`
- conflict-entry reporting for runtime UX

Primary file:

- `canvas/src/lib/storage/knowgrphStorageSyncContract.ts`

### Browser Storage Layer

The browser storage layer now uses RxDB collections for:

- documents
- document chunks
- graph snapshots
- sync outbox
- sync cursor

Primary file:

- `canvas/src/lib/storage/knowgrphStorageRxdb.ts`

### Cloudflare Shared Store

The first shared-store implementation now exists as:

- D1 migration SQL
- Worker contract re-export
- Worker request handler
- shared DB helpers

Primary files:

- `cloudflare/d1/migrations/0001_knowgrph_storage.sql`
- `cloudflare/workers/knowgrph-storage/contract.ts`
- `cloudflare/workers/knowgrph-storage/index.ts`
- `cloudflare/workers/knowgrph-storage/db.ts`

### Client Sync Loop

The client sync runtime now supports:

- device id allocation
- outbox enqueueing
- push/pull sync runs
- scheduled sync
- workspace-scoped polling loop
- export requests
- conflict summaries returned to runtime UX hooks

Primary file:

- `canvas/src/lib/storage/knowgrphStorageClientSync.ts`

### Canvas Runtime Integration

The runtime now wires storage into active workspace behavior:

- source-file edits enqueue storage mutations
- sync loop starts per active workspace
- pulled remote records are applied back into visible `sourceFiles`
- graph recomposition follows pulled updates
- conflict notifications reuse shared toasts and logs

Primary files:

- `canvas/src/features/source-files/sourceFilesStorageSync.ts`
- `canvas/src/features/source-files/SourceFilesPersistenceBootstrap.tsx`
- `canvas/src/features/source-files/sourceFilesInboundStorageApply.ts`
- `canvas/src/lib/storage/knowgrphStorageConflictUx.ts`

### Conflict Resolution UX

Conflict UX now stays on the same shared action path already used by toast and log surfaces.

Shared behavior:

- conflict summaries raise one shared toast per workspace
- individual conflict records raise shared log entries
- actions are attached to the same toast/log models
- action dispatch goes through one runtime path
- no dedicated storage-only modal or duplicate panel exists

Primary files:

- `canvas/src/lib/storage/knowgrphStorageConflictActions.ts`
- `canvas/src/lib/ui/uiActionRuntime.ts`
- `canvas/src/components/ui/ToastHost.tsx`
- `canvas/src/features/panels/views/HistoryView.tsx`
- `canvas/src/components/ui/UiActionButtons.tsx`

## Architecture Summary

### Storage Layers

**Canonical layer**

- Git-managed markdown in `knowgrph/docs/**`
- upstream authoring only
- no downstream mirror may become the authoring source

**Local runtime layer**

- RxDB stores working copies, chunk cache, graph snapshots, outbox records, and sync cursors
- browser editing remains network-optional

**Shared runtime layer**

- Cloudflare Worker exposes push, pull, and export endpoints
- D1 stores shared rows for workspaces, documents, chunks, snapshots, devices, and sync events

**Scale-up layer**

- PostgreSQL remains a future migration target behind the same sync contract boundary

### Token-Economics Rules

- store raw markdown once
- persist chunk rows separately from graph snapshots
- track `contentHash` and chunk hashes for reuse
- address chunks by semantic keys instead of offsets
- avoid resending unchanged chunks when hashes match
- prefer pulled delta application over full workspace reloads

### Conflict Rules

- keep local conflicting outbox rows retained until user action or later retry
- summarize unresolved conflicts at workspace scope
- expose `Keep Local`, `Accept Remote`, and `Review Log` through shared action descriptors
- dispatch actions through one runtime path
- reuse shared toast and History log rendering surfaces

## Dev -> Prod -> Cloudflare Topology

### Dev

- canonical docs live in `knowgrph/docs/**`
- browser runtime uses RxDB
- optional local-only verification may target SQLite fixtures

### Prod Mirror

- `huijoohwee/knowgrph/**` remains a publish mirror only
- mirror content is downstream output, not authoring source

### Cloudflare

- Pages serves the static UI
- browser RxDB preserves device-local working state
- Worker exposes the sync API
- D1 stores shared sync records
- R2 remains optional for larger generated assets

## Implementation Traceability

| Capability | Canonical implementation path |
|---|---|
| Shared contract | `canvas/src/lib/storage/knowgrphStorageSyncContract.ts` |
| RxDB local store | `canvas/src/lib/storage/knowgrphStorageRxdb.ts` |
| D1 migration | `cloudflare/d1/migrations/0001_knowgrph_storage.sql` |
| Worker routes | `cloudflare/workers/knowgrph-storage/index.ts` |
| Worker DB helpers | `cloudflare/workers/knowgrph-storage/db.ts` |
| Client sync loop | `canvas/src/lib/storage/knowgrphStorageClientSync.ts` |
| Source-files enqueue path | `canvas/src/features/source-files/sourceFilesStorageSync.ts` |
| Runtime bootstrap | `canvas/src/features/source-files/SourceFilesPersistenceBootstrap.tsx` |
| Pulled-record apply | `canvas/src/features/source-files/sourceFilesInboundStorageApply.ts` |
| Conflict toast/log UX | `canvas/src/lib/storage/knowgrphStorageConflictUx.ts` |
| Conflict actions runtime | `canvas/src/lib/storage/knowgrphStorageConflictActions.ts` |
| Shared action dispatcher | `canvas/src/lib/ui/uiActionRuntime.ts` |
| Shared toast actions surface | `canvas/src/components/ui/ToastHost.tsx` |
| Shared History log actions surface | `canvas/src/features/panels/views/HistoryView.tsx` |

## Validation Summary

Focused validation for the implemented storage path now covers:

- shared contract tests
- Worker push/pull/export tests
- client sync loop tests
- source-file enqueue/apply tests
- conflict UX dedupe tests
- shared toast/history action-surface tests

Recent focused checks also verified:

- targeted `eslint` for the new action-surface files
- conflict action runtime behavior through toast and History log surfaces
- canonical docs-map refresh after companion-file sharding

## Cross-Repo Documentation Contract

These cross-repo docs must stay aligned:

- `knowgrph/todo-log.md`
- `knowgrph/docs/documents/knowgrph-storage-document.md`
- `knowgrph/docs/documents/knowgrph-storage-document-schemas-and-topology.md`
- `knowgrph/docs/documents/knowgrph-storage-document-runtime-and-conflict-ux.md`
- `knowgrph/docs/documents/knowgrph-cross-repo-publish-topology.md`
- `huijoohwee.github.io/schema/AgenticRAG/README.md`
- `huijoohwee.github.io/schema/AgenticRAG/documentation.jsonld`
- `huijoohwee.github.io/schema/AgenticRAG/markdown.jsonld`
- `huijoohwee.github.io/schema/AgenticRAG/panels.jsonld`
- `huijoohwee.github.io/schema/AgenticRAG/knowgrph-documents-map.graph.jsonld`

## Continuation

See continuation in `knowgrph-storage-document-schemas-and-topology.md` for the detailed RxDB, D1, PostgreSQL, route, and topology appendix.

See continuation in `knowgrph-storage-document-runtime-and-conflict-ux.md` for the runtime wiring, inbound pull application, conflict-action reuse path, ADR snapshot, and validation notes.

See continuation in `knowgrph-cross-repo-publish-topology.md` for the shared `knowgrph` + `singabldr` Dev-to-publish topology and route-ownership boundary.
