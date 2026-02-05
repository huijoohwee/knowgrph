# KnowGrph Renderer Specification

## Design Mantras

```
- [ ] Data Flow; keep unidirectional stages; forbid circular store↔render updates
- [ ] Immutability; isolate canonical state; forbid renderer mutating store graph data
- [ ] Memoization; minimize recomputation; forbid re-derivation on unrelated changes
- [ ] Performance; protect frame budget; forbid synchronous heavy work on render
- [ ] Stability; cleanup resources; forbid dangling listeners, timers, and RAF loops
- [ ] Neutrality; remain domain-agnostic; forbid dataset-specific rendering logic
```

---

## Universal Design Principles

| Context      | Intent                         | Directive                                                                 |
|--------------|--------------------------------|---------------------------------------------------------------------------|
| Derivation   | Compute stable render inputs    | - [ ] Depend on minimal config; forbid hidden dependencies                |
| Immutability | Protect canonical graph state   | - [ ] Copy before render; forbid store mutation via shared references     |
| Memoization  | Avoid redundant recomputation   | - [ ] Memoize by layer config; forbid recompute on unrelated schema edits |
| Performance  | Maintain responsiveness         | - [ ] Defer heavy work; forbid blocking operations in hot paths           |
| Cleanup      | Prevent memory leaks            | - [ ] Cleanup timers/listeners/RAF; forbid dangling references            |

---

## Renderer Architecture

**Layer Stack**: Store (Zustand) → Derivation (Memoized) → GraphCanvas (React) → D3 Simulation → SVG/Canvas

**Processing Flow**: `graphData` (Store) → view derivation (`useActiveGraphData` + filters + collapse) → `cloneGraphDataForRender` (Immutability Barrier) → `D3 Force/Layout` → `DOM`

**Design Principles**: Unidirectional Flow | Visual Isolation | Configurable Layouts

### High-Level Components

- **GraphCanvas**:
  - `canvas/src/components/GraphCanvas.tsx` coordinates the rendering lifecycle.
  - Manages D3 simulation, event listeners, and interaction state.
- **View Derivation**:
  - `canvas/src/hooks/useActiveGraphData.ts` selects Document vs Keyword mode.
  - `canvas/src/lib/graph/layerDerivation.ts` applies frontmatter filtering.
  - `canvas/src/components/GraphCanvas/viewDerivation.ts` collapses groups into derived group-nodes when requested.
  - `canvas/src/components/GraphCanvas/renderClone.ts` clones nodes/edges to prevent D3 from mutating store state.
- **Layout Engine**:
  - `canvas/src/components/GraphCanvas/layout/*.ts` handles positioning (Force, Radial, Tree, Mermaid).
  - Uses `layoutPositionCacheByMode` to persist stable layouts across re-renders.

---

## Renderer UI Surfaces (SSOT)

**Canonical surface**: Toolbar → Floating Panel → Renderer

- Floating panel renderer composes:
  - Quick controls for `renderer:palette` and hover tooltip content.
  - The full Render Settings section (collapsible) for layout, camera, selection, and presets.
- Bottom Panel “Renderer” tab is treated as navigation and opens the Floating Panel renderer view (no duplicate renderer controls).
- Tooltip semantics are standardized:
  - Key tooltips follow Role → Actions → Outcome.
  - Value tooltips follow Default/Min/Max/Interval (when applicable) + short impact (≤ 15 words).

- Flow Editor supports an in-canvas Node Quick Editor overlay (semantic HTML) for fast field edits and validation.
  - `canvas/src/components/FlowEditor/NodeOverlayEditor.tsx`

---

## Performance & Stability Strategies

### 1. Stable Graph References
- **Issue**: Frequent re-renders or schema updates (e.g., toggling hover settings) could trigger expensive graph re-derivation.
- **Solution**: `GraphCanvas` implements rigorous memoization:
  - Dependencies include `graphData` reference and stable JSON hashes of `schema.layers`, `schema.layout`, etc.
  - **Optimization**: `schema.nodeStyles` changes do *not* trigger graph re-derivation or scene rebuilds, only CSS/style updates.
  - `deriveGraphDataForLayers` runs only when strictly necessary (topology or layer mode changes).

### 2. Store Immutability & D3 Isolation
- **Issue**: D3's force simulation directly mutates node objects (`x`, `y`, `vx`, `vy`). If these objects are shared references to the Zustand store, it violates unidirectional flow and causes side-effects.
- **Solution**: `cloneGraphDataForRender` enforces **render-only clones** of nodes and edges before passing them to the renderer.
  - Nodes are cloned so D3 can freely mutate `x/y/vx/vy` without touching canonical store state.
  - Edges are cloned because D3 force-link mutates `edge.source`/`edge.target` from ids to node objects; cloning prevents store contamination and downstream churn.
-    - This decoupling breaks "render → simulate → store update → render" loops and prevents force layout “jumping” caused by repeated reinitialization.

### 3. Loop Prevention
- **Mechanism**:
  - **Stable References**: `useMemo` in `GraphCanvas` ensures `renderGraphData` remains referentially stable if inputs haven't changed.
  - **Simulation Isolation**: Force layout positions are **not** synced back to the global store automatically. This prevents "render → simulate → store update → render" cycles.
  - **Resize Guard**: `setCanvasDims` short-circuits unchanged dimension updates.
  - **Scene Rebuild Boundaries**: Scene construction is decoupled from selection/highlight styling so selection changes do not restart the simulation.

### 4. Stats Derivation Optimization
- **Optimization**: `useStatsSelection` uses the same memoized schema JSON technique to prevent expensive stats re-calculation when irrelevant schema parts (like colors) change.

### 5. Preserve Inactive Renderers
### 5. Forbid Inactive Renderer Interference
- **Issue**: When multiple renderer layers remain mounted (even if visually hidden), they can still run effects (zoomRequest consumption, timers, layout recalculation, MapLibre lifecycle) and interfere with the active mode.
- **Solution**: Canvas may **warm-mount** inactive renderers to reduce switch lag, but enforces strict **active gating**:
  - Only the active renderer consumes shared requests (zoom/selection) and owns interactive listeners.
  - Inactive renderers must short-circuit hot-path effects (draw loops, request consumption, store writes) when `active=false`.
  - Caches remain SSOT-keyed: zoom state is restored via a stable view key; layout caches remain isolated by render variant.
  - UI container: `canvas/src/pages/Canvas.tsx`
  - 2D D3 renderer entry: `canvas/src/components/GraphCanvas.tsx`
  - 2D Flow renderer entry: `canvas/src/components/FlowCanvas.tsx`
  - 2D Flow Editor (draft + commit) entry: `canvas/src/components/FlowEditorCanvas.tsx`
  - 3D renderer entry: `canvas/src/features/three/ThreeGraph.tsx`
  - Geospatial overlay host: `gympgrph` host surface mounted only when Geospatial Mode is enabled.

### 6. Tick-Path Caching + Force Gating
- **Issue**: D3 simulation ticks are O(nodes + edges) and can become CPU-bound due to repeated geometry computations and custom-force passes.
- **Solution**:
  - Cache node geometry per tick keyed by node id and schema reference (avoids repeated dimension/radius recomputation).
  - Gate heavy custom forces at low alpha and reduce anti-line work frequency.
  - Persist layout positions when the simulation ends to improve reuse on mode switches and rebuild boundaries.

---

## Layout Specifications

## Cluster Terminology (SSOT)

- **Cluster (SSOT)**: umbrella term for “a set of nodes treated as a unit” across derivation, layout, and rendering.
- **Cluster Layer (Canvas)**: renderer outline surfaces configured by `schema.metadata["canvas:graphLayers"]` and driven by GraphData metadata or frontmatter (aka “graph layers” in schema/config keys).
- **Community (Semantic)**: similarity-based cluster id (`visual:community`) derived from connected components over `coOccursWith` (used by BottomPanel stats + layered layouts).
- **Subgraph (Mermaid)**: Mermaid `subgraph` blocks that materialize as cluster layers during frontmatter/document derivation.
- **Cluster Shape (UI)**: the outline shape toggle (Rect/Polygon) for cluster layers; it does not change the underlying clustering rule.
- **Renderer Parity**: Cluster Shape and Port Handles toggles must affect both 2D renderers (D3 and Flow) so switching renderVariant does not change semantics (only implementation).

### 2D Layout Caching
- **Structured Layouts** (`radial`, `tree`, `mermaid`) cache positions in `layoutPositionCacheByMode`.
- **Cache Reuse**:
  - `determineLayoutPositions` checks coverage (>95% matched nodes).
  - Reuses cached positions to skip expensive layout calculations on re-visits.
- **Continuity**:
  - Cache keys include semantic mode + frontmatter mode + layout mode + render mode + render variant (+ optional layout variant) to prevent cross-renderer and cross-layout drift.
  - Switching modes (e.g. Tree -> Force, 2D -> 3D -> 2D) restores cached positions to prevent visual chaos.
  - Centroid recentering ensures the graph stays visible.

### Mermaid Layout Mode
- **Configuration**: `layout.mode = 'mermaid'`.
- **Behavior**:
  - Forces **Rectangular Box** shape.
  - Uses Dagre layout engine.
  - **Subgraphs**: Rendered as group outlines with auto-sizing padding.
  - **Port Handles**:
    - **Border**: Inputs/Outputs clamped to border.
    - **Intermediate**: Clamped to inner padding.

---

## Visual Styling & Palette

- **Palette Source**: `renderer:palette` in `schema.metadata`.
- **Defaults**:
  - `idea` (Blue), `hypothesis` (Yellow), `execution` (Green), `pivot` (Orange), `alert` (Red).
- **Lifecycle Mapping**:
  - Nodes with `properties.tags` including these keywords automatically adopt the color.
  - Graph Layer outlines adopt the color of their owner node or property key.

---

## Node Shapes (2D)

- **Supported shapes**: `circle`, `rect`, `diamond`, `hex` (images render as `rect`).
- **Precedence (SSOT)**:
  1. `schema.nodeShapes[node.type]` (per-type shape)
  2. `node.properties["visual:shape"]` (per-node override; used by Mermaid flowchart shape parsing)
  3. `schema.behavior.nodeShapeMode` (global default; toolbar cycles)
  4. Fallback: `rect` when Port Handles are enabled, otherwise `circle`
- **Goal**: presentation toggles update layers without re-layout; shape updates must be tick-safe and bounded.

---

## Label Layout (SSOT)

- **Single source**: wrapping + ellipsis decisions are shared across render, collision, and fit-to-view to prevent drift.
- **Center alignment**: non-circle node labels are centered (`dx=0`, `anchor=middle`) and line-wrapped within the node’s visual bounds.
- **Ellipsis**: long labels are clamped and expanded via hover tooltip (see `labels.ts`, `GraphHoverTooltip.tsx`).

---

## Edge Labels & Links

- **Theme alignment**: edge labels and group labels use the same halo/fill paint via `useGraphCanvasStyles`.
- **No endpoint overlap**: edge labels apply bounded normal-offset nudging to avoid overlapping their endpoint node AABBs.
- **Temp link styling**: temp edge-creation link uses `--kg-canvas-accent` (light/dark aware) instead of hardcoded colors.

---

## Port Handles & Collision

- **Port clearance**: collision extents include port handle offset/size so handles don’t visually overlap.
- **Sizing SSOT**: default rect sizing derives from schema node radius (no minimap-driven sizing side-effects).
- **Flow parity**: the 2D Flow renderer must (1) route endpoints to per-edge handles only when Port Handles are enabled, (2) distribute handle positions along the correct axis (`LR`: along node height, `TB`: along node width), and (3) optionally draw handle glyphs using the same port-handle config knobs.
- **Edge routing parity**: Flow edge routing is schema-driven via `schema.layout.flow.edges.routing`, avoids node/group obstacles to reduce spaghetti, and ignores obstacles that contain the edge endpoints (so endpoint nodes/groups never block their own routes). Obstacles are built once per draw to avoid E×N recomputation.
- **Underlay parity**: edge visibility beneath group fills is schema-driven via `schema.layout.flow.edges.underlay.groupFadeAlpha` and should match D3’s group fill semantics.
- **Nested group visibility**: group stroke/opacity should scale by outer depth consistently across D3 and Flow via `schema.layout.groups.depthStyle`.

---

## Radial Layout (Bounded)

- **Post-relaxation**: radial layout runs a bounded AABB-collide relaxation pass to reduce overlaps without starting an indefinite simulation.

---

## Anti-Patterns (Forbidden)

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Store Mutation       | Protect Source of Truth         | - [ ] Copy data before D3 simulation; forbid passing store references directly to D3       |
| Effect Dependencies  | Prevent Re-renders              | - [ ] Use memoized JSON for complex objects; forbid raw object dependencies in useEffect    |
| Layout Loops         | Stable Convergence              | - [ ] Check equality before store updates; forbid blind dispatching of layout positions     |
| Test Hangs           | Ensure CI Stability             | - [ ] Cleanup simulation and listeners in useEffect return; forbid dangling intervals       |

---

## Dependency & Integration Standards

**Coupling Metrics**
- `GraphCanvas` is decoupled from `GraphSchema` specifics:
  - It only depends on `schema.layers` and `schema.layout` for structural updates.
  - Styling updates are handled via separate `useGraphCanvasStyles` hook.

---

## Viewport and zoom behavior
- **Fit to Screen**:
  - Centers on rendered graph centroid and accounts for label-aware bounds.
  - Computes fit scale on capped `1920×1080` (16:9) frame with `targetFillRatio = 0.8`.
  - Clamps zoom scale via `schema.performance.zoom.{minScale,maxScale}`.
  - Re-evaluates on view/layout/presentation changes unless the view is pinned.
- **Zoom to Selection**:
  - Focuses camera on selected node/edge.
- **Zoom State Caching**:
  - Caches zoom state per viewKey to prevent cross-mode/layout/presentation contamination.
- **New Node Placement**:
  - New nodes appear at viewport center to prevent disorientation.

---

## Expand and Collapse (Clusters/Subgraphs/Layers)

- **Goal**: treat clusters, communities, and subgraphs as first-class graph layers with native expand/collapse behavior.
- **Interaction**:
  - Group label chevron click collapses/expands the group by toggling `collapsedGroupIds` in the store.
  - Alt + double-click preserves the previous “expand-select” behavior for bulk member selection.
  - Collapsed group-node chevron click expands by toggling the owning group id.
- **Render model**:
  - Collapse replaces member nodes with a derived “group node” carrying `kg:groupId`, `kg:groupMemberCount`, `kg:collapsed`.
  - Cross-group edges are aggregated and annotated with `kg:collapsedEdge` and `kg:edgeCount`.
