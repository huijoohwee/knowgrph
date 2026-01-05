# Knowgrph Hooks Catalog

## Graph Store Overview

- Store: `canvas/src/hooks/useGraphStore.ts:122` creates a typed Zustand store via `create<GraphState>`.
- State interface: `canvas/src/hooks/useGraphStore.ts:12` exports `GraphState` including data, selection, UI, history, canvas, minimap, and schema actions.
- Slice composition: Store merges `graphDataSlice`, `minimapSlice`, `selectionSlice`, `historySlice`, `uiSlice`, `canvasSlice`, `schemaSlice`.

### Selection Slice and 3D
- Selection state: `selectedNodeId`, `selectedEdgeId`, and `selectionSource` are defined in `canvas/src/hooks/store/selectionSlice.ts` and consumed by both `GraphCanvas.tsx` (2D) and `ThreeGraph.tsx` (3D).
- 3D renderer uses the same selection hooks as 2D to tint nodes/edges based on the active node or edge and its neighbors, keeping behavior consistent across modes.
- The AI‑KG traversal highlight feature uses `findGraphRagTraversalEdgeIds` to resolve the `graphRAGPath.traverse` path, then calls `setSelectionSource('toolbar')`, `selectNode(null)`, and `selectEdge(id)` in a timed sequence so that each edge along the path is selected in turn; the shared selection slice ensures the same dimming/glow rules apply regardless of whether the selection originates from canvas clicks, table rows, or the Render tab button. The associated Render tab block also writes `schema.three.layerOpacityByLayer` via `setThreeConfig` and wraps `setCharge` to expose a `Force Separation` slider and a `Traversal Delay (ms)` control without adding new store fields (`canvas/src/lib/graph/graphragTraversal.ts:1–49`, `canvas/src/features/panels/views/RenderSettingsSection.tsx`, `canvas/src/features/three/ThreeGraph.tsx:215–297`, `canvas/src/components/GraphCanvas.tsx`).

## Slices & Actions

- Graph Data
  - `setData(data)`: `canvas/src/hooks/store/graphDataSlice.ts:7` commits `GraphData`, schedules history, refreshes minimap.
  - `clearData()`: `canvas/src/hooks/store/graphDataSlice.ts:19` resets graph state and minimap.
  - `updateNode(id, updates)`: `canvas/src/hooks/store/graphDataSlice.ts:27` validates then applies updates.
  - `addEdge(edge)`: `canvas/src/hooks/store/graphDataSlice.ts:60` enforces endpoint/cardinality, applies templates.
  - `updateEdge(id, updates)`: `canvas/src/hooks/store/graphDataSlice.ts:73` validates then applies updates.

- Selection
  - `setSelectionSource(src)`: `canvas/src/hooks/store/selectionSlice.ts:5` sets selection origin.
  - `selectNode(id)`: `canvas/src/hooks/store/selectionSlice.ts:6` selects node and clears edge.
  - `selectEdge(id)`: `canvas/src/hooks/store/selectionSlice.ts:7` selects edge and clears node.

- UI
  - Panel opacities: `setUiOverlayOpacity`, `setUiPanelOpacity`, `setUiToolbarOpacity` in `canvas/src/hooks/store/uiSlice.ts:26–28` use persisted storage.
  - Bottom panel: `setBottomPanelHeightRatio`, `setBottomPanelTab` in `canvas/src/hooks/store/uiSlice.ts:29–31`.
  - Toggle sidebar: `canvas/src/hooks/store/uiSlice.ts:20`.

- History
  - `addHistory(label?)`: `canvas/src/hooks/store/historySlice.ts:9` immediate snapshot.
  - `scheduleHistory(label)`: `canvas/src/hooks/store/historySlice.ts:46` debounced snapshot with `historyTimer`.
  - `undoHistory()` / `redoHistory()`: `canvas/src/hooks/store/historySlice.ts:26`, `:36` restore snapshots.

- Canvas
  - `requestZoom(type)`: `canvas/src/hooks/store/canvasSlice.ts:7` queues a zoom request.
  - `requestZoomTransform(payload)`: `canvas/src/hooks/store/canvasSlice.ts:8` sets explicit transform.
  - `setZoomState(z)`: `canvas/src/hooks/store/canvasSlice.ts:10` commits current transform.

- Minimap
  - `computeMinimapPreviewQuick()`: `canvas/src/features/minimap/store.ts:22` sampled path build.
  - `computeMinimapPreviewAsync()`: `canvas/src/features/minimap/store.ts:42` worker path build.
  - `cancelMinimapWorker()`: `canvas/src/features/minimap/store.ts:14` terminates worker.

- Schema
  - Styling: `updateNodeStyle`, `updateEdgeStyle`, sizes/strokes in `canvas/src/hooks/store/schemaSlice.ts:7–31`.
  - Layout: `setLinkDistanceByLabel`, `setCharge`, `setCollisionByType`, `setAlphaDecay` in `canvas/src/hooks/store/schemaSlice.ts:43–66`.
  - Validation: `upsertNodeValidation`, `upsertEdgeValidation` in `canvas/src/hooks/store/schemaSlice.ts:67–76`.
  - Endpoint matrix & cardinality: `canvas/src/hooks/store/schemaSlice.ts:77–93`.
  - Templates: `setNodeTemplate`, `setEdgeTemplate` in `canvas/src/hooks/store/schemaSlice.ts:94–105`.
  - Accessibility & behavior: `setLodHideLabelsBelow`, `setHighContrast`, `setNodeShape`, `setEdgeArrow`, `setSelectMode`, `setCreateMode`, `setHover` in `canvas/src/hooks/store/schemaSlice.ts:106–143`.
  - Serialization: `setSerialization` in `canvas/src/hooks/store/schemaSlice.ts:144–148`.
  - Catalog management: add/rename/remove node types and edge labels in `canvas/src/hooks/store/schemaSlice.ts:150–311`.
  - Property schemas: `upsertNodeProperty`, `removeNodeProperty`, `upsertEdgeProperty`, `removeEdgeProperty` in `canvas/src/hooks/store/schemaSlice.ts:313–???`.

## Workflow Presets Hooks & Persistence

- Parser UI state
  - `useParserUIState` now coordinates parser load status, data load status, warnings, counts, and the selected parser id for both manual loads and workflow presets (`canvas/src/features/parsers/uiState.ts:4–51`).
  - `ParserView` reads and writes this state when applying presets so that the UI reflects the active parser and data badge while keeping history/minimap behavior unchanged (`canvas/src/features/panels/views/ParserView.tsx:38–44,165–171,235–268`).
- Workflow preset catalog
  - `WORKFLOW_PRESETS` catalog in `canvas/src/features/parsers/workflowPresets.ts:26–84` defines curated presets for Unicorn Top‑3 3D, AI‑KG, and related demos including `parserId`, `datasetFileName`, `schemaFileName`, and optional 3D overrides.
  - `writeWorkflowPresetCatalogToStorage` and `writeWorkflowPresetLastAppliedToStorage` persist a compact JSON catalog and the last applied preset using `LS_KEYS.workflowPresetCatalog` and `LS_KEYS.workflowPresetLastApplied`, so downstream AgenticRAG tooling and cache catalogs can consume these without hard‑coded storage keys (`canvas/src/features/parsers/workflowPresets.ts:120–167,177–217`, `canvas/src/lib/config.ts:88–89`).

- Graph data table hooks
  - `useGraphDataTableWindowing` computes virtualized row windows, spacer heights, and item offsets for the graph data table based on density, overscan, and store‑backed tuning knobs (`canvas/src/features/graph-data-table/ui/GraphDataTableWindowing.tsx:1–120`).
  - `useGraphDataTableFrozenArea` centralizes frozen‑column drag semantics for the spreadsheet view, mapping drag distance to a `GraphDataTableFreezeMode` (`'none' | 'label' | 'id'`), resolving the frozen boundary column, and updating both header/body resize handles and persisted scope‑specific freeze state via `setGraphDataTableFreezeFirstDataColumn` (`canvas/src/features/graph-data-table/ui/useGraphDataTableFrozenArea.tsx:1–225`, `canvas/src/features/graph-data-table/ui/GraphDataTableTable.tsx:313–325`, `canvas/src/hooks/store/uiSlice.ts:163–187`).
  - Users configure the graph data table mapping (column visibility, density, and frozen‑area mode) via the Graph Fields tab and table settings; the persisted keys and AgenticRAG‑aligned representation are documented in the “Graph Data Table Frozen Area” row and “Graph Data Table behavior JSON‑LD example (codebase index)” section of `docs/knowgrph-schema-document.md`.

- Bottom panel parser state
  - `useParserBottomPanelState` wraps `useParserWorkflowState` to expose a bottom‑panel oriented API for the Parser tab, mirroring the Orchestrator and Render bottom panel hooks (`canvas/src/features/panels/hooks/useParserBottomPanelState.ts:1–56`).
  - Returns `parserSelectionProps` and `parserDataProps` from the underlying workflow hook along with a normalized `sections` map, `areAllSectionsCollapsed` boolean, and `setAllSectionsCollapsed(next: boolean)` helper used by `BottomPanelBody` and `BottomPanelParserToolbar` (`canvas/src/components/BottomPanel/BottomPanelBody.tsx:84–116`).

## Typing Notes

- `GraphState.historyTimer`: `ReturnType<typeof setTimeout> | null` for debounce safety.
- Store slices (`selectionSlice`, `canvasSlice`, `uiSlice`) all accept a `set` function typed as `StoreApi<GraphState>['setState']` so updates share the same partial‑state signature that Zustand exposes: callers can pass either a `Partial<GraphState>` object or a `(state: GraphState) => Partial<GraphState>` updater along with optional `replace` and `action` parameters, and tooling/IntelliSense stays aligned with the central `GraphState` interface (`canvas/src/hooks/store/selectionSlice.ts`, `canvas/src/hooks/store/canvasSlice.ts`, `canvas/src/hooks/store/uiSlice.ts`).
- Validation rule shape: required/types/patterns/ranges/uniqueness/severity.
- Templates use `JSONValue` for property defaults.
- All slice creators accept typed `set`/`get` compatible with Zustand v5.
