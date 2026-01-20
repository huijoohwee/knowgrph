# Knowgrph UI/UX Design: Universal Interaction Specification

## Design Mantras

```
- [ ] Affordances; preserve user interactions; forbid breaking UI gestures
- [ ] Clarity; communicate state explicitly; forbid implicit behavior
- [ ] Consistency; align UI and schema semantics; forbid divergent vocabularies
- [ ] Neutrality; support any domain content; forbid domain-specific UI assumptions
- [ ] Performance; keep interactions responsive; forbid unthrottled hot-path work
- [ ] Stability; cleanup listeners and timers; forbid memory leaks
```

---

## Universal Design Principles

| Context        | Intent                         | Directive                                                                   |
|----------------|--------------------------------|-----------------------------------------------------------------------------|
| Interaction    | Preserve affordance contracts  | - [ ] Keep gestures stable; forbid hidden breaking changes                  |
| Observability  | Make state legible             | - [ ] Surface selection/filters/modes; forbid invisible mode changes        |
| Performance    | Maintain frame budget          | - [ ] Debounce/throttle hot events; forbid per-mousemove heavy computation  |
| Neutrality     | Avoid domain coupling          | - [ ] Drive labels and semantics via config; forbid dataset-specific UX     |
| Accessibility  | Support inclusive usage        | - [ ] Use semantic roles/labels; forbid inaccessible controls               |

---

## UI Architecture

**Component Stack**: Canvas Page → Canvas Renderer → Panels → Editors → Tooling

**Interaction Flow**: Input → Selection → Inspection → Edit → Persist → Render refresh

---

## Core User Journeys

### Journey A: Import → Inspect → Navigate

**From/To**: User selects input → parser loads graph → renderer draws scene → user navigates via pan/zoom and selection.

- Canvas entry: [Canvas.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/pages/Canvas.tsx)
- Renderer: [GraphCanvas.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas.tsx)
- Store: `canvas/src/hooks/useGraphStore.ts`

### Journey B: Mode Switching (Layer + Layout)

**From/To**: User changes schema settings → graph derivation/layout updates → view remains stable (bounded reflow).

- Layer derivation: [layerDerivation.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/lib/graph/layerDerivation.ts)
- Layout caching: [positioning.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/layout/positioning.ts)

### Journey C: Edit Graph (Nodes/Edges)

**From/To**: User edits node/edge → store updates immutably → renderer reflects changes → selection preserved.

- Edit interactions: `canvas/src/features/*`
- Visual highlight: `canvas/src/components/GraphCanvas/highlight.ts`

### Group Shape Toggle
- **Toggle**: Button with Square/Hexagon icon next to Frontmatter Mode.
- **Function**: Switches `schema.layout.groups.shape` between `rect` (default) and `geo`.
- **Visuals**:
  - `rect`: Renders groups as rectangular bounding boxes.
  - `geo`: Renders groups as native convex rings around member nodes.

### Frontmatter Mode

---

## Interaction Contracts

| Interaction | Trigger | Effect | Stability Constraint |
|------------|---------|--------|----------------------|
| Select node | Click node | Store selection updates | Must not trigger full scene rebuild unnecessarily |
| Select edge | Click edge | Store selection updates | Must not invalidate layout caches |
| Context menu | Right click canvas | Open props/actions | Must cleanup listeners on close/unmount |
| Pan/zoom | Drag/scroll | Update viewport transform | Must keep updates throttled and stable |
