# CI/CD Documentation

- This document lists CI and CD workflows that keep knowgrph graphs, schemas, and orchestrator configs in sync with external repositories.
- Entries focus on reproducible pipelines that can be replayed locally, in CI, and inside Canvas without duplicating configuration.
- For per-pipeline architecture and traversal details, see the corresponding documentation files under `docs/`.

## Examples

- AIAP22 Agentic GraphRAG CI pipeline
  - External repository: `aiap22-hui-joo-hwee-045B` (read-only competition repo).
  - Workflow file: `.github/workflows/github-actions.yml` in the AIAP22 repository.
  - Responsibilities:
    - Run the AIAP22 end-to-end ML pipeline (install dependencies, download dataset, execute `run.sh`).
    - Check out the `knowgrph` repository into a `knowgrph/` subdirectory and install its lightweight Python dependencies from `knowgrph/requirements.txt`.
    - Generate the AIAP22 GraphRAG workflow JSON-LD from `configs/graphrag/aiap22-codebase-config.yaml` using `python -m knowgrph_parser graphrag-workflow`, keeping `graph.workflow_json` and `graph.graphrag_workflow` in sync.
    - Build the AIAP22 codebase index JSON-LD by running `python -m knowgrph_parser python-codebase-index -c orchestrator-config/aiap22-codebase-index-orchestrator-config.yaml -r . -b aiap22-hui-joo-hwee-045B` so `codebasePath` values are repository-relative (for example `src/main.py` and `src/evaluation.py`).
    - Upload the index, schema, orchestrator config, and GraphRAG workflow as a single `aiap22-codebase-index` artifact bundle:
      - `knowgrph/data/outputs/aiap22-codebase-index-viz.jsonld`
      - `knowgrph/schema-config/aiap22-codebase-index-schema.json`
      - `knowgrph/orchestrator-config/aiap22-codebase-index-orchestrator-config.yaml`
      - `knowgrph/data/graphrag/aiap22-graphrag-workflow.jsonld`
  - Usage:
    - Local: regenerate the same artifacts from the knowgrph repository root using the commands in `docs/knowgrph-aiap22-codebase-index-document.md`.
    - Canvas: download the `aiap22-codebase-index` artifact from CI, load `aiap22-codebase-index-viz.jsonld` into the graph, and import the workflow JSON-LD or YAML into the Workflow and Orchestrator tabs.
    - GraphRAG CLI: treat `configs/graphrag/aiap22-codebase-config.yaml` as the canonical configuration and point dataset paths at the downloaded index artifacts where appropriate.
