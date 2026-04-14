# Knowgrph Document – Knowgrph Mermaid Frontmatter Architecture

## Source

- Graph ID: `md:knowgrph-mermaid-frontmatter-document`
- Markdown: `/Users/huijoohwee/Documents/GitHub/knowgrph/docs/documents/knowgrph-mermaid-frontmatter-document.md`

## Outputs

- Graph JSON-LD: `/Users/huijoohwee/Documents/GitHub/knowgrph/data/knowgrph-workflow-preview/knowgrph-mermaid-frontmatter-document-graph-data.jsonld`
- Schema JSON-LD: `/Users/huijoohwee/Documents/GitHub/knowgrph/data/knowgrph-workflow-preview/knowgrph-mermaid-frontmatter-document-schema-config.jsonld`
- Orchestrator YAML: `/Users/huijoohwee/Documents/GitHub/knowgrph/data/knowgrph-workflow-preview/knowgrph-mermaid-frontmatter-document-orchestrator-config.yaml`

## Outline

- Knowgrph Mermaid Frontmatter Architecture (`knowgrph-mermaid-frontmatter-architecture`)
  - Design Mantras (`design-mantras`)
  - Mermaid Frontmatter Architecture (`mermaid-frontmatter-architecture`)
    - High-Level Components (`high-level-components`)
    - Integration Bridge: Mermaid Frontmatter → Canvas Layout (`integration-bridge-mermaid-frontmatter-canvas-layout`)
  - Component Responsibility Matrix (`component-responsibility-matrix`)
  - Mermaid Frontmatter Parsing Specifications (`mermaid-frontmatter-parsing-specifications`)
    - Node Tagging Pattern (`node-tagging-pattern`)
    - Subgraph Nesting Preservation (`subgraph-nesting-preservation`)
  - Layer Filtering Specifications (`layer-filtering-specifications`)
    - Frontmatter Mode Toggle (`frontmatter-mode-toggle`)
  - Disjoint Force Layout Specifications (`disjoint-force-layout-specifications`)
    - Component Separation Algorithm (`component-separation-algorithm`)
  - Port Handle Layout Specifications (`port-handle-layout-specifications`)
    - Topology-Driven Positioning (`topology-driven-positioning`)
  - Subgraph Rendering Specifications (`subgraph-rendering-specifications`)
    - Group Box Visualization (`group-box-visualization`)
  - Data Flow: Frontmatter Parsing → Rendering (`data-flow-frontmatter-parsing-rendering`)
  - Testing & Quality Standards (`testing-quality-standards`)
  - Repository Health Checklist (`repository-health-checklist`)
  - Anti-Patterns (Forbidden) (`anti-patterns-forbidden`)
  - Performance Optimization (`performance-optimization`)
    - Packed R-tree Collision Broadphase (`packed-r-tree-collision-broadphase`)
  - Configuration Examples (`configuration-examples`)
    - Enable Frontmatter Mode with Component Separation (`enable-frontmatter-mode-with-component-separation`)
    - Enable Port Handles for Flow Layout (`enable-port-handles-for-flow-layout`)
    - Nested Subgraph Rendering (`nested-subgraph-rendering`)

## Preview

- In Knowgrph Canvas, open the Graph Data Table and click `metadata.codebasePath` to preview the source markdown (supports `#Lstart-end` ranges).
