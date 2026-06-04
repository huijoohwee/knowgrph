## Goals
- Align rendered structure so the icon is a direct child of the button host.
- Remove unnecessary nested generic wrappers and stale/duplicate logic.
- Preserve styling and accessibility; reduce DOM weight for all toolbar buttons

## Current Findings
- `IconButton` wraps `children` in an extra generic flex wrapper and renders a tooltip wrapper on every instance (`canvas/src/components/IconButton.tsx:21-36`).
- Toolbar and Sidebar use `IconButton` with both icon+label and icon-only children (`canvas/src/components/Toolbar.tsx:118-160`, `canvas/src/components/SidebarTrigger.tsx:12-27`).

## Changes
- Replace the generic root wrapper with semantic `button` to remove custom keyboard handling and `role`/`aria` duplication.
- Render `children` directly and move `flex items-center gap-2` to the root when a label is present.
- Remove always-on tooltip wrapper; rely on the native `title` attribute or add an optional `tooltip` prop (default `false`).
- Keep `className` passthrough so existing styles continue to work; add a `variant` prop for common cases (`icon`, `icon+label`).

## API Proposal
- `IconButton` props: `{ title: string; onClick?: () => void; disabled?: boolean; className?: string; children: React.ReactNode; showTooltip?: boolean; }`
- Behavior:
  - Root is `<button>` with `type="button"`, `disabled={disabled}`.
  - Applies `flex items-center gap-2` only when there are multiple children (icon + label).
  - Emits `title` always; renders tooltip content only when `showTooltip` is true.

## File Updates
- Update `canvas/src/components/IconButton.tsx`:
  - Remove `handleKeyDown` and `role="button"` (`lines 12-18`, `21-27`).
  - Change root to `<button>`; move `className` and `title`; conditionally apply `flex` classes.
  - Remove wrapper around `children` (`line 30`).
  - Remove tooltip wrapper or gate it behind `showTooltip` (`lines 33-35`).
- Update usages:
  - `canvas/src/components/Toolbar.tsx` and `SidebarTrigger.tsx`: no structural changes needed; verify styles still match, optionally remove redundant label text spacing if root handles flex.

## Verification
- Run the app and inspect DOM for Zoom In/Out buttons: ensure icons and labels are direct semantic button contents.
- Check keyboard focus/activation: Space/Enter invoke `onClick` via native button behavior.
- Confirm hover styles and disabled states remain correct.
- Ensure no duplicate tooltip wrappers appear; `title` displays native tooltip.

## Rollback Safety
- Minimal change footprint; if needed, re-enable tooltip via `showTooltip`.
- No external dependencies added; styles remain in caller `className`.

Do you want me to proceed with these changes and update the component plus usages accordingly?
