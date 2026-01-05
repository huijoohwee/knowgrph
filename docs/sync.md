# Tab-Aware Auto-Sync

## Overview
- Syncs selection, caret, and zoom between browser tabs using `BroadcastChannel('kg:session:tabSync')` with `localStorage` fallback.
- Message envelope: `{ version, kind, graphId, sourceTabId, timestamp, payload }` with kinds `SelectionChanged`, `CodeCaretChanged`, `ZoomTransformChanged`, `GraphDataChanged`.

## Configuration
- Store fields: `graphId`, `tabId` (persisted in `sessionStorage`), `enableTabSync`, `enableVirtualTables`.
- Toggle features via store setters.

## Publishing
- Selection: dispatched from `pages/Canvas.tsx` when `selectedNodeId/selectedEdgeId` change.
- Caret: dispatched from `BottomPanel` on `textarea` selection.
- Zoom: dispatched from `GraphCanvas` zoom handler.

## Subscribing
- Canvas subscribes to apply remote selections.
- GraphCanvas subscribes to remote zoom transforms and applies them.
- BottomPanel subscribes to caret updates when Code tab is active.

## Performance
- Tables use windowed rendering with spacers when `enableVirtualTables`.
- Label opacity updates throttled to ~60 FPS.
- Adjacency map precomputed and cached for quick neighbor lookups.
- Code tab initialization uses idle scheduling to avoid blocking tab switches.
- Search input uses deferred value to reduce blocking during filtering.
- Table components are memoized (`React.memo`) and handlers are stabilized via `useCallback`.
- Cross-tab message publishes are deduped to avoid redundant events.

## Troubleshooting
- Ensure all tabs share the same `graphId`.
- Disable `enableTabSync` to isolate a tab.
- Use `window.knowgrphRunTests()` in dev console to run simple unit tests.
- If sync is noisy, adjust throttles/debounces in the handlers.
