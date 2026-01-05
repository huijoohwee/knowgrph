# Knowgrph selection semantics

This document describes how selection behaves across the 2D canvas, 3D view, and graph data table. The goal is that all views share the same mental model even though they render selection differently.

## Core selection model

- A single selection is represented by `selectedNodeId` and `selectedEdgeId`.
- At most one of these is non null at a time.
- Selection is global and shared by:
  - 2D canvas (`GraphCanvas`)
  - 3D view (`ThreeGraph`)
  - Node editor
  - Graph data table

There are two selection modes:

- Node selection: `selectedNodeId` is non null and `selectedEdgeId` is null.
- Edge selection: `selectedEdgeId` is non null and `selectedNodeId` is null.

Some behaviors are controlled by schema configuration:

- `schema.behavior?.expansion?.enabled` (default true) gates all expansion style behaviors.
- `schema.behavior?.expansion?.highlightNeighbors` (default true) controls neighbor highlighting for node selection.
- `schema.behavior?.expansion?.zoomOnSelection` (default true) controls zoom camera behavior when selection changes.

Unless a section below explicitly says otherwise, these flags are interpreted the same way in all views.

## Selection neighborhood semantics

Several features rely on the same notion of a selection neighborhood. The shared helpers live in `canvas/src/components/GraphCanvas/highlight.ts:7`.

Neighborhood is defined using the adjacency map:

- The adjacency map is built from all edges in the graph.
- For a node `N`, `neighbors(N)` are nodes connected to `N` by at least one edge.

The base helper is:

- `computeNeighborIds(params: SelectionHighlightParams): Set<string>`
  - When there is a node selection and `highlightNeighbors` is enabled:
    - Returns all neighbor node ids of the selected node.
  - When there is an edge selection:
    - Returns an empty set (edge selection does not compute neighbors).
  - When nothing is selected:
    - Returns an empty set.

The same `computeNeighborIds` implementation is used by:

- 2D canvas highlighting (`GraphCanvas`) for node fill and label opacity.
- 3D view (`ThreeGraph`) for node color and opacity.
- Graph data table for row background highlighting of neighbor nodes.

### Selection anchors and selection subgraphs

- Global selection is also exposed as selection anchor ids so all views can share the same “selection → subgraph” contract.
- The canonical anchor shape is `SelectionAnchorIds` defined in `canvas/src/lib/graph/types.ts` with fields `selectionNodeIds` and `selectionEdgeIds`.
- `normalizeSelectionIds` in `canvas/src/components/GraphCanvas/highlight.ts` converts the store’s `selectedNodeId` / `selectedEdgeId` plus multi‑select arrays into a `SelectionAnchorIds` value.
- `buildSelectionSubgraphForAnchorIds` in `canvas/src/lib/graph/file.ts` takes a `GraphData` plus `SelectionAnchorIds` and returns a selection subgraph containing:
  - All selected nodes and edges.
  - All nodes incident to the selected edges.
  - All edges incident to the selected nodes.
- The same `SelectionAnchorIds` → subgraph flow is reused by:
  - Canvas Embed/Overlay visualizations (`canvas/src/pages/Canvas.tsx`).
  - Dataset inspector mini‑visualizations (`canvas/src/features/panels/views/DatasetInspectorSection.tsx`).
  - Bottom panel Graph Data Table “Selection neighborhood” view (`canvas/src/components/BottomPanel/BottomPanelCuratorTabState.tsx`).

## Node selection behavior

This section covers the case `selectedNodeId !== null` and `selectedEdgeId === null`.

### 2D canvas visuals

Implementation reference: `canvas/src/components/GraphCanvas/highlight.ts:46`.

With a node selected and neighbor highlighting enabled:

- Selected node:
  - Fill: bright blue (`#3B82F6`).
  - Opacity: `1`.
- Neighbor nodes:
  - Fill: base fill color from node schema.
  - Opacity: `1`.
- Non neighbor nodes:
  - Fill: dim gray (`#9CA3AF`).
  - Opacity: `0.2`.

Labels follow the same structure:

- Selected and neighbor node labels opacity: `1`.
- Other labels opacity: `0.2`.

Edges:

- Edges incident to the selected node:
  - Stroke: bright blue (`#3B82F6`).
  - Opacity: `0.9`.
  - Width: `1.5x` base edge width derived from schema.
- All other edges:
  - Stroke: schema edge color.
  - Opacity: `0.2`.
  - Width: base edge width.

When nothing is selected:

- Nodes and labels use layer based opacity (`getLayerOpacity`) and schema colors.
- Edges use schema edge color and default opacity.

### 3D view visuals

Implementation references:

- Node selection state types: `canvas/src/features/three/selection.ts:3`.
- Node rendering: `canvas/src/features/three/ThreeGraph.tsx:88`.

For node selection:

- Selected node:
  - Color: `selectedEdgeColor` from schema three selection config, default `#3B82F6`.
  - Opacity: base layer opacity (optionally per layer).
  - Emissive glow:
    - Emissive color: same `selectedEdgeColor`.
    - Emissive intensity: `selectedNodeGlowIntensity` (default `0.8`).
- Neighbor nodes:
  - Color: base node color derived from schema and node properties.
  - Opacity: base layer opacity.
- All other nodes:
  - Color: dim gray (`#9CA3AF`).
  - Opacity: `baseLayerOpacity * dimmedNodeOpacity` where `dimmedNodeOpacity` defaults to `0.2`.

Edges:

- Edges incident to the selected node:
  - Color: `selectedEdgeColor` (default `#3B82F6`).
  - Opacity: at least `0.9` (clamped against configured edge opacity).
  - Width: at least `selectedEdgeWidth` (default `3`).
- Other edges:
  - Color: schema edge color for the label.
  - Opacity: `dimmedEdgeOpacity` (default `0.2`) or lower.
  - Width: reduced relative to selected width.

### Graph data table visuals

Implementation reference: `canvas/src/features/graph-data-table/ui/GraphDataTableTable.tsx:212`.

For node selection:

- Node rows:
  - Selected node row:
    - Background: `bg-blue-100`.
  - Neighbor node rows:
    - Background: `bg-blue-50`.
  - Other node rows:
    - Background alternates between `bg-white` and `bg-gray-50/50` for striping.
- Edge rows:
  - Edges incident to the selected node:
    - Background: `bg-blue-50`.
  - Other edges:
    - Background uses the same striping as non related node rows.

Active selection in the table (used for the row index checkbox and in cell editing) is only the single selected row, not all related rows.

## Edge selection behavior

This section covers the case `selectedNodeId === null` and `selectedEdgeId !== null`.

### 2D canvas visuals

Implementation reference: `canvas/src/components/GraphCanvas/highlight.ts:89`.

For edge selection:

- Node highlighting:
  - Endpoints of the selected edge:
    - Fill: base node fill color from schema.
    - Opacity: `1`.
  - Other nodes:
    - Fill: dim gray (`#9CA3AF`).
    - Opacity: `0.2`.
- Label highlighting:
  - Endpoints:
    - Opacity: `1`.
  - Other labels:
    - Opacity: `0.2`.
- Edge highlighting:
  - Selected edge:
    - Stroke: bright blue (`#3B82F6`).
    - Opacity: `0.9`.
    - Width: `1.5x` base width.
  - Other edges:
    - Stroke: neutral gray (`#999`).
    - Opacity: `0.2`.
    - Width: base width.

Neighbor ids are not computed for edge selection. The neighborhood based logic is only applied to node selection.

### 3D view visuals

Implementation references:

- Node rendering: `canvas/src/features/three/ThreeGraph.tsx:130`.
- Edge rendering: `canvas/src/features/three/ThreeGraph.tsx:447`.

For edge selection:

- Nodes:
  - Edge endpoints:
    - Color: base node color derived from schema.
    - Opacity: base layer opacity.
  - Other nodes:
    - Color: dim gray (`#9CA3AF`).
    - Opacity: `baseLayerOpacity * dimmedNodeOpacity`.
- Edges:
  - Selected edge:
    - Color: `selectedEdgeColor` from three selection config (default `#3B82F6`).
    - Opacity: at least `0.9`.
    - Width: `selectedEdgeWidth` (default `3`) or larger.
  - Other edges:
    - Color: neutral gray (`#999999`).
    - Opacity: `dimmedEdgeOpacity` (default `0.2`) or lower.
    - Width: reduced relative to selected width.

### Graph data table visuals

For edge selection:

- Edge rows:
  - Selected edge row:
    - Background: `bg-blue-100`.
  - Other edges:
    - Background: striping between `bg-white` and `bg-gray-50/50`.
- Node rows:
  - Endpoint node rows:
    - Background: `bg-blue-50`.
  - Other node rows:
    - Background: striping between `bg-white` and `bg-gray-50/50`.

As with node selection, only the selected row is considered active for selection controls in the table.

Users configure how graph nodes and edges map onto table columns, row density, and the frozen‑area boundary via the Graph Fields tab and Graph Data Table settings; the persisted LocalStorage keys and AgenticRAG JSON‑LD representation of this mapping are documented in the “Graph Data Table Frozen Area” row and “Graph Data Table behavior JSON‑LD example (codebase index)” section of `docs/knowgrph-schema-document.md`.

## Selection based zoom semantics

Selection based zoom uses a shared helper to compute the set of node ids that the camera or SVG viewport should fit.

Implementation references:

- Shared zoom logic: `canvas/src/components/GraphCanvas/selectionZoom.ts:23`.
- 2D canvas zoom: `canvas/src/components/GraphCanvas.tsx:295`.
- 3D camera zoom: `canvas/src/features/three/camera.ts:20`.

`computeZoomTargetNodeIds` implements the shared rules:

- No selection:
  - Returns an empty set.
- Node selection:
  - Target ids are the selected node plus all of its neighbors.
- Edge selection:
  - Find the selected edge and its endpoints `S` and `T`.
  - Target ids are:
    - `S`
    - `T`
    - All neighbors of `S`
    - All neighbors of `T`

`computeZoomSubset` converts the ids returned by `computeZoomTargetNodeIds` into the corresponding node subset for the 2D canvas.

2D canvas applies zoom on selection when:

- `schema.behavior?.expansion?.enabled !== false`
- and `schema.behavior?.expansion?.zoomOnSelection !== false`

3D view uses the same logic via `collectFitIds` and `fitCameraToPositions`, and is gated by the same schema flags.

## Selection export semantics

Graph selection export uses similar semantics but is intentionally slightly more conservative than zoom.

## Graph data table frozen area semantics

The graph data table exposes a frozen area for the first data column. The goal is to make the table behave like a spreadsheet while keeping header and body semantics aligned with AgenticRAG‑style anchors.

- Freeze mode is represented by a `GraphDataTableFreezeMode` value `'none' | 'label' | 'id'`.
- Scope‑specific freeze modes are stored under `LS_KEYS.graphDataTableFreezeFirstDataColumnByScope` using a JSON object `{ all, nodes, edges }`.
- `useGraphDataTableFrozenArea` owns all drag semantics:
  - Tracks drag start position, initial mode, and available modes based on the current `orderedVisibleColumnKeys`.
  - Maps horizontal drag distance to discrete mode transitions using `graphDataTableFrozenDragStepNoneLabelPx` and `graphDataTableFrozenDragStepLabelIdPx` from the store.
  - Resolves a single frozen boundary column key (either `label` or `id`) and keeps header cells and body cells in sync via the same sticky offset.
- The resize handle rendered by `FrozenAreaResizeHandle` is the only way to change freeze mode; header context menus and row interactions never mutate freeze semantics directly.
- Dragging does not affect selection behavior: row striping and neighbor highlighting continue to follow the global selection semantics described above, and the frozen column only changes layout, not which rows count as selected or related.

Implementation reference: `canvas/src/lib/graph/file.ts:47`.

For node selection:

- Include the selected node.
- Include all neighbors of the selected node.
- Include all edges incident to the selected node.

For edge selection:

- Include the selected edge.
- Include the endpoints of the selected edge.
- Do not expand via neighbor of neighbor.

This ensures exported subgraphs match what users see emphasized in the views, while keeping exports compact.

## Selection performance instrumentation

Selection updates in each view emit timing samples to a shared custom event `kg-selection-perf`. These are surfaced in the status bar and can be toggled in development.

Implementation references:

- Shared helpers: `canvas/src/lib/selectionPerf.ts:1`.
- Status bar listener: `canvas/src/components/StatusBar.tsx:8`.
- 2D canvas selection timing: `canvas/src/components/GraphCanvas.tsx:242`.
- Graph data table auto scroll timing: `canvas/src/features/graph-data-table/ui/GraphDataTableTable.tsx:552`.
- 3D camera timing: `canvas/src/features/three/ThreeGraph.tsx:560`.

Behavior:

- When perf tracking is enabled via the status bar, selection updates do the following:
  - Record a timestamp before running selection update logic or camera fitting.
  - Record another timestamp afterward.
  - Dispatch a `kg-selection-perf` event with:
    - `subscriber`: one of `canvas`, `three`, `nodeEditor`, `graphDataTable`.
    - `durationMs`: measured duration.
    - `ts`: event timestamp.
- The status bar aggregates these samples and shows per subscriber last and average duration.

All three main views (2D canvas, 3D view, and graph data table) are wired into this shared selection performance instrumentation and use the same event format.

## Layer modes and semantic similarity controls

Layer semantics are controlled by `schema.layers` and related renderer settings. These fields drive how polygons, overlays, and AI‑KG layer bands group nodes during traversal playback.

- `schema.layers.mode` selects the active grouping mode:
  - `property` – derive groups from array‑valued node properties (for example tags or facets) so layers follow metadata attached to each node.
  - `document-structure` – derive groups from node type so layers follow structural roles such as `Document`, `Section`, `Block`, or `Item`, while rendering these structural container node types as normal nodes (not replacing them with block‑type polygons). In this mode, downstream layer derivation assigns a non‑polygon **type band** per structural role by mapping node types to `node.properties['visual:layer']` (for example `Document`/`Section` to layer `3`, `Paragraph`/`Table`/`List` to layer `2`, and `CodeBlock`/`ListItem` to layer `1`). The 2D and 3D renderers then read `three.layerOpacityByLayer['1' | '2' | '3']` to control foreground/mid/background band opacity without changing node shapes.
  - `semantic` – derive groups from a similarity graph built over weighted semantic edges.
- `schema.layers.documentStructure.minGroupSize` controls the minimum number of nodes required for a derived group when using `document-structure` or `semantic` modes; groups smaller than this threshold are merged back into the base polygons so the layer bands stay readable.
- In `semantic` mode, structural container node types such as `Document`, `Section`, `Paragraph`, `CodeBlock`, `Table`, `List`, and `ListItem` are treated as layer surfaces rather than standalone circles: the 2D canvas and 3D view hide these types as individual nodes and instead derive convex hull polygons from JSON‑LD arrays, type‑based document‑structure groups, and semantic communities so AI‑KG bands follow document blocks and semantic groupings while staying schema‑driven.

For a concrete, screenshot‑oriented example, the visualization catalog shows how an AgenticRAG codebase index workflow renders the same graph under **property**, **document‑structure**, and **semantic** modes using one shared node/edge color palette, while document‑structure mode drives non‑polygon type bands and semantic mode layers convex hull polygons and similarity overlays on top (see “AI‑KG Layer Modes Details” in `knowgrph-visualization-document.md`).

When `schema.layers.mode === 'semantic'`, the semantic layer uses `schema.layers.semantic` to turn a dense similarity graph into communities:

- `schema.layers.semantic.similarityEdgeLabel` chooses which edge label counts as a semantic similarity edge. Only edges with this label and a positive weight participate in the semantic layer.
- `schema.layers.semantic.similarityMetric` selects how edge weights are interpreted:
  - `cosine` – treat weights as embedding cosine similarity scores.
  - `pmi` – treat weights as pointwise mutual information (PMI) scores.
- `schema.layers.semantic.topKEdgesPerNode` sets a per‑node sparsity control. For each node, only the top‑K strongest similarity edges are kept before community detection; higher values retain more neighbors, while `0` disables per‑node pruning.
- `schema.layers.semantic.minSimilarity` applies a global similarity threshold. Edges with weights below this value are dropped before running Louvain community detection. Defaults are tuned to the metric:
  - cosine: approximately `0.2`.
  - pmi: approximately `0.15`.

### Bottom panel codebase path provenance

- The Graph Data Table surfaces a dedicated **Codebase path** column backed by `metadata.codebasePath` so curators can inspect and filter provenance deep-links directly in the table.
- Canvas no longer opens external files inside the bottom panel editor; `codebasePath` values are displayed as plain text and kept aligned with AgenticRAG provenance and traversal documentation.
- Repository-relative `codebasePath` values still serve as stable hooks for external tools and dev-server helpers that resolve real files via `/@fs` URLs using the configured `VITE_CODEBASE_ROOT`, but these lookups now occur outside the core canvas UI.

Algorithm overview (dataset‑agnostic, schema‑driven):

- Tokenization and per‑node vectors:
  - Normalize label and configured text fields into a single string per node.
  - Lowercase and split on non‑alphanumeric separators.
  - Drop short tokens and configured stopwords.
  - Count token frequencies per node and compute the Euclidean norm of the frequency vector.
- Pairwise similarity (cosine or PMI):
  - Build an inverted index from token → list of (node, count).
  - For each token, update dot products between all node pairs that share the token.
  - Cosine: `similarity(a,b) = dot(a,b) / (‖a‖ · ‖b‖)`; ignore non‑positive or non‑finite scores.
  - PMI: estimate `pi`, `pj`, `pij` from token counts and total tokens, then compute `log2(pij / (pi · pj))`; clamp negative values to zero and ignore non‑positive or non‑finite scores.
- Top‑K pruning and thresholding:
  - For each node, collect neighbor candidates from the similarity map.
  - Sort candidates by descending similarity, with a stable tie‑break on neighbor id.
  - Optionally keep a small multiple of `topKEdgesPerNode` as a local pool, then accept up to `topKEdgesPerNode` neighbors whose similarity is at least `minSimilarity`.
  - Store accepted undirected pairs in a set keyed by sorted node id pair so the similarity graph remains symmetric.
- Derived edge weights and visual semantics:
  - For each accepted pair, create a derived similarity edge with:
    - `label = schema.layers.semantic.similarityEdgeLabel`.
    - `properties.weight` equal to the similarity score (cosine or PMI).
    - `properties.count` equal to the token‑level co‑occurrence count used during scoring.
    - `properties.width` and `properties['visual:width']` derived from the square root of the co‑occurrence count, clamped into a small numeric band.
    - `properties['visual:weight']` mirroring the similarity score so the renderer can use `edgeWidthFormula: 'weight'` to scale edge thickness.
  - Accumulate `visual:weight` per node to support importance calculations when token counts are unavailable.
- Community detection (Louvain‑style, resolution‑aware):
  - Interpret the similarity graph as an undirected, weighted graph.
  - Initialize each node in its own community and precompute weighted degrees and total edge weight.
  - For a configurable number of passes, repeatedly:
    - For each node, temporarily remove it from its current community.
    - Aggregate incident weights by neighboring community.
    - For each neighboring community, estimate a modularity gain term using `k_in` (sum of weights into that community), the community’s total degree, the node’s degree, the total edge weight, and a configurable resolution factor.
    - Move the node to the community with the highest positive gain (subject to a small numerical tolerance) and update community totals.
  - Stop when no node moves or a maximum pass/move budget is reached.
  - Remap raw community ids into a dense `0..N-1` range to keep downstream styling compact.
- Node‑level importance and visual fields:
  - For each node, derive an importance scalar using either:
    - Total token count when tokenization produced a non‑zero vector, or
    - Sum of incident similarity weights when no tokens were present.
  - Map importance to a node radius band using a square‑root scaling inside a clamped numeric range so very large differences remain readable.
  - Attach the following derived properties to each node:
    - `visual:importance` (scalar importance score).
    - `visual:nodeSize` (radius used when the renderer is configured to respect importance).
    - `visual:community` (integer community identifier) when community detection is enabled.
    - `visual:fill` (community color) computed from a deterministic hue mapping that treats community id as input without encoding dataset‑specific meaning. Renderers treat this as a community or overlay color (for example for semantic polygons and layer bands); base node circles keep their schema‑driven `nodeStyles` palette in all `schema.layers.mode` values so switching between `property`, `document-structure`, and `semantic` does not change the underlying node/edge color palette.

Renderer‑specific knobs under the AI‑KG layers controls coordinate with these semantics:

- `three.layerOpacityByLayer['1' | '2' | '3']` controls per‑band opacity for foreground, mid, and background layers so traversal overlays can highlight paths without losing context.
- `schema.three.nodeSizingFormula` switches between type‑based node sizes (`schema`) and importance‑weighted sizes (`importance`), which rely on `visual:importance` to make key concepts stand out in dense semantic clusters.
- `schema.three.edgeWidthFormula` switches between label‑based edge widths (`schema`) and weight‑based widths (`weight`) so stronger relations appear visually bolder along traversal paths.

These fields are surfaced in the AI‑KG Layers section of the Orchestrator view and, for `schema.layers.mode`, in the Renderer settings and FloatingPanel. The same JSON‑LD configuration is reused by offline AgenticRAG workflows so code, UI, and pipeline behavior stay aligned.

## Semantic-frame tooltip phrasing for AgenticRAG

Semantic-frame tooltips that describe AgenticRAG behavior should follow a concise `Role → Actions → Outcome` chain so UI copy stays aligned with JSON‑LD and schema semantics. The canonical helper for this shape is `buildRoleActionOutcomeTooltip` in `canvas/src/lib/config.ts`, which takes `{ role, actions, outcome }` and joins them with `→` separators:

- Start with the surface `Role` (`Orchestrator`, `Graph Fields`, `Renderer`) rather than an imperative sentence.
- Use one or two short `Actions` clauses, separated by `→`, that describe what the surface does over AgenticRAG data or GraphRAG paths.
- End with an `Outcome` clause that states the user benefit or artifact (`consistent analysis and sharing`, `aligned table mapping`, `stable traversal playback`).
- When a tooltip refers to a specific AgenticRAG path or context, mirror the JSON‑LD description fields (`query`, `traverse`, `context`) rather than restating file paths.
- Keep the full tooltip under 50 words, avoid implementation details (function names, filenames), and prefer schema and UI terms that match the rest of the documentation.

Numeric value tooltips for sliders and inputs should use the shared `buildNumericTooltip` helper in `canvas/src/lib/config.ts`. This helper takes `{ defaultValue, min?, max?, interval?, impact }` and produces a `Default/Min/Max/Interval + impact` string so knobs like traversal delay, chunk size, max hops, and 3D renderer tuning controls (edges, layout, background, starfield, camera, and selection) stay consistent across panels.

For traversal label filters that behave like precision/recall controls (for example, the `traversalLabelFilter` row shared by Render, Orchestrator, and FloatingPanel Graph Traversal), copy should make this explicit: an empty filter defaults to higher recall (all edge labels), while comma-separated label lists increase precision by narrowing which relations are traversed.

Example pattern:

- The canonical Orchestrator tooltip copy is defined as `ORCHESTRATOR_TRAVERSAL_TOOLTIP` in `canvas/src/lib/config.ts`. It follows the `Role → Actions → Outcome` pattern and is reused by the toolbar, spotlight, and help surfaces rather than duplicating the string.
- The Graph Fields icon legend tooltip copy is defined as `GRAPH_FIELDS_ICON_LEGEND_TOOLTIP` in `canvas/src/lib/config.ts` and applies the same pattern for Graph Fields semantics so icon badges, table behavior, and documentation stay aligned. This helper now uses `buildRoleActionOutcomeTooltip` with the Graph Fields JSON‑LD fixture as the source of truth.
- The Workflow links helper is defined as `WORKFLOW_LINKS_TOOLTIP` in `canvas/src/lib/config.ts` and keeps the Workflow links help card aligned with the 8‑stage GraphRAG pipeline and AgenticRAG JSON‑LD exports. It is also wired through `buildRoleActionOutcomeTooltip` against its JSON‑LD fixture so Role → Actions → Outcome phrasing stays schema‑aligned.
- The Agentic reasoning labels helper is defined as `AGENTIC_REASONING_LABELS_TOOLTIP` in `canvas/src/lib/config.ts:397` and keeps Workflow, Orchestrator, and Renderer stage labels aligned with the Agentic GraphRAG pipeline described in `docs/knowgrph-raci-document.md`.
- The `graphRAGPath` metadata helper is defined as `GRAPHRAG_PATH_METADATA_TOOLTIP` in `canvas/src/lib/config.ts:400` and explains how Canvas, parser scripts, and the codebase index JSON‑LD stay aligned for Agentic GraphRAG traversal.
- The Graph Fields Graph Data Table mapping helper is defined as `GRAPH_FIELDS_GRAPH_DATA_TABLE_MAPPING_TOOLTIP` in `canvas/src/lib/config.ts:403` and keeps the Graph Fields header tooltip aligned with the Graph Data Table frozen area and behavior JSON‑LD examples described in this document and in `docs/knowgrph-schema-document.md`.
- The panel tour Graph Data Table location helper is defined as `PANEL_TOUR_GRAPH_DATA_TABLE_LOCATION` in `canvas/src/lib/config.ts:408` and keeps Help “Panel tour” descriptions aligned with the actual bottom panel Curation tab layout and Curation toolbar behavior.
- The Graph Data Table curation helper is defined as `GRAPH_DATA_TABLE_CURATION_TOOLTIP` in `canvas/src/lib/config.ts:411` and keeps the toolbar Tools menu curator entry aligned with Graph Data Table export behavior and the AgenticRAG-ready codebase index pipeline.
- The Workflow step 3 Parser helper is defined as `WORKFLOW_STEP3_PARSER_TOOLTIP` in `canvas/src/lib/config.ts:416` and keeps the Workflow tab’s Parser section aligned with ingest presets, example datasets, and the `workflow-step3-parser-role-action-outcome.jsonld` fixture.
- The Workflow step 6 Orchestrator helper is defined as `WORKFLOW_STEP6_ORCHESTRATOR_TOOLTIP` in `canvas/src/lib/config.ts:419` and keeps the Workflow tab’s Agentic reasoning step aligned with Orchestrator presets, the codebase index pipeline button, and the `workflow-step6-orchestrator-role-action-outcome.jsonld` fixture.
- The Workflow step 8 bottom tabs helper is defined as `WORKFLOW_STEP8_BOTTOM_TABS_TOOLTIP` in `canvas/src/lib/config.ts:422` and keeps the Workflow exports section aligned with the bottom panel Data, Table, and Render tabs and the `workflow-step8-bottom-tabs-role-action-outcome.jsonld` fixture.
- The traversal preset UI helper is defined as `TRAVERSAL_PRESET_UI_TOOLTIP` in `canvas/src/lib/config.ts:425` and keeps the Render panel traversal controls aligned with Agentic GraphRAG traversal presets and the `traversal-preset-ui-role-action-outcome.jsonld` fixture.
- The Canvas cheatsheet helper is defined as `HELP_CHEATSHEET_ALIGNMENT_TOOLTIP` in `canvas/src/lib/config.ts:428` and keeps the Help cheatsheet section aligned with selection modes, bottom panel behavior, and the `help-cheatsheet-alignment-role-action-outcome.jsonld` fixture.
- The markdown pipeline entry points helper is defined as `HELP_CODEBASE_INDEX_ENTRY_POINTS_TOOLTIP` in `canvas/src/lib/config.ts:431` and keeps Help guidance about where to run the markdown→graph pipeline aligned with the `help-codebase-index-entry-points-role-action-outcome.jsonld` fixture.

In addition to these tooltip helpers, the Orchestrator bottom-panel section list is centralized in `canvas/src/features/panels/config.ts:127` via `getOrchestratorSectionListLabel`. Help copy, workflow step descriptions, ADRs and design docs, and the docs referenced in `docs/knowgrph-documentation-document.md` and `docs/knowgrph-schema-document.md` treat this helper as the single source of truth for the traversal presets, Traversal sequence, AgenticRAG node inspector, and AgenticRAG context and ignore filters list so the same AgenticRAG section names stay consistent across UI and documentation.

The Role → Actions → Outcome tooltips are also representable as JSON‑LD entries using the AgenticRAG `RoleActionOutcome` schema defined in `huijoohwee.github.io/schema/AgenticRAG/roles-actions-outcomes-schema.jsonld`. For example, the canonical Orchestrator tooltip fixture is stored at `schema-config/orchestrator-role-action-outcome.jsonld` and can be encoded as:

```jsonld
{
  "@context": "https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld",
  "@type": "rag:RoleActionOutcome",
  "role": "Orchestrator",
  "actions": [
    "execute AgenticRAG traversal presets and edit GraphRAG paths",
    "adjust traversal delay and view mode via bottom panel and Settings → Orchestrator"
  ],
  "outcome": "deliver controlled, customizable graph navigation for consistent analysis and sharing",
  "pipeline_phase": "Agentic Reasoning",
  "ui_anchor": "toolbar:orchestrator",
  "raci_role": "Orchestrator"
}
```

This Orchestrator `RoleActionOutcome` fixture is also exercised by a schema‑driven copy test in `canvas/src/__tests__/orchestratorCopy.test.ts`. The test reads the shared `schema-config/orchestrator-role-action-outcome.jsonld` file, treats the JSON‑LD object as the single source of truth, and asserts that `ORCHESTRATOR_TRAVERSAL_TOOLTIP` starts with the same `role`, includes every `actions[]` entry, and contains the exact `outcome` string so changing the JSON‑LD fixture automatically drives tooltip validation without duplicating copy.

Similarly, the Graph Fields Graph Data Table mapping tooltip can be represented as:

```jsonld
{
  "@context": "https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld",
  "@type": "rag:RoleActionOutcome",
  "role": "Graph Fields",
  "actions": [
    "define node and edge field metadata, JSON-LD roles, and Graph Data Table mapping",
    "sync column visibility, frozen areas, and samples with schema presets"
  ],
  "outcome": "keep Graph Data Table behavior and AgenticRAG JSON-LD table mapping aligned with schema presets",
  "pipeline_phase": "UI Curation",
  "ui_anchor": "mainPanel:graphFieldsHeader",
  "raci_role": "Schema"
}
```

These JSON‑LD snippets are not required for runtime behavior but serve as canonical, machine‑readable representations of UI copy. They keep AgenticRAG documentation, RACI catalogs, and Knowgrph UI tooltips aligned around the same Role → Actions → Outcome semantics. Additional fixtures in `schema-config/*.jsonld` capture the Graph Data Table curation helper, Workflow links, Agentic reasoning labels, `graphRAGPath` metadata, Workflow step tooltips, traversal preset UI helper, Canvas cheatsheet, and codebase index entry points, all of which are validated against their corresponding tooltip constants by tests in `canvas/src/__tests__/orchestratorCopy.test.ts`.

#### Fixtures index by RACI role

For quick lookup from a RACI perspective, these `rag:RoleActionOutcome` fixtures and tooltip helpers are organized by role:

- Parser:
  - Tooltip/helper: `WORKFLOW_STEP3_PARSER_TOOLTIP`
  - Fixture: `schema-config/workflow-step3-parser-role-action-outcome.jsonld`
- Curator:
  - Tooltips/helpers: `GRAPH_DATA_TABLE_CURATION_TOOLTIP`, `WORKFLOW_STEP8_BOTTOM_TABS_TOOLTIP`
  - Fixtures: `schema-config/graph-data-table-curation-role-action-outcome.jsonld`, `schema-config/workflow-step8-bottom-tabs-role-action-outcome.jsonld`
- Orchestrator:
  - Tooltips/helpers: `ORCHESTRATOR_TRAVERSAL_TOOLTIP`, `WORKFLOW_STEP6_ORCHESTRATOR_TOOLTIP`, `TRAVERSAL_PRESET_UI_TOOLTIP`, `WORKFLOW_LINKS_TOOLTIP`, `AGENTIC_REASONING_LABELS_TOOLTIP`, `HELP_CHEATSHEET_ALIGNMENT_TOOLTIP`, `WORKFLOW_INDEXING_PARAMETERS_TOOLTIP`, `GRAPHRAG_WORKFLOW_SUMMARY_TOOLTIP`, `AGENTIC_RAG_CONTEXT_IRI_TOOLTIP`, `ORCHESTRATOR_TRACING_OPTIONS_TOOLTIP`, `TRAVERSAL_PRESETS_SECTION_TOOLTIP`, `TRAVERSAL_EDITOR_AND_LAYERS_SECTION_TOOLTIP`, `TRAVERSAL_SEQUENCE_TOOLTIP`, `WORKFLOW_TAB_HEADER_TOOLTIP`, `HELP_TAB_HEADER_TOOLTIP`, `SETTINGS_TAB_HEADER_TOOLTIP`, `DUCKDB_SQL_FIELD_TOOLTIP`
  - Fixtures: `schema-config/orchestrator-role-action-outcome.jsonld`, `schema-config/workflow-step6-orchestrator-role-action-outcome.jsonld`, `schema-config/traversal-preset-ui-role-action-outcome.jsonld`, `schema-config/workflow-links-role-action-outcome.jsonld`, `schema-config/agentic-reasoning-labels-role-action-outcome.jsonld`, `schema-config/help-cheatsheet-alignment-role-action-outcome.jsonld`, `schema-config/workflow-indexing-parameters-role-action-outcome.jsonld`, `schema-config/graphrag-workflow-summary-role-action-outcome.jsonld`, `schema-config/agenticrag-context-iri-role-action-outcome.jsonld`, `schema-config/orchestrator-tracing-options-role-action-outcome.jsonld`, `schema-config/traversal-presets-section-role-action-outcome.jsonld`, `schema-config/traversal-editor-and-layers-section-role-action-outcome.jsonld`, `schema-config/workflow-tab-header-role-action-outcome.jsonld`, `schema-config/help-tab-header-role-action-outcome.jsonld`, `schema-config/settings-tab-header-role-action-outcome.jsonld`
- Schema:
  - Tooltips/helpers: `GRAPH_FIELDS_ICON_LEGEND_TOOLTIP`, `GRAPH_FIELDS_GRAPH_DATA_TABLE_MAPPING_TOOLTIP`
  - Fixtures: `schema-config/graph-fields-icon-legend-role-action-outcome.jsonld`, `schema-config/graph-fields-table-mapping-role-action-outcome.jsonld`
- Indexers:
  - Tooltips/helpers: `HELP_CODEBASE_INDEX_ENTRY_POINTS_TOOLTIP`, `GRAPHRAG_PATH_METADATA_TOOLTIP`
  - Fixtures: `schema-config/help-codebase-index-entry-points-role-action-outcome.jsonld`, `schema-config/graphrag-path-metadata-role-action-outcome.jsonld`

#### Fixtures index by file and UI surface

For cross-referencing between `schema-config/` fixtures, tooltip helpers in `canvas/src/lib/config.ts`, and UI surfaces, this table maps each `rag:RoleActionOutcome` file to its helper and primary surface:

| RAO fixture file                                      | Helper constant                          | Primary UI surface                                                                                   |
|-------------------------------------------------------|------------------------------------------|------------------------------------------------------------------------------------------------------|
| `orchestrator-role-action-outcome.jsonld`             | `ORCHESTRATOR_TRAVERSAL_TOOLTIP`         | Toolbar Orchestrator button tooltip and Orchestrator-related help text                               |
| `graph-fields-icon-legend-role-action-outcome.jsonld` | `GRAPH_FIELDS_ICON_LEGEND_TOOLTIP`       | Graph Fields icon legend and Help tab                                                                |
| `graph-fields-table-mapping-role-action-outcome.jsonld` | `GRAPH_FIELDS_GRAPH_DATA_TABLE_MAPPING_TOOLTIP` | Graph Fields header tooltip and Graph Fields ↔ Graph Data Table mapping help                         |
| `graph-data-table-curation-role-action-outcome.jsonld` | `GRAPH_DATA_TABLE_CURATION_TOOLTIP`      | Graph Data Table curation toolbar and Tool menu description                                          |
| `workflow-links-role-action-outcome.jsonld`           | `WORKFLOW_LINKS_TOOLTIP`                 | Workflow links help card and Workflow/Help alignment guidance                                        |
| `agentic-reasoning-labels-role-action-outcome.jsonld` | `AGENTIC_REASONING_LABELS_TOOLTIP`       | Agentic reasoning stage labels across Workflow, Orchestrator, and Renderer                           |
| `graphrag-path-metadata-role-action-outcome.jsonld`   | `GRAPHRAG_PATH_METADATA_TOOLTIP`         | graphRAGPath metadata helper in Help and Orchestrator traversal documentation                        |
| `workflow-step3-parser-role-action-outcome.jsonld`    | `WORKFLOW_STEP3_PARSER_TOOLTIP`          | Workflow step 3 Parser tab tooltip                                                                    |
| `workflow-step6-orchestrator-role-action-outcome.jsonld` | `WORKFLOW_STEP6_ORCHESTRATOR_TOOLTIP`   | Workflow step 6 Orchestrator tooltip                                                                  |
| `workflow-step8-bottom-tabs-role-action-outcome.jsonld` | `WORKFLOW_STEP8_BOTTOM_TABS_TOOLTIP`    | Workflow step 8 bottom tabs tooltip (Data/Table/Render exports section)                              |
| `traversal-preset-ui-role-action-outcome.jsonld`      | `TRAVERSAL_PRESET_UI_TOOLTIP`            | Render traversal preset helper under traversal controls                                              |
| `help-cheatsheet-alignment-role-action-outcome.jsonld` | `HELP_CHEATSHEET_ALIGNMENT_TOOLTIP`     | Canvas cheatsheet helper for selection modes and bottom panel alignment                              |
| `help-codebase-index-entry-points-role-action-outcome.jsonld` | `HELP_CODEBASE_INDEX_ENTRY_POINTS_TOOLTIP` | Help markdown pipeline entry points card and pipeline command guidance                               |
| `workflow-indexing-parameters-role-action-outcome.jsonld` | `WORKFLOW_INDEXING_PARAMETERS_TOOLTIP` | GraphRAG workflow indexing section in Orchestrator bottom panel (dataset, chunking, embedding, maxHops) |
| `graphrag-workflow-summary-role-action-outcome.jsonld` | `GRAPHRAG_WORKFLOW_SUMMARY_TOOLTIP`     | GraphRAG workflow summary row above workflow fields in Orchestrator bottom panel                     |
| `agenticrag-context-iri-role-action-outcome.jsonld`   | `AGENTIC_RAG_CONTEXT_IRI_TOOLTIP`       | AgenticRAG context IRI row in Orchestrator AgenticRAG context and ignore filters section             |
| `orchestrator-tracing-options-role-action-outcome.jsonld` | `ORCHESTRATOR_TRACING_OPTIONS_TOOLTIP` | Tracing options collapsible section title under Orchestrator traversal controls                      |
| `traversal-presets-section-role-action-outcome.jsonld` | `TRAVERSAL_PRESETS_SECTION_TOOLTIP`     | Traversal presets and helpers section title in Orchestrator traversal stack                          |
| `traversal-editor-and-layers-section-role-action-outcome.jsonld` | `TRAVERSAL_EDITOR_AND_LAYERS_SECTION_TOOLTIP` | Traversal editor and layers section title in Orchestrator traversal stack                        |
| `traversal-sequence-role-action-outcome.jsonld`        | `TRAVERSAL_SEQUENCE_TOOLTIP`           | Traversal sequence section title and tooltip in Orchestrator traversal stack                         |
| `duckdb-sql-field-role-action-outcome.jsonld`          | `DUCKDB_SQL_FIELD_TOOLTIP`             | DuckDB SQL field row tooltip in traversal helper presets panel                                       |
| `workflow-tab-header-role-action-outcome.jsonld`        | `WORKFLOW_TAB_HEADER_TOOLTIP`          | Workflow tab header tooltip in the main panel                                                     |
| `help-tab-header-role-action-outcome.jsonld`            | `HELP_TAB_HEADER_TOOLTIP`              | Help tab header tooltip in the main panel                                                         |
| `settings-tab-header-role-action-outcome.jsonld`        | `SETTINGS_TAB_HEADER_TOOLTIP`          | Settings tab header tooltip in the main panel                                                     |
|
### Copy helper registry (top phrases)

Descriptions here are summaries; see `canvas/src/lib/config.ts` for canonical strings.

| Helper constant                                | Surface / role                        | Canonical phrase or summary                                                                                                                        |
|-----------------------------------------------|---------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| `ORCHESTRATOR_AGENTIC_COPY`                   | AgenticRAG node inspector and context | Canonical title, tooltips, empty-state, and context phrases for AgenticRAG node inspector, AgenticRAG schema/context/dataset labels, graphRAGPath IRI label and legend text, traversal metadata missing text, codebasePath provenance, and AgenticRAG context and ignore filters shared across bottom-panel Orchestrator and documentation. |
| `ORCHESTRATOR_TRAVERSAL_TOOLTIP`              | Orchestrator traversal                | Orchestrator → AgenticRAG traversal presets and GraphRAG paths → controlled, repeatable graph navigation.                                         |
| `GRAPH_FIELDS_ICON_LEGEND_TOOLTIP`            | Graph Fields icon legend              | Graph Fields icon legend → scope/origin/visibility/field‑type badges → align UI badges with AgenticRAG node and edge properties.                  |
| `WORKFLOW_LINKS_TOOLTIP`                      | Workflow links card                   | Workflow links → jump into Workflow and Graph Fields tabs mapped to the 8‑stage GraphRAG pipeline.                                                |
| `AGENTIC_REASONING_LABELS_TOOLTIP`            | Agentic reasoning labels              | Agentic reasoning labels → mirror the Agentic GraphRAG pipeline so Workflow, Orchestrator, and Renderer share the same stage labels.             |
| `GRAPHRAG_PATH_METADATA_TOOLTIP`              | graphRAGPath metadata helper          | graphRAGPath metadata → capture end‑to‑end GraphRAG paths so Canvas, parser scripts, and JSON‑LD index stay aligned.                             |
| `GRAPH_FIELDS_GRAPH_DATA_TABLE_MAPPING_TOOLTIP` | Graph Fields ↔ Graph Data Table mapping | Graph Fields → field metadata and Graph Data Table mapping → keep column visibility, frozen areas, and samples aligned with schema presets.      |
| `GRAPH_DATA_TABLE_CURATION_TOOLTIP`           | Graph Data Table curation             | Graph Data Table → curate, filter, and export node and edge records as JSON, AgenticRAG JSON‑LD, or CSV snapshots.                               |
| `PANEL_TOUR_GRAPH_DATA_TABLE_LOCATION`        | Help “Panel tour”                     | Canvas UI organized into toolbar, main panel, bottom panel; Graph Data Table in bottom panel Curation tab as spreadsheet‑like node/edge view.    |
| `WORKFLOW_STEP3_PARSER_TOOLTIP`               | Workflow step 3 Parser helper         | Parser tab → load parser specs, apply presets, and run ingest flows → keep CSV/JSON inputs mapped predictably into AgenticRAG GraphData.         |
| `WORKFLOW_STEP6_ORCHESTRATOR_TOOLTIP`         | Workflow step 6 Orchestrator helper   | Orchestrator presets → run Agentic GraphRAG traversal helpers from the Orchestrator tab → keep traversal docs aligned with the Graph Traversal panel. |
| `WORKFLOW_STEP8_BOTTOM_TABS_TOOLTIP`          | Workflow step 8 bottom tabs helper    | Bottom panel tabs → combine Data, Table, and Render views on GraphData → validate, visualize, and export layouts with consistent AgenticRAG semantics. |
| `TRAVERSAL_PRESET_UI_TOOLTIP`                 | Render traversal preset helper        | Traversal controls → set start node, depth, labels, helpers, and DuckDB queries → drive Agentic GraphRAG traversals from the renderer.          |
| `HELP_CHEATSHEET_ALIGNMENT_TOOLTIP`           | Help Canvas cheatsheet helper         | Canvas cheatsheet → pair selection and creation modes with bottom panel behavior → keep Orchestrator traversal and node inspector aligned.       |
| `HELP_CODEBASE_INDEX_ENTRY_POINTS_TOOLTIP`    | Help codebase index entry points      | Codebase index entry points → copy or show the index pipeline command → run the AgenticRAG codebase index pipeline from your terminal.          |
| `AGENTIC_GRAPHRAG_PIPELINE_DESCRIPTION`       | Agentic GraphRAG pipeline summary     | Agentic GraphRAG pipeline → align Workflow, Orchestrator, Renderer, and codebase index traversals with a shared rag:GraphRAGWorkflow JSON‑LD.    |
| `CODEBASE_INDEX_PIPELINE_COMMAND` / `HELP_PIPELINE_COMMAND_TEXT` | Codebase index pipeline command text | Single source of truth for the AgenticRAG‑aware codebase index pipeline command shared across Help and Render/Workflow panels.                    |
| `ThreeViewTuningTooltips` numeric helpers     | 3D renderer tuning controls           | 3D renderer tuning controls → buildNumericTooltip‑backed sliders for edges, layout, background, starfield, camera, and selection → keep 3D knobs aligned with traversal and indexing numeric tooltip semantics. |
| `WORKFLOW_INDEXING_PARAMETERS_TOOLTIP`        | GraphRAG workflow indexing helper     | GraphRAG workflow indexing → configure dataset paths, chunking, embedding model, and maxHops → keep indexing configuration consistent across workflows, traversals, and exports. |
| `GRAPHRAG_WORKFLOW_SUMMARY_TOOLTIP`           | GraphRAG workflow summary row         | GraphRAG workflow summary → show graphId, retrieval method, and workflow source → anchor traversal presets, traces, and exports to a single workflow document. |
| `AGENTIC_RAG_CONTEXT_IRI_TOOLTIP`             | AgenticRAG context IRI row            | AgenticRAG context IRI → share graphContextUrl across workflows, traversals, and QA → keep reasoning, tracing, and exports aligned around one context URL. |
| `ORCHESTRATOR_TRACING_OPTIONS_TOOLTIP`        | Orchestrator tracing options section  | Orchestrator tracing options → reuse traversalDelayMs and tune graphRAGPath tracing → keep AgenticRAG graph navigation timing and traces consistent across runs. |
| `TRAVERSAL_PRESETS_SECTION_TOOLTIP`           | Orchestrator traversal presets section | Traversal presets and helpers → edit traversal rules, helpers, and graphRAGPath presets → keep generic graph queries aligned with Renderer highlights and workflow JSON-LD. |
| `TRAVERSAL_EDITOR_AND_LAYERS_SECTION_TOOLTIP` | Orchestrator traversal editor section | Traversal editor and layers → edit traversal delay, layers, and physics → coordinate Orchestrator playback, tracing overlays, and Renderer appearance for readable graph navigation. |
| `TRAVERSAL_SEQUENCE_TOOLTIP`                  | Orchestrator traversal sequence section | Traversal sequence → inspect nodes, edges, hops, and multiHop chains from the last traversal → debug AgenticRAG graphRAGPath IRI steps for GraphRAG and generic queries without leaving Orchestrator playback. |
| `TRAVERSAL_SEQUENCE_MODE_LABEL_GRAPH_RAG`     | Orchestrator traversal sequence caption | Caption shown when the last traversal summary is GraphRAG-backed (`mode: 'graphRag'`), labeling the sequence as an Agentic GraphRAG path. |
| `TRAVERSAL_SEQUENCE_MODE_LABEL_GENERIC`       | Orchestrator traversal sequence caption | Caption shown when the last traversal summary is generic (`mode: 'generic'`), labeling the sequence as a generic traversal query. |
| `DUCKDB_SQL_FIELD_TOOLTIP`                    | Orchestrator DuckDB SQL field row      | DuckDB SQL field → edit parameterized graph queries for traversal helpers → keep text-mode SQL aligned with AgenticRAG traversal and Renderer overlays. |
| `WORKFLOW_TAB_HEADER_TOOLTIP`                 | Workflow main panel header             | Workflow tab → organize the 8‑step AgenticRAG graph pipeline and anchor exports to a single rag:GraphRAGWorkflow JSON‑LD document. |
| `HELP_TAB_HEADER_TOOLTIP`                     | Help main panel header                 | Help tab → surface shortcuts, behavior, panel tours, and workflow links → keep panel usage aligned with GraphRAG workflow stages and AgenticRAG navigation. |
| `SETTINGS_TAB_HEADER_TOOLTIP`                 | Settings main panel header             | Settings tab → centralize AgenticRAG presets, layout, and renderer defaults → keep graph navigation and panel behavior consistent across sessions. |
| `GRAPH_FIELDS_ICON_LEGEND_REUSE_TEXT`         | Graph Fields icon legend note          | Node/edge tooltip field‑type icons reuse the Graph Fields icon legend and UI Density: Icons settings for consistent schema‑driven glyphs. |
| `PARSER_JSONLD_EDGE_MAPPING_PIPELINE_DESCRIPTION` | Parser JSON‑LD edge mapping note  | Load into GraphData → JSON‑LD → graph edges/@id → Orchestrator; checked relations become allowedRelations in the generated GraphRAG workflow JSON‑LD. |
| `AGENTIC_RAG_PARSER_DESCRIPTION`              | Bottom panel Parser tab intro          | Parser → map CSV, JSON, or JSON‑LD into AgenticRAG graph JSON‑LD → apply schema‑aware defaults and Custom Parser configs so node and edge metadata stay aligned with the AgenticRAG schema and codebase index. |
| `TOOL_MENU_PARSER_DESCRIPTION`                | Toolbar Tools → Parser entry           | Parser → manage parser scripts and custom configurations → keep AgenticRAG graph ingestion paths versioned so CSV, JSON, and JSON‑LD inputs map cleanly into schema‑aligned GraphData. |
| `TOOL_MENU_SCHEMA_CONFIG_DESCRIPTION`         | Toolbar Tools → Schema Config entry    | Schema Configurator (Graph Fields) → define generic node/edge types, validation rules, and visualization presets → ensure GraphData, AgenticRAG Node/Edge schema, and Graph Fields stay aligned for ingest, traversal, and export. |
| `TOOL_MENU_GRAPH_FIELDS_DESCRIPTION`          | Toolbar Tools → Graph Fields entry     | Graph Fields → configure node/edge field mappings and table columns → keep Graph Data Table, schema‑config, and AgenticRAG JSON‑LD mapping aligned with Orchestrator traversal semantics. |
| `TOOL_MENU_RENDER_DESCRIPTION`                | Toolbar Tools → Renderer entry         | Renderer → manage 2D/3D render presets and layout configurations → store JSON‑LD (default) and YAML definitions that align camera, forces, and layer opacity with AgenticRAG traversal and selection semantics. |
| `TOOL_MENU_SETTINGS_DESCRIPTION`              | Toolbar Tools → Settings entry         | Settings → manage workspace‑level presets and defaults → store JSON‑LD (default) and YAML configuration for canvas UI, traversal, and rendering so sessions reload with consistent AgenticRAG behavior. |
| `TOOL_MENU_HISTORY_DESCRIPTION`               | Toolbar Tools → History entry          | History → manage snapshots of GraphData and schema state → import or export AgenticRAG JSON‑LD history files that capture curated graph states, schema presets, and traversal workflows for later comparison or rollback. |
| `AGENTIC_RAG_PATH_EDITOR_INTRO_TEXT`          | Orchestrator Text Editor intro         | Agentic GraphRAG path metadata for the current graph or selected node; describes how `graphRAGPath` drives traversal and legend behavior in the Text Editor view. |
| `AGENTIC_RAG_PATH_LEGEND_EMPTY_TEXT`          | Orchestrator Text Editor legend        | Default legend text when no AgenticRAG paths are detected on the current graph. |
| `AGENTIC_RAG_PATH_LEGEND_TRAVERSE_TEXT`       | Orchestrator Text Editor legend        | Legend text when the active AgenticRAG path is a `traverse` path (query plus multi‑hop path over node ids). |
| `AGENTIC_RAG_PATH_LEGEND_EXAMPLE_TEXT`        | Orchestrator Text Editor legend        | Legend text when the active AgenticRAG path is an `example` path (hops[] describing narrative reasoning steps). |
| `AGENTIC_RAG_PATH_LEGEND_MIXED_TEXT`          | Orchestrator Text Editor legend        | Legend text when the active AgenticRAG path is `mixed` (both traverse[] node ids and hops[] narrative steps). |
| `AGENTIC_RAG_PATH_LEGEND_PARSE_ERROR_TEXT`    | Orchestrator Text Editor legend        | Fallback legend text when AgenticRAG path metadata is present but cannot be parsed into a structured legend. |
| `GRAPHRAG_PATH_TRAVERSAL_METADATA_MISSING_TEXT` | Orchestrator Text Editor JSON catalog  | Message shown when no `graphRAGPath` traversal metadata is found on the current graph, even though the JSON catalog view is active. |
| `RENDER_TRAVERSAL_BUTTON_LABEL_GRAPH_RAG`     | Render traversal preset button         | Button label for running the Agentic GraphRAG path traversal preset from the Render tab, wired to `graphRAGPath.traverse` over the current graph. |
