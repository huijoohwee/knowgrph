## Overview
- Rename all "Code Editor" labels to "Editor" across UI and docs.
- Consolidate Parser tab input and table into the Bottom Panel: add "Open Editor" and "Open Table" buttons that open the Bottom Panel to the right tab.
- Create a small utility to programmatically open the Bottom Panel and switch tabs without re-render loops.
- Perform cleanup to remove stale, duplicate and hardcoded logic, and add targeted memoization.
- Extract utilities into feature-scoped modules to keep files under 600 lines while preserving the public API and SRP for classes.

## Targets & Changes
### Global Label Rename
- Update Bottom Panel tab label: `canvas/src/components/BottomPanel.tsx:255` → `{ key: 'code', label: 'Editor' }`.
- Update Canvas menu buttons: `canvas/src/components/GraphCanvas/Menu.tsx:257`, `:271` → `Open in Editor`.
- Update help texts: `canvas/src/features/panels/views/HelpView.tsx:10`, `canvas/src/components/HelpPanel.tsx:17` → replace `Code Editor` with `Editor`.
- Update README sections: `/README.md:339`, `:350`.

### Parser Tab — Input Data Consolidation
- Remove the dedicated input `textarea` and replace with an "Open Editor" button:
  - Parser input `textarea`: `canvas/src/features/panels/views/ParserView.tsx:211` will be removed.
  - Insert an ActionsRow button alongside "Load Data" that calls `openBottomPanel('code')` to open the Bottom Panel Editor.
- Preserve existing parser selection UI and actions (auto-detect, custom parser management) unchanged.

### Parser Tab — Table Consolidation
- Replace inline `ParserTable` render with an "Open Table" button to jump to Bottom Panel tables:
  - `canvas/src/features/panels/views/ParserView.tsx:302–304` will switch from `{data && <ParserTable .../>}` to buttons:
    - "Open Table" → `openBottomPanel('nodes')` (default), with optional secondary button for edges → `openBottomPanel('edges')`.
- Keep counts and warnings display intact (for feedback after parser application).

### Bottom Panel — Programmatic Open Utility
- Add `features/bottom-panel/open.ts` exporting `openBottomPanel(tab?: 'code'|'nodes'|'edges')`:
  - Sets tab via store: `setBottomPanelTab(tab)`. References: `Canvas Menu` already uses this store setter at `canvas/src/components/GraphCanvas/Menu.tsx:72–85, 184–197`.
  - Ensures panel is expanded by persisting `localStorage.setItem('bottom.collapsed', '0')` and nudging height ratio if needed via store `setBottomPanelHeightRatio(0.35)` (from `canvas/src/hooks/store/uiSlice.ts`).
  - Guards against redundant writes and avoids infinite loops by reading current values before writing.

### Store & State Wiring
- Reuse existing Zustand store fields in `canvas/src/hooks/store/uiSlice.ts`:
  - `bottomPanelTab` with `setBottomPanelTab`
  - `bottomPanelHeightRatio` with `setBottomPanelHeightRatio`
- Do not introduce a new open/closed flag; rely on `usePersistedBoolean('bottom.collapsed')` behavior in `BottomPanel.tsx`.

### Cleanup & Performance
- Remove stale/duplicate state in `ParserView` for input text once consolidated.
- Memoize derived data and heavy lists in tables:
  - Ensure `NodesTable` and `EdgesTable` use stable dependencies for `useMemo` and `useCallback` to avoid redundant computations.
- Debounce or guard `requestAnimationFrame` scroll helpers in Bottom Panel editor to prevent repeated runs.
- Eliminate hardcoded defaults scattered across features; centralize sensible defaults (e.g., bottom panel height ratio) in a constants module under each feature.
- Review parser caches: keep `getCachedParse`/`setCachedParse` unchanged but add invalidation hooks where custom parser changes occur (already called at `ParserView.tsx:155, 164`).

### Feature-Scoped Module Extraction
- Bottom Panel (likely > 600 lines including subcomponents):
  - Extract editor helpers from `canvas/src/components/BottomPanel.tsx` into `features/code-editor/` alongside existing `format` and `selection` modules.
  - Keep tables in `canvas/src/components/BottomPanel/NodesTable.tsx` and `EdgesTable.tsx` but move general sorting/virtualization utils into `features/bottom-panel/table-utils.ts` (preserving `sort.ts` API via re-exports).
- Parser feature:
  - Move IO functions (`importCustomParsersFromFile`, `exportCustomParsersToFile`) into `features/parsers/io/` and keep `toParserSpec` in `features/parsers/spec.ts` with re-exports to maintain current import paths.
- Ensure each class or utility remains SRP-aligned; create small focused modules and re-export through the existing entry points to preserve API.

## Implementation Notes
- Use existing patterns: Zustand store setters for tab and height ratio; localStorage-backed booleans for collapse state.
- Prefer composition and `useMemo`/`useCallback` over new global caches.
- Avoid any side-effects inside render phases; utilities perform storage writes only on explicit button clicks.

## Verification
- Manual flows:
  - Parser tab "Open Editor" opens Bottom Panel Editor and focuses the editor `textarea`; tab label shows "Editor".
  - Parser tab "Open Table" opens Bottom Panel Nodes (and Edges via secondary button) with virtualization and sorting intact.
  - Canvas menu: items say "Open in Editor" and switch tabs as expected.
- Automated checks:
  - Add a lightweight unit test for `openBottomPanel()` to verify `localStorage` and store mutations.
  - Run UI smoke test to ensure no re-render loops (monitor devtools for repeated renders on button press).

## Migration & Docs
- Update README references to "Editor" and add a note under Parser tab explaining the consolidation and the new buttons.
- No breaking API changes; imports remain valid via re-exports in feature-scoped modules.
