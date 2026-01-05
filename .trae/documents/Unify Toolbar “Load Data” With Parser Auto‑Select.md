## Current Behavior
- Toolbar `Load Data` calls `loadGraphFile` and sets `data`, then opens the unified `Panel` at `Parser` (`canvas/src/components/Toolbar.tsx:85-93`).
- Parser tab’s `Load Data` (via `ActionsRow`) picks a text file, auto‑detects a matching parser with `bestMatch`, uses cache, applies the parser, updates `data`, warnings, counts, and expands sections (`canvas/src/features/panels/views/ParserView.tsx:64-89`).
- The two buttons implement similar goals but via different code paths, causing duplicated logic and inconsistent UI state within `ParserView` (e.g., `inputName/inputText/selectedId`).

## Goals
- Clicking Toolbar `Load Data` opens `Panel → Parser` and auto‑selects Parsers using the same pipeline as the Parser tab; do not auto‑close the Panel.
- Align behavior and remove redundant parsing code; keep feature files lean (<600 lines) and preserve existing module APIs.
- Improve caching/memoization; avoid stale or conflicting state.

## Changes
- Create `features/parsers/loader.ts` (feature‑scoped utility) that encapsulates: pick file, `bestMatch`, cache lookup, apply parser, update `data`, return `{ parserId, name, counts, warnings }`.
- Create `features/parsers/uiState.ts` (tiny Zustand store) to persist the last input and selection for `ParserView`: `{ inputName, inputText, selectedId, warnings, counts, attemptedAutoDetect }`.
- Update Toolbar `handleLoad` to call the new loader, then:
  - Persist UI state to `uiState` for `ParserView`.
  - Set `panelTab('Parser')` and `setIsPanelOpen(true)` without closing afterward.
- Refactor `ParserView.onLoadFile` to call the same loader and hydrate its local UI from `uiState` (set `inputName/inputText/selectedId/warnings/counts`, expand sections). This removes duplicated matching/apply/cache code.

## Implementation Steps
- Add `loader.ts` with `async function loadDataViaParser(): Promise<{ parserId?: string; name?: string; counts?: {n:number;e:number}; warnings?: string[]; input?: {name:string;text:string} } | null>` that uses existing `pickTextFile`, `bestMatch`, `getCachedParse/setCachedParse`, and `applyParser`.
- Add `uiState.ts` with a small store (`create` from Zustand, already used) exposing `setLastInput`, `setSelectedId`, `setWarnings`, `setCounts`, `setAttemptedAutoDetect`, and getters.
- Modify `canvas/src/components/Toolbar.tsx` `handleLoad` to import and use `loadDataViaParser`, then hydrate `uiState` and open `Panel` at `Parser`.
- Modify `canvas/src/features/panels/views/ParserView.tsx` to:
  - Initialize from `uiState` on mount and when `Panel` activates the tab.
  - Replace `onLoadFile` with a call to `loadDataViaParser` and subsequent `uiState` hydration; keep the `Apply Parser` button behavior as‑is.
- Keep `IconButton` and `ActionsRow` styles but ensure both trigger identical code paths.

## Alignment & Redundancy
- Single source of truth for loading+parsing lives in `features/parsers/loader.ts`.
- Toolbar and Parser tab share the same function; duplicated cache and matching logic inside `ParserView` is removed.
- Panel remains open; no additional close logic is introduced.

## Caching & Performance
- Reuse existing LRU cache (`canvas/src/features/parsers/cache.ts`) keyed by `parserId|name|hash(text)`.
- Memoize filtered parser list and selection as already implemented; ensure no extra `useEffect` loops.
- Avoid redundant re‑parsing by checking cache before `applyParser` in the loader.

## Verification
- Manual: Click Toolbar `Load Data` → file picker → Panel opens at `Parser`; selected parser appears, counts/warnings populate; sections expand; panel stays open.
- Tests to add:
  - Toolbar load calls loader and opens `Parser` without closing.
  - Parser tab load uses the same loader and hits cache on repeat.
  - `uiState` hydration reflects last input/selection consistently.

## Notes
- All changes are feature‑scoped and preserve public APIs of existing modules; component props changes are minimal and internal.
- No hardcoded paths or stale state; avoids infinite loops and redundant computation by centralizing logic.