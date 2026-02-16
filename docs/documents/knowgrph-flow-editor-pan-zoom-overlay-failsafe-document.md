# Knowgrph Flow Editor Pan/Zoom Overlay Failsafe

## Scope

This document describes the interaction contract for restoring pan/zoom when Flow Editor “fly-out” overlays (e.g., Node Quick Editor) are present.

## SSOT Rules

- `viewportControlsPreset` is the single source of truth for pan/zoom/select gating and must be read from store at event time (not captured at mount).
- 2D scale extent safety is centralized in `canvas/src/lib/zoom/scaleExtent.ts` and must be reused by 2D renderers.
- Flow renderer commit/zoom persistence must avoid callback churn that would cause input handlers to rebind during interaction.
- Flow Editor overlay collision resolution must not run on every interaction tick; it should be scheduled on overlay set changes and quantized zoom changes.

## Overlay Contract

- Overlays may be marked as wheel-ignore/pointer-ignore to prevent accidental canvas wheel zoom.
- Flow Editor fly-out overlays must expose the overlay root via `[data-kg-node-quick-editor]` on the portal root so global capture handlers can reliably proxy wheel/pan/zoom.
- When Space-pan is held, Space+drag pan must remain usable even if the pointerdown starts on an overlay.
- Dragging a fly-out overlay must never start a canvas pan proxy unless Space-pan is held.
- When `flowEditorOverlayWheelProxyEnabled=true`, wheel gestures that originate over a Node Quick Editor overlay must be forwarded to the Flow canvas unless the overlay can scroll in that direction.
- When Safari emits `gesture*` pinch events over the canvas or fly-out overlays, the app must prevent browser zoom and apply anchored zoom to the Flow canvas.
- Overlay-driven global user-select locks must always unlock on pointer end/cancel and must not leak across unmount.

## Safety Guarantees

- Global user-select lock has a failsafe reset on `window.blur` and `document.visibilitychange` (hidden).
- Node dragging must never early-return before releasing user-select locks.
- Overlay pan proxy must clear its pointer id on `pointerup`, `pointercancel`, and `lostpointercapture` so subsequent interactions cannot be blocked.
- Window capture handlers must be able to end an active canvas drag if the canvas listeners are temporarily unmounted during 2D renderer switches.
- Wheel handling must recover from stale drag state (e.g. capture lost) instead of blocking zoom/pan indefinitely.

## References

- `knowgrph/canvas/src/components/FlowCanvas/bindNativeInteractions.ts`
- `knowgrph/canvas/src/components/FlowEditor/NodeOverlayEditor.tsx`
- `knowgrph/canvas/src/lib/canvas/flow-editor-overlay-proxy.ts`
- `knowgrph/canvas/src/lib/canvas/interaction-user-select.ts`
- `knowgrph/canvas/src/hooks/store/canvasSlice.ts`
- `knowgrph/canvas/src/features/settings/registry-ui.graph-and-orchestrator.ts`
