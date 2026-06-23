# KnowGrph 2D Renderer Enhancement (Design)

## Scope

- This document defines the 2D renderer enhancement goals and constraints for in-repo, native implementation.
- It applies to 2D render variants (D3 Graph, Flowchart, GitGraph, Flow, Design, Flow Editor) and their shared behaviors across touchpoints; 3D and Voxel modes reuse the same SSOT GraphData/layout and canvas.jsonld contracts and are documented in the renderer and AgenticRAG Canvas directives.

## Hard Constraints

- Native in-repo implementation only.
- Forbid hardcoded or runtime dependencies on upstream design-tool repositories.
- Reuse existing SSOT for tokens, typography, icons, labels, and tooltips.
- Maintain unidirectional data flow: Store → Derivation → Render; forbid renderer mutating canonical store graph objects.
- Forbid cross-mode drift: switching touchpoints/modes/layouts/zooms must not change semantics.

### Repo Policy

- Enforced by the repo policy test `forbidPenpotRepoLiteral`.
- Do not include upstream repo identifiers in any form (URL, SSH remote, or owner/repo string) anywhere in-repo.

## Renderer Variants (2D)

### D3 Graph (SVG)

- Best for simulation-driven force layouts, immediate interaction, and inspectable DOM.
- Main risk: DOM churn (labels, edge paths) and tick-bound geometry work.

### Flow (Canvas2D)

- Best for high-density graphs and consistent frame budget.
- Main risk: inconsistent semantics vs D3 (fit/zoom, selection, group envelopes) if derivations diverge.

### GitGraph (Mermaid SVG)

- Best for Git history, branch, commit, checkout, and merge diagrams authored in YAML frontmatter `mermaid: |`.
- Main risk: parser drift if GitGraph commands are expanded by the Flowchart topology parser. GitGraph must remain diagram-code rendering unless a future source-owned semantic parser is added.

### Flow Editor (Canvas2D + Semantic Overlays)

- Best for editing workflows and flow editor widgets.
- Main risk: overlay re-render churn and viewport transform drift.

### Design (2D Webpage Wireframe)

- Best for DOM-derived webpage wireframes rendered as 2D frames over a neutral layout snapshot graph.
- Uses a browser-native layout export (`webpageLayout` snapshot) and deterministic DOM→graph conversion with domain-agnostic wrapper pruning, layout-glue cleanup, and synthetic section nodes. Export is implemented via a sandboxed hidden iframe (`kg-export-dom` layout mode) with URL-agnostic timing (networkIdle + domQuiet) and bounded snapshot capture.
- Frame layout is snapshot-driven: when a `webpageLayout` graph is available, Design uses DOM-derived coordinates and dimensions as the SSOT; when no snapshot is ready yet, Design shows a single placeholder frame (loading/error/idle) instead of a legacy non-webpage frame grid.
- Shares collective fit/center, zoom view keys, snap-to-grid, lasso, and align/distribute semantics with D3 and Flow, plus renderer-neutral shortcuts for align/distribute and keyboard nudging.
- Wireframe presentation is driven by schema metadata (`renderer:designWireframe`) and rendered via a Floating Panel "Design wireframe" section: controls include label/meta chips, text/media previews, depth fade, optional edges, and label-collision avoidance. These knobs are schema-only; the UI is a thin shell and remains host/URL-agnostic.

### Media (2D Rich Media + Video Sequence)

- Best for source-backed rich media inspection and video-sequence preview without forking Timeline ownership.
- Media canvas reuses the shared rich-media inventory and `RichMediaPanel`; video-sequence sources come from `kgVideoSequenceSources`, resolve through the runtime source registry, and must not persist stale blob URLs.
- BottomPanel `Timeline` owns video-sequence transport, playhead, cut/splice controls, selected-clip nudge/trim/snap/split editing, luma waveform, chroma vectorscope, histogram, audio waveform/mix monitors, lane slots, and source-backed Mermaid Gantt writeback. Clip edits operate on the grouped source lanes so video, mask, grade, and audio timing remains aligned.
- FloatingPanel `Timeline` remains the parsed row/list editor for Timeline or Gantt-Timeline frontmatter. It must not mount the BottomPanel transport shell.
- Cut/splice playback sync maps transport minutes to source media seconds through the compiled sequence plan, including gaps, repeated source segments, masks, grades, transitions, filters, adjustment layers, keyframes, effects, speed rows, images, scenes, and audio lanes.

## Parity SSOT (Must Match Across Variants)

### 1) Display Graph Derivation

- All variants must derive render inputs from the same display-graph derivation and filtering rules.
- Derivation should output:
  - Display nodes/edges arrays
  - Id lookup maps/sets
  - Group/cluster envelopes (when enabled)

### 2) Fit/Center/Zoom Contract

- Fit must operate on the collective visible graph (post filter/collapse), not per-node centering.
- Initialization must be idempotent:
  - If a valid stored transform is applied, do not also auto-fit in the same init pass.
  - Bounds guard: do not apply stale transforms until graph bounds are computable.
- Initialization group envelopes must derive from the same display-graph AABBs across D3, Flowchart, Flow, Design, and Flow Editor; Flow Editor extends these envelopes with zoom-aware pinned widget overlay extents so panels remain contained inside cluster/subgraph/layer borders on first paint.

### 3) Layer Stack Ordering

- Centralize 2D z-order ranks so groups/edges/nodes/labels/handles stack consistently.

### 4) Selection Semantics

- Selection applies the same rules in all variants:
  - Node/edge selection, multi-select, hover, and selection zoom behavior.
  - Selection updates must avoid restarting layouts/simulations.
- Multi-select and marquee semantics are SSOT across D3, Flow, and Design:
  - Click semantics: replace vs toggle selection is driven by the same modifier set (Shift/Cmd/Ctrl) and shared selection store.
  - Marquee/lasso semantics: `selectMode=lasso` uses shared add/remove/replace semantics (`Shift/Cmd/Ctrl` to add, `Alt` to remove, default to replace); lasso selection writes via the same expanded node-selection helper.
- Align/distribute and keyboard nudging share renderer-neutral shortcuts:
  - `Alt+Shift+L/H/R/T/V/B/X/Y` align or distribute selected nodes/frames; operations respect snap-grid settings and update layout caches via shared helpers.
  - Arrow-key nudging uses a shared helper for deltas; when snap-grid is enabled, nudges move by grid-sized steps (with Shift-based multipliers) and `Alt` bypasses snapping. Design frame nudges apply batched position patches; Graph/Flow nudges freeze layouts and persist positions via layout-position caches without re-seeding.

## Performance Strategy

### Budgets

- Frame budget: avoid tick-time work that scales worse than O(N + E) per frame.
- Avoid synchronous heavy work during render/interaction (typing, zoom, pan, selection).

### Hot-Path Rules

- Prefer memoized derivations keyed by topology (revision/hash) and minimal renderer config.
- Gate expensive work by mode and by alpha/idle state.
- Prefer rAF coalescing for DOM updates (selection styling, overlays).

### Rendering Optimizations (Incremental)

- D3 Graph:
  - Reduce per-tick edge endpoint computations and avoid per-edge DOM writes when alpha is low.
  - LOD for labels: hide below scale threshold using schema knobs.
  - Batch style updates for selection/hover.
- Flow/Flow Editor:
  - Cache token reads and text metrics per theme key.
  - Cache glyphs/text layouts where safe.
  - Avoid per-event full redraw if only overlays changed.

## Shared Utilities (Centralize)

- Viewport math: bounds computation, fit transform, zoom quantization.
- Scheduling: debounce/throttle/rAF coalescing.
- Worker RPC: request/response protocol, abort/timeout semantics.
- Perf instrumentation: stage-based measurements and event dispatch (opt-in).

## Cross-Touchpoint Expectations

- Switching between Editor workspace, Graph Data Table, Graph Fields, Props Panel, Markdown surfaces, Explorer, and Canvas Preview:
  - Must not reset layout unexpectedly.
  - Must preserve pinned/fit/selection zoom semantics.
  - Must not cause hidden renderers to consume shared requests.

## Acceptance Criteria (Bounded)

- No upstream design-tool repository URL literals exist in the repository.
- 2D render variants share the same display-graph derivation and fit/zoom initialization contract.
- Switching 2D variants preserves mental map: no chaotic clustering or excessive void-space regressions.
- Bounded validation: focused renderer/parser tests and `npm run typecheck` pass; full `npm run test:ci` remains a release-level gate.
