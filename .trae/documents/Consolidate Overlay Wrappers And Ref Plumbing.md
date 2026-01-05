## Scope & Targets
- Sweep and remove redundant wrapper `div`s around toolbar toggles and dropdowns.
- Convert local wrapper refs to button refs using `forwardRef` on shared components.
- Keep functional containers (canvas/ModalContainer/panel containers) intact.

## Shared Utilities
- Create `src/lib/ui/overlay.tsx`:
  - `AnchorOverlay`: fixed-position portal anchored to an `anchorRef` (`HTMLButtonElement`), computes `{top,left}` from `getBoundingClientRect()` and supports alignment options.
  - `DropdownPanel`: thin wrapper over `AnchorOverlay` for below-right dropdowns; accepts `open`, `onClose`, `anchorRef`, `className`.
- Reuse `useOutsideClose` to handle outside-click for overlays; pass `anchorRef` in ignore list.

## Refactors
- `Toolbar.tsx` (export/help dropdowns):
  - Replace `<div ref={exportRef} className="relative">` with `const exportBtnRef = useRef<HTMLButtonElement|null>(null)` and add `ref={exportBtnRef}` to the `IconButton`.
  - Render dropdown via `DropdownPanel` anchored to `exportBtnRef`; remove local `relative` wrapper.
  - Repeat for help (`helpBtnRef`).
- `Toolbar.tsx` (modals: settings/history/schema):
  - Replace `<div ref={settingsToggleRef}>` / `<div ref={historyToggleRef}>` / `<div ref={schemaToggleRef}>` with direct `ref` on their `IconButton`s.
  - Keep existing fixed modal layout; update `useOutsideClose` ignore arrays to use the new button refs.
- `Canvas.tsx`:
  - Already consolidated overlay toolbar container; ensure `SidebarTrigger` keeps `ref` on the button (no extra wrapper).
- `BottomPanel.tsx`:
  - Toggle already uses `HTMLButtonElement` ref; no change.

## Patterns & Rules
- Prefer `forwardRef` on shared button components (`IconButton`) so consumers never need wrapper `div`s solely for refs.
- Use anchored fixed overlays (`DropdownPanel`) to avoid `relative` containers.
- Avoid duplicate layout wrappers; keep a single container per overlay surface.

## Verification
- Run dev server and verify:
  - Export/Help dropdowns open at the correct position relative to the button; click-outside closes; keyboard focus unaffected.
  - Settings/History/Schema modals open/close correctly; `useOutsideClose` ignores anchor button.
  - Toolbar remains centered; Sidebar trigger right-aligned; DOM nesting reduced.
- Check file sizes remain < 600 lines and no conflicting styles or hardcoded coordinates.

## Risks & Mitigations
- Dropdown positioning edge cases on small viewports: implement simple bounds clamping in `AnchorOverlay`.
- Z-index conflicts: keep dropdown z-index `10–20`, modal portal `1000`, consistent with existing styles.
- Accessibility: preserve `aria-label` and keyboard interaction; ensure overlays are not focus-traps unless needed.

## Deliverables
- New `src/lib/ui/overlay.tsx`.
- Updated `Toolbar.tsx` using `DropdownPanel` and direct button refs.
- Minor cleanups in `Canvas.tsx` (already done) and consistent usage across components.
