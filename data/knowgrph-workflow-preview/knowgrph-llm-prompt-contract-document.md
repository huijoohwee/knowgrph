# Knowgrph Document – Knowgrph LLM Prompt Contract: Schema-Config Template

## Source

- Graph ID: `md:knowgrph-llm-prompt-contract`
- Markdown: `${KG_GITHUB_ROOT}/knowgrph/docs/documents/knowgrph-llm-prompt-contract.md`

## Outputs

- Graph JSON-LD: `${KG_GITHUB_ROOT}/knowgrph/data/knowgrph-workflow-preview/knowgrph-llm-prompt-contract-graph-data.jsonld`
- Schema JSON-LD: `${KG_GITHUB_ROOT}/knowgrph/data/knowgrph-workflow-preview/knowgrph-llm-prompt-contract-schema-config.jsonld`
- Orchestrator YAML: `${KG_GITHUB_ROOT}/knowgrph/data/knowgrph-workflow-preview/knowgrph-llm-prompt-contract-orchestrator-config.yaml`

## Outline

- Knowgrph LLM Prompt Contract: Schema-Config Template (`knowgrph-llm-prompt-contract-schema-config-template`)
  - Purpose (`purpose`)
  - Input Artifact (`input-artifact`)
  - System Prompt (LLM Editing Rules) (`system-prompt-llm-editing-rules`)
    - 1. Overall Goals (`1-overall-goals`)
    - 2. Top-Level Structure (Must Preserve) (`2-top-level-structure-must-preserve`)
    - 3. Context (Must Preserve) (`3-context-must-preserve`)
    - 4. Metadata (Must Preserve) (`4-metadata-must-preserve`)
    - 5. What You May Change in `@graph` (`5-what-you-may-change-in-graph`)
    - 6. What You May Change in Corpus-Size Presets (`6-what-you-may-change-in-corpus-size-presets`)
    - 7. What You May Change in Semantic and Document-Structure Layers (`7-what-you-may-change-in-semantic-and-document-structure-layers`)
    - 8. Guardrails (`8-guardrails`)
    - 9. Output Requirements (`9-output-requirements`)

## Preview

- In Knowgrph Canvas, open the Graph Data Table and click `metadata.codebasePath` to preview the source markdown (supports `#Lstart-end` ranges).
