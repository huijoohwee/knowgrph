## Objectives
- Align Schema Panel and Settings Panel UI/behavior with Bottom Panel structure (header, actions row, content area).
- Extract shared utilities into feature-scoped modules to reduce duplication and keep files under 600 lines while preserving the current API.
- Remove stale/duplicate/hardcoded/conflicting code, prevent re-render/infinite-loop/memory leak issues, and improve cache/memoization performance.

## Scope
- Components: `canvas/src/components/BottomPanel.tsx`, `canvas/src/components/SettingsPanel.tsx`, `canvas/src/components/SchemaEditorPanel.tsx`.
- Tables: `canvas/src/components/BottomPanel/NodesTable.tsx`, `canvas/src/components/BottomPanel/EdgesTable.tsx`.
- Utilities: `canvas/src/components/BottomPanel/sort.ts`, search, selection, formatting, tab sync, virtualization.

## UI Alignment
- Create shared panel primitives mirroring Bottom Panel’s structure:
  - `PanelContainer` (wraps content with `ModalContainer` styling used in Bottom Panel) and `PanelHeader` with left collapse/toggle, center title, right actions/tabs.
  - `PanelActionsRow` for `Format`, `Apply`, `Revert` aligned like Bottom Panel’s code actions.
- Apply to Settings Panel:
  - Replace sticky header with `PanelHeader`; keep existing actions but align layout and spacing like Bottom Panel.
  - Move `Search` input into the header action area; adopt text input styling `px-2 py-1 text-xs border rounded`.
  - Place an actions row (`Apply`, `Reset`) under the header similar to Bottom Panel’s code editor row.
  - Reference: `canvas/src/components/SettingsPanel.tsx:139-164` for header and actions.
- Apply to Schema Editor Panel:
  - Replace sticky header with `PanelHeader` and move `Format/New/Copy/Import/Export/Clear` into `PanelActionsRow` right under header.
  - Keep segment tabs (`Types/Properties/Advanced`) styled like Bottom Panel tabs.
  - Reference: `canvas/src/components/SchemaEditorPanel.tsx:142-176` for header & actions, `182-186` for tabs.
- Keep Bottom Panel unchanged visually; use shared primitives to reduce duplication.

## Shared Modules (feature-scoped)
- Create `canvas/src/features/panels/ui`:
  - `PanelContainer`, `PanelHeader`, `PanelTabs`, `PanelActionsRow`, `IconButton` reuse.
- Create `canvas/src/features/hooks`:
  - `useDebouncedValue(value, ms)` to replace ad-hoc 200ms timers in Settings/Schema.
  - `useDragResize({ collapsed, ratio, setRatio, minPx, maxPx })` extracted from Bottom Panel drag logic (refs at `canvas/src/components/BottomPanel.tsx:328-354`).
  - `usePanelHotkeys({ active, handlers })` to encapsulate `Cmd+S`, `Shift+F`, `Cmd+Z` bindings (currently at `canvas/src/components/BottomPanel.tsx:281-306`).
  - `useCodeJsonEditor({ text, setText, setError, codeRef, format, onApply })` for formatting/caret preservation/apply-revert (logic at `canvas/src/components/BottomPanel.tsx:60-99, 412-496`).
  - `useCodeSelectionSync({ codeRef, graphId, tabId, enableTabSync, tab })` (subscribe/publish at `canvas/src/components/BottomPanel.tsx:252-279, 453-455`).
  - `useSearchAndSort({ nodes, edges, query, nodeSort, edgeSort })` to centralize filter+sort pipelines (logic at `canvas/src/components/BottomPanel.tsx:107-138`).
  - `useVirtualTable({ rowHeight, overscan })` for Nodes/Edges scrolling/viewport math.
- Create `canvas/src/features/tables/ui`:
  - `SortHeader` with ▲/▼ indicator and toggle callbacks to share between Nodes/Edges tables.

## Rendering & Safety Fixes
- Tighten effect dependencies to avoid unnecessary re-renders:
  - Remove `codeText` from selection-centering effects:
    - Nodes: `canvas/src/components/BottomPanel.tsx:186-196` → deps `[selectedNodeId, tab, selectionSource]`.
    - Edges: `canvas/src/components/BottomPanel.tsx:198-208` → deps `[selectedEdgeId, tab, selectionSource]`.
  - Hotkeys effect: `canvas/src/components/BottomPanel.tsx:281-306` → deps `[collapsed, tab]` (no need to rebind on `codeText`).
- Prevent feedback loops across tabs:
  - Ensure `codeSelectTimerRef` gating remains effective; move to shared `useCodeSelectionSync` and enforce throttle from store.
- Memory leak guards:
  - Confirm cleanup of timers and pointermove listeners are centralized in hooks (`usePanelHotkeys`, `useDragResize`) to guarantee removal on unmount.
- Hardcoded constants cleanup:
  - Replace scattered 200ms debounce with `useDebouncedValue(…, 200)`.
  - Move min/max panel height numbers (e.g., `120`, `0.9`) into a shared `panelLayoutConfig` export.

## Cache/Memoization Enhancements
- Precompute ID sets to avoid repeated `Array.some` scans:
  - `const nodeIdSet = useMemo(() => new Set(nodes.map(n => n.id)), [nodes])` and same for edges; use in selection sync (`canvas/src/components/BottomPanel.tsx:449-452`).
- Ensure stable store selectors return referentially stable slices for `data.nodes`/`data.edges` where possible (or memo locally as already done at `canvas/src/components/BottomPanel.tsx:102-104`).
- Keep filtered/sorted arrays memoized; co-locate search pipeline with shared hook.
- Confirm `React.memo` remains on `NodesTable`/`EdgesTable`; export shared row components if needed.

## File Size & API Preservation
- After extraction, keep components ≤ 400 lines, preserving current props/exports.
- Use internal adapters/wrappers so consumers of `SettingsPanel`/`SchemaEditorPanel`/`BottomPanel` remain unchanged.

## Refactor Steps
1. Implement shared UI primitives in `features/panels/ui` and replace Settings/Schema headers/actions.
2. Extract Bottom Panel behaviors into `features/hooks` (`drag-resize`, `hotkeys`, `code-json-editor`, `selection-sync`, `search-and-sort`).
3. Update Nodes/Edges tables to use `useVirtualTable` and `SortHeader`.
4. Tighten effect dependencies in Bottom Panel and adopt ID set caches.
5. Replace ad-hoc debounce in Settings/Schema with `useDebouncedValue`.
6. Centralize constants in `panelLayoutConfig`.
7. Remove duplicate/hardcoded/stale code paths and re-test.

## Acceptance Criteria
- Schema/Settings panels visually match Bottom Panel’s header/actions layout and spacing.
- No regressions in functionality for Settings and Schema operations.
- No infinite loops; no unnecessary re-renders on typing or tab switching.
- File sizes reduced and each stays under 600 lines.
- Shared hooks/utilities are used by all three panels; code duplication minimized.

## Risks & Mitigations
- UI regressions: mitigate by incremental refactor and visual verification.
- Hidden dependencies: preserve existing APIs and introduce wrappers around new primitives.
- Performance regression: profile re-renders; validate selection sync throttling and memoization with large datasets.
