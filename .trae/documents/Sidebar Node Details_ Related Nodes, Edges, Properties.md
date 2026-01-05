## Current Implementation
- Sidebar component `NodeEditor` already renders properties, media, related nodes, and edges when a node is selected.
- Selection is stored in Zustand: `selectNode` and `selectEdge` (`canvas/src/hooks/useGraphStore.ts:72-74`).
- Canvas registers clicks on nodes/edges to update selection (`canvas/src/components/GraphCanvas.tsx:106-118`, `74-77`).
- NodeEditor resolves neighbors and displays sections:
  - Properties & derived fields (`canvas/src/components/NodeEditor.tsx:34-60`, `94-120`).
  - Media previews (`62-84`, `122-134`).
  - Related Nodes list with open actions (`136-164`).
  - Edges list with focus/open actions (`166-199`).

## Proposed Enhancements
- Rename "Fields" to "Properties" and group keys consistently; show counts badges for neighbors and edges.
- Collapsible sections: Properties, Media, Related Nodes, Edges; remember open state per node.
- Add copy buttons for `node.id` and external link for `reference` if present.
- Improve edge display: show direction arrow and highlight when "Focus Edge" is clicked (already supported by selection; just adjust label styling).
- Handle large property values: truncate long strings with "Show more" toggle; pretty-print arrays/objects.

## Technical Changes
- Update `NodeEditor.tsx` UI only; keep store and graph logic unchanged.
- Use `useMemo` (already present) for neighbor computation; add small helpers for formatting values.
- Maintain type safety using `GraphNode/GraphEdge` types (`canvas/src/lib/graph/types.ts`).
- No new dependencies; reuse Tailwind utility classes already configured.

## Verification
- Start dev server and load test data; click any node and confirm:
  - Properties section renders labeled keys & values.
  - Media shows image/video previews when URLs exist.
  - Related Nodes lists neighbors with working "Open" actions.
  - Edges section shows source→target, properties, and focus/open actions.
- Select an edge in canvas; confirm sidebar updates to edge focus behavior and canvas highlighting remains consistent.

## Files To Update
- `canvas/src/components/NodeEditor.tsx` (UI refinements only).