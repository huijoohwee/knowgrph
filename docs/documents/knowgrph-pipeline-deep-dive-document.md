# Knowgrph Pipeline Deep Dive: Universal Import-to-Render Specification

## Design Mantras

```
- [ ] Neutrality; preserve domain independence; forbid domain-coupled logic
- [ ] Determinism; stabilize derived artifacts; forbid non-idempotent recomputation
- [ ] Immutability; isolate store state; forbid renderer mutations of source data
- [ ] Performance; bound hot paths; forbid synchronous heavy computation on render
- [ ] Transparency; document pipeline stages; forbid opaque transformations
- [ ] Validation; gate build artifacts; forbid unchecked docs and schema drift
```

---

## Universal Design Principles

| Context        | Intent                            | Directive                                                                 |
|----------------|-----------------------------------|---------------------------------------------------------------------------|
| Data Flow      | Keep a unidirectional pipeline    | - [ ] Ingest → Store → Derive → Layout → Render; forbid circular updates |
| Derivation     | Compute stable render inputs      | - [ ] Derive from explicit config; forbid hidden dependencies             |
| Immutability   | Protect canonical graph state      | - [ ] Copy before render; forbid D3 mutations leaking into store          |
| Memoization    | Avoid redundant recomputation      | - [ ] Memoize by minimal deps; forbid re-derive on unrelated changes      |
| Performance    | Maintain UI responsiveness         | - [ ] Defer heavy work; forbid blocking operations in render              |
| Provenance     | Track transformation lineage       | - [ ] Attach metadata; forbid orphaned derived edges/nodes                |

---

## Pipeline Architecture

**Layer Stack**: Import → Parse → Normalize → Store → Derive (Layer Mode) → Layout → Render

**Processing Flow**: Source input → `GraphData` → Renderer graph snapshot → Scene state → Visual output

**Design Principles**: Config-driven derivation | single source of truth | bounded caches | stable references

---

## Stage Specifications

### Stage 1: Import

**From/To**: User input → Loader → raw text/bytes → enables parser selection.

- Primary entrypoint (UI action): [markdownImportAction.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/toolbar/markdownImportAction.ts)
- Local/URL loader bridge (Bottom Panel): [useMarkdownLoader.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/BottomPanel/useMarkdownLoader.ts)
- Parser loader (text → GraphData): [loader.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/parsers/loader.ts)
- Responsibility (S-V-O): Import action reads source → resolves text → hands off to parser loader → updates store.

### Stage 2: Parse

**From/To**: Raw source → Parser registry → `GraphData` → enables store ingestion.

- Parser registry: `canvas/src/features/parsers/*`
- Output contract: `GraphData { nodes, edges, metadata }` (JSON-LD compatible)

### Stage 3: Normalize

**From/To**: Parsed `GraphData` → normalizers → consistent node/edge shape → enables deterministic downstream behavior.

- Edge normalization for simulation: [utils.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/utils.ts)

### Stage 4: Store

**From/To**: `GraphData` → Zustand store → canonical application state → enables coordinated UI state.

- Store: `canvas/src/hooks/useGraphStore.ts`
- Responsibility (S-V-O): Store accepts graph data → updates state immutably → notifies subscribers.

### Stage 5: Derive (Layer Mode)

**From/To**: Canonical `GraphData` + schema layer config → derived render graph → enables filtered/augmented rendering.

- Derivation: [layerDerivation.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/lib/graph/layerDerivation.ts)
- Layer modes:
  - `document`: assigns `properties["visual:layer"]` for structural layering
  - `schema`: filters out `Document` nodes to focus on entity/schema nodes
  - `semantic`: enriches with derived similarity edges and `properties["visual:community"]`
  - `frontmatter mode` (UI flag): filters to Mermaid nodes tagged as frontmatter (`mermaidScope` / `isMermaidFrontmatter`)

**Stability directives**:

| Context      | Intent                           | Directive                                                                 |
|--------------|----------------------------------|---------------------------------------------------------------------------|
| Isolation    | Prevent store mutation            | - [ ] Render copies nodes/edges; forbid simulation mutating store objects |
| Memoization  | Avoid redundant derivation        | - [ ] Depend on `schema.layers` only; forbid recompute on unrelated schema|
| Bounded Work | Keep semantic computation bounded | - [ ] Use thresholds/top-k; forbid unbounded pair expansion               |

### Stage 6: Layout

**From/To**: Derived render graph → layout engine → node positions → enables stable viewing.

- Layout selection and caching: [positioning.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/layout/positioning.ts)
- Layout execution (seed + forces): [simulation.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/simulation.ts)
- Mermaid seeded placement (subgraph spread + centroid recenter): [mermaidSeed.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/layout/mermaidSeed.ts)
- Mermaid direction parsing (LR/RL/TB/BT): [mermaidDirection.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/layout/mermaidDirection.ts)
- Cache surface: `layoutPositionCacheByMode` keyed by `(layerMode, layoutMode)`

### Stage 7: Render

**From/To**: Positioned render graph → scene builder → DOM/SVG updates → enables interaction.

- Render entrypoint: [GraphCanvas.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas.tsx)
- Scene orchestration: [scene.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/scene.ts)
- Graph layers: [graphLayers.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/graphLayers.ts)

---

## Component Responsibility Matrix

| Stage | Path/Module | Component | Responsibility (S-V-O) | Input | Output |
|------:|-------------|-----------|-------------------------|-------|--------|
| 1 | `canvas/src/features/parsers/loader.ts` | Loader | Loader reads input → returns parse payload | Source path/bytes | Raw content |
| 2 | `canvas/src/features/parsers/*` | Parser | Parser transforms content → emits graph | Raw content | `GraphData` |
| 4 | `canvas/src/hooks/useGraphStore.ts` | Store | Store persists graph → exposes selectors | `GraphData` | State |
| 5 | `canvas/src/lib/graph/layerDerivation.ts` | Deriver | Deriver filters/enriches graph → returns render graph | State + schema | Render graph |
| 6 | `canvas/src/components/GraphCanvas/layout/positioning.ts` | Layout | Layout computes/reuses positions → returns cache decision | Render graph | Positions |
| 7 | `canvas/src/components/GraphCanvas/scene.ts` | Renderer | Renderer builds scene → updates SVG | Render graph + positions | Visual output |
