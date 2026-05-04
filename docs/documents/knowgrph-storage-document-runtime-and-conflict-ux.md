# Knowgrph Storage Document: Runtime and Conflict UX

Continuation of `knowgrph-storage-document.md` covering implementation wiring, inbound pull application, shared conflict UX, ADR snapshot, and focused validation.

## Canonical Relationship

- Canonical index: `knowgrph-storage-document.md`
- Schema appendix: `knowgrph-storage-document-schemas-and-topology.md`
- This file: runtime and UX appendix

## Runtime Implementation Summary

The storage recommendation is now implemented across five runtime layers:

1. shared contract
2. browser storage
3. Cloudflare Worker shared store
4. client sync loop
5. runtime apply and conflict UX

## Shared Contract Layer

Primary file:

- `canvas/src/lib/storage/knowgrphStorageSyncContract.ts`

This contract keeps client, Worker, and test fixtures aligned on:

- entity kinds
- mutation operations
- route paths
- pull/push response shapes
- export contract
- conflict summary shape

## Browser Storage Layer

Primary file:

- `canvas/src/lib/storage/knowgrphStorageRxdb.ts`

The browser store now persists:

- local document copies
- chunk cache
- graph snapshots
- sync outbox
- sync cursor

Important runtime rules:

- local field names avoid RxDB reserved-name collisions
- outbox conflict state remains queryable in RxDB
- unresolved conflicts stay local until a user action or later retry changes them

## Cloudflare Worker Layer

Primary files:

- `cloudflare/workers/knowgrph-storage/index.ts`
- `cloudflare/workers/knowgrph-storage/db.ts`

Implemented endpoints:

- `POST /api/storage/push`
- `GET /api/storage/pull`
- `GET /api/storage/export/:workspaceId`

Worker responsibilities:

- validate request shape
- ensure workspace and device rows exist
- persist document, chunk, and graph records
- emit sync events
- compute conflict outcomes
- return bounded responses to the client

## Client Sync Loop Layer

Primary file:

- `canvas/src/lib/storage/knowgrphStorageClientSync.ts`

Implemented client functions include:

- device id provisioning
- mutation enqueueing
- immediate sync runs
- scheduled sync runs
- workspace-scoped polling loop start/stop
- export helper
- callbacks for pulled changes and sync completion

Runtime behavior:

- edits enqueue into `syncOutbox`
- scheduled runs dedupe via workspace scheduling
- pulls return changed records and conflict summaries
- unresolved conflicts are surfaced without deleting the local mutation record

## Canvas Runtime Entry Layer

Primary files:

- `canvas/src/features/source-files/sourceFilesStorageSync.ts`
- `canvas/src/features/source-files/SourceFilesPersistenceBootstrap.tsx`

Implemented runtime behavior:

- derive a storage workspace id from active source-files state
- start one sync loop per active workspace
- enqueue document and graph changes as the visible source-files workspace changes
- use previous local source-files state to determine deletes safely
- call shared conflict UX notification after sync completion

## Inbound Pulled-Record Application

Primary file:

- `canvas/src/features/source-files/sourceFilesInboundStorageApply.ts`

Purpose:

- map pulled remote storage records back into visible `sourceFiles`
- update or remove matching files in the active workspace state
- trigger graph recomposition through the existing source-files path

This is what makes cross-device edits visible in the canvas automatically after pull.

### Inbound Apply Rules

- document records remain the inbound source payload
- matching graph snapshots are attached when available
- source-files state is updated in place rather than through a second import subsystem
- graph recomposition is scheduled through existing runtime helpers
- remote tombstones remove visible source-files entries for the matched storage-backed documents

## Conflict UX Reuse Contract

Primary files:

- `canvas/src/lib/storage/knowgrphStorageConflictUx.ts`
- `canvas/src/lib/storage/knowgrphStorageConflictActions.ts`
- `canvas/src/lib/ui/uiActionRuntime.ts`
- `canvas/src/components/ui/ToastHost.tsx`
- `canvas/src/features/panels/views/HistoryView.tsx`
- `canvas/src/components/ui/UiActionButtons.tsx`

### Core Rule

Storage conflict UX must reuse the existing shared toast/log/runtime path.

That means:

- use the existing toast store model
- use the existing History log model
- attach shared action descriptors to both surfaces
- dispatch action ids through one runtime dispatcher
- forbid a second storage-only modal, drawer, or panel system

### Current Shared Actions

For single-record conflicts, the shared UX can attach:

- `Keep Local`
- `Accept Remote`
- `Review Log`

For multi-record conflicts, the workspace summary toast keeps the action set bounded and uses `Review Log` as the shared discovery path.

### Shared Action Flow

1. sync run returns unresolved conflict entries
2. `notifyKnowgrphStorageConflictUx(...)` raises one shared workspace toast
3. per-conflict shared log rows are written through the existing log slice
4. toast and log entries carry the same `actions` descriptors
5. `UiActionButtons` renders those descriptors in both surfaces
6. `runUiAction(...)` dispatches the action id
7. storage-specific handlers resolve the mutation and refresh shared conflict UX state

## Conflict Resolution Behavior

### Keep Local

When the user chooses `Keep Local`:

- the conflicting outbox row is re-read
- the latest remote revision is used to compute the next retry revision
- the local record is updated in RxDB
- the outbox payload is patched for retry
- the visible source-files workspace is updated through the existing inbound-apply path
- sync is scheduled again through the shared scheduler

### Accept Remote

When the user chooses `Accept Remote`:

- the conflicting local outbox mutation is removed
- the remote version remains authoritative on the next pull state
- shared toast/log conflict summaries are refreshed

### Review Log

When the user chooses `Review Log`:

- the runtime opens the existing bottom History surface
- no second review panel is introduced

## Shared Store Types For Actions

The shared store model now carries optional `actions` on:

- `UiToast`
- `UiToastInput`
- `UiLogEntry`
- `UiLogEntryInput`

This keeps action rendering on the same state path as existing notifications.

## ADR Snapshot

### ADR-001: Keep RxDB As The Client Working Store

**Status**: Accepted

Why it still stands:

- current runtime already behaves local-first
- RxDB matches existing browser persistence
- replacing it now would add migration cost without new product value

### ADR-002: Choose SQLite / D1 As The First Shared Cloud Store

**Status**: Accepted

Why it still stands:

- D1 fits Pages + Worker deployment shape
- SQLite keeps TCO below a PostgreSQL-first design
- current shared requirements do not justify a heavier operational stack

### ADR-003: Defer PostgreSQL Until Collaboration Or Retrieval Scale Requires It

**Status**: Accepted

Why it still stands:

- the scale path is documented
- the MVP path remains lean
- the sync contract can stay stable while the backend changes later

## Quality Attributes

### Performance

- restore path stays browser-local through RxDB
- prompt assembly can reuse chunks instead of whole documents
- pull/apply runs stay delta-oriented instead of full workspace reloads

### Scalability

- D1 supports the first shared-store phase
- schema keeps document, chunk, and snapshot rows separately addressable
- PostgreSQL remains available for a later migration when justified

### Observability

- Worker persists sync events
- client keeps conflict and acknowledgement state in the outbox
- shared toasts and logs provide runtime visibility without extra tooling

### UX Consistency

- storage sync reuses shared notification surfaces
- actions appear where users already look for runtime status
- no duplicate storage-only review surface exists

## Focused Validation

Implemented or updated focused tests cover:

- shared contract routes and record shapes
- Worker push, pull, and export behavior
- client sync loop scheduling and result handling
- source-files mutation enqueueing
- inbound pulled-record application into visible source-files state
- conflict UX dedupe behavior
- shared toast/history action rendering and dispatch

Representative test files:

- `canvas/src/__tests__/knowgrphStorageContracts.test.ts`
- `canvas/src/__tests__/knowgrphStorageWorker.test.ts`
- `canvas/src/__tests__/knowgrphStorageClientSync.test.ts`
- `canvas/src/__tests__/sourceFilesStorageSync.test.ts`
- `canvas/src/__tests__/sourceFilesInboundStorageApply.test.ts`
- `canvas/src/__tests__/knowgrphStorageConflictUx.test.ts`
- `canvas/src/__tests__/uiActionSurfaces.test.tsx`

Recent focused checks also included:

- targeted `eslint` on the new shared action-surface files
- direct execution of conflict UX and shared action-surface tests

## Operational Guidance

- keep canonical docs upstream in `knowgrph/docs/**`
- keep publish mirrors downstream only
- preserve the shared action runtime as the only conflict-action dispatcher
- keep companion-file sharding stable so the canonical storage doc path does not change
- refresh the AgenticRAG docs map whenever companion files are added

## Continuation

Return to `knowgrph-storage-document.md` for the canonical summary.

See `knowgrph-storage-document-schemas-and-topology.md` for the detailed RxDB, D1, PostgreSQL, route, and deployment appendix.
