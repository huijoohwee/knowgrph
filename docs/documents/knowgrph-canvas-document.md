# Knowgrph Canvas Document

## Agentic GraphRAG/Knowledge Graph Pipeline Guidelines

Canonical guidelines: [knowgrph-pipeline-document.md](file:///Users/huijoohwee/Documents/GitHub/knowgrph/docs/documents/knowgrph-pipeline-document.md) and [AgenticRAG README.md](file:///Users/huijoohwee/Documents/GitHub/huijoohwee.github.io/schema/AgenticRAG/README.md).

## Design Mantras

```
- [ ] Configuration; externalize behavior via schema; forbid embedded constants
- [ ] Determinism; cache by viewKey and layout key; forbid cross-mode contamination
- [ ] Fit; apply aspect ratio and fill policies; forbid viewport-specific assumptions
- [ ] Locality; keep layout logic modular; forbid sprawling responsibilities
- [ ] Neutrality; operate on any graph; forbid dataset-tied behavior
- [x] Non-Overlap; enforce node and group bbox collision; forbid visual intersections
- [ ] Observability; keep options discoverable; forbid undocumented defaults
```

---

## Universal Design Principles

| Context | Intent | Directive |
|---|---|---|
| Anti-Line Force | Break long linear concentrations | - [ ] Apply perpendicular jitter to linear clusters; forbid long unbalanced concentrations |
| Aspect Ratio | Prevent inconsistent fit behavior across viewports | - [ ] Fit via `schema.layout.fitTargetAspectRatio` (default 16:9); forbid hardcoded viewport assumptions |
| Centering | Keep zoom and fit stable across intents | - [ ] Center by centroid for all zoom/fit intents; forbid skew from bounding box bias |
| Clusters | Avoid distortion from distant outliers | - [ ] Filter outliers when fitting (`schema.layout.fitDetectClusters`); forbid distortion from distant nodes |
| Cross-mode Cache | Prevent layout drift when switching modes | - [ ] Key layout caches by `semanticMode + frontmatterMode + layoutMode + renderMode + renderVariant + layoutVariant + viewKey + mediaPanelDensity + renderMediaAsNodes`; apply presentation updates without changing cache keys; forbid cross-mode contamination |
| Documentation | Keep behavior discoverable and auditable | - [ ] Keep schema options discoverable; forbid undocumented behaviors or hidden defaults |
| Fit Frame | Prevent over-zoom on large viewports | - [ ] Compute fit scale on capped `1920×1080` (16:9) frame; forbid 4k/ultrawide over-zoom |
| Fit-to-Screen | Keep fit consistent with UI chrome changes | - [ ] Enforce 80/20 fill ratio via `targetFillRatio = 0.8`; forbid inconsistent viewport fill |
| Integration | Keep parsing, schema, and rendering aligned | - [ ] Use schema-driven fit and Mermaid layout paths; forbid bypass of configuration flow |
| Keyword Mode | Make text-derived graph views tunable and portable | - [ ] Derive keyword nodes/edges from document text; remove stopwords; map frequency/strength to sizes with schema tunables; preserve overlays; forbid stopword noise and selection-only dashboards |
| Padding | Avoid clipped nodes and labels | - [ ] Apply `fitPadding` and node padding; forbid edge clipping or truncation |
| Port Handles | Keep edge routing explicit and configurable | - [ ] Route 2D edge endpoints via `schema.behavior.portHandles.*`; forbid interference with tree or Mermaid layouts |
| Rectangular Nodes | Keep node sizing stable across layout modes | - [ ] Size via minimap-relative defaults (tree and port handles); forbid drift across layouts |
| Scaling | Keep zoom limits safe and predictable | - [ ] Clamp zoom scale via `schema.performance.zoom.{minScale,maxScale}`; forbid hardcoded scale extents |
| Schema | Centralize layout and sizing policies | - [ ] Route layout and label sizing through `schema.layout.*`; forbid embedded constants or dataset ties |
| Subgraph Containment | Prevent nodes escaping group bounds | - [x] Clamp member nodes within group bounds; forbid escape or touching borders |
| Verification | Make layout and fit changes regression-resistant | - [ ] Cover fit and layout behaviors via bounded tests; forbid brittle dataset-specific assertions |
| Zoom State | Prevent stale transforms across view toggles | - [ ] Cache zoom state by viewKey across mode/layout toggles; apply presentation updates without changing zoom keys; forbid stale transforms when switching layers/modes/labels/groups |
| Renderer Exclusivity | Prevent inactive/off mode interference | - [ ] Mount exactly one *active* renderer/mode at a time (2D: D3/Flow/Design/Flow Editor, 3D, Geospatial); inactive surfaces may be warm-mounted but must be effect-gated (no draw loops, no request consumption, no shared-cache writes) |

---

## Renderer Modes (D3 / Flow / 3D / Geospatial)

### Mode Model (SSOT)

- **Canvas render mode**: `canvasRenderMode` selects the primary graph renderer surface:
  - `2d` (graph)
  - `3d` (graph)
- **2D renderer**: `canvas2dRenderer` selects the active 2D implementation:
  - `d3` (`GraphCanvas` SVG/D3 renderer)
  - `flow` (`FlowCanvas` native Canvas2D renderer)
  - `design` (`DesignCanvas` 2D design surface)
  - `flowEditor` (`FlowEditorCanvas` 2D workflow editor surface)
- **Geospatial Mode**: hosted by `gympgrph` and treated as a mutually exclusive overlay mode.

### Exclusivity Rules (Non-Negotiable)

- Only one renderer surface is active at a time (2D: D3/Flow/Design/Flow Editor, 3D, Geospatial).
- The host may warm-mount inactive surfaces to reduce switch lag, but inactive surfaces must be effect-gated (no draw loops, no request consumption, no shared-cache writes).
- Only the active renderer may consume shared requests (e.g. `zoomRequest`) and own interactive listeners.
- Switching modes must preserve selection and avoid cross-mode cache contamination by keying layout/zoom caches with mode + renderer.

---

## Workspace View Modes (Canvas vs Editor)

### Mode Model

- **Canvas mode** is the default full-screen graph workspace with Toolbar, BottomPanel, and the optional right side panel.
- **Editor mode** is a VS Code-like embedded workspace that reuses the existing Markdown Workspace SSOT (files + editor/viewer/split/presentation + import + apply-to-graph) and shares the same Canvas pane.
- **Graph Data Table mode** is a table-first workspace for Nodes/Edges inspection that also shares the same Canvas pane.

- The right SidePanel shell is a single FloatingPanel primitive (`<div role="complementary">` via `FloatingPanel as="div"`) and must not be re-implemented with ad-hoc containers.
- Only the active SidePanel tab is mounted; inactive tabs must not render hidden panels to avoid background work and cross-mode interference.
- SidePanel tabs header must use semantic navigation elements (`<header>` + `<nav>`/`<menu>`), not generic wrappers.

### Preview Contract (SSOT)

- **Editor/Table split view**: the Canvas is mounted once (single `CanvasViewport`) and resized into the right-side Canvas pane. The Editor workspace and Graph Data Table must not mount a second “Canvas Preview” instance.
- **Embedded preview mode (external embed)**: if an `iframe` is used for embedding outside the workspace (marked with `data-kg-preview="1"` or `?kgPreview=1`), preview-only rendering must apply (no Toolbar, no BottomPanel, no side panels) so it cannot recursively enter Editor mode and cannot consume unnecessary UI resources.
- For embedded preview mode, the host may sync preview state via same-origin messaging (`kind: 'kg-preview-sync'` for graph/schema/render/selection) and via persisted geospatial state (`kg:ui:geospatial:overlayEnabled` via `storage` events).
- Preview sync handlers must ignore identical schema/graph payloads (hash/signature compare) to prevent rerender loops and React update-depth errors.
- Preview sync graph hashing must ignore store-injected `metadata.graphDataRevision` and `metadata.hash` fields so preview ↔ host echoes do not trigger infinite sync loops.

### Editor Workspace Sections (Markdown vs Graph Data Table)

- The Editor workspace reuses the **Markdown Workspace** as the SSOT for document text (Explorer + Editor/Viewer/Split/Presentation/Slides).
- Import Folder in Markdown Workspace must be lazy: create file/folder entries and pending stubs without reading contents; clicking a file triggers indexing/loading/parsing/rendering (including on-demand PDF conversion) and shows an `Indexing` progress pill using the shared `label • n/n • kb/kb` formatting.
- Switching files and switching webpage view modes must not toggle `frontmatterModeEnabled` or trigger graph/layout/zoom recomputation; view switches are strictly Viewer/Presentation/Slides-only and must not apply-to-graph.
- Workspace file CRUD (create/edit/delete/clear) must sync to the Source Files list (with stable IDs keyed by `workspace:<path>`); file open should reuse cached `parsedGraphData` from Source Files when the text hash matches.
- GeoJSON/JSON files that contain geodata must render as a normal graph by converting geodata into nodes with `properties.geo.{lat,lng}` (supporting FeatureCollection and record arrays), so both Canvas and Geospatial Mode can display the dataset.
- Editor mode must not mount any separate Selection/Record Inspector dock (forbid extra inspector `<header>/<section>` surfaces in Editor mode).
- If a Graph Table section exists, it is treated as an optional tool surface; it must not introduce a second inspector dock outside the table workspace.

### Graph Data Table (Editor Workspace) Contract

- The Graph Data Table inside Editor mode is **not** the extracted `curagrph` Graph Data Table surface; it is a host-owned workspace tool.
- The table surface must remain self-contained and drift-resistant:
  - Rendering uses a canvas-based fast grid with an overflow scroll viewport (single scroll owner).
  - View shaping is toolbar-driven (Fields/Filter/Group/Sort/Row height) and persisted via namespaced LS keys (`kg:ui:graphTable:*`).
  - Column resizing is pointer-drag based and must not reflow the app (only recompute layout for the grid).
  - Scrolling correctness is mandatory: native vertical/horizontal scroll must work for large datasets and must not induce scroll/resize feedback loops.
  - Visual correctness is mandatory: pinned header band and pinned columns must be fully opaque and must not show scrolled text underneath.
- Split/Inspector:
  - The table grid and the Record Inspector are split by a draggable vertical `<hr>`; inspector open state and width persist via `LS_KEYS.graphTableInspectorOpen` and `LS_KEYS.graphTableInspectorWidthPx`.

### Record Inspector (SSOT)

- The Record Inspector UI is a host-owned SSOT component (`GraphTableInspector`) and must be reused across Canvas mode (Floating Panel) and Graph Table workspaces.
- Editor mode must not mount a standalone inspector dock; inspector surfaces belong to Canvas mode (Floating Panel) or Graph Table workspaces only.
- When the active 2D renderer is `flowEditor`, the Flow Editor Inspector is consolidated into the same Floating Panel "Inspector" surface via a portal slot id (`FLOW_EDITOR_INSPECTOR_PORTAL_SLOT_ID`) to avoid duplicate inspector panels.
- The Inspector view must render its layout even with no active selection so the Floating Panel always shows stable structure; inputs may be disabled but the surface must stay visible.
- Editing a field in the inspector updates RxDB first, then applies a bounded write-through to the graph store to keep `graphDataRevision` and derived render views consistent.

### Node Quick Editor Live Sync (Canvas ↔ Editor Workspace ↔ Graph Data Table)

- Node Quick Editor open state is stored in the shared graph view state (`openQuickEditorNodeIds`) and must not be local to a single renderer.
- Flow Editor canvas and Graph Table Inspector must consult the same open list to render quick editor panels for node rows.
- Editor Workspace must surface Node Quick Editor **as codes** inside the Markdown editor/viewer (JSON/Markdown), not as a second quick editor panel.
- Switching workspace view modes must preserve the open list unless the underlying nodes are removed from `GraphData`.
- In Flow Editor, pinned quick editors adjust anchor offsets on header drag; dragging a pinned editor moves all pinned overlays together, while unpinned overlays drag freely and clamp in the viewport.

### Selection Sync (Table ↔ Preview ↔ TOC)

- Table → Preview: selecting a row sets `selectionSource='table'`; the preview auto-zooms to the corresponding node/edge.
- Preview → Table: the preview posts selection changes (same-origin) and the host updates table focus without inducing scroll-jump.
- Table → TOC: when a node row provides a stable TOC id (e.g. `anchorId` or `anchor`), the host requests TOC focus so the Explorer scrolls to and highlights the matching heading.

---

## Repository Architecture

**Module Hierarchy**: schema defaults/types → layout engines (force/radial/stratify/Mermaid) → collision + overlap resolution → fit + zoom controller → renderer layers (nodes/links/groups)  

**Dependency Flow**: schema/config readers → positioning/caching → simulation/constraints → scene composition → zoom state persistence

### High-Level Components

- Graph canvas host:
  - `canvas/src/components/GraphCanvas/*` orchestrates layout, zoom, scene layers, and caching.
- Layout engines:
  - `canvas/src/components/GraphCanvas/layout/*` implements force/radial/stratify layout pipelines and shared helpers.
- Overlap resolution:
  - `canvas/src/components/GraphCanvas/layout/{overlap.ts,groupOverlap.ts,relax.ts}` centralize bbox collision and bounded relaxation.
- Fit and zoom:
  - `canvas/src/components/GraphCanvas/{fit.ts,zoom.ts,zoomState.ts,zoomController.ts}` centralize zoom policies and per-view caching.
- Shared presets:
  - `grph-shared/src/zoom/presets.ts` provides reusable fit/zoom presets (capped 16:9 frame + fill ratio) reused by fit logic and simulation/layout seeding.

---

## Module Specification

### Module: `GraphCanvas` fit + zoom policy

**Goal**: provide stable Fit-to-Screen/Fit-to-Selection behavior across view toggles and layout modes.

| Context | Intent | Directive | Module | Function/Method | Input | Output | Decision Logic |
|---|---|---|---|---|---|---|---|
| Fit mapping | Keep fit consistent across viewports | - [ ] Fit on capped `1920×1080` frame and `targetFillRatio = 0.8`; forbid viewport-dependent over-zoom | GraphCanvas | fitAllTransform | viewport, schema | transform | Use aspect-ratio frame then scale by fill ratio |
| Zoom centering | Prevent drift between fit and user zoom | - [ ] Scale centered on graph centroid; forbid bbox-bias centering | GraphCanvas | scaleCenteredOnGraphCentroidTransform | centroid, scale | transform | Always compute centroid from rendered nodes |
| Zoom state | Avoid stale transforms when switching views | - [ ] Cache zoom state per viewKey; forbid cross-mode reuse | GraphCanvas | setZoomStateForKey | viewKey, zoomState | persisted state | viewKey includes presentation toggles |

### Module: semantic mode isolation (Document ↔ Keyword)

**Goal**: switching semantic modes must not mutate the canonical document schema or reuse stale selection/collapse state.

| Context | Intent | Directive | Module | Function/Method | Input | Output | Decision Logic |
|---|---|---|---|---|---|---|---|
| Semantic mode switch | Prevent schema/layout bleed across modes | - [ ] Restore schema snapshot per semantic mode; clear selection + collapsed groups on switch | store | setDocumentSemanticMode | next mode | schema + cleared view state | Schema snapshots are stored in-memory as `schemaBySemanticMode` |
| Schema persistence | Keep Document Structure Mode as baseline | - [ ] Persist schema writes only in Document mode; keyword-mode tweaks are non-persistent | store | setSchema | schema edits | persisted schema | Gate `writeSchemaToStorage` by `documentSemanticMode==='document'` |

### Module: layering + group separation knobs

**Goal**: keep nested group borders readable and edges visually subordinate, without hardcoded constants.

| Context | Intent | Directive | Module | Function/Method | Input | Output | Decision Logic |
|---|---|---|---|---|---|---|---|
| Nested group spacing | Prevent group-of-groups borders snapping together | - [ ] Apply depth-based padding using `layout.groups.nestedPaddingStep` | GraphCanvas | createGroupsLayer | schema.layout.groups | separated group boxes | Outer groups get more padding than inner groups |
| Edge underlay readability | Keep edges beneath groups/nodes | - [ ] Use schema-driven 2D edge opacity (`layout.edges.opacity`, `layout.edges.opacityUnderGroups`) | GraphCanvas | useGraphCanvasStyles | schema.layout.edges | readable edges | When groups enabled, pick the lower opacity |
| Fixture neutrality | Avoid local absolute paths | - [ ] Forbid hardcoded `/Users/.../GitHub/sandbox/...` paths in code/tests | policy | testForbidHardcodedSandboxAbsolutePaths | source scan | CI guard | Use sandbox-root helpers + basenames or repo-local fixtures |

### Module: collision + overlap SSOT

**Goal**: ensure no node/group overlap and keep collision knobs schema-driven.

| Context | Intent | Directive | Module | Function/Method | Input | Output | Decision Logic |
|---|---|---|---|---|---|---|---|
| Collision config | Centralize tunables | - [x] Read bbox collision settings from schema; forbid ad-hoc constants | layout | readCollisionConfig | schema.layout | config | Single config reader used by all modes |
| Group overlap | Prevent group bbox intersections | - [x] Enforce group bbox collision whenever groups enabled; forbid disabling via legacy knobs | layout | createGroupBboxCollideForce | schema.layout.groups | force | Group membership derived from rendered group key |
| Nested containment | Prevent child inner border touching parent outer envelope | - [x] Use indexed borders (x1..x5 vs x2..x4) with axis-aware nested touch-epsilon; gate Z by explicit depth | layout | createGroupBboxCollideForceByDepth | schema.layout.groups | stable nested spacing | Parent outer uses gap; child inner uses half extents |
