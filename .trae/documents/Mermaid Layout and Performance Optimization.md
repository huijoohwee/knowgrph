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

## 5. 16:9 Optimization and Full Syntax Support (New)
- **100% Flowchart Syntax Support**:
    - **Subgraph Edges**: Enabled edges connecting directly to/from subgraphs (e.g., `A --> Subgraph` or `Subgraph --> B`). Implemented a hybrid strategy using dummy nodes for robustness and `minlen` hints to encourage vertical stacking of subgraphs.
    - **Enhanced Parsing**: Updated `markdownJsonLdMermaidParser.ts` to support complex arrow syntax, including inline text labels (e.g., `A -- text --> B`) and extended arrow types (`o--o`, `x--x`, `<-->`).
    - **Unindented Block Scalars**: Fixed `lib/markdown.ts` to robustly handle YAML block scalars (like `mermaid: |`) where the content (e.g., `graph TD`) shares the same indentation as the key, preventing parsing failures for technically invalid but common frontmatter.
- **16:9 Layout Optimization**:
    - **Compact Separation**: Reduced default `nodesep` and `ranksep` scaling (capped at 0.8) to prevent massive horizontal spread in complex compound graphs. This ensures diagrams fit better within standard 16:9 viewports.
    - **Vertical Stacking Hints**: Added `minlen: 5` and `weight: 100` to edges connecting subgraphs, strongly encouraging Dagre to stack main sections vertically rather than placing them side-by-side.
    - **Configurable Separation**: Spacing scales with the `separation` schema property, allowing user control, but with a safe maximum limit.
- **Semantic HTML**:
    - Updated `MermaidDiagram.tsx` to use `<figure>` and `<figcaption>` elements instead of generic divs, improving accessibility and semantic structure.
- **Stability**:
    - **Deterministic Ordering**: Ensured stable node/edge ordering during layout passes to prevent "jitter" or chaotic re-ordering on updates.
    - **Crash Prevention**: Handled Dagre failures gracefully with fallback strategies (tight-tree) and robust error catching.
    - **Visual Centering**: Fixed layout centering logic to calculate bounding box based on actual node dimensions (including subgraphs) rather than just node centers, ensuring true visual centering on the canvas.
