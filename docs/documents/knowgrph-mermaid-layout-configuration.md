# Knowgrph Mermaid Layout Configuration Architecture

## Design Mantras

```
- [ ] Visual Consistency; maintain unified styling; forbid layout-specific color divergence
- [ ] Interactivity; enable dragging; forbid static-only layouts
- [ ] Robustness; prevent layout crashes; forbid unstable topology handling
- [ ] Performance; use revision-aware caching; forbid redundant computations
- [ ] Configurability; externalize all parameters; forbid hardcoded layout values
- [ ] Compliance; support Mermaid syntax; forbid incompatible extensions
```
## Mermaid Layout Architecture

**Layout Stack**: Mermaid AST → Dagre Graph → Layout Computation → Position Assignment → Interactive Dragging → Canvas Rendering

**Data Flow**: GraphData → Topology Validation → Compound Hierarchy → Dagre Layout → Centering & Scaling → Group Outline Rendering → Edge Rendering → Label Rendering

**Design Principles**: Schema-Driven Styling | Dagre Network-Simplex | Revision-Based Caching | Crash Prevention | 16:9 Presentation Framing

### High-Level Components

- **Layout Engine**: `canvas/src/components/GraphCanvas/layout/mermaid.ts` implements Dagre-based hierarchical flowchart layout with robust topology validation.
- **Parser Integration**: `canvas/src/features/parsers/markdownJsonLdMermaidParser.ts` provides Mermaid AST to GraphData conversion.
- **Scene Orchestration**: `canvas/src/components/GraphCanvas/scene.ts` coordinates layout computation, rendering, and interaction.
- **Drag Behavior**: `canvas/src/components/GraphCanvas/drag.ts` implements rigid group dragging for subgraphs and member nodes.
- **Rendering Layers**: `canvas/src/components/GraphCanvas/layers/` provides nodes, links, labels, and group outlines with z-order management.

### Integration Bridge: Mermaid Layout → Canvas Renderer

| Mermaid Layout Stage          | Canvas Renderer Equivalent            | Configuration Controls                                    |
|-------------------------------|---------------------------------------|-----------------------------------------------------------|
| Topology Validation           | Graph preprocessing                   | Filter self-loops, validate edge endpoints                |
| Compound Hierarchy Setup      | Parent-child relationship mapping     | Dagre `compound` mode with `setParent` calls              |
| Dagre Layout Execution        | Position computation                  | `network-simplex` ranker, `nodesep`/`ranksep` spacing     |
| Centering & Scaling           | 16:9 frame alignment                  | `fitPadding`, `fitTargetAspectRatio` schema settings      |
| Group Outline Rendering       | Subgraph box/outline visualization    | `layout.groups` configuration with rectangular outlines   |
| Node Rendering                | Styled rectangular boxes              | Schema-driven `getNodeBaseFill`, Mermaid `classDef` support|
| Edge Rendering                | B-spline curves or direct lines       | Dynamic switching based on drag state                     |
| Interactive Dragging          | Rigid group movement                  | Subgraph centroid dragging with member node synchronization|

---

## Component Responsibility Matrix

| Layer/Subsystem       | Path/Module                                   | Component                   | Interface/Method            | Responsibility (S-V-O)                                                                        | Dependencies                          | Contracts                                         | LOC    |
|-----------------------|-----------------------------------------------|-----------------------------|-----------------------------|-----------------------------------------------------------------------------------------------|---------------------------------------|---------------------------------------------------|--------|
| Layout Engine         | `canvas/src/components/GraphCanvas/layout/mermaid.ts` | Mermaid Layout Engine | `computeMermaidLayout`      | Engine → validates topology → builds Dagre graph → computes layout → assigns positions        | Dagre, d3-hierarchy                   | Returns positioned GraphData with coordinates     | ~800   |
| Topology Validator    | `canvas/src/components/GraphCanvas/layout/mermaid.ts` | Topology Validator    | `validateTopology`          | Validator → filters self-loops → checks edge endpoints → ensures node existence → prevents crashes| GraphData                             | Returns validated nodes/edges                     | ~150   |
| Compound Setup        | `canvas/src/components/GraphCanvas/layout/mermaid.ts` | Compound Hierarchy    | `setupCompoundHierarchy`    | Setup → maps parent-child relations → assigns to Dagre graph → enables nested subgraphs       | Dagre compound mode                   | Mutates Dagre graph with parent assignments       | ~100   |
| Centering & Scaling   | `canvas/src/components/GraphCanvas/layout/mermaid.ts` | Post-Layout Processor | `centerAndScale16x9`        | Processor → computes bounding box → centers layout → scales to 16:9 frame → applies padding   | Layout config                         | Mutates node positions for presentation           | ~200   |
| Drag Handler          | `canvas/src/components/GraphCanvas/drag.ts`   | Rigid Group Drag            | `handleMermaidDrag`         | Handler → detects drag target → moves subgraph centroids → synchronizes member nodes           | Subgraph hierarchy                    | Updates node positions during drag                | ~250   |
| Group Renderer        | `canvas/src/components/GraphCanvas/layers/groups.ts` | Subgraph Renderer     | `createGroupsLayer`          | Renderer → computes bounds/outlines → draws behind nodes → manages z-order → applies padding  | Canvas 2D context                     | Draws subgraph containers                         | ~200   |
| Node Renderer         | `canvas/src/components/GraphCanvas/layers/nodes.ts` | Mermaid Node Renderer | `renderMermaidNodes`        | Renderer → applies schema colors → renders rectangles → wraps labels → supports `classDef`     | Schema config, text wrapper           | Draws styled rectangular nodes                    | ~300   |
| Edge Renderer         | `canvas/src/components/GraphCanvas/layers/links.ts` | Mermaid Edge Renderer | `renderMermaidEdges`        | Renderer → draws B-spline curves → switches to direct lines on drag → applies edge styles      | d3-shape                              | Draws styled edges with dynamic routing           | ~200   |

---

## Mermaid Layout Engine Specifications

### Dagre Layout Algorithm

**From GraphData → Positioned Layout**: Validate topology → build Dagre graph → configure network-simplex ranker → compute layout → extract positions → center and scale to 16:9 frame.

**Configuration Schema**:

```yaml
layout.mode:
  scope: layout_global
  type: string (enum: "force" | "radial" | "tree" | "mermaid")
  mutability: runtime_configurable
  validation: valid layout mode
  impact: selects Mermaid hierarchical layout engine

layout.mermaid.ranker:
  scope: layout_specific
  type: string (enum: "network-simplex" | "tight-tree" | "longest-path")
  mutability: deployment_configurable
  validation: valid Dagre ranker algorithm
  impact: determines node ranking algorithm (default: "network-simplex" for stability)

layout.mermaid.orientation:
  scope: layout_specific
  type: string (enum: "vertical" | "horizontal")
  mutability: runtime_configurable
  validation: enum value
  impact: controls flow direction (vertical: TB, horizontal: LR)

layout.mermaid.direction:
  scope: layout_specific
  type: string (enum: "source-target" | "target-source")
  mutability: runtime_configurable
  validation: enum value
  impact: reverses layout direction (default: "source-target")

layout.mermaid.separation:
  scope: layout_specific
  type: number
  mutability: runtime_configurable
  validation: must be positive
  impact: spacing multiplier for `nodesep`/`ranksep` (default: 3.0)
```

**Processing Flow**:

| Stage                    | Input                          | Output                         | Responsibility                                              | Performance Consideration                    |
|--------------------------|--------------------------------|--------------------------------|-------------------------------------------------------------|----------------------------------------------|
| Topology Validation      | GraphData nodes/edges          | Validated nodes/edges          | Filter self-loops, validate endpoints, check node existence | O(m) edge validation                         |
| Dagre Graph Construction | Validated nodes/edges          | Dagre graph object             | Add nodes/edges to Dagre, set attributes                    | O(n + m) graph construction                  |
| Compound Hierarchy Setup | Subgraph parent-child data     | Dagre with compound structure  | Set parent relationships for nested subgraphs               | O(k) where k = subgraphs                     |
| Spacing Configuration    | Separation multiplier          | `nodesep`/`ranksep` values     | Compute spacing to avoid overlap and maximize frame usage   | O(1) spacing calculation                     |
| Dagre Layout Execution   | Configured Dagre graph         | Node positions                 | Run network-simplex ranker, compute coordinates             | O((n+m) log n) Dagre complexity              |
| Position Extraction      | Dagre graph with layout        | GraphData with coordinates     | Copy positions from Dagre nodes to GraphData                | O(n) position copying                        |
| Centering & Scaling      | Positioned GraphData           | 16:9-centered layout           | Compute bbox, center, scale to fit 1920×1080                | O(n) position transformation                 |

**Design Compliance**:

| Context               | Intent                        | Directive                                                                                   | Module/Component          | Function/Method      | Input                     | Output                | Decision Logic                          |
|-----------------------|-------------------------------|---------------------------------------------------------------------------------------------|---------------------------|----------------------|---------------------------|-----------------------|-----------------------------------------|
| Topology Validation   | Prevent layout crashes        | - [ ] Filter self-loops; validate edge endpoints; forbid invalid topology                  | Topology validator        | `validateTopology`   | nodes, edges              | validated edges       | edge.source !== edge.target + endpoint exists|
| Dagre Construction    | Build layout graph            | - [ ] Create Dagre graph; add nodes/edges; forbid missing elements                         | Layout engine             | `buildDagreGraph`    | validated graph           | Dagre graph object    | dagre.Graph() + setNode/setEdge calls   |
| Compound Setup        | Enable nesting                | - [ ] Set parent relationships; enable compound mode; forbid flat hierarchies              | Layout engine             | `setupCompound`      | subgraph hierarchy        | Dagre with parents    | graph.setParent(child, parent) calls    |
| Spacing Calculation   | Optimize layout density       | - [ ] Compute nodesep/ranksep; account for label padding; forbid overlap                   | Layout engine             | `computeSpacing`     | separation multiplier     | spacing values        | base * multiplier + label padding       |
| Layout Execution      | Run Dagre algorithm           | - [ ] Execute dagre.layout; extract positions; forbid layout failures                      | Layout engine             | `executeDagre`       | Dagre graph               | positioned graph      | dagre.layout(graph) invocation          |
| Centering             | Align to 16:9 frame           | - [ ] Compute bbox center; translate to frame center; forbid off-center layouts            | Post-processor            | `centerLayout`       | positions, frame dims     | centered positions    | translate by (frameCenter - bboxCenter) |

---

## Visual Consistency Specifications

### Schema-Driven Color Palette

**Unified Styling**: Mermaid nodes use same `getNodeBaseFill` function as Force/Radial layouts → ensures color consistency across layout modes.

**Configuration Schema**:

```yaml
schema.nodeColors:
  scope: schema_global
  type: object (type → color mapping)
  mutability: deployment_configurable
  validation: valid CSS colors or hex codes
  impact: determines node fill colors across all layout modes

schema.nodeStroke:
  scope: schema_global
  type: object (type → stroke config)
  mutability: deployment_configurable
  validation: {color: string, width: number}
  impact: node border styling (default: {color: "#333", width: 1})

mermaid.classDef:
  scope: mermaid_specific
  type: object (class → style mapping)
  mutability: runtime_configurable (from frontmatter)
  validation: {fill: color, stroke: color, stroke-width: number}
  impact: overrides schema colors for specific node classes
```

**Color Resolution Priority**:

| Priority | Source                  | Example                                      | Override Behavior                           |
|----------|-------------------------|----------------------------------------------|---------------------------------------------|
| 1        | Mermaid `classDef`      | `classDef highlight fill:#ff0,stroke:#f00`  | Highest priority, overrides schema          |
| 2        | Schema `nodeColors`     | `{MermaidNode: "#4A90E2"}`                   | Applies when no `classDef` assigned         |
| 3        | Default palette         | `getNodeBaseFill` fallback                   | Applies when type not in schema             |

**Design Compliance**:

| Context               | Intent                        | Directive                                                                                   | Module/Component          | Function/Method      | Input                     | Output                | Decision Logic                          |
|-----------------------|-------------------------------|---------------------------------------------------------------------------------------------|---------------------------|----------------------|---------------------------|-----------------------|-----------------------------------------|
| Color Resolution      | Apply style hierarchy         | - [ ] Check `classDef` first; fall back to schema; forbid ignoring hierarchy               | Node renderer             | `resolveNodeColor`   | node, schema, classDef    | color string          | priority-based lookup (classDef → schema → default)|
| Schema Application    | Ensure cross-layout consistency | - [ ] Use `getNodeBaseFill` for Mermaid; forbid Mermaid-specific color logic             | Node renderer             | `applySchemaColor`   | node, schema              | color string          | getNodeBaseFill(node.type, schema)      |
| ClassDef Parsing      | Extract frontmatter styles    | - [ ] Parse `classDef` statements; build style map; forbid malformed styles                | Mermaid parser            | `parseClassDef`      | Mermaid code              | classDef map          | regex extraction + CSS parsing          |

---

### Frontmatter `classDef` Support

**From Mermaid Frontmatter → Custom Styles**: Parse `classDef` statements → extract fill/stroke/width → apply to nodes with matching `class` assignments.

**Example Mermaid Frontmatter**:

```mermaid
graph TD
  classDef highlight fill:#ff0,stroke:#f00,stroke-width:3px
  classDef subtle fill:#eee,stroke:#999

  A[Node A]:::highlight
  B[Node B]:::subtle
  C[Node C]
```

**Resulting Style Application**:

```json
{
  "classDef": {
    "highlight": {"fill": "#ff0", "stroke": "#f00", "stroke-width": 3},
    "subtle": {"fill": "#eee", "stroke": "#999"}
  },
  "nodes": [
    {"id": "A", "class": "highlight"},
    {"id": "B", "class": "subtle"},
    {"id": "C"}  // Uses schema default
  ]
}
```

**Design Compliance**:

| Context               | Intent                        | Directive                                                                                   | Module/Component          | Function/Method      | Input                     | Output                | Decision Logic                          |
|-----------------------|-------------------------------|---------------------------------------------------------------------------------------------|---------------------------|----------------------|---------------------------|-----------------------|-----------------------------------------|
| ClassDef Parsing      | Extract style definitions     | - [ ] Parse `classDef` lines; extract CSS properties; forbid malformed syntax              | Mermaid parser            | `parseClassDef`      | Mermaid text              | classDef object       | regex match + CSS property extraction   |
| Class Assignment      | Link nodes to styles          | - [ ] Parse `:::className` syntax; assign to nodes; forbid missing class references        | Mermaid parser            | `assignNodeClasses`  | Mermaid AST               | nodes with class props| AST traversal + class extraction        |
| Style Application     | Apply custom styles           | - [ ] Lookup class in classDef; apply fill/stroke; forbid ignoring custom styles           | Node renderer             | `applyClassDefStyle` | node, classDef map        | applied styles        | map lookup + style override             |

---

## Interactive Dragging Specifications

### Rigid Group Dragging

**From Drag Event → Synchronized Movement**: Detect drag target (node or subgraph) → determine affected group → move all members rigidly → preserve relative positions.

**Configuration Schema**:

```yaml
drag.mermaid.rigidGroups:
  scope: drag_behavior
  type: boolean
  mutability: deployment_configurable
  validation: boolean
  impact: enables rigid group dragging for subgraphs (default: true)

drag.mermaid.persistPositions:
  scope: drag_behavior
  type: boolean
  mutability: deployment_configurable
  validation: boolean
  impact: disables physics forces to keep dragged positions fixed (default: true)
```

**Drag Behavior Patterns**:

| Drag Target           | Affected Nodes                                  | Movement Pattern                                |
|-----------------------|-------------------------------------------------|-------------------------------------------------|
| Subgraph centroid     | All member nodes + nested subgraphs             | Entire group moves together, preserving spacing |
| Member node           | Parent subgraph + all sibling nodes             | Prevents dislocating node from container        |
| Standalone node       | Only the dragged node                           | Independent movement                            |

**Processing Flow**:

| Stage                    | Input                          | Output                         | Responsibility                                              | Performance Consideration                    |
|--------------------------|--------------------------------|--------------------------------|-------------------------------------------------------------|----------------------------------------------|
| Drag Target Detection    | Mouse event, canvas position   | Target node or subgraph        | Identify clicked entity (node vs subgraph centroid)         | O(1) raycasting with spatial index           |
| Group Membership Lookup  | Target ID, hierarchy           | Affected node set              | Find all members if subgraph, or parent+siblings if member  | O(n) worst case for flat iteration           |
| Delta Calculation        | Drag start/current positions   | Movement vector                | Compute (dx, dy) from drag start to current                 | O(1) vector subtraction                      |
| Position Update          | Affected nodes, delta          | Updated positions              | Apply delta to all affected node positions                  | O(k) where k = affected nodes                |
| Edge Redraw              | Updated node positions         | Redrawn edges                  | Switch to direct line mode during drag for performance      | O(m) edge drawing                            |

**Design Compliance**:

| Context               | Intent                        | Directive                                                                                   | Module/Component          | Function/Method      | Input                     | Output                | Decision Logic                          |
|-----------------------|-------------------------------|---------------------------------------------------------------------------------------------|---------------------------|----------------------|---------------------------|-----------------------|-----------------------------------------|
| Target Detection      | Identify drag entity          | - [ ] Raycast to find node or subgraph; forbid missing drag targets                        | Drag handler              | `detectDragTarget`   | mouse position, scene     | target entity         | spatial query + entity type check       |
| Member Lookup         | Find affected nodes           | - [ ] Query parent-child relations; forbid incomplete group detection                      | Drag handler              | `findAffectedNodes`  | target, hierarchy         | node set              | recursive parent/child traversal        |
| Rigid Movement        | Preserve relative positions   | - [ ] Apply uniform delta to all members; forbid individual adjustments                    | Drag handler              | `moveRigidGroup`     | nodes, delta              | updated positions     | positions.map(p => p + delta)           |
| Edge Mode Switch      | Optimize drag performance     | - [ ] Switch to direct lines during drag; revert to B-splines on release; forbid slow curves| Edge renderer             | `switchEdgeMode`     | drag state                | edge rendering mode   | conditional curve vs line rendering     |

---

## Crash Prevention and Robustness

### Topology Validation

**From Potentially Invalid Graph → Safe Topology**: Filter self-loops → validate edge endpoints → ensure node existence → prevent Dagre `networkSimplex` crashes.

**Common Crash Scenarios**:

| Crash Scenario                | Detection Method                          | Prevention Strategy                           |
|-------------------------------|-------------------------------------------|-----------------------------------------------|
| Self-loop (A → A)             | Check `edge.source === edge.target`       | Filter out self-loops before Dagre            |
| Dangling edge (A → missing)   | Check `nodes.has(edge.target)`            | Filter edges with non-existent endpoints      |
| Undefined rank                | Dagre ranker failure on cyclic graphs     | Use `network-simplex` ranker for robustness   |
| Missing compound parent       | Check `parent` exists before `setParent`  | Validate parent existence before assignment   |

**Configuration Schema**:

```yaml
layout.mermaid.validateTopology:
  scope: layout_specific
  type: boolean
  mutability: deployment_configurable
  validation: boolean
  impact: enables strict topology validation (default: true)

layout.mermaid.strictCompound:
  scope: layout_specific
  type: boolean
  mutability: deployment_configurable
  validation: boolean
  impact: validates compound parent existence (default: true)
```

**Design Compliance**:

| Context               | Intent                        | Directive                                                                                   | Module/Component          | Function/Method      | Input                     | Output                | Decision Logic                          |
|-----------------------|-------------------------------|---------------------------------------------------------------------------------------------|---------------------------|----------------------|---------------------------|-----------------------|-----------------------------------------|
| Self-Loop Detection   | Prevent ranker instability    | - [ ] Filter edges where source === target; forbid passing self-loops to Dagre             | Topology validator        | `filterSelfLoops`    | edges                     | filtered edges        | edges.filter(e => e.source !== e.target)|
| Endpoint Validation   | Prevent dangling edges        | - [ ] Check both endpoints exist in node set; forbid invalid edges                         | Topology validator        | `validateEndpoints`  | edges, nodes              | filtered edges        | edges.filter(e => nodes.has(e.source) && nodes.has(e.target))|
| Parent Validation     | Prevent compound errors       | - [ ] Verify parent exists before setParent; forbid missing parent references              | Compound setup            | `validateParents`    | child-parent pairs, nodes | validated pairs       | pairs.filter(p => nodes.has(p.parent))  |
| Ranker Selection      | Use stable algorithm          | - [ ] Use `network-simplex` ranker; forbid `tight-tree` (less stable)                      | Layout engine             | `selectRanker`       | config                    | ranker name           | config.ranker || "network-simplex"      |

---

## Performance Optimization Specifications

### Revision-Aware Caching

**From Graph Changes → Cached Layouts**: Track topology revision (`nodesRevision`, `edgesRevision`) → use as cache key → skip redundant Dagre calculations.

**Configuration Schema**:

```yaml
layout.mermaid.enableCaching:
  scope: layout_specific
  type: boolean
  mutability: deployment_configurable
  validation: boolean
  impact: enables layout position caching (default: true)

layout.mermaid.cacheKey:
  scope: runtime_internal
  type: string
  mutability: runtime_computed
  validation: format: `${nodesRev}-${edgesRev}-${layoutConfig}`
  impact: determines cache hit/miss for layout computation
```

**Cache Key Construction**:

```typescript
const cacheKey = `${graph.nodesRevision}-${graph.edgesRevision}-${JSON.stringify({
  orientation: config.orientation,
  direction: config.direction,
  separation: config.separation
})}`;
```

**Cache Behavior**:

| Scenario                      | Cache Action                          | Performance Gain                    |
|-------------------------------|---------------------------------------|-------------------------------------|
| No graph changes, same config | Cache hit → skip Dagre calculation    | ~100ms saved on medium graphs       |
| Node positions changed        | Positions not in cache key → cache hit| Layout reused, only visual update   |
| Edges added/removed           | `edgesRevision` incremented → miss   | Recompute layout                    |
| Config changed                | Cache key different → miss            | Recompute with new parameters       |

**Design Compliance**:

| Context               | Intent                        | Directive                                                                                   | Module/Component          | Function/Method      | Input                     | Output                | Decision Logic                          |
|-----------------------|-------------------------------|---------------------------------------------------------------------------------------------|---------------------------|----------------------|---------------------------|-----------------------|-----------------------------------------|
| Cache Key Generation  | Create unique layout key      | - [ ] Include topology revisions and config; forbid incomplete keys                         | Layout engine             | `generateCacheKey`   | graph revisions, config   | cache key string      | template string with rev + config hash  |
| Cache Lookup          | Check for existing layout     | - [ ] Lookup cache by key; return if exists; forbid stale cache hits                       | Layout engine             | `lookupCache`        | cache key                 | cached layout or null | Map.get(cacheKey)                       |
| Cache Storage         | Save computed layout          | - [ ] Store positions by cache key; forbid unbounded cache growth                          | Layout engine             | `storeCache`         | cache key, positions      | void                  | Map.set(cacheKey, positions) with LRU   |
| Cache Invalidation    | Clear on graph replacement    | - [ ] Clear cache on new graph load; forbid stale layout application                       | Graph store               | `clearLayoutCache`   | graph load event          | void                  | layoutCache.clear()                     |

---

### Memoized Text Wrapping

**From Repeated Label Wrapping → Cached Results**: Memoize text wrapping function → cache by (text, width) key → reduce CPU usage during rendering.

**Configuration Schema**:

```yaml
rendering.memoization.enabled:
  scope: rendering_global
  type: boolean
  mutability: deployment_configurable
  validation: boolean
  impact: enables function memoization (default: true)

rendering.memoization.maxCacheSize:
  scope: rendering_global
  type: number
  mutability: deployment_configurable
  validation: must be positive integer
  impact: max cached results before LRU eviction (default: 1000)
```

**Memoization Implementation**:

```typescript
const wrapCache = new Map<string, string[]>();

function wrapText(text: string, maxWidth: number): string[] {
  const key = `${text}:${maxWidth}`;
  if (wrapCache.has(key)) {
    return wrapCache.get(key)!;
  }
  
  const wrapped = computeWrappedLines(text, maxWidth);
  
  if (wrapCache.size >= MAX_CACHE_SIZE) {
    const firstKey = wrapCache.keys().next().value;
    wrapCache.delete(firstKey); // LRU eviction
  }
  
  wrapCache.set(key, wrapped);
  return wrapped;
}
```

**Performance Gain**: ~50% reduction in label rendering time for graphs with repeated text.

**Design Compliance**:

| Context               | Intent                        | Directive                                                                                   | Module/Component          | Function/Method      | Input                     | Output                | Decision Logic                          |
|-----------------------|-------------------------------|---------------------------------------------------------------------------------------------|---------------------------|----------------------|---------------------------|-----------------------|-----------------------------------------|
| Cache Key Generation  | Create unique wrap key        | - [ ] Combine text and width; forbid width-agnostic keys                                   | Text wrapper              | `makeWrapKey`        | text, maxWidth            | cache key string      | `${text}:${maxWidth}` template          |
| Cache Lookup          | Retrieve cached wrapping      | - [ ] Check cache by key; return if exists; forbid unnecessary recomputation               | Text wrapper              | `getCachedWrap`      | cache key                 | wrapped lines or null | Map.get(key)                            |
| Wrapping Computation  | Compute line breaks           | - [ ] Measure text; break at word boundaries; forbid character-level breaks                | Text wrapper              | `computeWrapping`    | text, maxWidth            | line array            | canvas measureText + word splitting     |
| Cache Storage         | Save wrapping result          | - [ ] Store in cache; evict LRU on overflow; forbid unbounded growth                       | Text wrapper              | `cacheWrap`          | key, wrapped lines        | void                  | Map.set with size check + LRU eviction  |

---

## Configuration Reference

### Layout Configuration Options

**Configuration Schema (Complete)**:

```yaml
layout.mode:
  scope: layout_global
  type: string
  values: ["force", "radial", "tree", "mermaid"]
  default: "force"
  impact: selects layout algorithm

layout.mermaid.orientation:
  scope: mermaid_specific
  type: string
  values: ["vertical", "horizontal"]
  default: "vertical"
  impact: TB (vertical) or LR (horizontal) flow

layout.mermaid.direction:
  scope: mermaid_specific
  type: string
  values: ["source-target", "target-source"]
  default: "source-target"
  impact: reverses layout direction

layout.mermaid.separation:
  scope: mermaid_specific
  type: number
  default: 3.0
  validation: must be positive
  impact: spacing multiplier for nodesep/ranksep

layout.fitPadding:
  scope: layout_global
  type: number
  default: 80
  validation: must be non-negative
  impact: padding around graph in pixels

layout.fitUseCentroid:
  scope: layout_global
  type: boolean
  default: true
  impact: blends centroid with bbox for centering

layout.fitDetectClusters:
  scope: layout_global
  type: boolean
  default: true
  impact: enables outlier rejection for focus

layout.fitTargetAspectRatio:
  scope: layout_global
  type: number
  default: 1.777
  impact: target aspect ratio (16:9)

layout.fitEnforceAspectRatio:
  scope: layout_global
  type: boolean
  default: true
  impact: enforces target aspect ratio

layout.mermaid.renderOrder:
  scope: mermaid_specific
  type: object
  default: {}
  impact: z-order control for deterministic rendering

layout.rectNodes.maxZoomMinimapWidthRatio:
  scope: layout_global
  type: number
  default: 5
  validation: clamped to [1, 50]
  impact: node width at max zoom as minimap multiple

layout.rectNodes.maxZoomMinimapHeightRatio:
  scope: layout_global
  type: number
  default: 2.5
  validation: derived as widthRatio / 2
  impact: node height maintaining 2:1 aspect ratio
```

---

## Testing & Quality Standards

**Test Coverage Metrics**

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Topology Validation  | Prevent layout crashes          | - [ ] Test self-loop filtering; validate endpoint checks; forbid crash scenarios          |
| Compound Hierarchy   | Ensure nesting support          | - [ ] Test nested subgraphs; verify parent assignments; forbid flat rendering             |
| Cache Effectiveness  | Verify performance gains        | - [ ] Test cache hits on stable graphs; verify miss on changes; forbid cache corruption   |

**Test Categories**:

- **Unit Tests**: Topology validator, cache key generation, text wrapping memoization.
- **Integration Tests**: Full Mermaid → Dagre → rendering pipeline.
- **Performance Tests**: Layout computation time, cache hit rates, memoization effectiveness.

**Quality Gates**:

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Layout Stability     | Ensure crash-free execution     | - [ ] Test with invalid topologies; verify no Dagre crashes; forbid unhandled errors      |
| Visual Consistency   | Maintain cross-layout styling   | - [ ] Verify Mermaid colors match Force mode; forbid layout-specific divergence           |
| Performance Bounds   | Keep layout fast                | - [ ] Target <500ms for 1000-node graphs; forbid slow Dagre configurations                |

---

## Repository Health Checklist

**Layout Engine Health**:

| Context              | Status | Directive                                                                                   |
|----------------------|--------|---------------------------------------------------------------------------------------------|
| Topology Validation  | ☐      | - [ ] All graphs validated before Dagre; forbid passing invalid topology                  |
| Compound Support     | ☐      | - [ ] Nested subgraphs correctly handled; forbid compound mode disabled                    |
| Ranker Stability     | ☐      | - [ ] Using `network-simplex` ranker; forbid switching to less stable algorithms          |

**Performance Health**:

| Context              | Status | Directive                                                                                   |
|----------------------|--------|---------------------------------------------------------------------------------------------|
| Cache Hit Rate       | ☐      | - [ ] Monitor cache effectiveness; target >80% hit rate for stable graphs                 |
| Memoization Usage    | ☐      | - [ ] Text wrapping memoized; forbid uncached repeated computations                        |
| Layout Time          | ☐      | - [ ] Measure Dagre execution time; optimize if >500ms for medium graphs                  |

**Visual Quality Health**:

| Context              | Status | Directive                                                                                   |
|----------------------|--------|---------------------------------------------------------------------------------------------|
| Color Consistency    | ☐      | - [ ] Verify Mermaid uses schema colors; forbid hardcoded color divergence                 |
| Edge Rendering       | ☐      | - [ ] B-splines smooth, direct lines during drag; forbid incorrect mode switching         |
| Group Outline Visibility | ☐      | - [ ] Subgraph outlines render behind nodes; forbid z-order issues                         |

## Anti-Patterns (Forbidden)

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Hardcoded Colors     | Maintain schema consistency     | - [ ] Use `getNodeBaseFill`; forbid Mermaid-specific color constants                      |
| Uncached Layouts     | Optimize performance            | - [ ] Use revision-aware caching; forbid recomputing unchanged layouts                     |
| Unstable Rankers     | Prevent crashes                 | - [ ] Use `network-simplex`; forbid `tight-tree` without validation                        |
| Unbounded Caches     | Prevent memory leaks            | - [ ] Implement LRU eviction; forbid unlimited cache growth                                |
| Missing Validation   | Ensure robustness               | - [ ] Validate topology before Dagre; forbid passing invalid graphs                        |

## Codebase Integration Summary

### Key Implementation Files

| File Path                                                      | Responsibility                                    | LOC    |
|----------------------------------------------------------------|---------------------------------------------------|--------|
| `canvas/src/components/GraphCanvas/layout/mermaid.ts`          | Core Mermaid layout engine with Dagre integration | ~800   |
| `canvas/src/features/parsers/markdownJsonLdMermaidParser.ts`   | Mermaid syntax parsing and AST → GraphData        | ~600   |
| `canvas/src/components/GraphCanvas/scene.ts`                   | Scene orchestration and rendering coordination    | ~1200  |
| `canvas/src/components/GraphCanvas/sceneHandlers.ts`           | Event handling and interaction management         | ~400   |
| `canvas/src/components/GraphCanvas/layers/labels.ts`           | Label rendering with text wrapping                | ~300   |
| `canvas/src/components/GraphCanvas/drag.ts`                    | Drag behavior including rigid group movement      | ~500   |
| `canvas/src/components/GraphCanvas/layers/nodes.ts`            | Node rendering with schema styling                | ~400   |
| `canvas/src/components/GraphCanvas/layers/links.ts`            | Edge rendering with B-splines and direct lines    | ~350   |
| `canvas/src/components/GraphCanvas/layers/groups.ts`           | Subgraph container rendering                      | ~200   |

## Configuration Examples

See [knowgrph-mermaid-layout-configuration-examples.md](file:///Users/huijoohwee/Documents/GitHub/knowgrph/docs/documents/knowgrph-mermaid-layout-configuration-examples.md).
