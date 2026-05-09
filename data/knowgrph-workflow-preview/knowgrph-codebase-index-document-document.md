# Knowgrph Document – Knowgrph Codebase Index: Universal Repository Specification

## Source

- Graph ID: `md:knowgrph-codebase-index-document`
- Markdown: `${KG_GITHUB_ROOT}/knowgrph/docs/documents/knowgrph-codebase-index-document.md`

## Outputs

- Graph JSON-LD: `${KG_GITHUB_ROOT}/knowgrph/data/knowgrph-workflow-preview/knowgrph-codebase-index-document-graph-data.jsonld`
- Schema JSON-LD: `${KG_GITHUB_ROOT}/knowgrph/data/knowgrph-workflow-preview/knowgrph-codebase-index-document-schema-config.jsonld`
- Orchestrator YAML: `${KG_GITHUB_ROOT}/knowgrph/data/knowgrph-workflow-preview/knowgrph-codebase-index-document-orchestrator-config.yaml`

## Outline

- Knowgrph Codebase Index: Universal Repository Specification (`knowgrph-codebase-index-universal-repository-specification`)
  - Design Mantras (`design-mantras`)
  - Universal Design Principles (`universal-design-principles`)
  - Repository Architecture (`repository-architecture`)
    - High-Level Components (`high-level-components`)
  - Module Specification (`module-specification`)
    - Module: `knowgrph_parser.codebase_index_cmd` (`module-knowgrph_parsercodebase_index_cmd`)
    - Module: `knowgrph_parser.codebase_index_jsonld` (`module-knowgrph_parsercodebase_index_jsonld`)
    - Module: `knowgrph_parser.python_codebase_index_cmd` (`module-knowgrph_parserpython_codebase_index_cmd`)
    - Module: `knowgrph_parser.python_codebase_index_document` (`module-knowgrph_parserpython_codebase_index_document`)
  - URL → Proxy Fetch → Parse → Canvas/MapLibre Rendering (`url-proxy-fetch-parse-canvasmaplibre-rendering`)
    - 1. Import URL (host) → normalize/resolve (shared) (`1-import-url-host-normalizeresolve-shared`)
    - 2. Import Website (sitemap/tree) → artifacts → workspace tree → per-page view switching (`2-import-website-sitemaptree-artifacts-workspace-tree-per-page-view-switching`)
    - 2. Proxy decision + remote fetch (`2-proxy-decision-remote-fetch`)
    - 3. Parse (Graph + GeoJSON) and apply to stores (`3-parse-graph-geojson-and-apply-to-stores`)
    - 4. Render on Canvas and MapLibre (`4-render-on-canvas-and-maplibre`)
    - 5. Synchronization across Document Mode and Geospatial Mode (`5-synchronization-across-document-mode-and-geospatial-mode`)
  - State-Sync, Indexing, and Scheduler SSOT (Knowgrph) (`state-sync-indexing-and-scheduler-ssot-knowgrph`)
    - Module: `knowgrph_parser.markdown_cmd` (`module-knowgrph_parsermarkdown_cmd`)
    - Module: `knowgrph_parser.graph_builder` (`module-knowgrph_parsergraph_builder`)
  - Component Responsibility Matrix (`component-responsibility-matrix`)
  - Dependency & Integration Standards (`dependency-integration-standards`)
  - Code Organization Framework (`code-organization-framework`)
  - Testing & Quality Standards (`testing-quality-standards`)
  - Anti-Patterns (Forbidden) (`anti-patterns-forbidden`)
  - Repository Health Checklist (`repository-health-checklist`)
  - Version Control Standards (`version-control-standards`)

## Preview

- In Knowgrph Canvas, open the Graph Data Table and click `metadata.codebasePath` to preview the source markdown (supports `#Lstart-end` ranges).
