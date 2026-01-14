# KnowGrph schema configuration

## Example workflow schema-config

- Dataset: `docs/assets/example-workflow.jsonld` (JSON-LD graph describing a neutral workflow with regions and questions).
- Schema config: `schema-config/knowgrph-example-workflow-schema-config.jsonld`.
  - Uses `layers.mode: "semantic"` (which is also the canvas default) so the graph initially opens in the semantic layer, matching the “Similarity clusters (semantic)” mode in the UI.
  - Configures `layers.semantic.hiddenNodeTypes` to `["geo:Polygon"]` so graph-layer cluster nodes used for spatial annotations are hidden only when the semantic layer is active.
  - Leaves property and document-structure layers neutral so they render the full example workflow graph without hiding nodes or edges, corresponding to “Raw data (schema)” for property and “Layered structure (document)” for document-structure in the UI.
- Examples catalog entry:
  - Uses the example workflow dataset and schema-config together so layer behavior is always schema-driven and domain-agnostic.
  - Switching between semantic (“Similarity clusters (semantic)”), document-structure (“Layered structure (document)”), and property (“Raw data (schema)”) layers reuses the same underlying graph data while the active schema layer controls what nodes and edges are visible.

## Layer and mode interaction

- Layout modes:
  - `schema.layout.mode` supports `"force"`, `"radial"`, and `"tree"` layouts.
  - Structured layouts (`"radial"`, `"tree"`) cache node positions per `(schema.layers.mode, schema.layout.mode)` key so switching layers or layout modes does not corrupt other combinations.
  - Layout caches are cleared when graph data is replaced or reset so memory usage stays bounded per dataset and does not leak across imports.
- Semantic layer behavior:
  - Semantic layer is the default (`layers.mode: "semantic"`) and derives a similarity graph from tokenized node text using cosine similarity or PMI.
  - Louvain-style community detection assigns `visual:community` and `visual:fill` per node; graph-layer hulls in the canvas wrap these semantic communities by default.
  - Thresholds for `layers.semantic.topKEdgesPerNode` and `layers.semantic.minSimilarity` act as schema-driven sparsity and quality controls: smaller `topK` and larger `minSimilarity` produce sparser, higher-confidence neighborhoods, while larger `topK` values and lower `minSimilarity` values increase coverage at the cost of density.
  - When `schema.layers.mode !== "semantic"` or `layers.semantic.hiddenNodeTypes` is empty, all nodes and edges remain visible.
  - When `schema.layers.mode === "semantic"` and `layers.semantic.hiddenNodeTypes` is configured, nodes with matching `type` values are hidden along with any edges incident on those nodes.
-  - This behavior is validated by tests that load `docs/assets/example-workflow.jsonld` and compare node and edge counts between document-structure and semantic layers.
  - JSON-LD parsing infers edges generically from array-valued properties whose targets exist as nodes (including `{"@id": ...}` references), so property and document-structure layers receive the full edge set without dataset-specific logic.
  - Markdown ingestion uses `buildMarkdownJsonLd` to convert large documents such as `docs/assets/example-workflow.md` into graphs; tests validate that ingestion produces non-empty node sets with no parser warnings.
  - Markdown → graph parses also attach neutral ingestion timing metrics under `metadata.ingestionMetrics` (for example, `totalMs`, `buildMarkdownJsonLdMs`, `parseJsonLdMs`) so schema-aware tools can reason about parser performance without depending on canvas-specific UI.
  - Markdown graphs produced by `parse_markdown_to_graph_jsonld` expose neutral layer hints in `metadata.layers` so canvas and downstream tools can treat:
    - `layers.semantic` as the semantic similarity layer over `Entity` nodes and co-occurrence edges.
    - `layers.documentStructure` as the structural layer over `Document`, `Section`, `Paragraph`, `List`, `ListItem`, `CodeBlock`, and `Table` nodes plus `hasSection`, `hasBlock`, `hasItem`, `next`, and `linksTo` edges.
    - `layers.property` as the raw property-based layer where node and edge attributes live under `properties` without additional semantic derivations.
  - Schema-config generation (`build_schema_config_jsonld`) treats these parser-emitted hints as input and records them under `metadata.layersFromGraph` and `metadata.defaultLayerFromGraph`, then materializes an initial `metadata.layers` block for the schema-config:
    - `layers.semantic.similarityMetric` defaults to `"pmi"` to align with PMI-weighted `coOccursWith` edges.
    - `layers.semantic.similarityEdgeLabel` is populated from the parser’s `semantic.edgeLabel` when present.
    - `layers.semantic.hiddenNodeTypes` can be seeded from parser-emitted `semantic.nodeTypes` when curators want semantic mode to emphasize entities while leaving document-structure and property layers unbiased.
    - `layers.documentStructure.structuralNodeTypes` and `layers.documentStructure.structuralEdgeLabels` are seeded from `metadata.layers.documentStructure` so canvas can render structural and graph layers without duplicating configuration.

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
- Tree Mermaid density presets:
  - Markdown ingestion attaches a density summary for Mermaid frontmatter diagrams under `graph_jsonld.metadata.tree.mermaidDensity`:
    - `statementCount`: number of non-comment Mermaid statements (nodes, edges, and click bindings; comments, `graph`, `subgraph`, and `end` lines are excluded).
    - `density`: coarse bucket label (`"none"`, `"sparse"`, `"medium"`, `"dense"`) derived from `statementCount`.
    - `anchorsOnly`: boolean indicating whether the Mermaid diagram was parsed in anchors-only mode.
    - `config`: neutral preset object with:
      - `sparseMaxStatements` and `denseMaxStatements` thresholds.
      - `anchorsOnly` and `defaultDiagram` separation presets for `sparse`, `medium`, and `dense` density buckets.
  - Canvas reads `metadata.tree.separation` as the parser-suggested Dagre spacing for tree layouts; users can override this interactively via `schema.layout.tree.separation` in the Renderer Floating Panel or Renderer toolbar settings panel.
  - Schema-config JSON-LD can override or extend these presets by emitting a compatible `metadata.tree.mermaidDensity.config` object for a given dataset; tools and LLMs can treat this config as the canonical source of truth for Mermaid density thresholds and separation values when generating or updating markdown+Mermaid workflows, while the canvas continues to treat `metadata.tree.separation` and `schema.layout.tree.separation` as the effective layout inputs.
  - The toolbar **Tree preset** control acts as a neutral, metadata-aware switch between Mermaid-centric and document-structure-centric tree layouts: when set to the Mermaid preset, it seeds `schema.layout.tree.edgeLabels`, `schema.layout.tree.orientation`, `schema.layout.tree.direction`, `schema.layout.tree.separation`, and `schema.layout.tree.colorMode` from `metadata.tree` (if present) for density-aware Mermaid flows; when set to the Document preset, it swaps `edgeLabels` to the document hierarchy set while keeping separation and direction aligned with the existing schema configuration instead of hardcoding dataset-specific values.
  - When Markdown metadata includes a Mermaid density summary, the canvas uses a neutral heuristic to seed tree label LOD collapse for Mermaid frontmatter graphs: `"medium"` density diagrams start with `schema.performance.lod.tree.collapseMode: "depth"` and `schema.performance.lod.tree.maxDepth: 3`, `"dense"` diagrams start with `collapseMode: "depth"` and `maxDepth: 2`, and `"none"`/`"sparse"` diagrams leave collapse disabled. These defaults are applied only when `schema.performance.lod.tree` has no explicit collapse configuration and remain fully overridable from the Renderer settings UI or schema-config JSON-LD.
