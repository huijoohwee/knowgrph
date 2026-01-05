## Goals
- Align rendered structure from `div div svg` to `div svg` (icon as direct child)
- Remove unnecessary nested `div`s and stale/duplicate logic
- Preserve styling and accessibility; reduce DOM weight for all toolbar buttons

## Current Findings
- `IconButton` wraps `children` in an extra `div.flex` and renders a tooltip `div` on every instance (`canvas/src/components/IconButton.tsx:21-36`).
- Toolbar and Sidebar use `IconButton` with both icon+label and icon-only children (`canvas/src/components/Toolbar.tsx:118-160`, `canvas/src/components/SidebarTrigger.tsx:12-27`).

## Changes
- Replace root `div` with semantic `button` to remove custom keyboard handling and `role`/`aria` duplication.
- Render `children` directly (remove inner `div.flex`) and move `flex items-center gap-2` to the root when a label is present.
- Remove always-on tooltip `div`; rely on the native `title` attribute or add an optional `tooltip` prop (default `false`).
- Keep `className` passthrough so existing styles continue to work; add a `variant` prop for common cases (`icon`, `icon+label`).

## API Proposal
- `IconButton` props: `{ title: string; onClick?: () => void; disabled?: boolean; className?: string; children: React.ReactNode; showTooltip?: boolean; }`
- Behavior:
  - Root is `<button>` with `type="button"`, `disabled={disabled}`.
  - Applies `flex items-center gap-2` only when there are multiple children (icon + label).
  - Emits `title` always; renders tooltip `div` only when `showTooltip` is true.

## File Updates
- Update `canvas/src/components/IconButton.tsx`:
  - Remove `handleKeyDown` and `role="button"` (`lines 12-18`, `21-27`).
  - Change root to `<button>`; move `className` and `title`; conditionally apply `flex` classes.
  - Remove wrapper `div` around `children` (`line 30`).
  - Remove tooltip `div` or gate it behind `showTooltip` (`lines 33-35`).
- Update usages:
  - `canvas/src/components/Toolbar.tsx` and `SidebarTrigger.tsx`: no structural changes needed; verify styles still match, optionally remove redundant label text spacing if root handles flex.

## Verification
- Run the app and inspect DOM for Zoom In/Out buttons: ensure structure is `button svg` (icon-only) and `button svg text` (icon+label).
- Check keyboard focus/activation: Space/Enter invoke `onClick` via native button behavior.
- Confirm hover styles and disabled states remain correct.
- Ensure no duplicate tooltip `div`s appear; `title` displays native tooltip.

## Rollback Safety
- Minimal change footprint; if needed, re-enable tooltip via `showTooltip`.
- No external dependencies added; styles remain in caller `className`.

Do you want me to proceed with these changes and update the component plus usages accordingly?