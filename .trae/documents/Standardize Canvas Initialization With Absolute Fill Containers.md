## Goal
Use a single convention for all drawing containers so initialization on `/` and `/canvas` always fills the parent: the graph container is `absolute inset-0 overflow-hidden` inside a `relative overflow-hidden` parent.

## Current State
- Root page uses a `relative overflow-hidden` parent (`canvas/src/pages/Canvas.tsx:30-31`).
- The graph SVG container already uses `absolute inset-0` (`canvas/src/components/GraphCanvas.tsx:377-384`).
- The reference canvas container is still `relative w-full h-full` (`canvas/src/components/ReferenceShell.tsx:25-27`).
- Overlays (Toolbar, SidebarTrigger) sit above with higher z-index (`canvas/src/pages/Canvas.tsx:33-46`).

## Changes
- Update `ReferenceShell` container to match the convention:
  - Change container class to `absolute inset-0 overflow-hidden` and keep the `<canvas>` as `absolute inset-0 z-0` (`canvas/src/components/ReferenceShell.tsx`).
- Keep `GraphCanvas` as-is (it already uses absolute fill) and ensure its parent is `relative overflow-hidden` on both `/` and `/canvas`.
- Confirm `CanvasPage` uses the same structure for both empty state (`/`) and data state:
  - Parent remains `flex-1 relative overflow-hidden`; children containers for `ReferenceShell` and `GraphCanvas` mount directly (no extra wrapper layers) (`canvas/src/pages/Canvas.tsx:26-51`).
- Remove any remaining duplicate position reads:
  - Continue using `useContainerDims` for `left/top` where context menus need relative coordinates; verify no remaining `getBoundingClientRect()` calls for this purpose in `GraphCanvas`.
- Documentation:
  - Update README “Canvas Behavior” to state the absolute-fill convention for all drawing containers.

## Verification
- With dev server running, load `/` (empty state) and `/canvas` (data state); confirm both drawing containers fill the parent.
- Inspect elements to verify:
  - Parent has `relative overflow-hidden`; graph containers are `absolute inset-0 overflow-hidden`; surfaces (`<canvas>`, `<svg>`) are `absolute inset-0 z-0`.
- Resize window and toggle sidebar to confirm continuous fit and correct overlay stacking.
