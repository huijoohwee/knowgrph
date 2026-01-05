## Scope & Outcome
- Update `knowgrph-workflow-catalog.md` to document the end-to-end workflow from user "Load Data" to rendering the Knowledge Graph on canvas.
- Cross-reference configurable controls from `knowgrph-settings-catalog.md` where settings influence parsing, state, layout, zoom, labels, performance, and panels.

## E2E Workflow (Step-by-Step)
- Trigger: Toolbar click → `canvas/src/components/Toolbar.tsx:85` calls `handleLoad`.
- File pick: `canvas/src/lib/graph/file.ts:31` reads `{ name, text }` via native file picker.
- Parser select: `canvas/src/features/parsers/registry.ts:43` chooses `bestMatch` among built-ins and custom specs.
- Parse execute: `canvas/src/features/parsers/registry.ts:29` runs `applyParserAsync`; Python may use worker when enabled.
- Data commit: `canvas/src/features/parsers/loader.ts:28` calls `useGraphStore.setData`; core handler in `canvas/src/hooks/store/graphDataSlice.ts:7`.
- Minimap refresh: quick + async preview recompute via `canvas/src/hooks/store/graphDataSlice.ts:12–15` and minimap slice `canvas/src/features/minimap/store.ts:22`, `41`.
- Render build: `canvas/src/components/GraphCanvas.tsx:50` initializes SVG, zoom, D3 simulation.
- Simulation forces: `canvas/src/components/GraphCanvas/simulation.ts:12` builds link/charge/collision/center; alphaDecay applied when set.
- Elements bind: nodes/edges/labels created and styled from schema at `canvas/src/components/GraphCanvas.tsx:81–185`.
- Tick loop: `canvas/src/components/GraphCanvas.tsx:186–200` updates positions.
- Interactions: edge creation, selection highlight, context menu, drag behavior at `canvas/src/components/GraphCanvas.tsx:111–163`, `296–364`.
- Zoom control: requests applied via `canvas/src/components/GraphCanvas/zoomController.ts:24` (in/out/reset/fit/selection/transform).

## Parser Catalog (Referenced)
- CSV → `canvas/src/lib/graph/csv.ts:121`.
- JSON-LD → `canvas/src/lib/graph/jsonld.ts` (parse function).
- Raw JSON → `canvas/src/lib/graph/rawToGraph.ts:3`.
- N8n → `canvas/src/lib/graph/n8n.ts` (is/parse functions).
- GraphRAG → `canvas/src/lib/graph/graphrag.ts` (is/parse functions).
- Python → `canvas/src/features/parsers/python/index.ts` (`parse`, `parseAsync`).
- Registry & loader glue: `canvas/src/features/parsers/registry.ts:1–48`, `canvas/src/features/parsers/loader.ts:14–36`.

## Settings Influence Map (Cross-Refs)
- Panel height: `bottomPanelHeightRatio` → bottom panel sizing and drag (`canvas/src/components/BottomPanel.tsx`, `canvas/src/features/hooks/useDragResize.ts`).
- History debounce: `historyDebounceMs` → `canvas/src/hooks/store/historySlice.ts:11`, affects snapshot timing after `setData`.
- Label LOD: `performance.lod.hideLabelsBelowScale` → `canvas/src/components/GraphCanvas/zoom.ts` (opacity gating) and `GraphCanvas.tsx` label rendering.
- Layout forces: `layout.forces.{charge,alphaDecay,collisionByType,linkDistanceByLabel}` → `canvas/src/components/GraphCanvas/simulation.ts:19–29`.
- Drag behavior: `behavior.allowNodeDrag`/`snapGrid`/constraints → `canvas/src/components/GraphCanvas.tsx:111–113`, `.../drag.ts`.
- Edge creation: `behavior.allowEdgeCreation`/duplicates/self-loops/global → handlers in `canvas/src/components/GraphCanvas.tsx:119–156`, validators in `canvas/src/features/schema/validation.ts`.
- Label styles: `labelStyles.{fontSize,color,offset}` → `canvas/src/components/GraphCanvas.tsx:179–183` and refresh effect `366–387`.
- Tab sync and UI opacities: `enableTabSync`, `uiOverlayOpacity`, `uiPanelOpacity`, `uiToolbarOpacity` → applied in `canvas/src/pages/Canvas.tsx` and store `uiSlice`.

## Verification (Tests)
- Parser auto-select: `canvas/src/__tests__/parserAutoApply.test.ts`.
- Parser UI state hydration: `canvas/src/__tests__/parserUiState.test.ts`.
- Roundtrip parsing/export: `canvas/src/__tests__/roundtrip.test.ts` (CSV, JSON-LD).
- Minimap math: `canvas/src/__tests__/minimap.test.ts`.
- Tab sync envelope: `canvas/src/__tests__/tabSync.test.ts`.
- N8n parsing: `canvas/src/__tests__/n8nParse.test.ts`.

## Document Update Plan
- Replace the current table with an expanded, E2E table: `Phase | Step | Responsibility | Modules | Functions | Input | Output | Settings | Tests`.
- Add a bullet-flow overview at the top linking each step to code references (use `file_path:line_number`).
- Add a "Settings Influence" section referencing keys from `knowgrph-settings-catalog.md` with direct code hooks.
- Add a "Verification" section listing tests that cover each phase.
- Keep entries concise and example-driven per catalog style; ensure line numbers match the current repository state.

## Deliverable
- Updated `knowgrph-workflow-catalog.md` with the above structure, including explicit code references and settings cross-links, ready for review.