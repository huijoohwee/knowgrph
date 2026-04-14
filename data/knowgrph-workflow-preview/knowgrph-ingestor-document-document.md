# Knowgrph Document – Knowgrph Source File Ingestor: Universal Import Specification

## Source

- Graph ID: `md:knowgrph-ingestor-document`
- Markdown: `/Users/huijoohwee/Documents/GitHub/knowgrph/docs/documents/knowgrph-ingestor-document.md`

## Outputs

- Graph JSON-LD: `/Users/huijoohwee/Documents/GitHub/knowgrph/data/knowgrph-workflow-preview/knowgrph-ingestor-document-graph-data.jsonld`
- Schema JSON-LD: `/Users/huijoohwee/Documents/GitHub/knowgrph/data/knowgrph-workflow-preview/knowgrph-ingestor-document-schema-config.jsonld`
- Orchestrator YAML: `/Users/huijoohwee/Documents/GitHub/knowgrph/data/knowgrph-workflow-preview/knowgrph-ingestor-document-orchestrator-config.yaml`

## Outline

- Knowgrph Source File Ingestor: Universal Import Specification (`knowgrph-source-file-ingestor-universal-import-specification`)
  - Design Mantras (`design-mantras`)
  - Universal Design Principles (`universal-design-principles`)
  - Ingestor Architecture (`ingestor-architecture`)
    - Supported Source Formats (`supported-source-formats`)
    - Integration Bridge: Source Formats → Graph Construction (`integration-bridge-source-formats-graph-construction`)
  - Component Specifications (`component-specifications`)
    - Component: Source File Import Orchestration (`component-source-file-import-orchestration`)
    - Component: URL Fetching and Normalization (`component-url-fetching-and-normalization`)
    - Component: Markdown Ingestion (`component-markdown-ingestion`)
    - Component: HTML Ingestion (`component-html-ingestion`)
    - Component: PDF Ingestion (`component-pdf-ingestion`)
    - Component: JSON-LD Ingestion (`component-json-ld-ingestion`)
    - Component: JSON Ingestion (`component-json-ingestion`)
    - Component: JSON → Markdown Conversion (`component-json-markdown-conversion`)
    - Component: Media Property Handling (`component-media-property-handling`)
  - Component Responsibility Matrix (`component-responsibility-matrix`)
  - Dependency & Integration Standards (`dependency-integration-standards`)
  - Code Organization Framework (`code-organization-framework`)
  - Testing & Quality Standards (`testing-quality-standards`)
  - Operational Configuration: Environment Wiring (`operational-configuration-environment-wiring`)
  - Data Flow (`data-flow`)
  - Design Decisions & Trade-offs (`design-decisions-trade-offs`)
  - Import Directives (`import-directives`)
    - Content Fetching Directives (`content-fetching-directives`)
    - Format Conversion Directives (`format-conversion-directives`)
  - Documentation Coverage (`documentation-coverage`)
  - Anti-Patterns (Forbidden) (`anti-patterns-forbidden`)
  - Repository Health Checklist (`repository-health-checklist`)
  - Version Control Standards (`version-control-standards`)

## Preview

- In Knowgrph Canvas, open the Graph Data Table and click `metadata.codebasePath` to preview the source markdown (supports `#Lstart-end` ranges).
