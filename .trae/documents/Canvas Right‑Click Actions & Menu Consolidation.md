## Findings
- Node context menu already supports:
  - Side Panel open: `canvas/src/components/GraphCanvas.tsx:368–373`
  - Bottom Panel → Nodes: `canvas/src/components/GraphCanvas.tsx:379–385`
  - Bottom Panel → Code Editor: `canvas/src/components/GraphCanvas.tsx:389–397`
  - Start Edge From Node: `canvas/src/components/GraphCanvas.tsx:400–410`
- Edge context menu already supports:
  - Source → Side Panel: `canvas/src/components/GraphCanvas.tsx:456–463`
  - Target → Side Panel: `canvas/src/components/GraphCanvas.tsx:471–478`
  - Bottom Panel → Edges: `canvas/src/components/GraphCanvas.tsx:509–517`
  - Bottom Panel → Code Editor: `canvas/src/components/GraphCanvas.tsx:521–529`
- Edge creation from node is implemented and tested:
  - Interaction wiring: `canvas/src/components/GraphCanvas.tsx:100–137`, `182–202`
  - Logic: `canvas/src/features/edge-creation/index.ts:5–15`, `64–104`
  - Tests: `canvas/src/__tests__/edgeCreation.test.ts:3–29`, `31–55`, `57–84`, `86–113`
- Bottom Panel tabs and behavior:
  - Tab keys and routing: `canvas/src/components/BottomPanel.tsx:16`, `356–372`
  - Selection-driven centering for Code/Nodes/Edges: `canvas/src/components/BottomPanel.tsx:185–207`, `209–225`
- Side Panel implementation:
  - Layout and visibility: `canvas/src/pages/Canvas.tsx:96–109`
- Duplication risk: a separate, unused menu component exists:
  - `canvas/src/components/GraphCanvas/Menu.tsx` (not imported anywhere). Inline menu lives in `GraphCanvas.tsx`.

## Objectives
- Ensure all seven right‑click interactions behave as specified.
- Consolidate context‑menu logic into a single component to avoid duplicates, re‑renders, leaks.
- Extract handlers/utilities into feature‑scoped modules; keep files ≤600 lines while preserving API.
- Remove stale/unreferenced code; improve cache/memory performance.

## Implementation Plan
### Consolidate Context Menu
- Enhance `canvas/src/components/GraphCanvas/Menu.tsx` to include missing actions:
  - Node → Side Panel, Nodes tab, Code Editor
  - Edge → Edges tab, Code Editor
- Export a `CanvasMenu` that accepts store actions (`selectNode`, `selectEdge`, `setSidebarOpen`, `setBottomPanelTab`) and refs (`svgRef`, `tempLinkSelRef`, `linkDragRef`).
- Replace inline menu in `canvas/src/components/GraphCanvas.tsx` with `<CanvasMenu .../>`.
- Remove duplicated inline menu blocks and keep `GraphCanvas.tsx` focused on rendering and D3 wiring.

### Feature‑Scoped Utilities
- Move ad‑hoc helpers (e.g., new‑ID generators, duplicate‑edge checks, screen→graph coordinate transforms) into:
  - `features/edge-creation` (ID generation, finalize helpers)
  - `lib/graph/edges.ts` (duplicate detection; already present as `edgeExists`)
  - `features/bottom-panel/utils.ts` (tab sync helpers; already present)
  - `components/GraphCanvas/utils.ts` (retain D3 behaviors only)
- Keep public API stable by re‑exporting from current paths where necessary.

### Cleanup & Performance
- Delete or repurpose `canvas/src/components/GraphCanvas/Menu.tsx` (currently unused) after consolidation to avoid conflicting code paths.
- Memoize menu component and extract `onClick` handlers with `useCallback` to reduce re‑renders.
- Ensure event listeners are attached once and cleaned in `GraphCanvas.tsx` (already implemented in `31–215`); keep dependency arrays minimal.
- Use existing `edge-creation` finalize logic to prevent duplicate edges and to hide temp link (`index.ts:76–108`).
- Avoid memory leaks by clearing timers/refs in Bottom Panel; timers are already guarded, keep as is.

### Verification
- Add focused tests:
  - Node → Nodes tab selection: sets `bottomPanelTab='nodes'` and selects node.
  - Node → Code tab selection: sets `bottomPanelTab='code'` and centers ID in editor.
  - Edge → Edges tab selection: sets `bottomPanelTab='edges'` and selects edge.
  - Edge → Code tab selection: sets `bottomPanelTab='code'` and centers ID in editor.
  - Node → Side Panel: toggles `isSidebarOpen=true` and selection.
  - Start Edge From Node → click another node: creates edge or selects existing.
- Run existing dev‑console test runner (`knowgrphRunTests`) and manual interaction checks.

### Safety & Constraints
- Preserve existing store API (`useGraphStore`) and action names.
- Keep `GraphCanvas.tsx` ≤600 lines by offloading menu UI.
- No changes to data model; schema‑driven styles remain intact.

## Rollout
- Implement consolidation and tests.
- Validate locally (tabs, sidebar toggling, edge creation).
- Remove unused code after verification.

Confirm to proceed; I’ll implement these changes and run the in‑app test runner to verify behavior end‑to‑end.