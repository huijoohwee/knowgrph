# Mermaid Layout and Performance Optimization

## Overview
This document details the optimizations and fixes applied to the Mermaid layout engine and Graph Canvas rendering performance.

## 1. Mermaid Subgraph Rendering
- **Rectangular Hulls**: Implemented native rectangular bounding boxes for `MermaidSubgraph` nodes, replacing the default convex hulls. This aligns with the visual style of `mermaid-land` and standard Mermaid diagrams.
- **Node Visibility**: Fixed visibility issues by:
    - Ensuring graph layers (subgraphs) are rendered *before* nodes in the SVG DOM order (`scene.ts`).
    - **Z-Ordering**: Implemented depth-based sorting of subgraphs in `nodeGroups.ts` (Root First / Parent First). This ensures that parent subgraphs are drawn at the bottom, and nested child subgraphs are drawn on top, preventing opaque parents from obscuring children.
    - Applying specific `mermaid-land` styling: `#f4f4f4` fill, 100% opacity, `#333` solid stroke.
- **Custom Styling**: Added support for styling overrides via Mermaid class definitions. The renderer now respects `fill`, `stroke`, `stroke-width`, and `stroke-dasharray` properties on the subgraph owner node (`graphLayerStyles.ts`) and regular nodes (`helpers.ts`).
- **Label Positioning**: Adjusted label positioning for Mermaid Subgraphs to appear at the top-inside of the bounding box (14px padding), improving readability. Labels now dynamically update their position during drag operations.
- **Implementation Details**:
  - Modified `graphLayers.ts` to calculate min/max bounds for Mermaid groups.
  - Updated `GraphLayerHullGeometry` to support `topY` property.
  - Updated `sceneHandlers.ts` and `graphLayers.ts` to use `topY` for label placement.
  - Updated `graphLayerStyles.ts` to apply Mermaid-specific visual styles and overrides.

## 2. Layout Caching & Performance
- **Robust Caching**: Enhanced `determineLayoutPositions` in `positioning.ts` to include `edgesRevision` in the cache key. This ensures that layout is re-calculated only when the graph topology (nodes or edges) changes, preventing stale layouts while maximizing cache hits for unrelated state updates (e.g., selection, panel toggles).
- **Memoization**: Added memoization to `wrapTextByMaxChars` in `mermaid.ts`. This reduces the overhead of text wrapping during layout calculations, especially for graphs with many nodes or long labels.
- **Skip Initial Layout**: Verified and hardened the `skipInitialLayout` logic to prevent redundant `dagre` computations when switching between views or resizing the window, provided the graph structure hasn't changed.

## 3. Guideline Updates
- Updated `system-design-guidelines.md` with explicit directives for:
    - Revision-aware layout caching.
    - Memoization of expensive utilities.
    - Incremental updates for window resizing.
    - Redundant logic cleanup.

## 4. Code Cleanup
- Refactored `graphLayers.ts` to cleanly separate Mermaid-specific rendering logic.
- Ensured consistent usage of `visual:width` and `visual:height` properties across layout and rendering layers.
