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
- **Renderer**: a single `<canvas>` that draws header + pinned columns + scrollable region in one pass.
- **Model**: a derived grid model that computes column layout, row grouping/visibility, and selection metadata.

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
