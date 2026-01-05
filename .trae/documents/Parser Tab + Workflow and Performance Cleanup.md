## Goals
- Add a "Parser" tab in the Panel to manage parser selection and CRUD
- Support loading CSV/JSON/JSON‑LD, and N8n workflow JSON for the provided test files
- Enable a guided workflow: Load Data → Select Parser → Validate Schema → Render Data
- Extract parser utilities into feature‑scoped modules; keep files ≤600 lines and preserve current API
- Improve caching/memoization; avoid duplicate work and re‑renders

## UI/Workflow
### Toolbar
- Keep existing "Load Data" and exporters intact
- Add an entry point to open the Panel on the new "Parser" tab (e.g., a small caret on Upload or a new button "Parser")
- When opened without a file, the Parser tab will let the user:
  - Pick a file (CSV/JSON/JSON‑LD/N8n)
  - Paste raw text
  - Quick‑load samples (from `canvas/public` if available)

### Panel: Parser Tab
- New view `ParserView` with:
  - Parsers list (built‑in + custom) with select, add, edit, remove
  - Input source controls: File picker, paste raw text, sample quick links
  - Actions: "Apply Parser" → produces `GraphData`; "Validate Schema" (toggle) → uses existing schema validator; "Render Data" → writes to store
  - Status area: parsed counts, warnings (e.g., unresolved N8n node names)

## Parser Architecture
### Feature‑Scoped Modules
- `src/features/parsers/types.ts` → `ParserSpec`, `ParserId`, `ParseResult` (data+warnings)
- `src/features/parsers/registry.ts` → register/unregister/list; resolve best match by filename/content hint
- `src/features/parsers/default.ts` → built‑ins wiring existing code:
  - CSV: `parseCsvToGraph` (csv.ts:121–227)
  - JSON/Raw: `rawToGraphData` (rawToGraph.ts:3–33) when shape isn’t canonical
  - JSON‑LD: `parseJsonLd` (jsonld.ts:8–76)
  - N8n: `parseN8nWorkflow` (lib/graph/n8n.ts:1)
- `src/features/parsers/cache.ts` → LRU cache keyed by `parserId|name|hash(text)`, TTL ~2–5 minutes (use `lib/cache/LRUCache.ts:3–43`)

### Integration Rules
- Do not break current `parseGraph`/worker pathway:
  - Current automatic parse remains the default (`io/adapter.ts:11–33`, `workers/graphParser.worker.ts:10–28`)
- Parser tab operates on raw inputs; it will call selected parser explicitly and then set store data
- For test files located outside `canvas/public`, use OS file picker (web security boundary). If samples are copied to `canvas/public`, show quick‑load links

## Schema Validation
- Use `features/schema/validation.ts` for checks
- Apply after parse when the toggle is enabled; refuse to render only on hard errors
- Show counts of violations by type/label

## Implementation Steps
1) Add feature modules under `src/features/parsers/*` (types, registry, default, cache)
2) Create `ParserView.tsx` under `src/features/panels/views/` with the UI described
3) Add `'Parser'` to `PanelTabKey` and render the new view:
   - Update `features/panels/types.ts:1` and `features/panels/Panel.tsx:18–23, 55–60`
4) Toolbar hook:
   - Add a button to open Panel at `'Parser'` (keep existing load behavior unchanged)
5) Wire store actions:
   - ParserView calls `setData` on success; schema validation via `validateSchema`
6) N8n support is already available via `lib/graph/n8n.ts` (built‑in); expose in registry with label "N8n Workflow"
7) Tests
   - Add unit tests for registry selection and parser CRUD
   - Extend N8n parsing test to route through registry and confirm labels/positions

## Performance & Cleanup
- Cache parsed outputs per parser+input via LRU to avoid repeated work when toggling between parsers
- Memoize expensive derived values in ParserView (counts) and ensure cleanup of timers/listeners to prevent leaks
- Keep each new file under 200 lines; avoid hardcoded paths; use feature barrels for discoverability (e.g., export registry API from `features/parsers/index.ts`)
- Preserve existing API; no breaking changes to `loadGraphFile`, `parseGraph`, exporters

## Code References
- Parse entry: `canvas/src/lib/graph/io/adapter.ts:11–33`
- Worker parse: `canvas/src/workers/graphParser.worker.ts:10–28`
- CSV: `canvas/src/lib/graph/csv.ts:121–227, 229–265`
- Raw: `canvas/src/lib/graph/rawToGraph.ts:3–33`
- JSON‑LD: `canvas/src/lib/graph/jsonld.ts:8–76, 78–110`
- N8n: `canvas/src/lib/graph/n8n.ts:1`
- Panel shell: `canvas/src/features/panels/Panel.tsx:18–23, 55–60`
- Toolbar: `canvas/src/components/Toolbar.tsx:151–269`

## Verification
- Manual: Use Parser tab to load `graph_202512091600.csv` and `customer_sentiment_analysis.json` and confirm counts and edge labels
- Automated: Unit tests for parser registry CRUD and selection, and N8n import via registry
- Export: Validate combined CSV/JSON/JSON‑LD from parsed data using existing exporters

## Notes
- Security: Custom parser code runs in a constrained wrapper and is stored locally; no network calls
- The app cannot load from arbitrary local filesystem paths directly; use the file picker for those test files, or copy samples into `canvas/public` for quick links
