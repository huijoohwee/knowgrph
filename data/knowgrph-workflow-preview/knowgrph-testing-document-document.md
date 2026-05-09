# Knowgrph Document – Knowgrph Testing Architecture

## Source

- Graph ID: `md:knowgrph-testing-document`
- Markdown: `/Users/huijoohwee/Documents/GitHub/knowgrph/docs/documents/knowgrph-testing-document.md`

## Outputs

- Graph JSON-LD: `/Users/huijoohwee/Documents/GitHub/knowgrph/data/knowgrph-workflow-preview/knowgrph-testing-document-graph-data.jsonld`
- Schema JSON-LD: `/Users/huijoohwee/Documents/GitHub/knowgrph/data/knowgrph-workflow-preview/knowgrph-testing-document-schema-config.jsonld`
- Orchestrator YAML: `/Users/huijoohwee/Documents/GitHub/knowgrph/data/knowgrph-workflow-preview/knowgrph-testing-document-orchestrator-config.yaml`

## Outline

- Knowgrph Testing Architecture (`knowgrph-testing-architecture`)
  - Design Mantras (`design-mantras`)
  - Testing Architecture (`testing-architecture`)
  - Bounded Execution (FORBID Indefinite Runs) (`bounded-execution-forbid-indefinite-runs`)
  - Component Responsibility Matrix (`component-responsibility-matrix`)
  - Test Runner Architecture (`test-runner-architecture`)
    - Modular Test Organization (`modular-test-organization`)
  - Markdown Ingestion Fixtures (`markdown-ingestion-fixtures`)
    - Core Markdown Test Coverage (`core-markdown-test-coverage`)
    - Interview Markdown Fixture (EDA → MLP → Deployment) (`interview-markdown-fixture-eda-mlp-deployment`)
    - Disk-Based Interview Fixture Helper (`disk-based-interview-fixture-helper`)
  - Neutrality and Configuration (`neutrality-and-configuration`)
    - Fixture Neutrality Principles (`fixture-neutrality-principles`)
    - Fixture-Driven Webpage Markdown Artifact Regression (`fixture-driven-webpage-markdown-artifact-regression`)
  - Test Helper Reusability (`test-helper-reusability`)
    - Common Test Helpers (`common-test-helpers`)
  - Testing Standards and Quality Gates (`testing-standards-and-quality-gates`)
    - Test Coverage Metrics (`test-coverage-metrics`)
  - Repository Health Checklist (`repository-health-checklist`)
  - Anti-Patterns (Forbidden) (`anti-patterns-forbidden`)

## Preview

- In Knowgrph Canvas, open the Graph Data Table and click `metadata.codebasePath` to preview the source markdown (supports `#Lstart-end` ranges).
