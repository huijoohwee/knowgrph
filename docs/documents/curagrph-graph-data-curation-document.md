# curagrph Graph Data Curation (UI Surfaces)

## Overview

`curagrph` owns the Graph Data curation and presentation UI surfaces (tables, editors, viewers), while host apps (e.g. `knowgrph`) own pipeline orchestration and state.

**Goal**: enforce single-source-of-truth ownership for Graph Data UI surfaces while keeping host-visible UI behavior unchanged.

---

## Scope (owned by curagrph)

- BottomPanel curation/presentation submodules (curator + markdown + stats + JSON views)
- Graph Data Table (filter/sort/group + frozen areas + virtualized rows)
- Markdown viewer/editor/presentation/gallery surfaces + Source Files List
- Preview-panel UI primitives used by markdown/presentation (gallery + overlays + zoom/pan)
- JSON editor used by curation and inspectors

**Out of scope (host-owned)**

- Host editor-workspace tools that may also show a “Graph Data Table” label (e.g. a lightweight semantic `<table>` view inside Editor mode). Those are not owned by `curagrph` and must not share persistence keys or internal state with the curation table.

---

## Graph Data Table Contract

- Graph Data Table is a curation surface over the same `GraphData` SSOT used by Canvas renderers.
- Any mutation of Graph Data (imports, table edits, canvas edits, history restore) must bump `graphDataRevision` and stamp `GraphData.metadata.graphDataRevision/hash` so all derived views re-render deterministically.
- Row selection updates the shared selection model (`selectedNodeId` / `selectedEdgeId`) so Canvas, Markdown “Show on Canvas”, and table highlights stay consistent.
- Renderer/mode switches (D3/Flow/3D/Geospatial) must not reset selection or mutate canonical graph data.
- When Geospatial Mode is enabled, the table remains usable but the graph canvas is not rendered; selection is still updated in the shared store for when the user returns to a graph renderer.

### Layout & Scroll (DOM table)

- The curation table is a DOM `<table>` surface with a single scroll container owning both header and body.
- Sticky/frozen bands (header row and optional first data column) must remain visually aligned with the scrollable region at all horizontal scroll offsets.
- The horizontal scroll owner must be the same element for header and body; avoid split scroll containers that drift.

Code references:

- `curagrph/src/features/graph-data-table/ui/GraphDataTableTable.tsx`
- `curagrph/src/features/graph-data-table/ui/GraphDataTableHeader.tsx`
- `curagrph/src/features/graph-data-table/ui/GraphDataTableBody.tsx`

### Frozen Areas

- Frozen header row is always sticky.
- Optional frozen first data column (`freezeFirstDataColumn ∈ {none,label,id}`) must:
  - Stay pinned without blocking horizontal scroll for the rest of the columns.
  - Render with fully opaque backgrounds in both header and body so scrolled content does not show through.
  - Preserve pointer interactions on scrollable cells (do not place empty sticky overlays above scrollable content).

### Column Widths

- Header and body must share the same effective column widths (including per-column overrides) so horizontal alignment cannot drift.
- Width changes must apply to both header cells and body cells in the same render pass.

### Column Reorder (Glide-like)

- Column reordering is initiated by pointer-drag on a header drag affordance and must not rely on HTML5 drag-and-drop.
- Reordering operates over the visible ordered columns; after a drop, the new order is persisted via `graphDataTableColumnOrder`.
- Reorder feedback must be explicit (drop hint / insertion side), and the table must remain usable while dragging (no text selection, no accidental column resize).

### Empty Graph Behavior

- When the active `GraphData` becomes empty (no nodes and no edges), the table must render the empty state and must not keep showing rows from a previous graph.
- Any derived/cached row materialization must be invalidated when the base graph becomes `null` or empty so “no data” is always truthful.

### Surface Vocabulary

- Cross-surface routing uses the shared `SsotSurface` vocabulary from `grph-shared/ssot/types` so “Table / Markdown / Slides / Canvas / Map” can be referenced without per-repo string drift.

---

## Integration Contract

The canonical host integration pattern for extracted UI surfaces is:

- **Resolution target**: hosts resolve extracted modules from the installed package source at `node_modules/curagrph/src` (never from sibling `../../curagrph/src` paths).
- **Host aliases**: hosts map stable import prefixes (e.g. `@/features/markdown/*`) to `./node_modules/curagrph/src/...` in both bundler config (Vite) and TypeScript `paths`.
- **Symlink stability**: hosts preserve symlink paths in both bundler and TypeScript resolution so `node_modules/curagrph/src/...` stays the canonical resolved location.
- **Styling parity**: hosts include `node_modules/curagrph/src/**/*.{js,ts,jsx,tsx}` in Tailwind content scanning so extracted classes remain stable.
- **Dependency stability**: hosts dedupe shared deps across linked packages (notably `react` and `highlight.js`) and pre-optimize `highlight.js` so markdown rendering does not hit ESM/CJS default-export hazards.
- **Coupling guardrail**: `curagrph` must not import host code via hardcoded sibling paths; any host coupling must occur only through stable host-provided module prefixes (e.g. `@/hooks/*`, `@/lib/*`) so the host controls the contract surface.

This contract is the default pattern for future UI extractions so module ownership stays neutral and maintainable without reintroducing duplicate/competing implementations in host repos.

---

## Source Files Contract

- **Host-owned ingest**: host UI surfaces (e.g. FloatingPanel Workspace Actions) ingest local/URL text and append to `useGraphStore.sourceFiles` using `addSourceFile`.
- **Curation UI visibility**: `curagrph` markdown surfaces render an optional Source Files list inside the Markdown sidebar "Contents" area.
- **Selection behavior**: selecting a source file updates the active markdown document via `setMarkdownDocument(name, text)` and updates the active marker by comparing `markdownDocumentName`.
- **Text SSOT**: selecting a Markdown source file must update the editor’s underlying markdown text source (not only Viewer/Presentation state) so Editor/Viewer/Presentation always render the same text.

### Markdown Loader Identity Rule

- Do not require strict `activeDocumentPath === markdownDocumentName` equality.
- Implementations must treat `sandbox/docs/demo.md` and `demo.md` as the same document identity for the purpose of preferring imported/store markdown text.
- On fs-load failure for a basename match, fall back to the imported/store markdown so the editor cannot become blank while viewer/presentation still show content.

### Local Markdown Folder (CRUD) Contract

- **Open folder (browser-consistent)**:
  - If supported, use the File System Access API directory picker with write access.
  - Otherwise, use a file-input directory pick as read-only; if OPFS is available, prefer creating a writable OPFS copy.
- **Create folder/file (write-gated)**: “New folder” and “New source file” are user-visible actions; if a writable local folder handle is not available, prompt the folder-open flow first and surface read-only constraints via UI toasts.
- **Delete file (write-only)**: delete is available only when a writable local folder handle exists.
- **ui-path-0 (canonical happy path)**:
  - BottomPanel → Markdown → Contents → Source files → Open folder → select a `.md` file → view in Viewer/Presentation → switch to Editor → Editor shows the same text content.

---

## Markdown Interaction Contract (Editor / Viewer / Presentation)

- **Text selection**: Viewer/Presentation preserve native browser selection (single click caret anchor; double click selects a word; triple click selects a paragraph/line). No implicit navigation on double-click.
- **Right click**: Opens the Selection Toolbar (“Show on/in …”) at the exact pointer position. Monaco’s built-in context menu is disabled so right click always produces the same app-level toolbar.
- **Cmd/Ctrl+Enter**: In the Markdown section Editor/Viewer layout modes, Cmd/Ctrl+Enter toggles Editor↔Viewer. When in Editor, it applies and then switches to Viewer.
- **Reorder grip + gutter**: Block controls (Add line + reorder grip) live in a reserved left gutter so they never overlap content; drag reorder is enabled only from the grip.
- **Nested blocks**: Tokens rendered inside list items and blockquotes do not render block gutters/controls to avoid compounding indentation and to preserve marker/border alignment.
- **Mode synchronization**: Editor/Viewer/Presentation are different render modes over the same markdown text source; switching modes must not desynchronize content (no “Viewer has content while Editor is blank”).
