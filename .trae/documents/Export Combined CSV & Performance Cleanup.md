## Export Combined CSV
- Add `exportGraphAsCombinedCSV(data)` in `canvas/src/lib/graph/file.ts` next to existing exports (`exportGraphAsCSV` at canvas/src/lib/graph/file.ts:94 and `exportNodesAsCSV` at canvas/src/lib/graph/file.ts:131).
- Single CSV includes both nodes and edges using a superset header:
  - `row_type,id,label,node_type,properties,source_id,source_label,source_type,predicate,target_id,target_label,target_type,weight`
  - Node rows set `row_type=node` and fill `id,label,node_type,properties`; edge-only fields empty.
  - Edge rows set `row_type=edge` and fill `source_*`, `predicate`, `target_*`, `weight`; node-only fields empty.
- Use existing save helpers: `saveBlobWithPicker` and `downloadBlob` with format key `csv-combined`, suggested filename `graph.csv`.

## Toolbar Wiring
- In `canvas/src/components/Toolbar.tsx` add a fourth menu item under Export dropdown (currently at canvas/src/components/Toolbar.tsx:150–170):
  - Label: `Combined CSV`
  - Handler `handleExportCombinedCSV` calls `exportGraphAsCombinedCSV(data)` and closes the panel.
- Button the user selected is `IconButton` (canvas/src/components/IconButton.tsx:18–38). No DOM changes required; reuse existing `DropdownPanel`.

## CSV Parsing (Optional Future)
- Extend `parseCsvToGraph` in `canvas/src/lib/graph/csv.ts` (see detection at canvas/src/lib/graph/csv.ts:54–62):
  - Support mixed files by parsing per-row: if `row_type=node` → build node; if `row_type=edge` → build edge; else fall back to existing detection for pure nodes/edges files.
- Preserve backward compatibility with existing separate nodes/edges CSV formats.

## Performance & Cleanup
- Reduce re-renders in Toolbar:
  - Replace broad store destructuring with selectors using shallow compare for only needed fields (current destructuring in canvas/src/components/Toolbar.tsx:24 pulls many signals).
  - Wrap export handlers with `useCallback` to stabilize props passed to children.
- Memoize lightweight components:
  - Wrap `IconButton` with `React.memo` to avoid needless updates when `title`, `disabled`, `onClick`, `children` are unchanged (canvas/src/components/IconButton.tsx).
- Ensure stable dependencies in `GraphCanvas`:
  - The main build effect depends on many nested schema fields (canvas/src/components/GraphCanvas.tsx:239–252). Consolidate into derived memoized values to avoid unnecessary teardown/rebuild cycles when unrelated schema keys change.
- Audit and remove small stale/hardcoded/duplicate bits:
  - Eliminate duplicated `// @ts-ignore` lines in `file.ts` near save (canvas/src/lib/graph/file.ts:59–60).
  - Normalize export filename preference keys (`csv-edges`, `csv-nodes`) and add `csv-combined` for consistency (canvas/src/lib/graph/save.ts used via `readExportPrefs`/`writeExportPrefs`).
- Memory safety:
  - Export uses `URL.revokeObjectURL` already (canvas/src/lib/graph/save.ts:19–27). Keep that pattern in the new exporter.

## Validation
- Add unit test for CSV generator with a small graph to assert:
  - Header correctness and quoting
  - Node row fields populated; edge row fields populated; empties in others
- Manual check via UI:
  - Open app, load `public/unicorn-investors-test.json` and export `Combined CSV`.
  - Verify file content and that export panel closes.

## Notes
- No changes to schema or canvas rendering are required for CSV export.
- Import support for combined CSV is optional; can be implemented after confirming export format.