## Current Behavior (Already Implemented)

* Canvas → Code: When a node or edge is selected, the bottom panel expands, switches to Code Editor, focuses the textarea and selects the matching `"id": "<id>"` substring (`canvas/src/components/BottomPanel.tsx:132–144`, `146–158`).

* Code → Canvas: Caret selection in the Code Editor triggers detection of the nearest `"id": "…"` before the caret and selects that entity via `selectNode`/`selectEdge` (`canvas/src/components/BottomPanel.tsx:268–285`).

* Canvas focus on selection: The canvas zooms to a selected node or edge (`canvas/src/components/GraphCanvas.tsx:304–336`).

## Verification

* Click nodes/edges in canvas: Code tab opens and caret moves to the corresponding JSON.

* Place caret on a node/edge `id` in Code Editor: Canvas highlights and zooms to the selection.

* Invalid JSON: Code→Canvas sync is disabled when `codeError` is present.

## Hardening & UX Improvements

1. Robust object positioning:

   * Move caret to the start of the JSON object (opening `{`) for the selected node/edge rather than the `id` property.

   * If multiple `"id"` occurrences exist, prefer the enclosing `nodes[]`/`edges[]` object.
2. Visual feedback:

   * Briefly highlight the focused JSON object block (e.g., background tint for 1s) to aid orientation.
3. Stability on format:

   * Preserve caret logical position across Format on large documents.
4. Performance:

   * Throttle Code→Canvas selection events to avoid excessive updates while typing.

## Next Steps (if you approve)

* Implement object-boundary detection and highlight in Code Editor.

* Throttle Code→Canvas sync to \~100ms.

* Preserve caret position across formatting.

* Re-verify both directions with large graphs.

