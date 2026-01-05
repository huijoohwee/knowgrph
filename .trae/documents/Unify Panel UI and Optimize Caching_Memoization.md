## Goals
- Rename "Settings Panel" into a unified `Panel` with tabs: `Settings`, `Schema`, `History`, `Help`.
- Consolidate separate overlays into a single tabbed panel, remove duplicates/stale code, and reduce re-renders.
- Extract utilities into feature-scoped modules to keep files under 600 lines while preserving current API.
- Enhance cache and memoization performance; eliminate conflicting/hardcoded behaviors and potential memory leaks.

## Current Structure
- Toolbar opens 4 separate overlays: `SettingsPanel`, `SchemaEditorPanel`, `HistoryPanel`, `HelpPanel` in `canvas/src/components/Toolbar.tsx:201–251, 214–225, 227–238, 240–251`.
- Each panel wraps its content with `PanelFrame` and custom header actions:
  - `SettingsPanel` `canvas/src/components/SettingsPanel.tsx:129–152`.
  - `SchemaEditorPanel` `canvas/src/components/SchemaEditorPanel.tsx:153–175`.
  - `HistoryPanel` `canvas/src/components/HistoryPanel.tsx:18–39`.
  - `HelpPanel` `canvas/src/components/HelpPanel.tsx:27–49`.
- Shared UI primitives: `PanelFrame` `canvas/src/features/panels/ui/PanelFrame.tsx:17–33`, `TabHeader` `canvas/src/features/panels/ui/TabHeader.tsx:19–62`.
- Duplicate actions rows exist: `ActionsRow` `canvas/src/features/panels/ui/ActionsRow.tsx:1–28` and `PanelActionsRow` `canvas/src/features/panels/ui/PanelActionsRow.tsx:1–5`.
- Search caching uses `LRUCache` in `canvas/src/features/toolbar/utils.ts:4–13`, backed by `canvas/src/lib/cache/LRUCache.ts:3–43`.

## Implementation Plan
### 1) Create Unified `Panel`
- Add `canvas/src/features/panel/Panel.tsx` that composes `PanelFrame` with `TabHeader` tabs: `Settings`, `Schema`, `History`, `Help`.
- Internally render existing content components as views (without their own headers):
  - `SettingsView` from `SettingsPanel` content region `canvas/src/components/SettingsPanel.tsx:153–203`.
  - `SchemaView` from `SchemaEditorPanel` content region `canvas/src/components/SchemaEditorPanel.tsx:176–231`.
  - `HistoryView` from `HistoryPanel` content region `canvas/src/components/HistoryPanel.tsx:41–71`.
  - `HelpView` from `HelpPanel` content region `canvas/src/components/HelpPanel.tsx:50–57`.
- Keep existing actions for each view but render them in the unified header’s `rightSlot` when their tab is active.

### 2) Rename "Settings Panel" → `Panel` while preserving API
- Replace `canvas/src/components/SettingsPanel.tsx` with a thin re-export of the new unified `Panel` (default export remains available for backward compatibility).
- Provide named exports if needed (e.g., `export { Panel as SettingsPanel }`) to avoid breaking external imports.

### 3) Update Toolbar Integration
- Replace separate open states (`isSettingsOpen`, `isSchemaOpen`, `isHelpOpen`, `isHistoryOpen`) with a single `isPanelOpen` and `activePanelTab`.
- Single overlay rendering the unified `Panel` positioned using `canvasDims`/`canvasPos` like existing overlays `canvas/src/components/Toolbar.tsx:205–212`.
- Maintain behavior: when opening Schema tab, still call `setEditMode(true)`.
- Keep `SearchPanel` dropdown unchanged.

### 4) Remove Duplicates/Stale Code
- Standardize to one actions row component: keep `ActionsRow` and replace `PanelActionsRow` usages (or alias it to `ActionsRow` to minimize churn).
- Delete stale helper variants after replacement.
- Deduplicate per-panel header logic; each view no longer owns its header—only content.

### 5) Extract Utilities into Feature-Scoped Modules
- Create `canvas/src/features/panel/` for shared tabbed panel logic (types, hooks like `useActivePanelTab`).
- Move panel‑specific helpers (e.g., settings search/indexing) into `canvas/src/features/settings/` where already aligned; ensure imports remain stable.
- Ensure all files stay under 600 lines by extracting sections into subcomponents where needed (Schema editor sections already split).

### 6) Cache & Memoization Enhancements
- Generalize query result caching:
  - Introduce `createQueryCache` in `canvas/src/features/cache/queryCache.ts` wrapping `LRUCache` with TTL and capacity configuration.
  - Key search cache by `graphId|historyIndex|query|limit` (instead of node/edge counts) to avoid stale hits: see store fields used in toolbar and panels.
- Guard against memory leaks:
  - Use `WeakMap<object, Cache>` for per‑graph indexes when object identity is available.
  - Ensure all timeouts/intervals are cleaned (already done in `scheduleDebouncedSearch`; keep the pattern).
- Add `React.memo` around heavy views where appropriate and use `useMemo` for derived lists (already used; expand where missing).

### 7) Re-render & Infinite Loop Audit
- Validate `useEffect` dependency lists (e.g., `SchemaEditorPanel` derives `uniqueNodeTypes`/`uniqueEdgeLabels`; consider `[data, schema]` rather than `[data, schema.catalog]` if catalog shape changes).
- Replace broad closures with `useCallback` where handlers are passed to deep children.
- Confirm no state updates occur during render; ensure all state setters are event-/effect-driven.

### 8) Verification & Tests
- Add lightweight component tests for `Panel` tab switching and per‑tab actions.
- Smoke test toolbar interactions: open/close unified panel; ensure `setEditMode(true)` when switching to `Schema`.
- Validate cache correctness by changing data without changing node/edge counts and confirming search results update.

## Migration Notes
- No external API changes expected; default export of `SettingsPanel` becomes the unified `Panel` while continuing to work wherever imported.
- All imports from `@/features/panels/ui/*` remain; `TabHeader` and `PanelFrame` are reused.
- File references being touched: `canvas/src/components/Toolbar.tsx`, `canvas/src/components/SettingsPanel.tsx`, `canvas/src/components/SchemaEditorPanel.tsx`, `canvas/src/components/HistoryPanel.tsx`, `canvas/src/components/HelpPanel.tsx`, `canvas/src/features/panels/ui/*`, `canvas/src/features/toolbar/utils.ts`.

## Performance Targets
- Unified panel reduces duplicated header rendering and stateful overlays → fewer mounts/unmounts.
- Cache keys align to graph identity/version to reduce incorrect hits.
- Memoized derived data avoids unnecessary re-renders during tab switches and searches.

## Request
- Confirm the unified tab order and naming: `Settings`, `Schema`, `History`, `Help`.
- Confirm that replacing separate overlays with one tabbed `Panel` is acceptable for the UX.
- After confirmation, I will implement, refactor, and verify end-to-end as outlined above.