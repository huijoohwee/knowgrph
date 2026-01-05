# System Performance Documentation – AgenticRAG / GraphRAG Pipeline

Aligned with:
- AgenticRAG pipeline in `docs/knowgrph-raci-document.md`
- Workflow and onboarding flow in `docs/knowgrph-workflow-document.md`
- Codebase indexing pipeline in `docs/knowgrph-codebase-indexing-traversal-tracing-pipeline-document.md`

This catalog summarizes where time is spent across the end-to-end AgenticRAG pipeline, what the current performance optimizations are, and which modules are responsible for each phase.

---

## 1. End‑to‑End Pipeline Performance Map

**Phases (from `docs/knowgrph-raci-document.md`):**
- Schema (ontology / semantics)
- UI Curation (Graph Data Table and related exports)
- Ingest (Loader → Parser → Validator → Normalizer)
- Enrich (embeddings, confidence, media metadata)
- Index & Store (canonical storage, currently external DuckDB)
- Agentic Reasoning (orchestrator, traversal tools, vector search)
- Produce (exports, Blueprint JSON, JSON‑LD, CSV)
- Reuse / Render (2D/3D/map renderers and downstream indexers)

**High‑level performance characteristics:**
- Browser‑side operations are bounded by GraphData size and are optimized for interactive workloads (selection, traversal, rendering).
- Python scripts under `knowgrph_parser/` handle heavier batch and indexing work, optimized for offline/CLI usage.
- DuckDB and vector indexes are intentionally out‑of‑repo concerns; this catalog treats them as external indexers consuming exports.

---

## 2. Browser Pipeline (Canvas) – Performance Overview

### 2.1 GraphData ingestion and parsing

- **Responsibilities**
  - Parse uploads and responses into canonical `GraphData` (`type: 'Graph', nodes[], edges[]`) with no domain assumptions.
  - Validate referential integrity and schema alignment before any rendering or Agentic traversal.
- **Key modules**
  - `canvas/src/lib/graph/types.ts:1-40` – canonical `GraphData`, `GraphNode`, `GraphEdge` definitions.
  - `canvas/src/lib/graph/jsonld.ts:28-92,190-223` – JSON‑LD → GraphData and GraphData → JSON‑LD round‑trip.
  - `canvas/src/lib/graph/parseTextToGraph.ts:1-40` – main text dispatcher (CSV, GraphData JSON, GraphRAG bundles, JSON‑LD, n8n).
  - `canvas/src/features/parsers/default.ts:10-41` – built‑in parser specs (CSV, JSON‑LD, raw JSON, n8n, Python, GraphRAG bundles).
  - `canvas/src/features/parsers/graphrag.ts:1-22` – GraphRAG bundle parser spec.
  - `canvas/src/lib/graph/graphrag.ts:1-45` – GraphRAG `entities`/`relationships`/`chunks` → GraphData mapping.
- **Optimizations**
  - Parser caching:
    - `canvas/src/features/parsers/cache.ts:1-21` uses an `LRUCache` keyed by `(parserId, filename, text hash, configKey)` so repeated parses of the same artifact (for example when toggling settings or re‑exporting) avoid re‑running heavy parsers.
    - Default parser registry (`canvas/src/features/parsers/default.ts:10-40`) and GraphRAG parser hook into this cache via shared `ParseResult` types.
  - Structural parsing is shallow and streaming‑friendly:
    - GraphRAG bundles (`canvas/src/lib/graph/graphrag.ts:15-44`) and Graphrag pipeline outputs (`knowgrph_parser/graphrag_pipeline_cmd.py`) only extract the minimal fields needed for `GraphNode`/`GraphEdge` construction.
- **Performance targets**
  - Small/medium graphs (≤ 5k nodes, ≤ 10k edges): initial parse + validation ≤ 300 ms in modern desktop browsers.
  - Large graphs (≈ 10k–20k nodes, ≈ 30k–50k edges): initial parse + validation ≤ 1.5 s, with progress surfaced via UI when appropriate.

### 2.2 AgenticRAG traversal and orchestrator

- **Responsibilities**
  - Interpret `graphRAGPath` metadata on nodes.
  - Compute traversal edge sequences for visualization and playback.
  - Surface AgenticRAG‑style node views (chunk text, embeddings, provenance) in the Orchestrator tab.
- **Key modules**
  - AgenticRAG types:
    - `canvas/src/lib/graph/types.ts:40-76` – branded types (`AgenticRagNodeId`, `AgenticRagChunkText`, `AgenticRagEmbedding`, `AgenticRagNodeProvenance`).
  - GraphRAG traversal utilities:
    - `canvas/src/lib/graph/graphragTraversal.ts:1-35` – neighbor map caching.
    - `canvas/src/lib/graph/graphragTraversal.ts:37-88` – `graphRAGPath` detection and parsing (`toParsedTraversePath`, `toParsedExamplePath`).
    - `canvas/src/lib/graph/graphragTraversal.ts:90-115` – `findGraphRagTraversalEdgeIds` for ordered path edges.
    - `canvas/src/lib/graph/graphragTraversal.ts:118-158` – `findTraversalEdgeIds` for generic BFS‑style traversals with depth limits and label filters.
  - Orchestrator UI:
    - `canvas/src/features/panels/views/RenderSettingsSection.tsx:1-47,1299-1349` – Orchestrator settings and text editor sections, including GraphRAG path catalog and traversal summaries.
    - `canvas/src/features/panels/views/RenderPresetSection.tsx:287` – traversal presets (neighborhood, requires/enables chains) wired to traversal utilities.
    - `canvas/src/features/panels/views/AiKgLayersSection.tsx:1-200` – traversal playback speed and layered visualization tuning.
- **Optimizations**
  - Neighbor map caching:
    - `getOrBuildNeighborMap` (`canvas/src/lib/graph/graphragTraversal.ts:17-35`) builds a bidirectional neighbor map once per `GraphData` instance and stores it in a `WeakMap<GraphData, NeighborMap>`. Subsequent traversals reuse this structure.
    - Both `findGraphRagTraversalEdgeIds` and `findTraversalEdgeIds` use this shared neighbor index, avoiding repeated O(E) scans.
  - Bounded BFS traversal:
    - `findTraversalEdgeIds` clamps `maxDepth` to a finite integer and tracks visited nodes (`visitedNodes` set) to prevent cycles and explosion in dense graphs.
    - Edge labels are normalized and optionally filtered (`allowedEdgeLabels`), reducing the volume of traversed edges when users focus on specific relations (for example `requires`, `enables`).
  - Immutable edge id sets:
    - Edge ids are collected into a `Set<string>` and only converted to an array at the end of traversal (`canvas/src/lib/graph/graphragTraversal.ts:138-157`), minimizing allocations and membership checks.
- **Performance targets**
  - GraphRAG path traversal (`findGraphRagTraversalEdgeIds`) on large graphs (≈ 10k nodes, 30k edges): ≤ 5 ms once the neighbor map is built.
  - Generic BFS traversal with moderate depth (maxDepth ≤ 4): ≤ 20 ms for the same graph scale.

### 2.3 Rendering and interaction (2D/3D, selection, traversal playback)

- **Responsibilities**
  - Render graphs in 2D (`GraphCanvas`) and 3D (`ThreeGraph`) from canonical `GraphData`.
  - Respond to selection changes (node/edge/row), traversal highlights, and orchestrated playback without noticeable lag.
- **Key modules**
  - 2D rendering:
    - `canvas/src/components/GraphCanvas.tsx` – primary 2D renderer, selection propagation, and hover/tooltip handling.
  - 3D rendering:
    - `canvas/src/features/three/ThreeGraph.tsx` – three.js‑based spherical/immersive layouts.
  - Orchestrator and traversal playback:
    - `canvas/src/features/panels/views/RenderSettingsSection.tsx:115-215` – traversal playback utilities (`runEdgeTraversalSequence`) and delay configuration.
  - Selection store and shared state:
    - `canvas/src/hooks/useGraphStore.ts` – central `GraphData` and selection state used by renderers, panels, and orchestrator.
- **Optimizations**
  - Agentic traversal edge id reuse:
    - Traversal utilities return edge id arrays reused by both visualization (highlighting) and playback, avoiding repeated traversal computations during animation.
  - Selection performance instrumentation:
    - Status bar debug view (`canvas/src/components/StatusBar.tsx`) aggregates timing samples from selection subscribers (GraphCanvas, ThreeGraph, NodeEditor, Graph Data Table) via `performance.now()` + `CustomEvent`.
    - Each subscriber wraps its selection‑handling `useEffect` or callback in timing code and emits `selectionPerformance` events, making hotspots visible per dataset/hardware without shipping heavy profiling tooling.
  - Centralized three.js config access:
    - `getThreeConfig` (`canvas/src/lib/graph/schema.ts`) provides a shared helper for reading `schema.three` defaults in 2D/3D renderers and panels (`GraphCanvas`, `ThreeGraph`, selection helpers, AI‑KG layers section), reducing repeated `schema.three || {}` patterns and keeping render‑path config logic consistent.
  - DOM alignment, aggregate row fixes, and virtualization skeleton:
    - Graph Data Table row number/checkbox columns are aligned with data columns by simplifying sticky cell class usage in the `GraphDataTable` component so layout thrash and style recalculations are minimized during hover and selection on large tables (`canvas/src/features/graph-data-table/ui/GraphDataTableTable.tsx`).
    - Grouped views compute a lightweight numeric aggregate summary for the active group column (count, sum, average, min, max) in a single pass over group rows, and render it in the aggregate row without additional reflows (`canvas/src/features/graph-data-table/graphDataTable.ts:310–334`, `canvas/src/features/graph-data-table/ui/GraphDataTableTable.tsx`).
    - The Graph Data Table includes a row virtualization skeleton: each list item is associated with an estimated row height and cumulative offset (`canvas/src/features/graph-data-table/ui/GraphDataTableTable.tsx:151–164`), which is used to compute scroll targets and prepares the table for future windowed rendering of very large lists without changing current behavior.
- **Performance targets**
  - Selection updates (node/edge/row) with traversal highlights enabled:
    - Target ≤ 16 ms budget per frame for 60 FPS interactivity on typical desktop hardware.
  - Traversal playback:
    - Edge stepping and selection toggling remain within ≤ 16 ms per step for small/medium graphs; for large graphs, traversal results are pre‑computed and reused.

### 2.4 Demo graphs, sharding, and lazy routes

- **Responsibilities**
  - Keep production canvas workflows responsive even when showcasing heavy demo graphs.
  - Ensure large demo‑only bundles do not affect default landing performance.
- **Key decisions**
  - AI‑KG Visualization demo:
    - Canvas presets now load `test-data/ai-kg-viz_1500.json` (sharded/demo‑scale subset) via the examples catalog instead of the full `ai-kg-viz.json` bundle.
    - The full `ai-kg-viz.json` remains available for schema/fixture tests and offline analysis, but no longer ships on the critical canvas landing path.
  - Xmas GraphRAG demo:
    - A dedicated lazy route `/demo/xmas` renders the heavy `xmas-graphrag-demo.tsx` page.
    - This route and its Three.js scene, JSON‑LD fixtures, and orchestration config are only loaded when explicitly visited; `/` and `/canvas` continue to mount the main Canvas page without pulling in the Xmas demo bundle.
- **Optimizations**
  - Sharded/demo‑scale datasets:
    - `canvas/src/features/parsers/examplesCatalog.ts` points heavy presets at smaller, semantically aligned demo files where available (for example `ai-kg-viz_1500.json`), lowering the size of `import.meta.glob` chunks generated for example datasets.
  - Lazy routing for heavy demos:
    - `canvas/src/App.tsx` uses `React.lazy` + `Suspense` to code‑split the main Canvas page and the `/demo/xmas` Xmas GraphRAG demo route so production‑style flows only load the minimal subset of chunks by default.

---

## 3. CLI / Offline Pipelines – Performance Overview

### 3.1 Codebase indexing and Agentic GraphRAG metadata

- **Responsibilities**
  - Convert `test-data/knowgrph-workflow.json` into a JSON‑LD codebase index graph suitable for Agentic GraphRAG workflows.
  - Synthesize `graphRAGPath`, `chunk_text`, and provenance metadata (`metadata`) per node.
  - Attach runtime tracing metadata via `RuntimeEvent` nodes and `hasRuntimeEvent` / `runtimeOf` links.
- **Key modules**
  - Driver:
    - `knowgrph_parser/pipeline_cmd.py` – orchestrates an A0 CSV/JSON‑LD export and the codebase index pipeline, invoked via `npm run pipeline`.
  - Parser:
    - `python -m knowgrph_parser parse-codebase-index` – loads the workflow JSON, interprets orchestrator config, constructs JSON‑LD nodes/edges, and populates:
      - Structural fields: `@id`, `@type`, `name`, `path`, relation fields (for example `imports`, `renders`, `usesWorker`, plus Graphrag workflow links).
      - `graphRAGPath` with `query`, `traverse[]`, `multiHop[]`/`hops[]`/`steps[]`, optional `example`, and `context`.
      - Synthesized `chunk_text` from `graphRAGPath` for RAG grounding.
      - Provenance metadata compatible with `AgenticRagNodeProvenance` (`source`, `timestamp`, `codebasePath`, `codebaseArea`, `curator`, `coverage`, `confidence`, `codebaseId`).
      - Runtime tracing metadata by creating `RuntimeEvent` nodes and wiring them to code nodes via `hasRuntimeEvent` and `runtimeOf`.
- **Optimizations**
  - Single‑pass JSON walking:
    - `build_jsonld` annotates nodes and accumulates outgoing edges in a single sweep of the workflow JSON, minimizing passes over the data.
  - Context and edge labels:
    - Edge label collection and context construction are performed once per export, building a compact `@context` that includes only used edge labels and merging in tracing IRIs (`hasRuntimeEvent`, `runtimeOf`, `eventType`, `status`, `durationMs`, `occurredAt`, `stackTraceSnippet`).
  - File‑relative path normalization:
    - Normalization helpers (`normalize_rel_path`, `ensure_node`, `append_relation`) avoid duplicate nodes and redundant edges when creating artifact relationships from orchestrator config and Graphrag workflow config.
- **Performance targets**
  - Codebase index generation (`python -m knowgrph_parser parse-codebase-index`) for the knowgrph repository:
    - Typical runtime ≤ 1–2 s on modern laptops, dominated by file I/O and Python interpreter startup.

### 3.2 Embedding generation for codebase index

- **Responsibilities**
  - Attach deterministic embeddings to each node’s `chunk_text` in the codebase index JSON‑LD.
  - Populate an `embeddingConfiguration` block in the document’s `metadata`.
- **Key modules**
  - Embedding generator:
    - `python -m knowgrph_parser embed-codebase-index` – `hash_to_embedding`, optional file‑backed embedding loader, and embedding application over `@graph`.
  - Top‑level driver:
    - `python -m knowgrph_parser embed-codebase-index` – CLI arguments, backend selection (`hash` vs `file`), and JSON‑LD read‑modify‑write sequence.
  - Sanity checks:
    - `python -m knowgrph_parser test-embedding-sanity` – verifies that all nodes with `chunk_text` have embeddings with the expected dimensionality.
- **Optimizations**
  - Hash‑based deterministic embeddings:
    - `hash_to_embedding` generates embeddings from `chunk_text` using SHA‑256 and normalization, avoiding network calls to external models during local pipelines and tests.
    - The hash backend yields O(n × d) behavior where `n` is node count and `d` is embedding dimension, but with tight Python loops and no I/O per node.
  - Optional file‑backed backend:
    - When `--backend file` and a `backend-file` JSON is provided, embeddings are loaded once (`load_vectors_from_file`) and joined by node id, reusing pre‑computed vectors.
  - Idempotent writes:
    - If an `embedding` array already exists for a node, it is left untouched (`add_embeddings_to_document`), preventing unnecessary recomputation.
- **Performance targets**
  - Hash backend, moderate graphs (hundreds–low thousands of nodes) and small dimensions (d≈4–64): well under a few seconds on typical hardware.
  - File backend: dominated by JSON load time, with embedding assignment essentially O(n).

---

## 4. Testing, Tooling, and Budgets

### 4.1 Automated checks

- **Type and lint checks**
  - `npm run lint` – runs canvas linting rules for TypeScript/React code, ensuring performance‑related code paths (traversal helpers, parsers, renderers) remain type‑safe and style‑consistent.
  - `npm run check` – runs Svelte/Vite/TypeScript checks in the `canvas` project, covering GraphData types, AgenticRAG helpers, and panel components.
- **Tests**
  - Graph round‑trip and schema fixtures:
    - `canvas/src/__tests__/roundtrip.test.ts:1-8` – GraphData → CSV/JSON‑LD/GraphML/Cypher round‑trips, exercising parsing and export performance invariants.
    - `canvas/src/__tests__/schemaFixtures.test.ts:1-9` – confirms that representative domain graphs conform to generic GraphData + schema models.
  - GraphRAG parsing and traversal:
    - `canvas/src/__tests__/graphragParse.test.ts` – validates GraphRAG bundle parsing and GraphData conversion.
  - Pipeline tests:
    - `python -m knowgrph_parser test-embedding-sanity` – enforces embedding completeness and dimension consistency for the codebase index pipeline.

### 4.2 Performance budgets and guardrails

- **Interactive canvas**
  - Initial load and render of demo‑scale graphs: aim for ≤ 500 ms from file selection to first rendered frame.
  - Node/edge selection updates with traversal highlights: target ≤ 16 ms budget per frame.
  - Agentic traversal highlighting and playback: path computation should be amortized via neighbor caching, with playback primarily bound by rendering cost.
- **Offline pipelines**
  - `npm run pipeline` (codebase index pipeline) is treated as a CI‑friendly check, expected to complete within a few seconds on typical developer machines.
  - Embedding sanity tests must fail fast if any node with `chunk_text` is missing embeddings or has invalid dimensionality.

---

## 5. Future Performance Work

These items are intentionally left for future iterations and are not yet implemented:

- Add an optional DuckDB export helper that produces tables or SQL scripts directly from `GraphData` for local testing, while keeping production indexers external.
- Introduce metrics capture around parser cache hit rates and traversal timings to quantify improvements across datasets.
- Extend the StatusBar debug view to show rolling averages and percentiles for selection and traversal costs, helping tune schemas and layouts for large graphs.
