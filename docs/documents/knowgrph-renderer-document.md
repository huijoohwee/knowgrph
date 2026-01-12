# Renderer media behavior and opacity

## Scope
- 2D canvas (GraphCanvas) media overlays
- 3D scene (ThreeGraph/Scene/NodeMesh) nodes
- Graph data table rows
- Markdown preview media proxying

## 2D layout caching and layer interaction
- Structured 2D layouts (`radial`, `tidy-tree`) cache node positions per `(schema.layers.mode, graph.layout.mode)` key in the graph store.
- The `tidy-tree` layout uses a Dagre layered layout under the hood, driven by `graph.layout.tidyTree` (edgeLabels, direction, orientation, nodeSize, separation, curve) while link shapes remain schema-driven via D3 curves; when nodes expose a numeric `properties["visual:layer"]` (for example, Mermaid-derived bands), that value is passed through to Dagre as a node rank so nodes in the same band share a row or column, yielding flowchart‑style TD/LR and subgraph‑like layering without hardcoding any particular diagram template.
- `graph.layout.tidyTree.separation` controls node spacing in this structured layout: the schema accepts any finite number and the Renderer settings panel exposes this value as a numeric field (step `0.1`, lower bound `0.25` by default) so curators can tune dense diagrams (for example, setting `1.3` vs `1.5`) without changing application code. When Markdown frontmatter includes a Mermaid block, the parser computes a density‑aware default separation from the diagram itself (counting non‑comment Mermaid statements and respecting `mermaidAnchorsOnly`) and stores it in `metadata.tidyTree.separation` together with a neutral `metadata.tidyTree.mermaidDensity` payload that records `statementCount`, a coarse density bucket (`"none"`, `"sparse"`, `"medium"`, `"dense"`), the `anchorsOnly` flag, and the neutral separation thresholds used for each bucket. `graphDataSlice.applyLayoutAutosuggestFromMetadata` then seeds `layout.tidyTree.separation` from this metadata so Mermaid diagrams start with spacing that matches their structural density, while remaining fully overridable from the Floating Panel Renderer. A dedicated schema‑level test (`schema.tidyTree.separationSchemaRoundTrip`) exercises this path by writing `layout.tidyTree.separation` into the store schema and asserting that the configured value round trips unchanged through renderer configuration, keeping spacing adjustments fully data‑driven.
- Cache keys and storage:
  - `GraphCanvas` computes a cache key such as `"semantic:tidy-tree"` or `"property:radial"` from the active schema layer and layout mode ([GraphCanvas.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas.tsx#L260-L283)).
  - `layoutPositionCacheByMode` in the store maps each cache key to a dictionary of node positions (`{ [nodeId]: { x, y } }`) and is reset whenever graph data is cleared or replaced ([useGraphStore.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/hooks/useGraphStore.ts#L40-L74)).
  - `setLayoutPositionsForMode` writes or deletes entries so unused layouts do not linger in memory.
- Deciding when to reuse cached positions:
  - `GraphCanvas` computes:
    - `coverageFromNodes`: fraction of nodes in `renderGraphData` that already have finite `x,y` coordinates.
    - `coverageFromCache`: fraction of nodes with finite cached positions for the active `(layer, layout)` cache key.
  - A cached layout is reused when:
    - Layout mode is `radial` or `tidy-tree`, and
    - Cached positions exist for the cache key, and
    - `coverageFromCache >= 0.95`, and
    - Either the layout mode or the layer mode changed, or the current node coverage is low.
  - When these conditions are met:
    - `layoutPositionsForMode` is populated with the cached positions.
    - `skipInitialLayout` is set so the structured layout step does not recompute coordinates.
  - When coverage is already high and the `(layer, layout)` combination did not change:
    - `skipInitialLayout` is also set to preserve stable coordinates without touching the cache.
- Scene behavior:
  - `setupGraphScene` receives `layoutPositionsForMode`, `skipInitialLayout`, `layoutCacheKey`, and `setLayoutPositionsForMode` ([scene.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/scene.ts#L30-L189)).
  - When `skipInitialLayout` is true:
    - Cached positions are applied to nodes before building the simulation so the graph reuses previous coordinates.
    - `buildSimulation` receives `skipInitialLayout` and skips the deterministic `radial` or `tidy-tree` placement step.
  - When `skipInitialLayout` is false:
    - The simulation runs the structured layout once, then `simulation.on('end')` captures final positions and stores them in `layoutPositionCacheByMode[layoutCacheKey]`.
    - Subsequent toggles back to the same `(layer, layout)` reuse this cached layout instead of recomputing it.
- Reset and memory safety:
  - `resetAll` in the store clears `layoutPositionCacheByMode` when users reset the canvas or load a new dataset so per-dataset layout caches do not leak across imports.
  - Empty or invalid position sets are stored as `null` and are removed on the next write so the cache stays small and bounded per dataset.

## Renderer palette and default colors
- The renderer palette is driven by `MVP_COLOR_PALETTE` and `getRendererPalette(schema)`:
  - Base node tags map to neutral lifecycle roles:
    - `idea` → Blue `#007BFF` (core ideas / problem‑solution hypotheses).
    - `hypothesis` → Yellow `#FFC107` (hypotheses / testing).
    - `execution` → Green `#28A745` (validated actions / success).
    - `pivot` → Orange `#FD7E14` (pivots / iterations).
    - `alert` → Red `#DC3545` (alerts / risks / failures).
  - Base edge tags:
    - `critical` → `#DC3545`.
    - `neutral` → `#9CA3AF`.
- The Canvas toolbar exposes a compact **lifecycle legend** in the Renderer palette settings:
  - Blue core ideas, Yellow hypotheses, Green execution, Orange pivots, Red alerts.
  - The legend is backed by a tooltip that describes how `renderer:palette.nodes.idea/hypothesis/execution/pivot/alert` map to these lifecycle buckets so users can adjust colors without losing the shared vocabulary.
- `defaultSchema.nodeStyles` seeds node type colors from this palette:
  - `Entity` uses the `idea` blue.
  - `Chunk` uses the `execution` green.
  - Additional types (for example `MermaidNode`, `MermaidSubgraph`) remain neutral and can be restyled via schema or `renderer:palette`.
- Selection highlight colors in both 2D and 3D follow the same palette:
  - Selected nodes and highlighted edges read `renderer:palette.nodes.idea` (default `#007BFF`).
  - Dimmed nodes and non‑selected edges read `renderer:palette.edges.neutral` (default `#9CA3AF`).
  - The minimap reuses these selection colors for node/edge overlays and viewport handles.
- These defaults are aligned with `/guidelines/color-palette.md` in `huijoohwee.github.io` so node, edge, minimap, and graph layer visuals share a common, domain‑agnostic color vocabulary.

### Graph layers and lifecycle tags

- Graph layer hulls are built from property, document‑structure, or semantic communities:
  - Property mode groups nodes by JSON‑LD array properties on an owner node (for example, `steps`, `contains`).
  - Document‑structure mode keeps structural block nodes in the graph but excludes them from hull owners so layers focus on higher‑level containers.
  - Semantic mode groups nodes by `properties["visual:community"]` above a configurable minimum group size.
- Hull geometry:
  - `attachSimulationTick` derives hull paths from node positions and radii, sampling points around each member node and computing a D3 convex polygon hull before writing a single SVG `path` per group.
  - Hulls update on every simulation tick, so dragging nodes, dragging a graph layer centroid, or letting the force simulation settle reshapes the overlays without separate centroid bookkeeping.
- Color sources:
  - Base hull color falls back to `renderer:palette.nodes.idea` (or `MVP_COLOR_PALETTE.nodes.idea`) when no explicit `canvas:graphLayers` metadata is configured.
  - When `schema.metadata["canvas:graphLayers"]` is present, `defaultStyle`, `byOwnerType`, and `byPropertyKey` can override `fill`, `stroke`, `dash`, and opacity on a per‑group basis.
  - In semantic mode, if the first member node in a community exposes `properties["visual:fill"]`, that color is applied to the hull so communities can carry semantic colors from upstream pipelines.
  - When no metadata is present, owner nodes with `properties.tags` that include `idea`, `hypothesis`, `execution`, `pivot`, or `alert` reuse `getAgenticRagTagColor` and therefore `renderer:palette.nodes.*` so lifecycle tags drive both node fills and hull colors.
- Interaction:
  - Hull paths are rendered into a dedicated SVG group with `pointer-events: none` so they never intercept node or edge hover, selection, or drag events; they remain purely visual overlays that follow node motion.
  - Each group also renders a centroid glyph in the same SVG layer with `cursor: move`; dragging the centroid translates all member nodes via the same force simulation used for node drag, and the hull geometry is recomputed on each drag or simulation tick so centroids, nodes, and hull outlines stay aligned.
  - Hovering a centroid reuses the graph hover tooltip channel by mapping the centroid to its owner node (or the first member node), so the tooltip content and styling stay consistent with node and edge hovers without introducing a new graph node type in the underlying data.

### Overriding the renderer palette from schema

- The renderer reads an optional `renderer:palette` object from `schema.metadata` to override the MVP defaults. A minimal JSON‑LD schema snippet:

  ```json
  {
    "@context": ["https://huijoohwee.github.io/schema/AgenticRAG"],
    "@type": "kg:SchemaConfig",
    "metadata": {
      "renderer:palette": {
        "nodes": {
          "idea": "#2563EB",
          "hypothesis": "#EAB308"
        },
        "edges": {
          "neutral": "#64748B"
        }
      }
    }
  }
  ```

- When this metadata is present:
  - 2D nodes and labels:
    - `getNodeBaseFill` and `computeNodeVisual` read `renderer:palette.nodes.*` so primary node fills and selection highlights adopt the overridden `idea`/`hypothesis` colors.
    - Graph layer hull overlays reuse lifecycle tags and `renderer:palette.nodes.*` via `getAgenticRagTagColor`, so layer bands stay aligned with the node lifecycle colors.
  - 3D scene:
    - `NodeMesh` uses the same base node fill helper and selection visuals derived from `renderer:palette.nodes.idea`, so 2D and 3D selections share a single highlight color.
    - Neutral 3D edges derive their fallback stroke from `renderer:palette.edges.neutral`, so dimmed edges follow the same neutral tone as 2D.
  - Minimap:
    - Node and edge selection overlays, as well as the viewport rectangle and center crosshair, read `renderer:palette.nodes.idea` for their stroke/fill, and neighbor highlights reuse `renderer:palette.nodes.execution`.
- Graph layers:
  - Layer hulls fall back to `renderer:palette.nodes.idea` when no explicit `canvas:graphLayers` color is configured.
  - Lifecycle‑tagged owners (`properties.tags` including `idea`/`hypothesis`/`execution`/`pivot`/`alert`) pick their hull color directly from the corresponding `renderer:palette.nodes.*` entry, aligning hull fills and strokes with the node lifecycle palette.

- Because `renderer:palette` is merged over the MVP palette, omitted keys continue to use the default `/guidelines/color-palette.md` values, so partial overrides (for example, only changing `edges.neutral`) propagate consistently across 2D, 3D, minimap, and graph layers without requiring per‑view configuration.

### End‑to‑end example: JSON‑LD schema controlling layers and palette

- A single JSON‑LD schema document can control both the renderer palette and graph layer styling. The renderer expects:
  - `schema.layers.mode` to choose how node groups are derived (`"property"`, `"document-structure"`, or `"semantic"`).
  - `schema.metadata["canvas:graphLayers"]` to configure hull and centroid styles for each group.
  - `schema.metadata["renderer:palette"]` to configure the base node/edge palette used by both the canvas and 3D scene.

- Example JSON‑LD schema (simplified) that:
  - Uses property‑based layers for arrays like `steps` and `contains`.
  - Defines a lifecycle‑aligned palette for nodes and neutral edges.
  - Assigns distinct hull styles based on owner type and property key.

```json
{
  "@context": ["https://huijoohwee.github.io/schema/AgenticRAG"],
  "@id": "kg:DemoSchema",
  "@type": "kg:SchemaConfig",
  "layers": {
    "mode": "property"
  },
  "metadata": {
    "renderer:palette": {
      "nodes": {
        "idea": "#2563EB",
        "hypothesis": "#EAB308",
        "execution": "#22C55E",
        "pivot": "#F97316",
        "alert": "#EF4444"
      },
      "edges": {
        "neutral": "#64748B"
      }
    },
    "canvas:graphLayers": {
      "defaultStyle": {
        "fill": "#2563EB",
        "fillOpacity": 0.16,
        "stroke": "#2563EB",
        "strokeWidth": 1.25,
        "dash": "4,2"
      },
      "byOwnerType": {
        "Experiment": {
          "fill": "#22C55E",
          "stroke": "#15803D",
          "strokeWidth": 1.6
        },
        "Decision": {
          "fill": "#F97316",
          "stroke": "#C2410C",
          "strokeWidth": 1.6
        }
      },
      "byPropertyKey": {
        "steps": {
          "fill": "#0EA5E9",
          "stroke": "#0369A1",
          "dash": "6,3"
        },
        "contains": {
          "fill": "#A855F7",
          "stroke": "#7E22CE",
          "fillOpacity": 0.14
        }
      }
    }
  }
}
```

- When the markdown→graph pipeline emits nodes whose `properties.steps` or `properties.contains` arrays reference other node ids:
  - `buildNodeGroupsFromSchema` derives `NodeGroup` instances from those array properties.
  - `getGraphLayerStyleForGroup` resolves each group’s style by merging:
    - The `defaultStyle` block.
    - Any matching `byOwnerType[owner.type]` override.
    - Any matching `byPropertyKey[propertyKey]` override.
  - The hull and centroid glyphs for each group are colored using the resolved style, while individual node fills still come from the lifecycle palette in `renderer:palette.nodes.*`.

## Developer notes: adding new 2D layout modes
- When introducing a new structured 2D layout mode (for example `"grid"` or `"sankey"`), keep layout caching behavior aligned with existing modes:
  - Treat the layout as cacheable if it deterministically assigns node positions from `(graphData, schema)` without relying on simulation randomness.
  - Extend the `isStructuredMode` check in `GraphCanvas` so the new mode participates in `(schema.layers.mode, graph.layout.mode)` cache keys and `skipInitialLayout` decisions.
  - Implement the layout in `buildSimulation` alongside `radial` and `tidy-tree`:
    - Respect the `skipInitialLayout` flag so cached coordinates are reused instead of recomputed.
    - Stop the simulation once the initial deterministic placement is applied, mirroring the existing structured modes.
  - Rely on the existing `layoutPositionCacheByMode` and `setLayoutPositionsForMode` helpers instead of introducing new caches:
    - This preserves a single cache surface area and keeps memory usage bounded per dataset.
    - Cache invalidation remains centralized in `resetAll`, which clears all layout entries whenever graph data is replaced or reset.
- For non-structured or experimental layouts that depend on long-running simulation ticks:
  - Do not add them to `isStructuredMode`; allow the force simulation to drive positions without layout caching.
  - This avoids storing partial or unstable layouts and keeps cache semantics predictable across modes.

## Viewport and zoom behavior
- The canvas viewport is driven by:
  - `fitToScreenMode: boolean` in the canvas slice.
  - `zoomToSelectionMode: boolean` in the canvas slice.
- Fit to Screen:
  - Default: enabled (`fitToScreenMode = true`) on canvas initialization.
  - 2D: implemented via `useZoomEffects` and `applyZoomRequest("fit")`:
    - Uses `fitAllTransform` to compute a bounding box of all nodes and
      center that box in the SVG viewport while scaling to keep a small
      margin on all sides.
    - For multi-node graphs, the bounding box is anchored to the origin so
      the full graph stays stable as you add nodes.
    - For single-node graphs, `fitAllTransform` treats the node’s position
      as the entire bounding box, so the node itself is centered in the
      viewport regardless of its simulation coordinates.
    - When the graph transitions from empty to non-empty (for example, when
      the first node is added to a new canvas), this single-node behavior
      guarantees that the first node appears in the middle of the viewport.
  - 3D: implemented via `Controls` and `requestThreeCamera("fit")`:
    - Uses `fitCameraToPositions` to frame all node positions within the
      perspective camera frustum.
  - The toolbar “Fit to Screen” button:
    - Acts as a mode toggle backed by `fitToScreenMode`.
    - When turned on, disables `zoomToSelectionMode` and keeps the viewport
      centered on the full graph as the canvas size or graph contents
      change.
- Zoom to Selection:
  - When enabled, keeps the camera centered on the current selection and
    turns off Fit to Screen until the user re-enables it.
- New node placement relative to viewport:
  - Nodes created from the floating props panel Add section use the current
    canvas center in graph coordinates, not a fixed world origin:
    - `Add Node` creates a node at the viewport center and selects it.
    - `Add Node + Edge from Selected` creates a new node at the same
      viewport-centered position, then links it to the selected node.
    - `Add Media Node` uses the configured media fields and places the node
      at the current viewport center.
  - Because these actions rely on the viewport center, new nodes appear
    visually near the middle of the screen even after zooming or panning,
    instead of drifting toward the far bottom-right of the graph space.
  - When Fit to Screen is active, subsequent zoom recalculations still use
    all node positions for the bounding box; the viewport-centered node
    placement only affects the new node’s coordinates, not the zoom mode
    itself.

# Media nodes and view modes
- Markdown and JSON-LD ingestion attach media metadata to nodes via:
  - `media_url`, `image`, `video`, `iframe_url`, `media`
  - `media_kind` (`image` | `svg` | `video` | `iframe`)
  - `media_interactive` boolean:
    - When explicitly `true` or `false`, overrides default interactivity for the media surface.
    - When omitted, `video` and `iframe` kinds default to interactive, while `image` and `svg` remain non-interactive so clicks still select nodes.
  - The render toggle is stored in the graph store:
  - `renderMediaAsNodes: boolean`
  - Controlled from:
    - The floating props panel “Media” section.
    - The Settings → Render panel “Media Nodes” section.
    - The toolbar media view toggle.
  - The markdown→graph pipeline is validated by tests:
  - `markdownMediaSmoke.test.ts` (parser-level smoke)
  - `markdownMediaToggleE2e.test.ts` (parser + store + MarkdownPreview).
  - `mediaInteractiveDefaults.test.ts` (node-level defaults):
    - `image` and `svg` media are non-interactive by default.
    - `video` and `iframe` media are interactive by default, regardless of iframe host allowlist.

# 2D canvas media rendering
- 2D rendering uses `applySelectionHighlight`, `computeNodeVisual` and the
  2D scene helpers:
  - `canvas/src/components/GraphCanvas/highlight.ts`
  - `canvas/src/components/GraphCanvas.tsx`
  - `canvas/src/components/GraphCanvas/hooks/useSelectionHighlight.ts`
  - `canvas/src/components/GraphCanvas/layers/nodes.ts`
  - `canvas/src/components/GraphCanvas/sceneHandlers.ts`
- `SelectionHighlightParams` includes:
  - `renderMediaAsNodes: boolean`
  - `mediaNodeOpacity?: number`
- The global media opacity value is read from the store:
  - `mediaNodeOpacity: number` in `uiSettingsSlice`
  - Default: `0.9`, clamped to `[0, 1]`
- `GraphCanvas` passes the configured opacity into highlight:
  - Initial highlight after scene setup
  - Subsequent selection updates via `useSelectionHighlight`.
- Base node visuals:
  - `computeNodeVisual` detects media-capable nodes via `hasNodeMedia(node)`.
  - Node fill always comes from `getNodeBaseFill` plus selection/neighbor
    state, regardless of media.
  - `mediaNodeOpacity` controls opacity for media nodes (and is reused for
    non-media node dimming), but node fills are never made transparent to
    expose media.
  - Media Node Panels:
    - When `renderMediaAsNodes` is `true` (“panel-only” mode), the 2D scene
      creates a separate “media panel” group for each media-capable node:
    - A rounded background rectangle with a border color aligned to the
      MainPanel frame (`border-gray-200` / `#e5e7eb`). At maximum zoom, the
      corner radius and border thickness visually match the
      FloatingPanel/ModalContainer bezel.
    - A header strip at the top of the panel that visually labels the panel
      with `Label (Type)` using the node’s label and type.
    - A media region rendered as `<image>` or `<foreignObject>` depending
      on `media_kind`. For `video` and `iframe` kinds, the `<video>` or
      `<iframe>` content is interactive: native click targets are not
      intercepted by canvas selection handlers so users can click play/pause
      and use video or embedded player controls directly inside the panel.
    - An SVG `<title>` element exposes the full node label and type as
      browser-native hover text, matching the default circle/rect node label
      tooltips.
  - Panel sizing is locked to toolbar/main-panel primitives at max zoom:
    - Body height at max zoom is `2.0 × MINIMAP_HEIGHT` in SVG space,
      preserving a 16:9 aspect ratio for the media viewport.
    - “Compact” density uses `1.0 × MINIMAP_HEIGHT` as the body height
      baseline, reusing the same 16:9 aspect ratio.
  - Panels are positioned at the node’s simulation coordinates via a
    transform, but are not clipped to the default circle/rect node shape.
  - In “panel-only” mode, media-capable nodes do not render their base
    circle/rect glyphs; only the media panels are drawn at those positions.
  - `mediaNodeOpacity` is applied through `applySelectionHighlight` to both
    the remaining base nodes and the media panel selection so selection and
    neighbor state stay consistent across visuals.
  - When `renderMediaAsNodes` is `false` (“circle-only” mode), no media
    panels are rendered; node visuals still follow the standard
    selection/highlight rules.

# 3D scene media rendering
- 3D rendering uses `Scene` and `NodeMesh`:
  - `canvas/src/features/three/Scene.tsx`
  - `canvas/src/features/three/NodeMesh.tsx`
- `Scene` derives selection and neighbor sets using:
  - `computeNeighborIds` from the 2D highlight helpers, so 2D/3D share
    neighbor semantics.
- `NodeMesh` uses:
  - Base color from the same helper as 2D (`getNodeBaseFill`), so Agentic
    RAG tagging, node type styles, and palette fallbacks stay aligned across
    2D and 3D without semantic-specific overrides.
  - Base opacity from the same layer helper as 2D (`getLayerOpacity`), so
    `visual:layer` and `three.layerOpacityByLayer` are applied consistently
    for semantic, document‑structure, and property layer modes.
  - Global media opacity from the store:
    - `mediaNodeOpacity = useGraphStore(s => s.mediaNodeOpacity)`
- Selection behavior for `NodeMesh`:
  - Edge selection:
    - Edge endpoint nodes keep base color.
    - Opacity is `mediaNodeOpacity` rather than only layer opacity.
    - Non-endpoint nodes use neutral color and `mediaNodeOpacity *
      dimmedNodeOpacity`.
  - Node selection:
    - Selected node uses highlight color and `mediaNodeOpacity`.
    - Neighbor nodes use base color and `mediaNodeOpacity`.
    - Other nodes use neutral color and `mediaNodeOpacity *
      dimmedNodeOpacity`.
- This keeps 3D node visibility consistent with the configured media opacity
  without mutating graph node properties.

# Graph data table media behavior
- Table rendering is handled by:
  - `canvas/src/features/graph-data-table/ui/GraphDataTableRows.tsx`
- Each row now reads the global media opacity:
  - `const mediaNodeOpacity = useGraphStore(s => s.mediaNodeOpacity)`
- Row background classes still reflect selection and neighbor state:
  - Selected rows: `bg-blue-100`
  - Related rows: `bg-blue-50`
  - Others: zebra striping between `bg-white` and `bg-gray-50/50`
- When `mediaNodeOpacity < 1`, all rows are rendered with:
  - `style={{ opacity: mediaNodeOpacity }}`
- This gives the table a consistent visual cue for the configured media
  opacity without changing table semantics or data.

# Floating props panel configuration
- The floating props panel exposes media configuration:
  - `canvas/src/features/toolbar/FloatingPropsPanel.tsx`
- “Media” section controls:
  - `Render Media as Nodes` (toggle for `renderMediaAsNodes`).
  - `Opacity` slider (backed by `mediaNodeOpacity` in the store):
    - Range: `[0, 1]`, step `0.05`.
    - UI shows the percentage value (rounded).
  - `Kind` (`image`, `svg`, `video`, `iframe`) and URL fields, plus
    interactive on/off, which are applied to node media properties by the
    panel model.
- The opacity slider is global and affects:
  - 2D canvas node visuals via `computeNodeVisual`.
  - 3D nodes via `NodeMesh`.
  - Table rows via `GraphDataTableRows`.

# Markdown preview, media proxy, and gallery
- Markdown HTML media rendering is handled by:
  - `canvas/src/features/markdown/ui/markdownPreviewLinks.tsx`
  - `canvas/src/features/markdown/ui/MarkdownPreview.tsx`
- Important helpers:
  - `isSafeHref` and `isSafeMediaSrc` to filter unsafe protocols.
  - `resolveHref` to:
    - Normalize GitHub blob-like URLs.
    - Resolve relative paths against the active markdown document.
    - Convert to a filesystem URL where possible.
  - `applyMediaProxySrc` (from `canvas/src/lib/url.ts`) to route external
    HTTP(S) media through `/__fetch_remote`:
    - Leaves same-origin URLs untouched.
    - Wraps cross-origin image and video src values as:
      `/__fetch_remote?url=<encoded>`.
- HTML `<img>`, `<video>` and `<iframe>` blocks are parsed with `DOMParser`
  and re-rendered with safe attributes.
- YouTube and Vimeo URLs are normalized for iframes and validated by
  the media helpers in `GraphCanvas`:
  - YouTube and Vimeo URL normalization is done in `GraphCanvas` helpers.
  - Iframe URLs are checked against the allowed host list.
- The main Preview panel builds a unified gallery of:
  - All Mermaid code blocks in the active markdown document.
  - The active document’s frontmatter `mermaid:` block (when present), exposed as a dedicated “Mermaid diagram from frontmatter” card.
  - All safe HTML, markdown image, and link-derived media in the markdown document.
  - All media-capable graph nodes discovered via `getNodeMediaSpec`.
  - Media items from markdown and graph nodes share the same selection
    and preview surface.
  - Each gallery card includes a tiny badge indicating source:
    - `Markdown` for media discovered in the active markdown document.
    - `Graph` for media discovered from GraphData nodes.
  - Selecting a `Graph` media card also updates Canvas selection to the
    corresponding node and, when provenance metadata is available, opens
    the Bottom Panel to the Curation → Markdown view and scrolls
    the markdown editor/viewer to that node’s
    `metadata.lineStart`–`metadata.lineEnd` range.
  - When the markdown parser is used as the source of GraphData (for example, by editing markdown in the Bottom Panel and applying changes into the JSON Editor / Graph Data UI), a frontmatter `mermaid:` block contributes only a `MermaidDiagram` media node linked from the `Document` via `hasMermaid`. Any additional entities, mentions, or `semanticRelation` edges come from neutral semantic layers operating on markdown text and anchors/links rather than from the Mermaid diagram itself.
  - When the active markdown document contains a frontmatter `mermaid:` block, the Bottom Panel Markdown Preview shows a compact inline hint above the rendered markdown. Clicking this hint:
    - Opens the main Preview tab (via `MAIN_PANEL_OPEN_EVENT`).
    - Focuses the frontmatter Mermaid diagram in the Preview panel by setting `markdownPreviewMermaidFocusCode` and `markdownPreviewMermaidFocusConfig` in `useGraphStore`, so the corresponding card and full-size Mermaid diagram become active without additional clicks.

## Markdown text highlight and canvas‑aware colors
- The Bottom Panel Markdown section exposes a “Text Highlight” toggle alongside Presentation mode:
  - Backed by `LS_KEYS.markdownTextHighlight` so preferences persist per browser.
  - Emits `markdownTextHighlightToggled` metrics whenever users flip the toggle.
- When the toggle is enabled:
  - Canvas selections with markdown provenance drive a `highlightedLineRange` in the markdown editor and viewer.
  - `MarkdownTokenRenderer` applies a tinted background band to blocks that overlap the highlighted range.
  - The editor gutter mirrors this range using a matching background band behind line numbers.
  - Node‑backed ranges pick up their base color from the same node style palette used by `getNodeBaseFill`, so markdown text and canvas nodes stay visually consistent across layer modes.
  - Edge‑backed ranges render with an underline aligned to the edge stroke color from `getEdgeBaseStroke`.
  - When `schema.layers.mode === 'semantic'`, always‑on token highlights reuse the semantic layer’s background color (via the renderer’s `three.backgroundColor` and `markdownAlwaysOnAlpha`) so document‑structure vs property vs semantic modes stay visually aligned.
- When the toggle is disabled:
  - Markdown still scrolls and auto-aligns to the selected node/edge, but no extra background or underline treatments are applied.

### Markdown provenance helpers and line-range semantics
- Graph nodes and edges carry markdown provenance via `metadata.documentPath`/`metadata.codebaseRelPath` and `metadata.lineStart`/`metadata.lineEnd`.
- The canvas normalizes this metadata through a small set of helpers in `canvas/src/lib/graph/markdownMetadata.ts`:
  - `toMetadataRecord` guards against non-object metadata and provides a `Record<string, unknown>` view for downstream helpers.
  - `getLineRangeFromMetadata` parses `lineStart`/`lineEnd` (numbers or numeric strings), clamps them to 1-based line indices, and returns a normalized `{ start, end }` range or `null` when `lineStart` is missing or invalid.
  - `getDocumentPathFromMetadata` resolves a stable document identifier by preferring `documentPath` and falling back to `codebaseRelPath` when the primary field is empty.
  - `getDocumentLocationFromMetadata` combines these into a single `{ documentPath, lineStart, lineEnd }` object and only returns a location when both a document path and a valid line range are present.
  - `computeHighlightedRangeFromLines` takes a candidate line range and the editor’s current line count, clamps the range into visible bounds, and returns `null` when no usable start line is available.
- Bottom Panel selection, the markdown viewer’s `highlightedLineRange`, the Markdown Preview always-on token highlights, and the “Show on Canvas” context action all consume these helpers so markdown ↔ canvas alignment and highlight behavior share a single, schema-aware definition of document location.

## Markdown presentation fragments and step engine
- The Bottom Panel Markdown Preview supports slide decks split by `---` separators with optional frontmatter:
  - Deck-level frontmatter configures slide-wide options such as `layout`, `background`, `aspectRatio`, and fragment behavior.
  - Per-slide frontmatter can override layout, background, class, and fragment configuration for individual slides.
- Slide-level transitions and math rendering follow the markdown slide styling reference:
  - `transition` keys in deck or slide frontmatter map to CSS-based slide transitions (`fade`, `slide-left`, `slide-right`, `slide-up`, `slide-down`, `zoom`, or `none`).
  - Inline (`$...$` or `\\(...\\)`) and display (`$$...$$` or `\\[...\\]`) math expressions are parsed into dedicated math tokens and rendered via KaTeX in both viewer and presentation modes.
- Fragment configuration is schema-free and driven by markdown metadata:
  - When the deck or slide frontmatter includes a `fragments` key, the viewer interprets matching elements as stepped fragments:
    - `fragments: true` enables the fragment engine with default tags and classes.
    - `fragments: { enabled: true, steps: N }` configures an explicit number of steps for the slide.
    - `fragmentTags` and `fragmentClassNames` frontmatter keys override the defaults.
  - Default fragment selectors in the Knowgrph viewer:
    - Tags: `<v-click>`, `<v-mark>`.
    - Classes: `.fragment`.
- Fragment ordering is deterministic and compatible with common slide frameworks:
  - Block-level fragments:
    - Elements with `class="fragment"` are treated as fragments.
    - `data-fragment-index="N"` controls ordering when present; otherwise, document order is used.
  - Tag-based fragments:
    - `<v-click>` blocks are treated as fragments.
    - `at="N"` on `<v-click>` sets the explicit fragment index; when omitted, order falls back to document order within the fragment sequence.
  - Inline markers:
    - `<v-mark>` elements participate in fragment stepping like `<v-click>`.
    - Color and type attributes on `<v-mark>` are rendered as plain content without special styling; only step visibility is applied.
- The presentation navigation API integrates fragment steps with slide navigation:
  - The viewer exposes a `MarkdownPreviewPresentationApi` with `prev()` and `next()` methods.
  - `next()` first advances fragment steps on the active slide until the configured step count is reached, then advances to the next slide.
  - `prev()` decrements fragment steps when possible; once the active slide is at its first step, it moves to the previous slide and, when fragments are enabled there, jumps to that slide’s last step.
  - Keyboard shortcuts (`Space`, `ArrowRight`, `PageDown`, `ArrowLeft`, `PageUp`, `Home`, `End`) are wired through the same API so fragment stepping and slide navigation stay consistent across input methods.
  - The fragment engine is continuously validated against the public `markdown-slide-styling-reference.md` guideline so viewer behavior and the reference style guide stay aligned.

## Canvas ↔ Markdown selection sync
- Canvas-driven sync:
  - When a node or edge with `metadata.lineStart`/`metadata.lineEnd` is selected on the canvas, the Bottom Panel markdown editor and viewer compute the corresponding wrapped-row range and scroll so the first line of that range sits under the top edge of the editor viewport.
  - Scroll positioning is line-based and uses the current wrap model for the textarea, so the highlighted range remains stable even when the Bottom Panel is resized vertically.
  - The active line range is highlighted in the markdown pane to make the relationship between the canvas selection and the source text immediately visible.
- Markdown-driven sync:
  - The Markdown Preview exposes a contextual “Show on Canvas” action when right-clicking a non-empty text selection whose token carries a valid line range.
  - Invoking “Show on Canvas” resolves the selection to the underlying node or edge (when provenance is available) and updates canvas selection using the same store actions as other selection sources, so canvas highlighting, viewport behavior, and downstream panels stay consistent.

# Graph layer modes and overlays

- Layer modes:
  - The **Graph Layer** tab controls the **Semantic → Document structure → Property** cycle using the same `schema.layers.mode` field that the Renderer and FloatingPanel use, which correspond in the UI to “Similarity clusters (semantic)”, “Layered structure (document)”, and “Raw data (schema)” respectively.
-  - The top‑bar Graph Layer button (Shapes icon) is a view‑only toggle for graph layer hull overlays on the canvas; it flips the same `graphLayersVisible` flag without changing `schema.layers.mode` or opening the Graph Layer panel. When `graphLayersVisible` is `true`, the 2D node and label layers omit `MermaidSubgraph` nodes from their selections so Mermaid layer bands are represented by member nodes and hull overlays rather than standalone hex nodes; when `graphLayersVisible` is `false`, `MermaidSubgraph` nodes participate in the 2D node and label layers again.
  - **Semantic**:
    - Semantic is the default when `schema.layers.mode` is missing or invalid.
    - The underlying JSON-LD graph is unchanged; the semantic layer derives weighted similarity edges from tokenized node text using cosine similarity or PMI.
    - Louvain-style community detection assigns `visual:community` and `visual:fill` per node; these become inputs to graph layer overlays and traversal overlays.
  - **Document structure**:
    - Keeps all nodes and edges visible but treats structural node types such as `Document`, `Section`, `Paragraph`, `List`, `ListItem`, `CodeBlock`, and `Table` as blocks.
    - Assigns a `visual:layer` value so 2D and 3D renderers can apply per-layer opacity and emphasis without hiding nodes or changing layout.
    - Reuses the same `visual:layer` channel for neutral Mermaid subgraph groupings: when Mermaid subgraph names follow an `Lk` convention (`L0`, `L1`, and so on), their member `MermaidNode` instances receive `visual:layer = k + 1` so the Graph Layer panel can expose a layer band control that dims non‑matching Mermaid layers without introducing extra graph nodes or hardcoding file‑specific semantics.
  - **Property**:
    - Shows nodes and edges as imported from JSON-LD, driven by array-valued properties and reference edges.
    - Does not add semantic similarity edges or derived communities; this layer reflects the raw graph schema.

- Graph layer overlays:
  - When **Graph Layers** are enabled from the Graph Layer view, the renderer draws convex hull overlays around node groups instead of rendering every node as an isolated shape.
  - The Graph Layer view exposes a **Lifecycle tags for layers** helper that writes lifecycle tags (`idea`, `hypothesis`, `execution`, `pivot`, `alert`) into the selected owner node’s `properties.tags` array so layer overlays and node fills share the same palette.
  - For the `markdown-slide-demo` frontmatter graph and the interview-session mermaid flowchart guide, hull recomputation uses a small, fixed number of sample points per node and respects the `schema.performance.lod.hideLabelsBelowScale` threshold, so graph layer overlays remain lightweight even when graph layers are enabled across all three modes.
  - **Semantic mode**:
    - Groups nodes by `visual:community` and uses `visual:fill` as the base overlay color so each hull approximates a semantic neighborhood derived from PMI/cosine similarity edges.
    - Edge sparsity and quality are controlled by `schema.layers.semantic.topKEdgesPerNode` and `schema.layers.semantic.minSimilarity`, which act as schema-driven presets rather than dataset-specific magic numbers.
  - **Document structure mode**:
    - Uses array-valued properties and structural ownership relationships but filters owners whose types are purely structural blocks when building groups, so overlays emphasize meaningful content groups instead of every heading or paragraph.
  - **Property mode**:
    - Derives groups directly from array-valued properties (for example, owners with lists of items) without applying semantic overlays or structural filters.
  - Overlay styling is schema-driven:
    - When an owner node carries AgenticRAG-style lifecycle tags in `properties.tags` (for example `["idea"]`, `["hypothesis"]`, `["execution"]`, `["pivot"]`, or `["alert"]`), graph layer hull colors reuse the corresponding `renderer:palette.nodes.*` entry so overlays stay aligned with the lifecycle palette.
    - Default fill, stroke, dash, and opacity come from `schema.metadata["canvas:graphLayers"].defaultStyle`.
    - Styles can be specialized by owner node type via `schema.metadata["canvas:graphLayers"].byOwnerType`.
    - Styles can be specialized by property key via `schema.metadata["canvas:graphLayers"].byPropertyKey`.

# Validation and tests
- Lint and typecheck:
  - `npm run lint`
  - `npm run typecheck`
- Targeted media tests:
  - `markdownMediaSmoke.test.ts`:
    - Confirms markdown with HTML `<img>` elements produces
      media-capable nodes in the parsed graph.
  - `markdownMediaToggleE2e.test.ts`:
    - Drives the markdown→graph→store pipeline with the media toggle
      enabled and disabled.
    - Confirms media node URLs are present regardless of toggle state.
    - Confirms `MarkdownPreview` renders `<img>` elements for multiple
      markdown sources, including local files, GitHub-hosted assets and
      HTML blocks.
  - `markdownPresentationFragments.test.ts`:
    - Verifies slide-fragment stepping for `.fragment`, `<v-click>`, and `<v-mark>` elements.
    - Confirms `data-fragment-index="N"` and `at="N"` ordering semantics match the documented fragment engine behavior.
  - `markdownSlideStylingReferenceRender.test.ts`:
    - Loads the external markdown slide styling reference document at `/Users/huijoohwee/Documents/GitHub/huijoohwee.github.io/guidelines/markdown-slide-styling-reference.md`.
    - Smoke-tests that the Bottom Panel markdown viewer can render the full deck in presentation mode without hardcoding or inlining the reference markdown content.
  - `selectionHighlight.test.ts`:
    - Verifies selection highlight logic for nodes and edges while
      keeping the media-aware extension compatible with the existing
      behavior.
 - Iframe allowlist for local dev/test:
   - When running `npm run dev` or `npm test`, set `VITE_IFRAME_ALLOWED_HOSTS=www.youtube.com,youtu.be,vimeo.com` (or an equivalent host list) so iframe media specs are not dropped by the safety gate and Media Node panels for YouTube/Vimeo nodes remain interactive.
