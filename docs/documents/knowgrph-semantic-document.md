# Knowgrph Semantic Layer: Parser → Schema → Canvas

## Scope and intent

- This document describes how the **semantic layer** implemented in `knowgrph_parser.semantic_processor` maps into:
  - `graph_jsonld.metadata.layers.semantic` emitted by the markdown parser.
  - `schema-config.metadata.layers.semantic` and `schema-config.metadata.layersFromGraph.semantic`.
  - `schema.layers.semantic` as edited by the canvas UI.
- The goal is to keep semantic behavior **domain‑agnostic**, **configuration‑driven**, and aligned with `/schema/AgenticRAG` while making the end‑to‑end flow inspectable and debuggable.

---

## 1. Parser semantics (semantic_processor)

### 1.1 Inputs and configuration

- `process_semantics(semantic_sources, sem_defaults, gid, nodes, edges, add_edge_callback)` receives:
  - `semantic_sources`: list of block‑level records from `graph_builder` (for example, `Paragraph`, `ListItem`) with:
    - `blockId`, `blockType`, `text`, `meta`.
  - `sem_defaults`: semantic configuration assembled by `graph_builder` from:
    - Environment variables (`KG_PHRASE_BOUNDARY_THRESHOLD`, `KG_EDGE_CONFIDENCE_THRESHOLD`, `KG_MAX_SYNTACTIC_PATH_LENGTH`, `KG_MIN_PATTERN_SUPPORT`, etc.).
    - Optional front‑matter `semanticConfig` overrides.
  - `gid`: graph identifier used to derive stable entity and mention IDs.
  - `nodes`, `edges`, `add_edge_callback`: the JSON‑LD node and edge collections being built for the markdown graph.

### 1.2 Document profiling and auto‑tuning

- `process_semantics` first profiles the semantic text:
  - Joins all `semantic_sources[*].text` into a single string.
  - Tokenizes with `tokenize_with_offsets`.
  - Estimates:
    - `tokenCount`
    - `sentenceCount` (via `_SENTENCE_SPLIT_RE`)
    - `avgSentenceTokens`
  - Stores these in `semantic_doc_profile`.
- When `sem_defaults["auto_tune_enabled"]` is true:
  - If `avgSentenceTokens > 20`, it decreases `max_syntactic_path_length` by one (down to a minimum of 2).
  - If `avgSentenceTokens < 8`, it increases `max_syntactic_path_length` by one (up to a maximum of 8).
  - It may adjust `phrase_boundary_threshold` using `tuning_sensitivity`.
- This produces **document‑profile‑aware defaults** for:
  - Phrase boundary detection and entity span limits.
  - Path length and edge confidence thresholds for semantic relations.

### 1.3 Entity and mention extraction (TokenLinker layer)

- For each semantic block:
  - Tokens are produced via `tokenize_with_offsets(text)`.
  - Candidate spans are built via `merge_tokens_to_spans(...)` with:
    - `phrase_boundary_threshold`
    - `max_entity_span_tokens`
    - `coreference_distance_limit`
  - Inline code spans are detected via `detect_inline_code_spans(text)`.
  - The spans are merged into `all_spans`.
- For each span in `all_spans`:
  - A `Mention` node is emitted with:
    - `@id`: stable ID derived from `gid`, `blockId`, character range, and text.
    - `@type`: `"Mention"`.
    - `labels`: `["Mention"]`.
    - `properties`:
      - `text`
      - `blockId`, `blockType`
      - `charStart`, `charEnd`
      - `tokenStart`, `tokenEnd`
      - `confidence` (clamped to `[0, 1]`).
    - `metadata`:
      - Inherits `meta` from the source block.
      - `structureType: "Mention"`.
      - `extractionMethod: "token_linking"`.
  - An `Entity` node is created or reused:
    - Grouped by `(entityType, normalizedText)` where:
      - `entityType` is `"Entity"` or `"CodeSpan"` for inline code.
      - `normalizedText` is lower‑cased span text.
    - Uses `ent:<gid>:<hash>` IDs to support within‑document unification.
    - `properties` include:
      - `text`, `normalizedText`, `entityType`.
      - Later augmented with `mentionCount`, `blockFrequency`, and centrality/communities.
    - `metadata`:
      - Inherits block metadata.
      - `structureType: "Entity"`.
      - `extractionMethod: "document_unification"`.
- Edges emitted during token linking:
  - `blockId` → `Mention` via `hasMention` with `confidence`.
  - `Mention` → `blockId` via `mentionOf` with `blockType`.
  - `Mention` → `Entity` via `refersTo` with `confidence`.
  - `Entity` → `Mention` via `hasMention` with `confidence`.
- Outcome:
  - The **entity/mention layer** is a neutral, token‑linked semantic layer that sits on top of markdown structure, with explicit provenance and configurable thresholds.

In addition to TokenLinker‑derived mentions, parsers that surface higher‑level semantic structures may also populate the mention layer. Mermaid frontmatter is intentionally excluded from this path and is treated as visual‑only media; any semantic Entities and Mentions are derived from neutral text‑based layers rather than from diagram syntax. Mermaid‑derived `MermaidNode` and `pointsTo` edges participate in Canvas semantics via schema‑driven layer configuration (for example, `schema.layers.semantic.hiddenNodeTypes`) and layout‑mode‑aware edge selection rather than via any hardcoded template names, file paths, or pipeline labels; see `docs/documents/knowgrph-mermaid-frontmatter-document.md` for the detailed mapping.

### 1.4 Edge elevation (EdgeElevator layer)

- After mentions and entities are created:
  - Mentions are grouped by `blockId` into `mentions_by_block`.
  - For each block with at least two mentions:
    - The block text is split into sentences by `_SENTENCE_SPLIT_RE`.
    - For each sentence:
      - The character span of the sentence in the block text is computed.
      - Mentions fully inside the sentence span are collected and ordered by `charStart`.
      - Entity IDs are deduplicated in order of appearance.
      - If there are fewer than two entities in the sentence, the sentence is skipped.
- For each sentence with at least two entities:
  - `extract_sentence_features` inspects the sentence and returns features such as:
    - `temporalMarker`
    - `modality`
    - `negation`
  - A base confidence is computed:
    - Starts at `0.5`.
    - Boosted if the sentence looks directional (`"->"` or `"→"`).
    - Boosted or penalized based on temporal markers, modality, and negation.
  - The confidence is clamped and compared against:
    - `edge_confidence_threshold`.
    - `max_syntactic_path_length` (used as a cap on entity counts in long sentences).
  - For each ordered pair `(srcEntity, tgtEntity)` that passes thresholds:
    - A `semanticRelation` edge is emitted:
      - `relation: "semanticRelation"`.
      - `properties`:
        - `confidence`
        - `sourceSentence`
        - `temporalMarker`
        - `modality`
        - `negation`
      - `metadata`:
        - Inherits block metadata.
        - `structureType: "Edge"`.
        - `extractionMethod: "edge_elevation"`.
        - `sourceBlockId`.
    - Duplicate semantic relations for the same `(src, tgt, blockId, sentence)` are deduplicated via `seen_semantic_edges`.

### 1.5 Pattern mining and co‑occurrence (coOccursWith layer)

- Once entity/mention and `semanticRelation` edges are built:
  - For each block, the set of entities present in that block is computed.
  - For each block’s entity set, all unordered pairs `(a, b)` of entities are counted into `pair_counts`.
  - Entity frequencies per block are recorded in `entity_block_counts`.
- `_compute_ppmi` derives **pointwise positive mutual information (PPMI)** for all entity pairs:
  - Uses block‑level counts as co‑occurrence evidence.
  - Normalizes by total block count.
- For each pair `(a, b)`:
  - `support` is `count / block_count`.
  - Pairs with support below `min_pattern_support` are skipped.
  - Pairs with non‑positive PPMI are skipped.
  - A similarity score is computed from PPMI via a logistic transform:
    - `similarity = 1 / (1 + exp(-pmi))`.
  - A `coOccursWith` edge is emitted:
    - `relation: "coOccursWith"`.
    - `properties`:
      - `support`
      - `pmi`
      - `similarity`
      - `confidence` (clamped similarity).
    - `metadata`:
      - `structureType: "Edge"`.
      - `extractionMethod: "pattern_mining"`.
      - `blockCount`.

### 1.6 Centrality, communities, and semantic doc profile

- `Entity` node properties are augmented with:
  - `mentionCount`: total mentions across the document.
  - `blockFrequency`: number of distinct blocks in which the entity appears.
- If `sem_defaults["corpus_centrality_algorithm"] == "pagerank"`:
  - A PageRank‑like algorithm runs over the undirected graph formed by:
    - `semanticRelation` edges.
    - `coOccursWith` edges.
  - Each entity’s PageRank is stored as `properties["centrality"]`.
- Communities:
  - A label‑propagation algorithm runs over the `coOccursWith` graph only.
  - Community IDs are stored as `properties["communityId"]`.
- Summary metrics:
  - `semantic_doc_profile["semanticLayer"]` stores:
    - `maxMentionCount`: maximum `mentionCount` across entities.
    - `maxPmi`: maximum PPMI observed on `coOccursWith` edges.

---

## 2. Parser‑emitted layer hints (metadata.layers.semantic)

### 2.1 Graph metadata for markdown graphs

- `graph_builder.parse_markdown_to_graph_jsonld` constructs `doc_metadata` for each markdown graph:
  - Core fields include:
    - `graphId`, `generatedAt`.
    - `agenticRagSchema`, `agenticRagContext`.
    - `layoutMode: "tidy-tree"`.
    - `tidyTree.edgeLabels`: `["hasSection", "hasBlock", "hasItem"]`.
  - Layer hints:
    - `defaultLayer: "semantic"`.
    - `layers.semantic`:
      - `nodeTypes`: `["Entity"]`.
      - `nodeMetrics`: `["mentionCount", "blockFrequency", "centrality"]`.
      - `edgeLabel`: `"coOccursWith"`.
      - `edgeMetric`: `"pmi"`.
      - `communityProperty`: `"communityId"`.
    - `layers.documentStructure`:
      - `nodeTypes`: structural types such as `Document`, `Section`, `Paragraph`, `List`, `ListItem`, `CodeBlock`, `Table`.
      - `edgeLabels`: structural relations such as `hasSection`, `hasBlock`, `hasItem`, `next`, `linksTo`.
    - `layers.property`:
      - `nodePropertyContainer: "properties"`.
      - `edgePropertyContainer: "properties"`.
  - Additional helpers:
    - `suggestedTraversalEdges` includes both structural and semantic labels:
      - `hasSection`, `hasBlock`, `hasItem`, `linksTo`, `next`.
      - `hasMention`, `mentionOf`, `refersTo`, `semanticRelation`, `coOccursWith`.
  - When semantics are enabled, `doc_metadata["semanticConfig"]` is populated with:
    - The resolved `sem_defaults` used by `process_semantics`.

### 2.2 Relationship to semantic_processor outputs

- The `metadata.layers.semantic` contract is intentionally **simple**:
  - It does not list every property used by `semantic_processor`.
  - Instead, it describes how downstream tools should interpret semantic nodes and edges for:
    - Similarity.
    - Centrality.
    - Community detection.
- Mapping:
  - `nodeTypes: ["Entity"]`:
    - Semantic nodes are `Entity` nodes emitted by `process_semantics`.
  - `nodeMetrics: ["mentionCount", "blockFrequency", "centrality"]`:
    - These are populated directly by `process_semantics` on each `Entity.properties`.
  - `edgeLabel: "coOccursWith"`:
    - Similarity edges are the PMI‑weighted `coOccursWith` edges emitted during pattern mining.
  - `edgeMetric: "pmi"`:
    - The primary semantic edge weight is `properties["pmi"]` on `coOccursWith` edges.
  - `communityProperty: "communityId"`:
    - Communities are assigned by label propagation and stored on `Entity.properties["communityId"]`.
- Other semantic edges:
  - `semanticRelation` edges:
    - Capture sentence‑level relations with `confidence`, `sourceSentence`, and temporal/modality/negation markers.
    - Are included in `suggestedTraversalEdges` but not in the primary similarity metric.
  - `hasMention`, `mentionOf`, `refersTo`:
    - Provide provenance links between structure, mentions, and entities.
    - Are available for traversal and inspection but are not treated as similarity edges.

---

## 3. Schema‑config propagation (metadata.layersFromGraph → metadata.layers.semantic)

### 3.1 Schema‑config metadata for markdown graphs

- `build_schema_config_jsonld` reads `graph_jsonld.metadata` and produces schema‑config JSON‑LD:
  - `schema-config.metadata.agenticRagSchema`: mirrors `graph_jsonld.metadata.agenticRagSchema`.
  - `schema-config.metadata.corpusSizePreset`: selected preset key (for example, `"small"`, `"medium"`, `"large"`).
  - `schema-config.metadata.corpusSizePresets`: neutral corpus presets for semantic tuning:
    - `layers.semantic.topKEdgesPerNode`.
    - `layers.semantic.minSimilarity.cosine`.
    - `layers.semantic.minSimilarity.pmi`.
- Layer propagation:
  - `schema-config.metadata.layersFromGraph`:
    - Copy of `graph_jsonld.metadata.layers`.
    - Provides a neutral description of semantic/document‑structure/property layers as emitted by the parser.
  - `schema-config.metadata.defaultLayerFromGraph`:
    - Copy of `graph_jsonld.metadata.defaultLayer`.
  - `schema-config.metadata.layers`:
    - Editable canvas‑facing configuration that starts from the graph hints but can be overridden by curators and UI controls.

### 3.2 Default semantic layer configuration

- The markdown schema‑config template (`schema-config/knowgrph-schema-config-template.jsonld`) initializes:
  - `metadata.layers.semantic`:
    - `textKeys`: fields used for tokenization and similarity computation (for example, `chunk_text`, `text`, `code`, `heading`).
    - `minTokenLength`: minimum token length.
    - `maxTokensPerNode`: safety cap on token counts per node.
    - `stopwords`: neutral stopword list (empty by default).
    - `hiddenNodeTypes`: initial list of node types to hide in semantic mode (often structural types).
    - `similarityMetric`: `"cosine"` by default in the template; actual markdown schema‑configs may default to `"pmi"` to align with `coOccursWith` edges.
    - `similarityEdgeLabel`: `"semanticSimilarity"` in the template; for markdown graphs this is typically updated to `"coOccursWith"` via `layersFromGraph.semantic.edgeLabel`.
    - `topKEdgesPerNode`: default `K` (for example, `4` for medium corpora).
    - `minSimilarity`: default similarity cutoff (for example, `0.2` for cosine, `0.15` for PMI).
    - `communityDetection`: configuration for Louvain‑style community detection.
- Relationship to parser hints:
  - `layersFromGraph.semantic.nodeTypes` informs which node types are treated as semantic nodes.
  - `layersFromGraph.semantic.edgeLabel` informs which edge label carries the primary similarity metric (for example, `"coOccursWith"`).
  - `layersFromGraph.semantic.edgeMetric` informs which property key to treat as the similarity weight (for example, `"pmi"`).
  - `layersFromGraph.semantic.communityProperty` informs which node property carries community IDs.

---

## 4. Canvas configuration (schema.layers.semantic)

### 4.1 Runtime schema layer in the canvas

- The canvas keeps a runtime `schema: GraphSchema` that includes a `layers` object:
  - `layers.mode`:
    - Current layer mode (`"semantic"`, `"document-structure"`, or `"property"`), which map in the UI to “Similarity clusters (semantic)”, “Layered structure (document)”, and “Raw data (schema)” respectively.
  - `layers.semantic`:
    - `similarityMetric`: `"cosine"` or `"pmi"`.
    - `similarityEdgeLabel`: edge label used to construct the semantic similarity graph.
    - `topKEdgesPerNode`: maximum number of similarity edges per node.
    - `minSimilarity`: similarity cutoff for including edges.
    - `hiddenNodeTypes`: node types hidden in semantic mode.
    - `communityDetection`: parameters for community detection.
  - `layers.documentStructure`:
    - Structural node types and edge labels derived from `layersFromGraph.documentStructure`.
  - `layers.property`:
    - Raw property‑driven view derived from `layersFromGraph.property`.

### 4.2 User‑facing controls (AiKgSemanticControls)

- `AiKgSemanticControls` exposes UI controls for `schema.layers.semantic` when `layers.mode === "semantic"`:
  - `schema.layers.semantic.similarityEdgeLabel`:
    - Editable text field.
    - Defaults to `"semanticSimilarity"` or `"coOccursWith"` depending on schema‑config.
    - Used as the primary edge label when constructing the semantic subgraph from GraphData.
  - `schema.layers.semantic.similarityMetric`:
    - Dropdown with `"cosine"` and `"pmi"`.
    - `"pmi"` aligns with the PPMI‑based `coOccursWith` edges emitted by `semantic_processor`.
    - `"cosine"` aligns with embedding‑based similarity computed from tokenized node text in the canvas.
  - `schema.layers.semantic.topKEdgesPerNode`:
    - Numeric input controlling how many similarity edges per node are kept after ranking.
    - Default value derived from `schema-config.metadata.corpusSizePresets`.
  - `schema.layers.semantic.minSimilarity`:
    - Numeric input controlling similarity cutoff.
    - Defaults:
      - For `"cosine"`: higher cutoffs (for example, `0.2` or `0.25`).
      - For `"pmi"`: lower cutoffs (for example, `0.15` or `0.10`).
- These controls update the in‑memory `GraphSchema` and are persisted via schema‑config when saved, without changing parser behavior.

### 4.3 Semantic layer behavior in the canvas

- When `layers.mode === "semantic"`:
  - The canvas builds a **semantic subgraph** using:
    - Nodes whose types match `schema.metadata.layers.semantic.nodeTypes` (for example, `["Entity"]`).
    - Edges whose label matches `schema.layers.semantic.similarityEdgeLabel`.
    - Edge weights taken from:
      - `pmi` when `similarityMetric === "pmi"`.
      - Embedding‑based similarity when `similarityMetric === "cosine"`.
  - Edges are filtered and ranked:
    - Edges below `minSimilarity` are dropped.
    - Remaining edges are sorted per node and truncated to `topKEdgesPerNode`.
  - Node visibility:
    - Node types listed in `schema.layers.semantic.hiddenNodeTypes` are hidden in semantic mode.
    - Structural types (for example, `Document`, `Section`) are often hidden to emphasize `Entity` nodes.
- Additional semantic information:
  - Centrality and community properties attached by `semantic_processor` are exposed in stats panels and tooltips.
  - Provenance edges (`hasMention`, `mentionOf`, `refersTo`) remain available in the underlying graph for drill‑down views and traversal tools.

---

## 5. End‑to‑end mental model (markdown → semantics → canvas)

1. **Markdown parsing** (`graph_builder`):
   - Splits markdown into structural blocks.
   - Fills `semantic_sources` with block‑level text segments and metadata.
2. **Semantic processing** (`semantic_processor`):
   - Profiles the document and adapts thresholds (`sem_defaults`).
   - Extracts mentions and entities with token‑level provenance.
   - Elevates sentence‑level relations into `semanticRelation` edges with confidence and temporal/modality/negation markers.
   - Mines block‑level co‑occurrences into `coOccursWith` edges with PPMI‑derived similarity.
   - Computes entity‑level metrics: mention counts, block frequencies, centrality, communities.
   - Returns a `semantic_doc_profile` with summary metrics.
3. **Graph metadata** (`graph_builder`):
   - Writes `metadata.layers.semantic` to describe:
     - Semantic node types, metrics, similarity edge label, edge metric, and community property.
   - Stores the effective `semanticConfig` used for extraction.
4. **Schema‑config generation** (`build_schema_config_jsonld`):
   - Copies parser hints into `metadata.layersFromGraph`.
   - Initializes editable `metadata.layers.semantic` with:
     - Corpus‑size‑aware defaults.
     - Layer configuration consistent with parser hints.
5. **Canvas rendering**:
   - Loads schema‑config and graph JSON‑LD.
   - Uses `schema.layers.semantic` to derive:
     - Semantic subgraph (nodes, edges, weights).
     - Top‑K pruning and similarity thresholds.
     - Hidden node types and community detection parameters.
   - Exposes controls in `AiKgSemanticControls` so users can adjust similarity behavior without touching parser code.

This alignment ensures that the semantic layer remains:

- **Parser‑driven**: semantic structures (entities, relations, co‑occurrences) originate from `semantic_processor`.
- **Schema‑described**: semantics are summarized in `metadata.layers` and propagated into schema‑config.
- **Canvas‑configurable**: similarity metrics, edge labels, thresholds, and visibility rules are controlled by `schema.layers.semantic` and UI settings, not by hardcoded dataset logic.
