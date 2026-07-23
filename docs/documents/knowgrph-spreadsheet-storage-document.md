---
title: "Knowgrph Spreadsheet Storage"
id: "md:knowgrph-spreadsheet-storage-document"
version: "2.2.0"
updated: "2026-07-23"
status: "active"
doc_type: "Storage Surface Reference"
frontmatter_contract: "required"
document_runtime_status: "runtime-ready-dev"
runtime_scope: "Frontmatter parsing, source validation, MCP grammar resolution, and read-only Source Files discovery; spreadsheet persistence reuses the shared workspace and storage owners."
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

# Knowgrph Spreadsheet Storage

**Context**: Spreadsheet-like editing and curation over the active workspace graph.
**Intent**: Reuse shared graph, workspace, and storage owners instead of maintaining a spreadsheet-specific database stack.
**Directive**: Keep spreadsheet domain types source-owned, project active graph rows through the Graph Data Table, and persist authored source through the same Source Files and Storage Sync contracts as every other workspace document.

## Runtime Owners

| Responsibility | Owner | Status |
|---|---|---|
| Spreadsheet domain types | `grph-shared/src/spreadsheet/types.ts` | Active |
| Unified graph rows and table projection | `canvas/src/features/graph-data-table/graphDataTable.ts` | Active |
| Filters | `canvas/src/features/graph-data-table/graphDataTableFilters.ts` | Active |
| Sorts | `canvas/src/features/graph-data-table/graphDataTableSorts.ts` | Active |
| Workspace editor/canvas transition guard | `canvas/src/features/workspace-table/workspaceTableSsot.ts` | Active |
| Document and graph persistence | `knowgrph-storage-sync-document.md` | Shared owner |
| Storage schemas and routes | `knowgrph-storage-schemas-document.md` | Shared owner |

There is no dedicated spreadsheet database, route, or independent sync loop. Browser continuity, GitHub save, D1 read-cache publication, collaboration, and offline fallback follow the shared storage contract.

MainPanel `Document Storage & Sync` therefore applies unchanged to spreadsheet-authored source: Online mode uses the owning GitHub docs root plus configured cloud transports, Offline only retains IndexedDB state and queued mutations, and the spreadsheet surface never asks for repository credentials.

## Concurrent Spreadsheet Contract

- Textual spreadsheet sources such as CSV or structured JSON may enter a selected Yjs collaboration room after local persistence and authenticated workspace admission.
- Concurrent cell/row edits use structured shared types or field-level operations; two clients never overwrite one raw serialized table blob.
- Binary workbook imports remain local immutable source artifacts until normalized to a collaborative textual model. Saving an unnormalized binary workbook requires an explicit exclusive checkpoint.
- Failed collaboration updates stay in the IndexedDB update outbox with stable ids until acknowledged, including across Offline only transitions and reloads.
- PocketBase is the recommended small-team provider only after the shared production gates pass. A Durable Object may replace it, but both providers must never own the same spreadsheet room.
- GitHub receives explicit or bounded autosave checkpoints with compare-and-set content SHA; D1 remains the read/index projection and never receives per-cell writes.
- Explorer ownership remains path-derived: ordinary spreadsheet documents target `GitHub/huijoohwee/docs`, while any authored spreadsheet-like workspace seed under `/docs/workspace-seeds/**` targets `GitHub/knowgrph/docs/workspace-seeds`; IndexedDB remains the offline fallback.
- Source Files local mirroring cannot redirect a spreadsheet seed through the general docs-root setting: seed reads and supported mutations resolve to `$GITHUB_ROOT/knowgrph/docs/workspace-seeds/**`, and the host bridge rejects mismatched paths and root deletion.
- Spreadsheet-like seed files participate in the same exact seed inventory reconciliation: a successful canonical local listing overlays the GitHub seed subtree in Dev, GitHub remains the online fallback, and stale cached seed rows are pruned only after an authority-marked inventory is available.

## Bounded Proof

- `canvas/src/__tests__/spreadsheetFiltersSorts.test.ts` verifies filter and sort invariants over unified rows.
- `npm run storage:docs:check` verifies this document's frontmatter, MCP metadata, source paths, and `/`, `@`, `#` dictionary membership.
