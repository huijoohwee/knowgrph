# Knowgrph Tokens Documentation

Aligned with:
- [Stats Documentation](knowgrph-stats-document.md)
- [Visualization Documentation](knowgrph-visualization-document.md)
- AgenticRAG neutrality constraints (`schema/AgenticRAG/neutrality.jsonld`)

This document describes how Knowgrph derives token frequencies for semantic overlays and Stats tab distributions. The pipeline is schema-driven, domain-agnostic, and shared across features so UI charts and AgenticRAG workflows stay consistent.

---

## Tokenization Inputs

- Text sources per node:
  - `node.label`
  - Optional additional fields from `schema.layers.semantic.textKeys` (string properties only)
- Token splitting and normalization:
  - Lowercase normalization
  - Split on `[^a-z0-9_]+` (keeps alphanumerics and underscores)
  - Drop tokens shorter than `schema.layers.semantic.minTokenLength` (default `3`)

---

## Stopwords and In-Session Overrides

- Base stopwords come from `schema.layers.semantic.stopwords` and are normalized to lowercase.
- The Stats tab adds in-session overrides that affect all Stats token computations:
  - **Exclude words** mode: tokens can be marked as excluded (tracked in `statsExcludeTokens`) and are added to the effective stopword set. In tickbox lists, checked means “keep this token”; unchecked means “exclude this token”.
  - **Include words** mode: tokens can be marked as included (tracked in `statsIncludeTokens`), which removes them from the effective stopword set. When the include list is non-empty it also acts as a whitelist (only included tokens are counted).
  - Token tickbox lists include a **Select all** checkbox that is checked by default; unchecking it unselects all tokens (exclude everything) in Exclude mode, and clears all includes in Include mode.
- Effective tokenization config is produced by:
  - `getStatsTokenizationConfig` in [BottomPanelStatsUtils.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/BottomPanel/BottomPanelStatsUtils.ts#L36-L52)
  - Stats tab override logic in [BottomPanelStatsTab.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/BottomPanel/BottomPanelStatsTab.tsx#L214-L244)

---

## Counting and Limits

- Frequency computation is performed by `buildTokenFrequenciesForNodes` in [BottomPanelStatsUtils.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/BottomPanel/BottomPanelStatsUtils.ts#L54-L88):
  - Concatenates `label` plus configured `textKeys`
  - Tokenizes using the effective stopword set and `minTokenLength`
  - Applies `schema.layers.semantic.maxTokensPerNode` (default `2000`) as a per-node cap
  - Returns `totalTokens` and a `freqByToken` map
- Ranked token lists use `topTokenList` in [BottomPanelStatsUtils.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/BottomPanel/BottomPanelStatsUtils.ts#L90-L101), sorting by descending count then token alphabetically.

---

## Where Token Frequencies Are Used

- Stats tab distributions (selection-aware, scope-controlled):
  - **Word frequencies by polygon**: per polygon group token counts and per-polygon top-token drilldowns.
  - **Communities (Louvain)**: per community token summaries used for names/descriptions and per-community top-token drilldowns.
  - **Edges (similarity/co-occurrence)**: endpoint token summaries for the selected/pinned semantic edge.
  - **Word frequencies by node**: token chips for selected node(s).
- Semantic layer derivation:
  - Semantic mode reuses `schema.layers.semantic.*` (including `textKeys`, `minTokenLength`, `stopwords`) so similarity edges and Stats token charts remain consistent and explainable.
