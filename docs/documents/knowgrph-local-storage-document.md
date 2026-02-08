# Knowgrph Local Storage Document

**Context**: Persisted UI and workflow settings in the browser  
**Intent**: Provide stable, discoverable storage keys with a single source of truth  
**Directive**: Reference only canonical keys from `canvas/src/lib/config.ls.ts` (no magic strings). For plugin-owned keys, import keys from the plugin package (host must not hardcode).

---

## Source of Truth

- Canonical LocalStorage keys live in `LS_KEYS` in `canvas/src/lib/config.ls.ts`.
- Code should read/write keys via `ls*` helpers in `canvas/src/lib/persistence.ts`.

---

## Graph Data (SSOT)

- Canonical graph data is persisted under `LS_KEYS.graphData`.
- The stored payload includes `GraphData.metadata.graphDataRevision` and `GraphData.metadata.hash` so derived surfaces can detect staleness.
- Writes are intentionally debounced (batched via the history scheduler) to avoid per-keystroke LocalStorage churn while still persisting edits/imports reliably.

- Graph Data Table UI state keys (owned by the curation surface):
  - `LS_KEYS.graphDataTableVisibleColumns`
  - `LS_KEYS.graphDataTableColumnOrder`
  - `LS_KEYS.graphDataTableColumnWidths`
  - `LS_KEYS.graphDataTableFilterState`
  - `LS_KEYS.graphDataTableSortRules`
  - `LS_KEYS.graphDataTableGroupKey`

- Graph Table (Editor Workspace) view state keys (owned by the host workspace tool, not the curation plugin):
  - `LS_KEYS.graphTablePanelCollapsed`
  - `LS_KEYS.graphTableInspectorOpen`
  - `LS_KEYS.graphTableInspectorWidthPx`
  - `LS_KEYS.graphTableColumnVisibilityById`
  - `LS_KEYS.graphTableFilters`
  - `LS_KEYS.graphTableFilterMatch`
  - `LS_KEYS.graphTableGroupBy`
  - `LS_KEYS.graphTableSortRules`
  - `LS_KEYS.graphTableRowHeightPreset`
  - `LS_KEYS.graphTableColumnWidthsPx`

---

## Markdown UI (Bottom Panel)

- Explorer Workspace
  - `LS_KEYS.markdownSidebarWidthPx`
  - `LS_KEYS.markdownExplorerSourceFilesCollapsed`
  - `LS_KEYS.markdownExplorerSourceFilesExpandedPaths`
  - `LS_KEYS.markdownExplorerOutlineCollapsed`
  - `LS_KEYS.markdownExplorerBacklinksCollapsed`

- Legacy keys (not used by the current Explorer workspace UI)
  - `LS_KEYS.markdownLayoutMode`
  - `LS_KEYS.markdownWordWrap`
  - `LS_KEYS.markdownViewerWidthMode`
  - `LS_KEYS.markdownPresentationMode`
  - `LS_KEYS.markdownTextHighlight`
  - `LS_KEYS.markdownAnnotateDisplay`
  - `LS_KEYS.markdownSyncScroll`
  - `LS_KEYS.markdownSidebarOpen`
  - `LS_KEYS.markdownCollapsedHeadingIds`
  - `LS_KEYS.jsonMarkdownMode`

---

## Workspace UI (Canvas vs Editor)

- Workspace view mode and Editor layout state:
  - `LS_KEYS.workspaceViewMode` (Canvas | Editor)
  - `LS_KEYS.documentStructureBaselineLock` (default on; disables mode switches that can desync surfaces)
  - `LS_KEYS.workspacePreviewWidthPx` (Editor preview split width)
  - `LS_KEYS.workspaceEditorSection` (Editor left pane section: Markdown | Graph Table)

---

## Floating Panels (Tool Menu)

- Floating panel shell and layout state:
  - `LS_KEYS.floatingPanelPinned`
  - `LS_KEYS.floatingPanelWidthRatio`
  - `LS_KEYS.floatingPanelHeightRatio`
  - `LS_KEYS.floatingPanelZIndex`

---

## Flow Editor (Node Quick Editor)

- Node Quick Editor overlay state:
  - `LS_KEYS.flowNodeQuickEditorPinned` (legacy single-flag; do not use for multi-node overlays)
  - `LS_KEYS.flowNodeQuickEditorPinnedByNodeId` (per-node pinned-to-node state; pinned locks, unpinned detaches)
  - `LS_KEYS.flowNodeQuickEditorMinimized`
  - `LS_KEYS.flowNodeQuickEditorHideFields`
  - `LS_KEYS.flowNodeQuickEditorTopPx` / `LS_KEYS.flowNodeQuickEditorLeftPx` (legacy single-position; do not use for multi-node overlays)
  - `LS_KEYS.flowNodeQuickEditorPosByNodeId` (per-node detached position)

---

## Geospatial Mode (Extracted)

- Knowgrph keeps Geospatial Mode keys out of `canvas/src/lib/config.ls.ts` to preserve a geospatial-free core.
- The Geospatial Mode implementation (including its persistence design) lives in the sibling repo `gympgrph` and owns its LocalStorage keys.
