# Knowgrph Document – Knowgrph Settings Architecture

## Source

- Graph ID: `md:knowgrph-settings-document`
- Markdown: `/Users/huijoohwee/Documents/GitHub/knowgrph/docs/documents/knowgrph-settings-document.md`

## Outputs

- Graph JSON-LD: `/Users/huijoohwee/Documents/GitHub/knowgrph/data/knowgrph-workflow-preview/knowgrph-settings-document-graph-data.jsonld`
- Schema JSON-LD: `/Users/huijoohwee/Documents/GitHub/knowgrph/data/knowgrph-workflow-preview/knowgrph-settings-document-schema-config.jsonld`
- Orchestrator YAML: `/Users/huijoohwee/Documents/GitHub/knowgrph/data/knowgrph-workflow-preview/knowgrph-settings-document-orchestrator-config.yaml`

## Outline

- Knowgrph Settings Architecture (`knowgrph-settings-architecture`)
  - Design Mantras (`design-mantras`)
  - Settings Architecture (`settings-architecture`)
  - Import Settings: PDF (`import-settings-pdf`)
  - Import Settings: Webpage (`import-settings-webpage`)
  - Import Settings: Website (`import-settings-website`)
  - Import Settings: Geospatial (`import-settings-geospatial`)
  - Markdown Settings: Viewer / Presentation (`markdown-settings-viewer-presentation`)
  - Chat Settings: Endpoint, Model, Context (`chat-settings-endpoint-model-context`)
  - Settings UI Tooltip Semantics (`settings-ui-tooltip-semantics`)
  - Settings Row Layout Consistency (Key / Type / Value) (`settings-row-layout-consistency-key-type-value`)
  - Component Responsibility Matrix (`component-responsibility-matrix`)
  - Settings Schema Extraction (`build:settings`) (`settings-schema-extraction-buildsettings`)
    - Build Script Architecture (`build-script-architecture`)
  - Core Settings Specifications (`core-settings-specifications`)
    - `themeMode` (`thememode`)
    - `canvasInteractionSpeedMultiplier` (`canvasinteractionspeedmultiplier`)
    - `canvasPanSpeedMultiplier` (`canvaspanspeedmultiplier`)
    - `selectionFlashDurationMs` (`selectionflashdurationms`)
    - `selectionFlashOpacity` (`selectionflashopacity`)
    - `graphHoverPreview` (`graphhoverpreview`)
  - Settings Extraction Flow (`settings-extraction-flow`)
    - Markdown Source → JSON Schema Pipeline (`markdown-source-json-schema-pipeline`)
  - Bootstrap Behavior (`bootstrap-behavior`)
    - Source Document Missing (`source-document-missing`)
  - Testing & Quality Standards (`testing-quality-standards`)
  - Anti-Patterns (Forbidden) (`anti-patterns-forbidden`)

## Preview

- In Knowgrph Canvas, open the Graph Data Table and click `metadata.codebasePath` to preview the source markdown (supports `#Lstart-end` ranges).
