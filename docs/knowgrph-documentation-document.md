# Knowgrph Documentation

- From implementation surfaces to reusable specifications: Documentation → enumerates responsibilities and configuration semantics → regenerates registries from code → keeps UI copy, JSON-LD fixtures, and tables aligned for audit, onboarding, and automation.

## Documentation Guide

- Authoring standards live in `docs/documentation-guide.md`.
- Use intent-first phrasing (`From X to Y: Component → actions → outcome`) and atomic subject-verb-object directives.
- Prefer domain-blind descriptions (algorithms and schemas) over dataset-specific walkthroughs.
- When documentation mirrors runtime behavior (tooltips, presets, localStorage keys), treat code registries and copy helpers as the source of truth.

## Coverage Map (Guide → This Repo)

- Architecture overview
  - `docs/knowgrph-technical-architecture.md`
  - `docs/knowgrph-design-document.md`
  - `docs/knowgrph-pipeline-principles.md`
- Component specifications
  - `docs/knowgrph-api-document.md`
  - `docs/knowgrph-orchestrator-document.md`
  - `docs/knowgrph-schema-document.md`
  - `docs/knowgrph-utilities-document.md`
  - `docs/knowgrph-hooks-document.md`
- Configuration reference
  - `docs/knowgrph-settings-document.md`
  - `docs/knowgrph-graph-traversal-settings-document.md`
  - `schema-config/*.json` and `schema-config/*.jsonld` (schema/preset fixtures)
- Validation guidelines
  - `docs/knowgrph-test-documentation.md`
  - `docs/knowgrph-metadata-lint-patterns.md`
- Provenance standards and semantics
  - `docs/knowgrph-semantics-document.md`
  - `docs/knowgrph-tokens-document.md`

## Documentation Automation Overview

- `canvas/src/cli/lint-doc.ts` normalizes several markdown tables by calling small CLIs under `canvas/src/cli` and rewriting sections between marker comments.
- Orchestrator sections:
  - `canvas/src/cli/lint-doc.ts` calls `canvas/src/cli/orchestrator-doc.ts` to generate the Orchestrator sections table and updates `docs/knowgrph-design-document.md` between `<!-- ORCHESTRATOR_SECTIONS_TABLE_START -->` and `<!-- ORCHESTRATOR_SECTIONS_TABLE_END -->`.
- Render sections:
  - `canvas/src/cli/lint-doc.ts` calls `canvas/src/cli/render-doc.ts` to generate the Render sections table and updates `docs/knowgrph-design-document.md` between `<!-- RENDER_SECTIONS_TABLE_START -->` and `<!-- RENDER_SECTIONS_TABLE_END -->`.
- Render presets:
  - The Renderer preset buttons are backed by a feature-scoped preset catalog (`canvas/src/features/panels/views/renderPresetCatalog.ts`) so preset tuning can evolve without bloating `RenderPresetSection.tsx`.
- Workflow presets:
  - `canvas/src/cli/lint-doc.ts` calls `canvas/src/cli/workflow-presets-doc.ts` to generate the workflow presets table and updates `docs/knowgrph-workflow-document.md` between `<!-- WORKFLOW_PRESETS_TABLE_START -->` and `<!-- WORKFLOW_PRESETS_TABLE_END -->`.
- Settings registry:
  - `canvas/src/cli/lint-doc.ts` calls `canvas/src/cli/settings-doc.ts` to generate the settings registry table and updates `docs/knowgrph-technical-architecture.md` between `<!-- SETTINGS_REGISTRY_TABLE_START -->` and `<!-- SETTINGS_REGISTRY_TABLE_END -->`.
- Orchestrator and AgenticRAG copy helpers:
  - The Orchestrator bottom-panel section list is centralized in `canvas/src/features/panels/config.ts` via `getOrchestratorSectionListLabel`. Help copy, workflow step descriptions, Orchestrator ADRs/design docs, and pipeline legends should call this helper instead of hardcoding `"traversal presets, Traversal sequence, AgenticRAG node inspector, AgenticRAG context and ignore filters"` so UI and documentation stay aligned.
  - The semantic-frame Orchestrator tooltip copy is centralized as `ORCHESTRATOR_TRAVERSAL_TOOLTIP` in `canvas/src/lib/config.ts:388` and reused by the toolbar, spotlight, and help surfaces rather than duplicating the string in multiple modules. New Role → Actions → Outcome tooltips should be built with `buildRoleActionOutcomeTooltip` in the same module so wording stays consistent with JSON‑LD fixtures.
  - AgenticRAG node inspector and context surfaces reuse the centralized `ORCHESTRATOR_AGENTIC_COPY` helper in `canvas/src/features/panels/config.ts` for title, tooltip, empty state, AgenticRAG schema/context/dataset labels, graphRAGPath IRI label and legend text, traversal metadata missing text, codebasePath provenance, and AgenticRAG context and ignore filters phrases so the bottom-panel Orchestrator, Workflow/RACI documents, and schema docs share the same “AgenticRAG node inspector”, “AgenticRAG schema:”, “AgenticRAG context:”, “Dataset context/vocab:”, “graphRAGPath IRI:”, legend text, and “AgenticRAG context and ignore filters” vocabulary.
  - Numeric knob tooltips for traversal delay, chunk size, and similar inputs should use the shared `buildNumericTooltip` helper in `canvas/src/lib/config.ts` so `Default/Min/Max/Interval + impact` phrasing stays aligned across panels.
  - The Graph Fields icon legend tooltip copy is centralized as `GRAPH_FIELDS_ICON_LEGEND_TOOLTIP` in `canvas/src/lib/config.ts:391` and reused by the Help tab and Graph Fields legend so icon semantics stay consistent between UI and documentation.
- The markdown-to-graph pipeline command text is centralized as `HELP_PIPELINE_COMMAND_TEXT` (aliased from `CODEBASE_INDEX_PIPELINE_COMMAND`) in the Canvas config helpers (backed by `canvas/src/lib/config-copy/tooltips.ts`); UI surfaces and documentation that reference this combined command should reuse that helper instead of inlining the shell snippet. The status messages for clipboard success and fallback are likewise centralized as `PIPELINE_COMMAND_COPIED_STATUS_TEXT` and `PIPELINE_COMMAND_FALLBACK_STATUS_TEXT` so the toolbar, Workflow tab, and Render tab show the same “Copied markdown pipeline command to clipboard” and “Run markdown pipeline in terminal: …” phrasing.
  - Shared empty-state and helper text copy is centralized in `canvas/src/lib/config.ts` and reused across panels where applicable. For example, `DATASET_EMPTY_TEXT` backs the “No dataset loaded.” helper in the Render → Dataset inspector section, and `NODE_EDITOR_EMPTY_TEXT` backs the “Select a node to edit its properties.” helper in the Node editor so canvas UI, documentation examples, and tests can reference a single source of truth for these phrases.
- LocalStorage keys and their semantic owners are cataloged via `getLsKeyDiagnostics()` in `canvas/src/lib/config.ts:851–857`. The `canvas/src/cli/settings-doc.ts` CLI consumes `LS_KEYS` and `LS_KEY_OWNERS` to generate the Settings registry table, and ad‑hoc diagnostics can import and log `getLsKeyDiagnostics()` to verify that every `LS_KEYS` entry is wired to an appropriate owner (for example `ui.icons`, `graphDataTable`, or `workflow.presets`) and that no stray keys exist outside the canvas scope.
- Selection semantics and anchor ids are documented via `SelectionAnchorIds` in `canvas/src/lib/graph/types.ts`, the shared `normalizeSelectionIds` helper in `canvas/src/components/GraphCanvas/highlight.ts`, and the `buildSelectionSubgraphForAnchorIds` helper in `canvas/src/lib/graph/file.ts` so schema docs, selection semantics docs, and UI help surfaces can all reference the same “selection anchors → selection subgraph” pipeline.

### Commands

- `npm run doc:lint` (from `canvas/`): runs `canvas/src/cli/lint-doc.ts` to regenerate all orchestrator, render, workflow preset, and settings tables.
- `npm run doc:sanity` (from `canvas/`): runs `canvas/src/cli/doc-sanity-check.ts` to assert that documentation tables match their registries and helpers.

### Codebase path provenance

- `codebasePath` fields on Agentic GraphRAG nodes capture repository-relative file paths and are surfaced as plain text in the Canvas Orchestrator tooling and Graph Data Table so curators can inspect and filter provenance without leaving the graph workspace.
- Canvas no longer opens external files inside the bottom panel Text Editor view; the `codebasePath` string is treated as opaque application metadata that stays aligned with AgenticRAG provenance and traversal documentation.
- Pipelines and external tools can still interpret `codebasePath` values using URL-style fragments (for example `#L<number>`, `#Lstart-end`, or `:colStart-colEnd`) and map repository-relative paths to Vite `@fs` URLs via `VITE_CODEBASE_ROOT`, but these lookups are performed outside the core canvas UI.
