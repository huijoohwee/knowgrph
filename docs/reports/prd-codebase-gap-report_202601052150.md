# PRD–Codebase Gap Report: Markdown-to-Rendering Pipeline

- Report ID: `prd-codebase-gap-report_202601052150`
- Repo: `/Users/huijoohwee/Documents/GitHub/knowgrph`
- PRD / Guidelines Baseline: [knowgrph-pipeline-guidelines.md](https://huijoohwee.github.io/guidelines/knowgrph-pipeline-guidelines.md)
- Scope: End-to-end automated, integrated markdown-to-rendering pipeline (excluding code under `/docs` for “current module” mapping)

---

## Executive Summary

**Expected (PRD/guidelines)**: A semantic, corpus-scale GraphRAG pipeline with token linking → edge elevation (confidence + properties) → adaptive threshold tuning → cross-document unification → feedback loops → corpus reasoning → agentic query planning.

**Actual (codebase)**: A practical markdown-to-graph *structural* pipeline plus a UI markdown renderer:
- **Offline/CLI** (`knowgrph_parser`): parses a single markdown file into JSON-LD graph + schema config + orchestrator YAML + generated summary markdown, with provenance line ranges and “next/hasSection/hasBlock” structure edges.
- **Interactive/UI** (`canvas`): renders markdown using `marked`, supports MDX in presentation mode, resolves relative links to local files via Vite `/@fs`, and can (dev-only) trigger the markdown pipeline then load its generated artifacts into the app.

**Gap headline**: The codebase delivers an end-to-end *markdown→graph→UI load→render* workflow, but it does **not** implement the guideline’s semantic layers (TokenLinker/EdgeElevator/ThresholdTuner/DocumentUnifier/FeedbackOrchestrator/CorpusReasoner/AgenticQueryEngine). Those capabilities are currently **missing** (or only indirectly represented via UI traversal and schema/config scaffolding).

---

## Current State (End-to-End Trace, Excluding `/docs`)

### A) Automated markdown pipeline execution (dev server hook)

1) Canvas constructs the markdown pipeline command text and artifacts paths:
- Command text and output locations are centralized in [tooltips.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/lib/config-copy/tooltips.ts#L479-L507) as:
  - `CODEBASE_INDEX_PIPELINE_COMMAND`
  - `CODEBASE_INDEX_PIPELINE_*_REL_PATH`

2) In dev mode, Canvas can trigger the pipeline over HTTP:
- Vite dev server registers a POST endpoint `/__run_markdown_pipeline` and executes the command via `spawn(...)` in [vite.config.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/vite.config.ts#L13-L62).
- Canvas exposes a dev-only `window.knowgrphRunMarkdownPipeline()` helper and calls it inside `runMarkdownPipelineAndLoadArtifacts()` in [workflowJsonLdActions.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/panels/hooks/workflowJsonLdActions.ts#L351-L509).

3) After (optionally) running the pipeline, Canvas loads the generated artifacts from disk:
- `runMarkdownPipelineAndLoadArtifacts()` fetches graph/schema/orchestrator texts via `/@fs...` URLs built by `buildFsUrlForRelPath(...)` in [workflowJsonLdActions.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/panels/hooks/workflowJsonLdActions.ts#L377-L509).
- It then:
  - Loads graph data via `loadGraphDataFromTextViaParser(...)` (same file).
  - Parses and sets schema via `parseSchemaText(...)` then `store.setSchema(...)`.
  - Imports orchestrator workflow via `importGraphRagWorkflowFromText(...)`.

### B) Offline markdown → JSON-LD graph generation (Python CLI)

1) CLI entrypoint dispatches `python -m knowgrph_parser markdown ...` to `markdown_cmd` in [cli.py](file:///Users/huijoohwee/Documents/GitHub/knowgrph/knowgrph_parser/cli.py#L17-L45).

2) `markdown_cmd` generates four artifacts in one run:
- Graph JSON-LD: `parse_markdown_to_graph_jsonld(...)` in [markdown_cmd.py](file:///Users/huijoohwee/Documents/GitHub/knowgrph/knowgrph_parser/markdown_cmd.py#L57-L69)
- Schema JSON-LD: `build_schema_config_jsonld(...)` (called from `markdown_cmd.py`)
- Orchestrator YAML: `build_orchestrator_config_yaml(...)` (called from `markdown_cmd.py`)
- Generated markdown doc summary: `build_knowgrph_doc_markdown(...)` (called from `markdown_cmd.py`)

3) Structural markdown parsing and provenance:
- `parse_markdown_text_to_graph_jsonld(...)` in [markdown_graph.py](file:///Users/huijoohwee/Documents/GitHub/knowgrph/knowgrph_parser/markdown_graph.py#L38-L353)
  - Creates `Document`, `Section`, `Paragraph`, `CodeBlock`, `Table`, `List`, `ListItem`, `Link` nodes.
  - Adds edges: `hasSection`, `hasBlock`, `hasItem`, `linksTo`, `next`.
  - Adds provenance metadata: `lineStart`, `lineEnd`, `sourcePath`, `sourceUri`, `codebaseRelPath`, `codebasePath` fragment ranges.
- Block extraction is a custom markdown block splitter in [markdown_blocks.py](file:///Users/huijoohwee/Documents/GitHub/knowgrph/knowgrph_parser/markdown_blocks.py#L42-L167).

### C) In-app markdown rendering (React)

1) Markdown lexing:
- Tokenizes markdown via `marked.lexer` and annotates token line ranges in [markdownPreviewLex.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/markdown/ui/markdownPreviewLex.ts#L44-L63).

2) Rendering:
- Uses `MarkdownTokenRenderer` to render tokens with highlight ranges and safe link/media handling: [MarkdownTokenRenderer.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/markdown/ui/MarkdownTokenRenderer.tsx).
- The preview surface supports a presentation mode with slide splitting and optional MDX evaluation: [MarkdownPreview.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/markdown/ui/MarkdownPreview.tsx#L95-L518).

3) Safe link resolution + local file access:
- Resolves relative links against the active document path and maps repo-relative paths to Vite `/@fs` URLs: [markdownPreviewLinks.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/markdown/ui/markdownPreviewLinks.tsx#L47-L63).
- Renders selected HTML blocks via `DOMParser` with a small safe subset (a/img/video/iframe/etc) and iframe sandboxing: [markdownPreviewLinks.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/markdown/ui/markdownPreviewLinks.tsx#L118-L241).

---

## Gap Classification Matrix

| Feature | PRD Section | Current Module (non-`/docs`) | Gap Type | Severity | Impact Dimension | Effort | Dependencies | Priority |
|---------|-------------|------------------------------|----------|----------|------------------|--------|--------------|----------|
| Token linking (phrase/entity spans) | Guidelines: Layer 1 | `knowgrph_parser/markdown_graph.py` | missing | high | accuracy | 13 SP | none | P0 |
| Edge elevation w/ confidence + properties | Guidelines: Layer 2 | `knowgrph_parser/markdown_graph.py` | missing | high | accuracy | 13 SP | gap-001 | P0 |
| Adaptive threshold tuning per document | Guidelines: Layer 3 | `knowgrph_parser/*` | missing | medium | maintainability | 8 SP | gap-001, gap-002 | P1 |
| Cross-document unification | Guidelines: Layer 4 | `knowgrph_parser/*` | missing | high | accuracy | 13 SP | gap-001, gap-002 | P0 |
| Feedback loops + quality metrics → recalibration | Guidelines: Layer 5 | `knowgrph_parser/*`, `canvas/*` | missing | medium | maintainability | 8 SP | gap-003, gap-004 | P1 |
| Corpus reasoning (pattern mining, centrality) | Guidelines: Layer 6 | `canvas/src/lib/graph/*` | partial | medium | user_experience | 8 SP | gap-004 | P1 |
| Agentic query engine (intent→traversal→synthesis) | Guidelines: Layer 7 | `canvas/src/features/panels/*` | partial | high | user_experience | 13 SP | gap-004, gap-005 | P0 |
| Provenance duality (structure types + line ranges) | Guidelines: Axiom | `knowgrph_parser/markdown_graph.py`, `canvas/src/features/markdown/*` | partial | medium | maintainability | 3 SP | none | P1 |
| Zero hardcoding across pipeline components | Guidelines: Axiom | `knowgrph_parser/pipeline_cmd.py` | misaligned | high | maintainability | 5 SP | none | P0 |

---

## Requirement–Codebase Mapping (One-Row-One-Gap)

### Feature: Token Linking (Phrase-Level Semantics)

```yaml
gap-001:
  requirement: TokenLinker performs phrase boundary detection, entity span identification, and token-level provenance.
  current_state: markdown parsing emits structural nodes (Document/Section/Paragraph/etc) with line ranges, but does not build entity spans from token sequences.
  gap_type: missing
  severity: high
  impact: user_experience
  effort: 13 SP
  dependencies: []
  risk: Without entity spans, downstream retrieval and reasoning collapse to structural traversal and keywords only.
```

Evidence:
- Structural parsing exists in [markdown_graph.py](file:///Users/huijoohwee/Documents/GitHub/knowgrph/knowgrph_parser/markdown_graph.py#L38-L353).
- UI tokenization exists (for rendering/highlighting) in [markdownPreviewLex.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/markdown/ui/markdownPreviewLex.ts#L44-L63), but it does not emit entity nodes/edges into GraphData.

### Feature: Edge Elevation (Relationships + Confidence + Properties)

```yaml
gap-002:
  requirement: EdgeElevator extracts relationships, assigns confidence, and attaches properties (temporal/modality/negation/etc).
  current_state: edges are structural (hasSection/hasBlock/next/linksTo) without confidence scoring or linguistic relation extraction.
  gap_type: missing
  severity: high
  impact: accuracy
  effort: 13 SP
  dependencies: [gap-001]
  risk: Graph edges cannot support semantic queries; traversal behaves like document outline navigation rather than knowledge extraction.
```

Evidence:
- Edge creation in [markdown_graph.py](file:///Users/huijoohwee/Documents/GitHub/knowgrph/knowgrph_parser/markdown_graph.py#L138-L321) is limited to structural relations.

### Feature: Threshold Tuning (Adaptive Boundary Calibration)

```yaml
gap-003:
  requirement: ThresholdTuner adapts extraction thresholds per document profile and feedback metrics.
  current_state: No extraction thresholds exist for semantic entities/edges because those components are absent.
  gap_type: missing
  severity: medium
  impact: maintainability
  effort: 8 SP
  dependencies: [gap-001, gap-002]
  risk: Future semantic extraction will be brittle or overfit without an explicit adaptive tuning surface.
```

### Feature: Document Unification (Cross-Document Fusion)

```yaml
gap-004:
  requirement: DocumentUnifier merges entities across documents and resolves conflicts with provenance.
  current_state: The markdown pipeline operates on a single markdown input per run; no cross-document entity registry exists.
  gap_type: missing
  severity: high
  impact: accuracy
  effort: 13 SP
  dependencies: [gap-001, gap-002]
  risk: Corpus-scale reasoning cannot emerge without unification; duplicate entities and conflicting facts remain disconnected.
```

### Feature: Feedback Loops (Quality-Driven Refinement)

```yaml
gap-005:
  requirement: FeedbackOrchestrator computes quality metrics and recalibrates components iteratively.
  current_state: Pipeline produces artifacts and the UI can load them, but no metric collection or automatic recalibration loop exists.
  gap_type: missing
  severity: medium
  impact: maintainability
  effort: 8 SP
  dependencies: [gap-003, gap-004]
  risk: Quality drift is undetected; regressions cannot self-correct and require manual tuning and debugging.
```

### Feature: Corpus Reasoning (Multi-Document Intelligence)

```yaml
gap-006:
  requirement: CorpusReasoner mines patterns, infers emergent relationships, computes centrality.
  current_state: Canvas supports graph traversal and stats panels, but does not implement corpus-level pattern mining over unified multi-doc graphs.
  gap_type: partial
  severity: medium
  impact: user_experience
  effort: 8 SP
  dependencies: [gap-004]
  risk: Users can explore loaded graphs but cannot discover corpus-scale emergent structure or ranked influence.
```

### Feature: Agentic GraphRAG (Query Understanding → Traversal → Synthesis)

```yaml
gap-007:
  requirement: AgenticQueryEngine classifies intent, plans traversal, retrieves provenance-linked chunks, synthesizes answers with citations.
  current_state: UI can execute traversal-like workflows and show provenance fields, but there is no intent classifier or synthesis layer tied to the markdown-derived graph.
  gap_type: partial
  severity: high
  impact: user_experience
  effort: 13 SP
  dependencies: [gap-004, gap-005]
  risk: “Agentic GraphRAG” remains a UI/config concept rather than an executable query planner with grounded synthesis.
```

### Feature: Provenance Duality (Bidirectional Links + Structure Types)

```yaml
gap-008:
  requirement: Maintain bidirectional links between semantic primitives and source structure types with line ranges.
  current_state: Structural nodes include lineStart/lineEnd and codebasePath fragments; UI token renderer computes line ranges and highlights selections. However, semantic primitives (entities/relations) are not present, so duality is limited to structure blocks.
  gap_type: partial
  severity: medium
  impact: maintainability
  effort: 3 SP
  dependencies: []
  risk: When semantic entities are added, provenance semantics may diverge unless unified provenance contracts are introduced early.
```

Evidence:
- Python provenance fields in [markdown_graph.py](file:///Users/huijoohwee/Documents/GitHub/knowgrph/knowgrph_parser/markdown_graph.py#L91-L111).
- UI line-range derivation in [markdownPreviewLex.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/markdown/ui/markdownPreviewLex.ts#L18-L63).

### Feature: Zero Hardcoding (Domain Blindness)

```yaml
gap-009:
  requirement: No domain vocabularies or project-specific constants embedded in pipeline components.
  current_state: Some pipeline utilities contain dataset/project-specific defaults (example IRI bases, sample predicates). These are not wired into the markdown pipeline path directly, but they exist in the repository and violate the guideline.
  gap_type: misaligned
  severity: high
  impact: maintainability
  effort: 5 SP
  dependencies: []
  risk: Hardcoded vocab/predicates create hidden coupling and reduce portability of pipeline building blocks.
```

Evidence:
- Example hardcoded vocab and predicate mapping in [pipeline_cmd.py](file:///Users/huijoohwee/Documents/GitHub/knowgrph/knowgrph_parser/pipeline_cmd.py#L143-L180) and [pipeline_cmd.py](file:///Users/huijoohwee/Documents/GitHub/knowgrph/knowgrph_parser/pipeline_cmd.py#L125-L140).

---

## Prioritized Roadmap (Incremental Closure Strategy)

### Phase: Foundation (Make semantic surfaces pluggable)

```yaml
phase-1-foundation:
  goals: [introduce entity-and-relation extraction interfaces, unify provenance contract, remove hardcoded vocab defaults]
  gap_closures: [gap-009, gap-008]
  duration: 1-2 weeks
  success_criteria: [provenance fields standardized across nodes/edges, no hardcoded vocab in pipeline utilities]
  acceptance_tests: [canvas/src/__tests__/helpPipelineCopy.test.ts, canvas/src/__tests__/graphragParse.test.ts]
  rollback_plan: [keep structural pipeline as default, gate new semantics behind config flag]
```

### Phase: Core Semantics (TokenLinker + EdgeElevator MVP)

```yaml
phase-2-core-semantics:
  goals: [entity span extraction, relation extraction, confidence fields, configurable thresholds]
  gap_closures: [gap-001, gap-002, gap-003]
  duration: 2-4 weeks
  success_criteria: [entities and semantic edges emitted with confidence+provenance, thresholds configurable]
  acceptance_tests: [add unit tests for entity extraction, edge confidence invariants, schema validation]
  rollback_plan: [fallback to structural-only mode when extraction fails]
```

### Phase: Corpus Intelligence (Unification + Reasoning + Feedback)

```yaml
phase-3-corpus-intelligence:
  goals: [multi-doc ingestion, unification registry, metrics+feedback loop, corpus pattern mining]
  gap_closures: [gap-004, gap-005, gap-006]
  duration: 3-6 weeks
  success_criteria: [duplicate_rate reduced, conflict resolution tracked, pattern support metrics emitted]
  acceptance_tests: [corpus-scale fixtures + deterministic reports]
  rollback_plan: [disable unification/feedback with config; keep separate graphs per doc]
```

### Phase: Agentic Querying (Intent → Traversal → Synthesis)

```yaml
phase-4-agentic:
  goals: [intent classifier, traversal planner, grounded synthesis with citations]
  gap_closures: [gap-007]
  duration: 2-4 weeks
  success_criteria: [queries produce cited answers, traversal efficiency tracked, follow-up suggestions logged]
  acceptance_tests: [golden query fixtures + snapshot tests]
  rollback_plan: [keep traversal-only UI; disable synthesis layer behind flag]
```

---

## Acceptance Criteria Validation (This Repo, Current Baseline)

- [x] User workflow completes end-to-end: dev server can run pipeline and load artifacts into UI ([vite.config.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/vite.config.ts#L35-L62), [workflowJsonLdActions.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/panels/hooks/workflowJsonLdActions.ts#L430-L509)).
- [x] Provenance line ranges exist for structural markdown nodes ([markdown_graph.py](file:///Users/huijoohwee/Documents/GitHub/knowgrph/knowgrph_parser/markdown_graph.py#L91-L111)).
- [x] Rendering supports markdown and safe local link resolution for repo browsing ([markdownPreviewLinks.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/markdown/ui/markdownPreviewLinks.tsx#L47-L63)).
- [ ] Semantic extraction layers (TokenLinker/EdgeElevator/ThresholdTuner/DocumentUnifier/Feedback/Reasoning/Agentic engine) are implemented per guidelines.
- [ ] Zero-hardcoding audit passes across pipeline utilities (see gap-009).
