# Knowgrph Disjoint Force + Frontmatter Document

## Design Mantras

```
- [ ] Natural Disjoint; separate components softly; forbid rigid grid placement
- [ ] Seeded Stability; warm-start via clustering; forbid random first-frame chaos
- [ ] Frontmatter Isolation; scope frontmatter to Mermaid-only; forbid mixed graph scopes
- [ ] Deterministic Anchors; place component anchors deterministically; forbid unstable ordering
- [ ] Configurable Forces; tune via schema.layout.forces; forbid hidden constants
- [ ] Domain Neutrality; use general algorithms; forbid domain-tuned heuristics
```

---

## Universal Design Principles

| Context         | Intent                              | Directive                                                                 |
|----------------|-------------------------------------|---------------------------------------------------------------------------|
| Determinism    | Stable layout across re-renders      | - [ ] Normalize ids + order components; forbid unstable iteration order   |
| Separation     | Avoid component collapse             | - [ ] Use component anchors + positioning forces; forbid overlap-by-default |
| Performance    | Avoid wasteful recalculation         | - [ ] Warm-start when stable; forbid unnecessary simulation restarts      |
| Configuration  | Externalize behavior                 | - [ ] Declare defaults in schema; forbid inline magic constants           |
| Locality       | Bound responsibility boundaries      | - [ ] Keep component packing + overlap in focused modules                 |
| Reliability    | Ensure frontmatter scope correctness | - [ ] Filter to Mermaid frontmatter nodes in frontmatter mode             |

---

## Canvas Layout Architecture

**Stack**: Markdown → Graph Derivation → Force Seed → Force Simulation → Canvas Render

**Key idea**: For disconnected graphs, use D3 positioning forces (`forceX`/`forceY`) to softly attract nodes (or components) to targets, instead of using uniform translation-based centering that can cause counter-motion artifacts during interaction.

**Core modules**

- Disjoint component anchors: [disjoint.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/layout/disjoint.ts)
- Overlap resolution (native broadphase): [overlap.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/layout/overlap.ts)
- Simulation orchestration: [simulation.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/simulation.ts)
- Frontmatter scoping: [layerDerivation.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/lib/graph/layerDerivation.ts)

---

## Module Specifications

### Module: Disjoint Component Anchors

**Responsibility**: Compute connected components → compute per-component target anchors (spiral packing) → return lookup maps.

**Interface**: `computeDisjointComponentTargets({ nodes, edges, width, height, schema, padding })`

**Decision logic**

- Component detection: undirected connectivity over `edges` (BFS/DFS).
- Deterministic ordering: sort by `(size desc, minId asc)`.
- Anchor placement: deterministic spiral search with overlap rejection; larger components placed earlier.

**Implementation**: [computeDisjointComponentTargets](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/layout/disjoint.ts)

### Module: Force Simulation (Force Mode)

**Responsibility**: Seed node positions → apply forces → return `d3.forceSimulation`.

**Key forces**

- Link cohesion: `d3.forceLink`
- Repulsion: `d3.forceManyBody`
- Positioning: `d3.forceX` + `d3.forceY` targeting component anchors when `disjointComponents` is enabled
- Overlap: `d3.forceCollide` (radius) + native `bboxCollide` (label-aware AABB)

**Implementation**: [buildSimulation](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/simulation.ts)

---

## Configuration Schema (Layout Forces)

Defined in [schemaTypes.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/lib/graph/schemaTypes.ts) and defaulted in [schema.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/lib/graph/schema.ts).

```yaml
layout:
  mode: force
  forces:
    disjointComponents: boolean        # default true (enabled unless explicitly false)
    disjointStrength: number           # scales anchor attraction
    centerStrength: number             # also contributes to anchor attraction

    bboxCollide: boolean               # default true
    bboxCollideStrength: number        # default 0.7
    bboxCollidePadding: number         # default 10
    bboxCollideIterations: number      # default 1
```

---

## Component Responsibility Matrix

| Layer/Subsystem | Path/Module | Component | Interface/Method | Responsibility (S-V-O) | Contracts |
|---|---|---|---|---|---|
| Layout | [disjoint.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/layout/disjoint.ts) | Component anchors | computeDisjointComponentTargets | Module computes anchors → separates components → returns targets | Deterministic ordering |
| Layout | [overlap.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/layout/overlap.ts) | Overlap force | createBboxCollideForce | Force resolves overlaps → adjusts velocities → respects pinned nodes | Label-aware AABB |
| Layout | [simulation.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/simulation.ts) | Simulation | buildSimulation | Builder constructs forces → seeds nodes → returns simulation | Honors schema.layout.forces |
| Derivation | [layerDerivation.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/lib/graph/layerDerivation.ts) | Frontmatter filter | filterGraphToFrontmatterMermaid | Filter scopes graph → keeps Mermaid frontmatter → returns scoped graph | Mermaid-only scope |

---

## Data Flow

**Pipeline**: Markdown → (Frontmatter toggle) → Graph Derivation → Seed (cluster-aware) → Disjoint Anchors → Force Simulation → Render

| Stage | Input | Output | Performance Consideration |
|---|---|---|---|
| Scope | frontmatterModeEnabled | scoped graph | O(n+e) filter |
| Seed | nodes | seeded positions | avoids first-frame chaos |
| Disjoint | nodes + edges | component targets | component count k ≪ n |
| Simulate | nodes + edges + schema | stable positions | warm-start when stable |

---

## Design Decisions & Trade-offs

| Decision | Rationale | Pros | Cons | Mitigation |
|---|---|---|---|---|
| Soft component anchors via forceX/Y | Natural separation; stable during drag | organic, tunable | requires target placement | deterministic spiral packing |
| Native AABB overlap | Handle labels + rect nodes better than radius | fewer label collisions | extra per-tick work | quadtree broadphase + low iterations |
| Keep seed step | Preserve readability at init | stable first-frame | heuristic | only used when skipInitialLayout is false |

---

## Anti-Patterns (Forbidden)

| Context | Intent | Directive |
|---|---|---|
| Rigid placement | preserve natural aesthetics | - [ ] Forbid grid-locking components at init |
| Copied algorithms | keep codebase original | - [ ] Forbid copy-paste from external collision repos |
| Untyped config | keep schema authoritative | - [ ] Forbid adding force keys without schemaTypes updates |
| Render loops | keep UI responsive | - [ ] Forbid store updates from simulation tick |
