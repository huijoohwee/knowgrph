# Knowgrph Graph Data Table (Host) — Canvas Fast Grid

**Context**: Editor workspace Graph Data Table (host-owned)

**Intent**: Render large `GraphData` tables (Nodes/Edges) with stable scroll/selection/inspector behavior.

**Directive**: Use a canvas fast-grid with a single scroll owner and explicit scroll extents; forbid ResizeObserver→React state loops, scroll/resize feedback loops, canvas resize jitter, and any path where scrolled text can appear under pinned header/columns.

---

## Ownership

- This Graph Data Table is **host-owned** (Knowgrph) and is **not** the extracted `curagrph` Graph Data Table surface.
- It exists as an Editor workspace tool for inspecting the active graph view and syncing selection with preview/TOC.

---

## Architecture (Fast Grid)

- **Scroll owner**: a single `overflow-auto` viewport element.
- **Scroll extents**: a dedicated spacer element whose `width/height` are set to `layout.totalWidth/layout.totalHeight` so `scrollWidth/scrollHeight` are correct.
- **Renderer**: a `<canvas>` draws the body grid; the header is a DOM overlay synced to the same scroll owner.
- **Model**: a derived grid model that computes column layout, row grouping/visibility, and selection metadata.

### Column Rearrangement (Drag Header)

- Drag a **data column header** to reorder columns (drop hint line renders in the header band).
- Column order is persisted in local storage per table (`kg:ui:graphTable:columnOrderByTableId`) as an ordered list of `columnId`s. The RxDB `GraphColumnDoc.order` remains the base/default order when no user override is present.
- Resize and reorder share the header: resizing is only active near the right edge of a header cell; reordering is active elsewhere.
- Header click selects a column (highlights the full column in the grid body).

Code references:

- `knowgrph/canvas/src/features/graph-table/ui/GraphTableFastGrid.tsx`
- `knowgrph/canvas/src/features/graph-table/ui/fast-grid/canvasGridRender.ts`

---

## Failure Modes (What to Avoid)

### 1) ResizeObserver loop → flicker / re-render storm

Anti-pattern:

- ResizeObserver updates React state that affects layout and triggers another resize, creating a render loop.

Guardrails:

- Do not store viewport size in React state if it is only used to compute scroll extents.
- Batch DOM style updates in `requestAnimationFrame` and avoid redundant style writes.

Notes (header overlay):

- If a DOM header overlay is used, it must not create a second scroll owner. Horizontal alignment should be driven by translating the header content by `-scrollLeft` from the single viewport scroll owner.
- Avoid header pointer-event traps that prevent body scrolling. Prefer `pointer-events: none` on the header wrapper and enable `pointer-events: auto` only on header interactive controls (buttons/resizers).

### 2) Scroll/resize feedback loop → vertical scroll breaks

Anti-pattern:

- Using padding on a `border-box` full-size spacer (`w-full h-full`) to “extend” scroll height.

Guardrails:

- Use a spacer element with explicit `style.width/style.height` driven by computed totals.

### 3) Canvas resize jitter → shimmer while scrolling

Anti-pattern:

- Using subpixel `getBoundingClientRect()` dimensions and continuously changing canvas backing store size.

Guardrails:

- Size the canvas from integer `clientWidth/clientHeight` and compute backing store size using DPR rounding.

### 4) Pinned header/columns bleed-through

Anti-pattern:

- Drawing scrollable cells without clipping, so horizontal scroll can draw under pinned bands.

Guardrails:

- Clip drawing for:
  - header scrollable region (`x >= pinnedWidth`)
  - scrollable cell region per row (`x >= pinnedWidth`)
  - entire row pass to exclude header band (`y >= headerHeight`)
- Ensure the background fill is fully opaque for the table surface.
- If a DOM header overlay is used, clip the canvas so it never draws into the header band.

---

## Performance Guardrails

- Cache theme-derived values (fonts/colors) outside the scroll loop; recompute only on theme mutation or viewport resize.
- Snap draw math to integer scroll positions to avoid subpixel text shimmer.
- Keep draw scheduling RAF-throttled and avoid capturing unstable model objects in closures.

---

## Verification Checklist

- Stress vertical + horizontal scroll; confirm smoothness and no visible flicker.
- Confirm `scrollHeight` increases with row count (vertical scroll works).
- Confirm no scrolled text appears under the pinned header row or pinned columns.
- Confirm theme toggles update colors/fonts without triggering render loops.
