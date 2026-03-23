# Knowgrph Graph Canvas Layout SSOT

## Single Source Of Truth

Graph Canvas layout behavior is defined by a small set of SSOT modules. All modes/layouts must reuse these to prevent drift when switching across (layoutMode, renderMode, presentation toggles).

| Concern | SSOT Module | Notes |
|---|---|---|
| Schema layout-engine fingerprint (2D) | `canvas/src/lib/canvas/schema-layout-engine-json.ts` | Canonical schema→layout-engine JSON used by both zoom-view keys and layout-view keys. Must include `schema.layout.flow` to avoid D3/Flow/Design/Flow Editor drift. |
| Layout defaults (force/fit/collision/groups/flow) | `canvas/src/lib/graph/layoutDefaults.ts` | Canonical numeric defaults + safe readers (including Flow layout knobs). Any fallback logic must live here (not spread across schema/editor/simulation). |
| Node extents (render + labels) | `canvas/src/components/GraphCanvas/layout/overlap.ts` | `getNodeAabbHalfExtentsWithLabel` is the canonical AABB used by collision + group bounds (schema-aware cache to avoid stale extents). |
| Collision knobs (node + group) | `canvas/src/components/GraphCanvas/layout/collisionConfig.ts` | `readCollisionConfig` is the only knob reader; schema-driven and shared across Force/Radial. |
| Node collision (AABB) | `canvas/src/components/GraphCanvas/layout/overlap.ts` | `createBboxCollideForce` must only be created with knobs from `readCollisionConfig(...).nodeBbox`. |
| Group collision (AABB) | `canvas/src/components/GraphCanvas/layout/groupOverlap.ts` | `createGroupBboxCollideForce` must only be created with knobs from `readCollisionConfig(...).groupBbox`. Group collision also repels non-member nodes from group borders. |
| Fit-to-screen options | `canvas/src/components/GraphCanvas/layout/fitConfig.ts` | `readFitAllOptions` is the only schema→fit mapping. |
| Fit frame + zoom presets | `grph-shared/src/zoom/presets.ts` | `ZOOM_VIEWPORT_PRESET_16_9` + `computeFitFrame` are available as fallbacks, but layout/fit must use actual viewport dimensions when available (>100px). Forbid artificial 16:9 constraints on non-standard viewports. |
| Group key derivation (Group boxes) | `canvas/src/components/GraphCanvas/layout/layoutGroupKey.ts` | `createLayoutGroupKeyOfNode` derives a single collision grouping from rendered graph groups (Mermaid subgraphs → Markdown headings → keyword layers → communities). |
| Legacy group key derivation (Hierarchy) | `canvas/src/components/GraphCanvas/layout/grouping.ts` | Fallback keying via `visual:topParentId`/`visual:parentId`, else top Markdown Section (via `hasSection/hasBlock/hasItem/embedsImage`). |
| Force-mode seeding | `canvas/src/components/GraphCanvas/layout/seeding.ts` | `applyForceModeSeeds` defines the only allowed seed order (Mermaid → Markdown headings → heuristic cluster). |
| Structured-mode relaxation | `canvas/src/components/GraphCanvas/layout/relax.ts` | `relaxNodesWithCollision` is the only allowed post-layout relaxation pass for structured modes (Radial). |
| Relax step runner | `canvas/src/lib/graph/collision/relaxRunner.ts` | Shared alpha schedule + integrate/damping loop used by both Graph and Flow collision relaxation passes. |
| Group bounds rendering | `canvas/src/components/GraphCanvas/layers/groups.ts` | Group boxes use label-aware AABBs so outlines don’t clip labels; forbid ad-hoc sizing. |
| 2D layer order ranks | `canvas/src/lib/canvas/layerOrder2d.ts` | Canonical 2D layer ranks (nodes/edges/groups/labels/handles) reused by both SVG z-order and native canvas draw order. |
| Render Z-order (SVG) | `canvas/src/components/GraphCanvas/zOrder.ts` | `applyGraphCanvasZOrder` applies the shared 2D ranks to SVG layer DOM order. |
| Update timing | `canvas/src/components/GraphCanvas/scene.ts` | Group outlines update via `beforeRenderFrameRef` so they track simulation without influencing it. |

## Configuration Knobs

All overlap/collision behavior must be configured via schema only.

```yaml
layout:
  flow:
    engine: auto | elk | dagre | grid
    elkLayout: elk | elk.layered | elk.force | elk.mrtree | elk.stress
    rankdir: TB | LR
  forces:
    bboxCollide: boolean
    bboxCollideStrength: number
    bboxCollidePadding: number
    bboxCollidePaddingX: number
    bboxCollidePaddingY: number
    bboxCollidePaddingZ: number
    bboxCollideTouchEpsilonPx: number
    bboxCollideTouchEpsilonXPx: number
    bboxCollideTouchEpsilonYPx: number
    bboxCollideTouchEpsilonZPx: number
    bboxCollideZEnabled: boolean
    bboxCollideIterations: number
    groupBboxCollide: boolean
    groupBboxCollideStrength: number
    groupBboxCollidePadding: number
    groupBboxCollidePaddingX: number
    groupBboxCollidePaddingY: number
    groupBboxCollidePaddingZ: number
    groupBboxCollideTouchEpsilonPx: number
    groupBboxCollideTouchEpsilonXPx: number
    groupBboxCollideTouchEpsilonYPx: number
    groupBboxCollideTouchEpsilonZPx: number
    groupBboxCollideZEnabled: boolean
    groupBboxCollideExtraGapZPx: number
    groupBboxCollideIterations: number
    structuredRelaxSteps: number
    antiLineForce: boolean
    antiLineStrength: number
    antiLineAlphaMin: number
    antiLineTickInterval: number
    postFitForce: boolean
    postFitStrength: number
    postFitAlphaMax: number
  groups:
    enabled: boolean
    padding: number
    labelPadding: number
```

Notes:
- `layout.mode` supports `force`, `radial`, and `mermaid` (legacy `stratify` inputs are coerced to `force`).
- Frontmatter mode is only “effective” when the active graph contains frontmatter Mermaid seed nodes; otherwise filtering is a no-op and cache keys must not change.
- `layout.flow.rankdir` controls the canonical top-bottom vs left-right flow direction.
- Layout position caches must be isolated by the full key `(datasetKey, semanticMode, frontmatterMode, layoutMode, renderMode, renderVariant, layoutVariant?, viewKey, mediaPanelDensity, renderMediaAsNodes)` (no fallback to partial/legacy keys).
- Zoom view keys must be derived from the same inputs across 2D renderer variants; mismatched schema fingerprints can cause keyed zoom state misses and restart-time “stuck offscreen” views.
- Layout recompute/skip logic must account for previous renderVariant so toggling D3 ↔ Flow cannot incorrectly skip a required layout refresh.
- Flow treats `layoutVariant` as a hard layout-change trigger: it must participate in layout recompute keys, render-scene rebuild keys, and cross-renderer seed selection.
- Flow post-layout collision relaxation must not rely only on “unstable positions” heuristics; use an overlap-pressure guard so overlapping-but-stable layouts still get a bounded relax pass.
- D3 “collective fit + freeze” must include a bounded collision relax pass before final fit/transform to reduce residual overlaps without restarting simulation.
  - `layout.forces.antiLine*` controls a short de-line pass that breaks long thin bands while preserving macro layout.
  - `layout.forces.postFit*` controls the bounded expansion/settle pass that spreads the graph into the viewport before Fit/Freeze; toolbar Reset must not change these knobs.
  - `layout.forces.physics2d*` controls collision/repulsion tuning across *all* 2D graph elements (nodes, groups, labels, rich media as nodes, panels):
    - `physics2dChargeScale`, `physics2dCollideStrengthScale`, `physics2dBboxStrengthScale`
    - `physics2dVelocityDecayBias`, `physics2dMaxSpeedScale`
    - `physics2dStrictOverlapScale`, `physics2dLabelNudgeScale`
    - `physics2dDragChargeScale`, `physics2dDragDistanceMaxPx`
- Design surface must batch multi-frame position patches when resolving collisions (avoid per-node store writes that can cause rerender churn).
- Group collision is always enforced when `layout.groups.enabled !== false` (schema may keep `groupBboxCollide` for backward compatibility, but it does not disable the constraint).
- Group collision accounts for group label overhead (top padding) to reduce label-region overlap and to prevent group box overlap.
- Collision relax determinism: any force initializer RNG must be seeded from stable inputs (e.g., node ids); forbid `Math.random` initializers that change layout per run.
- Collision relax locality: bounded relax passes must clamp displacement so overlap removal cannot destroy macro layout.
- Flow packing cohesion: collective packing must treat group membership as connectivity so subgraphs/groups/clusters remain cohesive even when edges are sparse.
- Zoom Reset semantics: toolbar Reset is defined as Fit-to-View framing (centroid + group-aware bounds) and must not trigger any layout mutation.
- The default baseline experience is anchored by `LS_KEYS.documentStructureBaselineLock` (default on): it disables mode switches (Keyword/Frontmatter/Renderer/3D/Select/Create) so Editor/Canvas/Table/Preview stay content-aligned.

## Rebase & Conflict Resolution Notes

- When resolving divergence that touches layout/zoom ordering, treat `canvas/src/components/GraphCanvas/scene.ts` as SSOT for initial transform application and forbid reintroducing “double-fit” jumps.
- Prefer preserving both: (1) collision relaxation before the force run (layout stability) and (2) schema-driven fit logic via `readFitAllOptions` + `fitAllTransform` (viewport stability).
- Do not hand-merge `canvas/tsconfig.tsbuildinfo`; regenerate it by running `npm --prefix canvas run check` or `npm --prefix canvas run build`.
