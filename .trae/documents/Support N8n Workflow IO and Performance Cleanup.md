## Goals
- Load, parse, render, and export the `test-data/customer_sentiment_analysis.json` workflow
- Preserve existing IO API while adding n8n workflow support
- Extract utilities into feature-scoped modules; keep files ≤600 lines
- Remove stale/duplicate/hardcoded logic; prevent re-renders/loops/leaks; improve cache/memoization

## Scope Of Changes
- Add n8n workflow parser producing `GraphData`
- Wire detection into existing parse flow on main thread and worker
- Use node positions to speed initial layout and reduce simulation work
- Export via existing JSON/JSON-LD/CSV pathways
- Add unit tests covering import and edge counts
- Lightweight performance and cleanup refactors (no behavioral change)

## Implementation
### 1) N8n Parser
- Create `src/lib/graph/n8n.ts`
  - `isN8nWorkflow(json)` detects `nodes[]` with `type` like `n8n-nodes-*` and top-level `connections`
  - `parseN8nWorkflow(json): GraphData`
    - Nodes: `id`, `label=name`, `type`, properties include `parameters`, `credentials`, `typeVersion`
    - Positions: map `node.position` to `x/y` if present
    - Edges: iterate `connections` map:
      - For each source name → arrays per channel (e.g. `main`, `ai_embedding`, `ai_vectorStore`, `onError`)
      - Each edge: `source=srcId`, `target=dstId` (resolve via name→id), `label=channel`, `properties={ index }`
- Keep module under 200 lines; no external deps

### 2) Parse Flow Integration
- Update `src/lib/graph/io/adapter.ts`
  - After JSON parse and before raw conversion, if `isN8nWorkflow(json)` then `parseN8nWorkflow(json)`
  - Set `diag.format='json'` with `warnings` if unresolved node names
- Update worker `src/workers/graphParser.worker.ts`
  - Mirror detection and parse path for consistency

### 3) Render
- Existing canvas `src/components/GraphCanvas.tsx` renders `GraphData` nodes/edges directly
  - Positions from n8n `x/y` seed the simulation (no changes needed)
  - Edge labels (channels) pick style from schema; fallback defaults already applied

### 4) Export
- Reuse existing exporters:
  - JSON: `exportGraphAsJSON` (file.ts:65–79)
  - JSON-LD: `exportAsJsonLdBlob` (io/adapter.ts:36–39) → `toJsonLd` (jsonld.ts)
  - Combined CSV: `graphToCombinedCsv` (csv.ts:229–265)
- No workflow-specific exporter required; GraphData is canonical

### 5) Tests
- Add `src/__tests__/n8nParse.test.ts` to assert:
  - Import yields expected node count and ~12 edges from the provided file
  - All edge labels reflect their channels (`main`, `ai_embedding`, etc.)
  - Positions set when present
- Extend round-trip sanity by exporting combined CSV to ensure no crashes

### 6) Performance & Cleanup
- Memoization
  - In toolbar search utilities (`features/toolbar/utils.ts`), cache key already includes version; expose `versionKey` from store to avoid unnecessary recompute
  - In canvas, memoize `edgesForSim` by `data.edges` length + id hash to avoid churn
- Simulation & events
  - Ensure cleanup of listeners is consistent (GraphCanvas.tsx:235–247 already does); keep pattern and avoid duplicate handlers
- Cache hygiene
  - Verify bounded LRU (`lib/cache/LRUCache.ts`) TTL usage; add `.size` accessor if needed for diagnostics (no behavior change)
- Remove duplicates/hardcodes
  - Scan components for redundant wrappers (per existing docs in `.trae/documents`), consolidate imports via feature index barrels

### 7) Feature-Scoped Extraction
- Keep public API stable; move any shared helpers into `src/features/...` folders where appropriate
  - Example: if new edge-channel normalization appears, place in `features/graph/` and re-export from index barrel

## Verification
- Unit tests: run local test runner (`canvas/src/tests/run.ts`) to execute new test
- Manual import: use toolbar load to open the n8n file and verify rendering and panel data
- Export: save JSON/JSON-LD/CSV; open exported CSV in tests to confirm counts

## Code References
- Parse entry: `canvas/src/lib/graph/io/adapter.ts:11–33`
- Worker parse path: `canvas/src/workers/graphParser.worker.ts:10–28`
- Graph types: `canvas/src/lib/graph/types.ts:1–25`
- CSV exporter: `canvas/src/lib/graph/csv.ts:229–265`
- JSON-LD: `canvas/src/lib/graph/jsonld.ts:78–110`
- File export helpers: `canvas/src/lib/graph/file.ts:65–157`

## Notes
- No secrets touched; credentials from workflow remain within node `properties`
- API surface unchanged; only new format support added
- Keep files well under 600 lines; new module is small
