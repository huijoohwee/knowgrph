KnowGrph schema configuration
=============================

Interviewer workflow schema-config
----------------------------------

- Dataset: `docs/assets/interviewer.jsonld` (JSON-LD graph describing the AIAP Batch 22 technical assessment, interview probes, rubric, and workflow entities).
- Schema config: `schema-config/knowgrph-interviewer-schema-config.jsonld`.
  - Sets `layers.mode` to `"semantic"` so the canvas initially opens in semantic layer mode for this dataset.
  - Configures `layers.semantic.hiddenNodeTypes` to `["geo:Polygon"]` so polygon cluster nodes used for spatial annotations are hidden only when the semantic layer is active.
  - Leaves property and document-structure layers neutral so they render the full interviewer graph without hiding nodes or edges.
- Examples catalog entry:
  - Uses the interviewer dataset and the interviewer schema-config together so layer behavior is always schema-driven and domain-agnostic.
  - Switching between property, document-structure, and semantic layers reuses the same underlying graph data while the active schema layer controls what nodes and edges are visible.

Layer and mode interaction
--------------------------

- Layout modes:
  - `graph.layout.mode` supports `"force"`, `"radial"`, and `"tidy-tree"` layouts.
  - Structured layouts (`"radial"`, `"tidy-tree"`) cache node positions per `(schema.layers.mode, graph.layout.mode)` key so switching layers or layout modes does not corrupt other combinations.
  - Layout caches are cleared when graph data is replaced or reset so memory usage stays bounded per dataset and does not leak across imports.
- Semantic layer behavior:
  - When `schema.layers.mode !== "semantic"` or `layers.semantic.hiddenNodeTypes` is empty, all nodes and edges remain visible.
  - When `schema.layers.mode === "semantic"` and `layers.semantic.hiddenNodeTypes` is configured, nodes with matching `type` values are hidden along with any edges incident on those nodes.
  - This behavior is validated by tests that load `docs/assets/interviewer.jsonld` and compare node and edge counts between document-structure and semantic layers.
  - JSON-LD parsing infers edges generically from array-valued properties whose targets exist as nodes (including `{"@id": ...}` references), so property and document-structure layers receive the full edge set without dataset-specific logic.
  - Markdown ingestion uses `buildMarkdownJsonLd` to convert large documents such as `docs/assets/interviewer.md` into graphs; tests validate that ingestion produces non-empty node sets with no parser warnings.
