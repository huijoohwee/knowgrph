# Codebase Indexing Pipeline for AgenticRAG / GraphRAG

Aligned with:
- AgenticRAG schema (`huijoohwee.github.io/schema/AgenticRAG`)
- Generic KG/RAG Pipeline Principles (`docs/knowgrph-pipeline-principles.md`)
- RACI matrix for AgenticRAG pipeline (`docs/knowgrph-raci-document.md`)

This catalog describes how the knowgrph codebase is traversed, indexed, and exported as a JSON-LD graph suitable for AgenticRAG pipelines, including per-node provenance compatible with `AgenticRagNodeProvenance`.

---

## 1. Pipeline Overview

- **Goal**: Maintain a reusable, domain-agnostic codebase knowledge graph that:
  - Encodes structural relationships between files, modules, stores, and panels.
  - Exposes AgenticRAG traversal hints (`graphRAGPath`) for multi-hop reasoning.
  - Provides per-node provenance (`metadata`) so `AgenticRagNodeView` instances carry `source`, `timestamp`, `curator`, and confidence.
- **Inputs**:
  - `test-data/knowgrph-workflow.json` – structural `GraphData` describing codebase nodes and edges.
  - `orchestrator-config/knowgrph-universal-orchestrator-config.yaml` – binds workflow JSON, index JSON-LD, schema, and AgenticRAG settings.
- **Outputs**:
  - `data/outputs/codebase-index-viz.jsonld` – JSON-LD codebase index graph.
  - `schema-config/codebase-index-schema.json` – schema-driven visualization rules for the codebase index.

---

## 2. Structural Graph Model

### 2.1 Node Types

Nodes in the codebase index are a direct mapping from `GraphData.nodes[]` to JSON-LD:

- `File` – individual source files (`@type: "File"`)
- `Module` – logical module groupings (`@type: "Module"`)
- `Artifact` – non-code artifacts (config, scripts, test data) (`@type: "Artifact"`)
- `Store` – long-lived state containers (`@type: "Store"`)
- `PanelSystem` – high-level UI systems (`@type: "PanelSystem"`)

Each node is emitted as:

- `@id`: `kg:<id>` (e.g. `kg:canvas/src/pages/Canvas.tsx`)
- `@type`: one of the types above
- `name`: human-readable label (file name or module name)
- `path`: file-system path when available
- Optional:
  - `owner`: owning team or individual
  - `testCoverage`: numeric coverage percentage (0–100)

Implementation reference:
- Node construction in `python -m knowgrph_parser` under the `parse-codebase-index` command.

### 2.2 Edge Labels

Edges are exported from `GraphData.edges[]` as adjacency properties on nodes:

- `imports` – static/module-level imports
- `renders` – React component composition and UI rendering
- `providesPanel` – panel system wiring
- `readsStore` – read access to central stores
- `updatesStore` – write access to central stores
- `usesWorker` – web worker usage
- `invokes` – script-to-module invocation

Each label is declared as an `@id` relation in the JSON-LD `@context` so the Canvas JSON-LD parser treats them as edges (see `python -m knowgrph_parser` under the `parse-codebase-index` command).

Visualization and validation:
- Edge styles, labels, and catalog entries are defined in `schema-config/codebase-index-schema.json:19-55,117-133`.

---

## 3. Agentic GraphRAG Metadata

### 3.1 `graphRAGPath` per node

Nodes can optionally carry a `graphRAGPath` object that encodes Agentic GraphRAG traversal hints:

- Shape (per `schema-config/codebase-index-schema.json:135-187`):
  - `query`: natural language question for this path.
  - `traverse[]`: ordered list of node ids or module references to follow.
  - `multiHop[]` / `hops[]` / `steps[]`: optional human-readable descriptions of each hop.
  - `context`: free-form explanation of the path.

Example (Canvas entry point) in `data/outputs/codebase-index-viz.jsonld:416-462`:

```json
{
  "@id": "kg:canvas/src/pages/Canvas.tsx",
  "@type": "File",
  "name": "Canvas.tsx",
  "path": "canvas/src/pages/Canvas.tsx",
  "graphRAGPath": {
    "query": "How does the canvas render and parse graphs?",
    "traverse": [
      "module:@/components/GraphCanvas",
      "canvas/src/components/GraphCanvas.tsx",
      "canvas/src/workers/graphParser.worker.ts"
    ],
    "context": "Traverse from Canvas page shell through GraphCanvas to the graph parser worker"
  }
}
```

Usage:
- Parsed into `ParsedAgenticGraphRagPath` (`canvas/src/lib/graph/types.ts:79-92`).
- Consumed by the Orchestrator tab to:
  - Seed traversal presets.
  - Highlight multi-hop paths.
  - Persist traversal summaries back into the in-memory `GraphData`.

### 3.2 `chunk_text` for RAG grounding

When `graphRAGPath` is present, the parser synthesizes a RAG-friendly `chunk_text` string:

- Components (when available):
  - `Query: …`
  - `Traverse: a -> b -> c`
  - `Steps: … | …` (from `multiHop` / `hops` / `steps`)
  - `Context: …`
- Implementation:
  - `python -m knowgrph_parser` under the `parse-codebase-index` command.

This string is emitted as:

- `chunk_text` on the JSON-LD node.
- Parsed into `GraphNode.properties.chunk_text` by `canvas/src/lib/graph/jsonld.ts:52-71`.
- Mapped to `AgenticRagNodeView.chunkText` by `agenticRagNodeFromGraphNode` (`canvas/src/lib/graph/jsonld.ts:132-142`).

Result:
- Any selected codebase node in Canvas can be exported as an `AgenticRagNodeView` whose `chunkText` describes the relevant GraphRAG traversal context.

---

## 4. Per-node Provenance (`metadata`)

### 4.1 Shape and semantics

To align with `AgenticRagNodeProvenance` (`canvas/src/lib/graph/types.ts:60-76`) and the AgenticRAG node schema (`node-schema.jsonld:125-137`), each codebase index node can include a `metadata` object:

- Standard fields:
  - `source`: `"knowgrph-codebase-index"` – identifies the pipeline.
  - `timestamp`: ISO-8601 UTC string at export time.
  - `codebasePath`: the same path value stored as `path`.
  - `codebaseArea`: a coarse-grained region derived from `path`:
    - `"canvas"` for `canvas/...`
    - `"knowgrph_parser"` for `knowgrph_parser/...`
    - `"schema-config"` for `schema-config/...`
    - `"orchestrator-config"` for `orchestrator-config/...`
    - `"test-data"` for `test-data/...`
  - Optional `curator`: copied from node-level `owner` when present.
  - Optional `coverage`: numeric test coverage (0–100).
  - Optional `confidence`: normalized confidence score in `[0, 1]`, derived from `coverage / 100` when coverage is available.
  - Optional `codebaseId`: identifier for the indexed codebase; defaults to `"knowgrph"` and is set via the `--codebase-id` (`-b`) flag on `python -m knowgrph_parser parse-codebase-index`.

Example (Canvas test runner) in `data/outputs/codebase-index-viz.jsonld:600-607`:

```json
{
  "@id": "kg:canvas/src/tests/run.ts",
  "@type": "File",
  "name": "run.ts",
  "path": "canvas/src/tests/run.ts",
  "metadata": {
    "source": "knowgrph-codebase-index",
    "timestamp": "2025-12-21T13:43:14.480481Z",
    "codebasePath": "canvas/src/tests/run.ts",
    "codebaseArea": "canvas",
    "curator": "Testing",
    "coverage": 100.0,
    "confidence": 1.0
  }
}
```

### 4.2 How metadata flows into AgenticRAG views

1. JSON-LD → `GraphData`:
   - The JSON-LD parser (`canvas/src/lib/graph/jsonld.ts:29-73`) now:
     - Recognizes a `metadata` property on JSON-LD nodes.
     - Stores it in `GraphNode.metadata` while keeping other properties in `GraphNode.properties`.
2. `GraphNode` → `AgenticRagNodeView`:
   - `agenticRagNodeFromGraphNode` (`canvas/src/lib/graph/jsonld.ts:132-184`):
     - Copies `node.properties` as-is.
     - Interprets `node.metadata` as `provenance` when it is a non-empty object.
3. Orchestrator tab:
   - `OrchestratorSettingsSection` (`canvas/src/features/panels/views/OrchestratorSettingsSection.tsx:349-373`):
     - Derives `selectedAgenticNode: AgenticRagNodeView` from the selected `GraphNode`.
     - Exposes a “Copy AgenticRAG node JSON” action that serializes the view, including `provenance`, to the clipboard.

Net effect:
- The codebase index JSON-LD is a first-class AgenticRAG datasource:
  - Text grounding via `chunk_text`.
  - Structural context via graph edges.
  - Provenance via `metadata` → `AgenticRagNodeProvenance`.

---

## 5. Orchestrator and Schema Configuration

### 5.1 Orchestrator config and UI tooltips

`orchestrator-config/knowgrph-universal-orchestrator-config.yaml` binds the pipeline:

The Orchestrator and bottom panel tooltips are single‑sourced from `canvas/src/lib/config.ts` and aligned with the AgenticRAG Role → Actions → Outcome schema:

- `ORCHESTRATOR_TRAVERSAL_TOOLTIP` – Orchestrator → execute AgenticRAG traversal presets and edit GraphRAG paths → adjust traversal delay and view mode via bottom panel and Settings → deliver controlled, customizable graph navigation for consistent analysis and sharing.
- `TRAVERSAL_PRESET_UI_TOOLTIP` – Traversal controls → set start node, max depth, label filters, helpers, and DuckDB queries → drive Agentic GraphRAG traversals from the renderer.
- `HELP_CODEBASE_INDEX_ENTRY_POINTS_TOOLTIP` – Codebase index entry points → copy or show the full codebase index pipeline command → run the AgenticRAG codebase index pipeline from your terminal.

- `graph` section:
  - `id` (string)
  - `codebase_root` (string, optional)
  - `index_jsonld` (string, optional)
  - `index_schema` (string, optional)
  - `workflow_json` (string, optional)
  - `graphrag_workflow` (string, optional)
- `orchestrator` section:
  - `parser_script` (string; default: `python -m knowgrph_parser`)
  - `pipeline_artifacts` (object; optional paths for CSV and summaries)
- `agentic_rag` section:
  - `schema` (string; AgenticRAG base URL)
  - `context_url` (string; AgenticRAG JSON-LD context URL)
  - `node_view_type` (string)
  - `primary_fields` (string[])
  - `traversal_edges` (string[]) – declares which relation labels are traversal candidates; the parser propagates these into `metadata.jsonLdMapping.contextEdgeProperties`.
  - `ignore_codebase_paths` (string[]) – raw ignore patterns such as `dir:` or `path:` entries.
  - `graph_rag_paths` (list) – optional per-node traversal hints that become `graphRAGPath` properties.

Additional GraphRAG-specific wiring:

- `graphrag_workflow` acts as the authoritative YAML configuration for the Graphrag CLI and for the GraphRAG workflow JSON-LD export:
  - `knowgrph_parser/graphrag_pipeline_cmd.py` reads the YAML, converts it into a `rag:GraphRAGWorkflow` JSON-LD document, and writes it to `data/graphrag/graphrag-workflow.jsonld`.
  - `canvas/src/cli/graphrag-config-to-workflow.ts:1-32` uses the same YAML→JSON-LD mapping (`parseGraphragCliConfigYamlToJsonLd`) to provide a Node-based CLI that mirrors the Python behavior for non-UI workflows.
  - `canvas/src/features/panels/hooks/useWorkflowExportActions.ts:382-455` and `canvas/src/features/panels/views/WorkflowSection.tsx:132-174` wire that same importer into the Canvas workflow section and toolbar so YAML and JSON-LD imports share validation and status wiring.

The codebase index parser (`python -m knowgrph_parser parse-codebase-index`) augments the index with:

- Nodes for:
  - `configs/graphrag/config.yaml` (`@type: "Artifact"`)
  - `data/graphrag/graphrag-workflow.jsonld` (`@type: "Artifact"`)
  - `knowgrph_parser/graphrag_pipeline_cmd.py` (`@type: "File"`)
- Relations:
  - `knowgrph_parser/graphrag_pipeline_cmd.py` `consumesInput` → `kg:configs/graphrag/config.yaml`
  - `knowgrph_parser/graphrag_pipeline_cmd.py` `producesOutput` → `kg:data/graphrag/graphrag-workflow.jsonld`
  - `knowgrph_parser/pipeline_cmd.py` `invokes` → `kg:knowgrph_parser/graphrag_pipeline_cmd.py`

This keeps the GraphRAG workflow configuration, its YAML source, and the pipeline scripts discoverable inside the same indexed graph that powers the Canvas Orchestrator tab.

Config layering:

- GraphRAG CLI YAML files under `configs/graphrag/...` drive dataset paths, chunking, embeddings, and traversal rules for CLI workflows.
- Orchestrator configs under `orchestrator-config/...` reference those CLI configs via `graph.graphrag_workflow` and can point `graph.workflow_json` at a generated workflow JSON-LD document.

This configuration:
- Anchors the codebase index in the AgenticRAG schema.
- Declares that `AgenticRagNodeView` is the canonical node projection in UI.
- Ensures that downstream tools can rely on `chunk_text` and `metadata`/`provenance` without knowing about internal codebase structure.

### 5.2 Schema config

`schema-config/codebase-index-schema.json` provides visualization and property constraints:

- Node styles by `@type` (`File`, `Module`, `Artifact`, `Store`, `PanelSystem`).
- Edge styles for labels like `imports`, `renders`, `providesPanel`, `readsStore`, `updatesStore`, `usesWorker`, `invokes`.
- `propertySchemas.node` entries describing:
  - `owner` and `testCoverage` semantics for `File`, `Module`, `Artifact`.
  - Presence and shape of `graphRAGPath` for multiple node types (as an opaque object aligned with AgenticRAG traversal metadata).

The schema layer remains structural: it does not validate or interpret RAG semantics, embeddings, or provenance content, in line with the AgenticRAG validation rules (`node-schema.jsonld:141-146`).

### 5.3 Orchestrator traversal UI and last-run summary

The Canvas Orchestrator tab turns `graphRAGPath` metadata and generic traversal parameters into an interactive, replayable traversal sequence:

- Presets:
  - `TraversalPresetSection` (`canvas/src/features/panels/views/RenderPresetSection.tsx`) exposes:
    - GraphRAG presets that call `runGraphRagTraversal`.
    - Generic presets that call `runTraversalQuery`.
  - Orchestrator wiring wraps these in `OrchestratorTraversalPresetsSection` (`canvas/src/features/panels/views/OrchestratorTraversalPanels.tsx:16-71`), which passes:
    - `runGraphRagTraversal` and `runGenericTraversalQuery` callbacks.
    - Generic traversal parameters: `traversalStartNodeId`, `traversalMaxDepth`, `traversalLabelFilter`.
    - The currently selected node and GraphRAG path helper for the active owner node. The visible Orchestrator traversal section stack (traversal presets, Traversal sequence, AgenticRAG node inspector, AgenticRAG context and ignore filters) is single-sourced via `getOrchestratorSectionListLabel` (`canvas/src/features/panels/config.ts:127`) so this document does not duplicate those labels.
  - Traversal presets and generic query inputs share a two-column key/value row layout powered by `KeyValueRow` (`canvas/src/features/panels/ui/KeyValueRow.tsx`): labels such as “Start node id”, “Max depth”, and “Edge labels filter” appear on the left, with compact inputs and buttons on the right. New traversal-related panels (including future floating Graph Traversal variants) should reuse this primitive so traversal presets and query controls stay visually aligned across the Orchestrator stack.
- Traversal execution:
  - `OrchestratorSettingsSection` (`canvas/src/features/panels/views/OrchestratorSettingsSection.tsx:232-339`) owns:
    - `runGraphRagTraversal` – derives a `GraphRagTraversalSummary` from `graphRAGPath` on the owner node via `findGraphRagOwnerNode`, `toParsedTraversePath`, and `buildEdgeIdsForPath`.
    - `runGenericTraversalQuery` – builds a `GenericTraversalSummary` using `findTraversalEdgeIds` from the selected or explicitly entered start node, maximum depth, and optional edge label filters.
    - `runEdgeTraversalSequence` – replays `edgeIds` over time using the current traversal delay, updating `selectedEdgeId` in the graph store and marking `aiKgTraversalRan` as true.
  - Each run constructs a `TraversalSummary` value (`graphRag` or `generic`) and writes it into:
    - Local `lastTraversal` state used by traversal editors and preview.
    - `useGraphStore.getState().setGraphData` via `persistTraversalSummaryToGraph`, so edits to the traversal sequence are persisted back onto the underlying `graphRAGPath`.
    - A mirrored `lastTraversalSummary` field on the central graph store via `setLastTraversalSummary` (`canvas/src/features/panels/views/OrchestratorSettingsSection.tsx:219-231`, `canvas/src/hooks/useGraphStore.ts:234-249,345-351`).
- Sequence editing and preview:
  - `buildOrchestratorTraversalSectionViewModel` (`canvas/src/features/panels/views/OrchestratorTraversalSectionModel.ts:1-69`) converts `lastTraversal`, `graphNodesById`, and `graphEdgesById` into a view model consumed by the traversal sequence UI.
  - `TraversalSequenceSection` (`canvas/src/features/panels/views/OrchestratorTraversalSequenceSection.tsx:13-224`) renders:
    - GraphRAG-specific editors (`TraversalQueryExampleEditor`, `TraverseNodesListEditor`, `HopsListEditor`, `MultiHopListEditor`, `AddHopInputs`) for owner, query, example, and hop chains.
    - A generic traversal summary (`GenericTraversalDetails`) for `startNodeId`, `maxDepth`, and `labelFilter`.
    - A tabular edge sequence (`TraversalEdgesTable`) that:
      - Lists each `edgeId` with source/target labels.
      - Supports replay via `runEdgeTraversalSequence`.
      - Allows removing individual edges from the sequence.
  - `previewEdgeIds` provides a lightweight preview path for the current owner node without committing a new `lastTraversal`.
- Main panel orchestration controls and summary:
  - The Settings tab header of `MainPanel` (`canvas/src/features/panels/MainPanel.tsx:123-188`) exposes:
    - `orchestratorView` (UI or Text) persisted to LocalStorage (`LS_KEYS.orchestratorView`).
    - `orchestratorTraversalDelayMs` persisted to LocalStorage (`LS_KEYS.orchestratorTraversalDelayMs`) and respected by the Orchestrator tab.
  - The main panel footer surfaces a compact “last traversal” chip (`canvas/src/features/panels/MainPanel.tsx:106-115,150-167`):
    - Backed by `useGraphStore(s => s.lastTraversalSummary)` and `useGraphStore(s => s.graphData)`.
    - Displays the active traversal mode (`AgenticRAG` or `Generic`) plus:
      - Number of edges in the last run (`edgeIds.length`).
      - Number of distinct nodes touched by those edges, derived from the underlying `GraphData.edges[]`.
    - This provides a workspace-wide summary so the user can see, at a glance, which traversal mode was last executed and how large the traversed subgraph was, without opening the Orchestrator tab.

---

## 6. End-to-end Usage Flow

### 6.1 Generate the codebase index

From the repository root (`/Users/huijoohwee/Documents/GitHub/knowgrph`):

```bash
python -m knowgrph_parser parse-codebase-index \
  -c orchestrator-config/knowgrph-universal-orchestrator-config.yaml \
  -b knowgrph
```

- Reads `test-data/knowgrph-workflow.json`.
- Builds JSON-LD with:
  - Structural nodes and edges.
  - `graphRAGPath` and `chunk_text` where present.
  - Per-node `metadata` for provenance, confidence, and `codebaseId`.
  - A compact `@context` that declares all observed edge labels (for example `imports`, `renders`, `readsStore`) as `@id` relations compatible with JSON-LD graph semantics.
  - A top-level `metadata.jsonLdMapping.contextEdgeProperties` array populated from the `agentic_rag.traversal_edges` list in the orchestrator config, or from all observed edge labels when `traversal_edges` is omitted. This array is consumed by the Canvas Parser tab JSON-LD mapping summary and by the GraphRAG workflow builder to seed `rag:TraversalRule.allowedRelations` in the exported workflow JSON-LD (`canvas/src/features/panels/views/ParserSections.tsx:116-170`, `canvas/src/features/panels/utils/graphragConfig.ts:139-193`).
- Writes `data/outputs/codebase-index-viz.jsonld`.
- The top-level `metadata` block on the JSON-LD document also carries `codebaseId` so AgenticRAG consumers can distinguish multiple codebases indexed with the same schema and can reuse the same AgenticRAG workflow templates across repositories.

### 6.2 Optional embedding stage

To enrich the codebase index with embeddings derived from `chunk_text` while remaining schema-agnostic and provider-agnostic:

```bash
python -m knowgrph_parser embed-codebase-index
```

- Reads `data/outputs/codebase-index-viz.jsonld`.
- For each node that has a non-empty `chunk_text` and no existing `embedding`:
  - Computes a deterministic numeric vector using a SHA-256 based hashing scheme.
- Writes the resulting array as `embedding` on the node, aligning with the AgenticRAG `embedding` field (`node-schema.jsonld:82-95`) and `AgenticRagNodeView.embedding` (`canvas/src/lib/graph/types.ts:68-76`).
- Updates the top-level `metadata` with an `embeddingConfiguration` block:
  - `@id: "example:embedding-config-codebase"`.
  - `defaultModel`:
    - `@id: "example:model-codebase-embeddings"`.
    - `@type: "EmbeddingModel"`.
    - `modelName: "text-embedding-3-large"` (configurable via `--model-name`).
    - `provider: "OpenAI"` (configurable via `--provider`).
    - `embeddingDimension: 64` by default (configurable via `--dimensions`).
    - `vectorSpace: "cosine-normalized"`.
- Emits the updated JSON-LD back to `data/outputs/codebase-index-viz.jsonld` (or another path if `--output` is provided).

The embedding script now supports pluggable backends:

- `--backend hash` (default):
  - Ignores external vectors and computes embeddings via the deterministic SHA-256 based scheme.
  - Respects `--dimensions` to control output vector length.
- `--backend file --backend-file <path>`:
  - Loads vectors from a JSON file shaped like `canvas/public/examples/graphrag-demo/embeddings.json`:
    - Top-level `dimensions` (optional, used when `--dimensions` is not set or `<= 0`).
    - `vectors`: array of `{ "id": "<@id>", "vector": [number, ...] }`.
  - For any node whose `@id` matches an entry’s `id` or `@id`:
    - Uses the file-backed vector as the `embedding` if it is numeric and either matches `--dimensions` or `--dimensions <= 0`.
  - Falls back to the hashing backend for nodes without a matching vector or when the vector is malformed.

This keeps the hashing-based path as a safe, deterministic baseline while allowing higher-fidelity embeddings to be injected offline without changing the AgenticRAG schema or Canvas types.

Example invocation using a small file-backed vector set:

```bash
python -m knowgrph_parser embed-codebase-index \
  --backend file \
  --backend-file knowgrph_parser/codebase-index-embeddings-example.json \
  --dimensions 4
```

`knowgrph_parser/codebase-index-embeddings-example.json` uses `@id` values from `data/outputs/codebase-index-viz.jsonld` and provides 4-dimensional vectors suitable for quick end-to-end checks.

### 6.3 Embedding sanity test

To validate that the index is embedding-complete for RAG use (every node with `chunk_text` has a numeric embedding of the expected dimension), run:

```bash
python -m knowgrph_parser test-embedding-sanity
```

- Reads `data/outputs/codebase-index-viz.jsonld` by default (configurable via `--input`).
- Scans all nodes in `@graph`:
  - For each node with non-empty `chunk_text` (configurable via `--chunk-field`):
    - Asserts `embedding` exists and is a list.
    - Asserts every element is numeric.
    - If `--dimensions > 0`, asserts the list length equals `--dimensions` (64 by default).
- Exits with a non-zero status and an actionable error message when any node fails validation.

This script acts as a lightweight contract test between the parsing stage and downstream AgenticRAG consumers, ensuring that `chunk_text` and `embedding` stay aligned when the pipeline or embedding backend is modified.

### 6.5 One-command npm pipeline

To run the full Agentic GraphRAG-compatible codebase pipeline from the repo root alongside `npm run lint` and `npm run check`, use:

```bash
npm run pipeline
```

This command:

- Invokes `python -m knowgrph_parser pipeline`.
- Runs `python -m knowgrph_parser parse-codebase-index` with `orchestrator-config/knowgrph-universal-orchestrator-config.yaml`.
- Executes `python -m knowgrph_parser embed-codebase-index` with the `file` backend against `knowgrph_parser/codebase-index-embeddings-example.json` (currently configured for a 4-dimensional vector space) so file-backed embeddings are exercised end-to-end.
- Calls `python -m knowgrph_parser test-embedding-sanity` with matching dimensions, failing fast if any node with `chunk_text` is missing an embedding or has the wrong shape.

The result is an updated `data/outputs/codebase-index-viz.jsonld` that is structurally valid, embedding-complete, and aligned with the AgenticRAG schema for downstream workflows.

### 6.4 Load into Canvas

1. Open the Canvas app (`canvas/` → `pnpm run dev`).
2. In the **Parser** tab:
   - Load `data/outputs/codebase-index-viz.jsonld` using the JSON-LD parser.
3. In the **Schema** tab:
   - Import `schema-config/codebase-index-schema.json`.
4. In the **Render** tab:
   - Explore the codebase structure and dependencies.
5. In the **Orchestrator** tab:
   - Use `graphRAGPath` presets to run Agentic GraphRAG traversals over the codebase index.
   - Select nodes and use “Copy AgenticRAG node JSON” to obtain `AgenticRagNodeView` objects containing `chunkText` and `provenance`.

---

## 7. Extension Points

The codebase indexing pipeline is intentionally conservative and schema-aligned:

- To add embeddings:
  - Populate `embedding` arrays per node (e.g., via a separate offline job) and write them into the JSON-LD nodes.
  - The Canvas AgenticRAG view will surface them via `AgenticRagNodeView.embedding`.
- To enrich provenance:
  - Extend `metadata` with additional keys such as `component`, `layer`, or `reviewStatus`.
  - AgenticRAG tooling will treat these as part of `AgenticRagNodeProvenance` without schema changes.
- To support multiple codebases:
  - Use the `--codebase-id` (`-b`) flag on `python -m knowgrph_parser parse-codebase-index` to stamp both node-level `metadata.codebaseId` and top-level `metadata.codebaseId`.
  - Keep the structural schema and AgenticRAG alignment unchanged so different codebases can share the same index schema and Canvas workflow.
