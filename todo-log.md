
## 2026-01-22

### GraphRAG Pipeline Enhancement & Refactoring
- **Refactored `textAnalysis.ts`**:
  - Implemented `extractCooccurrencePairs` to centralize co-occurrence logic.
  - Added `extractRichProperties` for temporal, modality, negation, and causalityStrength detection.
  - Enhanced `extractTriplesHeuristic` to capture rich properties in triples.
  - Exported `normalizeEntityKey` for reuse.
- **Refactored `keywordGraph.ts`**:
  - Removed duplicated extraction logic; now consumes `textAnalysis.ts` primitives.
  - Maintained specific graph construction logic (PPMI, PageRank) but cleaner.
- **Refactored `EdgeElevator.ts`**:
  - Removed duplicated "simple heuristic" extraction; now uses `extractTriplesHeuristic`.
- **Updated `graphragTextPipeline.ts`**:
  - Ensured graph edges now carry `properties` (confidence, temporal, modality, negation, causalityStrength).
  - Added node roles as `Subject` / `Object` / `Entity` and exposed counts for reasoning.
  - Added `visual:layer` and `visual:community` assignments for layered subgraphs.
- **Updated `graphrag-pipeline-demo.tsx`**:
  - **REMOVED HARDCODED STEPS**.
  - Now uses `runGraphRagTextPipeline` dynamically to generate visualization data.
  - Achieved 100% fidelity with actual pipeline execution.
- **Cleanup**:
  - Removed legacy unused file-input workflow import hook from toolbar menu launcher.
  - Replaced corrupted AIE book demo test file with a re-export to canonical demo component.
- **Verification**:
  - `npm run check` passes.
  - Lint passes (warnings only).
  - Targeted CI tests pass (`graphrag`, `keyword`, `agentic` filters).
- **Documentation**:
  - Updated `knowgrph-graphrag-pipeline-in-action-prd-tad.md` status to "Implemented (Enhanced v1.1)".
  - Updated `graphrag-pipeline.jsonld` schema description.

### Rich Semantic Pipeline v2 (Entity→Relation→Metadata→Cluster)
- **Import→Parser pipeline cleanup**:
  - Added shared import UI updater to remove duplicated status/bookkeeping across toolbar import actions.
  - Fixed parser matching for URL imports to avoid Markdown forcing non-markdown text.
- **GraphRAG Text pipeline analytics**:
  - Nodes now include keyword frequency + centrality-derived importance (`visual:importance`, `visual:nodeSize`).
  - Edges now include strength + causality signals and render widths (`strength:*`, `causality:*`, `visual:width`).
  - Communities now derived via density-based clustering (DBSCAN) and assigned as `visual:community`/`visual:layer`.
- **New reusable utilities**:
  - `association.ts` (PPMI + edge width derivation)
  - `graphMetrics.ts` (bounded graph metrics + betweenness)
  - `densityClustering.ts` (bounded DBSCAN)
- **Verification (bounded)**:
  - `npm --prefix canvas run check` passes.
  - Targeted CI filter `graphrag` passes.
