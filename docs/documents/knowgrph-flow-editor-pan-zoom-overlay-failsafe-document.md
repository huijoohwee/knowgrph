# Knowgrph Flow Editor Pan/Zoom Overlay Failsafe

## Scope

This document describes the interaction contract for restoring pan/zoom when Flow Editor “fly-out” overlays (e.g., Node Quick Editor) are present.

## SSOT Rules

- `viewportControlsPreset` is the single source of truth for pan/zoom/select gating and must be read from store at event time (not captured at mount).
- 2D scale extent safety is centralized in `canvas/src/lib/zoom/scaleExtent.ts` and must be reused by 2D renderers.
- 2D zoom view keys must be built from the same schema-layout JSON across D3/Flow/Design/Flow Editor (include `schema.layout.flow`), so keyed zoom state does not drift.
- Flow renderer commit/zoom persistence must avoid callback churn that would cause input handlers to rebind during interaction.
- Flow Editor overlay collision resolution must not run on every interaction tick; it should be scheduled on overlay set changes and quantized zoom changes.
- Flow Editor camera init must be keyed per dataset when stable (e.g., `path:*`), and must fall back to a per-graph hash when dataset keys collapse to `rev:*`.

## Overlay Contract

- Overlays may be marked as wheel-ignore/pointer-ignore to prevent accidental canvas wheel zoom.
- Flow Editor fly-out overlays must expose the overlay root via `[data-kg-node-quick-editor]` on the portal root so global capture handlers can reliably proxy wheel/pan/zoom.
- When Space-pan is held, Space+drag pan must remain usable even if the pointerdown starts on an overlay.
- Dragging a fly-out overlay must never start a canvas pan proxy unless Space-pan is held.
- Pinned overlay drags must update overlay anchor offsets directly (applied collectively to all pinned overlays) and must not route through any pan proxy path.
- When `flowEditorOverlayWheelProxyEnabled=true`, wheel gestures that originate over a Node Quick Editor overlay must be forwarded to the Flow canvas unless the overlay can scroll in that direction (including when the wheel originates over interactive form fields).
- When Safari emits `gesture*` pinch events over the canvas or fly-out overlays, the app must prevent browser zoom and apply anchored zoom to the Flow canvas.
- Overlay-driven global user-select locks must always unlock on pointer end/cancel and must not leak across unmount.
- Wheel-ignore zones must not be able to “blanket block” canvas zoom when the top-most element under the pointer is still the canvas; in Flow Editor, prefer an `elementFromPoint` check to bypass ignore guards in that case.

## Safety Guarantees

- Global user-select lock has a failsafe reset on `window.blur` and `document.visibilitychange` (hidden).
- Node dragging must never early-return before releasing user-select locks.
- Overlay pan proxy must clear its pointer id on `pointerup`, `pointercancel`, and `lostpointercapture` so subsequent interactions cannot be blocked.
- Window capture handlers must be able to end an active canvas drag if the canvas listeners are temporarily unmounted during 2D renderer switches.
- Wheel handling must recover from stale drag state (e.g. capture lost) instead of blocking zoom/pan indefinitely.
- If the current camera transform does not show the graph (bounds guard fails), Flow Editor must re-apply an initial fit even when the init key matches.

## References

- `knowgrph/canvas/src/components/FlowCanvas/bindNativeInteractions.ts`
- `knowgrph/canvas/src/components/FlowCanvas.tsx`
- `knowgrph/canvas/src/components/FlowEditor/NodeOverlayEditor.tsx`
- `knowgrph/canvas/src/lib/canvas/flow-editor-overlay-proxy.ts`
- `knowgrph/canvas/src/lib/canvas/active-2d-zoom-view-key.ts`
- `knowgrph/canvas/src/lib/canvas/flow-editor-init-key.ts`
- `knowgrph/canvas/src/lib/canvas/schema-layout-engine-json.ts`
- `knowgrph/canvas/src/lib/canvas/interaction-user-select.ts`
- `knowgrph/canvas/src/hooks/store/canvasSlice.ts`
- `knowgrph/canvas/src/features/settings/registry-ui.graph-and-orchestrator.ts`
