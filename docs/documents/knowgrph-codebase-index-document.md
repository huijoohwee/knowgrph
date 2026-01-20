# Knowgrph Codebase Index: Universal Repository Specification

## Design Mantras

```
- [ ] Composability; enable extension; forbid monolithic design
- [ ] Configuration; externalize behavior; forbid hardcoded logic
- [ ] Determinism; ensure reproducibility; forbid hidden state
- [ ] Explicitness; declare contracts; forbid implicit dependencies
- [ ] Modularity; isolate responsibilities; forbid tight coupling
- [ ] Neutrality; serve any domain; forbid dataset assumptions
- [ ] Locality; bound file scope; forbid sprawling modules
```

---

## Universal Design Principles

| Context             | Intent                              | Directive                                                                                      |
|---------------------|-------------------------------------|------------------------------------------------------------------------------------------------|
| Adaptability        | Enable customization                | - [ ] Externalize parameters; support runtime config; forbid hardcoded behavior               |
| Algorithms          | Apply general-purpose logic         | - [ ] Implement domain-neutral code; process any graph; forbid dataset dependencies           |
| Configuration       | Centralize control                  | - [ ] Define YAML schemas; declare all tunables; forbid embedded settings                     |
| Contracts           | Establish interfaces                | - [ ] Document inputs/outputs; specify JSONâ€'LD shape; forbid undocumented assumptions        |
| Coupling            | Minimize dependencies               | - [ ] Isolate modules; use config injection; forbid cross-layer imports                       |
| Data Flow           | Make pipelines transparent          | - [ ] Trace transformations; log intermediate states; forbid opaque processing                |
| Domains             | Operate across sectors              | - [ ] Abstract entity types; support any ontology; forbid sector-specific logic               |
| Determinism         | Ensure reproducibility              | - [ ] Fix random seeds; normalize inputs; forbid non-deterministic behavior                   |
| Encapsulation       | Hide implementation details         | - [ ] Expose minimal APIs; version interfaces; forbid internal leakage                        |
| Error Handling      | Fail gracefully                     | - [ ] Validate inputs; return descriptive errors; forbid silent failures                      |
| Extensibility       | Support future growth               | - [ ] Design plugin points; version schemas; forbid closed architectures                      |
| Idempotence         | Guarantee safe re-runs              | - [ ] Overwrite outputs; normalize identifiers; forbid accumulation artifacts                 |
| Immutability        | Preserve input integrity            | - [ ] Copy before transform; avoid in-place edits; forbid source corruption                   |
| Locality            | Bound file responsibilities         | - [ ] Keep modules under 600 LOC; single responsibility; forbid god objects                   |
| Naming              | Use consistent conventions          | - [ ] Apply snake_case (Python), camelCase (JSON); forbid mixed styles                        |
| Observability       | Enable runtime inspection           | - [ ] Emit structured logs; expose metrics; forbid black-box execution                        |
| Performance         | Optimize asymptotically             | - [ ] Target O(n) or O(n log n); batch operations; forbid O(n²) where avoidable              |
| Provenance          | Track data lineage                  | - [ ] Record timestamps, sources; version metadata; forbid orphaned outputs                   |
| Reusability         | Share common logic                  | - [ ] Extract utilities; parameterize functions; forbid copy-paste duplication                |
| Schema Compliance   | Enforce JSONâ€'LD standards           | - [ ] Validate @context, @graph; require metadata; forbid malformed documents                 |
| Testability         | Support automated validation        | - [ ] Inject dependencies; expose test hooks; forbid untestable code                          |
| Transparency        | Document decisions                  | - [ ] Comment non-obvious logic; link to specs; forbid undocumented magic                     |
| Validation          | Verify all inputs                   | - [ ] Check file existence; parse configs early; forbid late-stage errors                     |
| Versioning          | Maintain backward compatibility     | - [ ] Namespace schema URLs; deprecate gracefully; forbid breaking changes                    |

---

## Repository Architecture

**Module Hierarchy**: `knowgrph_parser` → `codebase_index_*` / `python_codebase_index_*` → JSONâ€'LD builders → Canvas loaders  

**Dependency Flow**: parser_core → index_builders → workflow_config → canvas_integration

**Design Principles**: Modularity-first design | explicit JSONâ€'LD contracts | AgenticRAG-aligned schemas | configuration-driven traversal

### High-Level Components

- Core parser package:
  - `knowgrph_parser/` implements markdown parsing, codebase indexing, schema config, and orchestrator config generation.
- Codebase index (GraphRAG workflow JSON):
  - `knowgrph_parser/codebase_index_cmd.py` + `codebase_index_jsonld.py` transform a GraphRAG workflow JSON into a codebase index JSONâ€'LD document.
- Codebase index (Python AST graph):
  - `knowgrph_parser/python_codebase_index_cmd.py` + `python_codebase_index_document.py` + `python_codebase_index_graph.py` build a graph from Python files and emit AgenticRAG-aligned JSONâ€'LD.
- Canvas integration:
  - Canvas CLI and UI load `codebase-index-viz.jsonld`, universal schema config, and orchestrator config as GraphData and configuration presets.
  - `canvas/src/lib/graph/jsonld` handles JSON-LD parsing and normalization, ensuring consistent interpretation of the index.
  - LLM-facing schema-config guidance is documented in `docs/documents/knowgrph-llm-prompt-contract.md`, which explains how to safely modify `schema-config/knowgrph-schema-config-template.jsonld` for new datasets.
  - For how markdown-derived graphs surface in Canvas and how Canvas↔Markdown panel sync works, see:
    - `docs/documents/knowgrph-parser-document.md` (Markdown Rendering, Canvas UI)
    - `docs/documents/knowgrph-renderer-document.md` (Canvas ↔ Markdown selection sync)
    - `docs/documents/knowgrph-ui-ux-design-document.md` (Canvas ↔ Markdown panel UX)

---

## Module Specification

### Module: `knowgrph_parser.codebase_index_cmd`

**From GraphRAG workflow JSON to index JSONâ€'LD**: Module → loads workflow graph and orchestrator YAML → synthesizes codebase index JSONâ€'LD with traversal metadata and runtime events → exposes a CLI entrypoint for integration with build and visualization tools.

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
`main(argv, base_dir, parser_script_path)` → reads workflow graph and config → calls `build_jsonld` → writes JSONâ€'LD document → O(nodes + edges + runtime_events).

**Design Compliance**:

| Context          | Intent                     | Directive                                                                                   | Module                     | Function/Method | Input                                          | Output                      | Decision Logic                                    |
|------------------|----------------------------|---------------------------------------------------------------------------------------------|----------------------------|-----------------|------------------------------------------------|-----------------------------|---------------------------------------------------|
| CLI Interface    | Parse arguments uniformly  | - [ ] Use argparse; validate early; forbid late validation                                 | codebase_index_cmd         | main            | argv, base_dir, parser_script_path             | JSONâ€'LD file                | Path existence checks before graph loading        |
| Path Resolution  | Normalize file references  | - [ ] Resolve relative to base_dir; canonicalize; forbid absolute hardcoding              | codebase_index_cmd         | main            | input, config paths                            | Resolved Path objects       | Path.resolve() with base_dir anchor               |
| Error Recovery   | Fail fast with clarity     | - [ ] Validate config parse; check schema; forbid silent errors                            | codebase_index_cmd         | main            | YAML config dict                               | Validated config or exit    | sys.exit(1) on parse/validation failure           |

---

### Module: `knowgrph_parser.codebase_index_jsonld`

**From workflow nodes/edges to AgenticRAG codebase index JSONâ€'LD**: Module → converts generic node/edge records into AgenticRAG-aligned JSONâ€'LD nodes with provenance and layers → attaches runtime events and traversal edge mappings.

Key behaviors:

- Normalizes file paths and ignores configured paths via `should_ignore_path` and `normalize_rel_path`.
- Canonicalizes `File` node IDs to the normalized path and tracks `metadata.aliases` for original IDs.
- Maps edges into adjacency lists on source nodes (`node[label] = ["kg:targetId", …]`).
- Populates `metadata.layers.indexing`, `metadata.layers.traversal`, and `metadata.layers.tracing`.
- Advertises traversal labels in `metadata.jsonLdMapping.contextEdgeProperties`.

**Interface Pattern**:  
`build_jsonld(graph, codebase_id, traversal_edges, ignored_paths, raw_ignored_patterns, runtime_event_specs)` → returns `{ "@context", "@graph", "metadata" }` → O(nodes + edges + runtime_events).

**Design Compliance**:

| Context              | Intent                          | Directive                                                                                   | Module                     | Function/Method         | Input                                          | Output                           | Decision Logic                                    |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|----------------------------|-------------------------|------------------------------------------------|----------------------------------|---------------------------------------------------|
| Path Normalization   | Ensure consistent identifiers   | - [ ] Apply POSIX normalization; resolve relatives; forbid platform-specific paths         | codebase_index_jsonld      | normalize_rel_path      | Path string, base_path                         | Normalized relative path         | Path.resolve().relative_to() with as_posix()      |
| Ignore Filtering     | Respect exclusion patterns      | - [ ] Match glob patterns; skip hidden files; forbid inclusion of ignored paths            | codebase_index_jsonld      | should_ignore_path      | Path string, patterns list                     | Boolean (ignore/include)         | fnmatch.fnmatch() over compiled patterns          |
| ID Canonicalization  | Unify File node identifiers     | - [ ] Remap to normalized path; store aliases; forbid duplicate IDs                        | codebase_index_jsonld      | build_jsonld            | Graph nodes dict                               | Canonical node dict              | Single File node per normalized path              |
| Edge Adjacency       | Build traversal lists           | - [ ] Group edges by source/label; append targets; forbid duplicate edges                  | codebase_index_jsonld      | build_jsonld            | Graph edges list                               | node[label] = [targets]          | Dict accumulation with label keys                 |
| Metadata Layers      | Encode provenance lineage       | - [ ] Populate indexing/traversal/tracing layers; timestamp; forbid missing metadata       | codebase_index_jsonld      | build_jsonld            | Runtime events, traversal edges                | metadata.layers dict             | Structured dict with schema URLs                  |
| JSONâ€'LD Context      | Declare edge properties         | - [ ] List traversal labels in contextEdgeProperties; version context; forbid schema drift | codebase_index_jsonld      | build_jsonld            | Traversal edges config                         | @context.contextEdgeProperties   | Copy traversal_edges keys into context            |

---

### Module: `knowgrph_parser.python_codebase_index_cmd`

**From Python codebase root to index JSONâ€'LD + configs**: Module → walks Python files, builds a code graph, enriches it with GraphRAG paths and runtime events, and writes JSONâ€'LD index, schema config, and orchestrator config.

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
`main(argv, base_dir, parser_script_path)` → resolves codebase root and paths from orchestrator config → builds in-memory graph via `build_code_graph` → calls `build_jsonld_document` → ensures schema and orchestrator config files → O(files + relations + runtime_events).

**Design Compliance**:

| Context              | Intent                          | Directive                                                                                   | Module                          | Function/Method    | Input                                          | Output                                | Decision Logic                                    |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|---------------------------------|--------------------|------------------------------------------------|---------------------------------------|---------------------------------------------------|
| Codebase Discovery   | Scan Python files recursively   | - [ ] Walk directory tree; filter .py files; forbid non-Python inclusions                  | python_codebase_index_cmd       | main               | codebase_root path                             | File list                             | os.walk() with .py extension filter               |
| Config Resolution    | Merge CLI and YAML settings     | - [ ] Override defaults with CLI args; validate merged config; forbid config conflicts     | python_codebase_index_cmd       | main               | argv, orchestrator config                      | Resolved config dict                  | CLI args take precedence over YAML defaults       |
| Graph Construction   | Build AST-based code graph      | - [ ] Parse Python AST; extract nodes/edges; forbid syntax errors                          | python_codebase_index_cmd       | main               | File list, config                              | GraphNodeRecord objects               | Delegate to build_code_graph()                    |
| Artifact Generation  | Write JSONâ€'LD and configs       | - [ ] Ensure output directories; write atomically; forbid partial writes                   | python_codebase_index_cmd       | main               | JSONâ€'LD doc, schema, orchestrator config       | File system artifacts                 | Path.mkdir(parents=True, exist_ok=True)           |

---

### Module: `knowgrph_parser.python_codebase_index_document`

**From code graph records to AgenticRAG JSONâ€'LD**: Module → rewrites `GraphNodeRecord` objects into JSONâ€'LD nodes with `@id`, `@type`, `labels`, `path`, `properties`, and `metadata` → encodes GraphRAG paths and runtime events.

Key behaviors:

- Applies GraphRAG path specs from orchestrator config to nodes, storing:
  - `graphRAGPath.query`, `graphRAGPath.traverse`, `graphRAGPath.example`, `graphRAGPath.multiHop`, `graphRAGPath.context`.
  - Derived `chunk_text` string for quick inspection.
- Adds provenance metadata:
  - `source` (graph ID), `timestamp`, `codebaseId`, `codebasePath`, and `codebaseArea`.
- Propagates traversal edges and runtime event relationships into JSONâ€'LD context and `metadata.layers`.

**Design Compliance**:

| Context              | Intent                          | Directive                                                                                   | Module                               | Function/Method         | Input                                          | Output                           | Decision Logic                                    |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|--------------------------------------|-------------------------|------------------------------------------------|----------------------------------|---------------------------------------------------|
| Node Transformation  | Convert records to JSONâ€'LD      | - [ ] Map GraphNodeRecord fields to @id/@type; preserve properties; forbid field loss      | python_codebase_index_document       | build_jsonld_document   | GraphNodeRecord list                           | JSONâ€'LD @graph array             | Direct field mapping with schema validation       |
| GraphRAG Enrichment  | Attach path specifications      | - [ ] Apply graphRAGPath configs; compute chunk_text; forbid missing specs                 | python_codebase_index_document       | build_jsonld_document   | Orchestrator graphRAGPaths config              | node.graphRAGPath dict           | Match node type to config key, inject fields      |
| Provenance Tracking  | Record creation metadata        | - [ ] Set timestamp, source, codebaseId; version; forbid anonymous nodes                   | python_codebase_index_document       | build_jsonld_document   | Codebase metadata                              | node.metadata.provenance         | ISO 8601 timestamp, config-sourced IDs            |
| Runtime Events       | Link monitoring specifications  | - [ ] Attach runtime_events from config; reference event IDs; forbid orphaned events       | python_codebase_index_document       | build_jsonld_document   | Runtime event specs                            | metadata.layers.tracing          | Copy event specs, validate referential integrity  |

---

### Module: `knowgrph_parser.markdown_cmd`

**From Markdown files to Knowledge Graph JSONâ€'LD + configs**: Module → scans directory for markdown files → parses each into a graph → unifies entities across documents → generates schema and orchestrator configs.

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
`main` → `_list_markdown_files` → `parse_markdown_to_graph_jsonld` (loop) → `_unify_entities_across_docs` (DocumentUnifier) → `build_schema_config_jsonld` → writes artifacts → O(docs * tokens).

**Design Compliance**:

| Context              | Intent                          | Directive                                                                                   | Module                     | Function/Method              | Input                                          | Output                                | Decision Logic                                    |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|----------------------------|------------------------------|------------------------------------------------|---------------------------------------|---------------------------------------------------|
| File Discovery       | Enumerate markdown sources      | - [ ] Glob *.md recursively; handle single file or directory; forbid non-markdown files    | markdown_cmd               | _list_markdown_files         | Path (file or dir)                             | List of .md paths                     | Path.glob('**/*.md') or [Path] if file            |
| Per-File Parsing     | Generate individual graphs      | - [ ] Parse each markdown to JSONâ€'LD; isolate failures; forbid cross-doc contamination    | markdown_cmd               | main (loop)                  | Markdown file paths                            | List of JSONâ€'LD documents            | Independent parse_markdown_to_graph_jsonld calls  |
| Entity Unification   | Merge cross-document entities   | - [ ] Resolve canonical IDs; deduplicate entities; forbid entity fragmentation             | markdown_cmd               | _unify_entities_across_docs  | List of JSONâ€'LD docs                           | Unified JSONâ€'LD @graph               | DocumentUnifier merges by label/properties        |
| Config Generation    | Synthesize schema/orchestrator  | - [ ] Extract entity types; build schema; generate traversal config; forbid manual updates | markdown_cmd               | main                         | Unified graph                                  | schema-config.jsonld, orchestrator.yaml | Auto-detect types, emit YAML/JSONâ€'LD templates   |

---

### Module: `knowgrph_parser.graph_builder`

**From single Markdown file to Graph JSONâ€'LD document**: graph_builder parses blocks into structural nodes and edges, then optionally runs semantic processing to emit entities, mentions, and semantic relations before returning a connected JSONâ€'LD graph.

**Key behaviors**:

- Structural layer: `_process_blocks` builds `Document`, `Section`, `Paragraph`, `CodeBlock`, `Table`, `List`, and `ListItem` nodes plus `hasSection`, `hasBlock`, `hasItem`, `linksTo`, and `next` edges with provenance metadata.
- Semantic hook: `process_semantics` (from `semantic_processor`) consumes `semantic_sources` and attaches `Entity` / `Mention` nodes and semantic edges such as `semanticRelation` and `coOccursWith`.
- Auto-tuning: Semantic defaults (phrase boundaries, edge thresholds, pattern support, centrality) are configurable via environment, frontmatter, or explicit `semantic_config` overrides.

**Interface Pattern**:
`parse_markdown_to_graph_jsonld(file_path, ...)` → `parse_frontmatter` → `parse_blocks` + `_process_blocks` → `process_semantics` (optional) → returns dict with `@graph` and `metadata`.

**Design Compliance**:

| Context              | Intent                          | Directive                                                                                   | Module                     | Function/Method              | Input                                          | Output                           | Decision Logic                                    |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|----------------------------|------------------------------|------------------------------------------------|----------------------------------|---------------------------------------------------|
| Block Parsing        | Identify markdown structures    | - [ ] Tokenize by headers/paragraphs/code/tables; preserve order; forbid block loss        | graph_builder              | parse_blocks                 | Markdown text                                  | Block list (type, content)       | Regex/state machine for markdown syntax           |
| Structural Nodes     | Build document graph            | - [ ] Create typed nodes for blocks; link with edges; forbid orphaned nodes                | graph_builder              | _process_blocks              | Block list                                     | @graph array (nodes + edges)     | Sequential node creation with parent linking      |
| Semantic Processing  | Extract entities/relations      | - [ ] Run NLP pipeline; identify entities; forbid semantic errors                          | graph_builder              | process_semantics            | Structural graph, semantic config              | Enhanced @graph with entities    | Delegate to semantic_processor module             |
| Config Inheritance   | Merge frontmatter and defaults  | - [ ] Parse YAML frontmatter; override defaults; forbid config collisions                  | graph_builder              | parse_frontmatter            | Markdown text, default config                  | Merged config dict               | YAML parse with dict.update() precedence          |

---

## Component Responsibility Matrix

| Layer      | Path                                             | Component                | Interface/Method                 | Responsibility (S-V-O)                                                          | Dependencies                         | Contracts                                      | LOC    |
|-----------|--------------------------------------------------|--------------------------|----------------------------------|-------------------------------------------------------------------------------|--------------------------------------|-----------------------------------------------|--------|
| Indexing  | `knowgrph_parser/codebase_index_cmd.py`          | —                        | `main`                          | CodebaseIndexCli loads workflow graph and config → emits index JSONâ€'LD file | `argparse`, `json`, `.codebase_index_jsonld` | JSONâ€'LD index, orchestrator config linkage    | ~31-105 |
| Indexing  | `knowgrph_parser/codebase_index_jsonld.py`       | —                        | `build_jsonld`                  | JsonLdBuilder converts workflow nodes/edges into AgenticRAG index JSONâ€'LD    | `.codebase_index_artifacts`, `.runtime_events` | JSONâ€'LD `@context`, `@graph`, `metadata`      | ~17-271 |
| Indexing  | `knowgrph_parser/python_codebase_index_cmd.py`   | —                        | `main`                          | PythonIndexCli walks codebase and writes JSONâ€'LD, schema, orchestrator files | `.python_codebase_index_document`, `.python_codebase_index_graph` | Codebase index JSONâ€'LD + configs | ~22-112 |
| Indexing  | `knowgrph_parser/python_codebase_index_document.py` | —                     | `build_jsonld_document`         | PythonJsonLdBuilder maps GraphNodeRecord objects into AgenticRAG JSONâ€'LD     | `.runtime_events`, `.codebase_index_artifacts` | JSONâ€'LD `@context`, `@graph`, `metadata.layers` | ~118-227 |
| Docs      | `knowgrph/package.json`                         | docs:update script        | `npm run docs:update`           | DocsUpdateJob runs markdown pipeline for docs/documents → refreshes graph/schema/orchestrator previews | `python -m knowgrph_parser markdown`, `.knowgrph-workflow-preview` | Preview artifacts synced with authored docs     | —      |
| Semantic  | `knowgrph_parser/markdown_cmd.py`                | DocumentUnifier          | `_unify_entities_across_docs`   | Unifier merges entities across docs → resolves canonical IDs (L102-165)      | `.graph_builder`, `.schema_config`   | JSONâ€'LD `@graph`, canonical entity IDs         | ~200+  |
| Semantic  | `knowgrph_parser/semantic_processor.py`          | TokenLinker              | `merge_tokens_to_spans`         | TokenLinker merges tokens to spans → identifies entities based on phrase boundaries | `.token_linker`, `.markdown_blocks`  | Token spans, confidence scores                 | ~200+  |
| Semantic  | `knowgrph_parser/semantic_processor.py`          | EdgeElevator             | `extract_sentence_features`     | EdgeElevator extracts sentence features → enriches edges with temporal/modal attributes | `.edge_elevator`                     | Edge attributes (temporal, modal)              | ~200+  |

---

## Dependency & Integration Standards

**Dependency Declaration**

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Python Dependencies  | Minimize external packages      | - [ ] Use stdlib where possible; declare imports explicitly; forbid implicit dependencies   |
| Canvas Decoupling    | Avoid parser-UI coupling        | - [ ] Expose JSONâ€'LD only; no direct UI imports; forbid circular references                |
| Config Injection     | Parameterize behavior           | - [ ] Load from YAML; pass as arguments; forbid global state                                |

**Integration Contracts**

- JSONâ€'LD graph:
  - Must expose `@context`, `@graph`, and `metadata` fields.
  - Node IDs use the `KG_PREFIX` (e.g., `kg:<localId>` or `kg:<normalizedPath>`) defined in `knowgrph_parser/common.py`.
- Orchestrator config:
  - Must include `graph.codebase_root`, `graph.index_jsonld`, `graph.index_schema`.
  - AgenticRAG section defines `runtime_events` and `graph_rag_paths` for `python_codebase_index_document`.

**Coupling Metrics**

- Codebase index builders are decoupled from the canvas:
  - Canvas only depends on the JSONâ€'LD schema, not internal Python representations.
  - Runtime events and GraphRAG paths are attached via configuration, not hardcoded imports.

---

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

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Python Modules       | Follow PEP 8 conventions        | - [ ] Use snake_case for files/functions; PascalCase for classes; forbid mixedCase         |
| JSONâ€'LD Properties   | Maintain schema consistency     | - [ ] Use camelCase for properties; PascalCase for types; forbid underscores in JSON       |
| YAML Config Keys     | Align with orchestrator         | - [ ] Use snake_case for keys; nest logically; forbid flat namespaces                      |
| Constants            | Signal immutability             | - [ ] Use UPPER_SNAKE_CASE; define at module level; forbid magic numbers                   |

**File Organization**

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Module Size          | Maintain readability            | - [ ] Keep files under 600 LOC; split at responsibility boundaries; forbid monolithic files |
| Function Length      | Enable comprehension            | - [ ] Limit functions to 50 lines; extract helpers; forbid deep nesting (>3 levels)        |
| Import Organization  | Clarify dependencies            | - [ ] Group stdlib, third-party, local; sort alphabetically; forbid wildcard imports       |

---

## Testing & Quality Standards

**Test Coverage Metrics**

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Unit Tests           | Validate individual functions   | - [ ] Test pure functions in isolation; mock I/O; forbid untested logic                    |
| Integration Tests    | Verify end-to-end flows         | - [ ] Test full pipelines; use realistic fixtures; forbid incomplete coverage              |
| Regression Tests     | Prevent breakage                | - [ ] Capture known issues; version test data; forbid deleting passing tests               |

**Test Categories**

- Unit-like:
  - Functions such as `build_jsonld` and `build_jsonld_document` can be exercised via small synthetic graphs.
- Integration:
  - Full pipeline from orchestrator config → codebase index JSONâ€'LD → canvas traversal.

**Quality Gates**

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| JSONâ€'LD Validation   | Ensure schema compliance        | - [ ] Validate @context/@graph structure; check referential integrity; forbid malformed output |
| Config Validation    | Prevent runtime errors          | - [ ] Parse YAML early; validate required keys; forbid late-stage config failures          |
| Determinism          | Enable reproducible builds      | - [ ] Fix timestamps in tests; normalize paths; forbid non-deterministic outputs           |

---

## Anti-Patterns (Forbidden)

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Circular Dependencies| Maintain clean architecture     | - [ ] Design unidirectional flows; avoid mutual imports; forbid circular module references |
| Hardcoded Paths      | Support any environment         | - [ ] Parameterize all paths; resolve relative to config; forbid absolute hardcoded paths  |
| Magic Numbers        | Document decisions              | - [ ] Define named constants; comment thresholds; forbid unexplained literals              |
| Silent Failures      | Surface errors early            | - [ ] Raise exceptions; log warnings; forbid swallowed errors                              |
| Global State         | Ensure thread safety            | - [ ] Pass state explicitly; avoid module-level mutables; forbid shared state              |
| Dataset Coupling     | Preserve generality             | - [ ] Abstract entity types; parameterize schemas; forbid dataset-specific assumptions     |

---

## Repository Health Checklist

**Structural Health**

| Context              | Intent                          | Directive                                                                                   | Status |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|--------|
| Modularity           | Isolate concerns                | - [ ] Index builders in knowgrph_parser; UI in canvas; forbid mixed responsibilities       | ✓      |
| Schema Consistency   | Maintain JSONâ€'LD standards      | - [ ] Enforce @context/@graph structure; version metadata; forbid ad-hoc formats           | ✓      |

**Maintainability**

| Context              | Intent                          | Directive                                                                                   | Status |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|--------|
| Documentation        | Enable onboarding               | - [ ] Document all public interfaces; provide examples; forbid undocumented APIs           | ✓      |
| Dependency Clarity   | Minimize coupling               | - [ ] Explicit imports; minimal external deps; forbid implicit dependencies                | ✓      |

**Operations**

| Context              | Intent                          | Directive                                                                                   | Status |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|--------|
| CLI Automation       | Support CI/CD pipelines         | - [ ] Expose CLI entrypoints; enable scripting; forbid manual-only workflows              | ✓      |
| Config Management    | Centralize control              | - [ ] Use orchestrator YAML; version configs; forbid scattered settings                    | ✓      |

---

## Version Control Standards

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Change Documentation | Track evolution                 | - [ ] Update this doc for schema changes; link commits; forbid undocumented breaking changes |
| Backward Compatibility| Protect existing integrations  | - [ ] Deprecate gracefully; version schema URLs; forbid abrupt API changes                 |
| Commit Hygiene       | Maintain clean history          | - [ ] Write descriptive messages; group related changes; forbid monolithic commits         |