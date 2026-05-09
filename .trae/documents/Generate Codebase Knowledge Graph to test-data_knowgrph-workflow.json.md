## Goal
- Generate a comprehensive knowledge graph for the entire repository, saved as `test-data/knowgrph-workflow.json`.
- Format compatible with the app’s loaders: raw `{ nodes, edges }` with `data` fields, so it can be auto-converted via `rawToGraphData`.

## Graph Schema
- Node types: `File`, `Component`, `Feature`, `Slice`, `Parser`, `Worker`, `Test`, `Script`, `Config`.
- Edge labels:
  - `imports` (file→file/module), `exports`, `renders` (component→component), `invokes` (file→function), `updatesStore` / `readsStore`, `parses` (parser→graph), `usesWorker`, `providesPanel`, `writesCssVar`, `producesOutput` (script→artifact), `consumesInput`.
- Node shape: `{ id, data: { type, name, path } }` (+ extras as needed).
- Edge shape: `{ id, source, target, data: { type: <label>, weight?: number, meta?: {...} } }`.

## Extraction Targets
- Source trees:
  - `canvas/src/**` (components, features, hooks, lib, workers, tests)
  - `scripts/**` (pipeline and extractors)
  - `configs/**`, `data/**`, `test-data/**` (link as artifacts)
- Special handling:
  - Components: `GraphCanvas.tsx`, `Toolbar.tsx`, panels, tables
  - Store slices: `canvas/src/hooks/store/*.ts`
  - Parsers: `canvas/src/features/parsers/**`
  - Workers: `canvas/src/workers/**`
  - Tests: `canvas/src/__tests__/**`

## Extraction Algorithm
- Directory walk and parse:
  - For `.ts/.tsx/.mjs/.js`: collect imports/exports via TypeScript compiler API (`typescript` is present in `devDependencies`).
  - Detect components: functions returning JSX or default exported React components → node type `Component`.
  - Detect store usage: references to `useGraphStore` → edges `readsStore`/`updatesStore` (by method names).
  - Detect parsing workflow: calls to `bestMatch`, `applyParserAsync`, `pickTextFile` → edges `invokes`.
  - Detect workers: file path under `workers/` → node type `Worker`; edges from callers using `parseGraphInWorker`, minimap `workerClient` → `usesWorker`.
  - Link scripts to inputs/outputs via `scripts/pipeline.py` and extractor scripts → `producesOutput`, `consumesInput` edges.
- Artifacts:
  - Link `canvas/public/settings-flow.json`, `test-data/*` and `data/outputs/*` as `Artifact` nodes.

## Output & Location
- Write JSON to `${KG_GITHUB_ROOT}/knowgrph/test-data/knowgrph-workflow.json`.
- Format aligns with `rawToGraphData` (`canvas/src/lib/graph/rawToGraph.ts:3`).

## Implementation Steps
1. Create `scripts/extract-workflow-graph.mjs`:
   - Walk repo, parse files (TypeScript AST for imports/exports; fallback regex for simple identifiers).
   - Build nodes/edges per schema; deduplicate by `path` and `label`.
   - Include meta: `lineCount`, `exports`, `imports` names for nodes.
   - Emit JSON at `test-data/knowgrph-workflow.json`.
2. Run the script locally (no external deps) and validate JSON structure.
3. Verify in app:
   - Use Toolbar → Load Data to import the JSON; confirm it renders and counts look sane.
   - Optionally export CSV/JSON to confirm roundtrip.

## Verification Plan
- Validate via loaders: raw JSON should auto-convert; check node/edge counts.
- Sanity checks:
  - Each TS/TSX file appears as a `File` or `Component` node.
  - Known relationships present: `Toolbar.tsx` → `loader.ts` (`invokes`), `GraphCanvas.tsx` → `simulation.ts` (`imports`), parsers registry linked.
- Tests referenced for cross-check:
  - `parserRegistry.test.ts`, `parserAutoApply.test.ts`, `minimap.test.ts` to ensure key modules are captured.

## Safety & Performance
- No external network calls; pure local file traversal.
- Scale guards: cap extremely large edges (e.g., import edges) with sampling if needed to keep graph usable; include `meta.counts`.

## Deliverable
- A generated `test-data/knowgrph-workflow.json` ready to load in the app, representing the repository’s structure and key workflow relationships.