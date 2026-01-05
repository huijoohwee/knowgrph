## Goal
Enable bidirectional linking between the graph canvas and the bottom data panel:
- Clicking a node/edge on the canvas focuses and scrolls to its table row.
- Clicking a table row focuses and highlights the corresponding node/edge on the canvas.

## Current Implementation
- Node clicks set `selectedNodeId` (canvas/src/components/GraphCanvas.tsx:102–114).
- Edge elements are not clickable due to `pointer-events: none` (canvas/src/components/GraphCanvas.tsx:66–74).
- Highlighting reacts only to `selectedNodeId` (canvas/src/components/GraphCanvas.tsx:153–197).
- Bottom panel renders nodes/edges but has no selection or scrolling (canvas/src/components/BottomPanel.tsx:72–173).
- Central state has `selectedNodeId` only (canvas/src/hooks/useGraphStore.ts:19–22,69–71).

## Changes
### State
- Add `selectedEdgeId: string | null` and `selectEdge(id | null)` to the store.
- When selecting a node: set `selectedNodeId=id`, `selectedEdgeId=null`.
- When selecting an edge: set `selectedEdgeId=id`; optionally set `selectedNodeId=null` (to avoid conflicting highlights).

### Canvas
- Make edges clickable: remove `pointer-events: none` and add `.on('click', (_, e) => selectEdge(e.id))` (GraphCanvas.tsx around lines 66–74).
- Update highlighting logic:
  - If `selectedEdgeId` is set: highlight only that edge and its endpoints; dim others.
  - Else if `selectedNodeId` is set: keep existing neighbor highlighting.

### Bottom Panel
- Read `selectedNodeId` and `selectedEdgeId` from the store.
- Maintain `ref` maps for node rows and edge rows keyed by id.
- On selection change:
  - Expand panel (`collapsed=false`).
  - Switch tab to `nodes` or `edges` accordingly.
  - Scroll the selected row into view (`scrollIntoView({behavior:'smooth', block:'center'})`).
  - Apply a visual highlight class to the selected row.
- Row → canvas selection:
  - Nodes: clicking a node row triggers `selectNode(n.id)`.
  - Edges: clicking an edge row triggers `selectEdge(e.id)`.
  - Prevent accidental selection when editing inputs by ignoring clicks originating from `input`/`textarea`.

## Files to Update
- canvas/src/hooks/useGraphStore.ts: add `selectedEdgeId` and `selectEdge`.
- canvas/src/components/GraphCanvas.tsx: enable edge clicks; branch highlight effect for node vs edge selection.
- canvas/src/components/BottomPanel.tsx: react to selection, scroll/highlight rows; make rows select on click.
- Optional: canvas/src/components/StatusBar.tsx to show selected edge label.

## Acceptance Criteria
- Clicking a node scrolls to and highlights its row in Nodes tab.
- Clicking an edge scrolls to and highlights its row in Edges tab.
- Clicking a node row highlights the node in canvas.
- Clicking an edge row highlights the edge and its endpoints in canvas.
- Panel auto-expands and switches tabs appropriately.

## Testing
- Load test graph (Canvas.tsx provides `loadUnicornTestJson`).
- Verify node click → nodes row scroll/highlight.
- Verify edge click → edges row scroll/highlight.
- Verify row click → canvas selection/highlight updates.
- Confirm editing inputs still works without unintended selection changes.