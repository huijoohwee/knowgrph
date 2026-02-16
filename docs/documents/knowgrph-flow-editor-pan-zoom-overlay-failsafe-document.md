# Knowgrph Flow Editor Pan/Zoom Overlay Failsafe

## Scope

This document describes the interaction contract for restoring pan/zoom when Flow Editor “fly-out” overlays (e.g., Node Quick Editor) are present.

## SSOT Rules

- `viewportControlsPreset` is the single source of truth for pan/zoom/select gating and must be read from store at event time (not captured at mount).
- 2D scale extent safety is centralized in `canvas/src/lib/zoom/scaleExtent.ts` and must be reused by 2D renderers.

## Overlay Contract

- Overlays may be marked as wheel-ignore/pointer-ignore to prevent accidental canvas wheel zoom.
- When Space-pan is held, Space+drag pan must remain usable even if the pointerdown starts on an overlay.
- Overlay-driven global user-select locks must always unlock on pointer end/cancel and must not leak across unmount.

## Safety Guarantees

- Global user-select lock has a failsafe reset on `window.blur` and `document.visibilitychange` (hidden).
- Node dragging must never early-return before releasing user-select locks.

## References

- `knowgrph/canvas/src/components/FlowCanvas/bindNativeInteractions.ts`
- `knowgrph/canvas/src/components/GraphCanvas/zoom.ts`
- `knowgrph/canvas/src/components/GraphCanvas/drag.ts`
- `knowgrph/canvas/src/components/FlowEditor/NodeOverlayEditor.tsx`
- `knowgrph/canvas/src/lib/canvas/interaction-user-select.ts`
- `knowgrph/canvas/src/lib/zoom/scaleExtent.ts`

