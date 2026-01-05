# Knowgrph Utilities Catalog

## GraphCanvas Utilities
- `canvas/src/components/GraphCanvas/utils/zoom.ts`: create and update zoom transform.
- `canvas/src/components/GraphCanvas/utils/fit.ts`: fit node/edge into viewport transform.
- `canvas/src/components/GraphCanvas/utils/drag.ts`: node drag behavior with guards.
- `canvas/src/components/GraphCanvas/utils/simulation.ts`: D3 force setup and normalization helpers.
- `canvas/src/features/canvas/utils.ts`: `PROPS_PANEL_OPEN_EVENT` + `emitPropsPanelOpen` used by canvas/node/edge right-click to open the floating tool menu in PropsPanel view at the pointer position (handled in `canvas/src/features/toolbar/ToolbarMenuLauncher.tsx`). Pinned state persists via `LS_KEYS.propsPanelPinned` (shared with the FloatingPanel pin toggle).
- Barrel: `canvas/src/components/GraphCanvas/utils.ts` re-exports helpers for discoverability.
- `canvas/src/components/GraphCanvas/helpers.ts`: node media helpers (`getNodeMediaSpec`, URL kind inference, safe iframe allowlist) including YouTube watch/share URL normalization to embed URLs for iframes.

### Demo dataset loaders
- `canvas/src/features/parsers/examplesCatalog.ts`: central registry for example datasets and schemas. Heavy demos (for example AI‑KG Visualization) now point to sharded/demo‑scale assets such as `test-data/ai-kg-viz_1500.json` so example presets load smaller graph bundles in the browser while leaving full‑fidelity fixtures available for tests and offline analysis.
- `canvas/src/features/parsers/workflowPresets.ts`: exposes `WORKFLOW_PRESETS`, `getWorkflowPresetPipeline`, and `loadExampleDatasetTextInBrowser`/`loadExampleSchemaTextInBrowser`, implemented on top of `import.meta.glob` to lazily import dataset/schema files from `test-data/` and `schema-config/` only when a preset is applied.

## 3D Layout & Physics Utilities
- `canvas/src/features/three/layout.ts`: spherical layout (`fibSphere`), 3D position hydration (`usePositions`), and grid-indexed physics tick loop (`Physics3D`) extracted from `ThreeGraph.tsx` to keep the render component focused on React/R3F concerns.
- `canvas/src/features/three/selection.ts`: shared 3D selection helpers (`NodeSelectionMode`, `NodeSelectionState`, `SelectionVisuals`, `getSelectionVisuals`, `buildNeighborIds`) reused by `ThreeGraph.tsx` to align 2D/3D highlighting; AI‑KG traversal uses `findGraphRagTraversalEdgeIds` to compute the path from `graphRAGPath.traverse` and then drives the shared selection state through `selectEdge` so all existing neighbor/highlight utilities apply without custom animation code (`canvas/src/lib/graph/graphragTraversal.ts:1–49`, `canvas/src/features/three/ThreeGraph.tsx:215–297`).

## Parser Utilities
- `canvas/src/features/parsers/transform.ts`: property mapping, aggregation, path resolution.
- `canvas/src/features/parsers/schema.ts`: validate transforms JSON for editor.
- `canvas/src/features/parsers/specFormat.ts`: pretty-print parser spec summary.
- `canvas/src/features/parsers/cache.ts`: LRU cache for parse results.

## Editor Utilities
- `canvas/src/features/hooks/useEditorTextareaHandlers.ts`: selection throttling, scroll helpers, idle formatting.
- `canvas/src/features/json/JsonEditor.tsx`: lightweight, validated JSON editor for transforms.
- `canvas/src/hooks/useOutsideClose.ts`: outside click handler with stable listener options and multiple ignore refs.
- `canvas/src/features/panels/utils/editor.ts`: code editor helpers with typed timers and centered highlight retries.
- `canvas/src/features/panels/utils/idle.ts`: `requestIdleCallback` wrapper with fallback timeout.
- `canvas/src/components/BottomPanel/BottomPanelGraphDataBlockEditor.tsx`: Editor.js-powered Graph Data block-style editor; maps `GraphData` ↔ Editor.js blocks, validates node/edge JSON before committing to the store, and syncs selection highlighting/scrolling from Canvas.

## Preview Primitives
- `canvas/src/features/panels/views/preview-panel/ui/PreviewOverlay.tsx`: overlay shell (Escape/outside-click to close) used by Mermaid and Slides previews; can scope to viewport or a panel container.
- `canvas/src/features/panels/views/preview-panel/ui/ZoomPanViewport.tsx`: shared pan/zoom viewport with default 16:9 frame, Fit/Reset controls, and per-surface persistence via `LS_KEYS.previewZoomPanMermaid` / `LS_KEYS.previewZoomPanSlides`.
- `canvas/src/features/panels/views/preview-panel/ui/PreviewGallery.tsx`: draggable list primitive for slide thumbnails/order (HTML5 drag/drop, reorder callback).
- `canvas/src/features/panels/views/preview-panel/ui/MermaidDiagram.tsx`: Mermaid render + fullscreen uses `PreviewOverlay` + `ZoomPanViewport` and derives content size from SVG `viewBox`; bottom-panel Markdown preview uses single-click to open the MainPanel Preview tab focused on the clicked diagram, and the Preview panel can promote that diagram into a fullscreen overlay for detailed inspection.
- `canvas/src/features/markdown/ui/MarkdownPreview.tsx`: Presentation Mode fullscreen uses `PreviewOverlay` + `ZoomPanViewport` + `PreviewGallery` to inspect and reorder slides; embeds MermaidDiagram for inline diagrams and routes single-click events on those diagrams to the Preview panel gallery.
- `canvas/src/features/panels/views/PreviewPanelView.tsx`: MainPanel “Preview Panel” tab that renders a 3x3, 16:9 media gallery for Markdown-derived Mermaid diagrams and safe rich media (images, video links, and whitelisted embeds). The gallery tiles show lightweight, non-interactive mini-previews (Mermaid code snippets or image snapshots) and a larger 16:9 stage below the grid renders the currently selected media or focused Mermaid diagram.

## Search & Toolbar
- `canvas/src/features/search/search.ts`: ranked search across nodes/edges.
- `canvas/src/features/toolbar/utils.ts`: cache wrapper (`graphId|historyIndex|query|limit`).
- `canvas/src/components/Toolbar.tsx`: zoom controls delegate to `onZoomIn`/`onZoomOut`/`onFit`/`onReset`/`onZoomSelection` props; Reset falls back to `useGraphStore.resetAll()` if `onReset` is not provided.
- `canvas/src/features/minimap/Minimap.tsx:19–21`: guards for `null` data to avoid errors on clean‑slate boot.

## Schema Helpers
- `canvas/src/features/schema-editor/utils.ts`: query normalization and filtering helpers.
- `canvas/src/features/schema/derive.ts`: LRU cache for node types and edge labels.
- `canvas/src/features/schema/schemaJsonLd.ts`: schema JSON-LD import/export; persists top-level `schema.metadata` and merges `schema.serialization.context` into `@context`.
- `canvas/src/features/schema/ui/SchemaUiEditor.tsx`, `canvas/src/features/schema/ui/SchemaUiEditorRows.tsx`: Schema UI editor rows, including the paired Metadata/Context JSON editors for shared provenance + JSON-LD context.

## File IO
- `canvas/src/lib/graph/file.ts`: open/save/export JSON/CSV; remembers last filename and format.

## Store Barrels
- `canvas/src/hooks/store/index.ts`: slice barrels for graph, selection, history, UI, canvas, schema.
- `canvas/src/lib/graph/index.ts`, `canvas/src/lib/ui/index.ts`: feature barrels to reduce import churn.
- `canvas/src/hooks/useGraphStore.ts:160–171`: `resetAll` performs full app reset (cancels minimap worker, clears edge creation and graph data — removes `kg:data`, resets history/selection/zoom/canvas render mode to `2d`, restores schema defaults, resets Parser UI state, and clears custom parser persistence `kg:parsers:custom`).

## Settings & Config
- `canvas/src/features/settings/registry.ts`: load flow details from `settings-flow.json` with safe parsing and offline guard.
- `canvas/src/features/panels/views/SettingsView.tsx`: settings panel with persisted collapse, apply/reset actions, and searchable details.
- `canvas/src/lib/config.ts`: constants with safe `ImportMeta` env reads, centralized `EXPORT_UI_LABELS` for toolbar copy/export buttons, `LS_KEYS`/`LS_LEGACY_KEYS` registries with `getLsKeyDiagnostics`, and Orchestrator/Render section diagnostics/Markdown table helpers used by the documentation sanity checks.
- `canvas/src/lib/config.copy.ts`: shared UI copy, anchors, and traversal/tooling tooltips. Exposes `UI_COPY`, `UI_LAYOUT`, `UI_ANCHORS`, `UI_LABELS`, and builders (`buildNumericTooltip`, `buildRoleActionOutcomeTooltip`, `buildSettingsAreaTooltip`) so panels can derive consistent labels and role→action→outcome tooltips instead of hard‑coding strings. Also centralizes high-churn panel strings like search placeholders and Graph Fields sync status messages. Orchestrator traversal, GraphRAG workflow, and DuckDB traversal helpers use the DuckDB/Orchestrator tooltip constants (for example `ORCHESTRATOR_TRAVERSAL_TOOLTIP`, `ORCHESTRATOR_TRAVERSAL_DELAY_ROW_TOOLTIP`, `TRAVERSAL_PRESETS_SECTION_TOOLTIP`, `TRAVERSAL_EDITOR_AND_LAYERS_SECTION_TOOLTIP`, `TRAVERSAL_SEQUENCE_TOOLTIP`, `DUCKDB_SQL_FIELD_TOOLTIP`, `DUCKDB_QUERY_PRESETS_TOOLTIP`, `DUCKDB_QUERY_PRESET_ID_TOOLTIP`, `DUCKDB_QUERY_PRESET_DESCRIPTION_TOOLTIP`, `GRAPHRAG_WORKFLOW_SUMMARY_TOOLTIP`, `AGENTIC_RAG_CONTEXT_IRI_TOOLTIP`, `ORCHESTRATOR_TRACING_OPTIONS_TOOLTIP`) so bottom‑panel Orchestrator sections, floating Graph Traversal panels, Renderer overlays, and AI‑KG layers all describe traversal delay, presets, and GraphRAG workflows using the same centralized copy.
- Chat configuration is treated as regular UI settings: `chatEndpointUrl`, `chatModel`, `chatTemperature`, and `chatSystemPrompt` are defined in the settings registry and stored via the shared UI slice in `useGraphStore`. The Canvas Side Panel Chat reads these values, assembles a neutral, metadata-driven prompt from the selected node’s properties and a section-aware markdown excerpt (expanded from `metadata.lineStart/lineEnd` to the nearest heading above and the next heading boundary while keeping fenced code blocks closed), and posts to a user-configured OpenAI-compatible `/v1/chat/completions` endpoint without introducing any special-case parser or renderer behavior. Conversation history is persisted per graph in `localStorage` (capped) and responses are streamed when the endpoint supports `text/event-stream`; a small connectivity indicator in the Chat panel reports whether the configured endpoint is reachable based on the last request, keeping error feedback local to the Chat surface while leaving Loader/Parser/Renderer behavior unchanged (`canvas/src/hooks/store/uiSlice.ts`, `canvas/src/features/settings/registry-ui.ui.ts`, `canvas/src/pages/Canvas.tsx`).
- `canvas/src/features/panels/views/graph-fields/FieldSamplesPanel.tsx`: Graph Fields “Samples” panel implementation. Uses a tri-state “Select all” checkbox (indeterminate when partially selected), reduces row DOM wrapper complexity, and avoids render-phase state update warnings by deferring “apply as select options” until after selection state updates.
- `canvas/src/features/panels/ui/KeyValueRow.tsx`: shared two-column Key/Value row primitive reused across MainPanel settings, BottomPanel Orchestrator/Render/Validate views, floating Graph Traversal panels, GraphRAG workflow, indexing, and AI‑KG layers/traversal controls to keep small panel summaries visually consistent no matter which surface they appear on. Traversal-related panels lean on KeyValueRow for presets and query parameters (start node id, max depth, label filters), while non‑traversal panels reuse it for compact settings and summary rows so “key → value” layouts look and behave the same across the app.
- `canvas/src/features/panels/ui/KeyTypeValueRow.tsx`: shared three-column Key/Type/Value row primitive used by the SettingsView header and each setting entry so settings keys, value types, and live values share the same layout and click target. This keeps the searchable Settings grid aligned with the JSON‑LD `kg:SettingsExport` schema (key, valueType, value) and lets AgenticRAG-aware docs treat Settings as a structured K/T/V table instead of ad-hoc grids.
- `canvas/src/features/panels/ui/TwoColumnEditorGrid.tsx`: shared two-column editor grid primitive that wraps paired editors or forms (for example, Template/Properties and Validation/Rules in the Schema UI editor, or the node-type / edge-label “Types” admin editors in the advanced Schema panel) so editor layouts use a consistent `grid grid-cols-2 gap-2` structure without duplicating Tailwind classes at each call site. It is intentionally scoped to “two big peers” (paired editors or admin panels) and not to general K/V rows or arbitrary multi-column grids, which continue to use `KeyValueRow` or local layout primitives, and is available to both main-panel and bottom-panel schema/admin surfaces as well as any future floating editor panels.

## Documentation & Registry Sanity
- `canvas/src/cli/doc-sanity-check.ts`: CLI that validates orchestrator and render section documentation tables, workflow preset tables, and settings registry docs by comparing the markdown in `docs/knowgrph-design-document.md` against the runtime registries (`getOrchestratorSectionDiagnostics`, `getOrchestratorSectionMarkdownTable`, `getRenderSectionDiagnostics`, `getRenderSectionMarkdownTable`, workflow presets, and settings registry/records).

  **Inline usage example (before/after)**

  Before (hand-rolled grid row):

  ```tsx
  <div className="grid grid-cols-2 gap-1 py-0.5 text-[11px]">
    <div className="flex items-center gap-1 text-gray-800">
      <span>Start node id</span>
    </div>
    <div className="flex items-center gap-2 text-gray-700">
      <input
        className="border border-gray-300 rounded px-1 py-0.5 text-[11px] w-40"
        type="text"
        value={traversalStartNodeId}
        onChange={e => setTraversalStartNodeId(e.target.value)}
      />
    </div>
  </div>
  ```

  After (using `KeyValueRow`):

  ```tsx
  <KeyValueRow
    label={<span>Start node id</span>}
    control={(
      <input
        className="border border-gray-300 rounded px-1 py-0.5 text-[11px] w-40"
        type="text"
        value={traversalStartNodeId}
        onChange={e => setTraversalStartNodeId(e.target.value)}
      />
    )}
  />
  ```
