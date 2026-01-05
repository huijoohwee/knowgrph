## Overview
- Add a "Load Parser" subsection in the Parser panel UI to manage parser definitions with Create, Read, Update, Delete, Import, Export.
- Keep existing APIs intact (`registry`, `persistence`, `custom`, `cache`) and add small, feature-scoped utilities.
- Improve cache behavior and avoid stale results when parsers change.

## Current Parser Panel
- UI and state: `canvas/src/features/panels/views/ParserView.tsx` (233 lines). It already supports:
  - Built-in parser selection and apply (lines 167–193)
  - Custom parser create/update via `Save Custom` button (lines 119–141, 220–223)
  - Custom parser delete via `Delete Selected` (lines 143–148, 222–223)
  - Data load via `Load Data` (lines 152–153, 83–107)
- Registry: `canvas/src/features/parsers/registry.ts` provides `listParsers`, `registerParser`, `unregisterParser`, `bestMatch`, `applyParser`.
- Persistence: `canvas/src/features/parsers/persistence.ts` provides localStorage-backed `readCustomParsers`, `writeCustomParsers`, `upsertCustomParser`, `deleteCustomParser`.
- Custom spec conversion: `canvas/src/features/parsers/custom.ts` (`toParserSpec`).
- Loader & file I/O: `canvas/src/features/parsers/loader.ts` and `canvas/src/lib/graph/file.ts` (`pickTextFile`, export helpers in `save.ts`).
- Cache: `canvas/src/features/parsers/cache.ts` using `LRUCache`.

## UI Changes
- Add a new `CollapsibleSection` titled "Load Parser" in `ParserView.tsx` under the actions row, before "Parsers".
- Inside the section:
  - Add a `Load Parser` button: picks a `.json` file containing a parser config (single or array) and imports it.
  - Add an `Export Parsers` button: exports all custom parser configs from localStorage to a `.json` file.
  - Add a compact list of existing custom parsers (from `readCustomParsers`) with:
    - Select action to set `selectedId` (enables manual apply and match debugging).
    - Edit action: loads config into the form fields for update.
- Keep the existing "Custom Parser" form and buttons; wire the list selection into those inputs.

## Import/Export Utilities (feature-scoped)
- New file: `canvas/src/features/parsers/io.ts`
  - `importCustomParsersFromText(text: string): { imported: number; errors: string[] }`
    - Parse JSON as `CustomParserConfig | CustomParserConfig[]`.
    - Validate required fields (`id`, `name`, `base`, `match`) and optional `transforms`.
    - Use `upsertCustomParser` to persist, convert via `toParserSpec`, then `registerParser`. Accumulate errors per item.
  - `importCustomParsersFromFile(): Promise<{ imported: number; errors: string[] }>`
    - Use `pickTextFile` (`canvas/src/lib/graph/file.ts`) then call `importCustomParsersFromText`.
  - `exportCustomParsersToFile(): Promise<boolean>`
    - Read `readCustomParsers()`, build a pretty JSON blob.
    - Use `saveBlobWithPicker` (`canvas/src/lib/graph/save.ts`) with fallback `downloadBlob`, suggested name `parsers.json`.
- These utilities preserve the current public API by layering on top of `persistence`/`registry`/`custom`.

## Wiring in ParserView
- Add handlers:
  - `onLoadParser`: calls `importCustomParsersFromFile()`, updates `parsers` state via `setParsers(listParsers())`, shows first error/warning if any.
  - `onExportParsers`: calls `exportCustomParsersToFile()`.
  - `onSelectCustom(id)`: sets `selectedId` and expands sections (similar to existing effects at 48–51).
  - `onEditCustom(id)`: loads config fields (`customId`, `customName`, `customBase`, `customMatchMode`, `customMatchValue`, defaults, `customTransformsJson`).
- Render a small list:
  - Source: `readCustomParsers()`; memoize.
  - Each item shows `name (id)` and two buttons: `Select`, `Edit`.

## Cache Behavior & Performance
- In `canvas/src/features/parsers/cache.ts`:
  - Add `invalidateParserCache(id: string)` that clears entries for a given parser. Two implementation options:
    - Simple: call `cache.clear()` after any upsert/delete (safe, minimal code).
    - Targeted: extend `LRUCache` with `deleteWhere(predicate)` and delete keys starting with `${id}|` (additive API).
- Replace `hashText` with a stronger digest for lower collision risk:
  - Preferred: `crypto.subtle.digest('SHA-256', ...)` when available; fallback to current lightweight hash.
  - Keep the function name and signature; compute digest once per unique text input.
- In `ParserView.tsx`, after `upsertCustomParser` and `deleteCustomParser`, call `invalidateParserCache(selectedId)` to avoid stale results.

## Code Cleanups
- Eliminate redundant recomputations:
  - Use `useMemo` for `customParsersList`, `filtered` already memoized.
  - Ensure built-ins registration runs once (current effect at line 55 is correct).
- Defensive guards in effects and handlers to avoid infinite loops or stale closures.
- No files exceed 600 lines; new utilities are kept small and scoped under `features/parsers`.

## Validation
- Unit tests:
  - `importCustomParsersFromText` validates and registers specs; handles single/array; returns errors.
  - Cache invalidation ensures `getCachedParse` returns undefined after updates/deletes.
- Manual verification:
  - Start dev server; in Parser panel, import a custom parser config file; select/edit; export to file; apply to sample inputs and confirm node/edge counts and warnings.

## File Changes (additive)
- `canvas/src/features/panels/views/ParserView.tsx`: Add "Load Parser" section, custom list, handlers for import/export/select/edit.
- `canvas/src/features/parsers/io.ts`: New import/export utilities.
- `canvas/src/features/parsers/cache.ts`: Add `invalidateParserCache` and optional stronger `hashText`.
- `canvas/src/lib/cache/LRUCache.ts`: Optionally add `deleteWhere(predicate)` (additive, no breaking changes).

## Notes
- All changes preserve existing public APIs and behaviors.
- Import format: JSON file with `CustomParserConfig` or array of them; export format mirrors this.
- Error messages are concise and actionable; UI surfaces first error under the Parsers section.
