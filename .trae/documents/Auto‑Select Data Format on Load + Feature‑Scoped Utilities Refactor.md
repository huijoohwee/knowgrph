## Objectives
- In Parser tab → Parsers section: selecting `Load Data` auto‑detects format, auto‑selects the matching parser, and reveals parser rules/configurations.
- Refactor and cleanup: extract utilities into feature‑scoped modules (≤600 lines), remove duplicates/stale code, and harden caching/memoization to avoid re‑renders, loops, and leaks.

## Parser UX Updates
- Add auto‑selection after `Load Data` in `ParserView` so the best matching parser is selected and its config is shown.
  - `canvas/src/features/panels/views/ParserView.tsx:69–84` currently uses `bestMatch` and `applyParser`; wire this to run immediately after `onLoadFile`.
  - Expand the `Parsers` section and focus the selected radio.
  - Show counts and first warning inline: `ParserView.tsx:157–160`.
- Keep manual override: users can still pick a different format if auto‑match is wrong.

## Auto‑Detect Format
- Reuse existing format detection everywhere:
  - Parser registry `bestMatch`: `canvas/src/features/parsers/registry.ts:1–29`.
  - Unified adapter for files: `canvas/src/lib/graph/io/adapter.ts:12–39`.
- Implementation flow in Parser tab:
  - On `Load Data` → `pickFile` reads `{ name, text }`: `ParserView.tsx:11–45`.
  - Run `bestMatch({ name, text })` → set `selectedId` and preview output via `applyParser`: `ParserView.tsx:75–84`.
  - Auto‑expand `Parsers` and `Table` sections to show configuration and results: `ParserView.tsx:144–193`.
- Toolbar alignment:
  - Ensure Toolbar "Load Data" leverages the same detection: `canvas/src/components/Toolbar.tsx:86–93` and `file.ts:31–45`.
  - Option: if file is loaded from Toolbar, open Parser tab with the detected parser pre‑selected to keep a single UX.

## Show Parser Rules/Configurations
- Display built‑in parser rules and custom parser configuration immediately after auto‑selection.
  - Built‑ins: `canvas/src/features/parsers/default.ts:7–47`.
  - Custom parser fields (id, base, match, defaults, transforms): `ParserView.tsx:162–182` using `custom.ts` → `toParserSpec`.
  - Render parsed table via `ParserTable`: `canvas/src/features/parsers/ui/ParserTable.tsx:34–50`.
- Keep persistence of collapses via keys: `parser.tableCollapsed`, `parser.parsersCollapsed`, `parser.inputCollapsed`: `ParserView.tsx:46–48` and `usePersistedBoolean.ts:3–21`.

## Utilities Refactor (≤600 lines, preserve API)
- Prioritize near‑limit files for extraction:
  - `GraphCanvas.tsx` (452): move interaction/render helpers under `components/GraphCanvas/*` (continue existing split).
  - `schemaSlice.ts` (441): split selectors/helpers into `features/schema/*` services; keep slice thin.
  - `BottomPanel.tsx` (367): factor tables/editor/handlers into `components/BottomPanel/*`.
  - `Minimap.tsx` (356): keep math/renderer/worker in `features/minimap/*`; UI only in `Minimap.tsx`.
  - `Toolbar.tsx` (272): split dropdowns/action handlers; reuse `lib/ui/overlay.tsx`.
- Preserve current API via barrels/re‑exports:
  - Create/extend feature barrels (`index.ts`) and re‑export previous top‑level symbols to avoid breaking imports.
- Consolidate general utilities from `lib/utils.ts` into feature‑specific modules when usage is exclusive; keep shared logic in `lib/*`.

## Cleanup: duplicates, hardcodes, stale code
- Remove redundant overlay wrappers; centralize in `lib/ui/overlay.tsx`.
- Eliminate duplicate parser/file pickers; standardize on `pickFile` in `ParserView.tsx:11–45` and `lib/graph/file.ts:6–29`.
- Replace hardcoded TTLs and capacities with `config` keys in `lib/config.ts`.
- Delete or merge dead/duplicate helpers discovered during extraction (keep tests green).

## Cache & Memoization Enhancements
- Standardize LRU usage with clear TTLs and eviction:
  - `lib/cache/LRUCache.ts` for shared behavior.
  - Parser cache: `features/parsers/cache.ts` keys include parser id, name, text hash; keep.
  - Search cache: `features/toolbar/utils.ts` already includes a `versionKey`; propagate this pattern to other caches that depend on graph identity.
- Stabilize effect deps to avoid re‑renders/loops:
  - Memoize handler objects passed into hooks (e.g., `usePanelHotkeys`): `components/BottomPanel.tsx` uses `useMemo`.
  - Prefer version keys over large `data` object identity in effects that schedule work (search/minimap).
- Add `React.memo` to heavy table components and ensure virtualization via `useVirtualTable.ts` for large lists.

## Stability: infinite loops and leaks
- Audit `useEffect` sites:
  - Debounced search effects in `Toolbar.tsx` and `SearchPanel.tsx` have cleanups; ensure deps are stable.
  - Event listeners in `useDragResize.ts`, `overlay.tsx`, `CollapsiblePanel.tsx` include teardown; verify no anonymous handler recreation on every render.
- Replace object/array literals in effect deps with memoized values.

## Tests & Verification
- Extend existing tests:
  - Parser registry auto‑match: `canvas/src/__tests__/parserRegistry.test.ts`.
  - Panel interactions: `canvas/src/__tests__/panel.test.ts` — add case: `Load Data` auto‑selects parser, shows rules/config.
  - Cache behavior: `canvas/src/__tests__/searchCache.test.ts` and `cache.test.ts` — verify versioned keys and TTL.
  - Roundtrip parsing: `canvas/src/__tests__/roundtrip.test.ts` — ensure toolbar and parser flows produce identical `GraphData`.
- Run `pnpm test` in `canvas` and fix regressions.

## Rollout
- Implement behind a minimal feature flag (default on) to allow quick revert if needed.
- Update `README.md` under “Dev vs Preview (Match Content 100%)” to confirm Parser tab behavior matches in dev/preview.
- Document parser UX in `knowgrph-configurable-parser-catalog.md`.

## Expected Outcome
- `Load Data` in Parser tab auto‑selects the right Data Format and surfaces the parser’s rules/config immediately.
- Codebase remains under 600‑line per file, APIs preserved via barrels.
- Reduced re‑renders, no infinite loops, stronger caches; tests verify correctness across flows.