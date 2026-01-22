
## 2026-01-22

### GraphRAG Pipeline Enhancement & Refactoring
- **Refactored `textAnalysis.ts`**:
  - Implemented `extractCooccurrencePairs` to centralize co-occurrence logic.
  - Added `extractRichProperties` for temporal, modality, negation, and causality detection.
  - Enhanced `extractTriplesHeuristic` to capture rich properties in triples.
  - Exported `normalizeEntityKey` for reuse.
- **Refactored `keywordGraph.ts`**:
  - Removed duplicated extraction logic; now consumes `textAnalysis.ts` primitives.
  - Maintained specific graph construction logic (PPMI, PageRank) but cleaner.
- **Refactored `EdgeElevator.ts`**:
  - Removed duplicated "simple heuristic" extraction; now uses `extractTriplesHeuristic`.
- **Updated `graphragTextPipeline.ts`**:
  - Ensured graph edges now carry `properties` (confidence, temporal, modality, etc.).
- **Updated `graphrag-pipeline-demo.tsx`**:
  - **REMOVED HARDCODED STEPS**.
  - Now uses `runGraphRagTextPipeline` dynamically to generate visualization data.
  - Achieved 100% fidelity with actual pipeline execution.
- **Documentation**:
  - Updated `knowgrph-graphrag-pipeline-in-action-prd-tad.md` status to "Implemented (Enhanced v1.1)".
  - Updated `graphrag-pipeline.jsonld` schema description.
