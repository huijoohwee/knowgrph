## Goals
- Align the default user flow: Load Data → open CSV/JSON/JSON‑LD → Load Parser → show Editor/Table → render graph → show “invalid parser script” on failures.
- Preserve current public APIs while extracting utilities into feature‑scoped modules.
- Remove duplicate or stale logic, stabilize renders, and strengthen caching/memoization.

## Current Flow (Key References)
- Toolbar “Load Data”: `canvas/src/components/Toolbar.tsx:85–107` calls `loadDataViaParser` and opens the modal Parser panel.
- Parser panel “Load Data”: `canvas/src/features/panels/views/ParserView.tsx:109–142` loads data and opens Bottom Panel `'parser'`.
- Parser “Load Parser” button: `canvas/src/features/panels/views/ParserView.tsx:241–246` → `onLoadParser` `:193–196`, which loads a script via `useParserEditor.onLoadParserFile` and opens Bottom Panel `'parser'`.
- Validation and errors: `useParserEditor.onApplyParser` `canvas/src/features/parsers/useParserEditor.ts:56–100`; Bottom Panel shows errors: `canvas/src/components/BottomPanel.tsx:430–441`.
- Auto‑detect parsers and load data: `canvas/src/features/parsers/loader.ts` with `bestMatch` from `registry.ts`.

## Behavioral Changes
- Toolbar “Load Data” opens Bottom Panel `'code'` by default on success, not the modal Parser panel.
  - Keep parser auto‑detect and store updates intact.
  - Provide clear path to Parser via the existing Toolbar “Parser” button.
- ParserView “Load Data” opens Bottom Panel `'code'` (Editor) and enables quick access to `'nodes'` (Table) via the existing buttons.
  - Continue to seed parser selection (auto‑detect) and counts/warnings.
- ParserView “Load Parser” remains the entry to load a parser script; after loading, Bottom Panel `'parser'` opens immediately so validation can display any errors.
- Error prompt: invalid YAML/JSON or invalid transforms produce an inline error in the Parser tab; this already happens via `JsonEditor.validate` and `onValidityChange`. We will ensure errors show immediately after script load.

## Code Changes (Preserve API)
- `Toolbar.tsx`
  - In `handleLoad` (`canvas/src/components/Toolbar.tsx:85–107`): after `res` is truthy, open Bottom Panel `'code'` via `openBottomPanel('code')` instead of modal Parser panel.
  - Retain `useParserUIState` syncing of last input, selected parser id, counts/warnings.
- `ParserView.tsx`
  - In `onLoadFile` (`canvas/src/features/panels/views/ParserView.tsx:109–142`): open Bottom Panel `'code'` after success; keep table collapsed logic that reveals tables when data present; expose quick buttons to `'nodes'`/`'edges'` (already present at `330–334`).
  - Keep `onLoadParser` (`193–196`) as is; confirm Bottom Panel opens `'parser'` to surface validation immediately.
- `features/bottom-panel/open.ts`
  - No API change; continue to use `openBottomPanel(tab)` for `'code'|'nodes'|'edges'|'parser'`.

## Validation & Error Prompt
- Ensure `JsonEditor` validation runs on load for JSON/YAML scripts and sets `parserError` when invalid:
  - Bottom Panel wiring already sets `validate={parserLanguage !== 'text' ? validateTransforms : undefined}` and `onValidityChange` pushes errors to state (`canvas/src/components/BottomPanel.tsx:433–441`).
  - Confirm `useParserEditor.onLoadParserFile` leaves `scriptText` as‑is so validation triggers on first render.

## Performance & Cleanup
- Unify parser hash functions
  - Centralize text hashing (used for cache keys) into `features/parsers/hash.ts` and replace duplicates in `features/parsers/cache.ts` and `features/parsers/useParserEditor.ts`.
- Stabilize GraphCanvas rebuilds
  - Reduce effect dependencies by stabilizing store function references (memo/ref) and depending on structured versions (`dataVersion`, `schemaVersion`).
  - Avoid unnecessary teardown/reinit cycles stemming from unstable function identities.
- Feature‑scoped utility extraction (≤600 lines per file)
  - BottomPanel: move JSON stringify/parse helpers, code selection sync helpers, and hotkeys into `features/code-editor/*` (some already exist; complete the extraction to keep `BottomPanel.tsx` lean).
  - ParserView: move custom parser CRUD helpers into `features/parsers/ui/*` to keep view components focused on UI state and actions.
  - GraphCanvas: isolate zoom/simulation orchestration (already partially in `features/GraphCanvas/*`); make the render component slimmer and SRP‑aligned.
- Cache/memo improvements
  - Parser cache remains in `features/parsers/cache.ts`; add small helpers to invalidate by `graphId` when relevant.
  - Minimap/search caches: optional explicit invalidation helpers for debugging; keep TTLs and keys as is.

## Acceptance Criteria
- Clicking Toolbar “Load Data” loads CSV/JSON/JSON‑LD and opens Bottom Panel Editor; Table shows data when opened.
- Clicking “Load Parser” in ParserView loads a parser script; Bottom Panel Parser tab opens and shows a clear error if invalid.
- Graph renders automatically after `setData`.
- Large files reduced toward ≤600 lines by utility extraction without changing public APIs.
- No infinite loops; fewer unnecessary re‑renders in GraphCanvas; caches unified and invalidation predictable.

## Risk & Rollback
- Changes are UI‑routing and utility extraction; no parser algorithm changes.
- If Bottom Panel open behavior conflicts with user expectations, we can re‑enable modal Parser panel open from Toolbar behind a flag.

## Next Steps
- Implement the routing tweaks (Toolbar and ParserView) and the hash/util extraction.
- Verify with existing tests: `parserAutoApply.test.ts`, `parserUiState.test.ts`, `panel.test.ts`, `tabSync.test.ts`.
- Add/adjust tests for Bottom Panel open behavior and invalid script prompt visibility.