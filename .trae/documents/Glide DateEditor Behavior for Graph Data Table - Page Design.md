# Page Design Spec (Desktop-first)

## Global Styles
- Theme tokens: reuse existing panel tokens (background, borders, text colors) so the table remains visually identical.
- Typography: inherit the existing `panelTypography` sizing rules; do not introduce a new font scale.
- Interactive states:
  - Header hover: unchanged.
  - Date cell focus: same focus ring/outline style currently used by the cell editor input.
  - Invalid date: subtle inline feedback (e.g., border + helper text) but keep within existing panel token palette.

## Page: Graph Data Table

### Layout
- Primary layout: Flexbox column.
  - Top: fixed header bar (48px) with dataset switch + quick actions.
  - Body: split layout (grid left, inspector right).
  - Resizable inspector width via vertical drag handle (existing behavior).
- Responsive behavior:
  - Desktop-first. Below ~1024px, inspector can auto-collapse; grid becomes full-width.

### Meta Information
- Title: "Graph Data Table"
- Description: "Edit nodes and edges in a fast grid with column reordering and date editing."
- Open Graph: title + description consistent with above.

### Page Structure
1. Header
2. Toolbar row (filters/sort/grouping/row height)
3. Grid viewport (custom canvas grid)
4. Inspector panel (details for selected row)
5. Overlays (cell editor, date picker popover)

### Sections & Components

#### 1) Header (existing UI preserved)
- Left: page title “Graph Data Table”.
- Dataset tabs: “Nodes” and “Edges”.
- Right: row count and table actions (unchanged).

#### 2) Toolbar (existing)
- Controls for filter match, filter clauses, grouping, sorting, row height preset.
- Must not change layout density or control ordering.

#### 3) Grid viewport (existing)
- Rendered via canvas for performance.
- Column header row supports:
  - Selection highlight
  - Resize affordance
  - Drag-to-reorder with a left/right insertion hint

#### 4) Cell editor overlay (existing behavior extended)
- Overlay container: positioned absolutely within the grid viewport layer.
- Non-date cells: current single-line input behavior stays.

#### 5) DateCellEditor overlay (new; Glide DateEditor demo behavior)
- Trigger: editing a cell whose column kind is `date`.
- Visual composition (same footprint as existing editor unless picker is opened):
  - Row 1: text input (ISO-like or locale-friendly format; consistent formatting rules across table).
  - Row 2 (optional, only when invalid): compact helper line “Invalid date”.
  - Popover (opens on icon click or Alt+Down): calendar picker.
- Interactions:
  - Enter: commit (only once).
  - Escape: cancel and restore previous value.
  - Blur: commit only when no calendar interaction is in progress.
  - Clear: quick clear button (appears on hover/focus) to set empty value.

#### 6) Alignment across modes/zooms
- The editor and popover must anchor to the cell rect from hit-testing/layout (CSS pixel coords).
- Reposition rules:
  - On grid scroll: update anchor via rAF batching.
  - On resize / theme change / devicePixelRatio change: recompute rect and redraw once.
  - On workspace mode switch (e.g., Document Structure Mode): preserve column order/widths and close any open editor safely.
