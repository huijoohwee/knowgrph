# Knowgrph Canvas Document

## Agentic GraphRAG/Knowledge Graph Pipeline Guidelines

Canonical guidelines: `knowgrph/docs/documents/knowgrph-pipeline-document.md` and `huijoohwee.github.io/schema/AgenticRAG/README.md`.

Export HTML Canvas specifics: `knowgrph/docs/documents/knowgrph-html-canvas-export-document.md`.

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
| Aspect Ratio | Prevent inconsistent fit behavior across viewports | - [ ] Fit via `schema.layout.fitTargetAspectRatio` (default: use container aspect ratio); forbid hardcoded viewport assumptions |
| Centering | Keep zoom and fit stable across intents | - [ ] Center by centroid for all zoom/fit intents; forbid skew from bounding box bias |
| Clusters | Avoid distortion from distant outliers | - [ ] Filter outliers when fitting (`schema.layout.fitDetectClusters`); forbid distortion from distant nodes |
| Cross-mode Cache | Prevent layout drift when switching modes | - [ ] Key layout caches by `semanticMode + frontmatterMode + layoutMode + renderMode + renderVariant + layoutVariant + viewKey + mediaPanelDensity + renderMediaAsNodes`; apply presentation updates without changing cache keys; forbid cross-mode contamination |
| Documentation | Keep behavior discoverable and auditable | - [ ] Keep schema options discoverable; forbid undocumented behaviors or hidden defaults |
| Fit Frame | Prevent over-zoom on large viewports | - [ ] Compute fit scale based on actual viewport dimensions; forbid 4k/ultrawide over-zoom via max scale caps |
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

## Renderer Modes (D3 / GitGraph / Flow / 3D / Geospatial)

### Mode Model (SSOT)

- **Canvas render mode**: `canvasRenderMode` selects the primary graph renderer surface:
  - `2d` (graph)
  - `3d` (graph)
- **2D renderer**: `canvas2dRenderer` selects the active 2D implementation:
  - `d3` (`GraphCanvas` SVG/D3 renderer)
  - `gitGraph` (`MermaidGitGraphCanvas` Mermaid GitGraph SVG renderer)
  - `flow` (`FlowCanvas` native Canvas2D renderer)
  - `design` (`DesignCanvas` 2D design surface)
  - `flowEditor` (`FlowEditorCanvas` 2D workflow editor surface)
- **Geospatial Mode**: hosted by `gympgrph` and treated as a mutually exclusive overlay mode.

### Exclusivity Rules (Non-Negotiable)

- Only one renderer surface is active at a time (2D: D3/GitGraph/Flow/Design/Flow Editor, 3D, Geospatial).
- The host may warm-mount inactive surfaces to reduce switch lag, but inactive surfaces must be effect-gated (no draw loops, no request consumption, no shared-cache writes).
- Only the active renderer may consume shared requests (e.g. `zoomRequest`) and own interactive listeners.
- Switching modes must preserve selection and avoid cross-mode cache contamination by keying layout/zoom caches with mode + renderer.

---

## Workspace View Modes (Canvas vs Editor)

### Mode Model

- **Canvas mode** is the default full-screen graph workspace with the Toolbar, the quick-review bottom surface, and the optional right floating panel.
- **Editor mode** is a VS Code-like embedded workspace that reuses the existing Markdown Workspace SSOT (files + editor/viewer/split/presentation + import + apply-to-graph) and shares the same Canvas pane.
- **Graph Data Table mode** is a table-first workspace for Nodes/Edges inspection that also shares the same Canvas pane.

- The right FloatingPanel shell is a single FloatingPanel primitive (semantic complementary shell via `FloatingPanel semantic shell`) and must not be re-implemented with ad-hoc containers.
- Only the active FloatingPanel tab is mounted; inactive tabs must not render hidden panels to avoid background work and cross-mode interference.
- FloatingPanel tabs header must use semantic navigation elements (`<header>` + `<nav>`/`<menu>`), not generic wrappers.
- MainPanel tab behavior must come from one metadata path for tab labels, searchable tabs, search placeholders, and footer copy; headers, search rows, footers, and key/value rows must wrap responsively on narrow widths instead of overlapping, and Settings lazy-load helpers must not depend on toolbar-owned init chunks.
- FloatingPanel shell behavior must come from one metadata path for view buttons, shared header status chips, full-height body views, and renderer-only header actions; cap shell width to the viewport, let header/status rows wrap, and keep inactive views unmounted.
- FloatingPanel Chat response and persistence contract: enforce markdown-syntax-guidelines-aligned output (variables/sigils/tables/flow blocks). Standard chat responses may include one optional `response:` YAML metadata block for Flow Editor (2D) + Multi-dimensional Table + Kanban follow-up parameterization, while `chatKnowgrph` accepts the structured KGC contract or a literal MCP result whose `structuredContent` already extracts to renderable Widgets, Rich Media Panels, Cards, Text/Image/Audio/Video media, safe inline compute, and handle-bearing edges. `useFloatingPanelChatSubmit` stays a thin shell for request guards and optimistic state, and the async submit lifecycle remains owned by `floatingPanelChatSubmitCoordinator.ts` plus the existing request, transport, streaming, validation, and recovery helpers. Commit one final chat bubble: concise bullets (≤50 words) plus a workspace link to the current canonical workspace document under `chatLocalStorageRootPath`, using the session-folder contract `/chat-log/YYYYMMDDTHHmmssZ/kgc_YYYYMMDDTHHmmssZ.md` (no per-message files). In `chatKnowgrph` mode, `New Chat` must create/open a fresh session folder plus canonical `kgc_*.md` and route the next turn to that file. For `chatKnowgrph`, saved KGC remains one standalone frontmatter-first parser-valid computing-flow-compatible document for direct ingest/render, while renderable literal MCP structured surfaces finalize without KGC retry or synthetic KGC text and then project through the same Editor Workspace -> Source Files -> frontmatter-flow -> Canvas path. Streaming keeps the canonical document parseable via deterministic fallback and upstream recovery while preserving the substantive answer content inside the canonical KGC document.

### Canvas Interaction Panel (Floating)

- In Canvas mode, interaction + arrangement actions are consolidated into a single **Interaction** tab inside the Floating Panel (adjacent to the **Props** view in the header). Toolbar shortcuts (3D toggle, Canvas Interaction Mode, Workspace Sync Mode) are thin views over the same SSOT settings used by this panel and by the Settings view.
- The Interaction tab hosts:
  - **Viewport**: read-only Viewport status and SSOT field groups (Readout, Transform, Zoom Modes, Wheel, Speeds, Flow) derived from the active 2D renderer state, schema zoom settings, and canvas interaction settings (including Canvas Interaction Mode).
  - **Interaction**: pointer mode (Pan vs Select/Drag) and layout selector (Force/Radial) that writes `schema.layout.mode`.
  - **Centering / Centroid**: Center on Selection and Center on All Items.
  - **Even Spread**: Distribute Horizontally/Vertically with a 3+ node guard and selection count helper text.
  - **Performance**: opt-in perf overlay toggle plus read-only perf metrics (render updates/sec, state updates/sec, last layout init).
  - **Interaction Modes**:
    - **Canvas Interaction Mode**: `infiniteCanvasInteractionMode∈{static,interactive}` controls how aggressively the infinite canvas applies force-directed layout and overlay interactivity:
      - `static` (default) runs D3 force layout to a bounded stable state and then freezes simulation; rich media and markdown overlays forward wheel/pan to the canvas so drag/pan/zoom stay primary; Graph Data Table and GraphTableDb treat position-only updates as non-syncing metadata (no background churn).
      - `interactive` keeps D3 forces running continuously and enables full overlay interactivity (iframes/images/videos/markdown blocks accept wheel/pointer events and do not forward to canvas) while preserving the same SSOT GraphData and layout keys.
    - **Workspace Sync Mode**: `canvasWorkspaceSyncMode∈{manual,realtime}` controls when Canvas↔Graph Table syncing happens:
      - `manual` (default) disables automatic GraphTableDb sync from Canvas and surfaces a single **Sync now** action in the Graph Table toolbar; Canvas edits only sync to tables on explicit user actions.
      - `realtime` enables automatic sync, still gated by revision+viewKey to avoid loops: in static mode the sync key is `graphContentRevision` (structure-only), in interactive mode it is `graphDataRevision` (including position-only changes).
- Viewport field groups are read-only views over the existing settings and schema; mutating the underlying behavior remains the responsibility of the Render and Settings panels.
- Forbid duplicate/legacy “Arrange” surfaces (canvas overlays or editor tabs) that reintroduce conflicting gesture ownership, parallel Interaction UIs, or duplicate actions.

### Preview Contract (SSOT)

- **Editor/Table split view**: the Canvas is mounted once (single `CanvasViewport`) and resized into the right-side Canvas pane. The Editor workspace and Graph Data Table must not mount a second “Canvas Preview” instance.
- **Embedded preview mode (external embed)**: if an `iframe` is used for embedding outside the workspace (marked with `data-kg-preview="1"` or `?kgPreview=1`), preview-only rendering must apply (no Toolbar, no bottom surface, no floating panels) so it cannot recursively enter Editor mode and cannot consume unnecessary UI resources.
- For embedded preview mode, the host may sync preview state via same-origin messaging (`kind: 'kg-preview-sync'` for graph/schema/render/selection) and via persisted geospatial state (`kg:ui:geospatial:overlayEnabled` via `storage` events).
- Preview sync handlers must ignore identical schema/graph payloads (hash/signature compare) to prevent rerender loops and React update-depth errors.
- Preview sync graph hashing must ignore store-injected `metadata.graphDataRevision` and `metadata.hash` fields so preview ↔ host echoes do not trigger infinite sync loops.

- A small non-interactive viewport readout overlay may be shown in Canvas mode for debugging drift (zoom % and viewport center). If shown, it must remain single-surface and must not trigger per-frame React rerenders.

### Rich Media Rendering (2D/3D, Viewer, Export)

- **Rich Media nodes** are neutral graph nodes whose properties resolve to URL-like media (image, svg, video, iframe) via shared `getNodeMediaSpec` heuristics; the same detection is reused across 2D (D3/Flow/Design), 3D, and Markdown Viewer surfaces.
- **Overlay pool**: Rich Media rendering uses a bounded DOM overlay pool per canvas. Overlays are mounted once, keyed by node id, and scheduled via a shared RAF-coalesced scheduler so drag/pan/zoom/3D motion do not cause per-frame React rerenders or repeated layout computation.
- **2D D3**: media panels render in a dedicated DOM overlay layer positioned over the SVG via zoom transform + layout-derived node centers. Scheduling is idempotent and tolerant of transient NaN/undefined positions; once positioned, overlays do not hide offscreen on bad frames and do not clamp to viewport borders during workspace pane resizes.
- **3D**: media panels render in a DOM overlay layer driven by the 3D camera and synchronized every render frame via `useFrame`. Overlay distance, pool size, and density (base width, min/max px) are schema/settings-driven; panels are sorted by depth and clamped by a bounded visibility budget to avoid unbounded DOM growth.
- **Viewer + Script/Imgs/Fid**: Script/Imgs/Fid defaults are auto and driven by the same rich-media + iframe heuristics used by Markdown Viewer and Canvas; per-doc frontmatter (`kgWebpageScriptPolicy`, `kgWebpageIncludeImages`, `kgWebpageFidelityLevel`) is optional and treated as an escape hatch only.
- **Export HTML Canvas (2D/3D)**: Canvas HTML export reuses the same Rich Media overlays and layout SSOT. 2D exports prefer centered SVG markup; PNG fallbacks are captured via a pixelRatio-aware snapshot API (hi-DPI, bounded to a safe max) and embedded as `<img>` in the export HTML. 3D exports embed a GLB + module script plus an immediate hi-DPI PNG snapshot that displays while Three.js initializes, then hides after the first successful render.
  - Export must rewrite local proxy URLs inside SVG and overlays for standalone fidelity: unwrap `/__fetch_remote?url=...`, `/__webpage_proxy?url=...`, and `/__webpage_asset_path/...` to absolute URLs; inline `/__codebase_file?path=...` and `/__codebase_asset?path=...` assets into `data:*;base64,...` up to a bounded max per asset.
- **Single-surface invariant**: at most one Rich Media overlay surface per canvas is allowed (2D overlay layer or 3D overlay layer); Editor/Table split and embedded preview must reuse the same canvas overlay layer and must not mount second “preview-only” Rich Media surfaces.
  - Exported HTML Canvas viewer uses a full-viewport canvas (100vw×100vh) with the same pan/zoom semantics as Canvas mode and a compact HUD exposing 2D↔3D, Rich, Media, and Frontmatter toggles. These toggles are strictly view-only and may only gate renderer/overlay/media interaction, not GraphData or layout derivation.

#### How to use HTML Canvas export (end-user)

- In Canvas mode, open the toolbar Export menu and choose **HTML Canvas**.
- Pick **Scope** (Current viewport or Fit to content), background (transparent or solid), and pixel ratio, then download the HTML file.
- Open the downloaded HTML in a browser and use pan/zoom and HUD toggles (2D/3D, Rich, Media, Frontmatter) just like in Canvas.
- Prefer 2D exports for static graph snapshots and flow diagrams; prefer 3D exports when depth, overlap, or camera motion is important for understanding the graph.

### Editor Workspace Sections (Markdown vs Graph Data Table)

- The Editor workspace reuses the **Markdown Workspace** as the SSOT for document text (Explorer + Editor/Viewer/Split/Presentation/Slides).
- Import Folder in Markdown Workspace must be lazy: create file/folder entries and pending stubs without reading contents; clicking a file triggers indexing/loading/parsing/rendering (including on-demand PDF conversion) and shows an `Indexing` progress pill using the shared `label • n/n • kb/kb` formatting.
- Switching files and switching webpage view modes must not toggle `frontmatterModeEnabled` or trigger graph/layout/zoom recomputation; view switches are strictly Viewer/Presentation/Slides-only and must not apply-to-graph.
- Workspace file CRUD (create/edit/delete/clear) must sync to the Source Files list (with stable IDs keyed by `workspace:<path>`); file open should reuse cached `parsedGraphData` from Source Files when the text hash matches.
- Markdown Workspace layout controls (Explorer open/closed, Canvas pane open/closed, Editor/Viewer/Split/Presentation) are UI-only state; toggling them must not rewrite graph state or invalidate layout/zoom caches.
- In Viewer and Split modes, the rendered Markdown article content width must remain a stable 80% of the Viewer `section` width even when the Canvas pane or Explorer is toggled.
- `Save As...` in the Markdown header may export Markdown/JSON/JSON-LD and must support PDF export via a print pipeline that does not rely on pop-up windows.
- GeoJSON/JSON files that contain geodata must render as a normal graph by converting geodata into nodes with `properties.geo.{lat,lng}` (supporting FeatureCollection and record arrays), so both Canvas and Geospatial Mode can display the dataset.
- Editor mode must not mount any separate Selection/Record Inspector dock (forbid extra inspector `<header>/<section>` surfaces in Editor mode).
- If a Graph Table section exists, it is treated as an optional tool surface; it must not introduce a second inspector dock outside the table workspace.

### Multi-dimensional Table / Graph Data Table (Editor Workspace) Contract

- Document Mode “Multi-dimensional Table Mode” controls only canvas `multiDimTableModeEnabled` for graph layout; it must not open or configure the Graph Data Table workspace, and must stay renderer/layout scoped rather than acting as a second entry-point into Workspace Editor table views.
- The Graph Data Table inside Editor mode (the **Workspace: Multi-dimensional Table** workspace) is **not** the extracted `singabldr` Graph Data Table surface; it is a host-owned workspace tool backed by the minimal persisted `GraphTableDb` cache (`kg:graph-table`) over JSON `GraphData`.
- The table surface must remain self-contained and drift-resistant:
  - Rendering uses a canvas-based fast grid with an overflow scroll viewport (single scroll owner).
  - View shaping is toolbar-driven (Fields/Filter/Group/Sort/Row height) and persisted via namespaced LS keys (`kg:ui:graphTable:*`).
  - Column resizing is pointer-drag based and must not reflow the app (only recompute layout for the grid).
  - Scrolling correctness is mandatory: native vertical/horizontal scroll must work for large datasets and must not induce scroll/resize feedback loops.
  - Visual correctness is mandatory: pinned header band and pinned columns must be fully opaque and must not show scrolled text underneath.
-  - Sync semantics are controlled by Workspace Sync Mode and the `(revision, collapsedGroupIdsKey, viewKey)` sync key:
    - In **Manual** mode, auto sync is disabled; the Graph Table header exposes a single **Sync now** button that runs a bounded GraphData→GraphTableDb sync using the derived view graph (including collapsed groups) and revision gating.
    - In **Real-time** mode, the same sync pipeline is invoked automatically when the relevant graph revision changes; sync gates must ignore no-op writes and must key by viewKey to avoid cross-view churn.
- Split/Inspector:
  - The table grid and the Record Inspector are split by a draggable vertical `<hr>`; inspector open state and width persist via `LS_KEYS.graphTableInspectorOpen` and `LS_KEYS.graphTableInspectorWidthPx`.

### Record Inspector (SSOT)

- The Record Inspector UI is a host-owned SSOT component (`GraphTableInspector`) and must be reused across Canvas mode (Floating Panel) and Graph Table workspaces.
- Editor mode must not mount a standalone inspector dock; inspector surfaces belong to Canvas mode (Floating Panel) or Graph Table workspaces only.
- When the active 2D renderer is `flowEditor`, the Flow Editor Inspector is consolidated into the same Floating Panel "Inspector" surface via a portal slot id (`FLOW_EDITOR_INSPECTOR_PORTAL_SLOT_ID`) to avoid duplicate inspector panels.
- The Inspector view must render its layout even with no active selection so the Floating Panel always shows stable structure; inputs may be disabled but the surface must stay visible.
- Editing a field in the inspector updates the persisted Graph Table cache first, then applies a bounded write-through to the graph store to keep `graphDataRevision` and derived render views consistent.

### Flow Editor Widget Live Sync (Canvas ↔ Editor Workspace ↔ Graph Data Table)

- Flow Editor widget open state is stored in the shared graph view state (`openWidgetNodeIds`) and must not be local to a single renderer.
- Flow Editor canvas and Graph Table Inspector must consult the same open list to render widget panels for node rows.
- Editor Workspace must surface Flow Editor widgets **as codes** inside the Markdown editor/viewer (JSON/Markdown), not as a second widget panel.
- Switching workspace view modes must preserve the open list unless the underlying nodes are removed from `GraphData`.
- In Flow Editor, pinned widgets adjust anchor offsets on header drag; dragging a pinned widget moves all pinned overlays together, while unpinned overlays drag freely and clamp in the viewport.
- NodeOverlayEditor is decomposed into focused modules: `NodeOverlayEditorInner` (orchestrator), `NodeOverlayEditorView` (pure view), `nodeOverlayEditorShared` (types/constants), `useNodeOverlayPlacementRuntime` (position/scale), `useNodeOverlayDragHandlers` (pointer drag), `useNodeOverlayRichMediaToolbar` (rich-media toolbar). See `knowgrph-flow-editor-widget-document.md`.
- Flow Editor overlay collision resolution is scheduled on overlay set changes and quantized zoom changes (not every interaction tick). See `knowgrph-flow-editor-pan-zoom-overlay-failsafe-document.md`.
- Graph data commits preserve overlay-carryover state: when a commit modifies graph data, overlay-managed node positions and connected edges are carried over to the new revision so pinned overlays do not drift.
- Widget world positions are stored per graph meta key (`flowWidgetWorldPosByNodeIdByGraphMetaKey`) so positions persist correctly when switching between frontmatter-flow graphs; transient placement authorities are reset on workspace reopen.
- Frontmatter-flow auto-managed widgets (text/image/video generation, rich media panel, video transcriber) use a centralized placement authority (`widgetPlacementAuthority.ts`) that decides auto-placement, pinned-in-canvas defaults, screen-space authority for floating widgets, and balanced collective layout preservation.

### Selection Sync (Table ↔ Preview ↔ TOC)

- Table → Preview: selecting a row sets `selectionSource='table'`; the preview auto-zooms to the corresponding node/edge.
- Preview → Table: the preview posts selection changes (same-origin) and the host updates table focus without inducing scroll-jump.
- Table → TOC: when a node row provides a stable TOC id (e.g. `anchorId` or `anchor`), the host requests TOC focus so the Explorer scrolls to and highlights the matching heading.

---

## Repository Architecture

**Module Hierarchy**: schema defaults/types → layout engines (force/radial/block/Mermaid) → collision + overlap resolution → fit + zoom controller → renderer layers (nodes/links/groups)

**Dependency Flow**: schema/config readers → positioning/caching → simulation/constraints → scene composition → zoom state persistence

### High-Level Components

- Graph canvas host:
  - `canvas/src/components/GraphCanvas/*` orchestrates layout, zoom, scene layers, and caching.
- Layout engines:
  - `canvas/src/components/GraphCanvas/layout/*` implements force/radial/block layout pipelines, Mermaid-owned layout handoff, and shared helpers.
- Overlap resolution:
  - `canvas/src/components/GraphCanvas/layout/{overlap.ts,groupOverlap.ts,relax.ts}` centralize bbox collision and bounded relaxation.
- Fit and zoom:
  - `canvas/src/components/GraphCanvas/{fit.ts,zoom.ts,zoomState.ts,zoomController.ts}` centralize zoom policies and per-view caching.
  - Collective fit+center must be display-consistent across 2D renderers: fit uses display-derived graph bounds (post filters/collapse), includes node dimensions (`visual:width/height` when present) and group envelopes (clusters/subgraphs/layers), and centers the visible graph in the viewport.
- Shared presets:
  - `grph-shared/src/zoom/presets.ts` provides reusable fit/zoom presets reused by fit logic and simulation/layout seeding.

---

## Module Specification

### Module: `GraphCanvas` fit + zoom policy

**Goal**: provide stable Fit-to-Screen/Fit-to-Selection behavior across view toggles and layout modes.

| Context | Intent | Directive | Module | Function/Method | Input | Output | Decision Logic |
|---|---|---|---|---|---|---|---|
| Fit mapping | Keep fit consistent across viewports | - [ ] Fit on actual viewport dimensions with `targetFillRatio = 0.8`; forbid viewport-dependent over-zoom | GraphCanvas | fitAllTransform | viewport, schema | transform | Use container aspect-ratio then scale by fill ratio |
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
| Fixture neutrality | Avoid local absolute paths | - [ ] Forbid hardcoded sibling-checkout fixture paths in code/tests | policy | testForbidHardcodedExternalFixturePaths | source scan | CI guard | Use explicit env-provided fixtures or repo-local `data/test-data` fixtures |

### Module: collision + overlap SSOT

**Goal**: ensure no node/group overlap and keep collision knobs schema-driven.

| Context | Intent | Directive | Module | Function/Method | Input | Output | Decision Logic |
|---|---|---|---|---|---|---|---|
| Collision config | Centralize tunables | - [x] Read bbox collision settings from schema; forbid ad-hoc constants | layout | readCollisionConfig | schema.layout | config | Single config reader used by all modes |
| Group overlap | Prevent group bbox intersections | - [x] Enforce group bbox collision whenever groups enabled; forbid disabling via legacy knobs | layout | createGroupBboxCollideForce | schema.layout.groups | force | Group membership derived from rendered group key |
| Nested containment | Prevent child inner border touching parent outer envelope | - [x] Use indexed borders (x1..x5 vs x2..x4) with axis-aware nested touch-epsilon; gate Z by explicit depth | layout | createGroupBboxCollideForceByDepth | schema.layout.groups | stable nested spacing | Parent outer uses gap; child inner uses half extents |
