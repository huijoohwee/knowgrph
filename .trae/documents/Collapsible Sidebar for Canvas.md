## Overview
- Implement a collapsible right sidebar for the Canvas page: default collapsed, explicit expand/collapse via a toolbar button.
- Preserve `NodeEditor` component; only control the sidebar container’s width/visibility.

## Changes
- Add `isSidebarOpen` state in the global store with `setSidebarOpen` and `toggleSidebar` actions.
- Update `Canvas.tsx` to conditionally size the `<aside>`: `w-80` when open, `w-0` (hidden) when collapsed, with `transition-all` and `aria-hidden`.
- Add a "Sidebar" toggle button to `Toolbar` using lucide-react icons (`PanelRightOpen`/`PanelRightClose`).

## UX Behavior
- Default: sidebar collapsed on initial load.
- Toggle: clicking the toolbar button expands/collapses the sidebar.
- Accessibility: button carries `aria-pressed`/`aria-expanded`; `<aside>` sets `aria-hidden` when collapsed.
- NodeEditor remains mounted to avoid state loss; pointer events are disabled when collapsed.

## Implementation Steps
1. Store (zustand) `useGraphStore.ts`:
   - Extend `GraphState` with `isSidebarOpen: boolean` and actions `setSidebarOpen(open: boolean)` and `toggleSidebar()`.
   - Initialize `isSidebarOpen: false`.
   - File reference: `canvas/src/hooks/useGraphStore.ts:4–19, 21–26`.
2. Canvas layout:
   - Wrap `<aside>` classes with conditional: open → `w-80 bg-white border-l ...`, closed → `w-0 border-l-0 pointer-events-none opacity-0`.
   - Add `transition-all duration-200` for smooth width change; set `aria-hidden={!isSidebarOpen}`.
   - File reference: `canvas/src/pages/Canvas.tsx:75–80`.
3. Toolbar button:
   - Import `PanelRightOpen` and `PanelRightClose` from `lucide-react`.
   - Read `isSidebarOpen` from the store; on click, call `toggleSidebar()`.
   - Label: `Sidebar`; icon reflects current state.
   - Place after the Zoom/Fit group.
   - File reference: `canvas/src/components/Toolbar.tsx:12–14, 26–83`.

## Validation
- Start dev server and load test JSON; confirm:
  - Sidebar is collapsed by default.
  - Clicking "Sidebar" expands to `~w-80` and shows `NodeEditor` + `StatusBar`.
  - Clicking again collapses; canvas area reclaims space; no scrollbars from the hidden aside.
  - Check mobile and desktop; animation is smooth.

## Notes / Extensions (optional)
- Auto-expand on selection can be added later (open sidebar when `selectNode`/`selectEdge` is called). Not included in this change unless requested.

## References
- Existing aside: `canvas/src/pages/Canvas.tsx:75–80`.
- Store definition: `canvas/src/hooks/useGraphStore.ts:4–19, 21–26`.
- Toolbar: `canvas/src/components/Toolbar.tsx:26–83`. 