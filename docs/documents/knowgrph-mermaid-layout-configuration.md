# Mermaid Layout Configuration

This document describes the configuration options and behavior of the enhanced Mermaid Layout in KnowGrph.

## Overview

The Mermaid Layout (`mode: 'mermaid'`) provides a high-fidelity, hierarchical flowchart visualization using the **Dagre** layout engine. It is designed to natively replicate the look and feel of standard Mermaid diagrams while maintaining **100% visual consistency** with the application's "Frontmatter Mode" and being fully interactive.

## Features

### Visual Consistency ("Frontmatter" Style)
- **Unified Color Palette**: Mermaid nodes (`MermaidNode`) use the **schema-driven color palette** (`getNodeBaseFill`). This ensures that if a node is blue in Force Layout, it remains blue in Mermaid Layout.
- **Schema-Driven Strokes**: Node borders (`stroke`) and widths (`stroke-width`) are controlled by the schema (`schema.nodeStroke`). If not defined, Mermaid nodes default to a subtle `#333` border.
- **Subgraph Visualization via Hulls**: Mermaid subgraphs (`MermaidSubgraph`) are represented as **graph layer hull overlays** (not as standalone rect nodes), styled via the schema’s `nodeStyles.MermaidSubgraph.color` and graph-layer style rules.
- **Node Shapes**: Nodes are rendered as **rectangular boxes** with rounded corners (`4px`), dynamically sized to their content.
- **Edges**: Renders smooth B-spline curves initially. When dragging nodes, edges dynamically switch to direct lines to maintain connection.

### Interactive Dragging
- **Draggable Nodes**: Nodes can be dragged to fine-tune the layout. The edge connections update in real-time.
- **Draggable Subgraphs**: When Graph Layers are enabled, dragging a Mermaid subgraph centroid moves all member nodes together.
- **Persistence**: In Mermaid mode, dragged nodes stay fixed in their new positions (physics forces are disabled).

### Layout Engine & Robustness
- **Algorithm**: Uses Dagre's `network-simplex` ranker (switched from `tight-tree`) for enhanced stability and reduced layout failures.
- **Node Sizing**: Uses shared `calculateNodeDimensions` utility to ensure consistent text measurement across layout engines (Mermaid, Tree) and renderer.
- **Crash Prevention**: Implements **strict topology validation** to prevent the common `networkSimplex` / "rank undefined" crash:
  - Filters out edges pointing to non-existent nodes.
  - Filters out self-loops (A -> A) which destabilize the ranker.
  - Ensures all nodes are registered before edge definition.

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
- **Default**: `1.0`

### Fit Padding
- **Key**: `layout.fitPadding`
- **Type**: `number` (pixels)
- **Default**: `80`

## Codebase Integration

- **Layout Engine**: `canvas/src/components/GraphCanvas/layout/mermaid.ts`
- **Parser**: `canvas/src/features/parsers/markdownJsonLdMermaidParser.ts`
- **Scene Orchestration**: `canvas/src/components/GraphCanvas/scene.ts`
- **Scene Handlers**: `canvas/src/components/GraphCanvas/sceneHandlers.ts`
- **Label Rendering**: `canvas/src/components/GraphCanvas/layers/labels.ts`
- **Drag Behavior**: `canvas/src/components/GraphCanvas/drag.ts`
- **Rendering**: `canvas/src/components/GraphCanvas/layers/nodes.ts` & `links.ts`
