# Knowgrph metadata contracts

## Graph metadata (`graph_jsonld.metadata`)

- Core fields:
  - `graphId`: stable identifier for the graph instance (for example, `md:<slug>` for markdown documents).
  - `generatedAt`: ISO 8601 timestamp indicating when the graph was generated.
  - `agenticRagSchema`: URL of the AgenticRAG schema the graph aligns with.
  - `agenticRagContext`: URL (or array) for JSON‑LD contexts used when serializing nodes and edges.
- Structural provenance:
  - `semanticConfig`: effective semantic extraction configuration (thresholds, limits) used by the parser.
  - `suggestedTraversalEdges`: list of edge labels that downstream tooling can prioritize when building traversals.
- Layer hints:
  - `layoutMode`: suggested initial layout mode (for example, `"tree"` for markdown graphs).
  - `defaultLayer`: suggested initial schema layer mode (`"semantic"`, `"document-structure"`, or `"property"`).
  - `layers`: neutral layer descriptors emitted by parsers:
    - `layers.semantic`:
      - `nodeTypes`: node types that participate in semantic similarity and centrality (for example, `["Entity"]`).
      - `nodeMetrics`: metrics available on semantic nodes (for example, `["mentionCount", "blockFrequency", "centrality"]`).
      - `edgeLabel`: primary semantic similarity or co-occurrence label (for example, `"coOccursWith"`).
      - `edgeMetric`: semantic edge weight field (for example, `"pmi"`).
      - `communityProperty`: node property key storing community identifiers (for example, `"communityId"`).
    - `layers.documentStructure`:
      - `nodeTypes`: structural node types (`Document`, `Section`, `Paragraph`, `List`, `ListItem`, `CodeBlock`, `Table`).
      - `edgeLabels`: structural edge labels (`hasSection`, `hasBlock`, `hasItem`, `next`, `linksTo`).
    - `layers.property`:
      - `nodePropertyContainer`: container field for node properties (for example, `"properties"`).
      - `edgePropertyContainer`: container field for edge properties (for example, `"properties"`).

## Schema-config metadata (`schema-config.metadata`)

- Core fields:
  - `agenticRagSchema`: AgenticRAG schema URL (mirrors graph metadata).
  - `generatedBy`: implementation identifier (for example, `knowgrph_parser.schema_config`).
- Corpus presets:
  - `corpusSizePreset`: selected preset key (`"small"`, `"medium"`, `"large"`).
  - `corpusSizePresets`: neutral preset definitions that map corpus sizes to semantic tuning:
    - `layers.semantic.topKEdgesPerNode`.
    - `layers.semantic.minSimilarity.cosine`.
    - `layers.semantic.minSimilarity.pmi`.
- Layer propagation from graphs:
  - `layersFromGraph`:
    - Copy of `graph_jsonld.metadata.layers` emitted by parsers such as `parse_markdown_to_graph_jsonld`.
    - Provides a single source of truth for semantic/document-structure/property layer hints (mapped in the UI to “Similarity clusters (semantic)”, “Layered structure (document)”, and “Raw data (schema)”) without duplicating configuration.
  - `defaultLayerFromGraph`:
    - Copy of `graph_jsonld.metadata.defaultLayer`, indicating the parser-suggested default layer mode.
- Layer configuration for canvas and tools:
  - `layers.mode`:
    - Default schema layer mode (typically `"semantic"`).
  - `layers.semantic`:
    - `similarityMetric`: similarity type (`"cosine"` or `"pmi"`); markdown schema-configs default to `"pmi"` to align with PMI-weighted co-occurrence edges.
    - `similarityEdgeLabel`: similarity or co-occurrence label; initialized from `layersFromGraph.semantic.edgeLabel` when available (for example, `"coOccursWith"`).
    - `topKEdgesPerNode`, `minSimilarity`: numeric thresholds for semantic edge sparsity and quality; tuned by corpus size presets.
    - `hiddenNodeTypes`: optional list of node types to hide in semantic mode (for example, structural types), while leaving other layers neutral.
    - `communityDetection`: generic configuration for Louvain-style community detection (resolution, passes, moves).
  - `layers.documentStructure`:
    - `structuralNodeTypes`: list of structural node types derived from `layersFromGraph.documentStructure.nodeTypes`.
    - `structuralEdgeLabels`: list of structural edge labels derived from `layersFromGraph.documentStructure.edgeLabels`.
    - `minGroupSize`: minimum group size used by graph-layer grouping and related aggregations.
  - `layers.property`:
    - Uses the schema-config’s node/edge types and `layersFromGraph.property.*` containers to render the raw graph without semantic overlays.

## CLI inspection helper

- Markdown pipeline CLI:
  - Command: `python -m knowgrph_parser markdown --input <path/to/doc.md> --print-schema-layers`
  - Behavior:
    - Parses the markdown file into JSON‑LD via `parse_markdown_to_graph_jsonld`.
    - Derives schema-config JSON‑LD via `build_schema_config_jsonld`.
    - Prints `schema-config.metadata.layers` as pretty-printed JSON and exits without writing any files.
  - Purpose:
    - Provides a neutral, reproducible way to inspect how parser-emitted `graph_jsonld.metadata.layers` hints are transformed into `schema-config.metadata.layers` defaults for semantic, document-structure, and property modes.

## Neutrality and derivation rules

- Derivation only, no override:
  - Schema-config generation (`build_schema_config_jsonld`) reads `graph_jsonld.metadata.layers` and `graph_jsonld.metadata.defaultLayer` as hints only.
  - Curators and tools remain free to override `schema-config.metadata.layers` and corpus presets without changing parser code.
- Domain-agnostic contracts:
  - No dataset or project names appear in metadata contracts.
  - All behavior (hidden node types, similarity thresholds, graph-layer grouping) is driven by `metadata.layers`, `metadata.corpusSizePresets`, and schema-config fields instead of hardcoded domain logic.
