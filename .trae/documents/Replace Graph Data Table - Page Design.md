# Page Design Spec — Replace Graph Data Table

## Global Styles (Desktop-first)
- Layout system: Flexbox-first (`flex`, `min-h-0`, `overflow-hidden`) to keep canvas + panels performant.
- Theme: use existing CSS variables/tokens (e.g., `--kg-panel-bg`, `--kg-text-primary`) and `UI_THEME_TOKENS` utility classes.
- Typography: follow current “panel typography” scale (micro label, body, header) to match existing Bottom Panel styling.
- Colors:
  - Panel background: `var(--kg-panel-bg)`
  - Divider/border: `var(--kg-divider)` / `var(--kg-border)`
  - Selection highlight: align with existing blue selection token used across UI.
- Buttons/hover:
  - Default: text button with subtle hover background
  - Active: stronger background + contrasting text

## Page 1: Canvas Workspace

### Meta Information
- Title: Canvas Workspace
- Description: Interactive graph canvas with Bottom Panel tools including Graph Data Table.
- Open Graph: inherit site defaults (no page-specific OG required for app-like SPA).

### Page Structure
- Primary composition: “Main canvas + Bottom Panel” with optional split inspector.
- Container: full-viewport app shell; internal sections use `min-h-0` to avoid scroll jank.

### Sections & Components

#### 1) Top/Global Workspace Controls (existing)
- Purpose: expose mode/zoom controls (including baseline lock) without being affected by table refactor.
- Interaction states:
  - Baseline lock ON: show locked state; mode switches blocked.
  - Baseline lock OFF: normal mode switching.

#### 2) Bottom Panel — Graph Data Table

##### 2.1 Table Header Bar
- Layout: fixed height (≈48px), `flex`, left-aligned title and dataset toggles, right-aligned actions.
- Elements:
  - Title label: “Graph Data Table”.
  - Dataset toggle buttons: “Nodes”, “Edges” (segmented-control style).
  - Row count text (secondary/tertiary).
  - Actions: Split/Single toggle, “+ Row”, “Delete” (Delete disabled when no selection).

##### 2.2 Table Toolbar Row
- Layout: compact horizontal toolbar (`flex`, wrap allowed if narrow).
- Elements:
  - Collapse toggle for table area.
  - Column visibility control.
  - Filter controls: match any/all + list of clauses.
  - Group-by selector.
  - Sort rule editor (multi-column order).
  - Row height preset selector.
  - Column width reset button.

##### 2.3 Table Content Area (Fast Grid)
- Layout: fills remaining panel height; `overflow-hidden` on container; grid manages its own scroll.
- Rendering approach:
  - Canvas-based grid (glide-data-grid-like) for high row counts.
  - Sticky header row.
  - Left pinned utility columns:
    - Selection checkbox column (fixed ~44px)
    - Order/row number column (fixed ~72px)
- Interactions:
  - Scroll: wheel/trackpad scrolls inside the grid only.
  - Selection:
    - Checkbox to select rows; header checkbox selects all visible rows.
    - Row click selects the row and syncs selection to the canvas.
  - Focus:
    - When selection originates outside the table, the focused row auto-scrolls into view.
  - Resize:
    - Column resize handles in header; live resize with min/max widths; persists widths.
  - Editing:
    - Cell edit for non-ID columns; commit updates on confirm; cancel restores prior value.
- Responsive behavior (desktop-first):
  - At narrower widths, prioritize horizontal scrolling in grid over wrapping.

##### 2.4 Inspector Split Pane (optional)
- Layout: right-side pane with draggable vertical resize separator.
- Content: single-row inspector showing editable fields for the selected row.

##### 2.5 Canvas Preview Dock (Table view mode)
- Layout: right-side dock visible when workspace view is “table”.
- Purpose: show canvas preview while working in the table.

### Document Mode baseline sync requirements (design-facing)
- When baseline lock is enabled, show a clear “locked” affordance in global controls.
- Table must remain fully usable (scroll/select/resize/edit) while baseline lock prevents any unrelated mode/zoom changes.
- Pointer/wheel events over the grid must not cause canvas zoom or mode changes.

### Accessibility & States
- Keyboard focus ring visible for header buttons and grid cell editor.
- Disabled states: “Delete” disabled when no selection; hover styles suppressed when disabled.
- Empty state: if no rows, show a subtle “0 rows” and render header + empty grid area.