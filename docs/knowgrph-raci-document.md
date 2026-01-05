# RACI Matrix: Generic Knowledge Graph Pipeline

> **Adheres to**: Generic KG/RAG Pipeline Principles - Zero hardcoding, domain-agnostic, layering-compliant

---

## Agentic GraphRAG Pipeline

1. Schema (Ontology / Semantics Layer – Decide Meaning ONCE)
   • Node type              → labels[] (array)                  Semantic
   • Edge relation          → label (string)                     Semantic
   • Geo-coordinates        → properties.geo (lat/lng object)   Semantic
   • Rich text chunks       → properties.chunk_text             Semantic (RAG grounding)
   • Embeddings placeholder → properties.embedding[]            Semantic (retrieval)
   → Central immutable contract: defines ontology, validation, provenance rules.

2. UI Curation Layer (MultiD Spreadsheet)
   • Relational spreadsheet UI on Postgres backend
   • Separate tables: Nodes, Edges, Metadata, Media URLs
   • Real-time collab, forms, linked records for entity resolution
   • Manual chunk_text addition, provenance entry, confidence tagging
   ↓
   Export → CSV/JSON per table (high-fidelity, nested as JSON strings)

3. Ingest
   Source (MultiD Spreadsheet exports / raw files) → Loader → Parser (ETL / Data Extraction Layer) → Validator → Normalizer
   ↓↓↓↓↓
   raw → graph objects → validated → canonical IDs + dedup + entity resolution + provenance
   • Provenance & source    → per-node/edge metadata{}           Contextual
   ↓
   Canonical GraphData (in-memory blueprint)

4. Enrich (Parallel & Iterative)
   GraphData → Embedding Generator → Vector-Indexed GraphData
   • Generate embeddings from chunk_text
   • Confidence scores      → metadata.confidence               Contextual
   • Media URLs preserved   → properties.media_url              Contextual/Semantic

5. Index & Store (Canonical Storage)
   GraphData → DuckDB (single-file .duckdb)
   • Relational tables (nodes + edges) + optional duckdb-age extension for graph queries
   • Vector index via built-in extensions or arrays
   • Fast hybrid retrieval: SQL + vector similarity
   • Lossless persistence: nested/arrays stored natively

6. Agentic Reasoning (Core Enhancement)
   User Query → Agent Orchestrator
   ↓
   Multi-step planning & execution:
   • Tool selection: DuckDB SQL queries ↔ vector search ↔ subgraph summarization
   • Dynamic query generation (SQL/Cypher via LLM on DuckDB)
   • Iterative refinement using provenance/confidence
   • Self-correction & multi-hop reasoning grounded in schema
   ↓
   Traceable, grounded response

7. Produce
   Agent Output + GraphData → Exporter
   ↓↓↓
   Blueprint JSON (primary portable format) → CSV/JSON-LD | Updated DuckDB file

8. Reuse / Render (Visualization Layer – Decide Appearance LATE)
   Exported Artifacts / Agent Responses / DuckDB queries →
   • Renderer stack:
        - D3.js            → 2D force-directed & interactive layouts
        - three.js         → 3D spherical / immersive network views
        - MapLibre GL JS + OpenMapTiles → Geographic map overlays (when geo-coordinates present)
   • Visual mappings (decided at render time):
        - Node color       → type → color palette                  Visual
        - Node size/style  → degree or property → scale            Visual
        - Edge label text  → relation → formatted text             Visual
   • Rich Media rendering:
        - iframe, svg, image, video → injected inline in response
        - Sources from properties.media_url or metadata.source_url
        - Agent decides inclusion (e.g., "show company logo" → tool call → embed media)
   → Pure presentation layer — never alters or stores visual decisions in DuckDB.

---

## Roles Definition

**Anchors**

- Orchestrator RACI role anchor: `#raci-role-orchestrator`.

<a id="raci-role-orchestrator"></a>

| Role | Primary Responsibility | Pipeline Phase | Must NOT Do |
|------|----------------------|----------------|-------------|
| **Curator** | Manual curation, entry, and export using MultiD Spreadsheet UI | UI Curation | Hardcode domain logic, validate domain semantics, reference specific filenames beyond exports |
| **Loader** | Fetches JSON from any source, validates JSON syntax only | Ingest | Reference specific filenames, validate domain fields |
| **Parser** | Converts JSON to graph objects (nodes/edges) | Ingest | Reference filenames, assume domain semantics, hardcode test data |
| **Validator** | Validates graph structure and referential integrity | Ingest | Validate domain semantics, require domain-specific fields |
| **GraphData** | Canonical internal representation of graph | Ingest/Produce | N/A (passive storage) |
| **Exporter** | Produces output formats from GraphData | Produce | Hardcode domain logic, assume specific consumers |
| **Renderer** | Visualizes exported artifacts | Reuse | Hardcode domain logic, reference test data, directly access GraphData |
| **Indexers** | Index exported data for RAG/search | Reuse | Hardcode domain logic, directly access GraphData |
| **Orchestrator** | Orchestrates multi-step planning, tool selection including graph traversal, and execution for user queries | Agentic Reasoning | Hardcode domain logic, alter graph data, directly access GraphData without tools |
| **Schema** | Defines 100% generic structure, no domain coupling | All Phases | Include domain-specific required fields, reference test data |
| **Data** | Contains actual graph content (nodes, edges, properties) | Source | N/A (passive content) |

### JSON‑LD RoleActionOutcome fixtures for RACI roles

Several core RACI roles are also represented as AgenticRAG `rag:RoleActionOutcome` JSON‑LD fixtures. These fixtures live under `schema-config/`, are exercised by copy tests in `canvas/src/__tests__/orchestratorCopy.test.ts`, and keep tooltip copy, workflow guidance, and RACI responsibilities aligned:

| RACI role | Tooltip helper(s) (see `canvas/src/lib/config.ts`) | JSON‑LD fixture(s) under `schema-config/` |
|-----------|-----------------------------------------------------|-------------------------------------------|
| Parser | `WORKFLOW_STEP3_PARSER_TOOLTIP` | `workflow-step3-parser-role-action-outcome.jsonld` |
| Curator | `GRAPH_DATA_TABLE_CURATION_TOOLTIP`, `WORKFLOW_STEP8_BOTTOM_TABS_TOOLTIP` | `graph-data-table-curation-role-action-outcome.jsonld`, `workflow-step8-bottom-tabs-role-action-outcome.jsonld` |
| Orchestrator | `ORCHESTRATOR_TRAVERSAL_TOOLTIP`, `WORKFLOW_STEP6_ORCHESTRATOR_TOOLTIP`, `TRAVERSAL_PRESET_UI_TOOLTIP`, `WORKFLOW_LINKS_TOOLTIP`, `AGENTIC_REASONING_LABELS_TOOLTIP`, `HELP_CHEATSHEET_ALIGNMENT_TOOLTIP` | `orchestrator-role-action-outcome.jsonld`, `workflow-step6-orchestrator-role-action-outcome.jsonld`, `traversal-preset-ui-role-action-outcome.jsonld`, `workflow-links-role-action-outcome.jsonld`, `agentic-reasoning-labels-role-action-outcome.jsonld`, `help-cheatsheet-alignment-role-action-outcome.jsonld` |
| Schema | `GRAPH_FIELDS_ICON_LEGEND_TOOLTIP`, `GRAPH_FIELDS_GRAPH_DATA_TABLE_MAPPING_TOOLTIP` | `graph-fields-icon-legend-role-action-outcome.jsonld`, `graph-fields-table-mapping-role-action-outcome.jsonld` |
| Indexers | `HELP_CODEBASE_INDEX_ENTRY_POINTS_TOOLTIP`, `GRAPHRAG_PATH_METADATA_TOOLTIP` | `help-codebase-index-entry-points-role-action-outcome.jsonld`, `graphrag-path-metadata-role-action-outcome.jsonld` |

These `RoleActionOutcome` fixtures serve as a bridge between high-level RACI definitions and concrete UI copy. When a tooltip or help card is updated, the corresponding fixture and test keep the Role → Actions → Outcome semantics consistent across Workflow, Help, Orchestrator, and documentation surfaces without duplicating strings.

For a fixture‑centric view that also calls out primary UI surfaces, this table maps each `rag:RoleActionOutcome` JSON‑LD file to its helper and main surface:

| RAO fixture file                                      | Helper constant                          | Primary UI surface                                                                                   |
|-------------------------------------------------------|------------------------------------------|------------------------------------------------------------------------------------------------------|
| `orchestrator-role-action-outcome.jsonld`             | `ORCHESTRATOR_TRAVERSAL_TOOLTIP`         | Toolbar Orchestrator button tooltip and Orchestrator-related help text                               |
| `graph-fields-icon-legend-role-action-outcome.jsonld` | `GRAPH_FIELDS_ICON_LEGEND_TOOLTIP`       | Graph Fields icon legend and Help tab                                                                |
| `graph-fields-table-mapping-role-action-outcome.jsonld` | `GRAPH_FIELDS_GRAPH_DATA_TABLE_MAPPING_TOOLTIP` | Graph Fields header tooltip and Graph Fields ↔ Graph Data Table mapping help                         |
| `graph-data-table-curation-role-action-outcome.jsonld` | `GRAPH_DATA_TABLE_CURATION_TOOLTIP`      | Graph Data Table curation toolbar and Tool menu description                                          |
| `workflow-links-role-action-outcome.jsonld`           | `WORKFLOW_LINKS_TOOLTIP`                 | Workflow links help card and Workflow/Help alignment guidance                                        |
| `agentic-reasoning-labels-role-action-outcome.jsonld` | `AGENTIC_REASONING_LABELS_TOOLTIP`       | Agentic reasoning stage labels across Workflow, Orchestrator, and Renderer                           |
| `graphrag-path-metadata-role-action-outcome.jsonld`   | `GRAPHRAG_PATH_METADATA_TOOLTIP`         | graphRAGPath metadata helper in Help and Orchestrator traversal documentation                        |
| `workflow-step3-parser-role-action-outcome.jsonld`    | `WORKFLOW_STEP3_PARSER_TOOLTIP`          | Workflow step 3 Parser tab tooltip                                                                    |
| `workflow-step6-orchestrator-role-action-outcome.jsonld` | `WORKFLOW_STEP6_ORCHESTRATOR_TOOLTIP`   | Workflow step 6 Orchestrator tooltip                                                                  |
| `workflow-step8-bottom-tabs-role-action-outcome.jsonld` | `WORKFLOW_STEP8_BOTTOM_TABS_TOOLTIP`    | Workflow step 8 bottom tabs tooltip (Data/Table/Render exports section)                              |
| `traversal-preset-ui-role-action-outcome.jsonld`      | `TRAVERSAL_PRESET_UI_TOOLTIP`            | Render traversal preset helper under traversal controls                                              |
| `help-cheatsheet-alignment-role-action-outcome.jsonld` | `HELP_CHEATSHEET_ALIGNMENT_TOOLTIP`     | Canvas cheatsheet helper for selection modes and bottom panel alignment                              |
| `help-codebase-index-entry-points-role-action-outcome.jsonld` | `HELP_CODEBASE_INDEX_ENTRY_POINTS_TOOLTIP` | Help markdown pipeline entry points card and pipeline command guidance                               |

AgenticRAG-specific UI surfaces such as the AgenticRAG node inspector and AgenticRAG context and ignore filters reuse the centralized `ORCHESTRATOR_AGENTIC_COPY` helper in `canvas/src/features/panels/config.ts` so RACI responsibilities, Workflow guidance, and schema documentation share the same “AgenticRAG node inspector”, “graphRAGPath IRI”, “codebasePath provenance”, and “AgenticRAG context and ignore filters” phrases.

---

## RACI Legend
- **R** = Responsible (does the work)
- **A** = Accountable (ultimately answerable, approves)
- **C** = Consulted (provides input before decisions)
- **I** = Informed (kept updated on progress/decisions)

---

## Phase 0: UI CURATION

### 0.1 Data Entry & Curation

| Element | Curator | Loader | Parser | Validator | GraphData | Exporter | Renderer | Indexers | Orchestrator | Schema | Data |
|---------|---------|--------|--------|-----------|-----------|----------|----------|----------|--------------|--------|------|
| **Manual entry in MultiD Spreadsheet** | A/R | I | I | I | I | I | I | I | I | C | R |
| **Add chunk_text, provenance** | A/R | I | I | I | I | I | I | I | I | C | I |
| **Entity resolution via links** | A/R | I | I | I | I | I | I | I | I | C | I |
| **Export to CSV/JSON** | A/R | C | I | I | I | I | I | I | I | C | I |
| **Pass exports to Loader** | A/R | I | I | I | I | I | I | I | I | I | I |
| **❌ Domain validation** | ❌ Never | - | - | - | - | - | - | - | - | - | - |

**Principle**: Curator handles manual UI-based curation and exports data in generic formats for downstream ingest.

---

## Phase 1: INGEST

### 1.1 Data Loading & Fetching

| Element | Curator | Loader | Parser | Validator | GraphData | Exporter | Renderer | Indexers | Orchestrator | Schema | Data |
|---------|---------|--------|--------|-----------|-----------|----------|----------|----------|--------------|--------|------|
| **Fetch from file** | C | A/R | I | I | I | I | I | I | I | I | I |
| **Fetch from API** | C | A/R | I | I | I | I | I | I | I | I | I |
| **Fetch from DB** | C | A/R | I | I | I | I | I | I | I | I | I |
| **Fetch from MultiD Spreadsheet exports** | I | A/R | I | I | I | I | I | I | I | I | I |
| **JSON syntax validation** | I | A/R | I | I | I | I | I | I | I | C | I |
| **Pass to Parser** | I | A/R | I | I | I | I | I | I | I | I | I |
| **❌ Domain validation** | ❌ Never | ❌ Never | - | - | - | - | - | - | - | - | - |
| **❌ Filename refs** | ❌ Never | ❌ Never | ❌ Never | - | - | - | - | - | - | - | - |

**Principle**: Loader is source-agnostic - file/API/DB/MultiD Spreadsheet exports all produce identical JSON object

---

### 1.2 Parsing & Transformation

| Element | Curator | Loader | Parser | Validator | GraphData | Exporter | Renderer | Indexers | Orchestrator | Schema | Data |
|---------|---------|--------|--------|-----------|-----------|----------|----------|----------|--------------|--------|------|
| **Build node objects** | I | I | A/R | I | I | I | I | I | I | C | I |
| **Build edge objects** | I | I | A/R | I | I | I | I | I | I | C | I |
| **Extract IDs** | I | - | A/R | I | I | I | I | I | I | I | I |
| **Extract labels** | I | - | A/R | I | I | I | I | I | I | I | A |
| **Extract properties** | I | - | R | I | I | I | I | I | I | C | A |
| **Normalize structure** | I | - | A/R | I | I | I | I | I | I | C | I |
| **Pass to Validator** | I | - | A/R | I | I | I | I | I | I | I | I |
| **❌ Domain semantics** | - | - | ❌ Never | - | - | - | - | - | - | - | - |
| **❌ Property validation** | - | - | ❌ Never | - | - | - | - | - | - | - | - |

**Principle**: Parser treats properties and labels as opaque strings

---

### 1.3 Validation

| Element | Curator | Loader | Parser | Validator | GraphData | Exporter | Renderer | Indexers | Orchestrator | Schema | Data |
|---------|---------|--------|--------|-----------|-----------|----------|----------|----------|--------------|--------|------|
| **Node ID uniqueness** | I | - | I | A/R | I | I | I | I | I | C | I |
| **Edge reference integrity** | I | - | I | A/R | I | I | I | I | I | C | I |
| **Required fields present** | I | - | I | A/R | I | I | I | I | I | A | I |
| **Type correctness** | I | - | I | R | I | I | I | I | I | A | I |
| **Schema compliance** | I | - | I | A/R | I | I | I | I | I | A | I |
| **Report validation errors** | I | - | C | A/R | I | I | C | I | I | C | I |
| **Pass to GraphData** | I | - | - | A/R | I | I | I | I | I | I | I |
| **❌ Domain semantics** | - | - | - | ❌ Never | - | - | - | - | - | - | - |
| **❌ Business rules** | - | - | - | ❌ Never | - | - | - | - | - | - | - |

**Principle**: Validator checks structure only - IDs, references, types, not domain logic

---

### 1.4 Canonical Storage

| Element | Curator | Loader | Parser | Validator | GraphData | Exporter | Renderer | Indexers | Orchestrator | Schema | Data |
|---------|---------|--------|--------|-----------|-----------|----------|----------|----------|--------------|--------|------|
| **Store validated graph** | I | - | - | I | A/R | C | I | I | I | I | I |
| **Maintain referential integrity** | I | - | - | C | A/R | I | I | I | I | I | I |
| **Provide query interface** | I | - | - | - | A/R | R | I | I | C | I | I |
| **Index nodes by ID** | I | - | - | - | A/R | C | I | I | I | I | I |
| **Index edges by source/target** | I | - | - | - | A/R | C | I | I | I | I | I |
| **Serve to Exporter** | I | - | - | - | A/R | R | I | I | I | I | I |
| **❌ Direct Renderer access** | - | - | - | - | - | - | ❌ Never | - | - | - | - |
| **❌ Direct Indexer access** | - | - | - | - | - | - | - | ❌ Never | - | - | - |
| **❌ Direct Orchestrator access** | - | - | - | - | - | - | - | - | ❌ Never | - | - |

**Principle**: GraphData is canonical source, accessed only through Exporter or tools (e.g., for Orchestrator)

---

## Phase 2: PRODUCE

### 2.1 Export to JSON/JSON-LD

| Element | Curator | Loader | Parser | Validator | GraphData | Exporter | Renderer | Indexers | Orchestrator | Schema | Data |
|---------|---------|--------|--------|-----------|-----------|----------|----------|----------|--------------|--------|------|
| **Query GraphData** | I | - | - | - | C | A/R | I | I | I | I | I |
| **Generate JSON** | I | - | - | - | I | A/R | I | I | I | C | I |
| **Generate JSON-LD** | I | - | - | - | I | A/R | I | I | I | C | I |
| **Apply @context** | I | - | - | - | I | R | I | I | I | A | I |
| **Compact/Expand** | I | - | - | - | I | A/R | I | I | I | C | I |
| **Add metadata** | I | - | - | - | C | A/R | I | I | I | C | I |
| **❌ Domain transforms** | - | - | - | - | - | ❌ Never | - | - | - | - | - |

**Principle**: Exporter produces format-specific output, no domain logic

---

### 2.2 Export to CSV/TSV

| Element | Curator | Loader | Parser | Validator | GraphData | Exporter | Renderer | Indexers | Orchestrator | Schema | Data |
|---------|---------|--------|--------|-----------|-----------|----------|----------|----------|--------------|--------|------|
| **Flatten nodes to rows** | I | - | - | - | I | A/R | I | C | I | C | I |
| **Flatten edges to rows** | I | - | - | - | I | A/R | I | C | I | C | I |
| **Handle nested properties** | I | - | - | - | I | A/R | I | I | I | C | I |
| **Generate headers** | I | - | - | - | I | A/R | I | I | I | I | I |
| **Apply delimiter** | I | - | - | - | I | A/R | I | I | I | I | I |
| **❌ Domain-specific columns** | - | - | - | - | - | ❌ Never | - | - | - | - | - |

**Principle**: CSV export is generic tabular transformation

---

### 2.3 Export architecture graphs

| Element | Curator | Loader | Parser | Validator | GraphData | Exporter | Renderer | Indexers | Orchestrator | Schema | Data |
|---------|---------|--------|--------|-----------|-----------|----------|----------|----------|--------------|--------|------|
| **Codebase index JSON-LD** | I | - | - | - | C | A/R | I | A/R | C | C | I |
| **Store architecture JSON-LD** | I | - | - | - | C | A/R | I | A/R | C | C | I |
| **Apply AgenticRAG context** | I | - | - | - | I | A/R | I | A/R | C | A | I |
| **Keep graphs domain-agnostic** | I | - | - | - | I | A/R | I | I | C | A | I |

**Principle**: Architecture exports (codebase index, store architecture) are regular AgenticRAG-compatible graphs that describe how modules and store slices relate to each other, without hardcoding business semantics or test data into the schema.

---

### 2.3 Export to Graph Databases

| Element | Curator | Loader | Parser | Validator | GraphData | Exporter | Renderer | Indexers | Orchestrator | Schema | Data |
|---------|---------|--------|--------|-----------|-----------|----------|----------|----------|--------------|--------|------|
| **Generate SQL (DuckDB)** | I | - | - | - | I | A/R | I | C | I | C | I |
| **Generate Cypher (duckdb-age/Neo4j)** | I | - | - | - | I | A/R | I | C | C | C | I |
| **Generate AQL (ArangoDB)** | I | - | - | - | I | A/R | I | C | I | C | I |
| **Create node statements** | I | - | - | - | I | A/R | I | I | I | C | I |
| **Create edge statements** | I | - | - | - | I | A/R | I | I | I | C | I |
| **Map properties** | I | - | - | - | I | A/R | I | I | I | I | I |
| **Generate indexes** | I | - | - | - | I | A/R | I | C | I | C | I |
| **❌ Domain-specific queries** | - | - | - | - | - | ❌ Never | - | - | - | - | - |

**Principle**: Database export is generic graph DDL/DML

---

### 2.4 Export Formats

| Format | Curator | Loader | Parser | Validator | GraphData | Exporter | Renderer | Indexers | Orchestrator | Schema | Data |
|--------|---------|--------|--------|-----------|-----------|----------|----------|----------|--------------|--------|------|
| **JSON (nodes[], edges[])** | I | - | - | - | C | A/R | R | C | I | C | I |
| **JSON-LD (@graph)** | I | - | - | - | C | A/R | R | C | I | A | I |
| **CSV (nodes.csv, edges.csv)** | I | - | - | - | C | A/R | C | R | I | C | I |
| **DuckDB file** | I | - | - | - | C | A/R | I | R | I | C | I |
| **Neo4j Cypher** | I | - | - | - | C | A/R | I | R | I | C | I |
| **ArangoDB AQL** | I | - | - | - | C | A/R | I | R | I | C | I |
| **RDF/Turtle** | I | - | - | - | C | A/R | I | C | I | C | I |
| **GraphML** | I | - | - | - | C | A/R | R | I | I | C | I |

**Principle**: Exporter supports multiple formats, consumers choose appropriate one

---

## Phase 6: AGENTIC REASONING

### 6.1 Multi-step Planning & Execution

| Element | Curator | Loader | Parser | Validator | GraphData | Exporter | Renderer | Indexers | Orchestrator | Schema | Data |
|---------|---------|--------|--------|-----------|-----------|----------|----------|----------|--------------|--------|------|
| **Process user query** | I | - | - | - | I | I | I | I | A/R | C | I |
| **Multi-step planning** | I | - | - | - | I | I | I | I | A/R | C | I |
| **Tool selection (SQL queries, vector search, subgraph summarization)** | I | - | - | - | C | I | I | C | A/R | C | I |
| **Dynamic query generation (SQL/Cypher)** | I | - | - | - | C | I | I | C | A/R | C | I |
| **Graph traversal (via Cypher on DuckDB)** | I | - | - | - | C | I | I | C | A/R | C | I |
| **Iterative refinement using provenance/confidence** | I | - | - | - | I | I | I | I | A/R | C | I |
| **Self-correction & multi-hop reasoning** | I | - | - | - | I | I | I | I | A/R | C | I |
| **Generate traceable, grounded response** | I | - | - | - | I | C | I | I | A/R | C | I |
| **❌ Domain-specific reasoning** | - | - | - | - | - | - | - | - | ❌ Never | - | - |

**Principle**: Orchestrator handles agentic reasoning using tools for query execution, including graph traversal, without domain assumptions

---

## Phase 3: REUSE

### 3.1 Visualization (Renderer)

| Element | Curator | Loader | Parser | Validator | GraphData | Exporter | Renderer | Indexers | Orchestrator | Schema | Data |
|---------|---------|--------|--------|-----------|-----------|----------|----------|----------|--------------|--------|------|
| **Consume JSON export** | I | - | - | - | I | C | A/R | I | I | I | I |
| **Consume JSON-LD export** | I | - | - | - | I | C | A/R | I | I | C | I |
| **Consume DuckDB queries** | I | - | - | - | I | C | A/R | I | C | C | I |
| **Parse D3-compatible format** | I | - | - | - | I | I | A/R | I | I | C | I |
| **Apply layout algorithm** | I | - | - | - | - | I | A/R | I | I | I | I |
| **Apply styles** | I | - | - | - | - | I | A/R | I | I | C | I |
| **Render to canvas** | I | - | - | - | - | I | A/R | I | I | I | I |
| **Handle interactions** | I | - | - | - | - | I | A/R | I | I | I | I |
| **❌ Access GraphData directly** | - | - | - | - | - | - | ❌ Never | - | - | - | - |
| **❌ Domain logic** | - | - | - | - | - | - | ❌ Never | - | - | - | - |

**Principle**: Renderer consumes exported artifacts or DuckDB queries only, never directly queries GraphData

---

### 3.2 Indexing (RAG/Search)

| Element | Curator | Loader | Parser | Validator | GraphData | Exporter | Renderer | Indexers | Orchestrator | Schema | Data |
|---------|---------|--------|--------|-----------|-----------|----------|----------|----------|--------------|--------|------|
| **Consume JSON export** | I | - | - | - | I | C | I | A/R | I | I | I |
| **Consume database export** | I | - | - | - | I | C | I | A/R | I | C | I |
| **Consume DuckDB queries** | I | - | - | - | I | C | I | A/R | C | C | I |
| **Build vector index** | I | - | - | - | - | I | I | A/R | I | C | I |
| **Build text index** | I | - | - | - | - | I | I | A/R | I | C | I |
| **Build graph index** | I | - | - | - | - | I | I | A/R | C | C | I |
| **Generate embeddings** | I | - | - | - | - | I | I | A/R | I | C | I |
| **Store for retrieval** | I | - | - | - | - | I | I | A/R | I | I | I |
| **❌ Access GraphData directly** | - | - | - | - | - | - | - | ❌ Never | - | - | - |
| **❌ Domain-specific indexing** | - | - | - | - | - | - | - | ❌ Never | - | - | - |

**Principle**: Indexers consume exported artifacts, build retrieval structures

---

### 3.3 External Sharing

| Element | Curator | Loader | Parser | Validator | GraphData | Exporter | Renderer | Indexers | Orchestrator | Schema | Data |
|---------|---------|--------|--------|-----------|-----------|----------|----------|----------|--------------|--------|------|
| **Download JSON** | I | - | - | - | I | A/R | I | I | I | C | I |
| **Download CSV** | I | - | - | - | I | A/R | I | I | I | C | I |
| **Download DuckDB file** | I | - | - | - | I | A/R | I | I | I | C | I |
| **API endpoint** | I | - | - | - | I | A/R | I | I | I | I | I |
| **Version exports** | I | - | - | - | C | A/R | I | I | I | C | I |
| **Add provenance** | I | - | - | - | C | A/R | I | I | I | C | I |

**Principle**: Exported artifacts are shareable, versioned, self-contained

---

## Cross-Phase Responsibilities

### 4.1 Schema Management

| Element | Curator | Loader | Parser | Validator | GraphData | Exporter | Renderer | Indexers | Orchestrator | Schema | Data |
|---------|---------|--------|--------|-----------|-----------|----------|----------|----------|--------------|--------|------|
| **Define structure** | C | I | C | C | C | C | I | I | C | A/R | I |
| **Define required fields** | C | I | R | R | I | C | I | I | I | A | I |
| **Define types** | C | I | C | R | C | C | I | I | I | A/R | I |
| **Version schema** | C | I | I | I | I | C | I | I | I | A/R | I |
| **Validate compliance** | C | R | R | A/R | I | I | I | I | R | A | I |
| **❌ Domain requirements** | - | - | - | - | - | - | - | - | - | ❌ Never | - |

**Principle**: Schema is 100% generic, only structural requirements

---

### 4.2 Error Handling

| Element | Curator | Loader | Parser | Validator | GraphData | Exporter | Renderer | Indexers | Orchestrator | Schema | Data |
|---------|---------|--------|--------|-----------|-----------|----------|----------|----------|--------------|--------|------|
| **JSON syntax errors** | I | A/R | I | I | I | I | C | I | I | C | I |
| **Structure errors** | I | I | A/R | R | I | I | C | I | I | C | I |
| **Validation errors** | I | I | C | A/R | I | I | C | I | I | C | I |
| **Export errors** | I | I | I | I | C | A/R | C | C | I | C | I |
| **Render errors** | I | I | I | I | I | I | A/R | I | I | C | I |
| **Index errors** | I | I | I | I | I | I | I | A/R | I | C | I |
| **Reasoning errors** | I | I | I | I | I | I | I | I | A/R | C | I |
| **Error messages** | R | R | R | R | I | R | R | R | R | C | I |
| **Recovery strategy** | R | R | R | R | C | R | R | R | R | C | I |

**Principle**: Each component handles its own errors, reports clearly

---

### 4.3 Metadata Handling

| Element | Curator | Loader | Parser | Validator | GraphData | Exporter | Renderer | Indexers | Orchestrator | Schema | Data |
|---------|---------|--------|--------|-----------|-----------|----------|----------|----------|--------------|--------|------|
| **Extract file metadata** | R | R | I | I | I | I | I | I | I | C | A |
| **Preserve provenance** | R | R | R | R | R | A/R | I | R | R | C | I |
| **Add timestamps** | R | R | I | I | R | R | I | I | I | I | I |
| **Track versions** | R | R | I | I | R | R | I | I | I | C | I |
| **Include in exports** | R | I | I | I | C | A/R | I | C | I | C | I |

**Principle**: Metadata flows through pipeline, preserved in exports

---

## Component Dependencies

### Dependency Matrix

| Component | Depends On | Must NOT Depend On |
|-----------|------------|-------------------|
| **Curator** | Data, Schema | Loader, Parser, Validator, GraphData, Exporter, Renderer, Indexers, Orchestrator, Domain |
| **Loader** | Curator, Source, Schema | Parser, Validator, GraphData, Exporter, Renderer, Indexers, Orchestrator, Domain |
| **Parser** | Loader, Schema | Validator, GraphData, Exporter, Renderer, Indexers, Orchestrator, Domain |
| **Validator** | Parser, Schema | GraphData, Exporter, Renderer, Indexers, Orchestrator, Domain |
| **GraphData** | Validator | Exporter, Renderer, Indexers, Orchestrator, Domain |
| **Exporter** | GraphData, Schema | Renderer, Indexers, Orchestrator, Domain |
| **Renderer** | Exporter (artifacts) | Curator, Loader, Parser, Validator, GraphData, Orchestrator, Domain |
| **Indexers** | Exporter (artifacts) | Curator, Loader, Parser, Validator, GraphData, Orchestrator, Domain |
| **Orchestrator** | Schema, GraphData (via tools), Indexers | Curator, Loader, Parser, Validator, Exporter, Renderer, Domain |
| **Schema** | None | All others |
| **Data** | None | All others |

---

## Data Flow Diagram

```
┌─────────┐
│  Data   │ (Source)
└────┬────┘
     │
     ↓
┌─────────┐     ┌────────┐
│ Curator │────→│ Schema │ (defines structure)
└────┬────┘     └────────┘
     │ MultiD Spreadsheet exports (CSV/JSON)
     ↓
┌─────────┐     ┌────────┐
│ Loader  │────→│ Schema │ (validates syntax)
└────┬────┘     └────────┘
     │ raw JSON
     ↓
┌─────────┐     ┌────────┐
│ Parser  │────→│ Schema │ (defines structure)
└────┬────┘     └────────┘
     │ graph objects
     ↓
┌───────────┐   ┌────────┐
│ Validator │──→│ Schema │ (defines rules)
└─────┬─────┘   └────────┘
      │ validated
      ↓
┌───────────┐
│ GraphData │ (canonical in DuckDB)
└─────┬─────┘
      │
      ├──┐
      │  ↓
      │┌───────────────┐   ┌────────┐
      ││ Orchestrator  │──→│ Schema │ (grounds reasoning)
      │└──────┬────────┘   └────────┘
      │       │ DuckDB queries (SQL/Cypher for traversal)
      │       ↓
      │  Grounded Response
      │
      ↓
┌───────────┐   ┌────────┐
│ Exporter  │──→│ Schema │ (format specs)
└─────┬─────┘   └────────┘
      │
      ├──→ JSON/JSON-LD
      ├──→ CSV/TSV
      ├──→ Database (SQL/Cypher)
      └──→ GraphML/RDF
           │
           ↓
    ┌──────┴──────┐
    │             │
    ↓             ↓
┌──────────┐  ┌──────────┐
│ Renderer │  │ Indexers │
└──────────┘  └──────────┘
(D3/Cyto)     (RAG/Search)
```

---

## Key Principles by Phase

### UI CURATION Phase Principles
1. ✅ Curator handles manual entry and exports only
2. ✅ Exports are generic CSV/JSON
3. ✅ Supports collaboration and entity resolution
4. ❌ NO domain validation in curation phase
5. ❌ NO direct access to downstream components

### INGEST Phase Principles
1. ✅ Loader fetches, validates syntax only
2. ✅ Parser transforms, ignores semantics
3. ✅ Validator checks structure, not domain
4. ✅ GraphData stores canonical representation
5. ❌ NO domain validation in ingest phase
6. ❌ NO direct access between components

### AGENTIC REASONING Phase Principles
1. ✅ Orchestrator plans and executes multi-step queries
2. ✅ Tool selection includes graph traversal via Cypher
3. ✅ Reasoning grounded in schema and provenance
4. ✅ Iterative and self-correcting
5. ❌ NO domain-specific logic in orchestration
6. ❌ NO direct GraphData manipulation

### PRODUCE Phase Principles
1. ✅ Exporter queries GraphData through interface
2. ✅ Multiple format support (JSON, CSV, DuckDB)
3. ✅ Format-specific transformations
4. ✅ Metadata preservation
5. ❌ NO domain-specific exports
6. ❌ NO hardcoded consumer assumptions

### REUSE Phase Principles
1. ✅ Renderer consumes exported artifacts
2. ✅ Indexers consume exported artifacts
3. ✅ NO direct GraphData access
4. ✅ Format-appropriate consumption
5. ❌ NO domain logic in consumers
6. ❌ NO pipeline bypassing

---

## Compliance Checklist

### ✅ Curator Compliance
- [ ] Handles manual entry in MultiD Spreadsheet UI
- [ ] Exports to generic CSV/JSON
- [ ] Does NOT validate domain fields
- [ ] Does NOT hardcode domain logic
- [ ] Passes exports to Loader
- [ ] Does NOT access Parser, Validator, GraphData

### ✅ Loader Compliance
- [ ] Fetches from any source (file/API/DB/MultiD Spreadsheet exports)
- [ ] Validates JSON syntax only
- [ ] Does NOT validate domain fields
- [ ] Does NOT reference specific filenames
- [ ] Passes generic JSON to Parser
- [ ] Does NOT access Parser, Validator, GraphData

### ✅ Parser Compliance
- [ ] Receives JSON from Loader only
- [ ] Validates structure only
- [ ] Treats properties as opaque
- [ ] Treats labels as opaque
- [ ] Does NOT assume domain semantics
- [ ] Passes graph objects to Validator
- [ ] Does NOT access Validator, GraphData

### ✅ Validator Compliance
- [ ] Receives graph objects from Parser
- [ ] Validates ID uniqueness
- [ ] Validates reference integrity
- [ ] Validates type correctness
- [ ] Does NOT validate domain logic
- [ ] Passes validated graph to GraphData
- [ ] Does NOT access Exporter, Renderer, Indexers

### ✅ GraphData Compliance
- [ ] Stores canonical representation
- [ ] Maintains referential integrity
- [ ] Provides query interface to Exporter
- [ ] Does NOT allow direct Renderer access
- [ ] Does NOT allow direct Indexer access

### ✅ Exporter Compliance
- [ ] Queries GraphData through interface only
- [ ] Produces multiple formats
- [ ] Applies format-specific transforms
- [ ] Does NOT apply domain logic
- [ ] Does NOT assume specific consumers
- [ ] Artifacts are self-contained

### ✅ Renderer Compliance
- [ ] Consumes exported artifacts only
- [ ] Does NOT access GraphData directly
- [ ] Does NOT hardcode domain logic
- [ ] Applies generic visualization
- [ ] Dynamic styling from data

### ✅ Indexers Compliance
- [ ] Consume exported artifacts only
- [ ] Does NOT access GraphData directly
- [ ] Does NOT apply domain-specific indexing
- [ ] Build generic retrieval structures

### ✅ Orchestrator Compliance
- [ ] Orchestrates queries via tools only
- [ ] Supports graph traversal via Cypher
- [ ] Grounds reasoning in schema
- [ ] Does NOT hardcode domain logic
- [ ] Does NOT alter GraphData
- [ ] Provides traceable responses

### ✅ Schema Compliance
- [ ] 100% generic structure
- [ ] Only structural requirements
- [ ] No domain-specific fields
- [ ] Version controlled
- [ ] Independent of all components

---

## Summary: Key Decisions by Phase

| Decision | UI CURATION | INGEST | AGENTIC REASONING | PRODUCE | REUSE |
|----------|-------------|--------|-------------------|---------|-------|
| **Data entry?** | Curator | - | - | - | - |
| **Data source?** | Curator | Loader | - | - | - |
| **JSON syntax valid?** | - | Loader | - | - | - |
| **Graph structure valid?** | - | Parser, Validator | - | - | - |
| **Store canonical?** | - | GraphData | - | - | - |
| **Orchestrate query?** | - | - | Orchestrator | - | - |
| **Graph traversal?** | - | - | Orchestrator | - | - |
| **Export format?** | - | - | - | Exporter | - |
| **Visualization?** | - | - | - | - | Renderer |
| **Indexing?** | - | - | - | - | Indexers |
| **Domain logic?** | ❌ NEVER | ❌ NEVER | ❌ NEVER | ❌ NEVER | ❌ NEVER |

---

## Anti-Patterns ❌

---

## Example Pipeline Execution

### Complete Flow
```
1. UI CURATION:
   MultiD Spreadsheet UI (manual entry)
   → Curator adds data, resolves entities
   → Export to lean-startup.json/csv

2. INGEST:
   MultiD Spreadsheet exports / Source (lean-startup.json)
   → Loader validates syntax
   → Parser builds {nodes[], edges[]}
   → Validator checks IDs, references
   → GraphData stores canonical in DuckDB

3. AGENTIC REASONING:
   User Query
   → Orchestrator plans multi-step execution
   → Selects tools: SQL/Cypher queries for traversal, vector search
   → Executes on DuckDB, refines iteratively
   → Generates grounded response

4. PRODUCE:
   GraphData + Agent Output
   → Exporter generates:
      • lean-startup.json (for D3)
      • lean-startup.jsonld (for semantic web)
      • nodes.csv, edges.csv (for analysis)
      • Updated DuckDB file (for storage/queries)

5. REUSE:
   Exports consumed by:
   • D3 Renderer (uses .json)
   • RAG Indexer (uses .jsonld)
   • Analytics (uses .csv)
   • Agentic Reasoning (queries DuckDB)
```

---

## Benefits of This Architecture

| Benefit | Description |
|---------|-------------|
| **Clean Separation** | Each component has single responsibility |
| **Reusability** | Same pipeline works for any domain |
| **Flexibility** | Add new export formats without changing ingest |
| **Testability** | Each component tested independently |
| **Scalability** | Components can be distributed/parallelized |
| **Maintainability** | Changes isolated to specific components |
| **Extensibility** | New consumers don't affect pipeline |

---

## Change Management

| Change Type | Affected Components |
|-------------|-------------------|
| **New curation feature** | Curator only |
| **New data source** | Loader only |
| **New validation rule** | Schema, Validator only |
| **New reasoning tool (e.g., traversal)** | Orchestrator only |
| **New export format** | Exporter only |
| **New visualization** | Renderer only (add new instance) |
| **New index type** | Indexers only (add new instance) |
| **Schema change** | Schema, Validator, possibly Exporter |

**Golden Rule**: Changes propagate downstream only, never upstream
