# Knowgrph Computing Data Flows: Import → Render Pipeline (End-to-End)

**Context**: Computing data flows demo workflow
**Intent**: Document the end-to-end import path and the Flow Editor rendering contract without file/content hardcoding.
**Directive**: Reuse SSOT parsing + Flow rendering + panel semantics; keep Flow Editor behavior consistent with D3/Flow surfaces and AgenticRAG schema directives.

- Directive: Frontmatter `flow:` imports must centralize `direction`, `edgeType`, and `computed` settings in GraphData metadata so parse, Flow render, and Flow Editor runtime consume one SSOT contract without duplicated branching.

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

- Bundle parsing + GraphData metadata wiring: [quickEditorImport.ts](../../canvas/src/lib/graph/io/quickEditorImport.ts)

---

## Import → Store Commit (Code Path)

- Toolbar local JSON import → parser selection → GraphData normalization:
  - [jsonImportAction.ts](../../canvas/src/features/toolbar/jsonImportAction.ts)
  - [importFlow.ts](../../canvas/src/features/toolbar/importFlow.ts)
  - [loader.ts](../../canvas/src/features/parsers/loader.ts)
  - [frontmatterFlowImportMode.ts](../../canvas/src/features/parsers/frontmatterFlowImportMode.ts)
  - [adapter.ts](../../canvas/src/lib/graph/io/adapter.ts)
- When imported GraphData is detected as `frontmatter-flow`, import/source-compose roots must auto-apply a strict runnable mode contract: `canvasRenderMode=2d`, `canvas2dRenderer=flowEditor`, `documentSemanticMode=document`, `frontmatterModeEnabled=true`, and `multiDimTableModeEnabled=false`, without file-name hardcoding.
- Frontmatter-flow metadata projection must preserve top-level authored sections (`Tier B` scalar keys, `runtime`, `pipeline`, `mermaid`, `flow`) in `metadata.frontmatterMeta`; when YAML fallback misses nested blocks, parser fallback should recover those sections from raw frontmatter boundaries upstream.
- MainPanel Workflow Manager should provide section-level controls for `Tier B`, `runtime`, `pipeline`, `mermaid`, and `flow` with default visibility ON, where OFF hides only the manager view while runtime graph execution remains active in background.
- Workflow section configuration edits from MainPanel should patch only `metadata.frontmatterMeta` via one shared helper path and must not introduce renderer-local forks or file-specific coupling.
- Workflow Manager shell should gate legacy tabs at source: when active graph is frontmatter-flow, expose workflow (`graph`) tab only and clear stale apply/reset actions from legacy mapping/spec surfaces.
- Workflow Manager graph surface should also suppress legacy graph-manager controls in workflow mode and render only section processor UI; renderer/node/edge/layer/design controls remain available only in non-workflow manager mode.
- Workflow Manager should derive and display pipeline steps dynamically from `frontmatterMeta.pipeline` (`seq`/`node`/`label`) so Step 1→Step N is source-driven and no step-count hardcoding exists in UI.
- MainPanel must keep one workflow entrypoint keyed as `workflowManager` (Workflow Manager), and Help/Spotlight/Launch navigation must target that key directly without legacy alias/remap paths.
- MainPanel workflow entry should now be keyed and labeled as `workflowManager` (Workflow Manager) with no legacy tab remap path; upstream open events and toolbar/spotlight/help links must target this key directly.
- FloatingPanel `inspector` view must be removed after consolidation; inspector responsibilities should be hosted inside MainPanel Workflow Manager (workflow section processor + inspector section/slot) to avoid duplicate/conflicting edit surfaces.
- Workflow Manager must not keep a separate internal Workflow-vs-Inspector tab switch; inspector content should be embedded in the same workflow manager surface as a unified section block.
- MainPanel must not keep a standalone Graph Fields tab after consolidation; Graph Fields configuration/editing should be embedded inside Workflow Manager and all prior Graph Fields open actions should target `workflowManager`.
- Graph Fields must not duplicate MainPanel Settings workspace/json controls; `Workspace editor view`, `Open Workspace View: Multi-dimensional Table`, `Select panel position`, `JSON import target`, `JSON markdown mode`, and JSON table row/column limits should be configured only from MainPanel Settings SSOT.
- Graph Fields icon legend ownership belongs to MainPanel Help → Icon Library; Workflow Manager Graph Fields should not render a separate legend header copy.
- Workflow Manager should consolidate workflow-mode rendering into existing Graph Fields panes (`Global/Base/Derived Fields` left + `Field Settings` right) and remove dedicated workflow utility/edit surfaces (`Workflow Sections`, `Steps`, `tierB/runtime/pipeline/mermaid/flow`, quick-editor/samples/inspector blocks).
- Workflow Manager must keep Graph Fields in a single top-panel composition; remove stacked top/bottom manager panel splits and render only Graph Fields panes or Multi-dimensional Table in one upstream surface.
- Workflow Manager should reuse workspace preference SSOT for table composition: when `workspaceEditorMode` is `multiDimTable`, render Multi-dimensional Table (`GraphTableWorkspace`) in the manager content surface instead of a parallel local table-mode implementation.
- FloatingPanel should not maintain a separate Layer Mode view after consolidation; Layer Mode (including `Switch to Design renderer to view layers.` inactive guidance) must be rendered inside Workflow Manager as the upstream owner surface.
- Workflow Manager may keep legacy workflow labels as click aliases only; clicking those entries must route to embedded Graph Fields selection and open the existing right-pane `Field Settings` instead of restoring separate workflow-specific panels.
- Markdown fenced GeoJSON that becomes GraphData should reuse the same geospatial auto-enable contract as file-based geo imports so ingest→parse→render behavior stays identical.
- The computing-flow markdown sample is the canonical ingest→parse→render fixture; it must validate frontmatter-flow display derivation, embedded GeoJSON extraction, geospatial auto-enable parity, and Block-layout 3D mode.
- Cross-repo pipeline docs may shard oversized markdown into companion files at stable section boundaries, but must keep the original filename as the sub-600 canonical index with explicit continuation links so sync-map references stay stable.
- Registry auto-apply from GraphData metadata during store commit:
  - [graphDataSlice.ts](../../canvas/src/hooks/store/graphDataSlice.ts)
  - [graphDataSliceUtils.ts](../../canvas/src/hooks/store/graphDataSliceUtils.ts)

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

- [FlowEditorCanvas.tsx](../../canvas/src/components/FlowEditorCanvas.tsx)
- [NodeOverlayEditor.tsx](../../canvas/src/components/FlowEditor/NodeOverlayEditor.tsx)

---

## Non-Hardcoding Rules

- Treat the demo file as a fixture only; do not special-case its node ids, labels, or content.
- All UI behavior (fields, ports, connected values, edge bindings) must be driven by:
  - GraphData
  - registry entries (bundle or GraphData metadata)
  - schema-config toggles
