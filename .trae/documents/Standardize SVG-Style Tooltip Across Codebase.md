## Goals
- Use the shared SVG-style tooltip (portal, fixed position, high z-index, translucent background) globally.
- Remove duplicate hover text by suppressing native `title` when custom tooltips are shown.
- Preserve accessibility via `aria-label`.
- Keep files < 600 lines and maintain SRP by extracting/reusing feature-scoped utilities.
- Avoid stale/duplicate logic and improve memoization/performance.

## Scope Of Changes
- Convert native-title IconButtons to styled tooltips:
  - `canvas/src/components/Toolbar.tsx`: Clear, Load, Parser, Save JSON-LD, Export, Close, Settings, Schema Panel, History, Help, Reset Zoom, Zoom In, Zoom Out, Fit, Zoom to Selection, Search toggle, Delete Selected, Toggle Edit Mode (set `showTooltip`).
  - `canvas/src/components/SearchPanel.tsx`: Close.
  - `canvas/src/components/HistoryPanel.tsx`: Undo, Redo, Restore (content area).
  - `canvas/src/components/SidebarTrigger.tsx`: Sidebar.
  - `canvas/src/features/panels/views/HistoryView.tsx`: Undo, Redo, Snapshot, Restore.
- Keep standardized ones as-is:
  - `HeaderActions.tsx`, `HelpPanel.tsx`, `SchemaEditorPanel.tsx` (already use styled tooltips).
  - Resize handles: `CollapsiblePanel.tsx`, `BottomPanel.tsx` use the shared `Tooltip`.
  - Info tooltip: `ParserView.tsx` uses shared `Tooltip` (fixed width 200px, translucent bg).

## Implementation Steps
1. Centralize Tooltip
- Confirm `Tooltip` in `features/panels/ui/Tooltip.tsx` as the global reference.
- Add small helpers if needed (e.g., default width, theme variants) while keeping the API simple.

2. Standardize IconButton
- Ensure `IconButton` uses `Tooltip` when `showTooltip` is true and suppresses native `title` in that case; retain `aria-label`.
- Update IconButton usages listed above to pass `showTooltip` and rely on the shared tooltip.

3. Replace Native Titles On Key Surfaces
- Replace `title="Drag to resize"` on resize handles with `Tooltip` (already in place for BottomPanel and CollapsiblePanel).
- Optionally remove legacy `[title="Drag to resize"]` fallback in `useDragResize.ts` once all handles are ref-driven.

4. Eliminate Duplicates
- Verify there are no elements with both `Tooltip` and native `title`. Where `showTooltip` is in use, native `title` must be omitted.
- Keep `aria-label` for screen readers.

5. Performance & Structure
- Keep Tooltip lightweight: position updates only while open; cleanup scroll/resize listeners on close.
- Memoize expensive computations where needed (e.g., parser results caching is already handled; avoid redundant parsing in UI paths).
- Maintain SRP per module; reuse Tooltip utility rather than re-implement per component.
- Ensure files remain under 600 lines by extracting shared UI helpers where needed.

## Validation
- Grep for `title="` to confirm native titles remain only where intentionally used and not in combination with `Tooltip`.
- Run UI smoke tests in `Toolbar`, `HeaderActions`, `Panels`, and `ParserView` to ensure tooltips appear consistently and no duplicate hover text remains.
- Check accessibility: `aria-label` present on actionable controls.

## Deliverables
- Updated IconButton usages to use styled tooltips across the listed files.
- Consistent tooltip visuals (translucent, fixed, overlaid) for all icon controls.
- No duplicate hover text anywhere in the app.
- Lightweight, feature-scoped utility preserved and documented.