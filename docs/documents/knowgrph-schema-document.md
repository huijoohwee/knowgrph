# KnowGrph schema configuration

## Example workflow schema-config

- Dataset: `docs/assets/example-workflow.jsonld` (JSON-LD graph describing a neutral workflow with regions and questions).
- Schema config: `schema-config/knowgrph-example-workflow-schema-config.jsonld`.
  - Uses `layers.mode: "semantic"` (which is also the canvas default) so the graph initially opens in semantic layer mode.
  - Configures `layers.semantic.hiddenNodeTypes` to `["geo:Polygon"]` so polygon cluster nodes used for spatial annotations are hidden only when the semantic layer is active.
  - Leaves property and document-structure layers neutral so they render the full example workflow graph without hiding nodes or edges.
- Examples catalog entry:
  - Uses the example workflow dataset and schema-config together so layer behavior is always schema-driven and domain-agnostic.
  - Switching between semantic, document-structure, and property layers reuses the same underlying graph data while the active schema layer controls what nodes and edges are visible.

## Layer and mode interaction

- Layout modes:
  - `graph.layout.mode` supports `"force"`, `"radial"`, and `"tidy-tree"` layouts.
  - Structured layouts (`"radial"`, `"tidy-tree"`) cache node positions per `(schema.layers.mode, graph.layout.mode)` key so switching layers or layout modes does not corrupt other combinations.
  - Layout caches are cleared when graph data is replaced or reset so memory usage stays bounded per dataset and does not leak across imports.
- Semantic layer behavior:
  - Semantic layer is the default (`layers.mode: "semantic"`) and derives a similarity graph from tokenized node text using cosine similarity or PMI.
  - Louvain-style community detection assigns `visual:community` and `visual:fill` per node; polygon groups in the canvas wrap these semantic communities by default.
  - Thresholds for `layers.semantic.topKEdgesPerNode` and `layers.semantic.minSimilarity` act as schema-driven sparsity and quality controls: smaller `topK` and larger `minSimilarity` produce sparser, higher-confidence neighborhoods, while larger `topK` values and lower `minSimilarity` values increase coverage at the cost of density.
  - When `schema.layers.mode !== "semantic"` or `layers.semantic.hiddenNodeTypes` is empty, all nodes and edges remain visible.
  - When `schema.layers.mode === "semantic"` and `layers.semantic.hiddenNodeTypes` is configured, nodes with matching `type` values are hidden along with any edges incident on those nodes.
-  - This behavior is validated by tests that load `docs/assets/example-workflow.jsonld` and compare node and edge counts between document-structure and semantic layers.
  - JSON-LD parsing infers edges generically from array-valued properties whose targets exist as nodes (including `{"@id": ...}` references), so property and document-structure layers receive the full edge set without dataset-specific logic.
  - Markdown ingestion uses `buildMarkdownJsonLd` to convert large documents such as `docs/assets/example-workflow.md` into graphs; tests validate that ingestion produces non-empty node sets with no parser warnings.
  - Markdown graphs produced by `parse_markdown_to_graph_jsonld` expose neutral layer hints in `metadata.layers` so canvas and downstream tools can treat:
    - `layers.semantic` as the semantic similarity layer over `Entity` nodes and co-occurrence edges.
    - `layers.documentStructure` as the structural layer over `Document`, `Section`, `Paragraph`, `List`, `ListItem`, `CodeBlock`, and `Table` nodes plus `hasSection`, `hasBlock`, `hasItem`, `next`, and `linksTo` edges.
    - `layers.property` as the raw property-based layer where node and edge attributes live under `properties` without additional semantic derivations.
  - Schema-config generation (`build_schema_config_jsonld`) treats these parser-emitted hints as input and records them under `metadata.layersFromGraph` and `metadata.defaultLayerFromGraph`, then materializes an initial `metadata.layers` block for the schema-config:
    - `layers.semantic.similarityMetric` defaults to `"pmi"` to align with PMI-weighted `coOccursWith` edges.
    - `layers.semantic.similarityEdgeLabel` is populated from the parser’s `semantic.edgeLabel` when present.
    - `layers.semantic.hiddenNodeTypes` can be seeded from parser-emitted `semantic.nodeTypes` when curators want semantic mode to emphasize entities while leaving document-structure and property layers unbiased.
    - `layers.documentStructure.structuralNodeTypes` and `layers.documentStructure.structuralEdgeLabels` are seeded from `metadata.layers.documentStructure` so canvas can render structural and polygon layers without duplicating configuration.

## Semantic presets and schema-config template

- Semantic threshold presets:
  - Corpus-size-oriented presets can be expressed in schema-config JSON-LD metadata without changing canvas code.
  - The template at `data/schema-config-template.jsonld` includes neutral presets for:
    - `small` corpora (up to ~1e3 nodes): higher `topKEdgesPerNode`, lower `minSimilarity`.
    - `medium` corpora (up to ~1e4 nodes): balanced defaults aligned with the built-in canvas configuration.
    - `large` corpora (up to ~1e5 nodes): lower `topKEdgesPerNode`, higher `minSimilarity` for readability and performance.
  - Template metadata fields:
    - `metadata.corpusSizePreset`: effective preset key (`"small"`, `"medium"`, or `"large"`).
    - `metadata.corpusSizePresets`: describes recommended values for:
      - `layers.semantic.topKEdgesPerNode`.
      - `layers.semantic.minSimilarity.cosine`.
      - `layers.semantic.minSimilarity.pmi`.
  - Canvas UI exposes `schema.layers.semantic.topKEdgesPerNode` and `schema.layers.semantic.minSimilarity` so curators can adapt thresholds per dataset; schema-config JSON-LD acts as a preset source of truth that LLMs and tools can read and update.
