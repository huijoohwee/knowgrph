# Knowgrph Codebase Index: Universal Repository Specification

## Repository Architecture

**Module Hierarchy**: `knowgrph_parser` → `codebase_index_*` / `python_codebase_index_*` → JSON‑LD builders → Canvas loaders  

**Dependency Flow**: parser_core → index_builders → workflow_config → canvas_integration

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

---

## Module Specification

### Module: `knowgrph_parser.codebase_index_cmd`

**From GraphRAG workflow JSON to index JSON‑LD**: Module → loads workflow graph and orchestrator YAML → synthesizes codebase index JSON‑LD with traversal metadata and runtime events → exposes a CLI entrypoint for integration with build and visualization tools.

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
`main(argv, base_dir, parser_script_path)` → reads workflow graph and orchestrator config → calls `build_jsonld` → writes JSON‑LD document → O(nodes + edges + runtime_events).

### Module: `knowgrph_parser.codebase_index_jsonld`

**From workflow nodes/edges to AgenticRAG codebase index JSON‑LD**: Module → converts generic node/edge records into AgenticRAG‑aligned JSON‑LD nodes with provenance and layers → attaches runtime events and traversal edge mappings.

Key behaviors:

- Normalizes file paths and ignores configured paths via `should_ignore_path` and `normalize_rel_path`.
- Canonicalizes `File` node IDs to the normalized path and tracks `metadata.aliases` for original IDs.
- Maps edges into adjacency lists on source nodes (`node[label] = ["kg:targetId", …]`).
- Populates `metadata.layers.indexing`, `metadata.layers.traversal`, and `metadata.layers.tracing`.
- Advertises traversal labels in `metadata.jsonLdMapping.contextEdgeProperties`.

**Interface Pattern**:  
`build_jsonld(graph, codebase_id, traversal_edges, ignored_paths, raw_ignored_patterns, runtime_event_specs)` → returns `{ "@context", "@graph", "metadata" }` → O(nodes + edges + runtime_events).

### Module: `knowgrph_parser.python_codebase_index_cmd`

**From Python codebase root to index JSON‑LD + configs**: Module → walks Python files, builds a code graph, enriches it with GraphRAG paths and runtime events, and writes JSON‑LD index, schema config, and orchestrator config.

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
`main(argv, base_dir, parser_script_path)` → resolves codebase root and paths from orchestrator config → builds in‑memory graph via `build_code_graph` → calls `build_jsonld_document` → ensures schema and orchestrator config files → O(files + relations + runtime_events).

### Module: `knowgrph_parser.python_codebase_index_document`

**From code graph records to AgenticRAG JSON‑LD**: Module → rewrites `GraphNodeRecord` objects into JSON‑LD nodes with `@id`, `@type`, `labels`, `path`, `properties`, and `metadata` → encodes GraphRAG paths and runtime events.

Key behaviors:

- Applies GraphRAG path specs from orchestrator config to nodes, storing:
  - `graphRAGPath.query`, `graphRAGPath.traverse`, `graphRAGPath.example`, `graphRAGPath.multiHop`, `graphRAGPath.context`.
  - Derived `chunk_text` string for quick inspection.
- Adds provenance metadata:
  - `source` (graph ID), `timestamp`, `codebaseId`, `codebasePath`, and `codebaseArea`.
- Propagates traversal edges and runtime event relationships into JSON‑LD context and `metadata.layers`.

---

## Component Responsibility Matrix

| Layer      | Path                                             | Component                | Interface/Method                 | Responsibility (S‑V‑O)                                                          | Dependencies                         | Contracts                                      | LOC    |
|-----------|--------------------------------------------------|--------------------------|----------------------------------|-------------------------------------------------------------------------------|--------------------------------------|-----------------------------------------------|--------|
| Indexing  | `knowgrph_parser/codebase_index_cmd.py`          | —                        | `main`                          | CodebaseIndexCli loads workflow graph and config → emits index JSON‑LD file | `argparse`, `json`, `.codebase_index_jsonld` | JSON‑LD index, orchestrator config linkage    | ~31–105 |
| Indexing  | `knowgrph_parser/codebase_index_jsonld.py`       | —                        | `build_jsonld`                  | JsonLdBuilder converts workflow nodes/edges into AgenticRAG index JSON‑LD    | `.codebase_index_artifacts`, `.runtime_events` | JSON‑LD `@context`, `@graph`, `metadata`      | ~17–271 |
| Indexing  | `knowgrph_parser/python_codebase_index_cmd.py`   | —                        | `main`                          | PythonIndexCli walks codebase and writes JSON‑LD, schema, orchestrator files | `.python_codebase_index_document`, `.python_codebase_index_graph` | Codebase index JSON‑LD + configs | ~22–112 |
| Indexing  | `knowgrph_parser/python_codebase_index_document.py` | —                     | `build_jsonld_document`         | PythonJsonLdBuilder maps GraphNodeRecord objects into AgenticRAG JSON‑LD     | `.runtime_events`, `.codebase_index_artifacts` | JSON‑LD `@context`, `@graph`, `metadata.layers` | ~118–227 |

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
  - Node IDs are `kg:<localId>` or `kg:<normalizedPath>`.
- Orchestrator config:
  - Must include `graph.codebase_root`, `graph.index_jsonld`, `graph.index_schema`.
  - AgenticRAG section defines `runtime_events` and `graph_rag_paths` for `python_codebase_index_document`.

**Coupling Metrics**

- Codebase index builders are decoupled from the canvas:
  - Canvas only depends on the JSON‑LD schema, not internal Python representations.
  - Runtime events and GraphRAG paths are attached via configuration, not hardcoded imports.

---

## Code Organization Framework

**Directory Structure (relevant subset)**:

```text
knowgrph/
├── knowgrph_parser/
│   ├── codebase_index_cmd.py
│   ├── codebase_index_jsonld.py
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

---

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
  - Full pipeline from orchestrator config → codebase index JSON‑LD → canvas traversal.

**Quality Gates**

- JSON‑LD output must:
  - Validate as JSON.
  - Respect AgenticRAG schema URLs in `metadata.schema`.
  - Maintain referential integrity (all referenced node IDs defined in `@graph`).

---

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
