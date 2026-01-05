# Semantic layer mode and controls

This document explains how semantic layer mode works in a neutral, dataset-agnostic way and how the `schema.layers` configuration controls each step. It mirrors the implementation in [`layerDerivation.ts`](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/lib/graph/layerDerivation.ts) and the default configuration shipped in [`defaultSchema`](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/lib/graph/schema.ts).

The goal is to provide a line-by-line mental model of how semantic communities, edges, and visual attributes are derived without relying on any particular dataset or file path.

## High-level switch: `schema.layers.mode`

- `schema.layers.mode` chooses the active grouping strategy:
  - `property` keeps GraphData unchanged and relies on array-valued node properties for grouping.
  - `document-structure` derives groups from node types (such as structural roles) while leaving GraphData as-is.
  - `semantic` runs the semantic derivation pipeline over the current GraphData to add derived similarity edges and visual properties.
- When `schema.layers.mode !== 'semantic'`, the semantic derivation code returns the original `GraphData` unchanged. No additional edges, importance scores, or communities are computed.

## Configuration surface: `schema.layers.semantic.*`

Semantic mode reads configuration from `schema.layers.semantic`:

- `similarityEdgeLabel` defines the label used for derived semantic similarity edges.
- `similarityMetric` selects how similarity scores are computed:
  - `cosine` interprets scores as cosine similarity over token-count vectors.
  - `pmi` interprets scores as pointwise mutual information (PMI) over token co-occurrence.
- `topKEdgesPerNode` controls how many strongest neighbors each node keeps after scoring.
- `minSimilarity` sets a non-negative global threshold; neighbors below this score are dropped.
- `textKeys` (optional array) lists additional node property keys whose string values are concatenated with the node label to form the text used for tokenization.
- `minTokenLength`, `maxTokensPerNode`, and `stopwords` control tokenization limits and filtering.
- `communityDetection.enabled`, `communityDetection.resolution`, `communityDetection.maxPasses`, and `communityDetection.maxMovesPerPass` configure Louvain-style community detection over the semantic similarity graph.

All of these controls are surfaced, in configuration form, under `schema.layers.semantic.*` and, in UI form, in the Renderer settings and AI-KG Layers section. They are designed to be domain-agnostic and dataset-agnostic.

## Step 1: Mode check and configuration lookup

1. The derivation function inspects `schema.layers.mode`. If it is not `semantic`, it returns the input `GraphData` unchanged.
2. When mode is `semantic`, the code reads `schema.layers.semantic.*` values, applying defaults:
   - `similarityMetric` defaults to `cosine` unless explicitly set to `pmi`.
   - `topKEdgesPerNode` defaults to 3 if unspecified or invalid, but allows zero for "keep all above threshold".
   - `minSimilarity` defaults to a metric-aware baseline (`≈0.2` for cosine, `≈0.15` for PMI) when not set, but always clamps to a non-negative value.
   - Tokenization and community-detection parameters are clamped to safe numeric ranges so behavior remains stable across datasets.

## Step 2: Tokenization and per-node vectors

1. For each node, a text buffer is constructed by:
   - Starting from the node label.
   - Concatenating string values of any properties named in `schema.layers.semantic.textKeys`.
2. The combined text is normalized to lower case and split on non-alphanumeric separators to form raw tokens.
3. Tokens shorter than `minTokenLength` characters, or present in the configured `stopwords` set (case-insensitive), are discarded.
4. If `maxTokensPerNode` is positive, the token list is truncated to that length; otherwise all tokens are kept.
5. For the remaining tokens, the implementation counts frequencies per token and computes:
   - `totalTokens`: the number of tokens assigned to the node.
   - A frequency map `freqByToken`.
   - A Euclidean norm `norm = sqrt(sum(count²))` for the frequency vector.

These per-node statistics are stored in memory as token-count vectors and norms; no dataset-specific assumptions are made about labels.

## Step 3: Inverted index and pair statistics

1. An inverted index maps each token to a list of `(nodeId, count)` entries.
2. The derivation walks each token’s list when it has at least two nodes and, for each distinct node pair, updates:
   - A dot-product accumulator for cosine similarity.
   - A shared-token-count accumulator for PMI and edge-width computation.
3. A `totalTokens` counter accumulates all node `totalTokens` to support PMI without referencing any external corpus.

The result is two maps keyed by unordered node pairs:

- One for dot products.
- One for shared-token counts.

## Step 4: Similarity scoring (cosine or PMI)

For each node pair with non-zero statistics:

- If `similarityMetric === 'cosine'`:
  - Retrieve the per-node norms.
  - Skip pairs where either norm is zero.
  - Compute `sim = dot / (normA * normB)`.
  - Discard non-positive or non-finite similarity scores.
- If `similarityMetric === 'pmi'`:
  - Compute token-based probabilities:
    - `pᵢ = totalTokens(node i) / totalTokens(all nodes)`.
    - `pⱼ = totalTokens(node j) / totalTokens(all nodes)`.
    - `pᵢⱼ = sharedTokenCount(i,j) / totalTokens(all nodes)`.
  - Skip pairs where any probability is non-positive.
  - Compute `score = log₂(pᵢⱼ / (pᵢ · pⱼ))`.
  - Clamp negative scores to zero and discard non-positive or non-finite values.

The surviving scores are stored as `similarityByPair` and remain independent of any particular label vocabulary or domain.

## Step 5: Top-K neighbor selection and thresholding

1. For each node, collect neighbor candidates and their similarity scores from `similarityByPair`.
2. Sort neighbors by descending similarity (breaking ties by neighbor id for stability).
3. Optionally truncate to a small multiple of `topKEdgesPerNode` to bound work.
4. Iterate sorted candidates, keeping neighbors while:
   - The count of kept neighbors per node remains below `topKEdgesPerNode` (unless `topKEdgesPerNode` is zero, which means no per-node cap).
   - The similarity score is at or above `minSimilarity`.
5. For each accepted neighbor, record an undirected pair keyed by the sorted `(a,b)` node ids.

This step enforces both sparsity (`topKEdgesPerNode`) and a global strength cutoff (`minSimilarity`) without prescribing any dataset-specific values.

## Step 6: Semantic edge construction

1. For each accepted node pair, the code:
   - Retrieves the similarity score from `similarityByPair`.
   - Retrieves the shared-token count from the co-occurrence map (defaulting to zero if absent).
2. It then computes:
   - A width value as a clamped function of the square root of the shared-token count, ensuring widths stay in a bounded numeric range.
3. A derived semantic edge is created with:
   - `source` and `target` set to the node ids.
   - `label` set to `schema.layers.semantic.similarityEdgeLabel`.
   - `properties` containing:
     - `weight` (the similarity score).
     - `count` (the shared-token count).
     - `width` and `visual:width` (the clamped width).
     - `visual:weight` (the similarity score).
   - `metadata` marking the edge as a derived semantic edge.

These edges are added alongside existing edges, and all numeric logic remains generic.

## Step 7: Community detection over similarity graph

When `schema.layers.semantic.communityDetection.enabled` is not explicitly set to `false`, and the resulting similarity graph has positive total edge weight:

1. A weighted adjacency list and per-node degree map are constructed from the semantic edges.
2. Each node starts in its own community, and community totals are initialized from degrees.
3. For each pass (up to `communityDetection.maxPasses`), and each node (up to `communityDetection.maxMovesPerPass` moves per pass):
   - The algorithm considers moving the node into each neighboring community.
   - It computes a modularity-gain-like score using the configured `resolution` parameter and per-community totals.
   - If moving into a neighbor community yields positive gain above a small tolerance, the node is reassigned.
4. Passes stop when no moves occur or the pass limit is reached.
5. Community ids are then remapped into a compact integer range so they can be used as stable indices for colors.

This is a Louvain-style heuristic that depends only on edge weights and configuration values, not on domain semantics.

## Step 7b: Semantic community polygons (2D/3D)

When polygon layers are enabled, the canvas can render convex-hull polygons for semantic communities using the community ids assigned in Step 7. The polygon grouping logic lives in [`polygons.ts`](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/polygons.ts) and intentionally excludes JSON-LD structural block types (for example `Document`, `Section`, `Paragraph`, `CodeBlock`, `Table`, `List`, and `ListItem`) from semantic community grouping so semantic polygons represent “meaning / word frequency” clusters rather than document scaffolding.

## Step 8: Node importance and visual attributes

For each node:

1. The code retrieves:
   - The per-node token count (from tokenization).
   - The sum of incident similarity weights (from semantic edges).
2. It derives an importance value by preferring the token count when available, otherwise falling back to the weight sum.
3. It maps this importance value into a clamped numeric band and stores:
   - `visual:importance` as the raw importance score.
   - `visual:nodeSize` as a radius-like value suitable for rendering.
4. If a community id is available from the Louvain step, it also assigns:
   - `visual:community` as the integer community id.
   - `visual:fill` as a deterministic color computed from the community id via a hue-based function. Renderer surfaces keep base node fill colors driven by `schema.nodeStyles` across `property`, `document-structure`, and `semantic` layer modes so the node/edge palette stays consistent when toggling modes; `visual:fill` is reserved for semantic overlays such as community polygons or specialized views rather than replacing the core palette.

These attributes are attached to node properties only; they do not change ids or structural relationships.

## Step 9: GraphData update and cleanup

Finally, the derivation:

1. Filters out any edges whose metadata marks them as previously derived, so semantic edges are recalculated cleanly.
2. Concatenates the filtered original edges with the newly constructed semantic edges.
3. Returns a new `GraphData` object with:
   - The original nodes, augmented with visual semantic properties.
   - The original non-derived edges.
   - The derived semantic similarity edges under the configured label.

## UI and configuration alignment

- The AI-KG Layers section and Renderer settings expose the semantic controls as schema-driven fields:
  - `schema.layers.mode` is available as a mode selector.
  - `schema.layers.semantic.similarityEdgeLabel`, `similarityMetric`, `topKEdgesPerNode`, and `minSimilarity` are exposed as neutral inputs with Role → Actions → Outcome and numeric tooltips backed by `rag:RoleActionOutcome` fixtures in `schema-config/knowgrph-universal-schema-config.jsonld`.
- The AgenticRAG schema context and fixtures in `schema-config/knowgrph-universal-schema-config.jsonld` describe the same configuration surface and algorithm steps in a machine-readable way so tooling can align offline workflows with the UI.
- The Graph Fields panel header also exposes `schema.layers.mode` so layer mode can be toggled without leaving schema/field workflows.

Together, these pieces ensure that semantic layer behavior is:

- Neutral and domain-agnostic.
- Driven entirely by `schema.layers.semantic.*` configuration.
- Explainable at the level of tokenization, similarity scoring, sparsity, community detection, and visual mapping.
