# KnowGrph 2D Renderer Enhancement (Design)

## Scope

- This document defines the 2D renderer enhancement goals and constraints for in-repo, native implementation.
- It applies to 2D render variants (D3 Graph, Flow, Flow Editor) and their shared behaviors across touchpoints.

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

### Flow Editor (Canvas2D + Semantic Overlays)

- Best for editing workflows and node quick editors.
- Main risk: overlay re-render churn and viewport transform drift.

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

### 3) Layer Stack Ordering

- Centralize 2D z-order ranks so groups/edges/nodes/labels/handles stack consistently.

### 4) Selection Semantics

- Selection applies the same rules in all variants:
  - Node/edge selection, multi-select, hover, and selection zoom behavior.
  - Selection updates must avoid restarting layouts/simulations.

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
- Bounded validation: `npm run typecheck` and `npm run test:ci` pass.
