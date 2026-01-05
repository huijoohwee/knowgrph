## Goals
- Apply consistent semantic structure across the canvas app for maintainable styling and evolution
- Extend toolbar to use CSS variables for compact/full modes and variable-driven spacing
- Remove conflicting, stale, and duplicate styles

## Scope & Principles
- Introduce semantic classes (Island, App-toolbar, App-toolbar__divider, Stack) and design tokens (CSS variables) as the primary styling layer
- Retain Tailwind utility classes where they add local value, but migrate repeated patterns to semantic classes
- Keep components small, readable, and avoid cross-cutting inline styles

## Design Tokens (CSS Variables)
- Global tokens in `canvas/src/index.css`:
  - Spacing: `--gap`, `--padding`, `--toolbar-gap`, `--toolbar-padding`
  - Divider: `--divider-height`, `--divider-color`
  - Elevation: `--island-radius`, `--island-border-color`, `--island-shadow`
- Default values provided with fallbacks; allow overrides per variant (compact/full) on container elements

## Semantic Components
- Toolbar container
  - Use `Island App-toolbar App-toolbar--compact|full` as root class
  - Divider: `App-toolbar__divider` reads `--divider-height` and `--toolbar-gap`
  - Replace repeated inline divider styles with the divider class (already started at canvas/src/components/Toolbar.tsx:278 and :290)
- Stack utility
  - `.Stack` and `.Stack_horizontal` reading `--gap` for spacing between children
  - Use in places like button groups and tool rows
- Panels & overlays
  - Modal overlay and container classes for Settings and Schema panels
  - Replace repeated inline borders/backdrop styles with semantic classes

## Toolbar Variable Modes
- Add `.App-toolbar--compact` and `.App-toolbar--full` variants that set:
  - `--toolbar-gap`: 0.5rem (compact), 0.75–1rem (full)
  - `--toolbar-padding`: 0.5rem x 0.75rem (compact), 0.75rem x 1rem (full)
  - `--divider-height`: 24px (compact), 28–32px (full)
- Update `canvas/src/components/Toolbar.tsx:121` root element to consume these classes (already aligned to semantic root)

## File Changes (Planned)
- `canvas/src/index.css`
  - Define tokens and semantic classes: Island, App-toolbar (+ variants), App-toolbar__divider, Stack (+ horizontal), ModalOverlay, ModalContainer
- `canvas/src/components/Toolbar.tsx`
  - Ensure root uses `Island App-toolbar` and variant toggles
  - Replace any remaining inline spacing with variable-driven spacing via semantic classes
- `canvas/src/components/StatusBar.tsx:12`
  - Extract border and background into a `StatusBar` semantic class; remove inline border/bg duplication
- `canvas/src/components/BottomPanel.tsx:361–406`
  - Extract overlay/container styling into `ModalOverlay` and `ModalContainer` where applicable; centralize button group spacing using `Stack`
- `canvas/src/components/GraphCanvas.tsx:376–386`
  - Keep canvas absolute fill, but move menu container styling to a semantic class to avoid repeated border/shadow styles

## Duplicate/Stale Cleanup Targets
- Dividers: eliminate any `w-px h-6 bg-gray-300 mx-2` inline repeats in favor of `App-toolbar__divider`
- Panel containers: unify repeated `bg-white/70 backdrop-blur-sm border border-gray-200 rounded shadow` into `ModalContainer`
- Button groups: unify local `gap-2` with `.Stack` using `--gap` for consistency

## Testing & Verification
- Visual verification in dev server; confirm compact/full toggles affect spacing and divider height
- Search for leftover inline divider styles and panel container duplicates across `canvas/src` using repository search
- Ensure toolbar actions remain functional; no change to logic

## Risks & Rollback
- Risk: Over-aggressive refactors could break layouts; mitigate by incremental changes and visual checks
- Rollback: maintain minimal diffs per file; changes are reversible by restoring utility classes

## Deliverables
- Updated CSS tokens and semantic classes in `index.css`
- Refactored Toolbar, StatusBar, BottomPanel, and GraphCanvas containers to use semantic structure
- Removed duplicated inline styles and validated UI behavior

## References
- Toolbar root: `canvas/src/components/Toolbar.tsx:121`
- Divider usage: `canvas/src/components/Toolbar.tsx:278`, `canvas/src/components/Toolbar.tsx:290`
- Status bar inline styles to consolidate: `canvas/src/components/StatusBar.tsx:12`
- Bottom panel container styles: `canvas/src/components/BottomPanel.tsx:361–406`
- Canvas menu container styles: `canvas/src/components/GraphCanvas.tsx:384–386`

## Next Steps
- Implement the outlined CSS classes and refactors
- Verify compact/full mode via toggling container class and adjusting variables
- Sweep for remaining duplicates and finalize cleanup