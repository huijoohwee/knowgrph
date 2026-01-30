# Knowgrph Graph Canvas Layout SSOT

## Single Source Of Truth

Graph Canvas layout behavior is defined by a small set of SSOT modules. All modes/layouts must reuse these to prevent drift when switching across (layoutMode, renderMode, presentation toggles).

| Concern | SSOT Module | Notes |
|---|---|---|
| Layout defaults (force/fit/collision/groups/stratify) | `canvas/src/lib/graph/layoutDefaults.ts` | Canonical numeric defaults + safe readers. Any fallback logic must live here (not spread across schema/editor/simulation). |
| Node extents (render + labels) | `canvas/src/components/GraphCanvas/layout/overlap.ts` | `getNodeAabbHalfExtentsWithLabel` is the canonical AABB used by collision + group bounds (schema-aware cache to avoid stale extents). |
| Collision knobs (node + group) | `canvas/src/components/GraphCanvas/layout/collisionConfig.ts` | `readCollisionConfig` is the only knob reader; schema-driven and shared across Force/Radial/Stratify. |
| Node collision (AABB) | `canvas/src/components/GraphCanvas/layout/overlap.ts` | `createBboxCollideForce` must only be created with knobs from `readCollisionConfig(...).nodeBbox`. |
| Group collision (AABB) | `canvas/src/components/GraphCanvas/layout/groupOverlap.ts` | `createGroupBboxCollideForce` must only be created with knobs from `readCollisionConfig(...).groupBbox`. |
| Fit-to-screen options | `canvas/src/components/GraphCanvas/layout/fitConfig.ts` | `readFitAllOptions` is the only schema→fit mapping; Stratify defaults to 80/20 fill (`layout.stratify.fitFillRatio`). |
| Group key derivation (Group boxes) | `canvas/src/components/GraphCanvas/layout/layoutGroupKey.ts` | `createLayoutGroupKeyOfNode` derives a single collision grouping from rendered graph groups (Mermaid subgraphs → Markdown headings → keyword layers → communities). |
| Legacy group key derivation (Hierarchy) | `canvas/src/components/GraphCanvas/layout/grouping.ts` | Fallback keying via `visual:topParentId`/`visual:parentId`, else top Markdown Section (via `hasSection/hasBlock/hasItem/embedsImage`). |
| Cohesion targets (X/Y anchors) | `canvas/src/components/GraphCanvas/layout/grouping.ts` | `computeGroupTargets` provides stable centroids for force anchoring. |
| Force-mode seeding | `canvas/src/components/GraphCanvas/layout/seeding.ts` | `applyForceModeSeeds` defines the only allowed seed order (Mermaid → Markdown headings → heuristic cluster). |
| Structured-mode relaxation | `canvas/src/components/GraphCanvas/layout/relax.ts` | `relaxNodesWithCollision` is the only allowed post-layout relaxation pass for Radial/Stratify. |
| Group bounds rendering | `canvas/src/components/GraphCanvas/layers/groups.ts` | Group boxes use label-aware AABBs so outlines don’t clip labels; forbid ad-hoc sizing. |
| Render Z-order | `canvas/src/components/GraphCanvas/zOrder.ts` | `applyGraphCanvasZOrder` is the only z-layer ordering entry point. |
| Update timing | `canvas/src/components/GraphCanvas/scene.ts` | Group outlines update via `beforeRenderFrameRef` so they track simulation without influencing it. |

## Configuration Knobs

All overlap/collision behavior must be configured via schema only.

```yaml
layout:
  forces:
    bboxCollide: boolean
    bboxCollideStrength: number
    bboxCollidePadding: number
    bboxCollideIterations: number
    groupBboxCollide: boolean
    groupBboxCollideStrength: number
    groupBboxCollidePadding: number
    groupBboxCollideIterations: number
    structuredRelaxSteps: number
  groups:
    enabled: boolean
    padding: number
    labelPadding: number
  stratify:
    reuseSeedStrength: number
    fitFillRatio: number
```

Notes:
- Group collision is always enforced when `layout.groups.enabled !== false` (schema may keep `groupBboxCollide` for backward compatibility, but it does not disable the constraint).
- Group collision accounts for group label overhead (top padding) to reduce label-region overlap and to prevent group box overlap.
