# Knowgrph Parser Catalog

See also: [Visualization Catalog](knowgrph-viz-catalog.md), [Workflow Catalog](knowgrph-workflow-catalog.md), [User Journey Catalog](knowgrph-userjrny-catalog.md).

This catalog focuses on in-canvas parsers in `canvas/src/features/parsers/*` and how they consume datasets from `test-data/` and feed graph data into the canvas workflow described in the Workflow and User Journey catalogs. It also documents Python CLI parsers used for offline analysis, D3/POC HTML demos, and regression tests.

### Type‑Safe Workflow Paths & Tests
- Workflow presets bind parser, dataset, and schema via branded types: `ParserId`, `DatasetPath`, `SchemaConfigPath`.
- Integration tests validate pipelines for `unicorn-top3-3d` and `ai-kg-viz`: `canvas/src/__tests__/workflowPresetPipeline.test.ts`.
| Area                 | Responsibility                                        | Modules                                                                                           | Classes/Objects                 | Functions/Methods                                                                                                        | Key                                             | Type     | Value/Default                     | Dependencies / Imports | Notes                                                                                                        |
| -------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------- | ---------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| Parsers (Registry)   | Manage parser specs and matching                      | `canvas/src/features/parsers/registry.ts`, `canvas/src/features/parsers/types.ts`                 | `ParserSpec[]`                   | `listParsers`, `registerParser`, `unregisterParser`, `bestMatch`, `applyParser`                                            | `specs`, `ParserSpec`                           | array    | built‑ins + customs               | `React`                 | `bestMatch` uses name/text heuristics; `applyParser` returns `{ data, warnings }`                                      |
| Parsers (Async)      | Support async parsing for AST workers                 | `canvas/src/features/parsers/registry.ts`, `canvas/src/features/parsers/types.ts`                 | `ParserSpec.parseAsync`          | `applyParserAsync`                                                                                                        | `parseAsync`                                    | function | optional per parser              | —                      | Prefers `parseAsync` when available; falls back to sync `parse`                                                           |
| Built‑ins            | Provide CSV/JSON/JSON‑LD/N8n parsers                  | `canvas/src/features/parsers/default.ts`                                                          | `ParserSpec`                     | `match`, `parse`                                                                                                          | `csv`, `json`, `jsonld`, `n8n`                  | object   | —                                | `d3`, `Papa Parse`      | CSV maps flexible headers; JSON‑LD flattens nodes/edges; N8n Workflow IO parses nodes, edges, properties. CSV typing tightened: numeric cell detection, JSON props parsing, `weight` as number|string, structured node/edge rows |
| Python (Tree‑sitter) | Higher‑accuracy Python AST via Web Worker             | `canvas/src/features/parsers/python/index.ts`, `canvas/src/features/parsers/python/tsWorkerClient.ts`, `canvas/src/features/parsers/python/treeSitterWorker.ts` | `pythonSpec` | `match`, `parse`, `parseAsync` | `pythonSpec.parseAsync`                         | function | uses worker when flag enabled     | `web-tree-sitter`, `tree-sitter-python` | Flag: `parser.useTreeSitter` enables AST; worker parses classes/functions/imports/calls into `GraphData` |
| Python CLI (Unified) | Offline parsing utilities (Markdown → JSON‑LD, codebase indexing, embeddings, JSON‑LD to GraphData) | `knowgrph_parser/cli.py`, `knowgrph_parser/__main__.py` | — | `main` (`markdown`, `parse-codebase-index`, `embed-codebase-index`, `test-embedding-sanity`, `workflow-artifacts`, `jsonld-universal`, `python-codebase-index`) | `knowgrph_parser` | module | CLI | `argparse` | Canonical entrypoint is `python -m knowgrph_parser ...`. |
| Python CLI (Markdown → JSON‑LD) | Markdown to AgenticRAG-aligned JSON‑LD graph (Document/Section/Block) | `knowgrph_parser/markdown_cmd.py`, `knowgrph_parser/markdown_graph.py`, `knowgrph_parser/orchestrator_yaml.py` | — | `main`, `parse_markdown_to_graph_jsonld`, `build_orchestrator_config_yaml` | `knowgrph_parser markdown` | module | CLI | `argparse` | Parses Markdown structure (headings, paragraphs, code fences, lists, tables) into JSON-LD with `metadata.codebasePath` fragments so Canvas can render and deep-link provenance into the Bottom Panel code viewer. When `--output-*` flags are omitted, `python -m knowgrph_parser markdown --input <markdown-file-name.md>` writes a timestamped folder under `data/<markdown-file-name_YYYYMMDDhhmm>/` containing `<markdown-file-name>-graph-data.jsonld`, `<markdown-file-name>-schema-config.jsonld`, `<markdown-file-name>-orchestrator-config.yaml`, and a reusable `parse_<markdown-file-name>.py` helper script that re-invokes the same neutral pipeline. |
| Custom Parser        | Convert config to parser spec                          | `canvas/src/features/parsers/custom.ts`, `canvas/src/features/parsers/persistence.ts`             | `CustomParserConfig`             | `toParserSpec`, `readCustomParsers`, `upsertCustomParser`, `deleteCustomParser`                                           | `custom:*`                                      | object   | persisted                         | `window.localStorage`   | Safe mapping DSL; no `eval`; persists configs locally                                                                  |
| Transform DSL        | Map nodes/edges, properties, aggregations              | `canvas/src/features/parsers/transform.ts`                                                        | `PropsTransform`, `NodeTransform`, `EdgeTransform` | `buildProps`, `getPath`, `getPathList`, `mapNode`, `mapEdge`, `applyTransforms`, `percentileHF`                      | `transforms.*`                                  | object   | opt‑in                           | —                      | Supports: pick/drop/map/set, mapAgg `join|sum|count|first|last|min|max|avg|percentile` (nearest/linear/tukey/hazen)     |
| Path Resolution      | Dot‑path with array indices and wildcards              | `canvas/src/features/parsers/transform.ts`                                                        | resolver                        | `getPath`, `getPathList`                                                                                                   | `properties.items[0].name`, `items[].field`     | string   | —                                | —                      | Safe bracket parsing; `[]` expands values for aggregations                                                             |
| Cache                | Avoid redundant parsing                               | `canvas/src/features/parsers/cache.ts`                                                            | `LRUCache`                       | `hashText`, `getCachedParse`, `setCachedParse`                                                                             | `cache.size`, `cache.ttlMs`                     | number   | 300, 120000                       | —                      | Key: `parserId|name|hash(text)`; targeted invalidation by parser id prefix; improves toggle performance                |
| Parser Tab UI        | Sectioned UI with radios, apply, custom config         | `canvas/src/features/panels/views/ParserView.tsx`, `canvas/src/features/panels/ui/CollapsibleSection.tsx` | `CollapsibleSection`, `ParserTable` | radios/apply/warnings/counts                                                                                              | `parser.{input,parsers,table} sections`         | —        | collapsed by default              | `React`                 | Full‑header click to toggle; chevron rotation; persistent collapse via `usePersistedBoolean`                             |
| Render Controls      | 3D visualization defaults exposed in UI                | `canvas/src/features/panels/views/ParserView.tsx`, `canvas/src/features/panels/views/RenderSettingsSection.tsx` | Render section                    | sliders for `Arrow Length`, `Link Opacity`, `Default Curvature`, `Curve Rotation`, `Directional Particles`, `Particle Speed`, `Node Motion`, `Minimap Opacity`, `Selected Node Glow`, `Dimmed Node Opacity`, `Dimmed Edge Opacity`, `Selected Edge Width`, `Layer 1/2/3 Opacity`, `Force Separation`, `Traversal Delay (ms)`; toggles for 2D/3D and camera auto‑rotate; background and fog color pickers in Schema/Render; `AI KG Traversal` button   | `schema.three.*`, `graphRAGPath.traverse`, `layout.forces.charge`, `layout.forces.collisionByType`       | number/object   | 8 / 0.55 / 0.0 / 0.0 / 0 / 0.6 / 1.0 / 0.7 / `{ '1':1.0,'2':0.9,'3':0.8 }` / `''` / `''` / 140 / 340 | `React`                 | Writes to store via `setThreeConfig`, schema slice, and selection slice; `AI KG Layers & Traversal` updates `schema.three.layerOpacityByLayer`, wraps `setCharge` over `layout.forces.charge`, and adjusts `layout.forces.collisionByType` per node type; background and fog colors respect `schema.three.backgroundColor`/`fogColor` and are transparent when left empty; directional particles rendered via InstancedMesh; node motion, minimap opacity, glow, opacities, and edge widths affect 3D animation and overlay density; AI‑KG traversal replays edges along `graphRAGPath.traverse` with a configurable delay by selecting one edge at a time using existing selection rules (`canvas/src/features/panels/views/RenderSettingsSection.tsx`, `canvas/src/features/three/ThreeGraph.tsx:72–151,257–365`) |
| Parser Script Editor | Editable transforms JSON with highlighting & validation | `canvas/src/features/json/JsonEditor.tsx`, `canvas/src/features/parsers/schema.ts`, `canvas/src/components/BottomPanel.tsx` | `JsonEditor`                     | `validateTransforms`, `onValidityChange`, `onChange`                                                                       | `scriptText`                                    | string   | persisted in UI state             | `React`                 | Apply hard‑blocks on invalid schema; merges transforms into selected custom parser before parsing                        |
| Editor Handlers      | Textarea selection/scroll/format utilities            | `canvas/src/features/hooks/useEditorTextareaHandlers.ts`                                          | hook                             | `onSelect`, `onDoubleClick`, `onKeyUp`, `onClick`, `onBlur`                                                                 | —                                               | —        | —                                  | `React`                 | Extracted to reduce duplication; throttle and idle formatting for performance                                              |
| Persistence Keys     | LocalStorage keys for Parser UI                        | `canvas/src/features/hooks/usePersistedBoolean.ts`                                                | hook                            | —                                                                                                                          | `parser.{inputCollapsed,parsersCollapsed,tableCollapsed}` | string | `parser.*`                         | `window.localStorage`   | collapse states persisted; defaults hydrated on mount                                                                   |

## Persistence & Reset
- `clearCustomParsers` removes `kg:parsers:custom` from `localStorage` and is invoked by full app reset: `canvas/src/features/parsers/persistence.ts:43–45`, `canvas/src/hooks/useGraphStore.ts:169–170`.
- Loader clears graph before parsing new input: `canvas/src/features/parsers/loader.ts:19`.
- Parser UI state exposes `reset()` used by full reset: `canvas/src/features/parsers/uiState.ts:50`.
- Initial load purges custom parser configs to guarantee clean-slate: `canvas/src/pages/Canvas.tsx:39`.
- Schema Import uses a shared `.json` text picker and validates schema before applying to the store: `canvas/src/features/schema/io.ts`.

## Update Approach
- Keep this catalog as the single source of truth for parser behavior/configuration.
- Document built‑ins and Custom Parser DSL with examples; map transform ops to safe functions.
- Reference registry and cache modules to ensure performance and reliability.
  - Include async apply support to enable worker‑based parsers without breaking existing sync APIs.

## Quick Start (Help Workflow + Parser Tab)
- Open the Panel and use the Help → Workflow section together with the bottom‑panel Parser tab.
- Click `Load Data` to select a file (`CSV`, `JSON‑LD`, `N8n Workflow`).
- The Data Format is auto‑detected and the matching Parser is pre‑selected; parsed counts and first warning are shown immediately. Sections auto‑expand to reveal the selected Parser summary and the `Table`; the panel does not exit.
- You can still override the Data Format manually and click `Apply Parser` to re‑parse.
-  - Use the **Render** section (Parser/Render settings) to toggle between 2D/3D and adjust `Arrow Length`, `Link Opacity`, `Default Curvature`, `Curve Rotation`, `Directional Particles`, `Particle Speed`, `Node Motion`, and `Minimap Opacity` before or after parsing; settings apply live to the 3D scene, animation, and overlays.
  - When `parser.useTreeSitter` is enabled and Python is selected, `Apply Parser` runs the AST worker by default.
- If no parser matches, the `Parsers` section stays open and the Custom Parser fields are focused to guide setup.
- To add a Custom Parser:
  - Fill `id`, `name`, choose `base` (`csv|json|jsonld|n8n`).
  - Set `match` (`endsWith|contains|regex`) with `value`.
  - Optionally set defaults (`nodeTypeDefault`, `edgeLabelDefault`).
  - Paste Transforms JSON (example below) and click `Save Custom`.
  - Select your custom parser via the radio list and `Apply Parser`.
  - After load, the selected Parser summary shows `base`, `match` mode/value and configured defaults.
- Collapse states are persisted; click anywhere on a section header to toggle.

### Example: Unicorn Investors Top‑3 via Panel
- Ensure preview is running with `VITE_PUBLIC_FALLBACK_JSON` pointing at the top‑3 unicorn‑investors JSON and open the canvas in the browser.
- The loader feeds `GraphData` into the store; the canvas detects `"unicorn-investors"` in `context` and auto‑switches to 3D and tuned schema settings (`canvas/src/pages/Canvas.tsx:60–75`).
- On the Panel view:
  - Use `Load Data` / `Apply Parser` as usual (the sample is already wired as fallback data).
  - Expand **Render**:
    - confirm `Arrow Length` around `10`, `Link Opacity` near `0.55`, `Default Curvature` around `0.2`, and `Curve Rotation` near `0.0`
    - flip between `Switch to 2D` and `Switch to 3D` to compare the 2D D3 layout with the 3D spherical layout while keeping the same underlying `GraphData`.

## Examples
### Custom Parser JSON (CSV base, label remaps, props projection, aggregations)
```json
{
  "id": "customers-csv",
  "name": "Customers CSV",
  "base": "csv",
  "match": { "mode": "endsWith", "value": "customers.csv" },
  "transforms": {
    "nodeTypeDefault": "Person",
    "edgeLabelDefault": "relates_to",
    "node": {
      "labelFrom": "properties.name",
      "typeMap": { "Order": ["order"], "Person": ["user", "customer"] },
      "props": {
        "pick": ["id", "name", "email", "age"],
        "set": { "source": "csv", "active": true },
        "map": [
          { "key": "domain", "from": "properties.email" }
        ]
      }
    },
    "edge": {
      "labelMap": { "purchases": "bought", "views": "saw" }
    },
    "mapAgg": [
      { "key": "total_amount", "op": "sum", "path": "orders[].amount" },
      { "key": "order_ids", "op": "join", "path": "orders[].id", "sep": "," },
      { "key": "p90_amount", "op": "percentile", "path": "orders[].amount", "p": 90, "method": "linear" }
    ]
  }
}
```

### Custom Parser JSON (JSON‑LD base, path resolution, label remaps)
```json
{
  "id": "people-jsonld",
  "name": "People JSON‑LD",
  "base": "jsonld",
  "match": { "mode": "contains", "value": "people.json" },
  "transforms": {
    "node": {
      "labelFrom": "properties.name",
      "typeMap": { "Person": ["schema:Person", "http://schema.org/Person"] },
      "props": {
        "pick": ["@id", "name", "email"],
        "map": [
          { "key": "primary_alias", "from": "properties.alternateName[0]" }
        ]
      }
    },
    "edge": {
      "labelMap": { "schema:knows": "knows", "schema:memberOf": "member_of" }
    },
    "mapAgg": [
      { "key": "aliases", "op": "join", "path": "properties.alternateName[]", "sep": "; " },
      { "key": "age_p90", "op": "percentile", "path": "properties.ageHistory[]", "p": 90, "method": "nearest" }
    ]
  }
}
```

### Custom Parser JSON (N8n Workflow base, path resolution, label remaps)
```json
{
  "id": "n8n-custom",
  "name": "N8n Workflow Custom",
  "base": "n8n",
  "match": { "mode": "endsWith", "value": "workflow.json" },
  "transforms": {
    "node": {
      "labelFrom": "properties.name",
      "typeMap": { "branch": ["IF"], "http": ["HTTP Request"], "code": ["Code"] },
      "props": {
        "pick": ["id", "name", "type"],
        "map": [
          { "key": "first_header", "from": "properties.parameters.headers[0].name" }
        ]
      }
    },
    "edge": {
      "labelMap": { "main": "flow", "always": "fallback" }
    },
    "mapAgg": [
      { "key": "tags", "op": "join", "path": "properties.parameters.tags[]", "sep": "," },
      { "key": "http_timeout_avg", "op": "avg", "path": "properties.parameters.timeoutHistory[]" }
    ]
  }
}
```

### Custom Parser JSON (Raw JSON base, wildcards, min/max aggregations)
```json
{
  "id": "products-json",
  "name": "Products Raw JSON",
  "base": "json",
  "match": { "mode": "contains", "value": "products.json" },
  "transforms": {
    "node": {
      "labelFrom": "properties.title",
      "typeMap": { "Product": ["product"] },
      "props": {
        "pick": ["id", "title", "category"],
        "map": [
          { "key": "first_image", "from": "properties.images[0].url" }
        ],
        "set": { "source": "api" }
      }
    },
    "edge": {
      "labelMap": { "related": "related_to" }
    },
    "mapAgg": [
      { "key": "price_min", "op": "min", "path": "prices[].amount" },
      { "key": "price_max", "op": "max", "path": "prices[].amount" }
    ]
  }
}
```

### Custom Parser JSON (Avg and Count with numeric filtering and safe defaults)
```json
{
  "id": "metrics-json",
  "name": "Metrics Avg/Count",
  "base": "json",
  "match": { "mode": "contains", "value": "metrics.json" },
  "transforms": {
    "node": {
      "labelFrom": "properties.name",
      "typeMap": { "Metric": ["metric"] },
      "props": {
        "pick": ["id", "name"],
        "map": [
          { "key": "primary_tag", "from": "properties.tags[0]" }
        ]
      }
    },
    "mapAgg": [
      { "key": "score_avg", "op": "avg", "path": "scores[].value" },
      { "key": "score_count", "op": "count", "path": "scores[]" }
    ]
  }
}
```

Notes:
- `avg` filters non‑numeric values; if no numeric values are present, it yields `undefined`.
- `count` returns the array length; if the array is missing or empty, it returns `0`.

## Aggregator Quick Reference

| Aggregator  | Input treatment                                  | Empty‑set result | Notes |
| ----------- | ------------------------------------------------- | ---------------- | ----- |
| join        | stringifies values, joins by `sep` (default `,`)  | `""`            | non‑string values are coerced via `String(v ?? '')` |
| sum         | filters to finite numbers, sums                   | `0`              | non‑numeric entries are ignored |
| count       | counts array length                               | `0`              | counts items regardless of type |
| first       | takes first value                                 | `undefined`      | safe default when empty |
| last        | takes last value                                  | `undefined`      | safe default when empty |
| min         | filters to finite numbers, returns min            | `undefined`      | undefined when no numeric entries |
| max         | filters to finite numbers, returns max            | `undefined`      | undefined when no numeric entries |
| avg         | filters to finite numbers, mean                   | `undefined`      | undefined when no numeric entries |
| median      | filters to finite numbers, median (sorted)        | `undefined`      | exact or average of middle two |
| percentile  | filters to finite numbers; requires `p` (0–100)   | `undefined`      | `method`: `nearest|linear|tukey|hazen` (default `linear`); `type` (HF 1–9) overrides `method` |

### Notes
- Dot‑paths with bracket indices are supported: `properties.items[0].name`.
- Wildcards expand arrays: `orders[].amount` with aggregators (join, sum, count, first, last, min, max, avg, percentile).
- Percentile supports `method`: `nearest`, `linear`, `tukey`, `hazen`; if both `type` and `method` are set, `type` wins (a warning is emitted).
- Transforms are pure and safe; no `eval` or arbitrary functions.

### Type Safety Update
- `PropsTransform.set` uses `JSONValue` to standardize property types.
- Path resolvers accept `unknown` and refine only when reading object keys or arrays.
- Aggregation outputs are cast to `JSONValue` at boundaries to preserve runtime behavior while eliminating `any`.
- `ParserId` is a branded string with helper `toParserId`, and workflow presets record `(parserSpecId, datasetFileName, schemaFileName)` using branded `ParserId`/`DatasetPath`/`SchemaConfigPath`. Parser registry, cache, and custom parser utilities operate on these branded ids/paths while preserving existing behavior.

### Python AST Worker
- Enable flag: set `localStorage.setItem('kg:parsers:treeSitterEnabled', '1')` (or legacy `parser.useTreeSitter`) and reload.
- Worker client: `canvas/src/features/parsers/python/tsWorkerClient.ts:21-28` posts messages and resolves with `{ data, warnings }` or rejects on timeout.
- Regex hygiene: `canvas/src/features/parsers/python/lexer.ts:26-29` uses minimal escapes for readability and lint compliance.
- Node/edge building: `canvas/src/features/parsers/python/builder.ts:3-33` adds `py:*` nodes and edges; properties typed as `JSONValue`.
- Fallback: when worker fails or times out, registry falls back to sync parse; warnings are preserved.

### Import/Export Custom Parsers & Catalogs
- Import from text: `canvas/src/features/parsers/io.ts:7-31` parses JSON array or single object, validates required fields, registers specs.
- Import from file: `canvas/src/features/parsers/io.ts:33-37` uses the file picker.
- Export to file: `canvas/src/features/parsers/io.ts:39-47` writes `parsers.json` via picker or direct download.
- Parser panel UI exposes `Import Parsers` and `Export Parsers` buttons in the Panel header, wired through `ParserSections` and `parsers/uiUtils` so that parser “scripts” catalogs can be round‑tripped as JSON without touching code (`canvas/src/features/panels/views/ParserSections.tsx:53–58`, `canvas/src/features/parsers/uiUtils.ts:16–34`).

### Error Handling & Warnings
- Registry apply: `canvas/src/features/parsers/registry.ts:12-26` returns empty `GraphData` on failure and collects warning messages.
- GraphRAG parse: `canvas/src/features/parsers/graphrag.ts:10-18` extracts safe error strings from unknown exceptions.

### Spec Formatting
- Viewer: `canvas/src/features/parsers/specFormat.ts` formats parser spec text by removing `parse/parseAsync` and stringifying other fields.
- Purpose: present concise spec summaries in the Parser tab editor without function bodies.

---

## log 202512161930

Here is what I implemented and how it fits your parser principles and catalogs.

**1. Universal JSON/JSON‑LD parser entrypoint**

Unified entrypoint: `python -m knowgrph_parser jsonld-universal`

Core behavior:

- Types:
  - `GraphNode`, `GraphEdge`, `GraphData` are plain `Dict[str, Any]`.
- Input loading:
  - `load_json(path)` reads JSON from disk.
- Context handling:
  - `normalize_context` accepts:
    - Dict `@context` as-is.
    - String `@context` (JSON string) and parses it.
    - Anything else → `{}`.
- Graph extraction:
  - `as_graph_items(root)`:
    - If `root` is a dict with `@graph` array:
      - Returns list of dict items and normalized `@context`.
    - If `root` already has `nodes` and `edges`:
      - Treats it as a GraphData-like structure and returns an empty item list plus normalized `context`.
    - If `root` is a list:
      - Treats list entries as graph items, context `{}`.
- Node construction:
  - `build_nodes(items, context)`:
    - Skips reified edge nodes that have `kg:subject`, `kg:object`, `kg:predicate`.
    - Node id:
      - Uses `@id` or `id`, passed through `strip_kg` (`kg:foo` → `foo`).
    - Node type:
      - Uses first element of `@type` list if list, otherwise single value, default `"Thing"`.
    - Node label:
      - `name` or `label` or fallback to id.
    - Properties:
      - Drops `@id`, `id`, `@type`, `name`, `label`.
      - Drops `kg:x`, `kg:y`, `kg:fx`, `kg:fy` (treated as coordinates, not properties).
      - Uses `is_id_property(context, key)` to detect `@id`-typed properties.
      - For list values:
        - If all entries are strings and either start with `kg:` or the key is `@id`‑typed, they are treated as edges, not node properties.
        - Otherwise kept as properties.
      - For scalar values:
        - If the key is `@id`‑typed and the value is a string or dict, it is treated as an edge, not property.
        - Everything else is kept as a property.
    - Coordinates:
      - If present and numeric, maps:
        - `kg:x` → `node["x"]`
        - `kg:y` → `node["y"]`
        - `kg:fx` → `node["fx"]`
        - `kg:fy` → `node["fy"]`
    - Returns:
      - `nodes`: list of `{id, label, type, properties, x?, y?, fx?, fy?}`
      - `node_index`: mapping from node id to original JSON-LD item
      - `edge_nodes`: list of reified edge nodes to handle later
- Edge construction (property-based):
  - `build_edges(items, context, node_index)`:
    - For each item:
      - `source_id` from `@id` or `id`, stripped via `strip_kg`.
      - For each property key/value:
        - Skips `@id`, `id`, `@type`, `name`, `label`.
        - Skips keys starting with `kg:` (reserved).
        - `id_key = is_id_property(context, key)`.
        - If not a list and not `id_key`, skip (not an edge).
        - Normalize to list: `array_value`.
        - Ensure all elements are either:
          - Strings, or
          - Dicts with a non-empty `@id` or `id`.
        - `treat_as_edges` if:
          - `id_key` is true, or
          - All elements are `kg:`-prefixed strings.
        - For each element, build edge:
          - If string: target is `strip_kg(element)`.
          - If dict: target from `@id` or `id` (stripped), and remaining fields copied into `properties`.
          - Only create edge when target id is non-empty and exists in `node_index`.
          - Edge id pattern: `"{source_id}-{key}-{target_id}-{index}"`.
- Edge construction (reified nodes):
  - `build_reified_edges(edge_items, edges)`:
    - For each reified edge node:
      - `source_id` from `kg:subject` (stripped).
      - `target_id` from `kg:object` (stripped).
      - `label` from `kg:predicate` (stripped if string).
      - Copies all other fields as `properties`.
      - Edge id pattern: `"{source_id}-{label}-{target_id}-{len(edges)}"`.
- Default parser:
  - `parse_jsonld_default(root)`:
    - If `root` is already a GraphData-like dict:
      - `nodes` and `edges` are taken as-is.
      - `context`:
        - If string → kept as is.
        - Otherwise → `json.dumps(context or {}, ensure_ascii=False)`.
      - Returns `{ "context": context_text, "type": "Graph", "nodes": nodes, "edges": edges }`.
    - Otherwise:
      - Calls `as_graph_items(root)` → `(items, context)`.
      - Builds nodes, node index, edge items.
      - Builds property-derived edges and reified edges.
      - `context_text = json.dumps(context, ensure_ascii=False)`.
      - Returns `GraphData` with `context_text`, `type: "Graph"`, `nodes`, and `edges`.

This default behavior is intentionally structural and closely mirrors the TypeScript `parseJsonLd` pipeline (`canvas/src/lib/graph/jsonld.ts:1-118`), while also accepting pre-flattened `{nodes,edges}` JSON.

**2. External parser loading (universal handler principle)**

To respect the “loaded parser” principle, the script supports pluggable external modules:

- Loader:
  - `load_external_parser(module_name, function_name)` (via the `jsonld-universal` subcommand):
    - Uses `import_module` to import the module.
    - Fetches the named function via `getattr`.
    - Returns a callable `Callable[[Any], GraphData]`.
- Expected contract for external parser:
  - Signature: `parse_jsonld(root: Any) -> GraphData`
  - `root` is the decoded JSON object from `load_json`.
  - Return value must follow the same `GraphData` shape:
    - `{"context": str or dict, "type": "Graph", "nodes": [...], "edges": [...]}`

This lets you keep all schema-aware or domain-specific logic in external modules (or packages) while leaving this script as the generic loader/dispatcher.

**3. CLI interface and usage**

The `jsonld-universal` subcommand defines:

- Arguments:
  - `--input`, `-i` (required):
    - Path to input JSON or JSON-LD file.
  - `--output`, `-o` (optional):
    - Output path; if omitted, prints to stdout.
  - `--parser-module` (optional):
    - Python module path to import, e.g. `myproject.parsers.jsonld_universal`.
  - `--parser-func` (optional, default `"parse_jsonld"`):
    - Function name within the module to call.
  - `--format`, `-f` (choices `["graph", "raw"]`, default `"graph"`):
    - `graph`: emits full `GraphData`.
    - `raw`: emits `{ "nodes": [...], "edges": [...] }` only.
- Execution flow:
  - Loads JSON from `--input`.
  - If `--parser-module` is provided:
    - Calls the external parser function and treats its return value as `GraphData`.
  - Otherwise:
    - Falls back to `parse_jsonld_default` (generic structural parser).
  - Output:
    - For `graph`: writes the full `GraphData`.
    - For `raw`: extracts `nodes` and `edges` lists (empty arrays if missing or mis-typed).
    - Writes either to `--output` file or to stdout.

Examples (also documented in the canvas README):

- Structural parsing only:

  ```bash
  python -m knowgrph_parser jsonld-universal \
    --input test-data/a0.jsonld
  ```

- Delegating to an external parser module:

  ```bash
  python -m knowgrph_parser jsonld-universal \
    --input test-data/a0.jsonld \
    --parser-module myproject.parsers.jsonld_universal \
    --parser-func parse_jsonld \
    --format graph
  ```

This matches your principle:

- Minimal built-in parsing for bootstrap/fallback.
- Primary, schema-aware behavior implemented in a loaded external module.

**4. Documentation updates**

a) **Canvas README**

Updated `canvas/README.md` from a generic Vite template to a project-specific overview with parser details (`canvas/README.md:1-79`):

- New title and description:
  - `# Knowgrph Canvas`
  - Describes the app as “React + TypeScript + Vite app for interactive graph visualization.”
- Parser architecture section:
  - Explains that canvas uses a single JSON-LD parser:
    - `parseJsonLd` in `canvas/src/lib/graph/jsonld.ts:1-118`.
    - Built-ins in `canvas/src/features/parsers/default.ts`.
  - Notes workflow presets binding parser/dataset/schema and points to `knowgrph-workflow-catalog.md`.
- Notes that offline CLI utilities live under `knowgrph_parser/` and run via `python -m knowgrph_parser`.
- Python CLI parsers section:
  - Documents:
    - `python -m knowgrph_parser jsonld-universal` and its behavior (structural parsing + optional delegation).
- Local development section:
  - Provides concrete commands for install, dev, tests, lint, and type-check:
    - `cd canvas && pnpm install`
    - `pnpm run dev`
    - `pnpm run test:ci`
    - `pnpm run lint`
    - `pnpm run check`
- ESLint notes:
  - Points at `canvas/eslint.config.js` and mentions you can tighten rules with `typescript-eslint` presets.

b) **Parser catalog**

Extended the parser catalog to include Python CLI parsers (`docs/knowgrph-parsers-catalog.md:1-22`):

- Catalog description now explicitly includes Python CLI parsers:
  - “…It also documents Python CLI parsers used for offline analysis, D3/POC HTML demos, and regression tests.”
- Added entries to the main table:
  - `Python CLI (Universal)`:
    - Module: `knowgrph_parser/jsonld_universal_cmd.py` (subcommand: `jsonld-universal`)
    - Functions: `parse_jsonld_default`, `load_external_parser`, `main`
    - Key: `parse-jsonld-universal`
    - Notes:
      - Loads JSON from disk.
      - Parses generic JSON-LD or `{nodes,edges}` into `GraphData`.
      - Can delegate to a loaded parser module.
      - Suitable for D3/POC HTML demos and heavy offline analysis.
  - Dataset-specific CLI parsers are intentionally not shipped in-repo; instead, `jsonld-universal` supports optional delegation to externally loaded parser modules.

This makes the TS parsers and Python CLI tools part of one coherent catalog.

c) **Workflow catalog**

Updated Step 5 in the workflow documentation to mention the CLI path (`docs/knowgrph-workflow-document.md`):

- Under **Step 5 – Export & Share**, added a **CLI / Offline Pipelines** subsection:
  - Recommends Python CLI parsers for D3/POC HTML demos and heavy offline analysis:
    - `python -m knowgrph_parser jsonld-universal` for structural JSON/JSON-LD to `GraphData` or delegation to a loaded parser module.
  - Emphasizes that:
    - Canvas parsers remain generic and structural.
    - Schema-aware batch workflows and DB connectors live outside the browser in these CLI tools.

This ties the universal parser back to the Step 1–5 narrative and keeps it aligned with the audit catalog’s principles (no core dependence on specific files, structural parsing only).

**5. Verification and checks**

- Python syntax check:
  - Ran:

    ```bash
    python -m py_compile knowgrph_parser/cli.py
    ```

  - Exit code `0` (no syntax errors).
- Canvas checks (from project root):

  Commands executed:

  ```bash
  cd canvas && pnpm install && pnpm run lint && pnpm run check && pnpm run test:ci
  ```

  Results:

  - `pnpm install`: lockfile up to date.
  - `pnpm run lint`: ESLint passed.
  - `pnpm run check`: TypeScript project check passed.
  - `pnpm run test:ci`: all tests passed, including the schema fixture tests for your three file sets:
    - `schemaFixtures.a0`
    - `schemaFixtures.aiKgViz`
    - `schemaFixtures.leanStartup`
    - As well as all parser-related tests and GraphRAG traversal tests (`canvas/src/tests/run.ts:1-77`).

No existing behavior was broken by the new script or documentation updates.

---

**How this matches your parser principles**

- **Loaded parser as universal handler**:
  - The script can delegate to any external module via `--parser-module`/`--parser-func`, so the “universal handler” can evolve independently and live in a proper library.
- **Minimal built‑in parsing**:
  - Built-in behavior is structural only, focusing on JSON-LD → `{nodes,edges}` with context, plus a simple pass-through for already-flattened graphs.
  - No dataset-specific assumptions or AI-KG-specific logic.
- **Support for D3/POC demos and offline analysis**:
  - `--format raw` emits just `nodes` and `edges`, which is ideal for D3-style workflows.
  - The CLI is documented under `knowgrph_parser/`, clearly positioned as an offline tool.
- **Separation of concerns**:
  - Canvas continues to rely on a single TS JSON-LD parser.
  - The Python CLI script serves as a batch/CLI utility for offline parsing and pipeline artifacts.
