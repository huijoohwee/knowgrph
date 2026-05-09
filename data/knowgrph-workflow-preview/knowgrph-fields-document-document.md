# Knowgrph Document – Knowgrph Graph Fields Architecture

## Source

- Graph ID: `md:knowgrph-fields-document`
- Markdown: `${KG_GITHUB_ROOT}/knowgrph/docs/documents/knowgrph-fields-document.md`

## Outputs

- Graph JSON-LD: `${KG_GITHUB_ROOT}/knowgrph/data/knowgrph-workflow-preview/knowgrph-fields-document-graph-data.jsonld`
- Schema JSON-LD: `${KG_GITHUB_ROOT}/knowgrph/data/knowgrph-workflow-preview/knowgrph-fields-document-schema-config.jsonld`
- Orchestrator YAML: `${KG_GITHUB_ROOT}/knowgrph/data/knowgrph-workflow-preview/knowgrph-fields-document-orchestrator-config.yaml`

## Outline

- Knowgrph Graph Fields Architecture (`knowgrph-graph-fields-architecture`)
  - Design Mantras (`design-mantras`)
  - Graph Fields Architecture (`graph-fields-architecture`)
  - Graph Fields View: Canonical Field Inspector (`graph-fields-view-canonical-field-inspector`)
    - Field Source Contract (`field-source-contract`)
  - Component Responsibility Matrix (`component-responsibility-matrix`)
  - Raw JSON Graphs (`context: "raw-nodes-edges"`) (`raw-json-graphs-context-raw-nodes-edges`)
    - Raw JSON Ingestion Pattern (`raw-json-ingestion-pattern`)
  - Raw JSON Context Banner (`raw-json-context-banner`)
    - Context-Aware UI Element (`context-aware-ui-element`)
  - Mapping Raw JSON Fields to AgenticRAG Roles (`mapping-raw-json-fields-to-agenticrag-roles`)
    - Field-to-Role Assignment (`field-to-role-assignment`)
  - Lifecycle Tags and Graph Layers (`lifecycle-tags-and-graph-layers`)
    - Tag-Based Lifecycle Management (`tag-based-lifecycle-management`)
  - Data Flow: Source → Field Catalog → AgenticRAG (`data-flow-source-field-catalog-agenticrag`)
  - Testing & Quality Standards (`testing-quality-standards`)
  - Repository Health Checklist (`repository-health-checklist`)
  - Anti-Patterns (Forbidden) (`anti-patterns-forbidden`)

## Preview

- In Knowgrph Canvas, open the Graph Data Table and click `metadata.codebasePath` to preview the source markdown (supports `#Lstart-end` ranges).
