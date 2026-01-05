## Goal
- Record history entries for node/edge inline edits and canvas operations.
- Batch consecutive operations into a single snapshot using debounce to avoid clutter.

## Design
- Extend the graph store with:
  - `historyTimer` (internal timer handle)
  - `historyDebounceMs` (e.g., 500ms)
  - `scheduleHistory(label: string)` to queue a snapshot after inactivity
- Snapshot content: deep copy of current `data` plus `label` and `timestamp`.
- Ensure undo/redo sets `data` without adding new history entries.

## Changes
- In `canvas/src/hooks/useGraphStore.ts`:
  - Add state fields: `historyTimer`, `historyDebounceMs`.
  - Implement `scheduleHistory(label)` that clears and resets a timer; when it fires, push a history entry with the latest `data` and `label`.
  - Update mutators to call `scheduleHistory()` after `set(...)`:
    - `updateNode(id, updates)` → label `Update Node: <id>`
    - `updateEdge(id, updates)` → label `Update Edge: <id>`
    - `addNode(node)` → label `Add Node: <id>`
    - `removeNode(id)` → label `Remove Node: <id>`
    - `addEdge(edge)` → label `Add Edge: <id>`
    - `removeEdge(id)` → label `Remove Edge: <id>`
  - Keep current `setData(...)` immediate snapshot for Code Editor Apply.
  - Keep `undoHistory/redoHistory/restoreHistory` as history‑neutral.

## Validation
- Inline edit a node label and properties; confirm one history entry after pause.
- Create node+edge via canvas context menu; confirm single snapshot captures both.
- Shift‑drag to create/update edge; confirm batched snapshot.
- Undo/Redo navigates snapshots correctly.

## Notes
- Debounce window length can be adjusted. Start with 500ms.
- If needed later, we can include op metadata (changed keys) in history labels for clarity.