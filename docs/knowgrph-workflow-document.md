# Interactive Product Tour & Onboarding Flow: AgenticRAG Workflow

*Aligned with Generic GraphRAG Pipeline: Token Linking to Corpus Reasoning*

## Architecture Integration

**From UI to pipeline**: Workflow tab -> maps 8 UI steps to semantic orchestration layers (Detection -> Schema Inference -> Ingestion -> Parsing -> Orchestration -> Rendering -> Agentic RAG) -> exposes configuration controls per layer -> maintains domain-agnostic processing -> delivers queryable knowledge graphs from heterogeneous sources.

**Phase Mapping**:
- Steps 1-2 (Load/Validate) -> TOKEN_LINKING + EDGE_ELEVATION: Loader validates syntax -> Parser extracts entities -> Validator checks structure
- Step 3 (Configure) -> THRESHOLD_TUNING + SCHEMA: Adaptive boundaries -> Field definitions -> Visual encoding rules
- Step 4 (Visualize) -> DOCUMENT_UNIFICATION + RENDERING: Cross-document merging -> Layout execution -> Interaction handling
- Step 5 (Export) -> CORPUS_REASONING + AGENTIC_RAG: Format transformation -> Workflow artifacts -> Traversal configurations

**Step Labels** (Single-sourced from `canvas/src/features/panels/config.ts`):
1. Schema (decide meaning once)
2. UI curation layer
3. Ingest
4. Enrich
5. Index and store
6. Agentic reasoning
7. Produce
8. Reuse and render

---

## Workflow Presets (Configuration-Driven Templates)

**From manual to preset**: System -> loads dataset + schema + orchestrator combinations -> demonstrates pipeline capabilities without hardcoded logic -> maintains configuration/data separation -> delivers reproducible workflows across domains.

<!-- WORKFLOW_PRESETS_TABLE_START -->

| Preset ID | Dataset | Schema | Primary use case |
|---|---|---|---|
| `sample-investors-top3-3d` | `data/test-data/graph_202512091600.json` | `schema-config/knowgrph-universal-schema-config.jsonld` | Demo: Sample Investors Top-3 (3D) |
| `ai-kg-viz` | `data/test-data/ai-kg-viz_1500.json` | `schema-config/knowgrph-universal-schema-config.jsonld` | Demo: AI KG Visualization |
| `ai-customer-voice-management` | `data/test-data/ai-customer-voice-management.graph.json` | `schema-config/knowgrph-universal-schema-config.jsonld` | Demo: AI Customer Voice Management |
| `universal-lean-startup-kg` | `data/test-data/universal-lean-startup-kg.json` | `schema-config/knowgrph-universal-schema-config.jsonld` | Demo: Universal Lean Startup Knowledge Graph |
| `a0-investors-kg` | `data/test-data/a0.jsonld` | `schema-config/knowgrph-universal-schema-config.jsonld` | Demo: A0 Investors Knowledge Graph |
| `venture-capital-portfolio` | `data/test-data/graph_202512091600.json` | `schema-config/knowgrph-universal-schema-config.jsonld` | Demo: Venture Capital Portfolio |

<!-- WORKFLOW_PRESETS_TABLE_END -->

**Principle Compliance**: ✅ Presets bind parser+dataset+schema (not domain logic) | ✅ Same pipeline runs across 3+ domains without code changes

---

## Tooltip Semantics (Intent-Directive Documentation)

**Parser Tooltip** (`WORKFLOW_STEP3_PARSER_TOOLTIP` -> `schema-config/workflow-step3-parser-role-action-outcome.jsonld`):
- From raw input to GraphData: Parser tab -> loads specifications from generic templates -> applies transformations (CSV mapping, JSON-LD context) -> validates structure without domain assumptions -> delivers canonical GraphData for orchestration.

**Orchestrator Tooltip** (`WORKFLOW_STEP6_ORCHESTRATOR_TOOLTIP` -> `schema-config/workflow-step6-orchestrator-role-action-outcome.jsonld`):
- From static to dynamic: Orchestrator tab -> exposes AgenticRAG presets (max hops, relation filters, context window) -> executes queries via configurable strategies -> maintains Graph Traversal panel alignment -> delivers provenance-linked subgraphs.

**Bottom Panel Tooltip** (`WORKFLOW_STEP8_BOTTOM_TABS_TOOLTIP` -> `schema-config/workflow-step8-bottom-tabs-role-action-outcome.jsonld`):
- From graph to views: Bottom tabs -> combine Data/Table/Render on shared GraphData -> validate constraints, visualize distributions, export layouts -> preserve AgenticRAG semantics across transitions.

---

## Step 1: Data Ingestion (Loader Layer)

### From sources to syntax validation

**Intent**: Loader -> accepts data from any source (file, API, markdown, clipboard) -> validates JSON syntax without semantic interpretation -> preserves provenance (source path, timestamp, line ranges) -> delivers raw structure to Parser layer.

**Subject-Verb-Object Directives**:
```
loader accepts file_upload_via_drag_drop_or_picker
loader fetches data_from_url_via_http_request
loader receives markdown_via_local_device_or_url
loader validates json_syntax_via_built-in_parser
loader preserves source_metadata (path, timestamp, line_ranges)
loader logs ingestion_statistics_for_audit
```

**Supported Sources**: File upload (JSON, CSV, JSON-LD, Markdown), API endpoint (HTTP/HTTPS), Database connection (SQL/NoSQL via external tools), Clipboard paste, Markdown (Toolbar -> Workspace Actions -> Import)

**Markdown Import Flow**:
- From markdown to graph: Workspace Actions -> triggers picker -> Loader invokes `loadGraphDataFromTextViaParser()` with markdown parser -> Parser builds JSON-LD blocks with provenance (`metadata.documentPath`, `metadata.lineStart/lineEnd`, `metadata.structure_types: [Paragraph, List, CodeBlock, Section, Table]`) -> converts to GraphData via `parseJsonLd()` -> Bottom panel Markdown section renders source + GFM preview with selection-driven highlighting -> maintains bidirectional navigation without coupling parser to formatting.

**Rich Media Rendering**: Mermaid diagrams inline SVG -> single-click opens MainPanel Preview tab 16:9 gallery -> subsequent click promotes to fullscreen zoomable viewer (Fit, zoom, pan) -> supports images, iframe embeds, mp4/webm with same flow.

**Configuration Schema**:

**max_upload_size_mb**: From small to large | Loader -> sets maximum file size -> prevents memory exhaustion -> balances convenience versus performance | Default: 50; Min: 10; Max: 200; Interval: 10

**auto_detect_format**: From explicit to implicit | Loader -> infers format from extension/content -> reduces manual configuration -> maintains user override | Default: true; Values: true | false

**Principle Compliance**: ✅ Accepts any valid source | ✅ Syntax validation only | ✅ Provenance preserved | ✅ Works identically across domains

---

## Step 2: Structural Validation (Parser + Validator Layers)

### From syntax to structure integrity

**Intent**: Parser -> receives raw JSON from Loader -> validates against schema (ID uniqueness, edge references) -> computes quality metrics (node count, edge density, property completeness) -> delivers validated GraphData or detailed error report.

**Subject-Verb-Object Directives**:
```
parser validates node_id_uniqueness_via_hash_set
parser checks edge_references_against_node_registry
parser computes structural_metrics (count, density)
parser detects property_completeness_patterns
parser identifies json-ld_context_edge_properties
parser generates validation_report_with_errors_warnings
parser preserves structure_types_in_provenance
parser ignores property_semantic_content
```

**Validation Checks**: Node ID uniqueness via hash collision detection | Edge references validated (source/target exist) | Schema conformance (required fields: @id, labels for nodes; source, target, label for edges) | Quality metrics (node count, edge count, avg degree, connected components)

**JSON-LD Context Edge Mapping**: From context to traversal | Parser -> detects edge properties in @context treated as @id relationships -> exposes toggle UI for traversal selection -> stores in `GraphData.metadata.jsonLdMapping.contextEdgeProperties` -> Orchestrator/Schema/Render layers reuse mapping -> first `rag:TraversalRule` seeds `allowedRelations` from selected keys.

**Inspection Tools**: Validation report (structural errors, warnings) | Sample preview (first 10 nodes/edges) | Bottom panel Parser tab (JSON/YAML/Python editor for transformations) | JSON-LD mapping summary (node/edge counts, context properties, traversal toggles)

**Configuration Schema**:

**validation_strictness**: From permissive to strict | Validator -> controls whether warnings block processing -> balances quality versus flexibility | Default: warn; Values: ignore | warn | error

**sample_preview_size**: From minimal to comprehensive | Validator -> sets preview node/edge count -> balances inspection versus performance | Default: 10; Min: 5; Max: 50; Interval: 5

**Principle Compliance**: ✅ Parser ignores domain-specific properties | ✅ Structural validation only | ✅ Works across finance/biology/AI domains | ✅ Provenance preserved (structure_types annotated, not validated)

---

## Step 3: Schema Configuration (Schema Inference + Field Definition)

### From implicit to explicit semantics

**Intent**: Schema Advisor -> analyzes graph structure (type distributions, property schemas) -> suggests visualization rules (sizing, coloring, layout) -> exposes field configuration for derived properties -> maintains domain-agnostic templates -> delivers reusable styling configurations.

**Subject-Verb-Object Directives**:
```
advisor analyzes node_type_distribution_via_label_frequency
advisor detects property_schemas_via_value_type_inference
advisor suggests layout_algorithms_from_graph_topology
advisor proposes visual_encodings_for_numeric_properties
advisor enables field_definition_via_graph_fields_editor
advisor validates field_formulas_against_available_properties
advisor exports schema_configurations_as_json
```

**Configuration Options**: Node styling (size by any numeric property, color by label, shape selection) | Edge styling (width by weight, color by type, dash by confidence) | Layout algorithm (force-directed, hierarchical, radial, grid, 3D) | Interaction (click, drag, hover, expansion controls)

**Graph Fields Editor**: From raw to derived | Main panel -> opens centered overlay (~80% viewport) -> exposes derived field definitions (formulas from existing properties) -> toggles visibility -> synchronizes with Graph Data Table columns -> recalculates on property updates without refresh.

**Polygon Presets Editor**: From hardcoded to schema-driven | Graph Fields tab -> Field Settings -> Schema extras -> configures convex hull styling (fill, opacity, stroke, dash) -> defines grouping via JSON-LD array properties -> stores in `schema.metadata["canvas:polygons"]` -> Canvas reads presets without renderer code changes.

**Configuration Schema**:

**default_node_size**: From uniform to differentiated | Schema -> sets baseline radius before property scaling -> controls visual density | Default: 5; Min: 2; Max: 20; Interval: 1

**property_scaling_method**: From linear to perceptual | Schema -> selects transform for value-to-visual mapping -> affects difference perception | Default: sqrt; Values: linear | sqrt | log | rank

**layout_convergence_threshold**: From iterative to settled | Schema -> sets force-directed stopping criterion -> balances quality versus computation | Default: 0.01; Min: 0.001; Max: 0.1; Interval: 0.001

**Principle Compliance**: ✅ Generic node/edge structures | ✅ Property-based styling (no "Company is blue" rules) | ✅ Domain-agnostic templates | ✅ Arbitrary property formulas without semantic assumptions

---

## Step 4: Visualization & Exploration (Renderer + Orchestrator Layers)

### From graphs to insights

**Intent**: Renderer -> applies schema-driven styling -> executes topology-aware layout -> exposes interaction controls -> synchronizes with Orchestrator traversal -> delivers explorable visual representation supporting pattern discovery.

**Subject-Verb-Object Directives**:
```
renderer applies schema_styling_rules_to_nodes_edges
renderer executes layout_algorithm_from_topology_detection
renderer handles user_interactions (click, drag, hover, zoom)
renderer synchronizes selection_state_with_orchestrator
renderer highlights neighbors_via_traversal_rules
renderer renders group_polygons_from_schema_metadata
renderer exports visualization_snapshots (png, svg, pdf)
```

**Visualization Features**: Dynamic layout (force-directed default, hierarchical for DAGs, radial for trees, 3D toggle via Space) | Minimap navigation | Zoom/pan controls (mouse wheel, drag, reset via R) | Search/filter by property values | Selection-driven highlighting (click node -> highlight neighbors, dim unrelated)

**Graph Data Table Aggregation**: From flat to grouped | Bottom panel -> aggregates numeric fields by group membership (JSON-LD arrays) -> renders toggleable charts per group (Off -> Radial hull -> Bars -> Sparkline) -> start mode configurable in Settings -> keeps behavior user-configurable without dataset presets.

**Group Polygons**: From points to regions | Toolbar button -> toggles convex hulls around related nodes (2D/3D) -> membership from JSON-LD array properties -> styling from `schema.metadata["canvas:polygons"]` -> configuration in Graph Fields tab -> remains schema-driven without hardcoded names.

**Configuration Schema**:

**highlight_neighbor_depth**: From immediate to extended | Renderer -> sets hop distance for neighbor highlighting -> controls visual context radius | Default: 1; Min: 1; Max: 5; Interval: 1

**dim_unselected_opacity**: From hidden to visible | Renderer -> sets opacity for non-highlighted nodes -> balances focus versus context | Default: 0.2; Min: 0.0; Max: 0.7; Interval: 0.1

**3d_formula_mode**: From flat to spatial | Renderer -> controls Z-axis positioning (property-driven, cluster-based, temporal) -> affects spatial reasoning | Default: cluster; Values: flat | cluster | property | temporal

**Principle Compliance**: ✅ Generic structures | ✅ JSON-LD/schema-driven polygons | ✅ Generic group membership (no "Phase 1" literals) | ✅ Works with any validated graph

---

## Step 5: Export & Production (Format Transformers + Workflow Artifacts)

### From graphs to reusable artifacts

**Intent**: Exporter -> transforms GraphData to target formats (JSON-LD, CSV, GraphML, Cypher, Markdown) -> generates workflow configurations (GraphRAG JSON-LD, schema templates, field definitions, history snapshots) -> preserves provenance across conversions -> delivers portable artifacts for downstream pipelines.

**Subject-Verb-Object Directives**:
```
exporter transforms graphdata_to_json-ld_via_context_injection
exporter flattens nodes_edges_to_csv_tables
exporter generates cypher_statements_for_neo4j
exporter serializes schema_configuration_as_json
exporter captures workflow_state_as_history_json-ld
exporter exports field_definitions_as_graph_fields_json-ld
exporter builds graphrag_workflow_from_traversal_rules
exporter preserves provenance_metadata_across_conversions
```

**Export Formats**: Graph data (JSON, JSON-LD, CSV, GraphML, Neo4j Cypher) | Markdown (plain-text .md from bottom panel editor) | Visualization (PNG, SVG, PDF) | Configuration (Schema JSON, Field Definitions JSON-LD, History JSON-LD) | GraphRAG Workflow JSON-LD

**GraphRAG Workflow Export**: From graph to orchestration | System -> builds `rag:GraphRAGWorkflow` JSON-LD from GraphData -> includes `graphId`, `retrievalMethod: 'graph-traversal'`, `maxHops`, `traversalRules[]` (`ruleType`, `allowedRelations[]`, `rulePriority`), `contextWindow` (`rag:ContextWindow`, `contextSize`, `contextStrategy`) -> seeds first rule from `GraphData.metadata.jsonLdMapping.contextEdgeProperties` -> enables downstream AgenticRAG consumption.

**YAML Config Import**: From CLI to UI | Workflow tab -> imports `config.yaml` (e.g., `configs/graphrag/aiap22-codebase-config.yaml`) -> transforms to `rag:GraphRAGWorkflow` JSON-LD -> maps `duckdb_queries` to `duckdbQueries[]` array -> populates Orchestrator DuckDB presets dropdown -> keeps queries configuration-driven.

**CLI Offline Pipelines**: `python -m knowgrph_parser` subcommands -> `jsonld-universal` (structural conversion) | `markdown` (Markdown -> JSON-LD with provenance) | `parse-codebase-index` (workflow trace -> codebase graph + traversal metadata) | `embed-codebase-index` (deterministic embeddings from chunk_text) | `test-embedding-sanity` (validate dimensions/coverage) | `pipeline` (orchestrates parse -> embed -> validate via `npm run pipeline`)

**Configuration Schema**:

**export_embedding_precision**: From compact to precise | Exporter -> controls decimal places for embedding vectors -> balances file size versus accuracy | Default: 6; Min: 3; Max: 15; Interval: 1

**cypher_batch_size**: From sequential to batch | Exporter -> groups CREATE statements for Neo4j -> affects transaction size and speed | Default: 1000; Min: 100; Max: 10000; Interval: 100

**provenance_export_mode**: From minimal to comprehensive | Exporter -> controls metadata inclusion -> balances auditability versus size | Default: standard; Values: minimal | standard | comprehensive

**Principle Compliance**: ✅ Format-independent exports | ✅ Portable configurations | ✅ No file path coupling | ✅ Schema-driven workflows

---

## Domain-Agnostic Workflow Examples

**Financial Network**: Load investments.json (50 nodes: entities, 75 edges: investments) -> Validate structure -> Configure (size by amount, force-directed layout) -> Visualize (expand clusters, 2-hop paths) -> Export (GraphML for Neo4j, preserve provenance)

**Biological Interactions**: Fetch from API (200 nodes: proteins/genes, 350 edges: interactions with confidence) -> Validate (filter edges <0.7) -> Configure (hierarchical layout, color by pathway, 3D by confidence) -> Visualize (filter pathways) -> Export (JSON-LD with embeddings for similarity search)

**AI Concepts**: Paste JSON (40 nodes with embeddings/chunk_text, 60 dependency edges) -> Validate (embedding dimensions consistent) -> Configure (derived field: importance = confidence × mention_count, layer layout) -> Visualize (Orchestrator "Find prerequisites" query, 3-hop BFS) -> Export (Schema + data + GraphRAG workflow JSON-LD)

**Customer Feedback**: Load preset "AI Customer Voice Management" -> Validate (node types: CustomerFeedback, Customer, Topic; edge types: submittedBy, hasTopic, assignedTo) -> Configure (priority-based sizing, group polygons for status, 3D spatial) -> Visualize (toggle hulls, select high-priority node, Graph Data Table highlights group chart) -> Export (JSON-LD + GraphRAG workflow, CSV for spreadsheet)

---

## Troubleshooting (Structural Validation Focus)

**Duplicate node IDs**: Cause: Multiple nodes share @id | Solution: Parser ensures uniqueness -> auto-generates UUIDs if needed | Prevention: Loader preserves source IDs when unique, hashes duplicates

**Broken edge references**: Cause: Edge references non-existent node | Solution: Validator cross-references edges against node registry -> flags missing in report | Prevention: Parser validates referential integrity before Renderer

**No visualization**: Cause: Empty graph or invalid schema | Solution: Validator checks node count >0 -> Schema tab applies default if custom fails -> Renderer logs topology detection | Prevention: Loader logs statistics -> Parser surfaces warnings before Renderer

**Export format unsupported**: Cause: Target format not implemented | Solution: Use JSON/JSON-LD for compatibility -> convert via external tools | Prevention: Format compatibility matrix in Export dialog

---

## Technical Requirements & Validation

**Browser Support**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+ | WebGL for 3D | Web Workers for parser offloading

**Data Limits**: Recommended max (smooth): 10K nodes 2D, 5K nodes 3D | 50K edges 2D, 25K edges 3D | Use clustering/LOD for larger graphs

**Security**: Client-side processing (no server upload) | Credentials in encrypted localStorage | Clear data option in Settings | Markdown import sanitizes HTML/JS injection

**Validation Checklist**:
- [ ] Loader references specific paths? -> FORBIDDEN
- [ ] Parser assumes entity types? -> FORBIDDEN
- [ ] Schema validates property values? -> FORBIDDEN
- [ ] Thresholds configurable? -> REQUIRED
- [ ] Renderer handles any topology? -> REQUIRED
- [ ] Provenance links bidirectional? -> REQUIRED
- [ ] Orchestrator supports arbitrary rules? -> REQUIRED
- [ ] Exports preserve metadata? -> REQUIRED

**Status**: Production Ready ✅ | **Architecture**: Generic GraphRAG Pipeline Principles | **Version**: 1.0.0
