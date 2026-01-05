## Goals
- Add a bottom-left minimap overlay that shows the entire canvas and allows navigation
- Extract utilities into feature-scoped modules to keep files under 600 lines while preserving the current API
- Clean up conflicting, hardcoded, stale, duplicate, re-render, infinite-loop, and memory-leak issues

## Minimap Feature
- Placement: in `canvas/src/pages/Canvas.tsx` inside the main `relative overflow-hidden` container, add an absolute overlay: a `Minimap` component at `bottom-3 left-3 z-40`
- Component: create `features/minimap/Minimap.tsx` rendering an SVG preview of the graph
  - Inputs: read `nodes`/`edges` from `useGraphStore` (positions from `GraphCanvas` tick if available), canvas dims from `canvasSlice`, current zoom transform from `tabSync`
  - Sync: subscribe to `ZoomTransformChanged` from `lib/tabSync.ts` and reflect the viewport rectangle
  - Interaction: click/drag within minimap pans the main canvas by dispatching `requestZoom` (`canvas/src/hooks/store/canvasSlice.ts`)
- Rendering:
  - Draw nodes as small points and edges as thin lines, scaled to minimap size (no forces)
  - Compute viewport rect from current zoom transform; throttle to avoid over-render
  - Use `requestAnimationFrame` batching, `useMemo` for scaled positions, and `React.memo` to avoid unnecessary updates
- Styling:
  - Compact (e.g., 160×120 px), semi-transparent background, subtle border
  - Pointer-events enabled with hover highlight; respect existing UI opacity settings

## API Preservation
- Keep public exports intact; add new modules with local `index.ts` re-exports
- Where imports change due to extraction, preserve alias paths to avoid breaking existing consumers

## Refactor Plan (Feature-Scoped Modules)
- Bottom Panel (`canvas/src/components/BottomPanel.tsx` — 520 lines):
  - Extract table/scroll/selection utilities into `features/bottom-panel/utils.ts`
  - Keep `NodesTable.tsx` and `EdgesTable.tsx` as-is, move shared logic (sorting, selection sync) to `features/bottom-panel`
- Toolbar (`canvas/src/components/Toolbar.tsx` — 384 lines):
  - Extract search, settings, and overlay helpers into `features/toolbar` (reuse `lib/ui/overlay.tsx`)
- Schema Editor (`canvas/src/components/SchemaEditorPanel.tsx` — 484 lines):
  - Split large sections into subcomponents under `features/schema-editor` (forms, validators, preview)
- Store (`canvas/src/hooks/store/schemaSlice.ts` — 440 lines):
  - Move validators/serializers to `features/schema` (keep slice API intact), reduce slice file size by delegating helpers
- Graph Canvas (`canvas/src/components/GraphCanvas.tsx` — 333 lines):
  - Already modular (`zoom.ts`, `simulation.ts`, `highlight.ts`, `fit.ts`, `drag.ts`, `edgeCreate.ts`); add a small `features/minimap/state.ts` to expose read-only node/edge positions for the minimap

## Cleanup & Hardening
- Hardcoded values: move magic numbers (e.g., highlight durations, opacities) into `uiSlice` defaults and config constants
- Duplicate/stale code: centralize selection scroll/center logic into a shared util (`lib/editor.ts` or `features/bottom-panel/utils.ts`)
- Re-render control: add `React.memo`, `useMemo`, and `useCallback` where props are stable; ensure Zustand selectors use shallow equality
- Infinite loops: audit `useEffect` dependencies and guard with stable deps; prevent state ping-pong between tab sync and local updates
- Memory leaks: ensure D3 simulation stops and listeners detach on unmount in `GraphCanvas.tsx`; unsubscribe `tabSync` in all subscribers; avoid lingering `setInterval`/`requestAnimationFrame` without cleanup

## Testing & Verification
- Unit tests: viewport mapping math (minimap ↔ main canvas), `requestZoom` dispatch on interactions
- Integration tests: selection sync and zoom sync via `lib/tabSync.ts`
- Dev verification: run `pnpm dev`, confirm minimap overlay position and responsiveness; test cross-tab zoom behavior
- Performance: validate minimal re-render counts when panning/zooming; ensure no memory leaks on rapid mount/unmount cycles

## Deliverables
- `features/minimap` with `Minimap.tsx`, hooks/state helpers, and tests
- Refactored modules for bottom panel, toolbar, schema editor, and store helpers (API preserved)
- Cleanup changes applied across affected components and slices

## Key References
- Canvas layout: `canvas/src/pages/Canvas.tsx`
- Main renderer: `canvas/src/components/GraphCanvas.tsx` and `GraphCanvas/zoom.ts`
- Store slices: `canvas/src/hooks/useGraphStore.ts`, `hooks/store/*`
- Tab sync: `canvas/src/lib/tabSync.ts`
- Bottom panel: `canvas/src/components/BottomPanel.tsx`, `BottomPanel/NodesTable.tsx`, `BottomPanel/EdgesTable.tsx`

Please confirm to proceed with implementation and verification.