# Knowgrph Tests Catalog

## Test Runner
- Entry: `canvas/src/tests/run.ts:31` exports `runAllTests()` that runs all unit tests and returns `{ name, ok, error? }[]`.
- Dev console hook: `canvas/src/tests/run.ts:77-79` exposes `window.knowgrphRunTests` in dev builds.
- How to run:
  - Start dev server: `cd canvas && pnpm install && pnpm run dev`.
  - Open the browser dev console and run `knowgrphRunTests()`.
  - Inspect the returned array; any failures include a message string.

## Organization
- Location: `canvas/src/__tests__/*.test.ts` export single test functions used by `runAllTests`.
- Scope: behavior-focused tests for parsers, transforms, cache, schema, panel UI, minimap.
- Execution: synchronously via `runAllTests` for speed and reproducibility without a separate runner.

## Naming & Structure
- Use descriptive names following “should[action]when[context]then[expectation]” in the exported test function id or description string.
- Arrange–Act–Assert inside each test function; prefer a single concept per test.
- Mock external dependencies only at boundaries; focus on observable behavior of store slices and transforms.

## Critical Paths Covered
- CSV/JSON‑LD roundtrip: `canvas/src/__tests__/roundtrip.test.ts`.
- Transform DSL: array paths, wildcards, min/max/avg/percentile including methods/HF: `canvas/src/__tests__/transformArrayPath.test.ts`, `wildcardAgg.test.ts`, `wildcardMinMaxAvg.test.ts`, `wildcardPercentile*.test.ts`.
- Custom parsers: conversion and warnings: `canvas/src/__tests__/customParser*.test.ts`.
- Parser registry CRUD and auto‑select: `canvas/src/__tests__/parserRegistry.test.ts`, `parserAutoApply.test.ts`.
- Cache: LRU basic and targeted clear: `canvas/src/__tests__/cache.test.ts`.
- UI/Panel: unified panel export and JSON editor rendering: `canvas/src/__tests__/panel.test.ts`, `jsonEditorRendering.test.ts`.
- Minimap: view rect: `canvas/src/__tests__/minimap.test.ts`.
- 2D selection highlight and zoom subsets: `canvas/src/__tests__/selectionHighlight.test.ts`, `selectionZoom.test.ts`.
- Settings: registry read/write: `canvas/src/__tests__/settings.test.ts`.
- AI‑KG JSON‑LD heuristics: edges/triples plus memory/agents slice fixture covering `graphRAGPath` traversal metadata: `canvas/src/__tests__/roundtrip.test.ts` (`testJsonLdAiKgEdges`, `testJsonLdAiKgMemoryAgentsSlice`, `testJsonLdAiKgWorkerPipeline`, `testJsonLdAiKgTriplesMatchD3`).

## AI‑KG Traversal & Manual Verification

- The AI‑KG query traversal highlight uses existing selection and schema wiring and is primarily a UX affordance rather than a data‑transforming feature; the traversal path is extracted by `findGraphRagTraversalEdgeIds` from `graphRAGPath.traverse` so the implementation lives in a small helper module rather than the panel view (`canvas/src/lib/graph/graphragTraversal.ts:1–49`).
- Manual verification recipe:
  - 1) Start dev: `cd canvas && pnpm install && pnpm run dev`; open the canvas in the browser.
  - 2) Apply the `Demo: AI KG Visualization` workflow preset and load `test-data/ai-kg-viz.json`.
  - 3) Import `schema-config/ai-kg-viz-schema.json` via the Schema tab so type colors, edge weights (`requires` vs `enables`), and per‑layer opacities (`three.layerOpacityByLayer`) match the prototype.
  - 4) Open the bottom panel **Render** tab, locate the `AI KG Layers & Traversal` block, and:
    - adjust `Layer 1/2/3 Opacity` sliders to verify that near‑field vs mid‑field vs far‑field bands become more or less prominent without affecting selection glow;
    - adjust `Force Separation` and confirm that overall spacing between clusters changes while springs still honor `layout.forces.linkDistanceByLabel`;
    - optionally change `Traversal Delay (ms)` to a slower value (for example 1200) for easier visual inspection.
  - 5) Click `AI KG Traversal`; confirm that:
    - edges and nodes along the `graphRAGPath.traverse` sequence (as resolved by `findGraphRagTraversalEdgeIds`) are selected one by one;
    - unrelated nodes/edges are dimmed but stay visible;
    - `requires` edges appear slightly thicker and more opaque than `enables` edges in 3D.
  - 6) Re‑run `knowgrphRunTests()` from the browser console to confirm that parsers, schema, cache, and panel tests still pass after traversal/schema changes.

## Floating Panel Traversal JSON Cheatsheet

For tests that need to open the Graph Traversal floating panel and keep traversal settings aligned with the Orchestrator, use this minimal JSON shape as a reference for defaults and overrides. The helper in `canvas/src/tests/lib/graphTraversalFloatingPanel.ts` consumes this shape directly.

```json
{
  "floatingPanelTraversal": {
    "eventType": "kg:floatingPanelOpen:graphTraversal",
    "orchestratorTraversalDelayMs": 900,
    "traversalQuery": {
      "traversalStartNodeId": "",
      "traversalMaxDepth": 2,
      "traversalLabelFilter": ""
    },
    "collapse": {
      "orchestratorGraphRagCollapsed": true,
      "orchestratorPresetsCollapsed": true,
      "orchestratorEditorCollapsed": true,
      "orchestratorContextCollapsed": true,
      "orchestratorWorkflowIndexingCollapsed": true,
      "orchestratorWorkflowTracingCollapsed": true
    }
  }
}
```

In tests, call `initGraphTraversalFloatingPanelHarness()` to seed `window.localStorage` with the JSON values above and then dispatch the open event:

```ts
import {
  initGraphTraversalFloatingPanelHarness,
  dispatchGraphTraversalFloatingPanelOpenEvent,
} from '@/tests/lib/graphTraversalFloatingPanel'

const env = initGraphTraversalFloatingPanelHarness()
dispatchGraphTraversalFloatingPanelOpenEvent(env.g)
```

This restores the floating panel (if minimized), switches it to the Graph Traversal view, and applies the shared traversal delay and collapse keys before running traversal‑focused assertions.

## Outputs & Actions
- A failing test returns `{ ok: false, error: '<message>' }` from the runner.
- Use the failure message to navigate to the corresponding module and fix behavior; re-run via `knowgrphRunTests()`.

## Troubleshooting
- If `knowgrphRunTests` is undefined, ensure dev mode: start the dev server.
- Tests rely on feature modules; fix behavior in the referenced file path and re-run.
- Use small, focused tests; avoid mocking internals beyond boundary APIs.

## Clean‑Slate Boot & Global Reset
- Boot purge ensures tests start from an empty graph: `canvas/src/pages/Canvas.tsx:35–39`.
- Settings tab “Global Reset” resets history/selection/schema and purges persistence: `canvas/src/features/panels/views/SettingsView.tsx:59–66`.
- Parser UI `reset()` clears counts/warnings/script, useful for UI state tests: `canvas/src/features/parsers/uiState.ts:46–51`.
## Coverage Matrix (Groups)
- Parsers: registry CRUD, auto-select, custom conversion, worker-backed Python.
- Transform DSL: array indexing, wildcards, min/max/avg/percentile with method/HF variants.
- Export/IO: CSV/JSON‑LD roundtrip, combined export, cache version keys.
- UI/Panel: unified panel export, JSON editor rendering, and Role → Actions → Outcome tooltip alignment (Orchestrator, Graph Fields icon legend, Graph Fields ↔ Graph Data Table mapping, Graph Data Table curation).
- Settings & Minimap: registry read/write and minimap view rect.

### AgenticRAG tooltip fixtures by RACI role

AgenticRAG tooltip alignment tests live in `canvas/src/__tests__/orchestratorCopy.test.ts` and enforce that each Role → Actions → Outcome tooltip matches a shared `rag:RoleActionOutcome` JSON-LD fixture under `schema-config/`. New semantic-frame helpers should be implemented with `buildRoleActionOutcomeTooltip` in `canvas/src/lib/config.ts` so tests and JSON-LD stay aligned. When a test fails, use this index to jump from the failure message to the relevant role and fixture; for a fixture → helper → UI surface index, see the RAO mapping tables in `knowgrph-raci-document.md` and `knowgrph-semantics-document.md`.

- Parser:
  - Tooltip/helper: `WORKFLOW_STEP3_PARSER_TOOLTIP`
  - Fixture: `schema-config/workflow-step3-parser-role-action-outcome.jsonld`
- Curator:
  - Tooltips/helpers: `GRAPH_DATA_TABLE_CURATION_TOOLTIP`, `WORKFLOW_STEP8_BOTTOM_TABS_TOOLTIP`
  - Fixtures: `schema-config/graph-data-table-curation-role-action-outcome.jsonld`, `schema-config/workflow-step8-bottom-tabs-role-action-outcome.jsonld`
- Orchestrator:
  - Tooltips/helpers: `ORCHESTRATOR_TRAVERSAL_TOOLTIP`, `WORKFLOW_STEP6_ORCHESTRATOR_TOOLTIP`, `TRAVERSAL_PRESET_UI_TOOLTIP`, `WORKFLOW_LINKS_TOOLTIP`, `AGENTIC_REASONING_LABELS_TOOLTIP`, `HELP_CHEATSHEET_ALIGNMENT_TOOLTIP`
  - Fixtures: `schema-config/orchestrator-role-action-outcome.jsonld`, `schema-config/workflow-step6-orchestrator-role-action-outcome.jsonld`, `schema-config/traversal-preset-ui-role-action-outcome.jsonld`, `schema-config/workflow-links-role-action-outcome.jsonld`, `schema-config/agentic-reasoning-labels-role-action-outcome.jsonld`, `schema-config/help-cheatsheet-alignment-role-action-outcome.jsonld`
- Schema:
  - Tooltips/helpers: `GRAPH_FIELDS_ICON_LEGEND_TOOLTIP`, `GRAPH_FIELDS_GRAPH_DATA_TABLE_MAPPING_TOOLTIP`
  - Fixtures: `schema-config/graph-fields-icon-legend-role-action-outcome.jsonld`, `schema-config/graph-fields-table-mapping-role-action-outcome.jsonld`
- Indexers:
  - Tooltips/helpers: `HELP_CODEBASE_INDEX_ENTRY_POINTS_TOOLTIP`, `GRAPHRAG_PATH_METADATA_TOOLTIP`
  - Fixtures: `schema-config/help-codebase-index-entry-points-role-action-outcome.jsonld`, `schema-config/graphrag-path-metadata-role-action-outcome.jsonld`

For fixture-centric debugging, the RAO mapping tables in `knowgrph-raci-document.md` and `knowgrph-semantics-document.md` list each `schema-config/*role-action-outcome.jsonld` file alongside its tooltip helper constant and primary UI surface so you can move from a failing test → JSON-LD fixture → panel or Help surface without hunting through the codebase.

## Red‑Green‑Refactor
- Write the failing test first; run `knowgrphRunTests()` to see red.
- Implement minimal changes to pass; re-run to get green.
- Refactor for clarity and performance; ensure tests stay green.

## Quick Commands
- Start dev: `cd canvas && pnpm install && pnpm run dev`.
- Run all tests: open dev console and call `knowgrphRunTests()`.
- Inspect results: returns `{ name, ok, error? }[]`; sort or filter in console as needed.
- Full TypeScript typecheck (all canvas code): `cd canvas && pnpm run check`.
- Focused strict typecheck for AgenticRAG pipeline, traversal, minimap/three, and AgenticRAG tests: `cd canvas && pnpm run typecheck:agenticrag` (use when touching AgenticRAG schema, workflow JSON-LD, graphRAGPath traversal, or related visualization helpers).

## Shared Test Harnesses
- In-memory storage:
  - `canvas/src/tests/lib/memoryStorage.ts` exports `MemoryStorage` and `createMemoryStorage(initial?)` for tests that need a `Storage` implementation without touching real `localStorage`.
  - Used by settings/theme/persistence tests and any feature that reads or writes `LS_KEYS` into storage.
- Window + DOM harness:
  - `canvas/src/__tests__/bottomPanelDomHarness.ts` sets up deterministic `addEventListener`/`dispatchEvent` behavior for DOM events and exposes `DOM_HARNESS_TEXT` plus `createTextareaHarness()` for selection and scroll assertions.
  - Used by bottom-panel code source tests to validate `kg:open-codebase-path` behavior and text selection for `Lx-y:colStart-colEnd` fragments.
- Window + CustomEvent + navigator + localStorage:
  - `canvas/src/tests/lib/windowHarness.ts` exports `initWindowHarness({ storage?, navigatorOnline?, withCustomEvent? })`.
  - Normalizes `globalThis.window`, `localStorage`, `navigator.onLine`, and `CustomEvent`/`dispatchEvent` for tests that depend on window wiring.
  - Returns `{ g, storage, restore }`; always call `restore()` at the end of the test to avoid cross-test leakage.
  - Used by bottom-panel persistence tests (`canvas/src/__tests__/bottomPanelPersistence.test.ts`) and schema persistence tests (`canvas/src/__tests__/schema.test.ts`) to drive behavior against an isolated window and storage environment.
