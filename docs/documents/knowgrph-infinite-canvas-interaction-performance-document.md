# Infinite Canvas Interaction & Performance (Knowgrph)

## Scope

This document describes the implemented interaction surfaces and performance safeguards for the infinite canvas graph workspace.
It is strictly code-backed: it documents the current behavior and forbids duplicate/legacy panels that reintroduce conflicting gesture ownership or rerender/recompute loops.

## UI Surfaces (SSOT)

### Floating Panel (Tool Menu)

- The Floating Panel is the single SSOT shell for Canvas tool surfaces.
- The active view is switchable (Props / Inspector / Chat / Geo / Renderer / Graph Traversal).

### Props Panel + Interaction Panel (paired)

- When the Floating Panel view is **Props**, an adjacent **Interaction** floating panel appears to the right of it.
- Interaction is intentionally separated from Props so pointer/scroll interactions remain stable and do not require opening a separate “Arrange” surface.
- Forbid any additional “Arrange” panel variants (canvas overlays, editor tabs, or legacy side panels) that duplicate these controls.

#### Interaction panel contents

- **Interaction**
  - `Select/Drag` vs `Pan` (mode is stored in the host state and respected by both zoom/pan and D3 drag).
  - Layout selector: `Force` / `Radial` (writes `schema.layout.mode`).
- **Centering / Centroid**
  - Center on Selection (centroid of selected nodes)
  - Center on All Items (centroid of all nodes)
- **Even Spread**
  - Distribute Horizontally / Vertically (requires 3+ selected nodes)
- **Performance**
  - Optional perf overlay toggle that enables structural-only perf events and shows:
    - Render updates/sec
    - State updates/sec
    - Last layout init (ms)

## Interaction Ownership Rules

- Pan/drag/zoom must not conflict: pointer mode gates node/edge drag and allows pan-on-node in Pan mode.
- Interaction handlers must not capture stale state:
  - Prefer stable handlers + store getters/refs for hot paths.
  - Avoid per-frame React rerenders during pan/zoom.

## Performance Safeguards

- Forbid recomputation loops when switching modes/layouts.
- Cache layout positions by the active layout cache key; do not reseed unless inputs change.
- Perf overlay is opt-in and must not run unless the user enables it.

## Implementation Pointers

- Floating Panel shell + views: `knowgrph/canvas/src/features/toolbar/ToolbarToolMenu.tsx`
- Interaction panel body: `knowgrph/canvas/src/features/canvas/InfiniteCanvasInteractionPanel.tsx`
- D3 drag guard in Pan mode: `knowgrph/canvas/src/components/GraphCanvas/drag.ts`
- D3 zoom/pan behavior: `knowgrph/canvas/src/components/GraphCanvas/zoom.ts`

