# Demo Catalog

- This catalog lists the curated demo datasets that ride on top of the generic Loader → Parser → Validator → GraphData → Exporter → Renderer pipeline.
- All demos are wired via the examples catalog and workflow presets; none of them introduce branches into the core pipeline.
- For a preset → dataset → schema index, see `docs/knowgrph-workflow-document.md`.

## Demos

- Unicorn Investors Top‑3 (3D)
  - Dataset: `test-data/unicorn-investors-top-3-test.json`
  - Schema: `schema-config/unicorn-investors-test-3d-viz-schema.json`
  - Workflow preset: `unicorn-top3-3d` (`canvas/src/features/parsers/useParserWorkflowState.ts:47-63`)
  - Notes: 3D force graph tuned for a small unicorn/investor slice.

- AI KG Visualization
  - Dataset: `test-data/ai-kg-viz.json`
  - Schema: `schema-config/ai-kg-viz-schema.json`
  - Workflow preset: `ai-kg-viz` (`canvas/src/features/parsers/useParserWorkflowState.ts:64-73`)
  - Notes: AI engineering concepts and relations; used by AI‑KG traversal tooling.

- Universal Lean Startup Knowledge Graph
  - Dataset: `test-data/universal-lean-startup-kg.json`
  - Schema: `schema-config/universal-lean-startup-schema.json`
  - Workflow preset: `universal-lean-startup-kg` (`canvas/src/features/parsers/useParserWorkflowState.ts:74-83`)
  - Notes: Decision‑tree‑shaped Lean Startup graph for RAG/GraphRAG flows.

- A0 Investors Knowledge Graph
  - Dataset: `test-data/a0.jsonld`
  - Schema: `schema-config/a0-schema.json`
  - Workflow preset: `a0-investors-kg` (`canvas/src/features/parsers/useParserWorkflowState.ts:84-90`)
  - Notes: JSON‑LD investors graph; shares schema with the venture‑capital portfolio demo.

- Venture Capital Portfolio graph
  - Dataset: `test-data/graph_202512091600.json`
  - Schema: `schema-config/a0-schema.json`
  - Workflow preset: `venture-capital-portfolio` (`canvas/src/features/parsers/useParserWorkflowState.ts:91-101`)
  - Notes: Raw nodes/edges portfolio slice used to stress‑test presets and branded export paths; validated structurally by `canvas/src/__tests__/workflowPresetPipeline.test.ts:94-126`.
