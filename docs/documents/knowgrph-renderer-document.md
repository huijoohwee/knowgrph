# Renderer media behavior and opacity

## Scope
- 2D canvas (GraphCanvas) media overlays
- 3D scene (ThreeGraph/Scene/NodeMesh) nodes
- Graph data table rows
- Markdown preview media proxying

## 2D layout caching and layer interaction
- Structured 2D layouts (`radial`, `tree`) cache node positions per `(schema.layers.mode, graph.layout.mode)` key in the graph store.
- The `tree` layout uses **dagre** (directed acyclic graph layout) under the hood, driven by `graph.layout.tree` (edgeLabels, direction, orientation, separation). It builds a layered graph layout (Sugiyama method) which handles both trees and DAGs effectively. This produces a "Mermaid flowchart"-like structure that is cleaner and more readable for directed graphs.
- `graph.layout.tree.separation` controls node spacing in this structured layout: the schema accepts any finite number and the Renderer settings panel exposes this value as a numeric field (step `0.1`, lower bound `0.25` by default) so curators can tune dense diagrams (for example, setting `1.3` vs `1.5`) without changing application code. When Markdown frontmatter includes a Mermaid block, the parser computes a density‑aware default separation from the diagram itself (counting non‑comment Mermaid statements and respecting `mermaidAnchorsOnly`) and stores it in `metadata.tree.separation` together with a neutral `metadata.tree.mermaidDensity` payload that records `statementCount`, a coarse density bucket (`"none"`, `"sparse"`, `"medium"`, `"dense"`), the `anchorsOnly` flag, and the neutral separation thresholds used for each bucket. `graphDataSlice.applyLayoutAutosuggestFromMetadata` then seeds `layout.tree.separation` from this metadata so Mermaid diagrams start with spacing that matches their structural density, while remaining fully overridable from the Floating Panel Renderer. A dedicated schema‑level test (`schema.tree.separationSchemaRoundTrip`) exercises this path by writing `layout.tree.separation` into the store schema and asserting that the configured value round trips unchanged through renderer configuration, keeping spacing adjustments fully data‑driven.
- Cache keys and storage:
  - `GraphCanvas` computes a cache key such as `"semantic:tree"` or `"property:radial"` from the active schema layer and layout mode ([GraphCanvas.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas.tsx#L260-L283)).
  - `layoutPositionCacheByMode` in the store maps each cache key to a dictionary of node positions (`{ [nodeId]: { x, y } }`) and is reset whenever graph data is cleared or replaced ([useGraphStore.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/hooks/useGraphStore.ts#L40-L74)).
  - `setLayoutPositionsForMode` writes or deletes entries so unused layouts do not linger in memory.
- Deciding when to reuse cached positions:
  - `GraphCanvas` computes:
    - `coverageFromNodes`: fraction of nodes in `renderGraphData` that already have finite `x,y` coordinates.
    - `coverageFromCache`: fraction of nodes with finite cached positions for the active `(layer, layout)` cache key.
  - A cached layout is reused when:
    - Layout mode is `radial` or `tree`, and
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
    - `buildSimulation` receives `skipInitialLayout` and skips the deterministic `radial` or `tree` placement step.
  - When `skipInitialLayout` is false:
    - The simulation runs the structured layout once, then `simulation.on('end')` captures final positions and stores them in `layoutPositionCacheByMode[layoutCacheKey]`.
    - Subsequent toggles back to the same `(layer, layout)` reuse this cached layout instead of recomputing it.
- Reset and memory safety:
  - `resetAll` in the store clears `layoutPositionCacheByMode` when users reset the canvas or load a new dataset so per-dataset layout caches do not leak across imports.
  - Empty or invalid position sets are stored as `null` and are removed on the next write so the cache stays small and bounded per dataset.
- Layout Continuity:
  - When switching between layout modes (e.g., Tree → Force), the previous node positions are preserved and used as the initial state for the new layout. This prevents visual chaos and "mess-up" of the graph structure during transitions.
- Tree Layout Performance:
  - The `dagre` layout calculation is cached in memory based on graph topology (node/edge counts) and configuration.
  - This prevents expensive re-computation during window resize events, ensuring the tree just re-centers efficiently instead of running the full layout algorithm again.

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
          "critical": "#EF4444"
        }
      }
    }
  ```

## Markdown Renderer

- **Scope**: Renders markdown content for preview panel and presentation mode.
- **Capabilities**:
  - **Syntax Highlighting**: Uses `highlight.js` for code blocks with language support.
  - **Extended Syntax**: Supports footnotes (`[^1]`), subscript (`~sub~`), superscript (`^sup^`), highlight (`==mark==`), and task lists.
  - **Presentation Mode**: Supports slide layouts, fragments, and navigation (similar to slidev but domain-agnostic).
  - **Styling**: Configurable via frontmatter (`theme`, `institution`, `author`, `meeting`, `layout`) and fully customizable CSS classes. Supports `default` and `academic` themes.
  - **Tables**: Supports inline HTML (`<br>`, `<pre>`) for complex cell formatting.
  - **Heading IDs**: Auto-generated and custom IDs (`{#id}`) for deep linking.
  - **Token Handling**: Uses a custom token renderer loop (`MarkdownTokenRenderer`) adhering to SRP and configuration-driven design.
  - **Visual Feedback**: Supports `flashLine` prop to highlight specific lines during navigation events, using CSS animations for a smooth "flash" effect that fades out automatically.
  - **Semantic HTML**:
    - Replaced generic `div`s with semantic elements:
      - `figure` for code blocks, tables, and media.
      - `section` for HTML blocks and default containers.
      - `aside` for footnotes.
      - `article` (optional) for slide containers.
      - `nav` (optional) for TOC.
    - Improves accessibility and structure for screen readers and search engines.

### Unified Editor Experience
- The Bottom Panel Markdown, Schema, Parser, and Orchestrator editors now use **Monaco Editor** for a consistent, high-performance editing experience:
  - Supports syntax highlighting, line numbers, and minimap (disabled by default for compactness).
  - Preserves scroll synchronization between the Markdown editor and viewer using the same robust line-mapping algorithm as the previous implementation.
  - Enables rich interaction patterns like context menu actions and potential future extensions (intellisense, diagnostics).

### Code Block Annotations & Display Modes
- Markdown code blocks support a "Display Mode" toggle in the viewer:
  - **Inline**: Traditional rendering where code is shown within the flow of the document.
  - **Beside**: Renders code and annotations side-by-side, ideal for literate programming or educational content where explanations accompany code.
- Annotations are linked to code blocks via stable identifiers:
  - Blocks can explicitly define an ID in their info string: \`\`\`js {id:my-block}\`.
  - If no ID is present, a fallback key based on line numbers is used.
  - This ID is used to look up external annotations (passed via \`codeAnnotations\` prop) and render them in the side panel or below the code block.

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
  - Implement the layout in `buildSimulation` alongside `radial` and `tree`:
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
  - **Initialization Behavior**: When the graph is loaded from source files or reset to a clean slate, the view automatically centers and fits all nodes to the screen. This ensures the initial view is always optimal regardless of the graph size or layout mode (Force, Radial, or Tree).
  - **Cross-Mode Behavior**: When "Fit to Screen" is enabled, switching layout modes (e.g., Force to Tree) or layer modes (e.g., Property to Semantic) automatically triggers a re-fit to ensure the new graph structure is fully visible. If "Fit to Screen" is disabled, the zoom level is preserved to maintain the user's viewport context.
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
