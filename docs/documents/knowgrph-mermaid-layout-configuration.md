# Mermaid Layout Configuration

This document describes the configuration options and behavior of the enhanced Mermaid Layout in KnowGrph.

## Overview

The Mermaid Layout (`mode: 'mermaid'`) provides a high-fidelity, hierarchical flowchart visualization using the **Dagre** layout engine. It is designed to natively replicate the look and feel of standard Mermaid diagrams while maintaining **100% visual consistency** with the application's "Frontmatter Mode" and being fully interactive.

## Features

### Visual Consistency ("Frontmatter" Style)
- **Unified Color Palette**: Mermaid nodes (`MermaidNode`) use the **schema-driven color palette** (`getNodeBaseFill`). This ensures that if a node is blue in Force Layout, it remains blue in Mermaid Layout.
- **Frontmatter Styling**: Supports Mermaid `classDef` and `class` statements to apply custom styles (fill, stroke, width, color) directly from frontmatter.
- **Schema-Driven Strokes**: Node borders (`stroke`) and widths (`stroke-width`) are controlled by the schema (`schema.nodeStroke`). If not defined, Mermaid nodes default to a subtle `#333` border.
- **Subgraph Visualization via Hulls**: Mermaid subgraphs (`MermaidSubgraph`) are rendered as **rectangular hulls** with padding (12px), utilizing the `graphLayers` system. They render *below* nodes to ensure visibility and correct z-indexing.
- **Node Shapes**: Nodes are rendered as **rectangular boxes** with rounded corners (`4px`). Mermaid layout seeds `properties["visual:width"]`/`properties["visual:height"]` from a shared minimap-relative default sized for maximum zoom (**5× minimap width**, **2.5× minimap height**, fixed 2:1 aspect ratio; width ratio clamped to `1..50`, height ratio derived as `width/2`), ensuring stable sizing across Mermaid, Tree, and Port Handles. Override via `layout.rectNodes.maxZoomMinimapWidthRatio` / `layout.rectNodes.maxZoomMinimapHeightRatio` (Floating Panel keeps the aspect ratio locked).
- **Edges**: Renders smooth B-spline curves initially. When dragging nodes, edges dynamically switch to direct lines to maintain connection.

### Interactive Dragging
- **Draggable Nodes**: Nodes can be dragged to fine-tune the layout. The edge connections update in real-time.
- **Rigid Group Dragging**:
  - **Dragging a Subgraph**: Dragging a Mermaid subgraph centroid moves all its member nodes (and nested subgraphs) together, preserving their relative positions.
  - **Dragging a Member Node**: Dragging a member node also moves its parent subgraph and all sibling nodes together. This ensures the subgraph remains a cohesive rigid body, preventing nodes from being "dislocated" from their container.
- **Persistence**: In Mermaid mode, dragged nodes stay fixed in their new positions (physics forces are disabled).

### Layout Engine & Robustness
- **Algorithm**: Uses Dagre's `network-simplex` ranker (switched from `tight-tree`) for enhanced stability and reduced layout failures.
- **Spacing**: Uses schema-configured separation as a baseline, then increases `nodesep`/`ranksep` to avoid overlap (accounts for label padding) and maximizes spacing while still fitting a 1920×1080 (16:9) frame.
- **Centering**: Applies 16:9-aware post-processing (centering and safe scaling) so Mermaid layouts remain well spread and centered in the frame.
- **Compound Layout**: Natively supports **rectangular subgraphs** and nested node hierarchies by enabling Dagre's `compound` mode. It correctly maps parent-child relationships between subgraphs and nodes.
- **Node Sizing**: Uses a shared minimap-relative default sizing policy so Mermaid node boxes remain consistent across layouts, while labels continue to wrap using shared text-wrapping utilities.
- **Performance**: 
  - **Revision-Aware Caching**: Uses a robust cache key including graph topology revision (`nodesRevision`, `edgesRevision`) to skip redundant Dagre calculations.
  - **Memoization**: Utility functions like text wrapping are memoized to reduce CPU usage.
  - **Skip Initial Layout**: Skips redundant computations when the graph structure is stable.
- **Crash Prevention**: Implements **strict topology validation** to prevent the common `networkSimplex` / "rank undefined" crash:
    - Filters out edges pointing to non-existent nodes.
    - Filters out self-loops (A -> A) which destabilize the ranker.
    - Ensures all nodes are registered before edge definition.
    - **Compound Safety**: Uses Dagre `compound` mode and assigns parent-child relationships for subgraphs and nodes to keep nested hierarchies stable.

### Mermaid.js Compliance
- **Markdown Strings**: Supports **Markdown formatting** in node labels (e.g., `id["**Bold** and *Italic*"]`).
- **Flowchart Syntax**: Supports standard Mermaid flowchart syntax (`graph TD`, `A --> B`, `subgraph Title ... end`).
- **Edge Types**: Supports normal (`-->`), dotted (`-.->`), and thick (`==>`) edges.

## Configuration Settings

These settings can be configured in the **Settings** panel under `Layout > Mermaid`.

### Orientation
- **Key**: `layout.mermaid.orientation`
- **Values**: `'vertical'` (TB), `'horizontal'` (LR)
- **Default**: `'vertical'`

### Direction
- **Key**: `layout.mermaid.direction`
- **Values**: `'source-target'`, `'target-source'`
- **Default**: `'source-target'`

### Separation
- **Key**: `layout.mermaid.separation`
- **Type**: `number` (multiplier)
- **Default**: `3.0`

### Fit Padding
- **Key**: `layout.fitPadding`
- **Type**: `number` (pixels)
- **Default**: `80`

### Fit-to-View (16:9)
- **Keys**:
  - `layout.fitUseCentroid`
  - `layout.fitDetectClusters`
  - `layout.fitTargetAspectRatio`
  - `layout.fitEnforceAspectRatio`
- **Defaults**: `true`, `true`, `1.777` (16:9), `true`

These settings control how the Canvas computes the initial “fit to view” transform (including 1920×1080 presentation framing) after the Mermaid layout has assigned node positions.

### Render Order
- **Key**: `layout.mermaid.renderOrder`
- **Type**: `Record<string, number>`
- **Default**: not set (no override; renderer uses stable internal ordering)

In Mermaid mode, the 2D renderer can optionally sort Mermaid nodes, edges, and labels by a schema-provided render order so z-order stays deterministic (for example, subgraph hulls always behind their member nodes, and selected/dragged elements can be raised without reshuffling everything else).

Example:

```json
{
  "layout": {
    "mode": "mermaid",
    "mermaid": {
      "renderOrder": {
        "MermaidSubgraph": -10,
        "MermaidNode": 0,
        "edge": 10
      }
    }
  }
}
```

## Codebase Integration

- **Layout Engine**: `canvas/src/components/GraphCanvas/layout/mermaid.ts`
- **Parser**: `canvas/src/features/parsers/markdownJsonLdMermaidParser.ts`
- **Scene Orchestration**: `canvas/src/components/GraphCanvas/scene.ts`
- **Scene Handlers**: `canvas/src/components/GraphCanvas/sceneHandlers.ts`
- **Label Rendering**: `canvas/src/components/GraphCanvas/layers/labels.ts`
- **Drag Behavior**: `canvas/src/components/GraphCanvas/drag.ts`
- **Rendering**: `canvas/src/components/GraphCanvas/layers/nodes.ts` & `links.ts`
