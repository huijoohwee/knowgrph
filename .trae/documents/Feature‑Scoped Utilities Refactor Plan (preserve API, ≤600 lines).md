## Goals
- Extract utilities into feature‑scoped modules while preserving current import API
- Reduce oversized files (target ≤600 lines); slice store and component helpers
- Remove conflicting/hardcoded/stale/duplicate code; centralize constants

## Key Findings
- Oversized: `canvas/src/hooks/useGraphStore.ts` (~819 lines) and several components (BottomPanel ~558, GraphCanvas ~514, SchemaEditorPanel ~472)
- Utilities already grouped under `src/lib/graph`, `src/lib/ui`, `src/lib/editor` but no barrel indexes
- Hardcoded paths/URLs: `PUBLIC_FALLBACK` (`unicornLoader.ts`), `vite.config.ts:clickUrl`, pipeline fixed paths, JSON‑LD vocab URLs
- Stale/unused: `useTheme.ts`, `lib/graph/unicornLoader.ts` export, `components/Empty.tsx`
- Routing consolidation is present: `canvas/src/App.tsx:1`–`13` redirect `/canvas` → `/`

## Refactor Strategy
- Use Zustand slice pattern to split `useGraphStore` into focused modules; keep `useGraphStore` export and function names unchanged
- Extract component‑level utilities from large components into local feature modules to shorten files
- Introduce central config/constants to remove hardcoded values; prefer `import.meta.env` with safe defaults
- Add barrels to preserve API and provide stable re‑exports when files move
- Remove unused exports or wire them to actual usage

## Store Slicing (preserve API)
- Keep `useGraphStore` path and export; internally compose slices
- Create modules under `canvas/src/hooks/store/`:
  - `graphDataSlice.ts` — node/edge CRUD and updates
    - Maps from `updateNode`, `addNode`, `removeNode`, `addEdge`, `updateEdge`, `removeEdge` (refs: `useGraphStore.ts:137`, `173`, `207`)
  - `selectionSlice.ts` — `selectedNodeId`, `selectedEdgeId`, `selectNode`, `selectEdge`
  - `historySlice.ts` — `history`, `historyIndex`, `historyDebounceMs`, `scheduleHistory`, undo/redo
  - `uiSlice.ts` — `isEditMode`, `isSidebarOpen`, `uiOverlayOpacity`, `uiPanelOpacity`, `uiToolbarOpacity` + setters (refs: `useGraphStore.ts:55`, `356`, `360`, `364`)
  - `canvasSlice.ts` — `canvasDims`, `canvasPos`, `setCanvasDims`, `setCanvasPos` (ref: `useGraphStore.ts:381`)
  - `schemaSlice.ts` — schema styles/behavior/catalog/property schema ops (refs: `useGraphStore.ts:415`, `502`, `535`, `623`, `702`, `759`)
- Move local storage helpers (`lsNum`) into `canvas/src/lib/persistence.ts`; reuse inside `uiSlice`
- Re‑export everything through `hooks/useGraphStore.ts` to preserve API

## Component Utility Extraction
- `GraphCanvas.tsx` — extract D3 zoom/drag/layout helpers into `canvas/src/lib/graph/layout.ts` and `canvas/src/components/GraphCanvas/utils.ts`
- `BottomPanel.tsx` — extract logical sub‑features:
  - `PropertyEditor.tsx`, `EdgeEditor.tsx`, `HistoryTimeline.tsx` under `components/BottomPanel/`
- `SchemaEditorPanel.tsx` — extract schema property builder and validation helpers into `lib/graph/schemaEditor.ts`
- Keep public component exports and routes unchanged; internal helpers move to feature modules

## Constants & Config (remove hardcodes)
- Add `canvas/src/lib/config.ts`:
  - `CLICK_URL` (from `vite.config.ts`), `PUBLIC_FALLBACK_JSON` (from `unicornLoader.ts`), pipeline paths
  - Prefer `import.meta.env.VITE_*` overrides; fall back to safe defaults
- Update callers to import from config; keep current behavior default‑compatible

## Barrels (preserve API while moving code)
- Add `index.ts` barrels:
  - `canvas/src/lib/graph/index.ts` — re‑export `types`, `schema`, `file`, `csv`, `jsonld`, `layout`
  - `canvas/src/lib/ui/index.ts` — re‑export `overlay`
  - `canvas/src/hooks/store/index.ts` — re‑export slices (internal)
- Leave existing import paths valid; only internal modules use barrels for organization

## Remove/Resolve Stale & Duplicates
- Remove `canvas/src/hooks/useTheme.ts` if truly unused; or wire to CSS variables
- Remove `canvas/src/components/Empty.tsx` if unused
- Mark `lib/graph/unicornLoader.ts` as dev/demo; guard behind config; if unused, remove
- Confirm no duplicate util implementations — current scans show none

## Routing & API Notes
- Keep `App.tsx` redirect (`canvas/src/App.tsx:1`–`13`) as is
- No backend server module — all utilities remain client‑side

## Verification
- Type‑level: TS build must pass unchanged public signatures
- Behavior: run the app and exercise node/edge CRUD, schema edits, opacity controls, canvas position
- Add lightweight unit tests for slices (Vitest) for history, selection, graph ops
- Add ESLint `max-lines` rule set to `600` for `src/**/*.{ts,tsx}` to prevent regressions

## Rollout Steps
1) Create store slice modules and local storage helper; update `useGraphStore` to compose slices with identical API
2) Extract `GraphCanvas` helpers and BottomPanel subcomponents; keep exports stable
3) Introduce `lib/config.ts` and replace hardcoded values in `vite.config.ts`, `unicornLoader.ts`, pipeline scripts
4) Add `index.ts` barrels (graph/ui) for organization without changing external imports
5) Remove or wire unused modules (`useTheme`, `Empty`, `unicornLoader`)
6) Run build and smoke tests; add slice unit tests; enable ESLint `max-lines` guard

## Expected Outcomes
- Files ≤600 lines for store and major components
- No API changes for imports; behavior preserved
- Hardcoded values centralized; stale code removed; no duplicates
