# Knowgrph Storage & Sync

**Context**: Canonical markdown documents, local-first canvas state, optional shared persistence, and Cloudflare deployment.
**Intent**: Keep one canonical storage decision, one shared sync contract, and one conflict-resolution UX path.
**Directive**: Keep Git markdown canonical, keep browser editing local-first through RxDB, use Cloudflare Worker + D1 as the first shared store, and defer PostgreSQL until collaboration or server retrieval materially requires it.

---

**Version**: 2.1.0
**Date**: 2026-05-07
**Status**: Deployed (Worker + D1 + seeded 5 docs)
**Owner**: Knowgrph canonical docs
**Supersedes**: `knowgrph-storage-document.md`, `knowgrph-storage-document-runtime-and-conflict-ux.md`, `knowgrph-storage-document-schemas-and-topology.md`, `knowgrph-sync-infrastructure-prd-tad.md`

## Companion Files

| File | Scope |
|---|---|
| `knowgrph-storage-schemas.md` | D1 SQL, RxDB shapes, contract types, route contracts |
| `knowgrph-local-storage.md` | Browser LocalStorage keys (UI state, not sync) |
| `knowgrph-source-files-import.md` | Import workflows, format routing, geo layer registration |
| `knowgrph-multi-user-collaboration-prd.tad.md` | Multi-user auth, authorization, role-based access, SSOT transition |

---

## Storage Ladder

1. **Canonical authoring source**: Git markdown in `huijoohwee/docs/**`
2. **Per-device working store**: RxDB in the browser (IndexedDB)
3. **First shared cloud store**: Cloudflare D1 through a Cloudflare Worker sync API
4. **Optional large-asset spillover**: Cloudflare R2 when assets stop fitting cleanly in document rows
5. **Future scale-up path**: PostgreSQL only when multi-user collaboration or server-side retrieval clearly outgrows D1

### Why This Remains The Default

- Git markdown stays the authoring source of truth; docs do not drift into a database-first workflow.
- RxDB matches the current canvas runtime and preserves refresh-safe, offline-first editing.
- D1 keeps the first shared-store step operationally lean on Cloudflare.
- Token savings come from chunk reuse, graph snapshot reuse, and bounded pull/push contracts.
- Conflict handling stays inside the existing toast/log/runtime path; no second UX system.

---

## Architecture — As-Is

```mermaid
flowchart TB
    subgraph Dev["Dev: knowgrph/"]
        subgraph canvas["canvas/src/"]
            subgraph fs["Workspace FS"]
                fsRxdb["workspaceFsRxdb.ts"]
                fsMem["workspaceFsMemory.ts"]
                fsEvt["workspaceFsEvents.ts"]
                seed["workspaceSeedProvider.ts"]
                seedSF["workspaceSeedSourceFiles.ts"]
                boot["sourceFilesBootstrapStartup.ts"]
            end
            subgraph bridge["SourceFiles ↔ Storage"]
                sfSync["sourceFilesStorageSync.ts"]
                sfInbound["sourceFilesInboundStorageApply.ts"]
            end
            subgraph rxdb["RxDB (IndexedDB)"]
                storageRxdb["knowgrphStorageRxdb.ts"]
                recovery["rxdbRecovery.ts"]
            end
            syncEngine["knowgrphStorageClientSync.ts"]
            contract["knowgrphStorageSyncContract.ts"]
            subgraph conflict["Conflict UX"]
                conflictUx["ConflictUx"]
                conflictAct["ConflictActions"]
            end
        end
        subgraph cf["cloudflare/"]
            worker["workers/knowgrph-storage/<br/>index.ts + db.ts + contract.ts + wrangler.toml"]
            migration["d1/migrations/0001_knowgrph_storage.sql"]
        end
        scripts["scripts/sync-pages-knowgrph.mjs"]
    end

    Dev -->|"npm run pages:build-sync"| ProdSSOT

    subgraph ProdSSOT["Prod SSOT: huijoohwee/content/knowgrph/"]
        index["index.html + sw.js"]
        manifest["manifest.webmanifest"]
        assets["assets/ (hashed SPA chunks)"]
        data["imports/"]
        favicon["favicon.svg"]
    end

    ProdSSOT -->|"Pages deploy"| Edge

    subgraph Edge["Cloudflare Edge (airvio.co/knowgrph)"]
        pages["Pages: static SPA"]
        noServer{{"Worker: NOT DEPLOYED<br/>D1: NOT PROVISIONED"}}
    end

    subgraph Browser["Browser (any device)"]
        brxdb["RxDB local-first"]
        bsync["Client sync engine (30s poll)"]
        bbridge["SF ↔ Storage bridge"]
        bconflict["Conflict UX (toast + log)"]
    end

    Browser -.->|"push/pull<br/>(no server)"| Edge
```

### As-Is Gaps

| Gap | Impact |
|---|---|
| Cloudflare Worker not deployed to Edge | Client push/pull has no server endpoint |
| D1 database not provisioned | No shared remote store exists |
| No cross-device sync | Workspace state is siloed per-browser |
| No seed write-back | Dev edits to seed docs don't flow back to `huijoohwee/docs/` |

---

## Architecture — To-Be (Phase 1)

```mermaid
flowchart TB
    subgraph Dev["Dev: knowgrph/"]
        subgraph canvas["canvas/src/"]
            subgraph fs["Workspace FS"]
                fsRxdb["workspaceFsRxdb.ts"]
                fsEvt["workspaceFsEvents.ts"]
                seed["workspaceSeedProvider.ts"]
                boot["sourceFilesBootstrapStartup.ts"]
            end
            subgraph bridge["SourceFiles ↔ Storage"]
                sfSync["sourceFilesStorageSync.ts"]
                sfInbound["sourceFilesInboundStorageApply.ts"]
            end
            subgraph rxdb["RxDB (IndexedDB)"]
                storageRxdb["knowgrphStorageRxdb.ts"]
            end
            syncEngine["knowgrphStorageClientSync.ts"]
        end
        subgraph cf["cloudflare/"]
            workerSrc["workers/knowgrph-storage/"]
        end
    end

    Dev -->|"npm run storage:worker:dev"| LocalWorker
    Dev -->|"npm run pages:build-sync"| ProdSSOT

    subgraph LocalWorker["Local Worker (localhost:8787)"]
        push["POST /api/storage/push"]
        pull["POST /api/storage/pull"]
        export["GET /api/storage/export/:id"]
        subgraph d1l["D1 (local SQLite)"]
            t1["workspaces"]
            t2["documents"]
            t3["document_chunks"]
            t4["graph_snapshots"]
            t5["sync_devices"]
            t6["sync_events"]
        end
    end

    subgraph ProdSSOT["Prod SSOT: huijoohwee/content/knowgrph/"]
        index["index.html, sw.js"]
        manifest["manifest.webmanifest"]
        assets["assets/ (hashed SPA)"]
    end

    ProdSSOT -->|"Pages deploy"| Edge

    subgraph Edge["Cloudflare Edge (airvio.co/knowgrph)"]
        pages["Pages: static SPA"]
        workerDeployed["Worker: /api/storage/*"]
        subgraph d1r["D1 (remote SQLite)"]
            r1["workspaces"]
            r2["documents"]
            r3["document_chunks"]
            r4["graph_snapshots"]
            r5["sync_devices"]
            r6["sync_events"]
        end
    end

    subgraph Browser["Browser (any device)"]
        bfs["Workspace FS + Seed"]
        brxdb["RxDB local-first"]
        bsync["Client sync engine (30s poll)"]
        bbridge["SF ↔ Storage bridge"]
        bconflict["Conflict UX"]
    end

    Browser -->|"push/pull"| LocalWorker
    Browser -->|"push/pull"| Edge
```

---

## Component Inventory

### Client (canvas/src/)

| Layer | Component | File | Status |
|---|---|---|---|
| Workspace FS | RxDB-backed FS | `features/workspace-fs/workspaceFsRxdb.ts` | Built |
| Workspace FS | In-memory fallback | `features/workspace-fs/workspaceFsMemory.ts` | Built |
| Workspace FS | Change events | `features/workspace-fs/workspaceFsEvents.ts` | Built |
| Workspace FS | Seed read/write | `features/workspace-fs/workspaceSeedProvider.ts` | Built |
| Workspace FS | Seed → SF hydration | `features/source-files/workspaceSeedSourceFiles.ts` | Built |
| Workspace FS | Bootstrap startup | `features/source-files/sourceFilesBootstrapStartup.ts` | Built |
| SF ↔ Storage | Push bridge | `features/source-files/sourceFilesStorageSync.ts` | Built |
| SF ↔ Storage | Pull apply | `features/source-files/sourceFilesInboundStorageApply.ts` | Built |
| SF ↔ Storage | Runtime bootstrap | `features/source-files/SourceFilesPersistenceBootstrap.tsx` | Built |
| RxDB | Storage collections | `lib/storage/knowgrphStorageRxdb.ts` | Built |
| RxDB | Recovery | `lib/storage/rxdbRecovery.ts` | Built |
| Sync engine | Client push/pull/loop | `lib/storage/knowgrphStorageClientSync.ts` | Built |
| Sync contract | Constants + builders | `lib/storage/knowgrphStorageSyncContract.ts` | Built |
| Conflict UX | Toast notification | `lib/storage/knowgrphStorageConflictUx.ts` | Built |
| Conflict UX | Resolution actions | `lib/storage/knowgrphStorageConflictActions.ts` | Built |
| Conflict UX | Action runtime | `lib/ui/uiActionRuntime.ts` | Built |
| Conflict UX | Toast surface | `components/ui/ToastHost.tsx` | Built |
| Conflict UX | History log surface | `features/panels/views/HistoryView.tsx` | Built |
| Conflict UX | Action buttons | `components/ui/UiActionButtons.tsx` | Built |

### Cloudflare (cloudflare/)

| Layer | Component | File | Status |
|---|---|---|---|
| Worker | Request handlers | `workers/knowgrph-storage/index.ts` | Built |
| Worker | D1 query helpers | `workers/knowgrph-storage/db.ts` | Built |
| Worker | Contract re-export | `workers/knowgrph-storage/contract.ts` | Built |
| Worker | Wrangler config | `workers/knowgrph-storage/wrangler.toml` | Built |
| D1 | Migration SQL | `d1/migrations/0001_knowgrph_storage.sql` | Built |
| Edge | Deployed Worker | `wrangler.toml` + `index.ts` | **Pending deploy** (API token) |
| Edge | Provisioned D1 | `633355bf-…152` | **Pending migrate** (API token) |

### Deploy & Test

| Layer | Component | File | Status |
|---|---|---|---|
| Deploy | Pages sync script | `scripts/sync-pages-knowgrph.mjs` | Built |
| Test | D1 fake | `__tests__/helpers/fakeKnowgrphStorageD1.ts` | Built |
| Future | PostgreSQL backend | — | Deferred |

---

## PRD Summary

### Problem

Knowgrph source files exist in three disconnected locations:

1. **Dev** (`knowgrph/canvas/src/`) — live editing with RxDB local-first storage
2. **Prod SSOT** (`huijoohwee/content/knowgrph/`) — static build artifacts on Cloudflare Pages
3. **Docs seed** (`huijoohwee/docs/`) — canonical Markdown files for workspace initialization

The client-side sync engine is fully built but has **no server-side endpoint**. Multi-device continuity and collaborative editing are impossible.

### User Stories

| As a… | I want… | So that… |
|---|---|---|
| Developer editing source files | document edits to persist to a remote store automatically | I can resume work from any device |
| Developer running Dev server | seed file changes in `huijoohwee/docs/` to appear immediately | I can iterate on canonical docs without manual refresh |
| Developer editing a seed document | edits to write back to `huijoohwee/docs/` | canonical seed files stay in sync |
| Operator deploying to production | build-sync pipeline to remain the single static-artifact path | production SPA continues to serve from Prod SSOT |
| User on a mobile device | workspace state to sync via the same push/pull mechanism | seamless cross-device continuity |

### Acceptance Criteria

| Given | When | Then |
|---|---|---|
| Developer edits a source file | autosave debounce fires | document upsert queued in RxDB outbox and pushed to `/api/storage/push` |
| Push endpoint receives a mutation | D1 `documents` table upserted | response confirms stored revision, client clears outbox entry |
| Second device opens same workspace | client polls `/api/storage/pull` with last cursor | receives all mutations newer than cursor, applies to local RxDB |
| File changes in `huijoohwee/docs/` | Dev server seed polling cycle runs | workspace re-reads file and updates source file state |
| `npm run pages:build-sync` executed | build completes and sync runs | Prod SSOT reflects latest static artifacts |

### Success Metrics

| Metric | Baseline | Target |
|---|---|---|
| Push success rate | 0% (no endpoint) | 99.9% |
| Pull-to-apply latency | N/A | <2s p95 |
| Cross-device state parity | 0% (no sync) | 100% document parity |
| D1 free-tier utilization | $0/mo | <$5/mo at projected scale |

---

## TAD — Runtime Layers

### Shared Contract

`canvas/src/lib/storage/knowgrphStorageSyncContract.ts` keeps client, Worker, and test fixtures aligned on:

- entity kinds, mutation operations, route paths
- pull/push response shapes, export contract
- conflict summary shape
- API version: `2026-05-04`

### Browser Storage (RxDB)

`canvas/src/lib/storage/knowgrphStorageRxdb.ts` persists:

- local document copies, chunk cache, graph snapshots
- sync outbox, sync cursor

Local field names differ from remote to avoid RxDB reserved-name collisions (`documentRevision` vs `revision`, `isDeleted` vs `deleted`).

### Cloudflare Worker

`cloudflare/workers/knowgrph-storage/` implements:

- `POST /api/storage/push` — validate mutations, upsert D1 rows, emit sync events
- `POST /api/storage/pull` — query sync events after cursor, return mutations
- `GET /api/storage/export/:workspaceId` — full workspace snapshot

### Client Sync Loop

`canvas/src/lib/storage/knowgrphStorageClientSync.ts` provides:

- device id provisioning, mutation enqueueing
- immediate and scheduled sync runs
- workspace-scoped polling loop (30s default)
- export helper, conflict summary callbacks

### Canvas Runtime Integration

`canvas/src/features/source-files/` wires storage into active workspace:

- source-file edits enqueue storage mutations
- sync loop starts per active workspace
- pulled remote records applied back into visible `sourceFiles`
- graph recomposition follows pulled updates
- conflict notifications reuse shared toasts and logs

---

## Conflict Resolution

### Flow

```mermaid
flowchart TB
    subgraph Client["Client (Browser)"]
        Edit["User edits source file"]
        Queue["queueKnowgrphStorageMutation<br/>→ RxDB outbox"]
        Push["syncKnowgrphStorageNow<br/>→ POST /api/storage/push"]
        Pull["POST /api/storage/pull<br/>→ apply remote mutations"]
    end

    subgraph Server["Cloudflare Worker"]
        Validate["Validate base revision"]
        Upsert["Upsert D1 row"]
        Reject["409 Conflict<br/>(stale base revision)"]
    end

    subgraph ConflictUX["Conflict UX (shared toast + log)"]
        Toast["notifyKnowgrphStorageConflictUx<br/>→ ToastHost.tsx"]
        Log["runKnowgrphStorageConflictAction<br/>action='review-log'<br/>→ HistoryView.tsx"]
        KeepLocal["action='keep-local'<br/>→ re-read outbox, bump revision, retry"]
        AcceptRemote["action='accept-remote'<br/>→ clear outbox, apply remote"]
    end

    Edit --> Queue --> Push --> Validate
    Validate -->|"revision matches"| Upsert
    Validate -->|"revision mismatch"| Reject
    Reject --> Toast
    Toast --> Log
    Log -->|"user decides"| KeepLocal
    Log -->|"user decides"| AcceptRemote
    Pull -->|"remote mutation received"| Client
```

### Rules

- Keep local conflicting outbox rows retained until user action or later retry.
- Summarize unresolved conflicts at workspace scope.
- Expose `Keep Local`, `Accept Remote`, and `Review Log` through shared action descriptors.
- Dispatch actions through one runtime path (`uiActionRuntime.ts`).
- Reuse shared toast (`ToastHost.tsx`) and History log (`HistoryView.tsx`) rendering surfaces.
- Forbid a second storage-only modal, drawer, or panel system.

---

## Architectural Decisions

### ADR-001: Keep RxDB As The Client Working Store

**Status**: Accepted. Current runtime already behaves local-first; RxDB matches existing browser persistence; replacing it adds migration cost without new product value.

### ADR-002: Choose SQLite / D1 As The First Shared Cloud Store

**Status**: Accepted. D1 fits Pages + Worker deployment shape; SQLite keeps TCO below PostgreSQL-first design; current shared requirements do not justify heavier operational stack.

**Alternatives considered**: Supabase (PostgreSQL) — requires rewriting D1-oriented schema; Turso (libSQL) — separate provider when D1 is already in account; Firebase — proprietary NoSQL, schema is relational; Self-hosted SQLite + Fly.io — higher ops burden, no edge co-location.

### ADR-003: Defer PostgreSQL Until Collaboration Or Retrieval Scale Requires It

**Status**: Accepted. Scale path is documented; MVP path remains lean; sync contract stays stable while backend changes later.

**Adoption gates**: multiple concurrent editors; server-side retrieval outgrows D1; vector search becomes runtime requirement; tenancy/analytics/audit justify managed DB overhead.

### ADR-004: Deploy Worker As Pages Function (Co-located With SPA)

**Status**: Accepted. Same domain avoids CORS; same deployment pipeline; D1 binding available via `wrangler.toml`.

**Trade-offs**: Pages Functions have 50ms CPU time limit on free tier (sufficient for CRUD); standalone Workers offer more flexibility for future WebSocket/Durable Object integration.

### ADR-005: Retain Polling-Based Sync (30s) For Phase 1

**Status**: Accepted. Client-side polling infrastructure already exists; acceptable latency for single-user / small-team use; avoids Durable Objects complexity.

### ADR-006: Seed Write-Back Via Node.js fs Only

**Status**: Accepted. `upsertWorkspaceInitializationSeedText` implements Node.js-only file write with `typeof window !== 'undefined'` guard; prevents browser-side filesystem access; docs directory is Dev-only concern.

---

## Deployment Phases

### Phase 1 — Worker + D1 (unblock sync)

1. Create `wrangler.toml` with D1 binding and Pages Function route pattern
2. Apply D1 migration for 6 tables
3. Deploy Worker handlers for push, pull, export
4. Wire `pages:build-sync` to deploy Worker alongside static assets
5. Verify end-to-end: Dev browser push → D1 → second browser pull → state parity

### Phase 2 — Docs Real-Time Seed Sync

1. Add Vite plugin or `fs.watch` on `VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT`
2. On file change, trigger `ensureSeed` re-read (bypass poll interval)
3. Wire seed document edits through `upsertWorkspaceInitializationSeedText`
4. Add `--check` mode to seed sync for CI drift detection

### Phase 3 — Real-Time Collaboration (future)

1. Introduce Cloudflare Durable Objects for per-workspace WebSocket channels
2. Replace 30s polling with push-based mutation broadcast
3. Add device presence tracking via `sync_devices` table
4. Implement conflict resolution UI for concurrent edits

---

## Quality Attributes

| Attribute | Requirement |
|---|---|
| Performance | Push/pull round-trip <500ms p95; D1 queries <50ms p95 |
| Scalability | D1 free tier: 5M reads/day, 100K writes/day; pagination for >500 documents |
| Security | Optimistic concurrency via base revision; workspace-scoped isolation; no auth in Phase 1 |
| Observability | Worker logs via `wrangler tail`; D1 metrics via Cloudflare dashboard; client telemetry via `pipelinePerf.ts` |
| Resilience | RxDB outbox survives crashes; retry with exponential backoff (max 3); cursor-based pull ensures no missed mutations |
| Maintainability | Worker is thin validation + D1 proxy; business logic stays client-side; numbered SQL migrations |

---

## Token-Economics Rules

- Store raw markdown once per document revision.
- Persist chunks and graph snapshots separately.
- Track `contentHash` and chunk hashes for reuse.
- Address chunks by semantic keys instead of offsets.
- Avoid resending unchanged chunks when hashes match.
- Prefer pulled delta application over full workspace reloads.

---

## Storage Comparison

| Option | Primary role | TCO | Token economics | Recommendation |
|---|---|---:|---|---|
| RxDB | Browser-local draft and cache store | Lowest | Strong via local chunk reuse | Required |
| SQLite / D1 | First shared store | Low | Strong via persisted chunks and revisions | Recommended |
| PostgreSQL | High-scale shared backend | Highest | Strong for future server retrieval | Deferred |

---

## Validation Summary

Focused tests cover:

- Shared contract routes and record shapes
- Worker push, pull, and export behavior
- Client sync loop scheduling and result handling
- Source-files mutation enqueueing
- Inbound pulled-record application into visible source-files state
- Conflict UX dedupe behavior
- Shared toast/history action rendering and dispatch

Representative test files:

- `canvas/src/__tests__/knowgrphStorageContracts.test.ts`
- `canvas/src/__tests__/knowgrphStorageWorker.test.ts`
- `canvas/src/__tests__/knowgrphStorageClientSync.test.ts`
- `canvas/src/__tests__/sourceFilesStorageSync.test.ts`
- `canvas/src/__tests__/sourceFilesInboundStorageApply.test.ts`
- `canvas/src/__tests__/knowgrphStorageConflictUx.test.ts`
- `canvas/src/__tests__/uiActionSurfaces.testx`

---

## Cross-Repo Documentation Contract

These cross-repo docs must stay aligned:

- `knowgrph/todo-log.md`
- `knowgrph/docs/documents/knowgrph-storage-sync-document.md` (this file)
- `knowgrph/docs/documents/knowgrph-storage-schemas-document.md`
- `huijoohwee.github.io/docs/documents/hjh-workspace-todo-log.md`
- `huijoohwee.github.io/schema/AgenticRAG/README.md`
- `huijoohwee.github.io/schema/AgenticRAG/documentation.jsonld`
- `huijoohwee.github.io/schema/AgenticRAG/markdown.jsonld`
- `huijoohwee.github.io/schema/AgenticRAG/panels.jsonld`
- `huijoohwee.github.io/schema/AgenticRAG/knowgrph-documents-map.graph.jsonld`

---

## Continuation

See `knowgrph-storage-schemas.md` for D1 SQL, RxDB local shapes, contract type definitions, and route contracts.
See `knowgrph-local-storage.md` for browser LocalStorage key reference (UI state, not sync).
See `knowgrph-source-files-import.md` for import workflows, format routing, and geo layer registration.
