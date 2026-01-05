## Goals
- Improve switch/toggle performance across Canvas, Code, Nodes, and Edges views.
- Eliminate unnecessary re-renders, feedback loops, and memory leaks.
- Keep files under 600 lines by extracting helpers into feature-scoped modules while preserving the current API.

## Current Hotspots
- Code tab initialization does heavy `JSON.stringify(data)` and block-centering work.
- Nodes/Edges tables filter/sort over full lists and re-render frequently.
- Event listeners (drag/zoom) must be attached/detached cleanly to avoid leaks.
- Cross-tab sync can create loops if not guarded.

## Implementation Steps

### BottomPanel (Code/Nodes/Edges)
- Use `useDeferredValue` for `searchQuery` and idle scheduling when switching to Code tab.
- Memoize callbacks (`useCallback`) and memoize table components (`React.memo`) to reduce re-render churn.
- Virtualize lists (already implemented) and keep row heights consistent; gate with `enableVirtualTables`.
- Extract table-specific logic into `features/tables/*` and editor-specific logic into `features/code-editor/*` (already started); ensure BottomPanel stays <600 lines.
- Keep Code Editor mounted between switches but avoid regenerating `codeText` unless data changes or Code tab becomes active, and then schedule via `requestIdleCallback`.

### Canvas (GraphCanvas)
- Ensure no rebuild on tab switches; only rebuild on data changes.
- Throttle zoom/label updates (already done) and keep stable selectors from the store to prevent re-renders on unrelated state.
- Pending zoom mechanism ensures editor→canvas centering even if simulation hasn’t settled; retain and guard it.

### Store & Selectors
- Use `zustand` selectors that only subscribe to the needed state for each component; avoid broad `useGraphStore()` usage.
- Add shallow comparison where appropriate to minimize re-renders.
- Keep feature flags (`enableTabSync`, `enableVirtualTables`) and UI settings in the store; persist panel height ratio.

### Cross‑Tab Sync
- Guard messages with `graphId` and `sourceTabId`; ignore self-originated updates (already present).
- Dedupe identical payloads; throttle high-frequency messages (zoom) and debounce caret updates.

### Memory & Cleanup
- Verify listener cleanup: pointer move/up for panel resizing; zoom/tick handlers; BroadcastChannel/storage listeners.
- Ensure all `ResizeObserver` and timers are cleared on unmount.

### Testing
- Add dev-only tests for:
  - Selector-based rendering (mock store updates, verify minimal re-renders).
  - Message pub/sub dedupe and throttling.
  - Panel resize handle listener attach/detach.

### Documentation
- Update `docs/sync.md` with performance notes: deferred search, virtualization, idle scheduling, and store selector guidance.

## Expected Outcomes
- Noticeably faster tab switches (Canvas↔Code, Canvas↔Nodes/Edges, Code↔Nodes/Edges).
- Stable UI without infinite loops or memory leaks.
- Clear separation of concerns via feature-scoped utilities while keeping the public API unchanged.