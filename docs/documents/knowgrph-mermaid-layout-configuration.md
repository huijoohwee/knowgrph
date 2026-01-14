# Mermaid Layout Configuration

This document describes the configuration options and behavior of the enhanced Mermaid Layout in KnowGrph.

## Overview

The Mermaid Layout (`mode: 'mermaid'`) provides a hierarchical, flowchart-like visualization using the **Dagre** layout engine. It is designed to be:
- **Neutral & Project-Agnostic**: Works with any graph data.
- **Well-Spread**: Uses optimized separation defaults and text-based node sizing to ensure nodes are readable without overlapping.
- **Viewport-Fitted**: Automatically scales and centers the graph to fit within the viewport ("Fit to View") to prevent nodes from flying off-screen.
- **Rectangular**: Enforces rectangular node shapes with dimensions derived from label text length.

## Features

### "Fit to View"
- **Toolbar Button**: A new "Fit to View" button (Scan icon) is available in the toolbar, left of "Fit to Screen".
- **Auto-Load**: The graph automatically performs a "Fit to View" operation when the Mermaid layout is first loaded or when switching to it.
- **Behavior**: Calculates the exact bounding box of the graph content and zooms/pans the camera to fit it perfectly within the viewport with configurable padding.

### Mermaid.js Compliance
- **Node Shapes**: Renders nodes as **rectangular boxes** (instead of circles) with dimensions dynamically calculated from the label text (Markdown-aware sizing).
- **Edges**: Renders edges as **curved B-spline paths** (using `d3.line` with `curveBasis`) derived from Dagre's control points, ensuring smooth routing around nodes with arrowheads.
- **Subgraphs**: Supports **compound layouts** where nodes can be grouped into subgraphs. Subgraphs are rendered as **light gray rectangular containers** with dashed borders, visually grouping their children.
- **Markdown**: Node labels support basic multiline text which drives the box sizing. Labels are centered within the node.

## Configuration Settings

These settings can be configured in the **Settings** panel under `Layout > Mermaid`.

### Orientation
- **Key**: `layout.mermaid.orientation`
- **Values**: `'vertical'` (TB - Top to Bottom), `'horizontal'` (LR - Left to Right)
- **Default**: `'vertical'`
- **Description**: Controls the main direction of the flow.

### Direction
- **Key**: `layout.mermaid.direction`
- **Values**: `'source-target'`, `'target-source'`
- **Default**: `'source-target'`
- **Description**: Controls the direction of edges relative to the orientation.

### Separation
- **Key**: `layout.mermaid.separation`
- **Type**: `number` (multiplier)
- **Default**: `1.0`
- **Description**: A multiplier for the spacing between nodes and ranks.
  - `1.0` results in standard spacing (~50px).
  - Higher values spread the graph out more.

### Fit Padding
- **Key**: `layout.fitPadding`
- **Type**: `number` (pixels)
- **Default**: `80`
- **Description**: The padding around the graph when fitting to the screen.

## Behavior

1.  **Text-Based Sizing**:
    - The layout engine calculates the width and height of each node based on its label text length.
    - **Logic**: `Width ≈ max_line_length * 9px + 32px`, `Height ≈ line_count * 20px + 20px`.
    - This ensures text does not overflow the rectangular boundaries.

2.  **Layout Calculation**:
    - The Dagre engine calculates the `x, y` coordinates for all nodes using the calculated dimensions.
    - Nodes are treated as rectangles in the collision/layout logic.
    - Compound graphs (subgraphs) are handled via `g.setParent`.

3.  **Auto-Fit**:
    - On the initial render (or when the layout mode is switched to Mermaid), the `fitAllTransform` logic calculates the bounding box of the entire graph and applies a zoom transform to fit it perfectly within the canvas viewport, ensuring all nodes are visible.

4.  **No Physics**:
    - The D3 force simulation is disabled for Mermaid layout, ensuring nodes stay exactly where the layout engine placed them.

5.  **Rendering**:
    - Nodes are automatically rendered as rectangles (`rect`) in this mode.
    - Edges are rendered as SVG `<path>` elements with arrow markers.

## Codebase Integration

- **Layout Engine**: `canvas/src/components/GraphCanvas/layout/mermaid.ts`
- **Scene Orchestration**: `canvas/src/components/GraphCanvas/scene.ts` (handles auto-fit)
- **Settings Registry**: `canvas/src/features/settings/registry-layout.ts`
- **Rendering**: `canvas/src/components/GraphCanvas/layers/nodes.ts` & `links.ts`
- **Toolbar**: `canvas/src/features/toolbar/ui/FitToViewButton.tsx`
