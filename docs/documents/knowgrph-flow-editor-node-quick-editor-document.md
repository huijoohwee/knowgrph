# Knowgrph Flow Editor Node Quick Editor Document

**Context**: Flow Editor 2D renderer node editing
**Intent**: Provide a fast in-canvas edit surface for selected nodes without opening full inspectors
**Directive**: Reuse SSOT UI tokens (typography, icon sizing, opacity) and persist only canonical LS keys from `canvas/src/lib/config.ls.ts`

---

## Surface Contract

- **Surface**: an in-canvas overlay positioned near the selected Flow Editor node.
- **Shell**: reuse the host `FloatingPanel` element wrapper for consistent ARIA + theming.
- **Semantics**: semantic HTML only (`aside/section/header/nav/menu/form/fieldset/legend/label/input/select/textarea/button`).
- **Toolbar**: AI-Flow-style icon toolbar for quick actions and a click-to-open “More” menu.

---

## Supported Behaviors (MVP)

- **Pin/Unpin**: detaches the overlay from node-anchored positioning and persists a viewport position.
- **Drag**: when pinned (detached), header drag moves the overlay (ignores pointerdown on interactive elements).
- **Minimize/Restore**: collapses the editor body to header-only.
- **Opacity**: inherits `uiPanelOpacity` from UI settings.
- **Scroll isolation**: scrolling inside the editor must not zoom the canvas; mark the overlay as a wheel-ignore zone and guard wheel-zoom handlers via SSOT selector `UI_SELECTORS.canvasWheelIgnore`.
- **More actions**: open selected node in Sidepane, enable Port Handles for all nodes, convert selected node to a Loop node (schema + draft-graph edits only; no hidden background work; idempotent updates).
- **Baseline lock**: enable-handles action is gated when Document Structure baseline lock is enabled.

## Performance Invariants

- **Drag**: pinned overlay drag must not trigger a render per raw pointermove; throttle state updates to animation frames.
- **Pan/Zoom**: keep screen-space overlays in sync with the renderer transform during active panning (rAF-throttled zoom-state commits).
- **Pan/Zoom**: if interval-gating is used, keep it bounded and avoid end-of-pan snap.
- **Pan/Zoom**: avoid forced layout reads in hot paths; prefer `offsetX/offsetY`-based local coordinates for canvas pointer/wheel interactions and only fall back to `getBoundingClientRect()` when offsets are unavailable.
- **Collision settling**: during node/group drag, collision relaxation must be rAF-throttled and step-bounded; large graphs may disable drag-time relaxation and rely on commit-time settling.
- **Render isolation**: zoom/pan should not re-render the editor form. Keep zoom-dependent work in a thin layout wrapper and memoize the panel body.
- **Anchor stability**: avoid rounding anchor positions during pan/zoom; use subpixel translate to prevent shimmy.

---

## Zoom Behavior (Macro View)

- The overlay is **screen-space UI**, but it **scales** with the canvas zoom so it remains readable and consistent with user expectations in flow editors.
- Scale is computed from the schema zoom extent (`minK/maxK`) and current zoom `k`, then applied via CSS `transform` (translate + scale) to keep updates on the compositor path.
- **Macro view rule**: at **max zoom-out** and **max zoom-in**, the panel stays **small** (same size at both extremes) so the user can keep a wide overview.
- SSOT implementation lives in `canvas/src/components/FlowEditor/nodeQuickEditorZoom.ts` and must be reused by any future quick-editor overlays.

---

## Port Handles (Flow Editor)

- Port Handles are toggled via `schema.behavior.portHandles.enabled`.
- Node Quick Editor “Enable Handles for All Inputs” sets `schema.behavior.portHandles.enabled=true` and `schema.behavior.portHandles.showAllInputs=true` so Flow nodes without edges still render default in/out handles (visual + routing parity, bounded work).
- Shared gating helper is `isPortHandlesShowAllInputsEnabled(schema)` so Flow scene-building and UI actions cannot drift.

## Loop Node Semantics (Flow Editor)

- Convert-to-loop sets `node.type='Loop'` and `node.properties['workflow:kind']='loop'` for the selected node (draft graph only until commit).
- Conversion is idempotent (re-running does not churn graph objects).

---

## Persistence (SSOT)

- All persistence keys are defined in `LS_KEYS` in `canvas/src/lib/config.ls.ts`:
  - `LS_KEYS.flowNodeQuickEditorPinned`
  - `LS_KEYS.flowNodeQuickEditorMinimized`
  - `LS_KEYS.flowNodeQuickEditorHideFields`
  - `LS_KEYS.flowNodeQuickEditorTopPx`
  - `LS_KEYS.flowNodeQuickEditorLeftPx`

---

## Code Locations

- Panel controller (positioning + persistence + toolbar/menu):
  - `canvas/src/components/FlowEditor/NodeOverlayEditor.tsx`
- Form surface (fields mapped to `node.properties`):
  - `canvas/src/components/FlowEditor/NodeOverlayEditorForm.tsx`
