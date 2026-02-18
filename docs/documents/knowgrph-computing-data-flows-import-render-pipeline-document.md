# Knowgrph Computing Data Flows: Import → Render Pipeline (End-to-End)

**Context**: Computing data flows demo workflow
**Intent**: Document the end-to-end import path and the Flow Editor rendering contract without file/content hardcoding.
**Directive**: Reuse SSOT parsing + Flow rendering + panel semantics; keep Flow Editor behavior consistent with D3/Flow surfaces and AgenticRAG schema directives.

---

## Demo Entry Point (User Journey)

- **Toolbar → Editor workspace button**
- Import local file (fixture, relative to repo root): `sandbox/demo/computing-data-flow-pipeline.json`
- Switch: **Canvas → 2D Renderer → Flow Editor**

Expected result:

- The imported file is a `kg:flow:nodeQuickEditorBundle` (kind/version guarded) that carries:
  - a Node Quick Editor registry snapshot (`registry[]`)
  - a workflow graph payload (`graph`)
- Flow Editor renders the workflow graph using the native Flow renderer.
- Node Quick Editors can be opened concurrently; pinned header drag updates anchor offsets collectively, while detached overlays are draggable and must not overlap by default.

---

## Data Contract (Bundle → GraphData)

- Import must treat the demo as a project-agnostic bundle:
  - kind: `kg:flow:nodeQuickEditorBundle`
  - version: `1`
- Import writes registry entries into `GraphData.metadata['flow:nodeQuickEditorRegistry']` so the UI can render Node Quick Editor fields/ports immediately after commit.

Key implementation:

- Bundle parsing + GraphData metadata wiring: [quickEditorImport.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/lib/graph/io/quickEditorImport.ts)

---

## Import → Store Commit (Code Path)

- Toolbar local JSON import → parser selection → GraphData normalization:
  - [jsonImportAction.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/toolbar/jsonImportAction.ts)
  - [importFlow.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/toolbar/importFlow.ts)
  - [loader.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/parsers/loader.ts)
  - [adapter.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/lib/graph/io/adapter.ts)
- Registry auto-apply from GraphData metadata during store commit:
  - [graphDataSlice.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/hooks/store/graphDataSlice.ts)
  - [graphDataSliceUtils.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/hooks/store/graphDataSliceUtils.ts)

---

## Render (Flow Editor Contract)

### Edges

- Flow Editor must reuse the native Flow renderer for edges (routing + styling) so edge appearance matches 2D Flow.
- Port-bound edges are expressed structurally via:
  - `edge.properties['flow:sourcePortKey']`
  - `edge.properties['flow:targetPortKey']`

### Node Quick Editors

- Multiple Node Quick Editors may be visible at once.
- Detached overlays must:
  - have deterministic default placement (grid/stack)
  - persist detached positions per node id
  - avoid DOM id collisions by scoping form control ids per node
- Pinned overlays must remain node-anchored while header drag applies a shared anchor offset across all pinned overlays.

Flow Editor + overlay wiring:

- [FlowEditorCanvas.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/FlowEditorCanvas.tsx)
- [NodeOverlayEditor.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/FlowEditor/NodeOverlayEditor.tsx)

---

## Non-Hardcoding Rules

- Treat the demo file as a fixture only; do not special-case its node ids, labels, or content.
- All UI behavior (fields, ports, connected values, edge bindings) must be driven by:
  - GraphData
  - registry entries (bundle or GraphData metadata)
  - schema-config toggles
