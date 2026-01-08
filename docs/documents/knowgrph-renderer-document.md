Renderer media behavior and opacity
===================================

Scope
-----
- 2D canvas (GraphCanvas) media overlays
- 3D scene (ThreeGraph/Scene/NodeMesh) nodes
- Graph data table rows
- Markdown preview media proxying

2D layout caching and layer interaction
---------------------------------------
- Structured 2D layouts (`radial`, `tidy-tree`) cache node positions per `(schema.layers.mode, graph.layout.mode)` key in the graph store.
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

Developer notes: adding new 2D layout modes
-----------------------------------------
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

- Viewport and zoom behavior
---------------------------
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

- Media nodes and view modes
---------------------------
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

2D canvas media rendering
-------------------------
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

3D scene media rendering
------------------------
- 3D rendering uses `Scene` and `NodeMesh`:
  - `canvas/src/features/three/Scene.tsx`
  - `canvas/src/features/three/NodeMesh.tsx`
- `Scene` derives selection and neighbor sets using:
  - `computeNeighborIds` from the 2D highlight helpers, so 2D/3D share
    neighbor semantics.
- `NodeMesh` uses:
  - Base color from schema and Agentic RAG tagging (`getNodeBaseColor`).
  - Base opacity from three layer configuration (`layerOpacityByLayer`).
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

Graph data table media behavior
-------------------------------
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

Floating props panel configuration
----------------------------------
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

Markdown preview, media proxy, and gallery
------------------------------------------
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
  - All safe HTML, markdown image, and link-derived media in the markdown document.
  - All media-capable graph nodes discovered via `getNodeMediaSpec`.
  - Media items from markdown and graph nodes share the same selection
    and preview surface.
  - Each gallery card includes a tiny badge indicating source:
    - `Markdown` for media discovered in the active markdown document.
    - `Graph` for media discovered from GraphData nodes.

Validation and tests
--------------------
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
  - `selectionHighlight.test.ts`:
    - Verifies selection highlight logic for nodes and edges while
      keeping the media-aware extension compatible with the existing
      behavior.
 - Iframe allowlist for local dev/test:
   - When running `npm run dev` or `npm test`, set `VITE_IFRAME_ALLOWED_HOSTS=www.youtube.com,youtu.be,vimeo.com` (or an equivalent host list) so iframe media specs are not dropped by the safety gate and Media Node panels for YouTube/Vimeo nodes remain interactive.
