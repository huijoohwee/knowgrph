# Knowgrph Native Overlap Resolution Document

## Design Mantras

```
- [ ] Native Implementation; implement overlap resolution in-repo; forbid copied external algorithms
- [ ] Label Awareness; include label extents in collisions; forbid text-over-text clutter
- [ ] Performance Locality; use broadphase pruning; forbid global O(n²) per tick
- [ ] Deterministic Behavior; avoid randomness; forbid non-reproducible layout steps
- [ ] Configurability; tune via schema.layout.forces; forbid hardcoded force params
```

---

## Universal Design Principles

| Context        | Intent                         | Directive                                                                 |
|---------------|--------------------------------|---------------------------------------------------------------------------|
| Performance   | Keep tick cost bounded         | - [ ] Use spatial indexing; prune far pairs; forbid quadratic blowups     |
| Separation    | Avoid overlaps                 | - [ ] Resolve AABB overlaps; forbid persistent collisions                 |
| Compatibility | Work with D3 simulation        | - [ ] Implement as a D3 force; forbid out-of-band mutation loops          |
| Configuration | Make behavior explicit         | - [ ] Declare defaults in schema; forbid untyped config keys              |
| UX            | Preserve natural arrangement   | - [ ] Apply small per-tick corrections; forbid jumpy teleporting          |

---

## Module Specifications

### Module: Label-Aware Extents

**Responsibility**: Compute node half-extents that include label offsets and approximate label size.

**Interface**: `getNodeAabbHalfExtentsWithLabel(node, schema)` → `{ halfW, halfH }`

**Implementation**: [overlap.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/layout/overlap.ts)

### Module: Native BBox Collision Force

**Responsibility**: Resolve AABB overlaps by applying velocity impulses along the least-penetration axis.

**Interface**: `createBboxCollideForce({ schema, padding, strength, iterations })`

**Algorithm Summary**

- **Enhanced Spatial Indexing**: Uses `PackedRTree` (O(n log n)) to efficiently query potential collisions.
- Build a packed static R-tree once per tick over current node positions (Morton/Z-order sorting).
- For each node `a`, query candidate neighbors intersecting `a`’s expanded bounds.
- For each neighbor `b` in intersecting leaves, compute overlap `(ox, oy, oz)`:
  - `requiredGapX = aGapX + bGapX` (sum of axis-aware gaps; enforces stricter separation than max)
  - `ox = (aHalfW + bHalfW + requiredGapX) - abs(dx)`
  - `oy = (aHalfH + bHalfH + requiredGapY) - abs(dy)`
  - `oz = (aHalfD + bHalfD + requiredGapZ) - abs(dz)` (only when Z is explicitly used)
- If overlap exists (adjusted by `touchEpsilonX/Y/Z`), push along the smallest axis (x/y and z when enabled).
- **Deep Nesting No-Stick**: Apply the same separation rule at every nesting level so inner groups do not snap/touch/stick to outer group borders.
- Respect pinned nodes (`fx`/`fy`) by redirecting impulse to the unpinned counterpart.
- Use `touchEpsilonPx` (or axis-specific `touchEpsilonX/Y`) to treat near-touch as a collision (stabilizes “snap/stick” at exact contact).

**Implementation**: [createBboxCollideForce](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/layout/overlap.ts)

### Module: Group Box Collision (No-Stick)

**Responsibility**: Prevent group boxes (clusters/subgraphs) from snapping/touching/sticking to each other, including deep nesting (inner group vs outer group).

**Interface**: `resolveGroupCollisions({ groups, nodes, strength, touchEpsilon })`

**Algorithm Summary**

- Use a packed spatial index (`PackedRTree`, Morton/Z-order) for broadphase candidate queries.
- Compute axis-aware overlap using **sum-of-gaps** (`gapA + gapB`) per axis so separation is stricter than `max`.
- Apply `touchEpsilon` so near-touch is treated as overlap, preventing exact-contact sticking.
- Model each box with indexed borders: inner `x2..x4 / y2..y4 / z2..z4` and outer envelope `x1..x5 / y1..y5 / z1..z5` (gap expands outer envelope); forbid inner borders from touching/snap-sticking to any other box's outer envelope.
- Apply the same separation rule at every nesting level (L3 vs L2, L2 vs L1).
- Also repel non-member nodes away from group outer borders (member nodes are excluded so containment is preserved).
- Z axis is only enabled when both boxes explicitly provide Z (a finite `cz`, `halfD`, or explicit `gapZ`/`hasZ`); otherwise the solver treats Z as infinite overlap so 2D flows never accidentally push in Z.

**Implementation**: [boxCollision.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/grph-shared/src/collision/boxCollision.ts)

---

## Configuration Schema

Defined in [schemaTypes.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/lib/graph/schemaTypes.ts) and defaulted in [schema.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/lib/graph/schema.ts).

```yaml
layout:
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
    groupBboxCollideNestedTouchEpsilonPx: number
    groupBboxCollideNestedTouchEpsilonXPx: number
    groupBboxCollideNestedTouchEpsilonYPx: number
    groupBboxCollideNestedTouchEpsilonZPx: number
    groupBboxCollideZEnabled: boolean
    groupBboxCollideExtraGapPx: number
    groupBboxCollideExtraGapZPx: number
    groupBboxCollideIterations: number
    structuredRelaxSteps: number
```

Notes:
- Group bbox collision is enforced whenever `layout.groups.enabled !== false`; `groupBboxCollide` is deprecated for disabling but its tunables still apply.

---

## Integration Points

| Location | Integration | Behavior |
|---|---|---|
| [simulation.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/simulation.ts) | `.force('bboxCollide', ...)` | Adds label-aware overlap resolution in force mode |
| [simulation.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/simulation.ts) | `.force('groupBboxCollide', ...)` | Prevents group-box overlap in force mode (enforced when groups enabled; schema-driven group knobs) |
| [schema.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/lib/graph/schema.ts) | defaults | Enables bbox collide by default |

---

## Testing & Quality Standards

| Context | Intent | Directive |
|---|---|---|
| Type safety | Prevent drift | - [ ] Add new force keys to schemaTypes; forbid untyped force config |
| Performance | Avoid regressions | - [ ] Keep iterations low; prune spatial-index queries; forbid heavy per-tick work |
| Stability | Avoid jitter | - [ ] Use small impulses scaled by alpha; forbid abrupt position jumps |
| Nested Groups | Prevent sticking | - [ ] Verify inner group containment; forbid disjoint sibling collisions; see [flowCollisionSticking.test.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/__tests__/flowCollisionSticking.test.ts) |

---

## Anti-Patterns (Forbidden)

| Context | Intent | Directive |
|---|---|---|
| Copying repos | Original implementation | - [ ] Forbid copying code from collision benchmarks/playgrounds |
| Global n² loops | Performance | - [ ] Forbid checking every pair on every tick in production mode |
| Ignoring labels | UX | - [ ] Forbid collision models that only consider node cores when labels render |
