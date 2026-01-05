## Goals
- Consistent collapse/expand styling and behavior across all sections
- Collapsed by default across Parser, Schema, Settings and related panels
- Toggle by clicking anywhere in the header container, not only the chevron icon
- Extract shared utilities into feature-scoped modules; remove duplicates, stale code, and inconsistent icon usage

## Current Findings
- Mixed implementations: inline SVG chevrons vs `lucide-react` imports
- Only chevron buttons are clickable in most views; `SettingsView` toggles by clicking the whole row
- Defaults vary; some panels non-collapsible despite shared shells
- Files involved: `features/panels/ui/TabHeader.tsx`, `PanelFrame.tsx`, `CollapsiblePanel.tsx`, `components/BottomPanel.tsx`, `features/panels/views/ParserView.tsx`, `features/panels/views/SchemaView.tsx`, `features/panels/views/SettingsView.tsx`, `features/schema-editor/ui/Subsection.tsx`

## Design
- Create `CollapsibleSection` component (feature-scoped):
  - Props: `title`, `defaultCollapsed=true`, `collapsed`, `onToggle`, `actions?`, `children`
  - Full header row clickable: `role="button"`, `aria-expanded`, keyboard support (`Enter`/`Space`)
  - Chevron affordance: use `lucide-react` `ChevronDown` rotated when expanded; consistent sizes (w-4 h-4)
  - Styling: unify header classes (`flex justify-between px-3 py-1 text-xs font-semibold`), border separators (`mt-3 border-t border-gray-200 pt-2`)
- Create `CollapsibleSubsection` for Advanced tab (smaller typography, same interaction)
- Standardize icon source to `lucide-react` everywhere; remove inline SVGs
- Keep state external by default, allow controlled/uncontrolled usage; avoid coupling to `PanelFrame`

## Implementation Steps
1. Add `features/panels/ui/CollapsibleSection.tsx` and `CollapsibleSubsection.tsx` with accessible click-to-toggle header
2. Replace manual section headers in `features/panels/views/ParserView.tsx` with `CollapsibleSection` for: Input Data, Parsers, Table (keep all default-collapsed)
3. Replace manual section headers in `features/panels/views/SchemaView.tsx` with `CollapsibleSection` for: Schema JSON, Schema Editor, Actions (all default-collapsed)
4. Update `features/schema-editor/ui/Subsection.tsx` to use `CollapsibleSubsection` or introduce a wrapper while preserving existing layout; collapse-by-default with header click-toggle
5. Align `features/panels/views/SettingsView.tsx` to use `CollapsibleSection` for any groupings; if per-row expand is needed, retain row behavior but make group headers match
6. Unify `components/BottomPanel.tsx` to `ChevronDown` from `lucide-react` and remove unused inline SVG imports
7. Optionally adapt `features/panels/ui/TabHeader.tsx` and `PanelFrame.tsx` to delegate header rendering to `CollapsibleSection` for consistency; deprecate custom chevron logic
8. Ensure all section states initialize as collapsed (`useState(true)`), unless explicitly expanded by interaction

## Accessibility
- `role="button"` on header container; `aria-expanded` bound to state
- `aria-controls` referencing collapsible content id; `tabIndex=0`, `onKeyDown` for `Enter`/`Space`
- Focus-visible ring on header for keyboard users

## Performance & Cleanup
- Memoize heavy children to reduce re-renders when toggling
- Stable `onToggle` with `useCallback`; avoid prop churn
- Remove duplicate inline SVGs, stale chevron code, unused `lucide-react` imports
- Keep each file under ~600 lines; isolate shared styles/hooks in `features/panels/ui`

## Files To Touch
- `canvas/src/features/panels/ui/CollapsibleSection.tsx` (new)
- `canvas/src/features/panels/ui/CollapsibleSubsection.tsx` (new)
- `canvas/src/features/panels/views/ParserView.tsx`
- `canvas/src/features/panels/views/SchemaView.tsx`
- `canvas/src/features/schema-editor/ui/Subsection.tsx` (or wrapper)
- `canvas/src/features/panels/views/SettingsView.tsx`
- `canvas/src/components/BottomPanel.tsx`
- `canvas/src/features/panels/ui/TabHeader.tsx` and `PanelFrame.tsx` (optional alignment)

## Verification
- Unit tests: header click toggles state; defaults collapsed; chevron rotation reflects state; keyboard activation works
- Manual check in preview: click anywhere on header toggles; visual consistency across Parser, Schema, Settings, BottomPanel
- Confirm no regressions: ensure no infinite loops, re-render storms, or stale cache interactions

## Rollout & Risk
- Pure UI refactor; low risk; scoped to panels and schema editor
- Incremental replacement: migrate views one at a time, verify visually
- Maintain the existing API surfaces; no changes to parsing/registry logic