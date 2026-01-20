# Port Handles and Subgraph Layout

## End-to-end pipeline

- Import: markdown is loaded into the parser registry and parsed via the markdown JSON-LD builder.
- Parse: Markdown → JSON-LD (`buildMarkdownJsonLd`) including Mermaid parsing for nodes/subgraphs.
- Derive: JSON-LD → GraphData (`parseJsonLd`).
- Layout: seeded Mermaid layout + force simulation constraints (16:9 centering, no-overlap forces).
- Render: SVG layers (links, nodes, labels, groups, port handles) update on simulation ticks.

## Node Shape Mode

- Toolbar toggle switches node rendering between circle (default) and rectangular shapes.
- This is schema-driven (`behavior.nodeShapeMode`) and forces a single scene rebuild (no per-tick recomputation).

## Frontmatter Mode

- When enabled, the canvas renders only nodes/edges derived from the frontmatter Mermaid block.
- For the demo markdown slide file, this corresponds to the Mermaid frontmatter lines 19–50 and is validated by tests.

## Port Handles

- Port handles are rendered as four cardinal markers on each node when enabled in schema behavior.
- Edge endpoints are projected onto the node boundary using the nearest cardinal side between source and target nodes.
- This keeps edge attachment stable and consistent with node movement while avoiding extra per-edge recomputation or hidden port graphs.

## Graph Layers / Subgraphs

- Mermaid subgraphs are parsed and rendered as non-interactive group containers.
- Seed layout distributes top-level subgraphs across the available 16:9 space using a grid placement strategy.
- Simulation anchoring respects the seeded subgraph targets, helping prevent subgraph overlap and avoiding single-axis “long line” clustering.
- Group rendering supports `layout.groups.shape`:
  - `rect` (default): rectangular group containers.
  - `geo`: geometry-based outlines computed from member node extents (native implementation; no external geometry libraries).

## Markdown Heading Layers

- Markdown headings (`Section` nodes with `properties.level`) are rendered as nested graph layers (H2 inside H1, H3 inside H2, etc).
- Heading layers are visual-only containers: heading nodes are not rendered as normal nodes on the canvas.
- Membership is derived from existing document structure edges (`hasSection`, `hasBlock`, `hasItem`, `embedsImage`) to avoid duplicated parsing logic.
