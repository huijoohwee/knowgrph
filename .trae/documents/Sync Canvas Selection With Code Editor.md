## Goal
- When a node or edge is selected in the canvas, automatically switch to the Code Editor tab and move the caret to the corresponding JSON object in the textarea.
- When the caret/selection in the Code Editor is within a node/edge JSON object, select and focus that entity on the canvas.

## Approach
- Add a `ref` to the Code Editor textarea to control selection and scrolling.
- On `selectedNodeId`/`selectedEdgeId` changes:
  - Expand bottom panel and switch `tab` to `code`.
  - Find the index of the corresponding JSON (`"id": "<id>"`) in `codeText`.
  - Focus the textarea and set selection range around the match.
- On Code Editor interactions (`onSelect`, `onKeyUp`, `onClick`):
  - If there is no JSON error, map caret position to enclosing JSON object via a backward regex search for `"id": "..."`.
  - If the id matches a node `id`, call `selectNode(id)`; if it matches an edge `id`, call `selectEdge(id)`.
  - Avoid selecting based on `source`/`target`; only use object `id` field to disambiguate.

## Files
- Change: `canvas/src/components/BottomPanel.tsx`.

## Validation
- Run dev server and test both directions:
  - Click nodes/edges in canvas: Code Editor opens and caret jumps to the matching JSON.
  - Click or navigate to a node/edge `id` in the textarea: canvas highlights and zooms to the selection.

## Notes
- Guard against invalid JSON: only enable Code→Canvas sync when `codeError` is empty.
- Keep existing JSON edit behavior; no additional dependencies.