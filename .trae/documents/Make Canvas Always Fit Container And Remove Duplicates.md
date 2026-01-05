## Current Behavior
- `ReferenceShell` uses `ResizeObserver` to size the `<canvas>` to its container and applies DPR scaling (`devicePixelRatio`) so the canvas always visually fills its parent: `canvas/src/components/ReferenceShell.tsx:8-17`, `canvas/src/components/ReferenceShell.tsx:19-30`, and element at `canvas/src/components/ReferenceShell.tsx:33-36`.
- `GraphCanvas` uses `ResizeObserver` to size an `<svg>` that fills the container via `viewBox` and `preserveAspectRatio="none"`: `canvas/src/components/GraphCanvas.tsx:25-35`, `canvas/src/components/GraphCanvas.tsx:37-42`, `canvas/src/components/GraphCanvas.tsx:396-402`.
- Page container wraps these in an absolute fill layer: `canvas/src/pages/Canvas.tsx:31-38` and `canvas/src/pages/Canvas.tsx:41-48`.

## Issues
- Duplicate sizing logic: both components implement near‑identical `ResizeObserver` code.
- Legacy class names `excalidraw__canvas interactive` on the `<canvas>` are misleading; Excalidraw isn’t used elsewhere.
- Redundant initial `width/height` props in `GraphCanvas` that are immediately superseded by observed size.
- Extra absolute wrapper layers in `CanvasPage` may be unnecessary and add noise.

## Changes
- Create `src/hooks/useContainerDims.ts` exporting a hook that:
  - Attaches `ResizeObserver` to a passed `ref` and returns `{ width, height, left, top, dpr }` from `getBoundingClientRect()` and `window.devicePixelRatio`.
- Update `ReferenceShell.tsx` to:
  - Use the new hook for container sizing.
  - Set `<canvas>` `.width/.height` to `width*dpr` and CSS `style.width/height` to `width/height`.
  - Remove legacy classes (`excalidraw__canvas interactive`) and keep `absolute inset-0` for full fit.
- Update `GraphCanvas.tsx` to:
  - Use the new hook; remove local `ResizeObserver` code.
  - Drive `viewBox` from hook’s `width/height`; keep `preserveAspectRatio="none"`.
  - Publish `setCanvasDims` and `setCanvasPos` from hook values.
  - Drop or document `width/height` props as initial seed (prefer removal for clarity).
- Simplify `CanvasPage` wrappers:
  - Keep a single relative container; mount `Toolbar` and `SidebarTrigger` as overlays; remove redundant `absolute inset-0` layer when not needed.
- Documentation cleanup:
  - Update README “Canvas Behavior” to reflect responsive sizing and DPR scaling; remove “excalidraw” mentions.

## Verification
- Resize browser window and toggle sidebar; confirm `<canvas>` style `width/height` match container rect, and attributes `width/height` equal `style * dpr`.
- Confirm `<svg>` fills container (`viewBox` equals observed dims) and elements render correctly.
- Inspect with devtools on HiDPI and standard displays.
- Run through toolbar actions to ensure overlays don’t affect sizing.
