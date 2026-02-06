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
| Cross-mode Cache | Prevent layout drift when switching modes | - [ ] Key layout caches by `semanticMode + frontmatterMode + layoutMode + renderMode + renderVariant + layoutVariant + viewKey (+ presentation toggles) + mediaPanelDensity + renderMediaAsNodes`; forbid cross-mode contamination |
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
| Zoom State | Prevent stale transforms across view toggles | - [ ] Cache zoom state by viewKey across mode/layout/presentation toggles; forbid stale transforms when switching layers/modes/labels/groups |
| Renderer Exclusivity | Prevent inactive/off mode interference | - [ ] Mount exactly one active renderer/mode at a time (D3 / Flow / 3D / Geospatial); forbid inactive/off layers from rendering, consuming requests, or recalculating in the background |

---

## Renderer Modes (D3 / Flow / 3D / Geospatial)

### Mode Model (SSOT)

- **Canvas render mode**: `canvasRenderMode` selects the primary graph renderer surface:
  - `2d` (graph)
  - `3d` (graph)
- **2D renderer**: `canvas2dRenderer` selects the active 2D implementation:
  - `d3` (`GraphCanvas` SVG/D3 renderer)
  - `flow` (`FlowCanvas` native Canvas2D renderer)
- **Geospatial Mode**: hosted by `gympgrph` and treated as a mutually exclusive overlay mode.

### Exclusivity Rules (Non-Negotiable)

- When **Geospatial Mode is enabled**, the host forbids graph rendering by unmounting D3/Flow/3D canvases (no hidden background work).
- When **Flow is active**, D3 is not mounted; when **D3 is active**, Flow is not mounted.
- Only the active renderer may consume shared requests (e.g. `zoomRequest`) and run expensive effects.
- Switching modes must preserve selection and avoid cross-mode cache contamination by keying layout/zoom caches with mode + renderer.

---

## Workspace View Modes (Canvas vs Editor)

### Mode Model

- **Canvas mode** is the default full-screen graph workspace with Toolbar, BottomPanel, and the optional right side panel.
- **Editor mode** is a VS Code-like embedded workspace that reuses the existing Markdown Workspace SSOT (files + editor/viewer/split/presentation + import + apply-to-graph) and shows a Canvas preview.

- The right SidePanel shell is a single FloatingPanel primitive (`<div role="complementary">` via `FloatingPanel as="div"`) and must not be re-implemented with ad-hoc containers.
- Only the active SidePanel tab is mounted; inactive tabs must not render hidden panels to avoid background work and cross-mode interference.
- SidePanel tabs header must use semantic navigation elements (`<header>` + `<nav>`/`<menu>`), not generic wrappers.

### Preview Contract (SSOT)

- Editor mode previews the Canvas using an embedded `iframe` marked with `data-kg-preview="1"` (the host may also use `?kgPreview=1`).
- Preview mode must force preview-only rendering (no Toolbar, no BottomPanel, no side panels) so the preview cannot recursively enter Editor mode and cannot consume unnecessary UI resources.
- The host syncs preview state via same-origin messaging (`kind: 'kg-preview-sync'` for graph/schema/render/selection) and via persisted geospatial state (`kg:ui:geospatial:overlayEnabled` via `storage` events) so the preview reflects the active mode.
- The host must avoid rendering graph canvases in the background when the active view mode is Editor (mount only what is visible).

### Editor Workspace Sections (Markdown vs Graph Data Table)

- The Editor workspace left pane is a **workspace section switcher**:
  - **Markdown Workspace** (Editor/Viewer/Split/Presentation/Slides) remains the SSOT for document text.
  - **Graph Data Table** is an embedded, lightweight table inspector for the active `GraphData`.
- Section selection is persisted by the host under `LS_KEYS.workspaceEditorSection` so returning to Editor mode restores the last workspace section.

### Graph Data Table (Editor Workspace) Contract

- The Graph Data Table inside Editor mode is **not** the extracted `curagrph` Graph Data Table surface; it is a host-owned workspace tool.
- The table surface must remain self-contained and drift-resistant:
  - Semantic DOM: `<header>`, `<nav>`, `<form>`, `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th scope="col">`, `<td>`.
  - View shaping is toolbar-driven (Fields/Filter/Group/Sort/Row height) and persisted via namespaced LS keys (`kg:ui:graphTable:*`).
  - Column resizing uses `<colgroup><col style="width:..."/></colgroup>` + a `<button>` resize handle inside each header cell.
- Split/Inspector:
  - The table grid and the Record Inspector are split by a draggable vertical `<hr>`; inspector open state and width persist via `LS_KEYS.graphTableInspectorOpen` and `LS_KEYS.graphTableInspectorWidthPx`.

### Record Inspector (SSOT)

- The Record Inspector UI is a host-owned SSOT component (`GraphTableInspector`) and must be reused across surfaces.
- Canvas mode mounts the Record Inspector inside the **Floating Panel** (tool menu) as the "Inspector" view, rather than maintaining a separate legacy right SidePanel.
- When the active 2D renderer is `flowEditor`, the Flow Editor Inspector is consolidated into the same Floating Panel "Inspector" surface via a portal slot id (`FLOW_EDITOR_INSPECTOR_PORTAL_SLOT_ID`) to avoid duplicate inspector panels.
- The Inspector view must render its layout even with no active selection so the Floating Panel always shows stable structure; inputs may be disabled but the surface must stay visible.
- Editing a field in the inspector updates RxDB first, then applies a bounded write-through to the graph store to keep `graphDataRevision` and derived render views consistent.

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
