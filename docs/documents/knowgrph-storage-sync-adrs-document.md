---
title: "Knowgrph Storage Sync ADRs"
id: "md:knowgrph-storage-sync-adrs-document"
version: "1.1.0"
updated: "2026-07-23"
status: "active"
doc_type: "Architecture Decision Records"
frontmatter_contract: "required"
document_runtime_status: "runtime-ready-dev"
runtime_scope: "Frontmatter parsing, source validation, MCP grammar resolution, and read-only Source Files discovery; ADR implementation status remains row-specific."
deploy_boundary: "No Prod mirror or Cloudflare mutation is authorized by this document."
mcp:
  grammar_tool: "knowgrph.agentic_canvas_os.docs.invoke"
  published_source_tools: ["search", "fetch"]
  webmcp_source_tools: ["knowgrph.list_source_files", "knowgrph.read_source_file"]
  source_availability: "Read-only after the document is present in the configured published Source Files workspace."
invocation:
  normalize: "/source.normalize @source.frontmatter @source.body #frontmatter #no-legacy"
  verify: "/runtime-ready.check @local-harness @runtime-proof #runtime-ready #vcc"
---

# Knowgrph Storage Sync ADRs

**Context**: Architectural decisions for the Knowgrph storage and sync system.
**Intent**: Keep ADR ownership separate from the companion PRD/TAD so doc sanity budgets remain enforceable without losing decision traceability.
**Directive**: This file records accepted storage decisions; runtime wiring remains in source and canonical architecture remains in `knowgrph-storage-sync-document.md`.

---

**Version**: 1.1.0
**Date**: 2026-07-23
**Companion index**: `knowgrph-storage-sync-document.companion.md`

## ADR Index

| ADR | Status | Decision | Runtime owner |
|---|---|---|---|
| ADR-001 | Accepted | Keep a minimal persisted client working store. | `canvas/src/lib/storage/knowgrphStorageDb.ts` |
| ADR-002 | Accepted | Use SQLite / D1 as the first shared cloud store. | `cloudflare/workers/knowgrph-storage/` |
| ADR-003 | Accepted | Defer PostgreSQL until collaboration or retrieval scale requires it. | `docs/documents/knowgrph-storage-schemas-extensions-document.md` |
| ADR-004 | Accepted | Deploy storage API as a standalone Cloudflare Worker on the same zone. | `cloudflare/workers/knowgrph-storage/wrangler.toml` |
| ADR-005 | Accepted | Retain polling-based sync at 120 seconds for phase 1. | `canvas/src/lib/storage/knowgrphStorageClientSync.ts` |
| ADR-006 | Accepted | Restrict seed write-back to Node.js filesystem contexts. | `canvas/src/features/workspace-fs/workspaceSeedProvider.ts` |
| ADR-007 | Accepted | Auto-clear stale outbox conflicts after pull. | `canvas/src/lib/storage/knowgrphStorageClientSync.ts` |
| ADR-008 | Accepted | Support default workspace initialization source URL. | `canvas/src/features/workspace-fs/workspaceSeedProvider.ts` |
| ADR-009 | Accepted | Expose a public single-document view endpoint. | `cloudflare/workers/knowgrph-storage/index.ts` |
| ADR-010 | Accepted | Use PocketBase + Yjs for same-file collaboration, not Git merge. | `canvas/src/features/source-files/sourceFilesPocketBaseYjsRoom.ts` |
| ADR-011 | Accepted | Promote generated chat Markdown through GitHub first, storage second. | `canvas/src/features/source-files/sourceFilesGitHubWrite.ts` |
| ADR-012 | Accepted | Store generated binary artifacts in R2 with Markdown manifests. | `cloudflare/workers/knowgrph-storage/index.ts` |
| ADR-013 | Accepted | Persist collaborative AI media through R2, D1, KV, and Durable Objects. | `cloudflare/workers/knowgrph-storage/index.ts` |
| ADR-014 | Accepted | Use one canonical storage workspace by default across devices. | `canvas/src/features/source-files/sourceFilesStorageSync.ts` |

## ADR-001: Minimal Persisted Client Working Store

The workspace FS keeps a bounded local working set for continuity and sync recovery. Canonical authoring remains path-scoped to the owning GitHub docs root; D1 is the shared runtime/read cache, and the browser cache must not become an authoring SSOT. IndexedDB remains a zero-egress FOSS substrate through the typed storage wrapper.

## ADR-002: SQLite / D1 First Shared Store

D1 fits the Pages + Worker deployment shape and keeps the first shared store below PostgreSQL-level TCO. SQLite portability remains sufficient until collaboration or retrieval scale requires a heavier store.

## ADR-003: PostgreSQL Deferred

PostgreSQL is deferred while D1 covers runtime read/export needs and PocketBase + Yjs handles concurrent same-file editing. Adoption gates live in `knowgrph-storage-schemas-extensions-document.md`.

## ADR-004: Standalone Storage Worker

The storage API owns D1 binding, route pattern, and secret boundaries through a standalone Cloudflare Worker. This isolates storage and payment concerns from static Pages while preserving same-zone routing.

## ADR-005: Polling Sync For Phase 1

Polling remains at 120 seconds for the first shared sync phase. Durable Objects and streaming remain deferred until latency needs exceed the zero-ops polling path.

## ADR-006: Node.js FS Seed Write-Back Only

Seed write-back is Dev-only and guarded from browser execution. Browser runtime must not attempt local filesystem writes.

## ADR-007: Stale Outbox Conflict Auto-Clear

After pull, stale conflict rows are removed when pulled server revisions are at or ahead of local revisions. Legitimate local edits ahead of server state stay protected.

## ADR-008: Default Workspace Initialization Source URL

Workspace settings can provide a default source URL for empty-workspace initialization. Explicit GitHub docs URLs remain source-of-truth over local projections, and the path stays configurable instead of hardcoded.

## ADR-009: Public Single-Document View Endpoint

`GET /api/storage/doc/:workspaceId/:canonicalPath*` returns non-deleted document markdown with CORS and cache headers. It supports readable links, deep-link canvas rendering, and import defaults without promoting the SPA catch-all to an API owner.

## ADR-010: PocketBase + Yjs Collaboration

Concurrent edits use CRDT ownership: Markdown maps to `Y.Text`, JSON maps to `Y.Map`, and Git merge never reconciles simultaneous minified JSON. Collaborators never receive GitHub credentials, and D1 remains the runtime read/export cache.

## ADR-011: GitHub First For Generated Chat Markdown

Generated chat artifacts under `chat-log/` are promoted to GitHub before any Cloudflare mirror. If GitHub promotion fails, D1/R2 mirroring is skipped so Cloudflare does not become the canonical write owner.

## ADR-012: R2 Binary Artifacts With Markdown Manifests

Generated binary artifacts use R2 for bytes and D1 for searchable Markdown manifests. Public reads go through the storage Worker so metadata, CORS, and cache policy stay centralized.

## ADR-013: Collaborative AI Media Persistence

AI media persistence combines R2 bytes, D1 metadata, optional KV access-cache entries, and optional Durable Object room notification. KV namespace ids and live Cloudflare binding proof remain operator-owned and are never faked in repo config.

## ADR-014: Canonical Cross-Device Source Files Workspace

The default Source Files storage workspace is `kgws:canonical-docs` on every installation. Browser-local folder cache IDs and selected paths remain local workspace preferences, never remote storage identity, so Dev, Prod, and other devices converge on the same Source Files inventory. `VITE_KNOWGRPH_STORAGE_WORKSPACE_ID` is the explicit opt-in boundary for an isolated workspace.
