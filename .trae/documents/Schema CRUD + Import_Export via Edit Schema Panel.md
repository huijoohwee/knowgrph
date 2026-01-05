## Goals
- Support Create, Read, Update, Delete, Import, Export of the global graph schema via the existing Edit Schema panel button.
- Keep files under 600 lines by extracting feature-scoped utilities while preserving the current API and avoiding duplicates, stale code, infinite loops, and memory leaks.

## Current State
- Edit panel component: `canvas/src/components/SchemaEditorPanel.tsx:9–471` shows Apply, Format, New, Copy JSON, Clear Customizations; tabs for Types, Properties, Advanced.
- Store actions for schema: `canvas/src/hooks/store/schemaSlice.ts:3–440` expose `setSchema`, type/label CRUD, property CRUD, style/behavior/layout updates.
- Schema model and default: `canvas/src/lib/graph/schema.ts:24–125`.
- Toolbar launches the panel: `canvas/src/components/Toolbar.tsx:222–234`.
- File IO helpers (graph-only today): `canvas/src/lib/graph/file.ts:32–149`, `canvas/src/lib/graph/save.ts:1–42`.

## Implementation
### UI Additions in SchemaEditorPanel
- Add header actions: `Import Schema`, `Export Schema`, `Reset to Default` next to Apply/Format/New/Copy/Clear.
- `Import Schema`: open file picker, parse JSON, validate against `GraphSchema`, then call `setSchema(obj)`.
- `Export Schema`: download current `schema` as `schema.json` using browser save picker with fallback.
- `Reset to Default`: confirm, then set `defaultSchema`.
- Preserve existing shortcuts and edit-mode gating (`isEditMode`).

### Feature‑Scoped Utilities (preserve API)
- Create `canvas/src/features/schema/io.ts`:
  - `pickFile(): Promise<File|null>` (non-interactive fallback as in graph IO).
  - `loadSchemaFromFile(): Promise<GraphSchema|null>` parses JSON, validates, returns `null` on failure.
  - `exportSchemaAsJSON(schema: GraphSchema): Promise<void>` uses save picker or anchor fallback.
- Create `canvas/src/features/schema/validation.ts`:
  - `validateSchema(candidate: unknown): GraphSchema` performs shape checks, fills missing optional maps/arrays, clamps numeric ranges, and ensures catalogs are arrays.
- Create `canvas/src/features/schema/derive.ts`:
  - `uniqueNodeTypes(data, schema): string[]` and `uniqueEdgeLabels(data, schema): string[]` (extract logic currently in `SchemaEditorPanel.tsx:60–76`).
- Refactor `SchemaEditorPanel` to import `derive` helpers; keep `useMemo` to avoid re-render loops.
- Do not change `useGraphStore` or `schemaSlice` API; only call existing actions.

### Wiring
- In `SchemaEditorPanel`, wire buttons:
  - Import: `const loaded = await loadSchemaFromFile(); if (loaded) setSchema(loaded);`
  - Export: `await exportSchemaAsJSON(schema);`
  - Reset: `setSchema(defaultSchema);` with a confirm UI.

### Consistency & Safety
- Validation ensures presence of maps (`nodeStyles`, `edgeStyles`, `propertySchemas`, etc.) and safe defaults; prevents `undefined` access crashes.
- Keep numeric values bounded (e.g., `alphaDecay` 0–1) consistent with existing reducers (`schemaSlice.ts:60–65`).
- Remove duplicated inline type/label derivations by using `derive.ts` (reduces panel size, improves readability).
- Avoid memory leaks: detach temporary DOM elements in `io.ts` and reuse the object URL cleanup pattern in `save.ts:19–27`.
- No infinite loops: state updates only via user actions; text area formatting guarded by try/catch (`SchemaEditorPanel.tsx:78–86`).

### Tests
- Add `canvas/src/__tests__/schema.test.ts`:
  - should import valid schema json then set store
  - should reject invalid schema and not change store
  - should export schema to a blob/string
  - should upsert/remove properties correctly (node and edge)
  - should add/rename/remove node types and edge labels
  - should respect clamps (alphaDecay, charge) per reducers

### Deliverables
- `SchemaEditorPanel` with Import/Export/Reset actions wired.
- New feature utilities under `features/schema/{io,validation,derive}.ts` keeping files small and focused.
- Unit tests for schema IO and CRUD behavior.
- No breaking changes to existing public API or store actions; runtime validated and guarded against loops and leaks.

Confirm and I will implement, refactor, and add tests immediately.