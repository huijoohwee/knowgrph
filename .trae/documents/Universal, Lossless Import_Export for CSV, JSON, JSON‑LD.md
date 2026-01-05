## Goals

* Make CSV, JSON, and JSON‑LD import/export universal, complete, and lossless for `GraphData` (nodes, edges, labels, types, coordinates, and arbitrary properties).

* Clean up re-render loops and improve memoization/caching where useful.

## Format Strategy

* Canonical internal shape: `GraphData` with `nodes: {id,label,type,x,y,fx,fy,properties}` and `edges: {id,source,target,label,properties}`.

* Support multiple external shapes:

  * CSV: mixed rows via either `row_type=node|edge` or `kind=node|edge` with flexible column names (`label|name`, `source|source_id`, `target|target_id`, `predicate|edge_type`). Extra columns become `properties`.

  * JSON: two variants

    * Raw `GraphData` (the app’s JSON export) → import as-is; export as-is (lossless).

    * Legacy raw `{nodes:[{id,data:{...}}], edges:[{id,source,target,data:{...}}]}` → convert via `rawToGraphData`.

  * JSON‑LD: full round-trip with arbitrary predicates and edge properties.

## JSON Loader Detection

* Update `loadGraphFile` and worker parser:

  * If `json.nodes[0]` has `properties` or `json.edges[0]` has `label`, treat as `GraphData` and load directly.

  * Else if `json.nodes[0].data` exists, use `rawToGraphData`.

  * Else parse as JSON‑LD.

## JSON‑LD Lossless Round‑Trip

* Export (`toJsonLd`):

  * Nodes → `@graph` items with `@id=kg:<id>`, `@type=<type>`, `name=<label>`, and all `properties` merged. Persist optional `x,y,fx,fy` under reserved keys (e.g., `kg:x`, `kg:y`, `kg:fx`, `kg:fy`).

  * Edges → two encodings:

    * Simple: for each edge label L, add array `kg:L: [kg:<target>]` on the source item when no edge properties.

    * Reified: if edge has `properties`, create an edge node with `@id=kg:e:<edgeId>`, `kg:subject=kg:<source>`, `kg:predicate="L"`, `kg:object=kg:<target>`, and merge `properties` on the edge node.

  * Context: define `kg`, `kg:subject`, `kg:predicate`, `kg:object`, `kg:x`, `kg:y`, `kg:fx`, `kg:fy`, and dynamic `kg:<edge label>` terms.

* Import (`parseJsonLd`):

  * Build node map from `@graph` items with `@id`.

  * Extract simple edges from predicate arrays (any property whose values are `@id`s).

  * Extract reified edges by scanning items with `kg:subject`, `kg:predicate`, `kg:object`, create edges with label and merged properties.

  * Recover coordinates from reserved `kg` keys; preserve all other properties.

## CSV Universal Import

* Extend `parseCsvToGraph` (already partially enhanced):

  * Accept `kind` and `row_type`.

  * Accept `name` as `label`, `source/target` and `edge_type` as predicate.

  * Carry unknown columns into `properties`; parse numeric-looking values as numbers.

  * Preserve weights and any extra edge fields.

## CSV Export

* Keep single `CSV` option and continue exporting the mixed file with `row_type` header.

* Since importer supports both `row_type` and `kind`, consider adding an advanced setting later to choose preferred header; default remains `row_type`.

## Performance & Cleanup

* Store selectors:

  * Continue migrating components (SettingsPanel, SearchPanel, BottomPanel, SidebarTrigger) to `useShallow` selectors to minimize updates.

* Memoization:

  * Ensure all toolbar handlers are `useCallback`.

  * Keep `IconButton` wrapped in `React.memo`.

* Worker parsing:

  * CSV and JSON/JSON‑LD already run in a worker via `parseGraphInWorker`; maintain.

* Remove stale code:

  * Normalize JSON loader logic to avoid mismapped shapes.

  * Eliminate redundant type hacks.

## Tests

* Add round‑trip tests:

  * CSV → GraphData, GraphData → CSV (combined), CSV → GraphData; ensure equality on nodes/edges/labels/properties.

  * JSON GraphData round‑trip (export/import exact shape).

  * JSON‑LD round‑trip including reified edges with properties and coordinates.

* Integrate into `canvas/src/tests/run.ts` harness.

## UI

* Export menu remains `JSON` and `CSV` only.

* No UI changes required beyond existing improvements.

## Deliverables

* Updated loader detection in `file.ts` and `graphParser.worker.ts`.

* Enhanced `toJsonLd` and `parseJsonLd` for lossless edges and properties.

* Extended CSV importer (already partially done) and verified with tests.

* Selector/memoization cleanup in affected components.

## Rollout

* Implement changes incrementally, run type checks, and validate with sample files (including your `unicorn-investors-top-3-test.csv`).

* Provide migration notes for JSON‑LD consumers about reified edges and reserved `kg:*` keys for coordinates.

