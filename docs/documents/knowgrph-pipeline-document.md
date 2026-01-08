# Knowgrph Markdown -> Graph -> Canvas Pipeline

## Architecture Overview

**Layer Flow**: Detection -> Schema Inference -> Ingestion -> Parsing -> Orchestration -> Rendering -> Agentic RAG  

**Data Structures**: Markdown documents -> JSON‑LD graph (nodes + edges) -> Schema JSON‑LD -> Orchestrator YAML -> Canvas GraphData and GraphRAG workflow JSON‑LD.

### End‑to‑End Path (Concrete)

- Detection / Entry:
  - CLI: `python -m knowgrph_parser markdown` (see `knowgrph_parser/markdown_cmd.py`).
  - Dev server: Vite plugin calling the same CLI via `CODEBASE_INDEX_PIPELINE_COMMAND` (see `canvas/vite.config.ts` and `canvas/src/lib/config-copy/tooltips.ts`).
- Parsing:
  - Structural and semantic parsing in `knowgrph_parser/markdown_graph.py` -> JSON‑LD graph with `Document`, `Section`, `Paragraph`, `CodeBlock`, `List`, `ListItem`, `Table`, `Entity`, `Mention`, and `Edge` nodes.
- Schema Inference:
  - `knowgrph_parser/schema_config.py` infers node/edge types and properties from the graph and emits schema JSON‑LD.
- Orchestration:
  - `knowgrph_parser/orchestrator_yaml.py` builds an orchestrator YAML file embedding AgenticRAG schema metadata and a starter `graph_rag_paths` entry.
- Rendering:
  - `canvas/src/features/panels/hooks/workflowJsonLdActions.ts` loads graph, schema, and orchestrator artifacts into the canvas via `runMarkdownPipelineAndLoadArtifacts`.
  - `canvas/src/lib/graph/jsonld` provides centralized JSON-LD processing utilities, including context comparison and ignore filter management, ensuring alignment with the backend parser.
- Agentic RAG (Client-Side & Server-Side):
  - **Server-Side**: `knowgrph_parser` generates static graph/schema artifacts.
  - **Client-Side**: `canvas/src/features/agentic-rag` implements a full dynamic pipeline (TokenLinker, EdgeElevator, ThresholdTuner, FeedbackOrchestrator, CorpusReasoner) to process text/markdown on-the-fly within the browser, mirroring and extending the backend logic with real-time feedback loops.
  - Canvas Orchestrator tab integrates both static artifacts and dynamic pipeline results.

The pipeline adheres to `/schema/AgenticRAG` by:

- Using `DEFAULT_AGENTIC_RAG_SCHEMA_URL` and `DEFAULT_AGENTIC_RAG_CONTEXT_URL` in `knowgrph_parser/common.py`.
- Using centralized constants (`KG_PREFIX`, `KG_NODE_TYPE_CLASS`, `KG_EDGE_LABEL_CLASS`, etc.) from `knowgrph_parser/common.py` and `canvas/src/lib/agenticrag.ts` to ensure strict ID and Type consistency.
- Emitting JSON‑LD graphs whose `@context` starts with the AgenticRAG context URL.
- Treating edges as first‑class nodes with `@type: "Edge"`, `source`, `target`, and `relation` fields plus rich `properties` and `metadata`.

## Pipeline Specification

### Stage: Detection & Ingestion

**From repository markdown to CLI inputs**: Detection -> resolves markdown input path and repository root -> delivers a list of markdown files to the parser.

- Implementation:
  - `_list_markdown_files` in `knowgrph_parser/markdown_cmd.py`.
  - Vite dev plugin `markdownPipelineDevPlugin` in `canvas/vite.config.ts`.
- Responsibilities:
  - Accept `--input` as either a single markdown file or a directory tree.
  - Resolve repository root via `find_repo_root` so `metadata.codebaseRoot` and `metadata.documentPath` stay stable across machines.
  - Drive the CLI from the canvas via `CODEBASE_INDEX_PIPELINE_COMMAND`.

### Stage: Client-Side HTML Ingestion

**From HTML content to Markdown & Graph**: The HTML ingestion pipeline allows users to import HTML (local file or URL) directly into the canvas.

- **Entry Points**:
  - Unified: Toolbar "Source Files" -> Import -> HTML (handled by `useToolbarMenuAction.ts` with `area: "sourceFiles"`).
  - Direct: `ToolbarHtmlArea.tsx` -> `htmlImportAction.ts` (via `useToolbarMenuAction.ts`).
- **Process**:
  1.  **Fetch**: Retrieves HTML content from URL or local file via `htmlImportAction.ts`.
      -   For remote URLs, HTML is fetched via a same-origin proxy endpoint (`/__fetch_remote?url=...`) provided by the Vite server (`canvas/vite.config.ts`).
      -   **Proxy Robustness**: The proxy middleware uses global request interception (ignoring path stripping issues) and injects browser-like headers (`User-Agent`, `Sec-Fetch-*`, `Upgrade-Insecure-Requests`) to mimic real browser navigation, ensuring compatibility with stubborn sites (e.g., World Bank, Google Skills).
  2.  **Parse**: `parseHtmlToMarkdown` in `src/features/parsers/html-parser.ts` converts HTML to Markdown.
      -   Handles block elements (headers, lists, `main`, `article`, `section`, `nav`, `aside`, etc.).
      - **Advanced Structures**: Supports `table` (basic text conversion), `pre`/`code` (code blocks), `img` (image links), and `blockquote`.
      - **Media**: Converts `<img>`, `<video>`, and `<iframe>` into Markdown inline refs (e.g., `![Video](url)`, `![IFrame](url)`) with URLs resolved against the page URL so downstream parsing can render media nodes reliably.
      - **Feeds**: Detects RSS/Atom/XML responses and converts feed items/entries into Markdown sections with links.
      - **Test Site Compatibility**: optimized for complex documentation sites (e.g., AIAP Field Guide, CommonMark Spec) via robust parsing of nested structures and enhanced fetch headers (anti-bot bypass).
      - **Collapsed Sections**: Preserves `<details>`/`<summary>` tags in Markdown to allow the Markdown Viewer to render interactive collapsible sections.
      -   **SPA Limitations & Guards**: If the site is a JavaScript-only Single Page Application (SPA) where the initial HTML is empty, the parser will return an empty result.
      -   **Fallback Guard**: explicitly detects and rejects local Vite SPA fallback (serving `index.html` for 404s) to prevent importing the local application shell instead of the target content.
      -   **Viewer Guard**: the BottomPanel Markdown loader rejects Vite dev app-shell HTML so it never renders as imported “webpage content”.
  3.  **Extract**: `extractJsonLd` extracts embedded JSON-LD structured data.
  4.  **Ingest**:
      -   Markdown content is loaded via `loadGraphDataFromTextViaParser`.
      -   Extracted JSON-LD is appended as a code block (or processed) to preserve structured data.
      -   The resulting graph is rendered immediately (opens Curation with the imported graph).
- **Responsibility**:
  -   Provides a "no-code" entry point for web content (e.g., AIAP Field Guide).
  -   Bypasses the backend CLI for ad-hoc exploration.
  -   Ensures link rendering is reliable in the Markdown Viewer (standard Markdown links and plain `http(s)` URLs are clickable).

### Stage: Client-Side Markdown URL Ingestion

**From URL content to Markdown & Graph**: The Markdown ingestion pipeline allows users to import Markdown (local file or URL) directly into the canvas.

- **Entry Points**:
  - Unified: Toolbar "Source Files" -> Import -> Markdown (handled by `useToolbarMenuAction.ts` with `area: "sourceFiles"`).
  - Direct: `ToolbarMarkdownArea.tsx` -> `markdownImportAction.ts` (via `useToolbarMenuAction.ts`).
- **Behavior**:
  - URL ingestion accepts any `http(s)` URL; if the fetched content looks like HTML (e.g., GitHub “blob” pages), it is converted to Markdown via `parseHtmlToMarkdown` before parsing.
  - Inline `![...](...)` and `[...] (...)` refs are resolved against the document URL so relative media/links remain usable downstream.
  - Media refs tagged as `Video` or `IFrame` are materialized as dedicated rectangular media nodes (`Video`, `IFrame`, `Image`) when “Render Media as Nodes” is enabled.
  - IFrame embedding is gated by `VITE_IFRAME_ALLOWED_HOSTS` (comma/space-separated host allowlist); if not allowed, the node remains but won’t embed an iframe.
  - Local dev/test: when running `npm run dev` or `npm test`, set `VITE_IFRAME_ALLOWED_HOSTS=www.youtube.com,youtu.be,vimeo.com` (or your own hosts) so iframe media nodes resolve to interactive panels instead of being dropped by the allowlist.

### Stage: Client-Side PDF Ingestion

**From PDF content to Markdown & Graph**: The PDF ingestion pipeline allows users to import PDF (local file or URL) directly into the canvas, converting it to Markdown via a native parser (using pypdf).

- **Entry Points**:
  - Unified: Toolbar "Source Files" -> Import -> PDF (handled by `useToolbarMenuAction.ts` with `area: "sourceFiles"`).
  - Direct: `ToolbarPdfArea.tsx` -> `pdfImportAction.ts` (via `useToolbarMenuAction.ts`).
- **Process**:
  1. **Convert**: Converts PDF to Markdown via a same-origin Vite endpoint (`/__convert_pdf`) implemented in `canvas/vite.config.ts`.
      - URL import: `POST /__convert_pdf?url=https://.../file.pdf`
      - Local import: `POST /__convert_pdf` with `Content-Type: application/pdf` and raw PDF bytes.
      - Conversion engine: shells out to the Python parser entrypoint: `python -m knowgrph_parser pdf --input <file.pdf>`, which uses `pypdf` for native text extraction.
      - Assets: extracted images are served during dev via `GET /__pdf_assets/<token>/...` and referenced from the converted Markdown.
  2. **Ingest**: Loads the converted Markdown via `loadGraphDataFromTextViaParser`, producing GraphData nodes/edges using the same parsing path as Markdown and HTML imports.
  3. **Render**: Stores the imported Markdown in the graph store and opens Curation to render the resulting graph immediately.
- **Image Rendering**:
  - Markdown image references become `Image` nodes connected by `embedsImage` edges.
  - The default schema renders `Image` nodes as rectangular nodes and clips their media to a rectangle.
- **Requirements**:
  - The Python environment used by the parser must have pypdf installed: `pip install pypdf` (already encoded in `requirements.txt`).
  - If conversion fails, the conversion endpoint returns a structured error and the UI reports a failed load status.
- **Test Data**:
  - `http://www.cad.zju.edu.cn/home/ybtao/papers/PaciVis16_Semantic%20Word%20Cloud.pdf`

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

### Stage: Semantic Parsing Layers

The semantic parsing stage is composed of three distinct layers that progressively lift raw text into a connected knowledge graph.

#### Layer 1: TokenLinker (Entity Extraction)
**From text to Mention/Entity nodes**: TokenLinker scans text blocks to identify potential entities and link them to `Mention` nodes.

- **Code Path**: `knowgrph_parser/token_linker.py`
  - `_tokenize_with_offsets` (L126–137): Splits text into tokens with character offsets.
  - `_merge_tokens_to_spans` (L154–196): Merges tokens into entity spans using `phrase_boundary_threshold`.
  - `_detect_inline_code_spans` (L199–215): Extracts inline code as high-confidence entities.
- **Behavior**:
  - Dynamically tunes `phrase_boundary_threshold` if `auto_tune_enabled` is true (L631–637).
  - Creates `Mention` nodes (L692) and `Entity` nodes (L679) with `metadata.extractionMethod: "token_linking"`.

#### Layer 2: EdgeElevator (Relationship Extraction)
**From sentences to Semantic Edges**: EdgeElevator analyzes sentence structure to infer relationships between co-occurring entities.

- **Code Path**: `knowgrph_parser/edge_elevator.py`
  - `_extract_sentence_features` (L218–236): Detects temporal markers ("before", "after"), modality ("should", "must"), and negation.
  - **Semantic Loop** (L727–790):
    - Splits blocks into sentences.
    - Identifies entities co-occurring within `max_syntactic_path_length`.
    - Calculates confidence score based on sentence features and proximity.
    - Emits `semanticRelation` edges with `properties.temporalMarker`, `properties.modality`, etc.
- **Pattern Mining**:
  - **Co-occurrence Loop** (L793–818): Identifies global co-occurrence patterns across the document set to emit `coOccursWith` edges.

#### Layer 3: DocumentUnifier (Cross-Document Merging)
**From isolated graphs to Unified Knowledge Graph**: DocumentUnifier merges entity nodes across file boundaries using canonical IDs.

- **Code Path**: `knowgrph_parser/markdown_cmd.py`
  - `_canonical_entity_id` (L43–46): Generates deterministic IDs `ent:global:<hash>` from `entityType` and `normalizedText`.
  - `_unify_entities_across_docs` (L102–165):
    - Iterates over all document graphs.
    - Remaps local entity IDs to canonical global IDs using `id_aliases`.
    - Merges properties and appends `metadata.aliases`.
    - Calls `_remap_edge_endpoints` (L57–69) to rewire edges to the unified entities.

### Stage: Threshold Tuning

**From document profile to dynamic parameters**: ThresholdTuner adapts extraction sensitivity based on document characteristics.

- **Implementation**:
  - Computes document profile: `semantic_doc_profile.tokenCount`, `sentenceCount`, `avgSentenceTokens` (L618–629).
  - Adapts `max_syntactic_path_length` based on sentence length (L631–637).
- **Configuration**:
  - Controlled by environment variables or frontmatter:

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

KG_COREFERENCE_DISTANCE_LIMIT:
  from: 1
  to: 10
  action: sets max sentence distance for pronoun resolution
  controls: coreference reach
  affects: entity merging recall
  default: 5
  min: 1
  max: 10
  interval: 1

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

KG_TEMPORAL_MARKER_BOOST:
  from: 0.0
  to: 0.5
  action: boosts edge confidence for temporal cues
  controls: temporal sensitivity
  affects: temporal edge recall
  default: 0.15
  min: 0.0
  max: 0.5
  interval: 0.05

KG_FEEDBACK_WINDOW_SIZE:
  from: 1
  to: 50
  action: sets document window for adaptive feedback
  controls: adaptation latency
  affects: threshold stability
  default: 10
  min: 1
  max: 50
  interval: 1
```

### Stage: Cross‑Document Unification

**From per‑file graphs to unified entity graph**: DocumentUnifier -> merges entities across markdown files via canonical IDs (configurable via `entity_merge_threshold` and `conflict_resolution_strategy`) -> delivers a merged JSON‑LD graph with cross‑document entity aliases and consistent edge endpoints.

- Implementation:
  - `_unify_entities_across_docs` in `knowgrph_parser/markdown_cmd.py` (supports `entity_merge_threshold`, `conflict_resolution_strategy`, `cross_document_inference_depth`).
  - `_canonical_entity_id` ensures stable `ent:global:*` IDs per `(entityType, normalizedText)`.
  - `_remap_edge_endpoints` updates `source_node`/`target_node` and `source`/`target` to the canonical IDs.
- Provenance:
  - Merged metadata includes `metadata.sourceDocuments` listing all contributing `documentPath` values.
  - Each unified entity carries `metadata.aliases` for previous IDs.

### Stage: Schema Inference

**From graph instances to schema JSON‑LD**: SchemaConfig -> inspects nodes and edges -> delivers a minimal AgenticRAG‑style node/edge/property schema.

- Implementation:
  - `build_schema_config_jsonld` in `knowgrph_parser/schema_config.py`.
- Behavior:
  - Infers node types from `@type`.
  - Infers edge labels from `relation` and maps them to `kg:EdgeLabel`.
  - Infers property ranges from sample values and emits `kg:Property` entries.
- Metadata:
  - Includes `metadata.agenticRagSchema` pointing back to the AgenticRAG schema URL.
  - When the source graph JSON‑LD exposes `metadata.layers` and `metadata.defaultLayer` (for example, markdown graphs produced by `parse_markdown_to_graph_jsonld`), schema-config captures:
    - `metadata.layersFromGraph`: a copy of the parser-emitted layer hints (semantic, documentStructure, property) for downstream inspection.
    - `metadata.defaultLayerFromGraph`: the parser-suggested default layer name (typically `"semantic"`).
  - Uses these hints to seed `metadata.layers` in the schema-config JSON‑LD so canvas and tools can auto-derive neutral defaults without extra wiring:
    - `layers.mode`: `"semantic"` by default.
    - `layers.semantic.similarityMetric`: `"pmi"` to align with co-occurrence edges weighted by PMI.
    - `layers.semantic.similarityEdgeLabel`: derived from `metadata.layers.semantic.edgeLabel` when present (for example, `"coOccursWith"`).
    - `layers.semantic.hiddenNodeTypes`: seeded from `metadata.layers.semantic.nodeTypes` so semantic mode can hide structural or non-entity types when desired.
    - `layers.documentStructure.structuralNodeTypes` and `layers.documentStructure.structuralEdgeLabels`: derived from `metadata.layers.documentStructure` to drive document-structure layer behavior and polygon grouping in a schema-driven way.
  - The markdown CLI exposes a neutral inspection mode:
    - `python -m knowgrph_parser markdown --input docs/documents/knowgrph-parser-document.md --print-schema-layers`
    - This runs markdown parsing and schema inference in memory, then prints `schema-config.metadata.layers` as JSON and exits without writing artifacts; it is useful for verifying how `metadata.layers.*` hints are propagated into schema-config defaults.

### Stage: Orchestration

**From graph + schema to orchestrator YAML**: OrchestratorConfig -> records parser entrypoint, graph paths, and starter traversal paths -> delivers YAML suitable for GraphRAG workflows and canvas import.

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

**From markdown artifacts to interactive GraphData + workflow JSON‑LD**: Canvas -> triggers the markdown pipeline, loads artifacts into GraphData, schema, and Orchestrator tabs -> delivers an AgenticRAG‑aligned canvas session.

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
- Preset workflows:
  - Examples and presets are defined in:
    - `canvas/src/features/parsers/examplesCatalog.ts`
    - `canvas/src/features/parsers/workflowPresets.ts`
  - Interviewer assessment workflow:
    - Dataset JSON‑LD: `docs/assets/interviewer.jsonld`
    - Markdown source: `docs/assets/interviewer.md`
    - Schema‑config JSON‑LD: `schema-config/knowgrph-interviewer-schema-config.jsonld`
      - Derived from the same schema-config JSON‑LD shape as `data/schema-config-template.jsonld`, so LLMs and tools can generate interview‑style configs by filling in node/edge types and adjusting semantic presets.
      - Semantic thresholds (`layers.semantic.topKEdgesPerNode`, `layers.semantic.minSimilarity`) are driven by schema-config, not hardcoded in the canvas; `metadata.corpusSizePreset` and `metadata.corpusSizePresets` in the template provide a neutral starting point for small/medium/large corpora.
    - Canvas preset id: `interviewer-assessment-kg`
    - Behavior: selecting the interviewer example or preset loads the interviewer graph, applies the interviewer schema‑config (including `layers.semantic.hiddenNodeTypes`), and keeps layer and mode switching metadata‑driven and domain‑agnostic.
    - Click path to exercise layout and layer caches:
      - Open the **Examples** menu and choose the **Interviewer assessment** preset (or the corresponding examples entry) so the canvas loads `docs/assets/interviewer.jsonld` with the interviewer schema-config applied.
      - In the toolbar, toggle **Layer mode** between **Property**, **Document structure**, and **Semantic**:
        - Property and document-structure layers render the full interviewer graph; semantic layer hides `geo:Polygon` nodes and any edges incident on them, as configured in the schema.
        - The underlying JSON‑LD graph stays unchanged; only visibility is controlled by `layers.mode` and `layers.semantic.hiddenNodeTypes`.
      - In the same session, toggle **Layout mode** between **Force**, **Radial**, and **Tidy tree**:
        - Radial and tidy-tree layouts compute deterministic node positions once per `(layer, layout)` combination, then cache them in `layoutPositionCacheByMode`.
        - Switching from `force` → `radial` → `tidy-tree` and back reuses cached coordinates whenever coverage is high enough, so interviewer workflow nodes do not jitter across toggles.
        - Tidy-tree uses the interviewer workflow edges (for example `pplan:isPrecededBy`) to derive a single parent→child tree and renders only those tree edges, matching the behavior validated by `ui.markdown.interviewerSliceTidyTreeDerivationUsesWorkflowEdges`.
      - While switching layers and layouts, use:
        - The **Fit to Screen** toggle to keep the full interviewer workflow in view.
        - The **Polygon groups** toggle to show or hide convex hulls around semantic clusters; cached radial/tidy-tree layouts remain stable across polygon visibility changes.
      - This click path exercises:
        - JSON‑LD ingestion of `docs/assets/interviewer.jsonld` and `docs/assets/interviewer.md`.
        - Schema-driven layer visibility for `geo:Polygon` vs. non-polygon nodes.
        - Per-layer, per-layout 2D position caching with `layoutPositionCacheByMode`.

### Stage: Client-Side Agentic RAG

**From raw text to Interactive Knowledge Graph (In-Browser)**: The TypeScript implementation in `canvas/src/features/agentic-rag` provides a mirror of the backend pipeline with enhanced interactivity.

- **TokenLinker (`TokenLinker.ts`)**:
  - Implements SVO-aware tokenization and phrase boundary detection.
  - Tracks full provenance (line, column) for bidirectional source linking.
- **EdgeElevator (`EdgeElevator.ts`)**:
  - Extracts temporal, modality, and negation properties.
  - Infers semantic edges with confidence scoring.
- **ThresholdTuner (`ThresholdTuner.ts`)**:
  - Dynamically adjusts thresholds based on syntactic complexity (avg sentence length).
- **DocumentUnifier (`DocumentUnifier.ts`)**:
  - Merges entities across results using highest-confidence resolution and provenance aggregation.
- **FeedbackOrchestrator (`FeedbackOrchestrator.ts`)**:
  - **New**: Implements real-time feedback loops.
  - Aggregates metrics (density, confidence) and adjusts `AgenticRagConfig` for subsequent passes (Adaptive Thresholds).
- **CorpusReasoner (`CorpusReasoner.ts`)**:
  - **New**: Computes PageRank centrality and mines frequent patterns/emergent edges across the unified graph.
- **AgenticQueryEngine (`AgenticQueryEngine.ts`)**:
  - **New**: Provides intent classification and entity-focused graph traversal for natural language querying.

## Responsibility Flow Table (Key Entries)

| Pipeline Stage      | Modules                                           | Classes/Objects | Functions/Methods                        | Responsibility (S‑V‑O)                                                                                 | Dependencies / Imports                    | Data Artifacts / Outputs                                  | Line Range |
|---------------------|---------------------------------------------------|-----------------|------------------------------------------|--------------------------------------------------------------------------------------------------------|-------------------------------------------|-----------------------------------------------------------|-----------|
| Detection/Ingestion | `knowgrph_parser/markdown_cmd.py`                | —               | `_list_markdown_files`                  | MarkdownIngestion enumerates markdown files under input path                                          | `os`                                      | List of markdown file paths                               | 22–33     |
| Structural Parsing  | `knowgrph_parser/markdown_graph.py`              | —               | `parse_markdown_text_to_graph_jsonld`   | MarkdownParser converts markdown text into AgenticRAG‑aligned JSON‑LD nodes and edges                 | `.markdown_blocks`, `.common`             | JSON‑LD graph with `@context`, `@graph`, `metadata`       | 239–902   |
| TokenLinker Layer   | `knowgrph_parser/markdown_graph.py`              | —               | `_merge_tokens_to_spans`                | TokenLinker groups tokens into entity spans based on coherence thresholds                             | `_tokenize_with_offsets`                  | Mention/Entity nodes                                      | 154–196   |
| EdgeElevator Layer  | `knowgrph_parser/markdown_graph.py`              | —               | `_extract_sentence_features`            | EdgeElevator infers semantic relationships from sentence structure and co-occurrence                  | `re`                                      | Semantic Edges (semanticRelation)                         | 218–236   |
| DocumentUnifier     | `knowgrph_parser/markdown_cmd.py`                | —               | `_unify_entities_across_docs`           | DocumentUnifier merges entities and rewires edges across multiple source documents                    | `.common`                                 | Unified JSON‑LD graph document                            | 102–165   |
| Schema Inference    | `knowgrph_parser/schema_config.py`               | —               | `build_schema_config_jsonld`            | SchemaInferer derives node, edge, and property schema from instance graph                             | `.common`                                 | Schema JSON‑LD document                                   | 12–114    |
| Orchestration       | `knowgrph_parser/orchestrator_yaml.py`           | —               | `build_orchestrator_config_yaml`        | OrchestratorBuilder writes AgenticRAG‑aware orchestrator YAML referencing graph and schema artifacts  | `.common`                                 | Orchestrator YAML                                         | 7–50      |
| Rendering           | `canvas/src/features/panels/hooks/workflowJsonLdActions.ts` | —     | `runMarkdownPipelineAndLoadArtifacts`   | CanvasLoader runs markdown pipeline and loads graph, schema, and orchestrator into GraphData and UI   | `useGraphStore`, `loadGraphDataFromTextViaParser` | In‑memory GraphData, schema, GraphRAG workflow JSON‑LD    | 430–507   |
| Client Pipeline     | `canvas/src/features/agentic-rag/index.ts`       | AgenticRagPipeline | `run`                                    | PipelineOrchestrator executes full client-side RAG pipeline (Link->Elevate->Unify->Reason)           | All `agentic-rag/*` components            | `PipelineResult` (Entities, Edges, Metrics)               | ~50-100   |
| Client Feedback     | `canvas/src/features/agentic-rag/FeedbackOrchestrator.ts` | FeedbackOrchestrator | `process`                 | FeedbackLoop adjusts configuration based on extraction metrics                                        | `AgenticRagConfig`                        | Updated `AgenticRagConfig`                                | ~30-60    |
| Client Query        | `canvas/src/features/agentic-rag/AgenticQueryEngine.ts` | AgenticQueryEngine | `query`                       | QueryEngine answers NL queries by traversing the client-side graph                                    | `PipelineResult`                          | String Answer                                             | ~50-100   |
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

## Frontend Maintainability Standards

To ensure long-term codebase health and prevent regression:

- **Centralized UI Copy**: All user-facing strings are centralized in `canvas/src/lib/config-copy/uiCopy.ts` to prevent hardcoding and facilitate consistent terminology (e.g., "Enter HTML URL", table aggregation labels).
- **Component Stability**: Strict key uniqueness enforcement (e.g., in `GraphDataTable`) prevents React rendering warnings and ensures DOM stability during updates.
- **Codebase Neutrality**: Domain-specific logic is configuration-driven; components remain agnostic to specific datasets.
