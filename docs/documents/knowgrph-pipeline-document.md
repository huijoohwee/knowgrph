---
ontologies:
  - prefix: prov
    iri: http://www.w3.org/ns/prov#
  - prefix: mex
    iri: http://mex.aksw.org/mex-core#
  - prefix: pplan
    iri: http://purl.org/net/p-plan#
  - prefix: mls
    iri: http://www.w3.org/ns/mls#
  - prefix: geo
    iri: http://www.opengis.net/ont/geosparql#
  - prefix: ro
    iri: https://w3id.org/ro/crate#
polygonLayers:
  - competencyHyperspace
  - performanceSpace
  - classDistributionSpace
  - preprocessingCluster
  - modelTypeClusters
  - kpiViolationRegion
  - candidateClusters
  - assessmentRegion
---

# Enhanced GraphRAG Pipeline: Overview

This document provides a compact, maintainable overview of the GraphRAG pipeline, focusing on configuration-driven architecture, environment wiring, and automation contracts. Detailed, ML-inspired component behavior is documented separately in the deep-dive document.

## Integration Bridge: ML Pipeline → Graph Construction

The pipeline mirrors familiar ML workflows while remaining domain-agnostic:

- **Data loading** maps to document ingestion into a neutral graph.
- **Feature engineering** maps to statistical feature computation on tokens and spans.
- **Preprocessing and validation** map to structural normalization and schema validation.
- **Model evaluation and selection** map to quality monitoring and configuration-driven orchestration.

All behavior is controlled through configuration, never hardcoded domain logic.

## Layer 0: Configuration-Driven Architecture

The pipeline is configured via a universal schema that:

- Describes document sources (loader type, connection parameters, schema discovery).
- Controls token linking and edge elevation thresholds.
- Configures document unification, feedback loops, and corpus reasoning parameters.
- Exposes Agentic RAG configuration (traversal depth, context size, follow-up suggestions).
- Specifies evaluation metrics for extraction, unification, corpus behavior, and queries.
- Defines provenance tracking behavior without embedding structure types.

The TypeScript layer mirrors these configuration fields and can be initialized from external configuration surfaces such as environment variables and workflow JSON-LD documents. This enables the same pipeline to operate identically across arbitrary corpora without code changes.

## Deep Dive: Component Layers and Validation

The detailed, ML-analogy-driven descriptions of component layers and validation live in the deep-dive document:

- `docs/documents/knowgrph-pipeline-deep-dive-document.md`

That document covers:

- Layers 0.5–4: statistical feature computation, token linking, edge elevation, threshold tuning, and document unification.
- Layers 5–7: feedback loops, corpus reasoning, and Agentic RAG query execution.
- Neutrality validation and reproducibility guarantees.

This overview document remains focused on high-level flows and operational wiring.

## Operational Configuration: Markdown Pipeline Env Variables

The Canvas markdown pipeline is configured via environment variables so that the same code can target different workflow documents and output locations without edits.

- `VITE_MARKDOWN_PIPELINE_INPUT_REL_PATH`  
  - Relative path (from repo root) to the entry markdown document.  
  - Default (in this repo): `docs/knowgrph-pipeline-document.md`.  
  - Controls which workflow document is parsed when you run the pipeline.

- `VITE_MARKDOWN_PIPELINE_OUTPUT_DIR`  
  - Relative path (from repo root) to the directory where pipeline artifacts are written.  
  - Default: `data/knowgrph-workflow-preview`.  
  - Controls where the graph JSON-LD, schema JSON-LD, and orchestrator YAML are generated.

- `VITE_MARKDOWN_PIPELINE_BASENAME`  
  - Basename used for all generated artifact filenames.  
  - Default: `knowgrph-pipeline-document`.  
  - Controls the prefixes of `*-graph-data.jsonld`, `*-schema-config.jsonld`, and `*-orchestrator-config.yaml`.

These variables feed into the Vite canvas configuration (for example, `CODEBASE_INDEX_PIPELINE_COMMAND` and `CODEBASE_INDEX_PIPELINE_*_REL_PATH` values), ensuring that dev server hooks and UI loaders always respect the active markdown corpus and output directory.

### Graph and Ontology Outputs

When the markdown pipeline runs against a workflow document such as `docs/documents/knowgrph-pipeline-document.md`, it emits three primary artifacts into `VITE_MARKDOWN_PIPELINE_OUTPUT_DIR` using the `VITE_MARKDOWN_PIPELINE_BASENAME` prefix:

- `*-graph-data.jsonld`: a neutral node/edge graph in JSON-LD form, suitable for multi-ontology overlay and layer configuration in Canvas. The pipeline reads any `ontologies` and `polygonLayers` values from document frontmatter and records them under `graph_jsonld.metadata.ontologies` and `graph_jsonld.metadata.polygonLayers`.
- `*-schema-config.jsonld`: an Agentic RAG schema-configuration document consumed by Canvas layers and ontology bundles.
- `*-orchestrator-config.yaml`: a workflow orchestrator configuration describing pipeline stages, thresholds, and quality targets.

These artifacts are consumed by:

- Codebase index pipeline tools in Canvas, which load the graph into the Graph Data Table, the schema-config into the Schema view, and the orchestrator YAML into the Workflow view.
- Ontology-aware presets, which can merge the emitted graph with external ontologies via JSON-LD contexts while preserving neutrality and configuration-driven behavior.

### Dev Workflow: Running the Markdown Pipeline from Canvas

In dev mode, the pipeline env variables flow through Vite and Canvas as follows:

1. Canvas reads `VITE_MARKDOWN_PIPELINE_INPUT_REL_PATH`, `VITE_MARKDOWN_PIPELINE_OUTPUT_DIR`, and `VITE_MARKDOWN_PIPELINE_BASENAME` to construct:
   - `CODEBASE_INDEX_PIPELINE_COMMAND`
   - `CODEBASE_INDEX_PIPELINE_GRAPH_REL_PATH`
   - `CODEBASE_INDEX_PIPELINE_SCHEMA_REL_PATH`
   - `CODEBASE_INDEX_PIPELINE_ORCHESTRATOR_REL_PATH`
2. The Vite dev server registers a POST endpoint `/__run_markdown_pipeline` that runs `CODEBASE_INDEX_PIPELINE_COMMAND` and writes artifacts to `CODEBASE_INDEX_PIPELINE_OUTPUT_DIR`.
3. On the client, Canvas exposes a dev-only `window.knowgrphRunMarkdownPipeline()` helper which calls `/__run_markdown_pipeline`, and `runMarkdownPipelineAndLoadArtifacts()` then:
   - Fetches the generated graph, schema, and orchestrator files from the computed `CODEBASE_INDEX_PIPELINE_*_REL_PATH` values.
   - Loads them into the Graph Data Table, Schema view, and Workflow view.

Changing any of the `VITE_MARKDOWN_PIPELINE_*` variables therefore changes both the markdown document being parsed and the artifact locations that Canvas loads, without modifying any application code.

**How to run in the UI (dev mode):** open the floating Tools menu in Canvas and use the “Run codebase index pipeline” action, which calls `runMarkdownPipelineWithStatus` under the hood.

## Markdown Sources Covered by `npm run docs:update`

The `docs:update` automation script runs the markdown pipeline over a neutral set of authored docs and writes preview artifacts into `data/knowgrph-workflow-preview`. Each document can participate in three distinct quality gates and has a clear stewardship role:

- **In docs:update**: markdown is parsed into preview artifacts via the neutral markdown pipeline.
- **In doc:lint/doc:sanity**: document is validated by documentation linting and sanity checks.
- **In tests/QA**: document is covered by the combined docs+code QA command (`npm run docs:qa`), which chains `docs:update`, `doc:lint`, `doc:sanity`, `lint`, and `check`.

| Document                             | Source Path                                                      | Purpose (High-Level)                                  | In docs:update | In doc:lint/doc:sanity | In tests/QA | Steward Role          |
|--------------------------------------|------------------------------------------------------------------|-------------------------------------------------------|----------------|------------------------|-------------|-----------------------|
| Pipeline doc                         | `docs/documents/knowgrph-pipeline-document.md`                  | End-to-end GraphRAG pipeline and configuration flows  | [x]            | [x]                    | [x]         | Technical Writer      |
| Pipeline deep-dive doc               | `docs/documents/knowgrph-pipeline-deep-dive-document.md`        | Component layers, validation, and reproducibility     | [x]            | [x]                    | [x]         | Component Documenter  |
| Parser doc                           | `docs/documents/knowgrph-parser-document.md`                    | Markdown/JSON/JSON-LD parser contracts and behaviors  | [x]            | [x]                    | [x]         | Component Documenter  |
| Orchestrator doc                     | `docs/documents/knowgrph-orchestrator-document.md`              | Orchestrator roles, actions, and workflow semantics   | [x]            | [x]                    | [x]         | Component Documenter  |
| Ontology doc                         | `docs/documents/knowgrph-ontology-document.md`                  | Multi-ontology integration patterns and schema usage  | [x]            | [x]                    | [x]         | Schema Documenter     |
| Schema doc                           | `docs/documents/knowgrph-schema-document.md`                    | Schema-config structure and neutral layering rules    | [x]            | [x]                    | [x]         | Schema Documenter     |
| Renderer doc                         | `docs/documents/knowgrph-renderer-document.md`                  | Canvas rendering pipeline and media visualization     | [x]            | [x]                    | [x]         | Component Documenter  |
| Semantic doc                         | `docs/documents/knowgrph-semantic-document.md`                  | Semantic extraction layers and neutrality constraints | [x]            | [x]                    | [x]         | Component Documenter  |
| Mermaid frontmatter doc              | `docs/documents/knowgrph-mermaid-frontmatter-document.md`       | Mermaid frontmatter parsing and graph mapping         | [x]            | [x]                    | [x]         | Component Documenter  |
| UI/UX design doc                     | `docs/documents/knowgrph-ui-ux-design-document.md`              | UI/UX flows, panel behaviors, and interaction models  | [x]            | [x]                    | [x]         | Technical Writer      |
| Codebase semantics doc               | `docs/documents/knowgrph-codebase-semantics-document.md`        | Codebase-level semantics and traversal expectations   | [x]            | [x]                    | [x]         | Component Documenter  |
| Fields doc                           | `docs/documents/knowgrph-fields-document.md`                    | Graph field definitions and settings responsibilities | [x]            | [x]                    | [x]         | Schema Documenter     |
| Metadata doc                         | `docs/documents/knowgrph-metadata-document.md`                  | Metadata contracts and layer hints                    | [x]            | [x]                    | [x]         | Provenance Documenter |
| Ingestor doc                         | `docs/documents/knowgrph-ingestor-document.md`                  | Source file ingestion paths and GraphData contracts   | [x]            | [x]                    | [x]         | Component Documenter  |
| Codebase index doc                   | `docs/documents/knowgrph-codebase-index-document.md`            | Codebase index architecture and JSON-LD specification | [x]            | [x]                    | [x]         | Schema Documenter     |
| Demo doc                             | `docs/documents/knowgrph-demo-document.md`                      | Demo workflow and interactive tour description        | [x]            | [x]                    | [x]         | Technical Writer      |
| LLM prompt contract doc              | `docs/documents/knowgrph-llm-prompt-contract.md`                | LLM prompt contracts and schema-aligned guidance      | [x]            | [x]                    | [x]         | API Documenter        |

This keeps documentation, preview graphs, schema-configs, and orchestrator configs aligned without hardcoding any external domains; running `npm run docs:qa` ensures authored docs and generated artifacts participate in the same quality gates as application code.

For Canvas↔Markdown panel behavior and scroll-sync UX details, see:
- `docs/documents/knowgrph-parser-document.md` (Markdown Rendering, Canvas UI)
- `docs/documents/knowgrph-renderer-document.md` (Canvas ↔ Markdown selection sync)
- `docs/documents/knowgrph-ui-ux-design-document.md` (Canvas ↔ Markdown panel UX)

## Summary: ML Pipeline → GraphRAG Translation

The GraphRAG pipeline:

- Translates ML pipeline stages into configuration-driven graph construction steps.
- Encodes all behavior in schemas, configuration objects, and environment variables.
- Ensures neutrality through statistical features and structural validation rather than domain heuristics.
- Provides reproducibility and monitoring hooks so changes can be audited and tuned safely.

The overview and deep-dive documents together describe how to adapt the pipeline to new domains by editing configuration and documentation, not code.
