## Overview
- Add an "Export" control to the canvas toolbar (to the right of "Save") that exports the current graph as CSV or JSON.
- Use the existing `GraphData` shape and File System Access API used by `saveGraphFile`.

## Data Formats
- JSON: Save the current `GraphData` as `graph.json` with `{ context, type, nodes, edges }`.
- CSV: Export edges to `edges.csv` with columns: `source_id,source_label,source_type,predicate,target_id,target_label,target_type`.
  - `predicate` uses the edge `label` (e.g., `investsIn`).
  - Optional future extension: add `nodes.csv` for node properties if needed.

## Implementation Steps
1. File utilities (`canvas/src/lib/graph/file.ts`):
   - Add `exportGraphAsJSON(data: GraphData)` that writes `application/json` using `window.showSaveFilePicker`.
   - Add `exportGraphAsCSV(data: GraphData)` that maps `data.edges` to rows and writes `text/csv`.
   - Fallback: if File System Access API is unavailable, create an object URL and trigger a download via a temporary `<a>` element.
2. Toolbar UI (`canvas/src/components/Toolbar.tsx`):
   - Add an `Export` button next to `Save` (consistent Tailwind classes).
   - Implement a small dropdown menu with two options: `Export JSON` and `Export CSV`.
   - Wire menu items to `exportGraphAsJSON(data)` and `exportGraphAsCSV(data)`.
   - Disable export when `data` is null.

## UI Behavior
- Button: same styling as `Load`/`Save` (`Toolbar.tsx:36-43`).
- Dropdown: simple, local state (e.g., `isExportOpen`) with absolute positioning; closes on selection or outside click.
- Accessibility: `title` attributes for clarity.

## File API & Fallbacks
- Prefer `window.showSaveFilePicker` (already used in `saveGraphFile` at `canvas/src/lib/graph/file.ts:27-45`).
- Gracefully fallback to anchor-download when the API is not available.

## Testing
- Manual: Load a graph, then export JSON and open to verify nodes/edges. Export CSV and inspect header and a few rows.
- Verify disabled state when no graph is loaded.
- Cross-check `predicate` values align with edge labels (`jsonld.ts:60-73` uses `investsIn`).

## Code Touchpoints
- `canvas/src/components/Toolbar.tsx` — add Export UI next to Save (`Toolbar.tsx:36-43`).
- `canvas/src/lib/graph/file.ts` — add `exportGraphAsJSON` and `exportGraphAsCSV` utilities (`file.ts:27-45` for reference pattern).
- `canvas/src/lib/graph/types.ts` — rely on `GraphData` shape (`types.ts:20-25`).