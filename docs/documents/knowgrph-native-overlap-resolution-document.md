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

- **Enhanced Spatial Indexing**: Uses `d3.quadtree` (O(n log n)) to efficiently query potential collisions.
- Build a `d3.quadtree` every iteration over current node positions.
- For each node `a`, visit quadtree nodes that intersect `a`’s expanded bounds.
- For each neighbor `b` in intersecting leaves, compute overlap `(ox, oy)`:
  - `ox = (aHalfW + bHalfW) - abs(dx)`
  - `oy = (aHalfH + bHalfH) - abs(dy)`
- If overlap exists, push along the smaller axis (x if `ox < oy`, else y).
- Respect pinned nodes (`fx`/`fy`) by redirecting impulse to the unpinned counterpart.

**Implementation**: [createBboxCollideForce](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/layout/overlap.ts)

---

## Configuration Schema

Defined in [schemaTypes.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/lib/graph/schemaTypes.ts) and defaulted in [schema.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/lib/graph/schema.ts).

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
```

---

## Integration Points

| Location | Integration | Behavior |
|---|---|---|
| [simulation.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/simulation.ts) | `.force('bboxCollide', ...)` | Adds label-aware overlap resolution in force mode |
| [simulation.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/simulation.ts) | `.force('groupBboxCollide', ...)` | Prevents group-box overlap in force mode (schema-driven group knobs) |
| [schema.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/lib/graph/schema.ts) | defaults | Enables bbox collide by default |

---

## Testing & Quality Standards

| Context | Intent | Directive |
|---|---|---|
| Type safety | Prevent drift | - [ ] Add new force keys to schemaTypes; forbid untyped force config |
| Performance | Avoid regressions | - [ ] Keep iterations low; prune quadtree visits; forbid heavy per-tick work |
| Stability | Avoid jitter | - [ ] Use small impulses scaled by alpha; forbid abrupt position jumps |

---

## Anti-Patterns (Forbidden)

| Context | Intent | Directive |
|---|---|---|
| Copying repos | Original implementation | - [ ] Forbid copying code from collision benchmarks/playgrounds |
| Global n² loops | Performance | - [ ] Forbid checking every pair on every tick in production mode |
| Ignoring labels | UX | - [ ] Forbid collision models that only consider node cores when labels render |
