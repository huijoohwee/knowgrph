# Knowgrph Document – Knowgrph Schema Configuration Architecture

## Source

- Graph ID: `md:knowgrph-schema-document`
- Markdown: `/Users/huijoohwee/Documents/GitHub/knowgrph/docs/documents/knowgrph-schema-document.md`

## Outputs

- Graph JSON-LD: `/Users/huijoohwee/Documents/GitHub/knowgrph/data/knowgrph-workflow-preview/knowgrph-schema-document-graph-data.jsonld`
- Schema JSON-LD: `/Users/huijoohwee/Documents/GitHub/knowgrph/data/knowgrph-workflow-preview/knowgrph-schema-document-schema-config.jsonld`
- Orchestrator YAML: `/Users/huijoohwee/Documents/GitHub/knowgrph/data/knowgrph-workflow-preview/knowgrph-schema-document-orchestrator-config.yaml`

## Outline

- Knowgrph Schema Configuration Architecture (`knowgrph-schema-configuration-architecture`)
  - Design Mantras (`design-mantras`)
  - Schema Configuration Architecture (`schema-configuration-architecture`)
  - Example Workflow Schema-Config (`example-workflow-schema-config`)
    - Dataset and Schema-Config Pairing (`dataset-and-schema-config-pairing`)
  - Layout and Mode Interaction (`layout-and-mode-interaction`)
    - Layout Modes (`layout-modes`)
    - Flow Renderer Layout Configuration (`flow-renderer-layout-configuration`)
    - Advanced Fit-to-View Configuration (`advanced-fit-to-view-configuration`)
    - Structured Layout Position Caching (`structured-layout-position-caching`)
    - Port Handles Configuration (`port-handles-configuration`)
    - Rectangular Node Sizing (`rectangular-node-sizing`)
  - Semantic Layer Behavior (`semantic-layer-behavior`)
    - Similarity Graph Derivation (`similarity-graph-derivation`)
    - Metrics and Property Keys (Canonical) (`metrics-and-property-keys-canonical`)
    - Hidden Node Types (`hidden-node-types`)
    - JSON-LD Edge Inference (`json-ld-edge-inference`)
  - Markdown Ingestion and Layer Hints (`markdown-ingestion-and-layer-hints`)
    - Markdown → Graph Parsing (`markdown-graph-parsing`)
    - Schema-Config Generation from Hints (`schema-config-generation-from-hints`)
  - Semantic Threshold Presets (`semantic-threshold-presets`)
    - Corpus-Size Presets (`corpus-size-presets`)
  - Tree Mermaid Density Presets (`tree-mermaid-density-presets`)
    - Mermaid Diagram Density Metrics (`mermaid-diagram-density-metrics`)

## Preview

- In Knowgrph Canvas, open the Graph Data Table and click `metadata.codebasePath` to preview the source markdown (supports `#Lstart-end` ranges).
