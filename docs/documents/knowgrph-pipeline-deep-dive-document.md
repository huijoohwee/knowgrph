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

## Pipeline Map (Loadable Graph)

**Artifact**: `docs/assets/knowgrph-canvas-import-parse-derive-layout-render-pipeline-map.jsonld`

**Goal**: Load the repo’s own pipeline map into Canvas (nodes=modules/functions; edges=calls/artifacts) and use node `reference/documentUrl` links to jump to source.

**Load steps**:
- Toolbar → Source Files → Import → JSON‑LD → Local → select the JSON‑LD file above
- Optional: apply `schema-config/knowgrph-universal-schema-config.jsonld` to get pipeline-friendly styles (`contains/calls/invokes/next`)

---

## Stage Specifications

### Stage 1: Import

**From/To**: User input → Loader → raw text/bytes → enables parser selection.

- UI import entrypoints (format-specific):
  - Markdown: [markdownImportAction.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/toolbar/markdownImportAction.ts)
  - HTML → Markdown: [htmlImportAction.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/toolbar/htmlImportAction.ts)
  - PDF → Markdown: [pdfImportAction.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/toolbar/pdfImportAction.ts)
  - YouTube → Markdown (+ transcript JSON): [youtubeImportAction.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/toolbar/youtubeImportAction.ts) (Source Files → YouTube)
  - JSON/JSON-LD/CSV: [jsonImportAction.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/toolbar/jsonImportAction.ts)
- Local/URL loader bridge (Bottom Panel): [useMarkdownLoader.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/BottomPanel/useMarkdownLoader.ts)
- Parser loader (text → GraphData): [loader.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/parsers/loader.ts)
- Responsibility (S-V-O): Import action reads source → resolves text → hands off to parser loader → updates store.

**YouTube import**:
- Status: Active. The import action calls `/__youtube_transcript` (Vite middleware) which runs `python3 -m knowgrph_parser youtube --emit json` to produce:
  - Markdown for Markdown Editor/Preview/Slides
  - Transcript JSON for Bottom Panel JSON Editor (`jsonSourceDocumentText`)

### Stage 2: Parse

**From/To**: Raw source → Parser registry → `GraphData` → enables store ingestion.

- Parser registry and execution:
  - Registry: [registry.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/parsers/registry.ts)
  - Built-in parser specs: [default.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/parsers/default.ts)
  - Loader entry: [loader.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/parsers/loader.ts)
- Worker fast-path (for production/off-main-thread):
  - Client: [parseWorker.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/lib/graph/parseWorker.ts)
  - Worker: [graphParser.worker.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/workers/graphParser.worker.ts)
  - Bounded execution: worker requests are guarded by a hard timeout; the worker is terminated on completion, error, or timeout (no indefinite hangs).
- Format adapter for `.csv/.json/.jsonld` and workflow bundles:
  - Adapter: [adapter.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/lib/graph/io/adapter.ts)
- JSON-LD edge inference alignment (no surprise edges):
  - `@context` keys with `{"@type":"@id"}` are eligible to become edges
  - `metadata.jsonLdMapping.contextEdgeProperties` can be used as an explicit allow-list for relation keys when the context is incomplete
  - Implementation: [parseJsonLd](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/lib/graph/jsonld/parse.ts)
- Output contract (render + storage):
  - `GraphData { type, context?, metadata?, nodes, edges }`: [types.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/lib/graph/types.ts)

### Stage 3: Normalize

**From/To**: Parsed `GraphData` → normalizers → consistent node/edge shape → enables deterministic downstream behavior.

- Edge normalization for simulation: [utils.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/utils.ts)

### Stage 4: Store

**From/To**: `GraphData` → Zustand store → canonical application state → enables coordinated UI state.

- Store: `canvas/src/hooks/useGraphStore.ts`
- Canonical commit point:
  - Store slice: [graphDataSlice.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/hooks/store/graphDataSlice.ts)
  - `setGraphData` enforces invariants (e.g. filters dangling edges) and bumps `graphDataRevision`.
- Derivations coupled to commit:
  - Derived field discovery: [graphFields.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/graph-fields/graphFields.ts)
  - Sync visible columns and custom fields: [graphDataSliceUtils.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/hooks/store/graphDataSliceUtils.ts)
- Responsibility (S-V-O): Store accepts graph data → validates edges → syncs derived fields → notifies subscribers.

### Stage 5: Derive (Layer Mode)

**From/To**: Canonical `GraphData` + schema layer config → derived render graph → enables filtered/augmented rendering.

- Derivation: [layerDerivation.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/lib/graph/layerDerivation.ts)
- Layer modes:
  - `document`: assigns `properties["visual:layer"]` for structural layering
  - `keyword` (semantic mode): derives a keyword graph from active document text (or node labels as fallback) where Subject/Object/Entity keywords become nodes and Verb/Predicate/Relationship keywords become edges; removes common stopwords using the NLTK English stopword list; caches derived graphs by stable text hash; sets `properties["visual:nodeSize"]` by keyword frequency and `properties["visual:width"]` by edge strength for renderer reuse; supports runtime scaling via `schema.three.keywordNodeSizeScale` / `schema.three.keywordEdgeWidthScale`; maps `visual:community` → `visual:layer` so 2D groups and 3D Z-layering can stay consistent; merges media-capable nodes from the base graph so the media overlay toggle remains effective
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
- Cache surface: `layoutPositionCacheByMode` keyed by `(semanticMode, frontmatterMode, layoutMode)` (e.g. `document:default:force`, `keyword:frontmatter:radial`)

### Stage 7: Render

**From/To**: Positioned render graph → scene builder → DOM/SVG updates → enables interaction.

- Render entrypoint: [GraphCanvas.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas.tsx)
- 3D render entrypoint: [ThreeGraph.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/three/ThreeGraph.tsx)
- Scene orchestration: [scene.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/scene.ts)
- Scene layers barrel: [sceneLayers.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/sceneLayers.ts)
- Presentation updates (no simulation rebuild): [scene.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/scene.ts)
- Typography and icon alignment (render fidelity + UI consistency):
  - Node label anchoring and baseline: [labels.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/layers/labels.ts)
  - Edge label baseline: [edgeLabels.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/layers/edgeLabels.ts)
  - UI icon baseline alignment (Lucide): [index.css](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/index.css)
  - UI icon+text alignment in controls: [GraphDataTableUiPrimitives.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/graph-data-table/ui/GraphDataTableUiPrimitives.tsx)

**Invariant**: UI toggles that affect presentation only (node shape, port handles, group overlay shape, media-as-nodes) update layers in-place and do not trigger re-layout or simulation rebuild.

---

## Component Responsibility Matrix

| Stage | Path/Module | Component | Responsibility (S-V-O) | Input | Output |
|------:|-------------|-----------|-------------------------|-------|--------|
| 1 | `canvas/src/features/parsers/loader.ts` | Loader | Loader reads input → returns parse payload | Source path/bytes | Raw content |
| 2 | `canvas/src/features/parsers/*` | Parser | Parser transforms content → emits graph | Raw content | `GraphData` |
| 4 | `canvas/src/hooks/useGraphStore.ts` | Store | Store persists graph → exposes selectors | `GraphData` | State |
| 5 | `canvas/src/hooks/useActiveGraphData.ts`, `canvas/src/features/semantic-mode/keywordGraph.ts`, `canvas/src/lib/graph/layerDerivation.ts` | Deriver | Deriver selects/derives graph → returns render graph | State + schema | Render graph |
| 6 | `canvas/src/components/GraphCanvas/layout/positioning.ts` | Layout | Layout computes/reuses positions → returns cache decision | Render graph | Positions |
| 7 | `canvas/src/components/GraphCanvas/scene.ts` | Renderer | Renderer builds scene → updates SVG | Render graph + positions | Visual output |
