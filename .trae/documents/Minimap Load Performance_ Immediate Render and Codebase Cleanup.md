## Diagnosis
- Clicking `Load Data` calls `handleLoad` → `loadGraphFile()` → `setData(loaded)` in `canvas/src/components/Toolbar.tsx:50-59`.
- Minimap renders from store `data` and `canvasDims` in `canvas/src/features/minimap/Minimap.tsx:10-21`, computing bounds and building SVG paths in `Minimap.tsx:22-41` and `renderer.ts:4-29,31-48`.
- Graph rebuild and D3 simulation creation happen immediately on `data` change in `canvas/src/components/GraphCanvas.tsx:29-211`, which can block the main thread during initial paint, causing a visible lag before the minimap appears.
- Additional overhead: deep copies on `setData` and history snapshots in `canvas/src/hooks/store/graphDataSlice.ts:7-13` and history utilities in `historySlice.ts:9-66`. Minimap also subscribes to the entire store object, increasing re-renders.

## Goals
- Show the minimap immediately after `setData` completes, even for large graphs.
- Preserve the current external API (same store functions and component props).
- Reduce unnecessary work, re-renders, and potential leaks.

## Implementation Steps
1. Defer heavy canvas rebuild after data load
- In `GraphCanvas.tsx:29-211`, wrap the simulation build and DOM construction in a scheduled task to yield a frame to paint first.
- Use `requestAnimationFrame` or `requestIdleCallback` where available:
  - Start with `requestAnimationFrame(() => { /* existing build */ })` to let the initial minimap paint.
  - Optionally add a feature flag to switch to `requestIdleCallback` for very large graphs.

2. Make history snapshot non-blocking on setData
- In `graphDataSlice.ts:7-13`, set `data` synchronously but move the deep-copy snapshot into a debounced microtask:
  - Keep `set({ data: copy })` and schedule history append via existing `scheduleHistory('Set Data')` from `historySlice.ts:46-66`.
  - This preserves `setData` API while avoiding synchronous full deep-copy.

3. Optimize Minimap subscriptions and compute
- In `Minimap.tsx:10`, switch to selectors:
  - `const data = useGraphStore(s => s.data)`
  - `const canvasDims = useGraphStore(s => s.canvasDims)`
- Remove unused imports and coord map:
  - Drop `createTabSync, buildEnvelope` from `Minimap.tsx:1-5` and `buildCoordMap` usage at `Minimap.tsx:22`.
- Guard large path builds:
  - If `edges.length` exceeds a threshold (e.g., 20k), build a sampled path or skip edges for the first paint, then complete on idle.

4. Precompute minimap preview on idle
- Add a small `minimapSlice` in the store exposing derived `previewBounds`, `previewScale`, `previewNodesPath`, `previewEdgesPath` updated on `data` changes using `subscribeWithSelector` and `requestIdleCallback`.
- Update `Minimap.tsx` to use precomputed values when available; fallback to live compute otherwise.

5. Minor cleanup and leak prevention
- Ensure D3 event handlers are cleared when dependencies change by resetting listeners during cleanup in `GraphCanvas.tsx` (the simulation is stopped at `208-211`; also clear `svg.on(...)` bindings in the cleanup).
- Audit `useEffect` deps to limit unneeded rebuild triggers; rely on memoized selectors for store reads.

## API Preservation
- `Toolbar` continues to call `setData(loaded)`; no prop changes.
- `useGraphStore` keeps the same exported functions; only internal scheduling changes.
- Minimap component signature remains the same; subscription changes are internal.

## Validation
- Manual: load a large JSON/JSON-LD/CSV file via the existing button in `Toolbar.tsx:136-138`.
- Observe that the minimap appears within the next frame while the main canvas builds.
- Add performance marks around `setData`, `Minimap` render, and simulation start to confirm first-paint timing.

## Codebase Organization
- Keep feature-scoped modules; new `minimapSlice` under `canvas/src/features/minimap/store.ts`.
- Enforce file sizes <600 lines by extracting logic where needed; no public API changes.

## Risks & Mitigations
- Very large graphs may still stall if JSON parse dominates; mitigation: move parsing to a worker later if needed.
- Idle scheduling is browser-dependent; we guard with `requestAnimationFrame` fallback.
