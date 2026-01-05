## Objectives
- Implement universal, complete, high‑fidelity, lossless import/export for `CSV`, raw `JSON`, and `JSON‑LD` for graph and schema elements.
- Strengthen parsing/creation/read/update/delete flows for schema and data; preserve all properties and coordinates.
- Remove stale/duplicate/hardcoded logic; prevent re‑renders, infinite loops, and memory leaks; improve memoization/caching.

## Current Capabilities
- CSV IO: `canvas/src/lib/graph/csv.ts` — `parseCsvToGraph(text)` at `canvas/src/lib/graph/csv.ts:121`; `graphToCombinedCsv(data)` at `canvas/src/lib/graph/csv.ts:223`.
- JSON‑LD IO: `parseJsonLd(jsonld)` at `canvas/src/lib/graph/jsonld.ts:8`; `toJsonLd(data)` at `canvas/src/lib/graph/jsonld.ts:77`.
- File routing: `loadGraphFile()` at `canvas/src/lib/graph/file.ts:33`; `exportGraphAsCombinedCSV()` at `canvas/src/lib/graph/file.ts:157`.
- Legacy JSON adapter: `rawToGraphData` (raw `{nodes,edges}`) — `canvas/src/lib/graph/rawToGraph.ts`.
- Schema IO/validation: `validateSchema` at `canvas/src/features/schema/validation.ts:111`; import/export helpers in `canvas/src/features/schema/io.ts`.
- Tab sync: `createTabSync` at `canvas/src/lib/tabSync.ts:43`.

## Data IO Enhancements (Graph)
1. CSV Round‑Trip Losslessness
- Define canonical combined CSV schema with `row_type ∈ {node,edge}`; maintain columns for `id`, `type/label`, `source`, `target`, and a `properties` JSON column.
- Parsing: make schema‑aware property typing (numbers, booleans, arrays) using `GraphSchema` where available; fall back to strings to avoid data loss.
- Serialization: always emit every property and coordinates (`kg:x`, `kg:y`, `kg:fx`, `kg:fy`) into `properties` JSON; ensure stable column order and quoting/escaping.
- Robustness: accept edges‑only or nodes‑only CSV, auto‑detect via header/rows; tolerate BOM, CRLF, mixed delimiters; strict error messages.

2. JSON (raw) Interop
- Expand `rawToGraphData` to accept variants: `{nodes,links}` and nested `data` property maps; preserve unknown fields into `properties`.
- Add `graphToRawJson(data)` for symmetric round‑trip when needed.

3. JSON‑LD Fidelity
- Detection: accept compacted (`@context`, `@graph`) and array‑root forms; detect reified edges via `kg:subject/predicate/object` and simple edge documents.
- Typing: map node `@type` to schema node types; parse property value types using schema; preserve unknown fields.
- Coordinates: guarantee persistence of `kg:x/y/fx/fy` for layout stability.
- Context: include stable app `@context` when serializing; avoid changes that would break existing pipelines.

## Schema IO and CRUD Enhancements
1. JSON Export/Import
- Export: flatten `GraphSchema` (node types, edge labels, property specs, cardinality, endpoint matrix, defaults) to JSON.
- Import: validate via `validateSchema` and merge with defaults; report actionable errors.

2. JSON‑LD Schema Support (Optional)
- Provide a JSON‑LD representation of schema concepts for interoperability (node class, edge predicate, property range/domain). Keep optional to avoid new deps.

3. CSV Schema (Optional for spreadsheets)
- Add `schemaCsv.ts` to import/export schema via CSV sheets: `node_types`, `edge_labels`, `properties`, `constraints`.

4. CRUD APIs
- Extend `schemaSlice` to expose typed CRUD helpers to create/read/update/delete schema elements atomically, with validation and history integration.

## Unified IO Adapter and Detection
- Introduce `canvas/src/lib/graph/io/adapter.ts` with a single `parse(name, text)` that returns `{ data: GraphData, meta }`, routing to CSV/raw/JSON‑LD parsers.
- Emit `ParseDiagnostics` that include warnings and decisions (e.g., field coercions, dropped duplicates) for user feedback.
- Centralize all exports to use canonical paths: JSON‑LD (primary), combined CSV, nodes/edges CSV, raw JSON.

## High‑Fidelity Guarantees
- Round‑trip Tests: ensure `formatA → GraphData → formatA` equality for fields and coordinates for CSV, JSON‑LD, raw JSON.
- Unknown Field Preservation: any unrecognized fields stored under `properties` to avoid loss.
- Stable IDs/Types: preserve IDs and `@type`/labels; maintain edge identity including reified edges and their properties.

## Performance & Cleanup
1. Tab Sync Lifecycle
- Add `destroy()` to `createTabSync` and ensure `window.removeEventListener('storage', ...)` and `bc.close()` are called; prefer singleton per channel name.
- Update consumers to use a memoized `syncRef` and call `destroy()` on unmount.

2. Timer Cleanup
- `BottomPanel.tsx` clear pending `codeSelectTimerRef` on unmount to avoid dangling timeouts (`canvas/src/components/BottomPanel.tsx:424–430`).

3. Memoization & Re‑renders
- Adopt selector‑based `useGraphStore` calls with shallow compare to reduce re‑renders; memoize heavy derived values (`adjacency`, `search indexes`).
- Adjacency cache invalidation: bind `WeakMap` entries to `GraphData` object identity and reset on mutation; avoid stale caches.

4. Duplicate/Hardcode Removal
- Consolidate export functions in `file.ts` through the unified adapter; remove branching duplication and hardcoded prefs handling; de‑stale LS reads.

## Implementation Plan (Files)
- `canvas/src/lib/graph/csv.ts`: strengthen parser/serializer; schema‑aware typing; strict CSV quoting/escaping.
- `canvas/src/lib/graph/jsonld.ts`: expand detection and preserve unknown fields; ensure `kg:*` coordinates round‑trip.
- `canvas/src/lib/graph/rawToGraph.ts`: broaden raw formats; add serializer.
- `canvas/src/lib/graph/io/adapter.ts`: new unified parse/export APIs and diagnostics.
- `canvas/src/lib/graph/file.ts`: route through adapter; simplify export codepaths.
- `canvas/src/features/schema/io.ts`: optional JSON‑LD and CSV schema modules; improve error/merge behavior.
- `canvas/src/lib/tabSync.ts`: add `destroy()`; singleton channel map.
- `canvas/src/components/BottomPanel.tsx`: clear timer on unmount; reuse shared tab sync.
- Tests: `canvas/src/lib/graph/io/__tests__/roundtrip.spec.ts`; fixtures under `test-data/*`.

## Verification
- Unit tests for round‑trip across formats; edge cases for types, arrays, coordinates, reified edges.
- Manual QA via Toolbar actions; load/save/export all formats; verify schema import/export.
- Profiling memory with DevTools; verify no leaked channels/listeners; validate render counts after memoization changes.

## Risks & Alternatives
- Avoid adding heavy JSON‑LD libraries to keep bundle size stable; current custom mapping remains but becomes stricter and more explicit.
- CSV variability across user files handled with robust detection; diagnostics surface any coercions rather than fail silently.
- If needed later, consider `d3-dsv` for parsing consistency, but keep custom implementation today to match existing patterns.