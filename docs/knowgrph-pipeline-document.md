# Knowgrph Markdown → Graph → Canvas Pipeline

## Architecture Overview

**Layer Flow**: Detection → Schema Inference → Ingestion → Parsing → Orchestration → Rendering → Agentic RAG  

**Data Structures**: Markdown documents → JSON‑LD graph (nodes + edges) → Schema JSON‑LD → Orchestrator YAML → Canvas GraphData and GraphRAG workflow JSON‑LD.

### End‑to‑End Path (Concrete)

- Detection / Entry:
  - CLI: `python -m knowgrph_parser markdown` (see `knowgrph_parser/markdown_cmd.py`).
  - Dev server: Vite plugin calling the same CLI via `CODEBASE_INDEX_PIPELINE_COMMAND` (see `canvas/vite.config.ts` and `canvas/src/lib/config-copy/tooltips.ts`).
- Parsing:
  - Structural and semantic parsing in `knowgrph_parser/markdown_graph.py` → JSON‑LD graph with `Document`, `Section`, `Paragraph`, `CodeBlock`, `List`, `ListItem`, `Table`, `Entity`, `Mention`, and `Edge` nodes.
- Schema Inference:
  - `knowgrph_parser/schema_config.py` infers node/edge types and properties from the graph and emits schema JSON‑LD.
- Orchestration:
  - `knowgrph_parser/orchestrator_yaml.py` builds an orchestrator YAML file embedding AgenticRAG schema metadata and a starter `graph_rag_paths` entry.
- Rendering:
  - `canvas/src/features/panels/hooks/workflowJsonLdActions.ts` loads graph, schema, and orchestrator artifacts into the canvas via `runMarkdownPipelineAndLoadArtifacts`.
- Agentic RAG:
  - Canvas Orchestrator tab treats the orchestrator YAML/GraphRAG workflow JSON‑LD as the Agentic GraphRAG workflow, aligned with `AGENTIC_RAG_SCHEMA_URL` and `AGENTIC_RAG_CONTEXT_URL` from `canvas/src/lib/agenticrag.ts`.

The pipeline adheres to `/schema/AgenticRAG` by:

- Using `DEFAULT_AGENTIC_RAG_SCHEMA_URL` and `DEFAULT_AGENTIC_RAG_CONTEXT_URL` in `knowgrph_parser/common.py`.
- Emitting JSON‑LD graphs whose `@context` starts with the AgenticRAG context URL.
- Treating edges as first‑class nodes with `@type: "Edge"`, `source_node`, `target_node`, and `relation` fields plus rich `properties` and `metadata`.

## Pipeline Specification

### Stage: Detection & Ingestion

**From repository markdown to CLI inputs**: Detection → resolves markdown input path and repository root → delivers a list of markdown files to the parser.

- Implementation:
  - `_list_markdown_files` in `knowgrph_parser/markdown_cmd.py`.
  - Vite dev plugin `markdownPipelineDevPlugin` in `canvas/vite.config.ts`.
- Responsibilities:
  - Accept `--input` as either a single markdown file or a directory tree.
  - Resolve repository root via `find_repo_root` so `metadata.codebaseRoot` and `metadata.documentPath` stay stable across machines.
  - Drive the CLI from the canvas via `CODEBASE_INDEX_PIPELINE_COMMAND`.

**Configuration Schema (subset)**:

```yaml
VITE_MARKDOWN_PIPELINE_INPUT_REL_PATH:
  from: local_default
  to: environment_override
  action: selects markdown entry document
  controls: which workflow markdown is parsed
  affects: coverage of generated graph/schema
  default: docs/knowgrph-pipeline-document.md
  min: n/a
  max: n/a
  interval: n/a
```

### Stage: Parsing (Structural + Semantic)

**From markdown text to AgenticRAG‑aligned JSON‑LD graph**: Parser → tokenizes, segments, and annotates markdown into structural blocks and semantic entities → delivers JSON‑LD graph with rich provenance for downstream schema and rendering stages.

- Structural parsing:
  - `parse_markdown_text_to_graph_jsonld` and `parse_markdown_to_graph_jsonld` in `knowgrph_parser/markdown_graph.py`.
  - Nodes:
    - `Document`, `Section`, `Paragraph`, `CodeBlock`, `List`, `ListItem`, `Table`, `Link`.
  - Edges:
    - `hasSection`, `hasBlock`, `hasItem`, `hasMention`, `mentionOf`, `refersTo`, `linksTo`, `next`, `semanticRelation`, `coOccursWith`.
- Semantic parsing (TokenLinker / EdgeElevator / ThresholdTuner):
  - Token linking:
    - `_tokenize_with_offsets`, `_merge_tokens_to_spans`, `_detect_inline_code_spans`.
    - Produces `Mention` nodes with `properties.confidence` and provenance `metadata.structureType: "Mention"`, `metadata.extractionMethod: "token_linking"`.
    - Produces `Entity` nodes with `properties.normalizedText` and `properties.entityType`.
  - Edge elevation:
    - `_extract_sentence_features` plus inner loop building `semanticRelation` edges with properties:
      - `confidence`, `sourceSentence`, `temporalMarker`, `modality`, `negation`.
    - Metadata for semantic edges uses `structureType: "Edge"` and `extractionMethod: "edge_elevation"`.
  - Threshold tuning:
    - Computes document profile: `semantic_doc_profile.tokenCount`, `sentenceCount`, `avgSentenceTokens`.
    - Adapts `max_syntactic_path_length` based on sentence length, controlled by:

```yaml
KG_PHRASE_BOUNDARY_THRESHOLD:
  from: 0.5
  to: 0.95
  action: tightens or loosens entity span boundaries
  controls: phrase granularity
  affects: entity_coherence vs. recall
  default: 0.75
  min: 0.5
  max: 0.95
  interval: 0.05

KG_MAX_ENTITY_SPAN_TOKENS:
  from: 3
  to: 20
  action: caps tokens per entity span
  controls: entity atomicity
  affects: disambiguation vs. coverage
  default: 8
  min: 3
  max: 20
  interval: 1

KG_EDGE_CONFIDENCE_THRESHOLD:
  from: 0.4
  to: 0.9
  action: filters low‑confidence semantic edges
  controls: graph precision vs. recall
  affects: edge_density and traversal noise
  default: 0.65
  min: 0.4
  max: 0.9
  interval: 0.05
```

### Stage: Cross‑Document Unification

**From per‑file graphs to unified entity graph**: DocumentUnifier → merges entities across markdown files via canonical IDs → delivers a merged JSON‑LD graph with cross‑document entity aliases and consistent edge endpoints.

- Implementation:
  - `_unify_entities_across_docs` in `knowgrph_parser/markdown_cmd.py`.
  - `_canonical_entity_id` ensures stable `ent:global:*` IDs per `(entityType, normalizedText)`.
  - `_remap_edge_endpoints` updates `source_node`/`target_node` and `source`/`target` to the canonical IDs.
- Provenance:
  - Merged metadata includes `metadata.sourceDocuments` listing all contributing `documentPath` values.
  - Each unified entity carries `metadata.aliases` for previous IDs.

### Stage: Schema Inference

**From graph instances to schema JSON‑LD**: SchemaConfig → inspects nodes and edges → delivers a minimal AgenticRAG‑style node/edge/property schema.

- Implementation:
  - `build_schema_config_jsonld` in `knowgrph_parser/schema_config.py`.
- Behavior:
  - Infers node types from `@type`.
  - Infers edge labels from `relation` and maps them to `kg:EdgeLabel`.
  - Infers property ranges from sample values and emits `kg:Property` entries.
- Metadata:
  - Includes `metadata.agenticRagSchema` pointing back to the AgenticRAG schema URL.

### Stage: Orchestration

**From graph + schema to orchestrator YAML**: OrchestratorConfig → records parser entrypoint, graph paths, and starter traversal paths → delivers YAML suitable for GraphRAG workflows and canvas import.

- Implementation:
  - `build_orchestrator_config_yaml` in `knowgrph_parser/orchestrator_yaml.py`.
  - Called from `markdown_cmd.main` after graph/schema are written.
- Behavior:
  - Records `graph.id`, `graph.index_jsonld`, and `graph.index_schema`.
  - Stores `agentic_rag.schema` equal to the configured AgenticRAG schema URL.
  - Seeds `graph_rag_paths` with a single path:
    - `owner_id`: first top‑level `Section` or `doc:{graph_id}`.
    - `query`: natural language description of the markdown document.
    - `traverse`: list of top‑level section IDs.
    - `steps`: list of section titles.

### Stage: Rendering & Agentic RAG (Canvas)

**From markdown artifacts to interactive GraphData + workflow JSON‑LD**: Canvas → triggers the markdown pipeline, loads artifacts into GraphData, schema, and Orchestrator tabs → delivers an AgenticRAG‑aligned canvas session.

- Implementation:
  - Pipeline hook:
    - `runMarkdownPipelineAndLoadArtifacts` in `canvas/src/features/panels/hooks/workflowJsonLdActions.ts`.
    - Vite dev hook `knowgrphRunMarkdownPipeline` in the same module.
  - Dev server integration:
    - `markdownPipelineDevPlugin` and `runMarkdownPipelineOnce` in `canvas/vite.config.ts`.
  - UI triggers:
    - Tool menu and Workflow/Render sections call `runMarkdownPipelineAndLoadArtifacts`.
- Behavior:
  - Runs the markdown CLI with paths defined in:
    - `MARKDOWN_PIPELINE_INPUT_REL_PATH`
    - `CODEBASE_INDEX_PIPELINE_OUTPUT_DIR`
  - Loads:
    - Graph JSON‑LD via `loadGraphDataFromTextViaParser`.
    - Schema JSON‑LD via `parseSchemaText` and `useGraphStore.setSchema`.
    - Orchestrator YAML / GraphRAG workflow via `importGraphRagWorkflowFromText`.
  - Opens Data, Schema, and Orchestrator bottom panel tabs to complete the end‑to‑end journey.

## Responsibility Flow Table (Key Entries)

| Pipeline Stage      | Modules                                           | Classes/Objects | Functions/Methods                        | Responsibility (S‑V‑O)                                                                                 | Dependencies / Imports                    | Data Artifacts / Outputs                                  | Line Range |
|---------------------|---------------------------------------------------|-----------------|------------------------------------------|--------------------------------------------------------------------------------------------------------|-------------------------------------------|-----------------------------------------------------------|-----------|
| Detection/Ingestion | `knowgrph_parser/markdown_cmd.py`                | —               | `_list_markdown_files`                  | MarkdownIngestion enumerates markdown files under input path                                          | `os`                                      | List of markdown file paths                               | 22–33     |
| Parsing             | `knowgrph_parser/markdown_graph.py`              | —               | `parse_markdown_text_to_graph_jsonld`   | MarkdownParser converts markdown text into AgenticRAG‑aligned JSON‑LD nodes and edges                 | `.markdown_blocks`, `.common`             | JSON‑LD graph with `@context`, `@graph`, `metadata`       | 239–902   |
| Cross‑Doc Unify     | `knowgrph_parser/markdown_cmd.py`                | —               | `_unify_entities_across_docs`           | EntityUnifier merges entities and remaps edge endpoints across multiple markdown documents            | `.common`                                 | Unified JSON‑LD graph document                            | 102–165   |
| Schema Inference    | `knowgrph_parser/schema_config.py`               | —               | `build_schema_config_jsonld`            | SchemaInferer derives node, edge, and property schema from instance graph                             | `.common`                                 | Schema JSON‑LD document                                   | 12–114    |
| Orchestration       | `knowgrph_parser/orchestrator_yaml.py`           | —               | `build_orchestrator_config_yaml`        | OrchestratorBuilder writes AgenticRAG‑aware orchestrator YAML referencing graph and schema artifacts  | `.common`                                 | Orchestrator YAML                                         | 7–50      |
| Rendering           | `canvas/src/features/panels/hooks/workflowJsonLdActions.ts` | —     | `runMarkdownPipelineAndLoadArtifacts`   | CanvasLoader runs markdown pipeline and loads graph, schema, and orchestrator into GraphData and UI   | `useGraphStore`, `loadGraphDataFromTextViaParser` | In‑memory GraphData, schema, GraphRAG workflow JSON‑LD    | 430–507   |
| Dev Integration     | `canvas/vite.config.ts`                          | —               | `runMarkdownPipelineOnce`               | DevServerRunner spawns markdown CLI once per request to refresh pipeline artifacts during development | `child_process.spawn`, `CODEBASE_INDEX_PIPELINE_COMMAND` | Updated files under `data/knowgrph-workflow-preview`      | 13–33     |

## Provenance Standards

- Structural provenance:
  - Every structural block node (`Document`, `Section`, `Paragraph`, `CodeBlock`, `List`, `ListItem`, `Table`) carries:
    - `metadata.documentPath` (when a filesystem path is known).
    - `metadata.lineStart`, `metadata.lineEnd` (1‑based inclusive).
    - `metadata.codebaseRoot`, `metadata.codebaseRelPath`, `metadata.sourcePath`, and `metadata.codebasePath` for full traceability into the original markdown file.
- Semantic provenance:
  - `Mention` nodes:
    - `metadata.structureType: "Mention"`.
    - `metadata.extractionMethod: "token_linking"`.
    - `properties.charStart`, `properties.charEnd`, `properties.tokenStart`, `properties.tokenEnd`, `properties.confidence`.
  - `Entity` nodes:
    - `metadata.structureType: "Entity"`.
    - `metadata.extractionMethod: "document_unification"`.
  - Semantic edges:
    - `metadata.structureType: "Edge"`.
    - `metadata.extractionMethod: "edge_elevation"` or `extractionMethod: "pattern_mining"`.
- Document metadata:
  - `metadata.agenticRagSchema` and `metadata.agenticRagContext` echo the AgenticRAG schema and context URLs.
  - `metadata.semanticConfig` persists effective semantic thresholds for reproducible parsing.

## Quality Metrics

- Extraction metrics (derived from semantic profile and counts):
  - `tokenCount`, `sentenceCount`, and `avgSentenceTokens` per document.
  - Implicit precision/recall trade‑offs via `KG_EDGE_CONFIDENCE_THRESHOLD` and `KG_PHRASE_BOUNDARY_THRESHOLD`.
- Unification metrics:
  - Entity duplication reduced via canonical IDs and `metadata.aliases`.
  - `metadata.sourceDocuments` highlights how many documents contributed to the unified graph.
- Query / traversal metrics:
  - Optional PageRank‑style `properties.centrality` for entities when `corpus_centrality_algorithm` is `pagerank`.
  - Suggested traversal edges in `metadata.suggestedTraversalEdges` guide Explorer and Orchestrator tooling.

## Validation Checklist

- Required fields present:
  - All nodes include `@id`, `@type`, `name`, `chunk_text`, `properties`, and `metadata`.
  - All edges include `@id`, `@type: "Edge"`, `source_node`, `target_node`, and `relation`.
- Referential integrity maintained:
  - Edges only reference node IDs present in `@graph`.
  - Cross‑document unification remaps references through `id_aliases` without losing provenance.
- Zero hardcoded domain entities:
  - No project‑specific entity labels or paths are baked into parsing heuristics.
  - All thresholds and modes are configured via environment variables or markdown frontmatter.
- Configuration‑only adaptation possible:
  - Different markdown corpora can adjust span length, confidence thresholds, and centrality behavior without code changes.
  - Canvas can point to any markdown workflow document via `VITE_MARKDOWN_PIPELINE_INPUT_REL_PATH`.
- Multi‑domain robustness:
  - Parser is document‑ and codebase‑agnostic and has been structured to support multiple repositories and markdown styles through configuration.
