# Knowgrph Document – KnowGrph Renderer Specification

## Source

- Graph ID: `md:knowgrph-renderer-document`
- Markdown: `${KG_GITHUB_ROOT}/knowgrph/docs/documents/knowgrph-renderer-document.md`

## Outputs

- Graph JSON-LD: `${KG_GITHUB_ROOT}/knowgrph/data/knowgrph-workflow-preview/knowgrph-renderer-document-graph-data.jsonld`
- Schema JSON-LD: `${KG_GITHUB_ROOT}/knowgrph/data/knowgrph-workflow-preview/knowgrph-renderer-document-schema-config.jsonld`
- Orchestrator YAML: `${KG_GITHUB_ROOT}/knowgrph/data/knowgrph-workflow-preview/knowgrph-renderer-document-orchestrator-config.yaml`

## Outline

- KnowGrph Renderer Specification (`knowgrph-renderer-specification`)
  - Design Mantras (`design-mantras`)
  - Universal Design Principles (`universal-design-principles`)
  - Renderer Architecture (`renderer-architecture`)
    - High-Level Components (`high-level-components`)
    - Renderer Mode Matrix (2D: D3 Graph/Flowchart/Flow Canvas/Design/Flow Editor; 3D; Voxel) (`renderer-mode-matrix-2d-d3-graphflowchartflow-canvasdesignflow-editor-3d-voxel`)
    - Edge Types (Global SSOT) (`edge-types-global-ssot`)
    - Frontmatter + Markdown + Rich Media Linking (Renderer View) (`frontmatter-markdown-rich-media-linking-renderer-view`)
      - How to use HTML Canvas export (end-user) (`how-to-use-html-canvas-export-end-user`)
  - Renderer UI Surfaces (SSOT) (`renderer-ui-surfaces-ssot`)
  - Performance & Stability Strategies (`performance-stability-strategies`)
    - Chunk-size & Mobile Responsiveness (`chunk-size-mobile-responsiveness`)
    - 1. Stable Graph References (`1-stable-graph-references`)
    - 2. Store Immutability & D3 Isolation (`2-store-immutability-d3-isolation`)
    - 3. Loop Prevention (`3-loop-prevention`)
    - 4. Stats Derivation Optimization (`4-stats-derivation-optimization`)
    - 5. Preserve Inactive Renderers (`5-preserve-inactive-renderers`)
    - 5. Forbid Inactive Renderer Interference (`5-forbid-inactive-renderer-interference`)
    - 6. Tick-Path Caching + Force Gating (`6-tick-path-caching-force-gating`)
    - 7. Canvas2D Theme/Token Read Caching (`7-canvas2d-themetoken-read-caching`)
  - Layout Specifications (`layout-specifications`)
  - Cluster Terminology (SSOT) (`cluster-terminology-ssot`)
    - 2D Layout Caching (`2d-layout-caching`)
    - 2D D3 Layout Seeding (Document Structure vs Keyword Mode) (`2d-d3-layout-seeding-document-structure-vs-keyword-mode`)
      - Flow/Flow Editor Parity with Baseline (`flowflow-editor-parity-with-baseline`)
    - 2D Flowchart Layout (Super-Groups) (`2d-flowchart-layout-super-groups`)
    - Selection Zoom (Node/Edge vs Graph) (`selection-zoom-nodeedge-vs-graph`)
    - Mermaid Layout Mode (`mermaid-layout-mode`)
  - Visual Styling & Palette (`visual-styling-palette`)
  - Node Shapes (2D) (`node-shapes-2d`)
  - Label Layout (SSOT) (`label-layout-ssot`)
  - Layout Force Tuning (2D D3) (`layout-force-tuning-2d-d3`)
  - Edge Labels & Links (`edge-labels-links`)
  - Port Handles & Collision (`port-handles-collision`)
  - Radial Layout (Bounded) (`radial-layout-bounded`)
  - Anti-Patterns (Forbidden) (`anti-patterns-forbidden`)
  - Dependency & Integration Standards (`dependency-integration-standards`)
  - Viewport and zoom behavior (`viewport-and-zoom-behavior`)
  - Expand and Collapse (Clusters/Subgraphs/Layers) (`expand-and-collapse-clusterssubgraphslayers`)

## Preview

- In Knowgrph Canvas, open the Graph Data Table and click `metadata.codebasePath` to preview the source markdown (supports `#Lstart-end` ranges).
