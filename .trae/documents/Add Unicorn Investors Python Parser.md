## Overview
- Create `parser/parse-unicorn-investors-test.py` that reads `test-data/unicorn-investors-test.json` and produces Knowgrph `GraphData` JSON.
- Provide importable functions and a CLI to parse and export in either `graph` or `raw` format.

## Input & Output
- Input: raw JSON with `nodes[]` and `edges[]` objects, where node `data` contains `name`, `type`, etc., and edge `data` contains `type`, properties.
- Output `GraphData` conforms to `canvas/src/lib/graph/types.ts:20-25`.
- Mapping aligns with `canvas/src/lib/graph/rawToGraph.ts:3-33` and `graphToRawJson` symmetry.

## Transformation Rules
- Node mapping:
  - `id` ← `node.id`
  - `label` ← `node.data.name` (fallback to `node.id`)
  - `type` ← `node.data.type` (fallback to `Entity`)
  - `properties` ← entire `node.data` (includes `description`, `image`, `reference`, `degree`, etc.)
- Edge mapping:
  - `id` ← `edge.id`
  - `source` ← `edge.source`
  - `target` ← `edge.target`
  - `label` ← `edge.data.type` (fallback to `relatedTo`)
  - `properties` ← entire `edge.data` (includes `weight`, etc.)
- Result object:
  - `context`: `"unicorn-investors"`
  - `type`: `"Graph"`
  - `nodes`: mapped list
  - `edges`: mapped list

## Module API
- `load_unicorn_json(path: str) -> dict`: Read and validate input JSON.
- `to_graph_data(raw: dict) -> dict`: Transform raw to `GraphData`.
- `to_raw_json(graph: dict) -> dict`: Transform `GraphData` back to raw nodes/edges (symmetry with TS `graphToRawJson`).
- `parse_unicorn_investors(path_or_obj: Union[str, dict]) -> dict`: Convenience wrapper returning `GraphData`.

## CLI
- `python parser/parse-unicorn-investors-test.py --input test-data/unicorn-investors-test.json --output data/unicorn-graph.json --format graph`.
- Flags:
  - `--input <path>`: required
  - `--output <path>`: optional; default stdout
  - `--format <graph|raw>`: default `graph`
- Emits JSON with safe error messages and non-zero exit on failure.

## Integration Notes
- Frontend Panel can load either `GraphData` or raw `nodes/edges` JSON; adapter maps raw via `rawToGraphData` (see `canvas/src/lib/graph/io/adapter.ts` and `canvas/src/lib/graph/rawToGraph.ts`).
- Place outputs under `data/` or any accessible path; use Panel `Load Data` to visualize.

## Validation
- Quick checks: counts of nodes/edges and presence of fields.
- Smoke test: generate `graph` JSON, load in Canvas Parser tab, confirm nodes and Investor edges render.

## Security & Dependencies
- Use only Python stdlib (`json`, `argparse`, `typing`). No secrets or external calls.

## Next Steps (upon approval)
- Implement the module with docstrings and type hints.
- Add a tiny repository-local sample run command to verify output.