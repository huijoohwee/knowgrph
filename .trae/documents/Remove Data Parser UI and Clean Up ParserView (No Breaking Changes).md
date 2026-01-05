## Scope
- Remove the "Data Parser" heading `span`, the surrounding `div`, the radio selector UI for built‑in parsers, and the "Apply Parser" / "Apply AST (Worker)" buttons.
- Keep auto‑detect, custom parser management, counts/warnings display, and programmatic APIs intact.

## Targets
- Remove UI elements in `canvas/src/features/panels/views/ParserView.tsx`:
  - Heading `span` at `ParserView.tsx:271` and its containing `div` at `:270`.
  - Radio list `div` at `:273` with inputs at `:276`.
  - Buttons at `:299` and conditional AST button at `:301`.
- Remove associated handlers/imports (only if now unused):
  - `applySelected` defined at `ParserView.tsx:82‑93`.
  - `applyPythonAst` defined at `ParserView.tsx:95‑107`.
  - Imports `parsePythonViaWorker` and `isTreeSitterEnabled` if no longer referenced.

## Non‑Breaking Constraints
- Preserve all existing parser APIs and registry exports in `features/parsers` (no signature changes).
- Maintain `selectedId` state and `selectedSpec` display for compatibility; selection will come from auto‑detect (`bestMatch`) or custom chooser (`onSelectCustom`).
- Keep `useParserUIState` fields updates; avoid removing store properties.

## Refactor & Extraction
- Consolidate parsing actions through `loadDataViaParser` to avoid duplicate cache/application logic.
- Remove dead code paths in `ParserView` now made unreachable by UI removal.
- Confirm `BottomPanel` features remain functional (tables, code editor panel) via programmatic triggers (`openBottomPanel`).

## Performance & Cleanups
- Eliminate redundant cache calls in removed handlers (already handled by `loader.ts`).
- Verify no infinite re‑renders: memoize action lists (`ActionsRow`) and `selectedSpec` (already `useMemo`).
- Retain LRU cache in `features/parsers/cache.ts`; consider tuning TTL/size in a later change without breaking public API.

## Verification
- Manual: Load data via "Load Data" and confirm auto‑detect works; counts/warnings update; parser details still show; BottomPanel parser tables open.
- Automated: Add tests for `loader.ts` (auto‑detect + cache), and a render test for `ParserView` ensuring removed controls are absent while core functionality persists.

## Rollback Safety
- Changes limited to `ParserView.tsx` and unused imports; underlying parser infrastructure untouched.
- If any dependency requires these controls, re‑introduce via non‑visible programmatic pathways without UI.

## Deliverables
- Updated `ParserView.tsx` with removed UI blocks and cleaned handlers.
- No API changes in `features/parsers/*`.
- Tests covering auto‑detect + cache and core UI rendering.