## Bottom Panel Parser Tab UI
- Add a language toggle under the Parser tab with three buttons: `Python`, `JSON`, `YAML`, styled like the existing Nodes/Edges toggle (see `canvas/src/components/BottomPanel.tsx:395-411`).
- Keep current tab behavior in `TabHeader` and active-tab routing (see `canvas/src/components/BottomPanel.tsx:360-374`).
- Wire the toggle to `parserLanguage` state (`'json' | 'text' | 'yaml'`). Initial language auto-detects by file extension.

## Editor Behavior
- Extend `JsonEditor` to support `language: 'yaml'` in addition to `'json'|'text'` (see `canvas/src/features/json/JsonEditor.tsx:10` and validation flow `:35-50`).
- For YAML, parse using `js-yaml` and forward the parsed object to `validateTransforms`. On errors, surface the first error via `onValidityChange` like JSON.
- Keep highlighting simple (plain text) for YAML initially; JSON highlighting remains unchanged.

## Loading Parser Files
- Update `onLoadParserFile` to detect `.py` → `text`, `.json` → `json`, `.yaml`/`.yml` → `yaml` (see `canvas/src/components/BottomPanel.tsx:141-152`).
- Continue to set the loaded file’s content into `useParserUIState().scriptText` so it displays in the editor.

## Applying Transforms
- Enhance `onApplyParser` to parse transforms from the editor according to `parserLanguage`:
  - JSON: `JSON.parse(scriptText)` → `validateTransforms(obj)`; merge into selected parser config.
  - YAML: `yaml.load(scriptText)` → `validateTransforms(obj)`; merge similarly.
- On successful apply, re-register the parser and call `invalidateParserCache(selectedId)` to avoid stale results (see `canvas/src/components/BottomPanel.tsx:100-139` and `canvas/src/features/parsers/cache.ts:25-28`).
- When running `applyParserAsync`, keep existing caching, but consider passing a config-hash as `cfgKey` so `getCachedParse` keys include transform changes (see `canvas/src/features/parsers/cache.ts:15-23`).

## GraphRAG Workflow
- Use the existing Python pipeline to perform ingestion, parsing, embeddings, and graph construction (`scripts/graphrag_pipeline.py`). It invokes the `graphrag` CLI and converts outputs into app-friendly `graph.json` (see `scripts/graphrag_pipeline.py:27-71, 80-93`).
- In the UI, users can:
  - Click `Load Parser` in the Parser tab to open and view Python/JSON/YAML parser-related files.
  - Use `ParserView` to auto-detect and apply a parser to data (see `canvas/src/features/panels/views/ParserView.tsx:99-123, 213-241`).
  - Load data via auto-detect (`loadDataViaParser`) which applies the best-matched parser and populates counts/warnings (see `canvas/src/features/parsers/loader.ts:14-35`).

## Refactor & Cleanup
- Keep `BottomPanel.tsx` under 600 lines by extracting parser-tab logic into a feature-scoped module/hook (e.g., `features/parsers/useParserEditor.ts`) that owns:
  - `parserLanguage` management, file-type detection, transform parsing/validation, and `onApplyParser` behavior.
- Preserve current API and state interactions (`useParserUIState`, `useGraphStore`).
- Unify duplicate parser UI patterns between `BottomPanel` and `ParserView` to avoid divergence; prefer shared components/helpers.
- Remove stale/hardcoded patterns and ensure event listeners are consistently cleaned up in effects.

## Performance & Stability
- Use `cfgKey` in parser caching to include a hash of transform script when available, improving cache correctness.
- Retain `LRUCache` limits and TTL (currently 300 entries/2m) but expose them via a config constant for easier tuning (`features/parsers/cache`).
- Confirm `useEffect` cleanups are present for timers/listeners (already done in `BottomPanel.tsx:276-283, 299-307`).
- Keep memoization for node/edge derivations and sorting (`BottomPanel.tsx:154-169`) and avoid redundant state updates.

## Tests
- Add tests for YAML transform validation and parser application:
  - YAML parse + `validateTransforms` success/failure cases.
  - Cache key behavior when transforms change (cfgKey respected).
- Reuse the dev test harness (`canvas/src/tests/run.ts`) and follow existing test style.

## UI Details
- The language toggle will sit directly beneath Parser tab header, mirroring Nodes/Edges UI for consistency.
- Error messaging uses the existing small red text style used in the parser area (`BottomPanel.tsx:466-468`).