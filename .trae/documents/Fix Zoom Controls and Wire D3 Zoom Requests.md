## Objectives
- Make "Fit to Screen", "Reset Zoom", and "Zoom to Selection" work through the existing toolbar
- Keep "Zoom In/Out" behavior consistent and smooth
- Preserve the current public API; align store typings with actual usage
- Unblock minimap pan/center and viewport tracking
- Keep files under 600 lines by extracting zoom orchestration into feature-scoped utilities

## Root Cause (Summary)
- Toolbar dispatches `zoomRequest`, but `canvas/src/components/GraphCanvas.tsx` does not consume or apply the request
- `createZoom` never reports live transforms to the store, so `zoomState` is always null
- Minimap sends `requestZoomTransform({k,x,y})`; GraphCanvas ignores it
- Store typings in `canvas/src/hooks/useGraphStore.ts` omit `'reset' | 'selection' | 'transform'` causing contract mismatch
- `fitAllTransform` exists but isn’t used for "Fit to Screen"

## Targeted Changes
1. Store typing alignment (`canvas/src/hooks/useGraphStore.ts`)
   - Extend `zoomRequest.type` to `'in' | 'out' | 'fit' | 'reset' | 'selection' | 'transform'`
   - Add `payload?: { k: number; x: number; y: number }` for `transform`
   - Expose `requestZoomTransform(payload)` and `zoomState`/`setZoomState(t)`

2. Wire D3 zoom to the store (`canvas/src/components/GraphCanvas.tsx`)
   - Pass `onZoomTransform` into `createZoom(...)` to call `setZoomState({k,x,y})` on every zoom event
   - Add a `useEffect` that reacts to `zoomRequest` and applies actions via the existing `d3.zoom` instance:
     - `in/out`: read current transform; scale by factor (e.g., ×1.2 / ×0.8) with transition
     - `fit`: use `fitAllTransform(nodes, width, height)` and apply
     - `reset`: apply `d3.zoomIdentity`
     - `selection`: re-apply current selected node/edge fit without requiring a selection change
     - `transform`: apply `translate(x, y).scale(k)` from minimap payload
   - Clear or acknowledge the processed request (e.g., by timestamp/sequence) to avoid repeated application

3. Use fit utilities (`canvas/src/components/GraphCanvas/fit.ts`)
   - Import and use `fitAllTransform` for "Fit to Screen"
   - Continue using `fitNodeTransform` / `fitEdgeTransform` for selection-based focusing

4. Extract orchestration utility (keep files <600 lines)
   - Create `canvas/src/components/GraphCanvas/zoomController.ts` to host:
     - `applyTransform(svg, g, zoom, {k,x,y}, opts)` — central helper with transition
     - `applyZoomRequest(zoomRequest, context)` — switch that computes target transform and calls `applyTransform`
   - Keep `GraphCanvas.tsx` thin: initialize refs, pass `onZoomTransform`, and delegate to `zoomController`
   - Preserve existing public APIs (store functions, component props) unchanged

5. Minimap integration (`canvas/src/features/minimap/Minimap.tsx`)
   - No changes required; once `zoomState` updates and `transform` requests are consumed, minimap viewport and click-to-pan work

## Validation & QA
- Manual verification in the running app:
  - Click each toolbar button and confirm expected behavior
  - Minimap click pans/centers and viewport rectangle follows live zoom
- Technical checks:
  - Confirm `zoomState` updates on wheel/drag (store inspector/log)
  - Verify no infinite re-render loops: ensure `useEffect` depends only on `zoomRequest` identity
  - Confirm cleanup of D3 listeners on unmount in `createZoom`
- Optional tests (lightweight):
  - Store-level unit tests for `requestZoom(type)` and `requestZoomTransform(payload)`
  - Component-level smoke test ensuring effect runs when `zoomRequest` changes (mock D3 API)

## Cleanup & Hardening
- Remove stale guards in `GraphCanvas.tsx` that reference `zoomRequest` only to suppress auto-zoom; replace with explicit request consumption
- Clamp scale to the min/max defined in `createZoom`
- Handle empty graph safely: `fit` falls back to identity
- Ensure selection-zoom defaults to `fit` when no selection

## Deliverables
- Functional toolbar: Fit to Screen, Reset Zoom, Zoom to Selection, Zoom In/Out
- Minimap works: viewport reflects live zoom; click-to-pan applies immediately
- Aligned store typings and consistent zoom orchestration
- `GraphCanvas.tsx` kept concise with logic extracted to `zoomController.ts`

## Files Involved (no API changes)
- `canvas/src/components/Toolbar.tsx` (no change expected)
- `canvas/src/pages/Canvas.tsx` (no change expected)
- `canvas/src/components/GraphCanvas.tsx` (wire requests and state)
- `canvas/src/components/GraphCanvas/fit.ts` (already present; import/use)
- `canvas/src/components/GraphCanvas/zoom.ts` (pass `onZoomTransform`)
- `canvas/src/components/GraphCanvas/zoomController.ts` (new utility)
- `canvas/src/hooks/useGraphStore.ts` (typing and selectors)

## Risks & Mitigations
- D3 transitions conflicting with user drag: gate programmatic transitions and cancel on new user input
- Rapid consecutive requests: use request timestamps to avoid re-applying stale actions
- Large graphs performance: keep transitions lightweight and avoid layout recomputation

If you approve, I’ll implement these changes and verify the behavior end-to-end.