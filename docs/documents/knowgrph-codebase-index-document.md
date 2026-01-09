# Knowgrph Codebase Index: Universal Repository Specification

## Repository Architecture

**Module Hierarchy**: `knowgrph_parser` -> `codebase_index_*` / `python_codebase_index_*` -> JSON‑LD builders -> Canvas loaders  

**Dependency Flow**: parser_core -> index_builders -> workflow_config -> canvas_integration

**Design Principles**: Modularity‑first design | explicit JSON‑LD contracts | AgenticRAG‑aligned schemas | configuration‑driven traversal

### High‑Level Components

- Core parser package:
  - `knowgrph_parser/` implements markdown parsing, codebase indexing, schema config, and orchestrator config generation.
- Codebase index (GraphRAG workflow JSON):
  - `knowgrph_parser/codebase_index_cmd.py` + `codebase_index_jsonld.py` transform a GraphRAG workflow JSON into a codebase index JSON‑LD document.
- Codebase index (Python AST graph):
  - `knowgrph_parser/python_codebase_index_cmd.py` + `python_codebase_index_document.py` + `python_codebase_index_graph.py` build a graph from Python files and emit AgenticRAG‑aligned JSON‑LD.
- Canvas integration:
  - Canvas CLI and UI load `codebase-index-viz.jsonld`, universal schema config, and orchestrator config as GraphData and configuration presets.
  - `canvas/src/lib/graph/jsonld` handles JSON-LD parsing and normalization, ensuring consistent interpretation of the index.
  - LLM-facing schema-config guidance is documented in `docs/documents/knowgrph-llm-prompt-contract.md`, which explains how to safely modify `schema-config/knowgrph-schema-config-template.jsonld` for new datasets.
  - For how markdown-derived graphs surface in Canvas and how Canvas↔Markdown panel sync works, see:
    - `docs/documents/knowgrph-parser-document.md` (Markdown Rendering, Canvas UI)
    - `docs/documents/knowgrph-renderer-document.md` (Canvas ↔ Markdown selection sync)
    - `docs/documents/knowgrph-ui-ux-design-document.md` (Canvas ↔ Markdown panel UX)
## Module Specification

### Module: `knowgrph_parser.codebase_index_cmd`

**From GraphRAG workflow JSON to index JSON‑LD**: Module -> loads workflow graph and orchestrator YAML -> synthesizes codebase index JSON‑LD with traversal metadata and runtime events -> exposes a CLI entrypoint for integration with build and visualization tools.

**Configuration Schema (core arguments)**:

```yaml
input:
  scope: module_local
  type: path
  mutability: runtime_configurable
  binding: command_line
  default: data/outputs/knowgrph-workflow.json
  validation: must exist, JSON object
  impact: controls which workflow graph is converted into codebase index

config:
  scope: module_local
  type: path
  mutability: runtime_configurable
  binding: command_line
  default: orchestrator-config/knowgrph-universal-orchestrator-config.yaml
  validation: must exist, YAML object
  impact: defines traversal_edges, ignore patterns, and GraphRAG workflow linkage
```

**Interface Pattern**:  
`main(argv, base_dir, parser_script_path)` -> reads workflow graph and orchestrator config -> calls `build_jsonld` -> writes JSON‑LD document -> O(nodes + edges + runtime_events).

### Module: `knowgrph_parser.codebase_index_jsonld`

**From workflow nodes/edges to AgenticRAG codebase index JSON‑LD**: Module -> converts generic node/edge records into AgenticRAG‑aligned JSON‑LD nodes with provenance and layers -> attaches runtime events and traversal edge mappings.

Key behaviors:

- Normalizes file paths and ignores configured paths via `should_ignore_path` and `normalize_rel_path`.
- Canonicalizes `File` node IDs to the normalized path and tracks `metadata.aliases` for original IDs.
- Maps edges into adjacency lists on source nodes (`node[label] = ["kg:targetId", …]`).
- Populates `metadata.layers.indexing`, `metadata.layers.traversal`, and `metadata.layers.tracing`.
- Advertises traversal labels in `metadata.jsonLdMapping.contextEdgeProperties`.

**Interface Pattern**:  
`build_jsonld(graph, codebase_id, traversal_edges, ignored_paths, raw_ignored_patterns, runtime_event_specs)` -> returns `{ "@context", "@graph", "metadata" }` -> O(nodes + edges + runtime_events).

### Module: `knowgrph_parser.python_codebase_index_cmd`

**From Python codebase root to index JSON‑LD + configs**: Module -> walks Python files, builds a code graph, enriches it with GraphRAG paths and runtime events, and writes JSON‑LD index, schema config, and orchestrator config.

**Configuration Schema (core arguments)**:

```yaml
codebase_root:
  scope: system_global
  type: path
  mutability: runtime_configurable
  binding: command_line
  default: cwd or orchestrator.graph.codebase_root
  validation: directory must exist
  impact: bounds which files participate in the index

config:
  scope: system_global
  type: path
  mutability: runtime_configurable
  binding: command_line
  default: orchestrator-config/knowgrph-universal-orchestrator-config.yaml
  validation: must exist, YAML
  impact: injects traversal_edges, GraphRAG paths, runtime events, and ignore patterns
```

**Interface Pattern**:  
`main(argv, base_dir, parser_script_path)` -> resolves codebase root and paths from orchestrator config -> builds in‑memory graph via `build_code_graph` -> calls `build_jsonld_document` -> ensures schema and orchestrator config files -> O(files + relations + runtime_events).

### Module: `knowgrph_parser.python_codebase_index_document`

**From code graph records to AgenticRAG JSON‑LD**: Module -> rewrites `GraphNodeRecord` objects into JSON‑LD nodes with `@id`, `@type`, `labels`, `path`, `properties`, and `metadata` -> encodes GraphRAG paths and runtime events.

Key behaviors:

- Applies GraphRAG path specs from orchestrator config to nodes, storing:
  - `graphRAGPath.query`, `graphRAGPath.traverse`, `graphRAGPath.example`, `graphRAGPath.multiHop`, `graphRAGPath.context`.
  - Derived `chunk_text` string for quick inspection.
- Adds provenance metadata:
  - `source` (graph ID), `timestamp`, `codebaseId`, `codebasePath`, and `codebaseArea`.
- Propagates traversal edges and runtime event relationships into JSON‑LD context and `metadata.layers`.

### Module: `knowgrph_parser.markdown_cmd`

**From Markdown files to Knowledge Graph JSON‑LD + configs**: Module -> scans directory for markdown files -> parses each into a graph -> unifies entities across documents -> generates schema and orchestrator configs.

**Configuration Schema (core arguments)**:

```yaml
input:
  scope: command_line
  type: path (file or directory)
  mutability: runtime_configurable
  default: required
  validation: must exist
  impact: source content for the knowledge graph

output_dir:
  scope: command_line
  type: path
  mutability: runtime_configurable
  default: data/<stem>_<timestamp>
  impact: destination for JSON-LD and YAML artifacts
```

**Interface Pattern**:
`main` -> `_list_markdown_files` -> `parse_markdown_to_graph_jsonld` (loop) -> `_unify_entities_across_docs` (DocumentUnifier) -> `build_schema_config_jsonld` -> writes artifacts -> O(docs * tokens).

### Module: `knowgrph_parser.graph_builder`

**From single Markdown file to Graph JSON‑LD document**: graph_builder parses blocks into structural nodes and edges, then optionally runs semantic processing to emit entities, mentions, and semantic relations before returning a connected JSON‑LD graph.

**Key behaviors**:

- Structural layer: `_process_blocks` builds `Document`, `Section`, `Paragraph`, `CodeBlock`, `Table`, `List`, and `ListItem` nodes plus `hasSection`, `hasBlock`, `hasItem`, `linksTo`, and `next` edges with provenance metadata.
- Semantic hook: `process_semantics` (from `semantic_processor`) consumes `semantic_sources` and attaches `Entity` / `Mention` nodes and semantic edges such as `semanticRelation` and `coOccursWith`.
- Auto-tuning: Semantic defaults (phrase boundaries, edge thresholds, pattern support, centrality) are configurable via environment, frontmatter, or explicit `semantic_config` overrides.

**Interface Pattern**:
`parse_markdown_to_graph_jsonld(file_path, ...)` -> `parse_frontmatter` -> `parse_blocks` + `_process_blocks` -> `process_semantics` (optional) -> returns dict with `@graph` and `metadata`.
## Component Responsibility Matrix

| Layer      | Path                                             | Component                | Interface/Method                 | Responsibility (S‑V‑O)                                                          | Dependencies                         | Contracts                                      | LOC    |
|-----------|--------------------------------------------------|--------------------------|----------------------------------|-------------------------------------------------------------------------------|--------------------------------------|-----------------------------------------------|--------|
| Indexing  | `knowgrph_parser/codebase_index_cmd.py`          | —                        | `main`                          | CodebaseIndexCli loads workflow graph and config -> emits index JSON‑LD file | `argparse`, `json`, `.codebase_index_jsonld` | JSON‑LD index, orchestrator config linkage    | ~31–105 |
| Indexing  | `knowgrph_parser/codebase_index_jsonld.py`       | —                        | `build_jsonld`                  | JsonLdBuilder converts workflow nodes/edges into AgenticRAG index JSON‑LD    | `.codebase_index_artifacts`, `.runtime_events` | JSON‑LD `@context`, `@graph`, `metadata`      | ~17–271 |
| Indexing  | `knowgrph_parser/python_codebase_index_cmd.py`   | —                        | `main`                          | PythonIndexCli walks codebase and writes JSON‑LD, schema, orchestrator files | `.python_codebase_index_document`, `.python_codebase_index_graph` | Codebase index JSON‑LD + configs | ~22–112 |
| Indexing  | `knowgrph_parser/python_codebase_index_document.py` | —                     | `build_jsonld_document`         | PythonJsonLdBuilder maps GraphNodeRecord objects into AgenticRAG JSON‑LD     | `.runtime_events`, `.codebase_index_artifacts` | JSON‑LD `@context`, `@graph`, `metadata.layers` | ~118–227 |
| Docs      | `knowgrph/package.json`                         | docs:update script        | `npm run docs:update`           | DocsUpdateJob runs markdown pipeline for docs/documents -> refreshes graph/schema/orchestrator previews | `python -m knowgrph_parser markdown`, `.knowgrph-workflow-preview` | Preview artifacts synced with authored docs     | —      |
| Semantic  | `knowgrph_parser/markdown_cmd.py`                | DocumentUnifier          | `_unify_entities_across_docs`   | Unifier merges entities across docs -> resolves canonical IDs (L102–165)      | `.graph_builder`, `.schema_config`   | JSON‑LD `@graph`, canonical entity IDs         | ~200+  |
| Semantic  | `knowgrph_parser/semantic_processor.py`          | TokenLinker              | `merge_tokens_to_spans`         | TokenLinker merges tokens to spans -> identifies entities based on phrase boundaries | `.token_linker`, `.markdown_blocks`  | Token spans, confidence scores                 | ~200+  |
| Semantic  | `knowgrph_parser/semantic_processor.py`          | EdgeElevator             | `extract_sentence_features`     | EdgeElevator extracts sentence features -> enriches edges with temporal/modal attributes | `.edge_elevator`                     | Edge attributes (temporal, modal)              | ~200+  |

---

## Dependency & Integration Standards

**Dependency Declaration**

- Parser side:
  - Pure‑Python standard library plus local modules under `knowgrph_parser`.
  - No hardcoded external services; paths and GraphRAG semantics come from configuration.
- Canvas side:
  - Uses the index JSON‑LD as an input dataset for traversal and visualization tests and examples.

**Integration Contracts**

- JSON‑LD graph:
  - Must expose `@context`, `@graph`, and `metadata` fields.
  - Node IDs use the `KG_PREFIX` (e.g., `kg:<localId>` or `kg:<normalizedPath>`) defined in `knowgrph_parser/common.py`.
- Orchestrator config:
  - Must include `graph.codebase_root`, `graph.index_jsonld`, `graph.index_schema`.
  - AgenticRAG section defines `runtime_events` and `graph_rag_paths` for `python_codebase_index_document`.

**Coupling Metrics**

- Codebase index builders are decoupled from the canvas:
  - Canvas only depends on the JSON‑LD schema, not internal Python representations.
  - Runtime events and GraphRAG paths are attached via configuration, not hardcoded imports.
## Code Organization Framework

**Directory Structure (relevant subset)**:

```text
knowgrph/
├── knowgrph_parser/
│   ├── codebase_index_cmd.py
│   ├── codebase_index_jsonld.py
│   ├── markdown_cmd.py
│   ├── graph_builder.py
│   ├── semantic_processor.py
│   ├── python_codebase_index_cmd.py
│   ├── python_codebase_index_document.py
│   ├── python_codebase_index_graph.py
│   └── runtime_events.py
├── canvas/
│   ├── src/
│   │   ├── __tests__/
│   │   └── cli/
│   └── package.json
└── docs/
    └── knowgrph-codebase-index-document.md
```

**Naming Conventions**

- Python modules: `snake_case` (for example `codebase_index_jsonld.py`).
- JSON‑LD node/edge labels: `CamelCase` types, `lowerCamel` or `snake_case` properties.
- YAML config keys: `snake_case` aligned with orchestrator and GraphRAG config fields.

**File Organization**

- Index builder files are kept well under 600 LOC and focus on a single responsibility:
  - Workflow‑driven index building vs. Python‑graph index building.
## Testing & Quality Standards

**Test Coverage Metrics**

- Canvas tests:
  - `canvas/src/__tests__` exercises traversal, Orchestrator behaviors, and GraphRAG workflows over sample graphs.
- Parser validation:
  - Commands are designed to be run in CI, emitting deterministic JSON‑LD given the same inputs.

**Test Categories**

- Unit‑like:
  - Functions such as `build_jsonld` and `build_jsonld_document` can be exercised via small synthetic graphs.
- Integration:
  - Full pipeline from orchestrator config -> codebase index JSON‑LD -> canvas traversal.

**Quality Gates**

- JSON‑LD output must:
  - Validate as JSON.
  - Respect AgenticRAG schema URLs in `metadata.schema`.
  - Maintain referential integrity (all referenced node IDs defined in `@graph`).
## Anti‑Patterns (Forbidden)

- Circular dependencies between index builders and canvas rendering code.
- Hardcoded repository names or absolute paths inside parser logic.
- Embedding dataset‑specific semantics (graph labels, traversal edges) directly in Python; these must stay configuration‑driven.

---

## Repository Health Checklist

**Structural Health**

- [x] Codebase index pipelines are isolated in `knowgrph_parser`.
- [x] JSON‑LD outputs follow a consistent context and metadata structure.

**Maintainability**

- [x] Core index builders have explicit interfaces and minimal dependencies.
- [x] AgenticRAG schema URLs are centralized in `common.py`.

**Operations**

- [x] CLI entrypoints can be invoked from CI or local scripts to regenerate index artifacts.
- [x] Orchestrator config controls traversal behavior and ignore lists without code changes.

---

## Version Control Standards

- Codebase index behavior changes should:
  - Update this document when JSON‑LD structure or metadata fields change.
  - Keep orchestrator config and schema config paths backward compatible where possible.
