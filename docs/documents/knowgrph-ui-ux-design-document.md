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
| Markdown text selection | Click / double click / triple click in Viewer/Presentation | Native selection only (caret anchor / word / paragraph) | Must not hijack native selection gestures |
| Markdown “Show on/in …” | Right click in Editor/Viewer/Presentation | Open Selection Toolbar at exact pointer position | Must not “fly out”; must not use Monaco default context menu |
| Markdown apply + toggle | Cmd/Ctrl+Enter in Markdown section | Apply (when in Editor) and toggle Editor↔Viewer | Must be scoped to BottomPanel Markdown root (no global hijack) |
| Pan/zoom | Drag/scroll | Update viewport transform | Must keep updates throttled and stable |
| Toast notification | Store adds toast | Surface transient status/errors | Must not overlap; newest stays at default Y and pushes older downward |

---

## Typography & Icon Alignment

| Context | Intent | Directive |
|---------|--------|-----------|
| UI Controls | Keep icon+text rows visually stable | - [ ] Use `inline-flex items-center` for icon+text; forbid baseline drift from mixed inline layout |
| Icons (Lucide) | Align icon glyphs with text | - [ ] Apply shared icon baseline alignment; forbid per-component ad-hoc offsets |
| SVG Labels | Keep label center alignment consistent | - [ ] Anchor and baseline-align SVG text; forbid default-anchor mismatches that overlap nodes |

**Reference implementations**
- Global Lucide icon alignment: [index.css](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/index.css)
- Icon+text combobox controls: [GraphDataTableUiPrimitives.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/graph-data-table/ui/GraphDataTableUiPrimitives.tsx)
- Canvas node label anchoring/baseline: [labels.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/components/GraphCanvas/layers/labels.ts)

---

## Notifications (Toast)

**Primary directive**: Use Toast for transient UI feedback; forbid duplicate “Banner” implementations drifting from toast behavior.

| Context | Intent | Directive |
|---------|--------|-----------|
| Toast stacking | Keep notifications legible | - [ ] Newest toast anchors at default Y; older push downward; forbid overlap |
| Toast lifetime | Avoid sticky noise | - [ ] Default auto-dismiss by TTL; allow persistent “loading” toasts only with explicit dismiss |
| State transitions | Preserve causality | - [ ] For event transitions (loading → loaded/error), emit a new toast event and dismiss loading shortly after; forbid overwriting status so users miss the transition |
| Cleanup | Avoid leaks | - [ ] Clear timers/listeners on unmount; forbid orphaned intervals/timeouts |
