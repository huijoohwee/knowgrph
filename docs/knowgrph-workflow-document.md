---
title: "Knowgrph Workflow Document"
doc_type: "Generated Registry Surface"
status: "generated"
lang: "en-US"
frontmatter_contract: "required"
canonical_docs_root: "docs/documents"
generator_owner: "canvas/src/cli/lint-doc.ts"
---

# Knowgrph Workflow Document

## Generated Registry Contract

- The opening YAML frontmatter block remains the first-block machine SSOT for this workflow registry surface's generated status, canonical owner path, and generator ownership.
- This file is an auto-generated workflow preset table surface, not the canonical authored workflow document.
- Canonical workflow-facing prose and orchestration behavior live under `docs/documents/`; update the source docs or generator inputs there instead of hand-authoring this registry surface.
- Registry rows must remain generator-owned output from `canvas/src/cli/lint-doc.ts`, not a parallel authoring surface or validation fixture.
- Runtime or documentation decisions must never be inferred from stale generated rows when the canonical authored docs disagree; fix the upstream source and regenerate.

Canonical workflow-facing documentation lives in `docs/documents/knowgrph-orchestrator-document.md` and related pipeline documents under `docs/documents/`.

This root document exists as the auto-generated workflow preset table surface used by `canvas/src/cli/lint-doc.ts`.

## Workflow Presets

<!-- WORKFLOW_PRESETS_TABLE_START -->

| Preset ID | Dataset | Schema | Primary use case |
|---|---|---|---|
| `sample-investors-top3-3d` | `data/test-data/graph_202512091600.json` | `schema-config/knowgrph-universal-schema-config.jsonld` | Demo: Sample Investors Top-3 (3D) |
| `ai-kg-viz` | `data/test-data/ai-kg-viz_1500.json` | `schema-config/knowgrph-universal-schema-config.jsonld` | Demo: AI KG Visualization |
| `customerVoiceManagement` | `data/test-data/ai-customer-voice-management.graph.json` | `schema-config/knowgrph-universal-schema-config.jsonld` | Demo: Customer Voice Management |
| `example-workflow` | `docs/assets/example-workflow.jsonld` | `schema-config/knowgrph-example-workflow-schema-config.jsonld` | Demo: Example Workflow (semantic clusters hidden) |
| `multi-ontology-kg` | `docs/assets/multi-ontology-kg.jsonld` | `schema-config/knowgrph-interviewer-schema-config.jsonld` | Demo: Multi-ontology Assessment Knowledge Graph |
| `universal-lean-startup-kg` | `data/test-data/universal-lean-startup-kg.json` | `schema-config/knowgrph-universal-schema-config.jsonld` | Demo: Universal Lean Startup Knowledge Graph |
| `a0-investors-kg` | `data/test-data/a0.jsonld` | `schema-config/knowgrph-universal-schema-config.jsonld` | Demo: Investors Knowledge Graph |
| `venture-capital-portfolio` | `data/test-data/graph_202512091600.json` | `schema-config/knowgrph-universal-schema-config.jsonld` | Demo: Venture Capital Portfolio |
| `eda-mlp-pipeline-path` | `data/test-data/eda-mlp-path.json` | `schema-config/knowgrph-universal-schema-config.jsonld` | Demo: EDA→MLP pipeline path inspector |

<!-- WORKFLOW_PRESETS_TABLE_END -->
