## Overview
- Add CSV support to the existing Load flow so the toolbar can import JSON‑LD, plain JSON (nodes/edges), and CSV.
- Keep the single “Load” button; auto‑detect content type by file extension and headers.

## Current Behavior
- The Load button triggers `handleLoad` which calls `loadGraphFile` and stores the result via `setData` (`canvas/src/components/Toolbar.tsx:58-65`).
- `loadGraphFile` only opens JSON‑LD or JSON files; it parses raw `{nodes,edges}` via `rawToGraphData` or JSON‑LD via `parseJsonLd` (`canvas/src/lib/graph/file.ts:5-25`).
- CSV is supported only for exports (`exportGraphAsCSV`, `exportNodesAsCSV`) but not imports (`canvas/src/lib/graph/file.ts:97-151`, `153-193`).

## Goal
- Enable loading of three formats from the toolbar:
  - JSON‑LD (`.jsonld`, `.json` with `@context/@graph`)
  - Plain JSON graph (`.json` with `nodes[]`, `edges[]`)
  - CSV (`.csv`) for edges and nodes

## Implementation
- Update the file picker to accept CSV as well as JSON‑LD:
  - Extend `window.showOpenFilePicker` types with `text/csv` and `['.csv']` in `loadGraphFile` (`canvas/src/lib/graph/file.ts`).
- Create `csv.ts` parser with small, dependency‑free CSV parsing:
  - `parseCsv(text)`: returns array of row objects keyed by header; handles quoted fields and escaped quotes (`""`).
  - `detectCsvKind(headers)`: returns `'nodes'` if headers match `id,label,type,properties`; returns `'edges'` if headers match our export or RDF‑like variant.
  - `toGraphFromNodesCsv(rows)`: builds `GraphNode[]` and `GraphEdge[]=[]`; parses `properties` JSON string when present; defaults `type='Entity'` if missing.
  - `toGraphFromEdgesCsv(rows)`: builds `GraphEdge[]` from `source_*`/`target_*` or `subject_*`/`object_*`; collects unique nodes with `id/label/type` from row data; skips rows missing `source_id` or `target_id`; maps `predicate` to edge `label`; places `weight` into edge `properties`.
  - Normalize headers to support both our export (`source_id,source_label,source_type,predicate,target_id,target_label,target_type,weight`) and pipeline output (`subject_id,subject_type,subject_name,predicate,object_id,object_type,object_name,weight`) such as `data/outputs/a0.csv:1`.
- Wire CSV parsing into `loadGraphFile`:
  - After reading the file, branch by extension:
    - `.json/.jsonld`: current logic remains (`rawToGraphData` or `parseJsonLd`).
    - `.csv`: parse via `csv.ts`; set `context='csv-import'`, `type='Graph'`.
- Minor UX tweak: change the Load button tooltip title from “Load JSON‑LD” to “Load Data” in `Toolbar` (`canvas/src/components/Toolbar.tsx:61`).

## Edge Cases & Rules
- Large CSV: stream not required; parse in memory; warn if > 10MB.
- Quoted commas/newlines: parser handles quoted fields and `""` escapes.
- Missing labels/types: default node `label=id`, `type='Entity'`.
- Duplicate nodes/edges: de‑duplicate by `id` while collecting.
- Rows with literal objects (no `object_id`): skip or model as non‑graph attributes; for simplicity, skip such rows.

## Verification
- Manual import tests via the dev server:
  - Load `test-data/nodes.csv` and confirm nodes appear; edges empty.
  - Load `data/outputs/a0.csv` and confirm nodes & edges render; spot‑check a few IDs and predicates.
  - Load `test-data/unicorn-investors-test.json` (via `unicornLoader` style) and confirm current behavior unchanged (`canvas/src/lib/graph/unicornLoader.ts:36-57`).
- Sanity checks in UI:
  - Ensure `Export` still works (JSON, Edges CSV, Nodes CSV) and round‑trips without crashes.

## Files to Change/Add
- Change: `canvas/src/lib/graph/file.ts` — add CSV accept type; branch for `.csv` and call CSV parser.
- Add: `canvas/src/lib/graph/csv.ts` — implement CSV parsing and graph builders for nodes/edges CSV.
- Change: `canvas/src/components/Toolbar.tsx` — update tooltip title to “Load Data”.

## Expected Outcome
- The Load button seamlessly imports JSON‑LD, plain JSON, and CSV, auto‑detecting structure and producing a consistent `GraphData` for rendering.
