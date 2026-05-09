# Knowgrph Document – Knowgrph Metadata Contracts

## Source

- Graph ID: `md:knowgrph-metadata-document`
- Markdown: `/Users/huijoohwee/Documents/GitHub/knowgrph/docs/documents/knowgrph-metadata-document.md`

## Outputs

- Graph JSON-LD: `/Users/huijoohwee/Documents/GitHub/knowgrph/data/knowgrph-workflow-preview/knowgrph-metadata-document-graph-data.jsonld`
- Schema JSON-LD: `/Users/huijoohwee/Documents/GitHub/knowgrph/data/knowgrph-workflow-preview/knowgrph-metadata-document-schema-config.jsonld`
- Orchestrator YAML: `/Users/huijoohwee/Documents/GitHub/knowgrph/data/knowgrph-workflow-preview/knowgrph-metadata-document-orchestrator-config.yaml`

## Outline

- Knowgrph Metadata Contracts (`knowgrph-metadata-contracts`)
  - Design Mantras (`design-mantras`)
  - Metadata Architecture (`metadata-architecture`)
  - Graph Metadata (`graph_jsonld.metadata`) (`graph-metadata-graph_jsonldmetadata`)
    - Core Identification Fields (`core-identification-fields`)
  - Structural Provenance Fields (`structural-provenance-fields`)
  - Layer Hint Metadata (`layer-hint-metadata`)
    - Layout and Default Layer (`layout-and-default-layer`)
    - Semantic Layer Hints (`semantic-layer-hints`)
    - Document Structure Layer Hints (`document-structure-layer-hints`)
    - Property Layer Hints (Legacy) (`property-layer-hints-legacy`)
  - Schema-Config Metadata (`schema-config.metadata`) (`schema-config-metadata-schema-configmetadata`)
    - Core Schema Fields (`core-schema-fields`)
    - Corpus Size Presets (`corpus-size-presets`)
    - Layer Propagation from Graphs (`layer-propagation-from-graphs`)
    - Active Layer Configuration (`active-layer-configuration`)
  - CLI Inspection Helper (`cli-inspection-helper`)
    - Markdown Pipeline Layer Inspection (`markdown-pipeline-layer-inspection`)
  - Neutrality and Derivation Rules (`neutrality-and-derivation-rules`)
    - Derivation-Only Contract (`derivation-only-contract`)
    - Domain-Agnostic Contracts (`domain-agnostic-contracts`)
  - Node/Edge Provenance Metadata (`nodeedge-provenance-metadata`)
    - Document and Codebase Fields (`document-and-codebase-fields`)
    - Canonicalization Rules (`canonicalization-rules`)
  - Metadata Quality Gates (`metadata-quality-gates`)
  - Repository Health Checklist (`repository-health-checklist`)

## Preview

- In Knowgrph Canvas, open the Graph Data Table and click `metadata.codebasePath` to preview the source markdown (supports `#Lstart-end` ranges).
