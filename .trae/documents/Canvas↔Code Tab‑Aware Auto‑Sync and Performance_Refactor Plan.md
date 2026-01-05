## Goals
- Add tab‑aware auto‑sync so selections, caret positions, and zoom state stay consistent across browser tabs.
- Reduce memory and render cost in canvas and panels, preserving the current API and behavior.
- Extract utilities into feature‑scoped modules to keep files under 600 lines while maintaining imports via barrels.
- Remove conflicting, hardcoded, stale, and duplicate logic.

## Current State (survey)
- Canvas↔Code sync exists in `canvas/src/components/BottomPanel.tsx` and `canvas/src/lib/editor.ts` (caret → canvas; selection → code block highlight/scroll).
- `canvas/src/components/GraphCanvas.tsx` (~433 lines) handles D3 render, selection, zoom-to-entity, drag, and context menus; helpers already split into `zoom.ts`, `simulation.ts`, `drag.ts`, `fit.ts`.
- No cross‑tab awareness (`BroadcastChannel`/`storage` event not present). Toolbar zoom handlers in `pages/Canvas.tsx` have TODOs and are not wired to canvas zoom.
- Tables render full lists; no virtualization libraries present.

## Tab‑Aware Auto‑Sync (design)
- Use `BroadcastChannel('knowgrph-sync')` for same‑origin multi‑tab messaging. Fallback to `window.storage` event if unsupported.
- Message types: `SelectionChanged`, `CodeCaretChanged`, `ZoomTransformChanged`, `GraphDataChanged`.
- Payload fields: `graphId`, `sourceTabId`, `timestamp`, `version`, and domain payload (e.g., selected IDs, caret position, zoom matrix).
- Throttle high‑frequency events (e.g., zoom) to 30–60 Hz; debounce caret updates to ~100–150 ms; dedupe identical payloads.
- Ignore messages from the same `sourceTabId`. Guard by `graphId` so multiple projects don’t cross‑pollinate.

## Sync Enhancements (implementation outline)
- Add `tabId` and `graphId` to the Zustand store (`useGraphStore`) and expose pub/sub helpers.
- Publish on selection changes (node/edge), code caret moves, and zoom transform updates from `GraphCanvas`.
- Subscribe at app root (`pages/Canvas.tsx`) to dispatch incoming messages back into the store without triggering loops.
- Center/scroll behaviors remain local, but reflect remote selection/caret consistently; keep current visual highlight semantics.
- Wire Toolbar zoom buttons to `GraphCanvas` via store or ref callback and publish resulting transforms.

## Performance & Memory Improvements
- Tables: Implement list virtualization for Nodes/Edges.
  - Option A (no new deps): windowed rendering (only visible rows) with manual measurement and overscan.
  - Option B (new dep): add `react-window`; create `VirtualNodesTable` and `VirtualEdgesTable` components.
- Editor: Avoid building large `codeText` on every change; lazily recompute and chunk operations (format only visible lines; defer expensive formatting).
- Canvas: Precompute adjacency maps in store for neighbor calculations; reuse D3 selections; batch attribute updates; throttle label opacity changes on zoom.
- Events: Audit global listeners; ensure teardowns for `ResizeObserver`, zoom handlers, and temporary edge preview.

## Feature‑Scoped Refactors (keep files <600 lines)
- `GraphCanvas.tsx` extractions while preserving API:
  - `GraphCanvas/menu.ts`: node/edge context menu actions.
  - `GraphCanvas/highlight.ts`: selection‑driven fill/stroke/opacity updates.
  - `GraphCanvas/edgeCreate.ts`: shift‑drag edge creation workflow and temp link preview.
  - Re‑export via `GraphCanvas/utils.ts` barrel so existing imports remain valid.
- `BottomPanel.tsx` extractions:
  - `features/code-editor/selection.ts`: caret → ID/block detection wrappers around `lib/editor.ts`.
  - `features/code-editor/format.ts`: JSON formatting/chunking.
  - `features/tables/scroll.ts`: row centering/refs.
  - Keep `BottomPanel` under 600 lines by moving handlers and utilities.

## Remove Conflicts/Hardcodes/Duplicates
- Consolidate edge existence checks into a single utility (avoid duplicate edges by source/target/type).
- Replace scattered ID detection paths with `lib/editor` wrappers.
- Implement Toolbar zoom handlers and remove related TODOs; ensure one canonical pathway for zoom state.
- Normalize edge endpoint IDs consistently (string IDs) across creation and updates.

## API Stability
- Maintain current props and store selectors. Add new helpers behind barrels (`GraphCanvas/utils.ts`, `features/code-editor/index.ts`).
- Use type‑safe message envelopes and discriminated unions; avoid `any`.

## Testing & Verification
- Unit tests: message pub/sub adapters; selection and caret reducers; edge dedupe utility.
- Integration tests: multi‑tab sync via `BroadcastChannel` mock; verify no feedback loops and correct throttling.
- Performance checks: render large graphs; measure table render time and memory before/after; confirm zoom/label throttling reduces handler invocations.
- Manual tests: selection highlighting remains correct; code block centering and tab switching behave consistently.

## Rollout
- Implement with feature flags in store (`enableTabSync`, `enableVirtualTables`).
- Deploy Option A (custom virtualization) first to avoid new deps; if needed, move to Option B.
- Document message format and sync behavior in `docs/sync.md`; add a runbook for troubleshooting.
