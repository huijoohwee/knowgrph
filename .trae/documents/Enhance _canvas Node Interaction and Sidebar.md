## Goals
- Clicking “Test JSON” loads `test-data/unicorn-investors-test.json`.
- Clicking a node highlights its neighbors and connecting edges; non-neighbors are dimmed.
- Sidebar shows description, related nodes with types, and edge list.
- Edit label/type/description; Save updates the node and persists via existing JSON‑LD export.

## Changes
### GraphCanvas Highlights
- Build an adjacency map from `data.edges` when `data` changes.
- On `selectedNodeId`, compute `neighborIds` and set styles:
  - Selected node: blue; neighbors: green; others: low opacity.
  - Connected edges: high opacity and stroke width; others: dim.
- Implementation in `canvas/src/components/GraphCanvas.tsx`:
  - After creating selections for `node`, `link`, and `label`, apply conditional `.style('opacity', ...)` and colors based on `selectedNodeId` and `neighborIds`.
  - Update this styling inside the effect dependency on `selectedNodeId` so it re-renders on selection.

### Sidebar Details and Editing
- Extend `canvas/src/components/NodeEditor.tsx`:
  - Show current node `label`, `type`, and `description` (from `node.properties.description || ''`).
  - Show “Related nodes” list: for each edge where `source===selectedNodeId` or `target===selectedNodeId`, list the other node’s `label` and `type`.
  - Show “Edges” list: `id`, `label`, `source → target` for connected edges.
  - Add an input for `description` with Save merging into `node.properties`.
- Save behavior:
  - `updateNode(node.id, { label, type, properties: { ...node.properties, description } })`.

### Store & Mapping
- `useGraphStore.updateNode` already merges node fields; passing `properties` will overwrite the node’s `properties` field.
- JSON‑LD export (`canvas/src/lib/graph/jsonld.ts:60-79`) already includes `node.properties` via `Object.assign(item, node.properties)`; description will persist in saved JSON‑LD.

### Loader Compatibility
- Raw loader (`canvas/src/lib/graph/unicornLoader.ts`) and file loader (`canvas/src/lib/graph/file.ts`) already map `data.description` into `node.properties.description`.
- No changes needed to loader logic.

## UX Details
- Styling:
  - Selected node: `fill: #3B82F6`.
  - Neighbor nodes: `fill: #10B981`, `opacity: 1`.
  - Non-neighbors: `opacity: 0.15` (nodes, labels, edges).
  - Connected edges: `stroke: #3B82F6`, `stroke-width: 3`, `opacity: 0.9`.
- Sidebar sections:
  - “Edit Node” with inputs for Label, Type, Description.
  - “Related Nodes” list with `label (type)`.
  - “Edges” list with `label: source → target`.

## Testing
- Click “Test JSON” then select a node:
  - Canvas: neighbors highlighted, others dimmed; connected edges emphasized.
  - Sidebar: shows description, related nodes, and edges; edit description; Save updates node.
- Save JSON‑LD and verify description appears in the saved file for the edited node.

## Files to Update
- `canvas/src/components/GraphCanvas.tsx` — neighbor/edge highlighting.
- `canvas/src/components/NodeEditor.tsx` — description field, related nodes, and edge list.

Confirm to proceed and I will implement these UI/logic updates immediately.