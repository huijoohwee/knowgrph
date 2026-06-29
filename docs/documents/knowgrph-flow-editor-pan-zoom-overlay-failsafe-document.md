# Knowgrph Flow Editor Pan/Zoom Overlay Failsafe

## Scope

This document describes the interaction contract for restoring pan/zoom when Flow Editor widget overlays are present.

## SSOT Rules

- `viewportControlsPreset` is the single source of truth for pan/zoom/select gating and must be read from store at event time (not captured at mount).
- 2D scale extent safety is centralized in `canvas/src/lib/zoom/scaleExtent.ts` and must be reused by 2D renderers.
- 2D zoom view keys must be built from the same schema-layout JSON across D3/Flow/Design/Flow Editor (include `schema.layout.flow`), so keyed zoom state does not drift.
- Flow renderer commit/zoom persistence must avoid callback churn that would cause input handlers to rebind during interaction.
- Flow Editor overlay collision resolution must not run on every interaction tick; it should be scheduled on overlay set changes and quantized zoom changes.
- Flow Editor camera init must be keyed per dataset when stable (e.g., `path:*`), and must fall back to a per-graph hash when dataset keys collapse to `rev:*`.

## Overlay Contract

- Overlays may be marked as wheel-ignore/pointer-ignore to prevent accidental canvas wheel zoom.
- Flow Editor widget overlays must expose the overlay root via `[data-kg-widget][data-kg-flow-editor-mode="1"]` and the active surface id via `data-kg-flow-editor-surface` so global capture handlers can reliably proxy wheel/pan/zoom.
- When Space-pan is held, Space+drag pan must remain usable even if the pointerdown starts on an overlay.
- Dragging a widget overlay must never start a canvas pan proxy unless Space-pan is held.
- Pinned overlay drags must update overlay anchor offsets directly (applied collectively to all pinned overlays) and must not route through any pan proxy path.
- When `flowEditorOverlayWheelProxyEnabled=true`, wheel gestures that originate over a Flow Editor widget overlay must be forwarded to the Flow canvas unless the overlay can scroll in that direction (including when the wheel originates over interactive form fields).
- When Safari emits `gesture*` pinch events over the canvas or widget overlays, the app must prevent browser zoom and apply anchored zoom to the Flow canvas.
- Overlay-driven global user-select locks must always unlock on pointer end/cancel and must not leak across unmount.
- Wheel-ignore zones must not be able to “blanket block” canvas zoom when the top-most element under the pointer is still the canvas; in Flow Editor, prefer an `elementFromPoint` check to bypass ignore guards in that case.

## Safety Guarantees

- Global user-select lock has a failsafe reset on `window.blur` and `document.visibilitychange` (hidden).
- Node dragging must never early-return before releasing user-select locks.
- Overlay pan proxy must clear its pointer id on `pointerup`, `pointercancel`, and `lostpointercapture` so subsequent interactions cannot be blocked.
- Window capture handlers must be able to end an active canvas drag if the canvas listeners are temporarily unmounted during 2D renderer switches.
- Wheel handling must recover from stale drag state (e.g. capture lost) instead of blocking zoom/pan indefinitely.
- Flow Editor must not apply persisted camera transforms until graph bounds are computable (e.g., at least one finite node position); otherwise initial transforms may land offscreen and appear as a "blank" canvas.
- If the current camera transform does not show the graph (bounds guard fails), Flow Editor must treat the view as not-initialized yet (invalidate the init gate) and re-apply an initial fit even when the init key matches.
- Viewport settle retry: after workspace-open overlay transitions, the Flow canvas must retry centroid-centered fit if the initial viewport settle produces an offscreen or degenerate transform. The retry uses the same D3 fit SSOT (`fitAllTransform`) and preserves centroid-centered layouts across overlay open/close cycles.
- Interaction-in-progress guard: offscreen overlay recovery and force-fit must not fire while the user is actively panning, zooming, or dragging widgets in Workspace mode; recovery runs only after interaction settles.
- Widget placement authority: frontmatter-flow auto-managed widget nodes (text/image/video generation, rich media panel, video transcriber) use a centralized placement authority (`widgetPlacementAuthority.ts`) that decides auto-placement, pinned-in-canvas defaults, and balanced collective layout preservation.
- Screen authority for floating widgets: frontmatter-flow floating widgets bypass viewport clamping and use raw screen coordinates (`floatingUsesScreenAuthority`); world position stamping is skipped when screen authority is active, and a guard prevents stamping far-offscreen world coordinates during pre-init.
- Per-graph-key widget world positions: widget world positions are stored per graph meta key (`flowWidgetWorldPosByNodeIdByGraphMetaKey`) so positions persist correctly when switching between frontmatter-flow graphs; transient placement authorities are reset on workspace reopen to prevent far-right jumps.
- Frontmatter flow import mode clearing: an explicit frontmatter-flow graph import clears the global and per-graph-key pinned, screen-position, and world-position widget placement caches even during transient workspace mutation gates, so stale Flow Canvas/previous-document placement cannot seed Flow Editor. Passive Source Files switches opt out via `resetWidgetLayout: false`.
- Workspace-blocked seed zoom: frontmatter-flow auto-seeding must ignore persisted viewport-offset zoom while workspace graph mutation is blocked; live interaction transforms remain authoritative, and persisted offsets may seed only after the mutation gate is open.
- Rich Media infinite-canvas layout: Flow Editor and Flow Canvas Rich Media overlays opt out of viewport collision/clamp relayout so pan/zoom preserves world placement. Bounded callers still use the shared media overlay layout loop with explicit caller clamp margins and obstacle collision.
- Explicit source-authority reapply is also a draft-reset event: when `applyMarkdownDocument(...)` reapplies the active markdown SSOT, Flow Editor must invalidate transient draft overlays, drafted edges, and camera/init gates from an incremented markdown apply revision even if the document path and text are identical.
- Live-route browser verification depends on that reset boundary: same-path same-text starter-template reapply must restore the clean baseline and remove transient Storyboard Rich Media residue instead of preserving draft state until some unrelated document identity change occurs.

## References

- `knowgrph/canvas/src/components/FlowCanvas/bindNativeInteractions.ts`
- `knowgrph/canvas/src/components/FlowCanvas.tsx`
- `knowgrph/canvas/src/components/FlowCanvas/useFlowCanvasRuntime.ts`
- `knowgrph/canvas/src/components/FlowEditor/NodeOverlayEditor.tsx` (thin barrel → `NodeOverlayEditorInner`)
- `knowgrph/canvas/src/components/FlowEditor/NodeOverlayEditorInner.tsx` (orchestrator: placement + drag + toolbar + view)
- `knowgrph/canvas/src/components/FlowEditor/NodeOverlayEditorView.tsx` (pure presentational view)
- `knowgrph/canvas/src/components/FlowEditor/nodeOverlayEditorShared.ts` (types + constants SSOT)
- `knowgrph/canvas/src/components/FlowEditor/useNodeOverlayPlacementRuntime.ts` (position/scale/clamp)
- `knowgrph/canvas/src/components/FlowEditor/useNodeOverlayDragHandlers.ts` (pointer-drag interaction)
- `knowgrph/canvas/src/components/FlowEditor/useNodeOverlayRichMediaToolbar.ts` (rich-media toolbar state)
- `knowgrph/canvas/src/lib/canvas/flow-editor-overlay-proxy.ts`
- `knowgrph/canvas/src/lib/canvas/active-2d-zoom-view-key.ts`
- `knowgrph/canvas/src/lib/canvas/flow-editor-init-key.ts`
- `knowgrph/canvas/src/lib/canvas/schema-layout-engine-json.ts`
- `knowgrph/canvas/src/lib/canvas/interaction-user-select.ts`
- `knowgrph/canvas/src/lib/flowEditor/widgetPlacementAuthority.ts` (widget auto-placement + screen authority + balanced collective)
- `knowgrph/canvas/src/features/parsers/frontmatterFlowImportMode.ts` (import mode clearing)
- `knowgrph/canvas/src/components/FlowEditorCanvas/runtime/useFlowEditorRuntimeScene.ts` (workspace-blocked seed zoom)
- `knowgrph/canvas/src/components/FlowCanvas/FlowCanvasMediaOverlays.tsx` (Flow Rich Media infinite-canvas layout policy)
- `knowgrph/canvas/src/lib/render/mediaOverlayLayoutLoop2d.ts` (bounded media layout collision and caller clamp margins)
- `knowgrph/canvas/src/hooks/store/canvasSlice.ts`
- `knowgrph/canvas/src/features/settings/registry-ui.graph-and-orchestrator.ts`
