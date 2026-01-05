## Goals
- Reuse Bottom Panel’s UI scaffolding for Schema and Settings panels
- Extract utilities into feature-scoped modules to keep files under 600 lines
- Eliminate conflicting/stale/duplicate logic; prevent re-render loops and leaks
- Improve cache/memory/memoization for table/search/editor operations

## Current State Overview
- Bottom panel implements a collapsible header, tab bar (Code/Nodes/Edges), actions row, and content area with search and a JSON textarea (canvas/src/components/BottomPanel.tsx:221–387).
- Settings panel and Schema editor already use shared container/header components but not BottomPanel’s tab/header/action patterns (canvas/src/components/SettingsPanel.tsx, canvas/src/components/SchemaEditorPanel.tsx).
- SchemaEditorPanel duplicates its actions row twice (canvas/src/components/SchemaEditorPanel.tsx:172–180 and 181–188), and mixes inline utilities with panel logic.

## Implementation Plan
### 1) Create a shared panel scaffold
- Add `features/panels/ui/CollapsiblePanel` that mirrors BottomPanel collapse behavior with height ratio, drag handle, and CSS var `--bottom-panel-height-px`.
- Add `features/panels/ui/TabHeader` containing:
  - Collapse toggle, title slot, and right-side action slot
  - Tab bar buttons with active-state styles matching BottomPanel (Code/Nodes/Edges pattern) but generic
  - Optional search input aligned with active tab
- Add `features/panels/ui/ActionsRow` to render action buttons uniformly (Format/Apply/Revert etc.), styled like BottomPanel’s buttons.
- Ensure props are generic: `tabs`, `activeTab`, `onTabChange`, `searchVisible`, `onSearchChange`, `actions`.

### 2) Refactor BottomPanel to use shared scaffold
- Replace inline header/tab/actions markup with `TabHeader` + `ActionsRow` while preserving state and store wiring (canvas/src/components/BottomPanel.tsx:231–261, 269–292).
- Move JSON editor actions into an `actions` array; keep `applyJson`/`formatEditor` and `Revert` behavior intact.
- Maintain existing tab keys and selection syncing; keep current API and exports unchanged.

### 3) Refactor SettingsPanel to adopt the scaffold
- Wrap with `CollapsiblePanel` to align layout with BottomPanel (while allowing non-bottom placement via `className` override).
- Use `TabHeader` with title “Settings”; integrate search toggle and input into the header instead of ad-hoc rendering (canvas/src/components/SettingsPanel.tsx:138–166, 147–154).
- Move Apply/Reset/Close into `ActionsRow` for consistency (canvas/src/components/SettingsPanel.tsx:155–164).
- Preserve existing registry read/write behavior and filtered list rendering.

### 4) Refactor SchemaEditorPanel to adopt the scaffold and remove duplication
- Replace current header/action rendering with `TabHeader` + single `ActionsRow`; remove duplicate actions row (canvas/src/components/SchemaEditorPanel.tsx:172–180 and 181–188).
- Keep tabs as `Types | Properties | Advanced` mapped to the scaffold’s `tabs` prop; search input integrated in header.
- Keep all GraphStore setters and schema IO intact; no API changes.

### 5) Extract utilities into feature-scoped modules
- BottomPanel helpers already live in `features/bottom-panel/utils.ts` (centerIdInCode, normalized, jsonStr, scheduleIdle). Extend with editor constants (fallback JSON) and selection helpers.
- Move any ad-hoc logic from panels into `features/panels/utils.ts` (e.g., common debounce, index building for search) to avoid cross-feature imports and keep files small.
- Keep exported function names stable; only relocate modules to feature directories.

### 6) Performance hardening
- Stabilize hotkey handlers passed to `usePanelHotkeys` with `useMemo` to prevent repeated add/remove cycles of `keydown` (canvas/src/components/BottomPanel.tsx:189).
- In `useDragResize`, defensively remove `document.pointermove/pointerup` on effect cleanup to cover unmount-during-drag.
- In `useVirtualTable`, optionally bind listeners conditionally on `enableVirtualTables` for micro-optimizations; maintain default behavior if simplicity preferred.
- Memoize heavy derived values and handler objects:
  - Maintain `nodeIdSet/edgeIdSet` memoization (BottomPanel.tsx:68–69); ensure sets are reused across handlers
  - Use `useCallback` for field/property change handlers to minimize table row re-renders (BottomPanel.tsx:83–103 already using callbacks)
- Validate JSON/schema formatting in idle time (`scheduleIdle`) to avoid blocking the main thread (BottomPanel.tsx:338–349).

### 7) Clean-up conflicting/hardcoded/stale/duplicate code
- Remove duplicate actions in SchemaEditorPanel (canvas/src/components/SchemaEditorPanel.tsx:172–180 vs 181–188).
- Consolidate fallback constants into `features/panels/constants.ts` (e.g., default Graph JSON, default schema) and import where needed.
- Standardize button classes and sizes across panels to avoid inconsistent styling.

### 8) File-size discipline
- After refactors, keep each panel file under 600 lines by relocating utilities and UI scaffolding to feature modules.
- Validate with a quick line count check post-change.

### 9) Verification
- Manual checks:
  - BottomPanel collapse/expand, tab switching, search behavior, and JSON editor actions
  - Settings list filtering and apply/reset behavior
  - Schema tabs, actions, import/export, and validation messages
- Hotkey checks with active/inactive states
- No regressions on selection sync (canvas → panel and editor → canvas)

## Compatibility & API
- No changes to exported component names or props (`BottomPanel`, `SettingsPanel`, `SchemaEditorPanel`)
- Utility function names stay the same; only module locations change
- Store and settings registry contracts remain intact

## References
- Bottom Panel header/tab/actions markup: `canvas/src/components/BottomPanel.tsx:221–261`, actions: `269–292`, textarea: `293–356`
- Settings header/actions: `canvas/src/components/SettingsPanel.tsx:138–166`, actions: `155–164`
- Schema actions duplication: `canvas/src/components/SchemaEditorPanel.tsx:172–180` and `181–188`