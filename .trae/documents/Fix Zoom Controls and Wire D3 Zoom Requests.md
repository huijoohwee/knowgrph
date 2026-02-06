## Objectives
- Make "Fit to Screen", "Reset Zoom", and "Zoom to Selection" work through the existing toolbar
- Keep "Zoom In/Out" behavior consistent and smooth
- Preserve the current public API; align store typings with actual usage
- Unblock minimap pan/center and viewport tracking
- Keep zoom logic unified across 2D renderers (D3 + Flow) and Flow Editor overlays

## Root Cause (Summary)
- Toolbar dispatches `zoomRequest`, but `canvas/src/components/GraphCanvas.tsx` does not consume or apply the request
- `createZoom` never reports live transforms to the store, so `zoomState` is always null
- Minimap sends `requestZoomTransform({k,x,y})`; GraphCanvas ignores it
- Store typings in `canvas/src/hooks/useGraphStore.ts` omit `'reset' | 'selection' | 'transform'` causing contract mismatch
- `fitAllTransform` exists but isn’t used for "Fit to Screen"

## Targeted Changes
1. SSOT viewport math (`canvas/src/lib/zoom/viewport.ts`)
   - Centralize `worldToScreen`, `screenToWorld`, and viewport-center conversion
   - Provide pinned-viewport resize adjustment and initial zoom picking
   - Remove the legacy `canvas/src/components/GraphCanvas/zoomState.ts`

2. Shared zoom action engine (`canvas/src/lib/zoom/actions.ts`)
   - Compute the next `d3.ZoomTransform` for `in/out/fit/reset/selection/transform`
   - Use an LRU cache for fit transforms keyed by:
     - `graphDataRevision`, `viewportW/H`, zoom intent, selection signature
     - schema fit-affecting fields (layout + label + behavior)
   - Keep behavior consistent across D3 GraphCanvas and FlowCanvas

3. Wire renderers to the shared engine
   - D3 GraphCanvas request consumption stays in `canvas/src/components/GraphCanvas/zoomController.ts` and delegates to the shared engine
   - Initial auto-fit in `canvas/src/components/GraphCanvas/scene.ts` uses the same shared engine (no ad-hoc fit math)
   - FlowCanvas request consumption in `canvas/src/components/FlowCanvas.tsx` delegates to the shared engine

4. SSOT tokens
   - Copy tokens: `COPY_ZOOM_*` exported from `canvas/src/lib/config-copy/uiMeta.ts`
   - Local storage tokens: viewport-related keys centralized in `canvas/src/lib/config.ls.ts`

## Validation & QA
- Manual verification in the running app:
  - Click each toolbar button and confirm expected behavior
  - Minimap click pans/centers and viewport rectangle follows live zoom
- Technical checks:
  - Confirm `zoomState` updates on wheel/drag (store inspector/log)
  - Verify no infinite re-render loops: ensure `useEffect` depends only on `zoomRequest` identity
  - Confirm cleanup of D3 listeners on unmount in `createZoom`
- Tests:
  - Add unit coverage for pinned viewport adjustment, initial zoom pick, and SSOT zoom action caching

## Cleanup & Hardening
- Remove stale guards in `GraphCanvas.tsx` that reference `zoomRequest` only to suppress auto-zoom; replace with explicit request consumption
- Clamp scale to the min/max defined in `createZoom`
- Handle empty graph safely: `fit` falls back to identity
- Ensure selection-zoom defaults to `fit` when no selection

## Deliverables
- Functional toolbar: Fit to Screen, Reset Zoom, Zoom to Selection, Zoom In/Out
- Minimap works: viewport reflects live zoom; click-to-pan applies immediately
- Aligned store typings and consistent zoom orchestration
- Unified zoom behavior across 2D renderers and Flow Editor overlays

## Files Involved (no API changes)
- `canvas/src/components/Toolbar.tsx` (no change expected)
- `canvas/src/pages/Canvas.tsx` (no change expected)
- `canvas/src/components/GraphCanvas.tsx` (wire requests and state)
- `canvas/src/components/GraphCanvas/fit.ts` (already present; import/use)
- `canvas/src/components/GraphCanvas/zoom.ts` (pass `onZoomTransform`)
- `canvas/src/components/GraphCanvas/zoomController.ts` (request applier)
- `canvas/src/lib/zoom/actions.ts` (shared compute engine)
- `canvas/src/lib/zoom/viewport.ts` (viewport SSOT math)
- `canvas/src/hooks/useGraphStore.ts` (typing and selectors)

## Risks & Mitigations
- D3 transitions conflicting with user drag: gate programmatic transitions and cancel on new user input
- Rapid consecutive requests: use request timestamps to avoid re-applying stale actions
- Large graphs performance: keep transitions lightweight and avoid layout recomputation

If you approve, I’ll implement these changes and verify the behavior end-to-end.
