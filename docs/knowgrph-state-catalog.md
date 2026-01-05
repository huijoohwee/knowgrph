#

## GraphState store architecture (slices → responsibilities)

| Slice             | Category | Primary responsibilities                                                  | Modules / entry points                                                                                  |
|-------------------|----------|---------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| GraphData slice   | Data     | Own `GraphData`, track revisions, schedule history, trigger minimap      | `canvas/src/hooks/store/graphDataSlice.ts`, `canvas/src/hooks/useGraphStore.ts`                        |
| Minimap slice     | Layout   | Maintain minimap preview paths/bounds, manage worker lifecycle           | `canvas/src/features/minimap/store.ts`, `canvas/src/hooks/useGraphStore.ts`                            |
| Selection slice   | UI       | Track selected node/edge and selection source                            | `canvas/src/hooks/store/selectionSlice.ts`, `canvas/src/hooks/useGraphStore.ts`                        |
| UI slice          | UI       | Persist bottom panel/sidebar/floating panel ratios and table/view state  | `canvas/src/hooks/store/uiSlice.ts`, `canvas/src/lib/config.ts`                                        |
| Canvas slice      | Layout   | Manage canvas dimensions/position, zoom and 3D camera requests/state     | `canvas/src/hooks/store/canvasSlice.ts`, `canvas/src/components/GraphCanvas.tsx`, `canvas/src/features/minimap/Minimap.tsx` |
| History slice     | History  | Capture and restore snapshots of `GraphData` and Graph Fields settings   | `canvas/src/hooks/store/historySlice.ts`, `canvas/src/hooks/useGraphStore.ts`, `canvas/src/features/panels/hooks/useWorkflowExportActions.ts` |
| Schema slice      | Data     | Own `GraphSchema`, apply schema-config presets, persist schema to storage| `canvas/src/hooks/store/schemaSlice.ts`, `canvas/src/lib/graph/schema.ts`                              |

GraphState is composed in `useGraphStore` by spreading these slices so that:
- Data ownership stays with GraphData/Schema slices.
- Layout and viewport state stays with Canvas/Minimap slices.
- UI preferences and panel layout ratios stay with the UI slice.
- Time travel and exportable history stay with the History slice.
- Selection state remains a thin, UI-facing slice.

This same decomposition is mirrored in the AgenticRAG store-architecture JSON-LD graph under `data/knowgrph-store-architecture_202512271830/store-architecture-graph-data.jsonld`, where each slice is modeled as a node linked to its Data/UI/Layout/History category nodes.

##

| Area | Responsibility Type | Responsibility | Modules | Classes/Objects | Functions/Methods | Key | Type | Value | Dependencies / Imports | Notes | Line Range | Compliance ✅/⚠️/❌ | Recommended Action | State Lifecycle |
| ---- | -------------- | ------- | --------------- | ----------------- | --- | ---- | ----- | ---------------------- | ----- | :-------- | --- |

| BottomPanel | UI | Switch Graph Data editor view | `canvas/src/hooks/store/panelLayoutUiSlice.ts`, `canvas/src/components/BottomPanel/BottomPanelBody.tsx`, `canvas/src/components/BottomPanel/BottomPanelCurationToolbar.tsx`, `canvas/src/components/BottomPanel/BottomPanelGraphDataBlockEditor.tsx` | `GraphState` | `setBottomPanelCurationView` | `bottomPanelCurationView` | `'grid' \| 'json' \| 'block'` | In-memory | `useGraphStore` | `block` renders the Editor.js Block-style Editor for Graph Data. | — | ✅ | — | Reset on reload |
| GraphData | Data | Persist node media properties | `canvas/src/hooks/store/graphDataSlice.ts`, `canvas/src/hooks/useGraphStore.ts`, `canvas/src/components/GraphCanvas/helpers.ts` | `GraphState` | `updateNode` | `data.nodes[].properties.media_*` | `{ media_kind?: 'image' \| 'svg' \| 'video' \| 'iframe', media_url?: string, media_interactive?: boolean }` | In-memory | `useGraphStore` | Read by 2D canvas media rendering and selection highlighting; iframe URLs normalize YouTube watch/share to embed URLs. | — | ✅ | — | Stored in graph data |
| Markdown Preview | UI | Track focused Mermaid diagram and active media tile | `canvas/src/hooks/store/graphDataSlice.ts`, `canvas/src/hooks/useGraphStore.ts`, `canvas/src/features/markdown/ui/MarkdownTokenRenderer.tsx`, `canvas/src/features/panels/views/PreviewPanelView.tsx` | `GraphState` | `setMarkdownPreviewMermaidFocus`, `setMarkdownPreviewActiveMediaKey` | `markdownPreviewMermaidFocusCode`, `markdownPreviewMermaidFocusConfig`, `markdownPreviewActiveMediaKey` | `string \| null`, `Record<string,unknown> \| null` | In-memory | `useGraphStore` | Bottom panel Markdown preview writes these fields on single-click of Mermaid/rich media blocks so the MainPanel Preview tab can highlight the focused Mermaid diagram or media tile in its 3x3, 16:9 gallery; cleared on unmount and not persisted. | — | ✅ | — | Reset on reload |
| Render | UI/Data | Apply graph size presets for small/medium/large graphs | `canvas/src/features/panels/views/RenderSettingsSection.tsx`, `canvas/src/features/panels/views/RenderPresetSection.tsx`, `canvas/src/features/panels/views/renderPresetCatalog.ts` | `GraphState` | `setSchema` (via RenderPresetSection) | `schema.performance` | `{ lod?: { hideLabelsBelowScale?: number }, caps?: { maxNodes?: number, maxEdges?: number } }` | In-memory + persisted (`LS_KEYS.graphSchema`) | `useGraphStore` | Graph size presets write recommended caps for small/medium/large graphs (≈2k/10k, 5k/25k, 10k/50k nodes/edges) while remaining dataset-agnostic; values are stored on the schema and reused across sessions and renderer instances. | — | ✅ | — | Stored in schema |


---

# archive

| Phase | Step | Responsibility | Modules | Functions/Methods | Input | Output | Settings | Tests | State Lifecycle |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Data Loading | User Trigger | Initiate load via Toolbar | `canvas/src/components/Toolbar.tsx:85` | `handleLoad` | Click | Loader call | — | `parserUiState.test.ts` (UI state hydration) | — |
| Data Loading | File Selection | Prompt user for file | `canvas/src/lib/graph/file.ts:31` | `pickTextFile` | — | `{ name, text }` | — | — | — |
| Parsing | Parser Selection | Identify format by extension/content | `canvas/src/features/parsers/registry.ts:43` | `bestMatch` | `name`,`text` | `ParserSpec` id | — | `parserAutoApply.test.ts` | — |
| Parsing | Parse Execution | Transform text to `GraphData` | `canvas/src/features/parsers/registry.ts:29` | `applyParserAsync` | `name`,`text` | `{ data, warnings }` | `kg:parsers:treeSitterEnabled` (legacy `parser.useTreeSitter`) | `n8nParse.test.ts`, `roundtrip.test.ts` | — |
| Parsing | CSV Parser | Convert CSV rows to graph | `canvas/src/lib/graph/csv.ts:121` | `parseCsvToGraph` | CSV | `GraphData` | — | `roundtrip.test.ts` | — |
| Parsing | JSON‑LD Parser | Convert JSON‑LD to graph | `canvas/src/lib/graph/jsonld.ts:8` | `parseJsonLd` | JSON‑LD | `GraphData` | `serialization` (export) | `roundtrip.test.ts` | — |
| Parsing | Raw JSON Parser | Map `{nodes,edges}` to graph | `canvas/src/lib/graph/rawToGraph.ts:3` | `rawToGraphData` | Raw JSON | `GraphData` | — | — | — |
| State | Store Update | Commit data to global state | `canvas/src/features/parsers/loader.ts:28`, `canvas/src/hooks/store/graphDataSlice.ts:7` | `setData` | `GraphData` | Store updated | `historyDebounceMs` | `minimap.test.ts` (viewport math) | Store state committed |
| State | On‑Open Reset | Clear previous graph on new load | Store slice | Reset action | — | Clean state | — | — | State reset before parse |
| State | Hydration | Restore saved state from schema | Store hydration | Hydrate from template | Schema defaults | Initialized store | All settings | `parserUiState.test.ts` | State initialized on mount |
| Rendering | Initialization | Initialize SVG, zoom, simulation | `canvas/src/components/GraphCanvas.tsx:50`, `canvas/src/components/GraphCanvas/simulation.ts:12` | `createZoom`, `buildSimulation` | Store `data` | D3 runtime | `layout.forces.*` | — | Read from store |
| Rendering | Element Creation | Bind nodes/edges/labels | `canvas/src/components/GraphCanvas.tsx:81`, `102`, `174` | D3 selections | Nodes/Edges | SVG groups | `nodeSizes`, `nodeStyles`, `edgeStyles`, `labelStyles` | — | Read from store |
| Rendering | Tick Loop | Update positions per frame | `canvas/src/components/GraphCanvas.tsx:186` | `simulation.on('tick')` | Sim coords | DOM attrs | — | — | Read from store |
| Rendering | Tidy tree derivation | Build tree-friendly edge set and direction | `canvas/src/components/GraphCanvas/simulation.ts:127–227`, `canvas/src/components/GraphCanvas/scene.ts:172–182` | `deriveTidyTreeDerivation` | Graph nodes/edges, `GraphSchema.layout.tidyTree` | `{ candidateEdges, direction, labelSet }` | `layout.tidyTree.edgeLabels`, `layout.tidyTree.direction` | — | Derived at render time to stay domain-agnostic; candidateEdges are filtered to a tree-friendly subset (one parent per child) and reused by both layout and SVG layers so tidy tree views stay uncluttered without adding new persisted state fields. |
| Interaction | Selection Highlight | Update styles on selection | `canvas/src/components/GraphCanvas.tsx:296–364` | Effects on selections | IDs | Highlighted DOM | — | — | Update selection state |
| Interaction | Edge Creation | Create/update edges via shift‑drag | `canvas/src/components/GraphCanvas.tsx:119–156` | Edge handlers | Node/Edge | New/updated edge | `behavior.*`, `endpointMatrix`, `cardinality.*` | — | Mutate graph state |
| Interaction | Zoom Control | Apply zoom requests and fits | `canvas/src/components/GraphCanvas/zoomController.ts:24`, `61`, `68` | `applyZoomRequest` | Request | Transform | — | — | Update zoom state |
| Interaction | Label LOD | Hide labels below zoom scale | `canvas/src/components/GraphCanvas/zoom.ts:12–20` | `createZoom` | Zoom event | Label opacity | `performance.lod.hideLabelsBelowScale` | — | Read zoom threshold |
| Minimap | Preview Quick | Compute sampled minimap | `canvas/src/features/minimap/store.ts:22` | `computeMinimapPreviewQuick` | Graph | Paths + bounds | — | `minimap.test.ts` | Read graph bounds |
| Minimap | Preview Async | Compute worker minimap | `canvas/src/features/minimap/store.ts:41` | `computeMinimapPreviewAsync` | Graph | Paths + bounds | — | — | Read graph bounds |
