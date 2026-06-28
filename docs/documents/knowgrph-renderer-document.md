# KnowGrph Renderer Specification

## Design Mantras

```
- [ ] Data Flow; keep unidirectional stages; forbid circular store↔render updates
- [ ] Immutability; isolate canonical state; forbid renderer mutating store graph data
- [ ] Memoization; minimize recomputation; forbid re-derivation on unrelated changes
- [ ] Performance; protect frame budget; forbid synchronous heavy work on render
- [ ] Stability; cleanup resources; forbid dangling listeners, timers, and RAF loops
- [ ] Neutrality; remain domain-agnostic; forbid dataset-specific rendering logic
```

---

## Universal Design Principles

| Context      | Intent                         | Directive                                                                 |
|--------------|--------------------------------|---------------------------------------------------------------------------|
| Derivation   | Compute stable render inputs    | - [ ] Depend on minimal config; forbid hidden dependencies                |
| Immutability | Protect canonical graph state   | - [ ] Copy before render; forbid store mutation via shared references     |
| Memoization  | Avoid redundant recomputation   | - [ ] Memoize by layer config; forbid recompute on unrelated schema edits |
| Performance  | Maintain responsiveness         | - [ ] Defer heavy work; forbid blocking operations in hot paths           |
| Cleanup      | Prevent memory leaks            | - [ ] Cleanup timers/listeners/RAF; forbid dangling references            |

---

## Renderer Architecture

**Layer Stack**: Store (Zustand) → Derivation (Memoized) → GraphCanvas (React) → D3 Simulation → SVG/Canvas

**Processing Flow**: `graphData` (Store) → view derivation (`useActiveGraphData` + filters + collapse) → `cloneGraphDataForRender` (Immutability Barrier) → `D3 Force/Layout` → `DOM`

**Design Principles**: Unidirectional Flow | Visual Isolation | Configurable Layouts

Export HTML Canvas specifics: `knowgrph/docs/documents/knowgrph-html-canvas-export-document.md`.

### High-Level Components

- **GraphCanvas**:
  - `canvas/src/components/GraphCanvas.tsx` coordinates the rendering lifecycle.
  - Manages D3 simulation, event listeners, and interaction state.
- **View Derivation**:
  - `canvas/src/hooks/useActiveGraphData.ts` selects Document vs Keyword mode.
  - `canvas/src/lib/graph/layerDerivation.ts` applies frontmatter filtering.
  - `canvas/src/components/GraphCanvas/viewDerivation.ts` collapses groups into derived group-nodes when requested.
  - `canvas/src/components/GraphCanvas/renderClone.ts` clones nodes/edges to prevent D3 from mutating store state.
- **Layout Engine**:
  - `canvas/src/components/GraphCanvas/layout/*.ts` handles positioning (Force, Radial, Tree, Mermaid).
  - Uses `layoutPositionCacheByMode` to persist stable layouts across re-renders.

### Renderer Mode Matrix (2D: D3 Graph/Dashboard/Flowchart/Multi-dimensional Table/GitGraph/Flow Canvas/Animatic/Storyboard/Design/Flow Editor; 3D; Voxel)

- **Shared derivation SSOT**:
  - Graph-derived renderers (2D D3 Graph/Dashboard/Flowchart/Multi-dimensional Table/Flow Canvas/Animatic/Storyboard/Design, 3D, Voxel, Geospatial) consume the same SSOT-derived `graphDataForDisplay`.
  - Derivation order: keyword base → optional frontmatter filter (Document mode only) → optional group collapse. Renderer toggles must not re-derive or fork this pipeline.
  - GitGraph is a diagram-code renderer: it reuses active document/frontmatter Mermaid code authority, the shared Mermaid SVG cache, the shared D3 viewport controller, and the shared FloatingPanel shell for source-file command CRUD, but does not expand GitGraph commands into GraphData topology or mutate the display-graph pipeline.
  - Dashboard is a graph-derived D3 chart surface: it derives KPIs, time-series, bars, and table cards from active `GraphData` plus `GraphSchema`, reuses `readCanvasGridConfigFromSchema`, and does not introduce an alternate chart runtime, file-specific fixtures, or external-demo data.
  - Multi-dimensional Table is a canonical 2D renderer id (`multiDimTable`) that mounts the existing Editor Workspace Viewer data-view surface (`MarkdownWorkspaceDerivedViewer` in `multiDimTable` mode) instead of the D3 renderer surface or GraphTable DB workspace. Selecting it through Canvas View Mode enables `multiDimTableModeEnabled`, clears conflicting Frontmatter mode, and leaves non-table renderer selection through the shared non-table fallback resolver instead of remapping D3/Flowchart as hidden table aliases.
- **Frontmatter Mode On/Off**:
  - Frontmatter Mode **On**: when the active Markdown file defines a Flow frontmatter graph (`nodes`/`connections`/`'kg:subgraphs'`), 2D D3 and Flow treat that graph as the layout SSOT (no hidden per-renderer nodes). Flow Editor uses a frontmatter-only derived view: keyword/table/composed-source derivations are disabled while Flow/Flow Editor frontmatter-only policy is active so other document modes/renderers cannot interfere with Flow Editor graph state.
  - If `flow` block metadata exists, flow-derived nodes/connections are the canonical parser input for renderer surfaces; parser wiring must not merge legacy top-level `edges` into the rendered graph.
-  - Flowchart renderer (canonical id: `flowchart`) consumes the shared Flowchart payload contract from API, fixture, or workspace sources via one normalization path; renderer switches must stay view-only and must not fork source-specific graph semantics.
  - Subgraph/group metadata must stay explicit-only (`kg:subgraphs` and cluster derivation); renderer paths must not rely on synthetic fallback groups such as `frontmatter:all`, tier buckets, or category buckets.
  - Frontmatter Mode **Off**: renderers fall back to the Markdown→JSON‑LD pipeline; the active graph is still `graphDataForDisplay`, and mode switches are view‑only (no store mutations of imported Markdown/JSON‑LD).
- **2D vs 3D renderer parity**:
  - 2D D3 runs force/layout; 2D Dashboard reuses D3 scales/shapes for charts without running D3 forces; 2D Flow Canvas/Animatic/Storyboard/Design reuse the same visibility, collective fit geometry, and zoom behavior without re-running D3 forces.
  - Storyboard and Editor Workspace/Kanban-style renderer surfaces should reuse the same shared toolbar/data-view utility owners for action chrome, hover record creation, and settings registration where semantics overlap; renderer swaps must not fork ad-hoc toolbar config or duplicate viewer utility stacks.
  - 3D reuses 2D layout positions (when present) as a baseline and applies its own camera + depth presentation, but must not introduce a separate derivation pipeline or a different node/edge set.
  - Switching 2D↔3D must preserve selection and view keys (per‑renderer zoom keys are isolated; layout caches are renderer‑variant aware but share the same schema/layout fingerprint).
  - Standard 3D stays available for Block/frontmatter-flow graphs and reuses the same display-graph + layout-cache path as 2D; only Radial auto-demotes to 2D.
- **Voxel Mode (3D Flowchart sub-mode)**:
-  - Voxel Mode is a 3D sub-mode gated to Flowchart (canonical id: `flowchart`) with Block layout; radial layouts do not expose voxel controls. It reuses the same SSOT `graphDataForDisplay` and Flowchart lane layout as its XY baseline.
  - XY positions in Voxel Mode are derived from the active Flowchart seed (layout-position cache or live node positions) without re-running a separate layout pipeline. Voxel cubes sit on the XY ground plane (`z=0`) and must not introduce vertical “Z columns” when parity mode is enabled.
  - Seed selection is keyed by the same layout-position cache key as 2D (`datasetKey + layoutMode + semanticMode + frontmatterMode + viewKey`) so switching between Infinite Canvas variants (Document/Keyword/Frontmatter/Multi-dimensional Table) and 2D/3D/Voxel reuses the same SSOT layout where applicable.
  - Voxel grouping and color should prefer imported metadata first (`visual:layer`, `layer:label`, `layer:color`, `visual:color`) and fall back to hashed cluster styling only when explicit layer metadata is absent; PMF and other structured imports must not need renderer-local color remapping.
  - Voxel entry points must stay unavailable while Geospatial Mode is enabled; standalone 3D/Voxel selectors and shared canvas view actions should route users back toward Document Mode instead of mutating renderer/schema state behind the geospatial surface.
  - Mode switches (2D D3 ↔ 3D ↔ Voxel) are view-only: they must not mutate GraphData, change semantic-mode baselines, or fork a voxel-specific derivation pipeline. Voxel drag interactions update positions in the same coordinate space as Flowchart and keep cubes constrained to the ground plane while preserving lane/group relationships.
- **Animation Mode (2D D3 radial + 3D)**:
  - Toolbar Animation switch (beside Rich Media) is view-only and toggles between Force-directed Graph (default) and Orbit-style nested radial animation. It must not mutate GraphData, schema, or layout caches; it only controls how existing radial layouts are animated.
  - Orbit-style nested radial animation is bounded: driven by `schema.layout.forces.radialOrbit*` knobs, restricted to 2D D3 radial (non-Flowchart) and document/keyword/frontmatter/multi-dimensional table modes, and implemented as a render-frame animator that never restarts D3 simulation or re-derives topology.
  - 3D animation (globe particles, hub orbits, arc travellers, camera ellipse path) reuses the same SSOT GraphData and layout fingerprint as 2D; camera/particle/orbit configs live under `schema.three.*` and must not fork a separate derivation or node/edge set.
- **Rich Media On/Off**:
  - Rich Media detection (image/svg/video/iframe) is shared across Markdown Viewer, 2D/3D Canvas, Design, and Geospatial surfaces via `getNodeMediaSpec` and friends; Script/Imgs/Fid defaults are auto, driven by shared heuristics.
  - Rich Media **Off** hides overlay panels but does not change GraphData; media nodes remain regular nodes in the layout and fit pipelines.
  - Rich Media **On** instantiates a bounded overlay pool per canvas (2D and 3D) and anchors overlays by node id; overlays track node world→screen transforms and can be dragged via headers without breaking node/edge/group connectivity.
- **HTML Canvas export parity**:
  - HTML Viewer/Canvas exports use the same renderer matrix semantics: the exported SVG is rendered from the display‑derived graph (including group envelopes) via GraphCanvas (live or off‑screen), and the exported runtime script instantiates Rich Media overlays from a serialized `mediaNodes` list.
  - Flow‑based HTML Canvas exports do not snapshot the Flow canvas; they re‑render into off‑screen SVG using the same layout/fit rules as GraphCanvas and reuse group membership (`deriveGraphGroups`) so dragging groups or nodes in the export keeps nodes, edges, and overlays interconnected.
  - Repo‑relative Rich Media URLs are resolved through `/__codebase_file?path=...` and `/__codebase_asset?path=...`, and may be inlined as `data:` URLs during export when safe and within size bounds; exports opened via `file://` must still resolve local media using the probed dev/preview origin.

### Edge Types (Global SSOT)

- **Global edge type**:
  - `schema.layout.edges.type∈{bezier,straight,step,smoothstep}` is the renderer‑neutral SSOT for visual edge shapes.
  - Default is `bezier`; Straight/Step/Smoothstep override per‑edge path geometry without changing graph semantics or edge labels.
- Directive: For `frontmatter-flow`, renderer-specific defaults must yield to `metadata.frontmatterFlowSettings.edgeType` and `direction` so Flow and Flow Editor stay visually aligned without separate parsing logic.
- Parsing source (neutral): canonical `frontmatter-flow` graph inputs come from the opening YAML frontmatter `flow:` block; the Markdown body remains a human projection and must not carry a second `flow:` graph, `## KGC Reading Layer`, or line-start `@node:` / `@edge:` mirror. Renderers must not depend on filename heuristics or document-mode state to decide which flow graph to render.
- Parser-routing source (neutral): runtime-ready demos may declare `kgParserRoutingContract` to identify parser logic, routing keys, diagram kinds, surfaces, edge policy, and fork policy. Renderer code consumes the resulting `graphData` and metadata; it must not introduce renderer-local aliases for routing, diagram type, edge semantics, fork state, or publish state.
- Storyboard naming contract: `storyboard` is the only canonical renderer id and user-facing renderer name for storyboard surfaces. Do not introduce shortened, branded, or transitional storyboard aliases in renderer ids, menu labels, generated frontmatter, import presets, tests, or docs.
- Storyboard toolbar contract: Storyboard-specific card actions may compose graph-backed helpers, but the visible toolbar surface, action binding layer, and presentation props must reuse shared Flow Editor / Storyboard utility owners rather than rebuilding inline per-card toolbar branches inside renderer loops.
- Workflow edge rendering: explicit `graphData.edges`, `flow.edges`, `workflow.edges`, Mermaid diagram edges, and Strybldr storyboard edges are source-owned topology. Storyboard and Strybldr surfaces may filter to visible cards, but they must preserve renderable connectors for source-marked workflow edges such as fork, review, runtime, and publish without relabeling them into legacy edge types.
- Animatic renderer contract: `kgCanvas2dRenderer: "animatic"` reuses the same canonical `flow:` frontmatter graph authoring surface as `kgCanvas2dRenderer: "flowEditor"` and may add `timeline.beats.*` timing metadata beside that shared graph contract; runtime beat/timeline mutations must commit through shared graph owners (`updateGraphMetadata` for `frontmatterMeta.timeline.*`, `updateNode` for node `params.beat_ref`) instead of renderer-local markdown string rewrites, and renderer switches and toolbar menu labels must derive from shared renderer helpers instead of duplicated inline renderer tables.
- GitGraph renderer contract: `kgCanvas2dRenderer: "gitGraph"` reuses YAML frontmatter `mermaid: |` as its diagram-code SSOT. It accepts Mermaid `gitGraph` / `gitGraph:` declarations, preserves optional Mermaid config headers, renders through the shared Mermaid SVG cache, adapts the SVG into the shared D3 pan/zoom/fit pipeline with isolated keyed zoom state, and routes create/update/delete command controls through `GitGraphFloatingPanelView` inside the shared FloatingPanel shell. Command edits commit back to the active Markdown/Source Files text. It stays diagram-only so GitGraph branch/commit commands are not parsed as Flowchart `MermaidNode` topology.
- Frontmatter contract split: canonical authored docs and templates keep `flow:` in plain YAML scalars, arrays, and objects, while normalized `{key, type, value}` wrappers stay limited to E2E validation fixtures that audit ingestion -> parsing -> rendering on Canvas. In those fixtures, Flow Editor treats `key` / `portKey` as the semantic handle and treats `handles.source` / `handles.target` only as membership declarations.
- Flow Editor initialization fixtures must keep the explicit Canvas View preset in frontmatter (`kgCanvasSurfaceMode`, `kgCanvasRenderMode`, `kgCanvas2dRenderer`, `kgDocumentSemanticMode`, `kgFrontmatterModeEnabled`, `kgMultiDimTableModeEnabled`, `kgDocumentStructureBaselineLock`) so Source Files switching lands deterministically without stale renderer carryover.
- Animatic runtime owners: renderer id and surface SSOT live in `canvas/src/lib/config.render.ts`, animatic surface mounting lives in `canvas/src/components/CanvasViewport.tsx`, runtime mutation owners live in `canvas/src/components/AnimaticCanvas.tsx` (`updateGraphMetadata` for timeline metadata, `updateNode` for beat-linked node movement), shared frontmatter graph writeback lives in `canvas/src/hooks/store/graph-data-slice/graphDataFrontmatterFlowSync.ts`, low-level `serializeAnimaticTimelineMarkdownWith*` helpers in `canvas/src/components/AnimaticCanvas/animaticTimeline.ts` are serializer utilities for tests/tooling only and not runtime owners, and the mounted validation entry stays `npm run validate:animatic-interactions` -> `canvas/scripts/validate_animatic_timeline_interactions.py`.
- Media renderer video-sequence contract: `kgCanvas2dRenderer: "media"` owns preview playback through `MediaCanvas` and shared `RichMediaPanel`; BottomPanel `Timeline` owns the transport, lane ruler, cut/splice controls, selected-clip nudge/trim/snap/split editing, scopes, audio mix, and Mermaid Gantt writeback; FloatingPanel `Timeline` owns parsed row/list inspection only. Transport/playback state must flow through the shared document transport/controller path, not panel-local store reads. Media preview session assembly also stays upstream: source-backed preview items, the compiled export plan, the selected-row preview-sync plan, and sequence duration should come from one shared preview-session hook. Media preview collection policy also stays upstream: timeline-backed preview items, generic rich-media inventory items, Mermaid exclusion, dedupe keys, and merged ordering should flow through one shared preview-collection hook so Media Canvas and future preview surfaces do not rebuild source-card and cut/splice playback mapping locally. Media preview grouping/model policy also stays upstream: stable family ids, family labels, per-surface visibility, and future monitor/timeline preview ordering should flow through one shared preview-surface model so new surfaces do not invent local grouping heuristics over the same collection. Media preview context also stays upstream: per-surface preview intent, active family selection, and monitor scope generation should flow through one shared preview-context hook so Media Canvas and BottomPanel/FloatingPanel Timeline do not split source-family emphasis from ruler scope semantics. Source activity also stays upstream: active segment resolution, active source equality, playhead-vs-selection precedence, activity mode, and family activity should flow through one shared source-activity model so Media Canvas, preview context, and ruler scopes do not infer active-source semantics independently. Preview activity surfacing also stays upstream: per-family and per-item active/dimmed/playhead/selection emphasis should flow through one shared preview activity-surface model so Media cards and future monitor/timeline preview surfaces do not rebuild highlight policy locally. Preview family compaction also stays upstream: family collapse rules, representative-card selection, hidden-variant counts, and active-family ordering should flow through one shared preview family-compaction model so Media cards and future preview surfaces do not flatten every visible family item by default. Preview family disclosure also stays upstream: disclosure state, visible-item selection, and family presentation should flow through one shared preview family-disclosure model while document-scoped expanded-family persistence, stale-family pruning, and optional active/playhead auto-open flow through one shared preview family-disclosure controller, so Media cards and future preview surfaces do not invent local show-more behavior, retain dead family ids, or fork disclosure state per context instance. Preview family disclosure presentation also stays upstream: header visibility, summary copy, toggle labels/titles, auto-open affordance styling, and family-header tone should flow through one shared preview family-disclosure surface model so Media Canvas and future monitor/timeline family views do not rebuild the same presentation policy locally. Preview family section layout also stays upstream: family section labels, card-grid labels, section-level semantic attrs, and empty/list summary layout policy should flow through one shared preview family-section layout model so Media Canvas and future monitor/timeline family views do not rebuild structural layout semantics locally. Preview source-object URL lifetime also stays upstream: replacing or re-registering the same local video source must reuse one canonical blob URL and only delay revocation when the canonical URL truly changes, so mounted media can finish swapping cleanly without visible `net::ERR_ABORTED` churn. Preview element registration also stays upstream: surfaces should hand the rendered `<video>` element into one shared preview-video binder instead of probing panel DOM with local selectors, so sync listeners, playback fallback, and transport ownership remain headless and reusable. Preview surface composition also stays upstream: semantic host attrs, default panel chrome/state, control policy, and video-element registration should flow through one shared preview-surface adapter so Media Canvas, monitor surfaces, and future timeline previews do not rebuild `RichMediaPanel` wiring locally. Source timing maps through the compiled video-sequence export plan so cuts, splices, gaps, repeated source clips, masks, grades, transitions, filters, adjustment layers, keyframes, effects, speed rows, images, scenes, and audio lanes stay source-backed. Edited-media export is downstream of that same plan and must keep using shared source/metadata helpers plus neutral browser media APIs (`captureStream`, `MediaRecorder`, `createMediaElementSource`) instead of inventing a parallel runtime source owner. Export progress/cancel semantics also stay upstream: shared preparing/rendering/finalizing labels, shared abort detection, active-button cancellation, abort-safe cleanup, and the structured `completedSegments`/`totalSegments` progress payload must not fork into panel-local implementations. Export-plan validation also stays upstream: empty plans or plans without a positive-duration source range must fail through the shared validator, and BottomPanel enablement must not invent a second heuristic. Export error taxonomy also stays upstream: shared export error codes/messages must classify abort, capability, plan, source, and runtime failures so surface feedback reuses one canonical message boundary instead of panel-local fallback copy. Export outcomes also stay upstream: shared downloaded/cancelled/failed results should carry canonical message, toast kind, filename, and error-code fields so surfaces and telemetry hooks do not rebuild post-export state locally. Export event telemetry also stays upstream: one shared export event envelope should carry both progress events and terminal outcome events so surfaces/logging do not fork separate callback shapes. Export session history also stays upstream: one shared reducer/history boundary should collapse those events into bounded run snapshots with run id, filename base, timing, progress, and terminal outcome fields so future history/retry/audit surfaces do not rebuild run state locally. Export retry/replay also stays upstream: shared retry requests must validate that no export is active and that the current compiled plan still matches the previous run snapshot before replaying, while preserving prior run linkage through shared run ids instead of panel-local heuristics. Export retry grouping/compaction also stays upstream: future surfaces must consume one shared lineage-aware session collection that groups `retryOfRunId` families, keeps retry-relevant runs visible, and compacts noisy retries without rebuilding ancestry rules in panel-local code. Export retry surfacing also stays upstream: BottomPanel should derive its retry button title/state from a shared retry-control helper and the latest retryable session, not from panel-local copy or ad hoc status checks. Export session surfacing also stays upstream: BottomPanel should render recent export runs through a shared session-surface model that owns detail labels, empty-state copy, and per-run retry affordances instead of panel-local row formatting. Export session styling also stays upstream: recent export rows should derive semantic tone/style mode through one shared helper so running, downloaded, cancelled, and failed states do not fork into surface-local status-to-style mappings. Export session selection also stays upstream: recent export surfaces should use one shared ordering/filter helper to prioritize the latest retryable run, keep active runs visible, apply optional status filters, and then fall back to recency instead of trusting panel-local array order. Export shutdown must finalize through one cleanup path so track stopping, Web Audio disconnect/close, and video teardown still run even when recorder stop/error rejects. Local absolute-path imports may resolve through `/@fs...`; successful metadata probes, stable media keys, canonical source-registry blob reuse, delayed source-registry blob revocation, and delayed blob download revocation must avoid visible `net::ERR_ABORTED` churn for valid preview, import, and export loads.
- Rich-media browser verification also stays source-owned: the Dev-only smoke route (`canvas/src/features/testing/RichMediaBrowserSmokePage.tsx`) plus `npm run test:smoke:rich-media:browser` must exercise shared `RichMediaPanel` runtime surfaces for markdown preview/edit, inline `srcDoc`, snapshot iframe, click-to-open overlay, image zoom wheel, video HTML fallback, audio, and flow-editor chrome visibility while emitting one screenshot artifact.
- Storyboard drag-to-panel verification also stays source-owned: `npm run test:smoke:storyboard-rich-media-drop:source` owns the focused pointer-centering and browser-smoke seam regressions, while the Dev-only smoke route (`canvas/src/features/testing/StoryboardRichMediaDropSmokePage.tsx`) plus `npm run test:smoke:storyboard-rich-media-drop:browser` exercise the real `2D Renderer: Storyboard` drop bridge by creating one image and one video `Rich Media Panel` on the shared storyboard surface and proving existing storyboard cards and rich-media panels keep their authored world positions. The real app-route restoration proof also stays source-owned: `npm run test:live:storyboard-media-panel-retention:browser` injects the starter markdown through the workspace runtime command on the normal Canvas route, creates one image and one video panel, verifies panel box stability during edge retention, reapplies the markdown SSOT, and proves transient panel/edge residue disappears. `npm run storyboard:readiness:check` bundles the source smoke, browser smoke, and publish sync gate before release. Generic flow-editor drag/resize callback counters outside this path remain covered by focused component regressions.
- Media animation surface state also stays upstream: Media Canvas, BottomPanel Timeline, FloatingPanel Timeline, and FloatingPanel Media must consume `timelineAnimationEngine.ts` for dependency-free motion state and semantic `data-kg-animation-*` attributes. The target taxonomy follows anime.js-style breadth only as a reference and covers CSS properties, SVG attributes, DOM attributes, JavaScript objects, HTML, Canvas 2D, and WebGL/Three.js without adding an animation runtime dependency.
- Media preview sync state also stays upstream: selected-row preview alignment, playhead-active family emphasis, ruler activity markers, and native animation timing should flow through one shared preview-sync plan plus shared source-activity models so Media Canvas, BottomPanel Timeline, and FloatingPanel Timeline do not fork activity or animation heuristics.
- Media preview shell ownership also stays upstream: shell labels, title/summary copy, empty-shell framing, and shell-level semantic attrs should flow through one shared preview surface-shell model so `MediaCanvas` and future preview surfaces do not keep top-level chrome decisions local.
- Media preview family-section chrome also stays upstream: header visibility, summary data binding, toggle icon/mode/title/state, and disclosure toggle handlers should flow through one shared preview family-section chrome model so `MediaCanvas` does not coordinate family header controls locally.
- Media preview family-section body also stays upstream: card-grid labels and per-item preview-surface props should flow through one shared preview family-section body model so `MediaCanvas` does not assemble per-card `TimelinePreviewSurface` inputs locally.
- Media preview family sections also stay upstream: aligned chrome/body section identity, merged section labels/attrs, and unified section rendering contracts should flow through one shared preview family-sections model so `MediaCanvas` does not zip parallel section arrays locally.
- Media preview canvas rendering also stays upstream: the shell/content render mode, section markup composition, and empty-state rendering should flow through one shared media-canvas render model plus render adapter so `MediaCanvas` remains a thin surface shell over one preview render contract.
- Media preview canvas framing also stays upstream: outer shell labels, host semantic attrs, and frame markup should flow through one shared media-canvas frame model plus frame renderer so `MediaCanvas` remains limited to store/context binding.
- Media preview bootstrap also stays upstream: preview collection assembly, cleaned document-key derivation, and preview/export-plan selection should flow through one shared preview-bootstrap hook so Media Canvas and Gantt monitor entrypoints do not rebuild session bootstrap locally.
- Media preview canvas binding also stays upstream: inventory intake, document/session store binding, preview-bootstrap invocation, and preview-context invocation should flow through one shared media-canvas binding hook so `MediaCanvas` becomes a near-empty surface entrypoint.
- Preview route-entry bootstrap also stays upstream: media and monitor entrypoints should consume one shared preview route-entry hook that composes the common preview-bootstrap tuple plus intent-specific timeline runtime defaults, so entry hooks do not wire `useTimelinePreviewBootstrap()` directly.
- Timeline/monitor binding also stays upstream: monitor entrypoints should consume one shared preview monitor-binding hook that composes preview bootstrap plus monitor-context inputs and only hands back monitor scopes, while document-key derivation stays shared through the preview-bootstrap helper, so `GanttTimelineTransportPanel` does not wire preview bootstrap/context locally.
- Gantt transport preview session also stays upstream: video-sequence parsing, monitor-binding inputs, export-plan derivation, and preview/export validation should flow through one shared transport-preview session hook so the transport session does not mix preview bootstrap concerns into transport/store state.
- Gantt transport session assembly also stays upstream: document/selection/transport store binding, parsed timeline state, transport-controller state, tool status, and duration/display state should flow through one shared transport-session hook so `GanttTimelineTransportPanel` does not assemble runtime session state locally.
- Gantt transport chrome/export presentation also stays upstream: export-session surfaces, retry/export button state, tool-strip wiring, and header/context chrome markup should flow through one shared transport-chrome model plus render adapters so `GanttTimelineTransportPanel` does not build inline export/session/tool JSX locally.
- Gantt transport ruler presentation also stays upstream: ruler props, lane-count styling, subtitle/title copy, total label handoff, and clamped transport value should flow through one shared transport-ruler model plus ruler renderer so `GanttTimelineTransportPanel` does not assemble inline ruler/chrome metadata locally.
- Gantt transport shell presentation also stays upstream: `TimelineTransportChrome` runtime props, shell/root markers, range flags, and playback control handoff should flow through one shared transport-shell model plus shell renderer so `GanttTimelineTransportPanel` does not compose the chrome shell inline.
- Gantt transport playback presentation also stays upstream: playback request handlers plus the transport playback loop should flow through one shared transport-playback model that composes the playback-controls hook with `useTimelineTransportPlayback()`, so `GanttTimelineTransportPanel` does not wire playback callbacks or the playback side effect inline.
- Gantt transport interaction/view presentation also stays upstream: scrub/drag orchestration, zoom and fit state, playhead centering, row-key resolution, and selection-sync side effects should flow through one shared transport-interaction model that composes the lower interaction/view hooks, so `GanttTimelineTransportPanel` does not coordinate those runtime effects locally.
- Gantt transport command presentation also stays upstream: document mutations, edited-media export state, drag-commit actions, and chrome-command handoff should flow through one shared transport-command model that composes the lower document-actions hook, so `GanttTimelineTransportPanel` does not own export/edit command assembly locally.
- Gantt transport surface presentation also stays upstream: session, command, interaction, chrome, ruler, playback, and shell composition should flow through one shared transport-surface model plus one thin transport-surface renderer so `GanttTimelineTransportPanel` remains a thin layout-only entrypoint that only hands a top-level surface model to the surface renderer.
- Gantt transport route presentation also stays upstream: route-level `code` and `compact` inputs should flow through one shared transport-route model so `GanttTimelineTransportPanel` does not even assemble the surface model directly and remains a nearly trivial route wrapper.
- Media preview context assembly also stays upstream: the media-only preview surface/activity/family/disclosure/frame composition chain should flow through one shared media-preview context builder so `MediaCanvas` does not depend on the full generic preview-context path.
- Timeline/monitor scope projection also stays upstream: monitor-scope derivation should flow through one shared preview scope-projection builder so Gantt/monitor surfaces do not depend on the remaining generic preview-context wrapper.
- Timeline/monitor context assembly also stays upstream: monitor consumers should use one shared preview monitor-context builder that composes media-preview state plus scope projection, and the legacy `useTimelinePreviewContext` wrapper should not exist in the runtime boundary.
- **Renderer coverage**:
  - 2D D3/Flowchart, Flow Canvas, Design, Flow Editor, and 3D all respect the global edge type via a shared `edgeTypes` utility (`buildEdgePathD/traceEdgePathOnCanvas`) instead of duplicating path logic.
  - D3 uses the global type to decide whether to generate SVG path curves or straight/step/smoothstep polylines; Flow/Flow Editor use the same utility for Canvas2D overlays; Design wireframes reuse the same path generator for DOM snapshot edges; 3D maps edge type to curvature defaults (Straight/Step→0, Smoothstep→minimum curvature).
- **Precedence and overrides**:
  - Global edge type is view‑only and must not change GraphData; it controls rendering only.
  - For `bezier`, existing per‑edge `visual:pathD`/curvature metadata remains valid (e.g., Mermaid or radar/galaxy curves); for non‑bezier types, the global edge type takes precedence and disables legacy curve/orbital interpolation so all edges follow the selected shape consistently.
  - Per‑edge visual attributes such as `visual:width`, `visual:color`, and arrow presence remain schema‑driven and are not overridden by edge type.

### Frontmatter + Markdown + Rich Media Linking (Renderer View)

- Renderer surfaces (Canvas D3/Flow/3D, HTML Viewer/Canvas) treat:
  - Frontmatter-defined graphs (`nodes` / `connections` / `'kg:subgraphs'`) and Mermaid diagrams as structural inputs.
  - Markdown body anchors (`<a id="...">`, heading ids, `^block-id` markers), `[[wikilinks]]`, and `{{templates}}` as semantic link targets and text templates.
  - Rich Media nodes as graph nodes with media-specific properties (image/svg/video/iframe) plus optional node-to-body anchor metadata (e.g., `doc:anchorId`).
- Linking rules:
  - Mermaid `click` directives targeting `#anchor` must map to edges from diagram nodes to Anchor nodes generated from body anchors; Canvas and exported HTML viewers use the same mapping so clicking from Mermaid or Graph views lands on the same markdown location.
  - Graph nodes that carry document anchor metadata may be surfaced as clickable targets or overlay entries that navigate back into the Markdown Viewer using `documentPath` + anchor id; exports must preserve this mapping without requiring absolute filesystem paths.
  - Rich Media overlays (2D/3D) must keep their node ids and anchor links intact across live Canvas and HTML exports; toggling Rich Media On/Off is view-only and must not change the underlying graph or markdown links.
  - Shared inline command menus (`/`, `@`, and `#`) are renderer-adjacent authoring affordances, not renderer-local state owners: command acceptance must commit through shared markdown/frontmatter or graph-field owners so the next render pass re-derives identical Rich Media nodes, references, inline compute payloads, and reusable keyword inventories.
  - `@` media insertion must reuse shared media-candidate resolution for imported files, indexed URLs, thumbnails, and reference packs; renderer surfaces may project those previews, but must not fork their own thumbnail derivation or persistence path. Persist image picks as `![alt](url)` and video picks as `<video src="..." poster="..." title="..." controls></video>`.
  - `#` keyword insertion and Dashboard keyword browsing must reuse the same centralized full-graph keyword owner instead of projecting selection-local keyword subsets as the reusable inventory.
  - FloatingPanel Chat structured-content payloads stay renderer-neutral: authored `edges[]` and safe `flow:compute` remain authoritative; otherwise source cards/widgets plus panel targets synthesize one neutral inline compute widget and explicit handle edges before Flow Editor, Storyboard, Cards, and Rich Media Panels render connected values.
  - Exported HTML Canvas viewer exposes a compact HUD for renderer/Rich Media/Frontmatter toggles (2D↔3D, Rich, Media, FM). HUD toggles are strictly view‑only, reuse the same SSOT GraphData/fit/zoom semantics as Canvas mode, and support desktop+mobile via full‑viewport canvas with pointer/touch pan/drag/pinch.

#### How to use HTML Canvas export (end-user)

- From Canvas mode, open the toolbar Export menu and select **HTML Canvas**.
- Choose **Scope** (Current viewport vs Fit to content), quality (pixel ratio), and background, then download the HTML file.
- Open the HTML export in a browser to get an interactive viewer with pan/zoom and HUD toggles (2D/3D, Rich, Media, Frontmatter) that mirror Canvas behavior.
- Prefer **2D** exports when you want a clear, static graph snapshot or flow diagram; prefer **3D** exports when depth, occlusion, or camera movement helps explain the structure.

---

## Renderer UI Surfaces (SSOT)

**Canonical surface**: Toolbar → Floating Panel → Renderer

- Floating panel renderer composes:
  - Quick controls for `renderer:palette` and hover tooltip content.
  - The full Render Settings section (collapsible) for layout, camera, selection, and presets.
- Renderer ownership stays in the Floating Panel renderer view; no secondary bottom-surface tab or duplicate renderer controls are allowed.
- MainPanel Help `Command Menu` is the canonical command-browser surface for `/`, `@`, and `#` inventory. Floating Panel `media` owns the current `@` rich-media list. Both reuse the same command definitions and media/reference groupings consumed by inline editors and Workflow Manager fields; neither owns a second insertion pipeline.
- Tooltip semantics are standardized:
  - Key tooltips follow Role → Actions → Outcome.
  - Value tooltips follow Default/Min/Max/Interval (when applicable) + short impact (≤ 15 words).

- Flow Editor supports an in-canvas Flow Editor widget overlay (semantic HTML) for fast field edits and validation.
  - Reuses the host FloatingPanel shell patterns (pin/unpin, pinned drag adjusts anchor offsets collectively, detached drag when unpinned, minimize/restore + SSOT opacity).
  - Zoom/pan positioning updates are applied via rAF-batched DOM style updates (no editor-form rerender on zoom commits).
  - Key/type/value field rows stay inline-editable. If a field row and an input/output port normalize to the same schema path, the port handle is rendered on that editable row and the duplicate read-only port row is suppressed.
  - `canvas/src/components/FlowEditor/NodeOverlayEditor.tsx`
  - `canvas/src/components/FlowEditor/NodeOverlayEditorForm.tsx`

---

## Performance & Stability Strategies

### Chunk-size & Mobile Responsiveness
- Heavy tool surfaces (Toolbar, MainPanel, MarkdownWorkspace, workspace export bridge, Graph Data Table, Mermaid preview) load as lazy bundles so behavior stays identical while Canvas entry stays lean; background renderer warm-mount/prefetch is gated by device memory/CPU/save-data so low-end/mobile devices avoid hidden heavy work.

### 1. Stable Graph References
- **Issue**: Frequent re-renders or schema updates (e.g., toggling hover settings) could trigger expensive graph re-derivation.
- **Solution**: `GraphCanvas` implements rigorous memoization:
  - Dependencies include `graphData` reference and stable JSON hashes of `schema.layers`, `schema.layout`, etc.
  - **Optimization**: `schema.nodeStyles` changes do *not* trigger graph re-derivation or scene rebuilds, only CSS/style updates.
  - `deriveGraphDataForLayers` runs only when strictly necessary (topology or layer mode changes).

### 2. Store Immutability & D3 Isolation
- **Issue**: D3's force simulation directly mutates node objects (`x`, `y`, `vx`, `vy`). If these objects are shared references to the Zustand store, it violates unidirectional flow and causes side-effects.
- **Solution**: `cloneGraphDataForRender` enforces **render-only clones** of nodes and edges before passing them to the renderer.
  - Nodes are cloned so D3 can freely mutate `x/y/vx/vy` without touching canonical store state.
  - Edges are cloned because D3 force-link mutates `edge.source`/`edge.target` from ids to node objects; cloning prevents store contamination and downstream churn.
-    - This decoupling breaks "render → simulate → store update → render" loops and prevents force layout “jumping” caused by repeated reinitialization.

### 3. Loop Prevention
- **Mechanism**:
  - **Stable References**: `useMemo` in `GraphCanvas` ensures `renderGraphData` remains referentially stable if inputs haven't changed.
  - **Simulation Isolation**: Force layout positions are **not** synced back to the global store automatically. This prevents "render → simulate → store update → render" cycles.
  - **Resize Guard**: `setCanvasDims` short-circuits unchanged dimension updates.
  - **Scene Rebuild Boundaries**: Scene construction is decoupled from selection/highlight styling so selection changes do not restart the simulation.

### 4. Stats Derivation Optimization
- **Optimization**: `useStatsSelection` uses the same memoized schema JSON technique to prevent expensive stats re-calculation when irrelevant schema parts (like colors) change.

### 5. Preserve Inactive Renderers
### 5. Forbid Inactive Renderer Interference
- **Issue**: When multiple renderer layers remain mounted (even if visually hidden), they can still run effects (zoomRequest consumption, timers, layout recalculation, MapLibre lifecycle) and interfere with the active mode.
- **Solution**: Canvas may **warm-mount** inactive renderers to reduce switch lag, but enforces strict **active gating**:
  - Only the active renderer consumes shared requests (zoom/selection) and owns interactive listeners.
  - Inactive renderers must short-circuit hot-path effects (draw loops, request consumption, store writes) when `active=false`.
  - Caches remain SSOT-keyed: zoom state is restored via a stable view key that is isolated per 2D renderer variant and built from a single schema layout-engine fingerprint (include `schema.layout.flow`); layout caches remain isolated by render variant.
  - Viewport controls are preset-driven (`map` vs `design`) and reused across 2D and Geospatial surfaces to avoid drift.
  - Node/edge visibility is renderer-parity SSOT: both D3 and Flow first derive `graphDataForDisplay` via the shared display filter helper (`getGraphDataForDisplay`) before fit/layout/scene build.
  - Collective fit+center is renderer-parity SSOT: all 2D renderers compute fit from the display-derived graph (post filters/collapse) using node dimensions (`visual:width/height` when present) and group envelopes (clusters/subgraphs/layers) so the visible graph is fully in-viewport and centered.
  - Layer ordering is renderer-parity SSOT: 2D z-order ranks are centralized and applied to both SVG (GraphCanvas) and native canvas (Flow/Flow Editor) so groups/edges/nodes/labels/handles stack consistently without per-renderer drift.
  - 2D initialization is idempotent and bounds-guarded: do not apply stored transforms until bounds are computable (e.g., at least one finite position and stable node dimensions); if a valid initial transform is applied, the same init pass must not also auto-fit (prevents “double-fit” jumps and first-paint churn).
  - Flow/Flow Editor scene build must ignore invalid geometry: if positions are only partially available, skip nodes without finite positions (and incident edges) to prevent one-long stray lines and chaotic redraw.
  - Flow initial zoom uses a bounds guard: if node bounds cannot be computed yet, do not apply stored transforms (prevents "blank" due to stale pan); prefer fit/identity. Flow Editor init keys must be stable per graph: when dataset keys collapse to `rev:*`, compute a per-graph hashed init key to avoid cross-file collisions.
  - Collision avoidance is renderer-parity SSOT: run bounded collision relaxation when layouts are produced/frozen (post-collective-fit in D3; post-layout in Flow/Flow Editor) and use overlap-pressure heuristics to avoid leaving persistent overlaps when positions are “stable” but still colliding.
  - Store writes that affect layout must be bounded: batch multi-node position patches (e.g., Design frames post-relax) to avoid N-per-node rerender churn and forbid feedback loops from frequent writes.
  - 2D wheel + pinch zoom (D3, Flow, Animatic, Storyboard, Design, Flow Editor) uses SSOT normalization and a shared continuous zoom factor, honoring the same user-tunable settings in MainPanel Settings (`canvasInteractionSpeedMultiplier`, `canvasPanSpeedMultiplier`, `wheelZoomCtrlMetaBoostMultiplier`, `flowWheelZoomSpeedMultiplier`, `flowWheelZoomIncrementMultiplier`, `flowWheelZoomSmoothMinDurationMs`, `flowWheelZoomSmoothMaxDurationMs`). Defaults may be upgraded once via `LS_KEYS.flowWheelZoomDefaultsVersion` to improve pinch/zoom responsiveness without overriding user-tuned values. While the pointer is over the active canvas, default page scroll/zoom is prevented so zooming never triggers horizontal/vertical page scrolling. All 2D renderers apply a short anchored easing animation for wheel deltas (rAF-driven) to prevent per-frame delta clumping; cancel on pan/drag and cleanup RAF on unmount. Zoom actions and modes are also shared (`zoomDurationFitMs`, `zoomDurationSelectionMs`, `viewPinned`, `fitToScreenMode`, `zoomToSelectionMode`).
  - UI container: `canvas/src/pages/Canvas.tsx`
  - 2D D3 renderer entry: `canvas/src/components/GraphCanvas.tsx`
  - 2D Dashboard renderer entry: `canvas/src/components/DashboardCanvas/index.tsx`
  - 2D Flow renderer entry: `canvas/src/components/FlowCanvas.tsx`
  - 2D Storyboard renderer entry: `canvas/src/components/StoryboardCanvas.tsx`
  - 2D Design renderer entry: `canvas/src/components/DesignCanvas.tsx`
  - 2D GitGraph renderer entry: `canvas/src/components/MermaidGitGraphCanvas.tsx`
  - SVG diagram viewport adapter: `canvas/src/components/GraphCanvas/hooks/useSvgSurfaceZoomRuntime.ts`
  - 2D Flow Editor (draft + commit) entry: `canvas/src/components/FlowEditorCanvas.tsx`
  - 3D renderer entry: `canvas/src/features/three/ThreeGraph.tsx`
  - Geospatial overlay host: `gympgrph` host surface mounted only when Geospatial Mode is enabled.

### 6. Tick-Path Caching + Force Gating
- **Issue**: D3 simulation ticks are O(nodes + edges) and can become CPU-bound due to repeated geometry computations and custom-force passes.
- **Solution**:
  - Cache node geometry per tick keyed by node id and schema reference (avoids repeated dimension/radius recomputation).
  - Gate heavy custom forces at low alpha and reduce anti-line work frequency.
  - Persist layout positions when the simulation ends to improve reuse on mode switches and rebuild boundaries.

### 7. Canvas2D Theme/Token Read Caching
- **Issue**: Per-frame `getComputedStyle()` / CSS var reads in Canvas2D draw loops cause avoidable main-thread work and can amplify interaction lag.
- **Solution**: Flow/Flow Editor Canvas2D runtime caches theme + font by a lightweight CSS “key” (`data-theme`/class/style) and only re-reads CSS vars when the key changes; individual `var(--*)` resolutions are memoized per key.

---

## Layout Specifications

## Cluster Terminology (SSOT)

- **Cluster (SSOT)**: umbrella term for “a set of nodes treated as a unit” across derivation, layout, and rendering.
- **Cluster Layer (Canvas)**: renderer outline surfaces configured by `schema.metadata["canvas:graphLayers"]` and driven by GraphData metadata or frontmatter (aka “graph layers” in schema/config keys).
- **Community (Semantic)**: similarity-based cluster id (`visual:community`) derived from connected components over `coOccursWith` (used by the shared stats surfaces + layered layouts).
- **Subgraph (Mermaid)**: Mermaid `subgraph` blocks that materialize as cluster layers during frontmatter/document derivation.
- **Cluster Shape (UI)**: the outline shape toggle (Rect/Polygon) for cluster layers; it does not change the underlying clustering rule.
- **Renderer Parity**: Cluster Shape and Port Handles toggles must affect both 2D renderers (D3 and Flow) so switching renderVariant does not change semantics (only implementation).

### 2D Layout Caching
- **Structured Layouts** (`radial`, `tree`, `mermaid`) cache positions in `layoutPositionCacheByMode`.
- **Cache Reuse**:
  - `determineLayoutPositions` checks coverage (>95% matched nodes).
  - Reuses cached positions to skip expensive layout calculations on re-visits.
- **Continuity**:
  - Cache keys include semantic mode + frontmatter mode + layout mode + render mode + render variant (+ optional layout variant) to prevent cross-renderer and cross-layout drift.
  - Switching modes (e.g. Tree -> Force, 2D -> 3D -> 2D) restores cached positions to prevent visual chaos.
  - Centroid recentering ensures the graph stays visible.

### 2D D3 Layout Seeding (Document Structure vs Keyword Mode)
- **Visibility drives layout inputs**: D3 builds layout + fit from `graphDataForDisplay` (after shared display filters). Nodes/Clusters/Edges visibility must be derived once (SSOT) and reused by layout, fit, and rendering to prevent drift across panels and 2D renderers.
- **Document Structure Mode**:
  - Layout seeding prefers cached positions for the active layout mode (when coverage is sufficient).
  - Missing positions are seeded around the viewport center (or the current transform center when restoring a non-identity transform) to prevent top-left clustering.
  - Seed normalization rebases extreme/overly-tight seeds into a bounded viewport range before forces run.
- **Keyword Mode**:
  - Keyword Mode defaults to the Document Structure baseline: when baseline positions exist, Keyword nodes are seeded from the Document baseline positions to preserve mental map and prevent “new graph chaos” on mode switches.
  - Baseline seeding is guarded by instability detection: if cached Keyword positions look unstable (extreme coordinates, excessive spread, or excessive clustering), baseline seeding overwrites cached positions and forces re-layout.
  - Skip-initial-layout is overridden for unstable caches: even if `determineLayoutPositions` reports `skipInitialLayout=true`, Keyword Mode forces a fresh layout when instability is detected (prevents “stuck messy cache”).
  - Post-computation collective fit is applied after bounded collision relaxation to keep the entire visible Keyword graph centered and bounded in the current viewport (prevents uncontrolled expansion and void-space layouts).
  - Implementation lives in `canvas/src/components/GraphCanvas/scene.ts` (`applyBaselineDocumentPositionsToKeywordGraph`, `layoutLooksUnstableForViewport`, `effectiveSkipInitialLayout`, `postFitNodesToViewport`).
  
#### Flow/Flow Editor Parity with Baseline
- Flow and Flow Editor do not run D3 forces but must reuse the same SSOT inputs as D3: visibility filter, collective fit geometry, and zoom behavior. Initial view honors the same bounds guards and idempotent init policy.
- When the Document Structure baseline lock is active, Flow and Flow Editor must disable auto zoom modes and maintain parity with the D3 baseline; switching between 2D variants restores each variant’s own zoom state via isolated view keys. See [autoZoom2dPolicy.ts](../../canvas/src/features/zoom/autoZoom2dPolicy.ts) and [FlowCanvas tests](../../canvas/src/__tests__/flowCanvasIntegration.test.ts#L143-L184).
- Radial schema enforcement may demote renderer modes that do not own radial/flow layout, but it must preserve Flow Editor. Flow Editor handles its own layout, pin/unpin, pan, and zoom contract on the shared 2D surface and must not be coerced back to D3 by schema-level renderer normalization.

### 2D Flowchart Layout (Super-Groups)

- **Scope**: 2D Flowchart renderer (`canvas2dRenderer="flowchart"`) consumes the canonical Flowchart graph contract where `node.type∈{problem,solution}` and cluster ids come from metadata (`cluster`, `clusters[]`, or `cluster_gap_ratios` keys).
- **Hierarchy** (SSOT):
-  - Root super-group: `Flowchart` contains all problem+solution nodes.
  - Side super-groups: `Problems` and `Solutions` each contain their side’s nodes.
  - Cluster groups: per-cluster groups (e.g., Capital/Growth/Network) sit under the appropriate side super-group and contain member nodes.
  - The hierarchy is expressed structurally via `kg:subgraphs`/subgraph metadata, not via renderer-specific flags.
- **Layout invariants**:
  - Problems and Solutions occupy separated left/right lanes derived from `visual:xIndex` and schema forces; switching 2D renderer variants must not reassign nodes across sides.
  - Super-group/group envelopes, headers, and cluster outlines are part of fit geometry (collective bounds) and must remain visible during interaction (click/drag/zoom) without requiring renderer switching.
-  - Edge visibility in Flowchart mode uses schema + per-edge visual opacity/width only; selection/highlight may dim but must not fully hide the Flowchart lane/link structure when nodes are visible.

### Selection Zoom (Node/Edge vs Graph)
- Zoom-to-selection operates on a selection subset (selected node ids and/or edge endpoints) and must share duration/timing knobs across 2D renderers.
- Fit-to-screen operates on the full visible graph (after display filters) and must not be confused with selection zoom; selection zoom must not mutate layout caches.

### Frontmatter-Flow Balanced Layout (16:9 Director-Brief Composition)

- **Scope**: frontmatter-flow graphs with `metadata.kind='frontmatter-flow'` and `metadata.frontmatterFlowSettings` containing balanced layout keys.
- **Shared settings contract** (`canvas/src/lib/graph/frontmatterFlowSettings.ts`):
  - `balancedViewportPreset`: viewport margin preset consumed by overlay balanced spread and Flow Editor fit.
  - `balancedHeroRowCount`: number of widgets on the first (hero) row; remaining widgets form subsequent rows.
  - `balancedHeroRowGapScale`: multiplier for vertical gap between hero row and subsequent rows (clamped 0.6–1.5).
  - `balancedPanelOffsetScale`: multiplier for same-shot widget-to-panel vertical offset (clamped 0.8–1.4).
- **Canonical defaults** (`markdownFrontmatterFlowGraph.flowBlock.ts`):
  - `balancedViewportPreset: 'widgetFrontmatter'`
  - `balancedHeroRowCount: 3`
  - `balancedHeroRowGapScale: 0.76`
  - `balancedPanelOffsetScale: 0.96`
- **Director-brief shot layout** (`markdownFrontmatterFlowGraph.core.ts`):
  - `buildDirectorBriefShotLayoutConfig`: centralizes grid column selection, cell dimensions, and panel offset derivation from shared settings.
  - `readDirectorBriefShotPlacement`: computes per-shot X/Y placement using hero-row contract and row-gap scaling.
  - Row centering: each row is horizontally centered under the collective centroid; CTA rows align with hero-row centroid.
- **Flow Editor seeding** (`useFlowEditorRuntimeScene.ts` + `seedGroupSpread.ts`):
  - `preferredFirstRowCount` and `preferredFirstRowGapScale` are read from frontmatter-flow settings and passed to the shared centered spread helper.
- **Overlay edge composition** (`useFlowEditorOverlayEdges.ts` + `flowEditorRenderGraph.ts`):
  - `edgeCurveById` precomputed in the shared overlay graph; renderer consumes shared curve hints.
  - Frontmatter shot hero/CTA edges apply `frontmatterShotEdgeCrowdingLift` for long vertical transitions.
- **Overlay surface ownership** (`useFlowEditorOverlaySurface.tsx` + `flowEditorOverlaySurfaceElements.tsx` + `flowEditorOverlaySurfaceVisibility.ts`):
  - The hook owns memoized graph inputs, the visibility helper owns overlay-only/frontmatter exclusion policy, and the element helper owns JSX overlay composition plus connected rich-media values.
- **Runtime facade ownership** (`FlowEditorCanvas.runtime.tsx` + `useFlowEditorRuntimeStoreState.ts`):
  - The runtime facade wires hooks and surface props; the store-state helper owns broad graph/store selector plumbing.
- **Rich media panel handle anchoring** (`handles.ts`):
  - Panel input/output handles are reordered by `richMediaActiveTab` so the active medium gets the most central port slot.
- **Invariants**:
  - All balanced layout behavior must route through shared settings and helpers; forbid renderer-local hardcoding of hero count, row gap, or panel offset.
  - Parser-level director-brief derivation and Flow Editor seeding must consume the same `readFrontmatterFlowRenderSettings` contract.
  - Overlay edge routing must consume shared `edgeCurveById` hints before falling back to generic curve readers.
  - End-to-end regression: `markdown.frontmatterFlowGraph.fidelity.knowgrphVideoDemo.16x9CompositionContract`.

### Mermaid Layout Mode
- **Configuration**: `layout.mode = 'mermaid'`.
- **Behavior**:
  - Forces **Rectangular Box** shape.
  - Uses Dagre layout engine.
  - **Subgraphs**: Rendered as group outlines with auto-sizing padding.
  - **Port Handles**:
    - **Border**: Inputs/Outputs clamped to border.
    - **Intermediate**: Clamped to inner padding.

---

## Visual Styling & Palette

- **Palette Source**: `renderer:palette` in `schema.metadata`.
- **Palette Reader SSOT**: Renderer settings and renderers must read defaults through `getRendererPalette(schema)` so Toolbar, D3, 3D, Graph Fields, and table surfaces share one metadata/default merge path.
- **Defaults**:
  - `idea` (Blue), `hypothesis` (Yellow), `execution` (Green), `pivot` (Orange), `alert` (Red).
- **Lifecycle Mapping**:
  - Nodes with `properties.tags` including these keywords automatically adopt the color.
  - Graph Layer outlines adopt the color of their owner node or property key.

---

## Node Shapes (2D)

- **Supported shapes**: `circle`, `rect`, `diamond`, `hex` (images render as `rect`).
- **Precedence (SSOT)**:
  1. `schema.nodeShapes[node.type]` (per-type shape)
  2. `node.properties["visual:shape"]` (per-node override; used by Mermaid flowchart shape parsing)
  3. `schema.behavior.nodeShapeMode` (global default; toolbar cycles)
  4. Fallback: `rect` when Port Handles are enabled, otherwise `circle`
- **Goal**: presentation toggles update layers without re-layout; shape updates must be tick-safe and bounded.

---

## Label Layout (SSOT)

- **Single source**: wrapping + ellipsis decisions are shared across render, collision, and fit-to-view to prevent drift.
- **Center alignment**: non-circle node labels are centered (`dx=0`, `anchor=middle`) and line-wrapped within the node’s visual bounds.
- **Ellipsis**: long labels are clamped and expanded via hover tooltip (see `labels.ts`, `GraphHoverTooltip.tsx`).
- **Flow edge labels**: Flow/Flow Editor edge labels are rendered in native canvas and placed using multi-candidate collision avoidance against nodes, groups, and other labels; the placement pass is gated by zoom and graph size to stay bounded.

---

## Layout Force Tuning (2D D3)

- **Schema knobs**:
  - 2D D3 force layout reads layout-force tuning from `schema.layout.forces.*`, including `antiLineStrength`, `postFitStrength`, and `postFitAlphaMax` (plus `antiLineForce`, `antiLineAlphaMin`, `antiLineTickInterval`, `postFitForce` switches).
- **UI surface**:
  - The Floating Props Panel exposes a **Layout** section with numeric controls for anti-line strength, post-fit strength, and post-fit alpha max, plus a “Strong spread preset” Apply button that writes a recommended combo into the active semantic-mode schema.
- **Reset behavior**:
  - The Layout section also exposes a **Reset** button that restores layout forces to defaults per mode (Document vs Keyword) using the SSOT defaults from `defaultSchema`; toolbar **Reset** remains strictly camera/viewport Fit-to-View and must not mutate layout forces or cached positions.

---

## Edge Labels & Links

- **Theme alignment**: edge labels and group labels use the same halo/fill paint via `useGraphCanvasStyles`.
- **No endpoint overlap**: edge labels apply bounded normal-offset nudging to avoid overlapping their endpoint node AABBs.
- **Temp link styling**: temp edge-creation link uses `--kg-canvas-accent` (light/dark aware) instead of hardcoded colors.

---

## Port Handles & Collision

- **Port clearance**: collision extents include port handle offset/size so handles don’t visually overlap.
- **Sizing SSOT**: default rect sizing derives from schema node radius (no minimap-driven sizing side-effects).
- **Flow parity**: the 2D Flow renderer must (1) route endpoints to per-edge handles only when Port Handles are enabled, (2) distribute handle positions along the correct axis (`LR`: along node height, `TB`: along node width), and (3) optionally draw handle glyphs using the same port-handle config knobs.
- **Flow Editor KTV parity**: Flow Editor widget port buttons use the same structural port keys as Flow endpoints. KTV row consolidation changes only the editor DOM shape; it must not rewrite `flow:sourcePortKey`, `flow:targetPortKey`, `sourceHandle`, `targetHandle`, or connected-value schema paths.
- **Edge routing parity**: Flow edge routing is schema-driven via `schema.layout.flow.edges.routing`, avoids node/group obstacles to reduce spaghetti, and ignores obstacles that contain the edge endpoints (so endpoint nodes/groups never block their own routes). Obstacles are built once per draw to avoid E×N recomputation.
- **Underlay parity**: edge visibility beneath group fills is schema-driven via `schema.layout.flow.edges.underlay.groupFadeAlpha` and should match D3’s group fill semantics.
- **Nested group visibility**: group stroke/opacity should scale by outer depth consistently across D3 and Flow via `schema.layout.groups.depthStyle`.

---

## Radial Layout (Bounded)

- **Post-relaxation**: radial layout runs a bounded AABB-collide relaxation pass to reduce overlaps without starting an indefinite simulation.

---

## Anti-Patterns (Forbidden)

| Context              | Intent                          | Directive                                                                                   |
|----------------------|---------------------------------|---------------------------------------------------------------------------------------------|
| Store Mutation       | Protect Source of Truth         | - [ ] Copy data before D3 simulation; forbid passing store references directly to D3       |
| Effect Dependencies  | Prevent Re-renders              | - [ ] Use memoized JSON for complex objects; forbid raw object dependencies in useEffect    |
| Layout Loops         | Stable Convergence              | - [ ] Check equality before store updates; forbid blind dispatching of layout positions     |
| Test Hangs           | Ensure CI Stability             | - [ ] Cleanup simulation and listeners in useEffect return; forbid dangling intervals       |

---

## Dependency & Integration Standards

**Coupling Metrics**
- `GraphCanvas` is decoupled from `GraphSchema` specifics:
  - It only depends on `schema.layers` and `schema.layout` for structural updates.
  - Styling updates are handled via separate `useGraphCanvasStyles` hook.

---

## Viewport and zoom behavior
- **Fit to Screen**:
  - Centers on rendered graph centroid and accounts for label-aware bounds.
  - Shared graph-element centroid ownership lives in `canvas/src/lib/canvas/graph-elements/centroid.ts`; D3, Flow Canvas, Flow Editor, Design, SVG export, layout seed, post-fit, and arrange helpers must import it instead of recomputing local centroid sums.
  - Computes fit scale on actual viewport dimensions with `targetFillRatio = 0.8`.
  - Clamps zoom scale via `schema.performance.zoom.{minScale,maxScale}`.
  - Re-evaluates on view/layout/presentation changes unless the view is pinned.
  - `grph-shared/src/zoom/presets.ts` provides reusable fit/zoom presets reused by fit logic and simulation/layout seeding.
- **Reset**:
  - Resets viewport by performing the same collective Fit-to-View framing (centroid + group-aware bounds).
  - Forbids forcing `k=1` as a reset behavior when the graph is larger than the viewport.
- **Zoom to Selection**:
  - Focuses camera on selected node/edge.
- **Zoom State Caching**:
  - Caches zoom state per viewKey to prevent cross-mode/layout/presentation contamination.
  - Per-variant isolation: 2D zoom view keys include the renderer variant (D3/Flow/Design/Flow Editor) when `canvasRenderMode=2d` so switching renderers never reuses an incompatible transform. See [zoomViewKey.ts](../../canvas/src/components/GraphCanvas/zoomViewKey.ts).
- **Wheel parity (2D D3 + Flow + Flow Editor)**:
  - Wheel delta normalization and zoom factor are SSOT (`canvas/src/lib/canvas/zoom-input.ts`) and must be reused by all 2D renderers.
  - Stepped zoom accumulation uses SSOT helpers and constants in `canvas/src/lib/zoom/steps.ts` (threshold px + max steps) to keep wheel behavior aligned across renderers.
  - Wheel anchor uses event position, else a *recent* last-pointer fallback, else viewport center (prevents “jump zoom” when events lack coordinates).
  - If the wheel event is slightly outside the viewport, clamp to the nearest edge before falling back (prevents viewport-edge bounce).
  - When clamped at min zoom, a small reverse delta is ignored briefly to prevent trackpad bounce-back zoom-in.
- **Viewport controls presets (2D)**:
  - Preset SSOT lives in `canvas/src/lib/canvas/viewport-controls.ts` and must be honored by D3/Flow/Flow Editor.
  - `map`: pan = pointer drag; zoom = scroll/pinch; select = shift + pointer drag.
  - `design`: pan = scroll + middle/right drag + space+drag; zoom = ctrl/cmd+scroll; select = pointer drag **when selection-on-drag is enabled**.
  - **Flow Editor selection-on-drag**:
    - The Flow Editor renderer must never override the stored preset.
    - Selection box on pointer drag is gated by `flowEditorSelectionOnDrag` (persisted at `LS_KEYS.flowEditorSelectionOnDrag`). When disabled, selection box uses `shift + drag` like other modes.
  - **Auto zoom modes**:
    - Auto Fit-to-Screen and Auto Zoom-to-Selection are shared across 2D renderers and are suppressed while the view is pinned.
    - Auto modes must not run while `canvas2dRenderer=flowEditor` to prevent viewport churn during draft edits; explicit zoom actions still work.
    - The Design renderer runs auto modes using its local render graph (visible frames) for fit signatures, so Fit-to-Screen/Selection matches what is actually rendered.
    - The Design renderer’s frame grid is viewport-responsive: column count is derived from the active viewport width (with safety bounds) so initial framing avoids excessive whitespace and keeps visible frames within the primary viewport.
    - During frame drag, Design applies visual-only DOM transforms in-flight and batches the final persisted frame positions, so collision-relax passes and layout caches see a single bounded commit instead of N-per-frame churn.
    - Design wireframe label/layout presentation is driven by schema-only settings under `renderer:designWireframe` (exposed via the Floating Panel “Design wireframe” section) that control label/meta chips, text/media previews, z-aware label collision, depth fade, and optional edges. These knobs are domain- and URL-agnostic; the UI is a thin shell over the schema contract.
- **Zoom commands (toolbar/keyboard)**:
  - Zoom-in/out scales about the current viewport center (preserve the world point at `viewportW/2, viewportH/2`) so panning does not “bounce” back toward the graph centroid.
  - Only explicit `fit/reset` operations recenter on graph bounds/centroid; `reset` is defined as Fit-to-View framing.
- **Drag vs Zoom**:
  - While dragging nodes/groups in Flow Editor, wheel zoom is blocked to avoid node movement discontinuities.
  - Pointer drag and wheel handlers prevent default page scroll/zoom while the canvas is active.
- **Overlay viewport clamping**:
  - Screen-space overlays may be node-attached (track world→screen position and can leave the viewport like nodes) or detached (clamp using the active renderer viewport `viewportW/viewportH`). Detached overlays must avoid post-paint “snap back” corrections (layout-effect clamp to prevent border bounce).
  - Shared utilities: prefer `canvas/src/lib/ui/overlayClamp.ts` (viewport clamp) and `canvas/src/lib/react/useIsomorphicLayoutEffect.ts` (pre-paint correction without SSR hazards).
- **New Node Placement**:
  - New nodes appear at viewport center to prevent disorientation.

---

## Expand and Collapse (Clusters/Subgraphs/Layers)

- **Goal**: treat clusters, communities, and subgraphs as first-class graph layers with native expand/collapse behavior.
- **Interaction**:
  - Group label chevron click collapses/expands the group by toggling `collapsedGroupIds` in the store.
  - Alt + double-click preserves the previous “expand-select” behavior for bulk member selection.
  - Collapsed group-node chevron click expands by toggling the owning group id.
- **Render model**:
  - Collapse replaces member nodes with a derived “group node” carrying `kg:groupId`, `kg:groupMemberCount`, `kg:collapsed`.
  - Cross-group edges are aggregated and annotated with `kg:collapsedEdge` and `kg:edgeCount`.
