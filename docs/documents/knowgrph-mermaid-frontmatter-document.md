# Knowgrph Document – Mermaid Frontmatter Semantics

## Scope

- This document describes how Knowgrph treats Markdown frontmatter that contains a `mermaid:` block.
- It focuses on:
  - How Mermaid frontmatter is parsed and rendered in the canvas.
  - How Mermaid diagrams are attached to the document as visual media.
  - How markdown anchors and links provide any additional graph semantics.

## Frontmatter shape

```markdown
---
title: "Analytics Overview"
mermaid: |
  graph TD
    A[Data] --> B[Viz A]
    A --> C[Viz B]
    B --> D[Insight]
    C --> D
---

# Analytics Overview

Narrative text here.
```

- `title` is treated as the Document name when no H1 heading is present.
- `mermaid` is parsed as a multi-line string; its contents are attached as a `MermaidDiagram` node and also parsed into `MermaidNode` graph nodes and `pointsTo` edges between them. The parser supports standard YAML block scalar behavior, stripping common indentation from the block content.
- `mermaid` code blocks in the markdown body are also parsed into `MermaidNode` graph nodes and `pointsTo` edges, allowing multiple diagrams to contribute to the document's graph topology.
- `classDef` and `class` statements are parsed to apply custom styles (fill, stroke, stroke-width, color) to nodes, overriding default schema colors.

## Parser behavior (markdown → JSON-LD → GraphData)

- The markdown parser’s `buildMarkdownJsonLd` function:
  - Creates a `Document` node for the markdown file, tagged with:
    - `properties.graphId`
    - `properties.path` (when available)
  - Creates a `MermaidDiagram` node for the frontmatter diagram:
    - `@id: mermaid:<graphId>:frontmatter`
    - `properties.code`: raw Mermaid source (for example, `graph TD …`).
  - Adds `hasMermaid` from the `Document` to the `MermaidDiagram`.
  - Parses the frontmatter Mermaid code into graph nodes and edges:
    - For each Mermaid node like `Input[User Query]`, emits a `MermaidNode` with `properties.nodeName` and `properties.label`. Supports `:::className` suffix (e.g. `Node:::style1`) to apply styles inline.
    - For each arrow like `Input --> Retrieval`, emits a `pointsTo` edge from the `MermaidNode` for `Input` to the `MermaidNode` for `Retrieval`.
    - For `click` directives of the form `click Retrieval "#agent"`, adds a `pointsTo` edge from the `MermaidNode` to the corresponding `Anchor` node (created from `<a id="agent"></a>`), when present.
    - For `classDef` statements, stores style definitions.
    - For `class` statements, applies defined styles to matching nodes and subgraphs as `visual:*` properties (fill, stroke, strokeWidth, strokeDasharray, color). Styles are merged with any existing class assignments.
  - Scans body code blocks (language `mermaid`, `mmd`, or `graph`) and parses them into `MermaidNode` and `MermaidSubgraph` nodes, linking them to the document via `hasMermaidNode`.
    - Also creates a `MermaidDiagram` node for each body block (e.g. `@id: mermaid:<graphId>:code:<line>:<index>`), allowing individual body diagrams to be rendered as distinct visual groups if desired.
  - Scans markdown body lines for:
    - HTML anchors of the form `<a id="..."></a>` and emits `Anchor` nodes linked from the `Document` via `hasAnchor`.
    - Internal hash links of the form `[Label](#anchor-id)` and emits `InternalLink` nodes linked from the `Document` via `hasInternalLink`, with optional `pointsTo` edges when the referenced anchor exists.
    - Regular markdown/HTML links and images, emitting `Link` and media-capable nodes.

- When frontmatter includes `mermaidAnchorsOnly: true`:
  - `buildMarkdownJsonLd` omits structural block nodes such as `Section`, `Paragraph`, `List`, `ListItem`, `CodeBlock`, and `Table` (except for a single `Paragraph` containing the full body text if needed for search indexing, though primarily for semantic connectivity).
  - It still processes Mermaid code blocks from the body, emitting `MermaidNode` and `MermaidSubgraph` nodes, AND their container `MermaidDiagram` nodes. This ensures all diagrams in the file (frontmatter and body) contribute to the graph topology and are visible in Mermaid layout mode.
  - It still scans body lines for:
    - HTML anchors `<a id="..."></a>`, emitting `Anchor` nodes linked from the `Document` via `hasAnchor`.
    - Internal hash links `[Label](#anchor-id)`, emitting `InternalLink` nodes linked from the `Document` via `hasInternalLink` (and `pointsTo` when the anchor exists).
  - External links and images from the body are not converted into graph nodes in this mode.
  - The resulting graph for that markdown document contains:
    - One `Document` node.
    - `MermaidDiagram` nodes for the frontmatter and any body code blocks.
    - Any `MermaidNode` nodes derived from these diagrams.
    - Any `pointsTo` edges between `MermaidNode` nodes and between `MermaidNode` and `Anchor` nodes (when `click` directives target anchors).
    - Any `Anchor` and `InternalLink` nodes discovered from the body.
  - The full markdown text (frontmatter + body) is still preserved for the Bottom Panel Markdown editor/viewer; the `mermaidAnchorsOnly` flag affects only which nodes are emitted into Canvas graph data, not what text is displayed.

- Large markdown ingestion:
  - Markdown files up to 500,000 characters are ingested normally (full Markdown → JSON‑LD → GraphData pipeline).
  - Markdown files larger than that are ingested as a summary-only graph (a single `Document` node with a preview) for performance.

No additional `Entity`, `Mention`, or `semanticRelation` objects are created directly from Mermaid frontmatter. All higher‑level graph semantics come from the neutral markdown ingestion pipeline (anchors, links, media) and any downstream semantic layers that operate on that structure plus the `MermaidNode` topology defined by the diagram.

## Mapping Strategy

The `md-mmd-template.md` sandbox file spells out the intended visual semantics:

- **Nodes (labels):** `"User Query"`, `"Context Retrieval"`, etc. → defined in Mermaid as `Input[User Query]`, `Retrieval[Context Retrieval]`.
- **Edges:** `"Retrieval"`, `"Augmentation"`, etc. → defined in Mermaid with arrows (`-->`).
- **Graph Layers:** `"Core pipeline"`, `"Agents hierarchy"`, etc. → represented with `%% comments` or `subgraph` blocks in Mermaid.
- **Anchors:** `<a id="agent"></a>` in Markdown body → target for Mermaid `click AgentNode "#agent"`.
- **Links:** `[Agents](#agent)` in tables or lists → clickable references to anchors.

In the graph produced by `buildMarkdownJsonLd`, these map to neutral node and edge patterns:

- **Nodes (labels → MermaidNode):** Mermaid node labels such as `"User Query"` or `"Context Retrieval"` are converted into `MermaidNode` graph nodes, each with `properties.nodeName` (the Mermaid identifier, for example `Input`) and `properties.label` (the human‑readable label from the square brackets).
- **Edges (`-->` → pointsTo):** Directed edges like `Input --> Retrieval` are converted into `pointsTo` edges between `MermaidNode` nodes so that the central Canvas can render the Mermaid diagram topology as a navigable subgraph.
- **Graph Layers (comments/subgraphs → MermaidSubgraph + metadata):** Diagram layer hints such as `%% Core pipeline` or `%% Agents hierarchy` are preserved as comments inside `properties.code` on the `MermaidDiagram` node. Explicit Mermaid `subgraph` blocks (for example, `subgraph L0["L0: BUSINESS OUTCOMES"]` or `subgraph P3["PHASE 3: FEATURE ENGINEERING"]`) are converted into `MermaidSubgraph` nodes with `properties.subgraphName` (for example, `"L0"` or `"P3"`) and `properties.label` (for example, `"L0: BUSINESS OUTCOMES"`). Each `MermaidNode` that belongs to a subgraph carries `properties.mermaidSubgraphName` so Canvas can render layer membership directly on the graph. When a subgraph name matches the neutral `Lk` pattern (`L0`, `L1`, …), the neutral `Pk` pattern (`P0`, `P1`, …), or the `Phase` pattern (`Phase0`, `Phase1`, …), member nodes also receive a numeric `properties["visual:layer"]` index (for example, `L0` → `1`, `L1` → `2`, `P0` → `1`, `Phase0` → `1`, `Phase1` → `2`) so the Graph Layer view can dim or emphasize a single layer band without introducing new visible Layer nodes. Additional neutral subgraph labels such as `CROSS` and `INTERVIEW` can also be mapped to higher `visual:layer` bands (for example, cross‑cutting concerns and interview overlays) purely via name‑to‑index mapping in the parser while keeping the graph itself domain‑agnostic. Canvas layer mode (`schema.layers.mode`) is `document` | `schema` | `semantic`; legacy values (`property`, `document-structure`) are normalized by the client. These modes are still driven by the JSON‑LD schema and structural nodes (`Document`, `Section`, `Paragraph`, `List`, `ListItem`, `CodeBlock`, and `Table`), not by hardcoded Mermaid layer names.
- **Anchors (`<a id="...">` → Anchor nodes):** HTML anchors like `<a id="agent"></a>` in the markdown body are promoted to `Anchor` nodes with `@type: "Anchor"` and `properties.anchorId`. The `Document` points to each via `hasAnchor`. When a Mermaid `click AgentNode "#agent"` directive is present, the parser adds a `pointsTo` edge from the corresponding `MermaidNode` to the `Anchor` node so anchor targets participate directly in the Mermaid-derived subgraph.
- **Links (`[Label](#anchor)` → InternalLink nodes):** Markdown links such as `[Agents](#agent)` are converted into `InternalLink` nodes with `properties.anchorId` and `properties.label`. The `Document` links to each via `hasInternalLink`, and when a matching `Anchor` exists, the `InternalLink` points to it via `pointsTo`. This keeps the table/list links in the template aligned with the same anchor targets that Mermaid `click` bindings use.

## Canvas behavior

- Bottom Panel markdown:
  - Live edits update the rendered Mermaid diagram in the Preview panel.
  - The “Apply” button re-parses markdown and updates GraphData using the markdown ingestion pipeline (sections, paragraphs, lists, links, images, code, tables, Mermaid frontmatter).
- Preview panel:
  - Shows the rendered Mermaid diagram from frontmatter at the top of the document view (derived from `meta.mermaid`).
  - Markdown content (including anchors like `<a id="agent"></a>` and hash links like `[Agents](#agent)`) is rendered via the standard Markdown preview and can be surfaced as media or selection targets.
- Canvas:
  - Renders Markdown-derived `Document`, `Section`, `Paragraph`, `List`, `ListItem`, `Link`, media nodes, `Anchor`, and `InternalLink` nodes produced by `buildMarkdownJsonLd`.
  - Renders Mermaid-derived `MermaidNode` nodes and `pointsTo` edges so that the frontmatter diagram appears as a central, navigable subgraph on the Canvas.
  - Renders Mermaid-derived `MermaidSubgraph` nodes as rectangular hulls behind their member nodes. The layout (position and dimensions) is computed by the Mermaid (Dagre) engine to ensure subgraphs correctly encompass their children. Subgraphs support custom styling via Mermaid `classDef` (fill, stroke, stroke-width, stroke-dasharray) and default to schema-driven colors (based on L0/L1 tags) if no explicit style is provided. They are sorted by hierarchy depth so that nested subgraphs are rendered on top of their parents.
  - Applies Mermaid ordering heuristics for stability: Dagre inputs are processed in a deterministic order (by parent/subgraph/name/id), node rendering orders subgraph rectangles behind member nodes, and the active dragged element is raised for interaction.
  - Applies optional schema-controlled render ordering in Mermaid mode via `schema.layout.mermaid.renderOrder` so nodes/edges/labels keep deterministic z-order without relying on diagram-specific hacks.
  - Supports interactive dragging: Dragging a subgraph automatically moves all its member nodes. Dragging any node keeps its connected edges and any enclosing subgraph geometry in sync in real-time, preventing dislocation.
  - Uses `properties.mermaidSubgraphName` on each `MermaidNode` to group nodes into business, stakeholder, KPI, model, implementation, or mathematical layers without hardcoding any specific file or domain. Subgraphs whose names follow the neutral `Lk` convention (`L0`, `L1`, …), the neutral `Pk` pattern (`P0`, `P1`, …), or the `Phase` pattern (`Phase0`, `Phase1`, …), member nodes also receive a numeric `properties["visual:layer"]` index.
  - Styling priority for Mermaid nodes is: Mermaid frontmatter `classDef`/`class` first, then schema-driven palette. When a frontmatter style explicitly sets fill to a transparent value, Canvas treats it as “no override” so Mermaid nodes remain visible with the schema-driven fill.
  - When a `MermaidNode` is selected, highlights the entire `pointsTo` path for that node’s Mermaid pipeline component so that all downstream and upstream Mermaid steps (for example, `Input → Retrieval → Augmentation → Generation → Output`) and the connecting `pointsTo` edges are visually emphasized together.
  - The toolbar exposes a **Mermaid focus** floating panel that renders the active frontmatter Mermaid diagram using the same `MermaidDiagram` component as the Preview panel. When tree layout is active and the selection is a `MermaidNode` with a `properties.mermaidSubgraphName` value, this panel derives a subgraph-specific Mermaid snippet based on that name so the focus view zooms in on the selected Mermaid subgraph while keeping the underlying diagram and schema configuration neutral.
  - **Mermaid Frontmatter Sync**: When a Canvas node corresponds to a node defined in the Markdown frontmatter (Mermaid block), the editor auto-scrolls to the exact line of the node definition within the frontmatter code. The logic attempts to find the node definition by ID first, and falls back to matching by node name/label if the ID is generated (e.g., `mermaid:gid:...`). This ensures robust navigation even when graph data contains full URIs while the frontmatter uses simple identifiers.
  - **Frontmatter Mode**: The toolbar exposes a **Frontmatter Mode** toggle that pins the Preview tab and Mermaid focus panel to the frontmatter Mermaid diagram for the active markdown document, using the same parser- and schema-driven configuration as other Mermaid content without hardcoding any file paths or pipeline stage names.
  - Shows the markdown‑derived `Document` node only in `document` layer mode; semantic and schema modes hide `Document` while keeping Mermaid nodes, anchors, and internal links available as part of the same graph.
  - Exposes a semantic-layer filter row (`schema.layers.semantic.hiddenNodeTypes`) with dedicated legend chips for Mermaid layers, including `MermaidNode · pointsTo` and a separate `MermaidSubgraph · layer` chip that calls out the Mermaid layer hex nodes.
  - Keeps edge and node selection logic layout‑mode aware and data‑driven: tree, force, and other layout modes all read from the same schema‑aligned `MermaidNode` + `pointsTo` graph without hardcoding any particular template, file path, or pipeline stage names. Tests that use `md-mmd-template.md` validate this behavior but do not change how the renderer reasons about edges.
  - When the toolbar **Tree** layout button is active and the adjacent **Tree preset** button is set to “Tree preset: Mermaid flowchart”, the 2D renderer uses a DAG-optimized layout (Sugiyama method via `dagre`) instead of the standard D3 tree algorithm. This produces a "Mermaid flowchart"-like structure with rectangular block nodes (mimicking `https://cs.brown.edu/people/jcmace/d3/graph.html?id=small.json`) that cleanly handles directed acyclic graphs and multi-parent hierarchies. The renderer treats `metadata.tree.edgeLabels`, `metadata.tree.orientation`, `metadata.tree.direction`, and `metadata.tree.separation` as neutral, parser-suggested defaults. Any explicit schema overrides in `schema.layout.tree` (for example, a custom `orientation` or `separation` value selected in the Renderer settings) take precedence over these metadata hints so users can fine-tune spacing and direction interactively without losing the autosuggested starting point. For medium and dense diagrams, autosuggest also seeds `performance.lod.tree.collapseMode = "depth"` and a default `maxDepth` (3 for medium, 2 for dense); very dense diagrams (same `dense` bucket but with statement counts roughly ≥ 2× `metadata.tree.mermaidDensity.config.denseMaxStatements`) are collapsed further to `maxDepth = 1` with a slightly increased initial separation so the tree remains readable on first render. Switching the preset to “Tree preset: Document hierarchy” reuses the same tree engine but swaps in the document-hierarchy edge labels (`hasSection`, `hasBlock`, `hasItem`, `hasMermaid`, `hasMermaidNode`, `hasAnchor`, `hasInternalLink`) while preserving any schema-level overrides for separation, direction, or color mode so the layout remains schema- and dataset-agnostic.

## EDA→MLP interview markdown example

The EDA interview markdown used in local workflows follows the same frontmatter pattern: a `mermaid:` block with `subgraph` declarations such as `P0[...]` through `P8[...]`, plus neutral bands like `CROSS` and `INTERVIEW`. When this markdown is ingested:

- The frontmatter diagram is parsed into `MermaidDiagram`, `MermaidSubgraph`, and `MermaidNode` nodes as described above.
- `Pk` subgraphs and the `CROSS` / `INTERVIEW` bands are mapped to numeric `visual:layer` indices so the Graph Layer tab can dim or emphasize one phase at a time while keeping the underlying markdown-derived structure neutral.
- Test helpers feed the markdown into the parser via a configurable environment variable (for example, `KNOWGRPH_EDA_MLP_INTERVIEW_MD_PATH`) so no project-specific file paths are hardcoded into application code.

## Example walkthroughs – Agents and Decision flows

The same `MermaidNode` + `pointsTo` path-highlighting behavior used for the core pipeline also applies to the Agents hierarchy and Decision branching subgraphs in `md-mmd-template.md`.

### Agents hierarchy (Root → AgentNode → TaskNode → ArtifactNode → MemoryNode)

Given the frontmatter:

- `Root[GraphRAG System]`
- `Root --> AgentNode[Agent]`
- `AgentNode --> TaskNode[Task]`
- `TaskNode --> ArtifactNode[Artifact]`
- `ArtifactNode --> MemoryNode[Graph Memory]`

When the markdown is ingested and the graph is rendered:

- The Canvas includes `MermaidNode` nodes for `Root`, `AgentNode`, `TaskNode`, `ArtifactNode`, and `MemoryNode`.
- It includes `pointsTo` edges for each arrow in that chain.
- In Semantic layer mode, with Mermaid nodes visible via the `MermaidNode · pointsTo` legend/filter:
  - Selecting `Root` highlights the full hierarchy path (`Root → AgentNode → TaskNode → ArtifactNode → MemoryNode`) as a connected `pointsTo` chain:
    - `Root` is rendered in the bright selection color.
    - All downstream nodes (`AgentNode`, `TaskNode`, `ArtifactNode`, `MemoryNode`) are fully opaque and use their base MermaidNode fill.
    - All `pointsTo` edges along the hierarchy are highlighted with the selected-edge style (blue, thicker, higher opacity).
  - Selecting any interior node (for example, `TaskNode`) keeps the entire hierarchy path highlighted:
    - `TaskNode` becomes the selected node.
    - Its upstream (`Root`, `AgentNode`) and downstream (`ArtifactNode`, `MemoryNode`) neighbors along `pointsTo` remain fully visible and treated as path neighbors.
    - All hierarchy `pointsTo` edges remain emphasized together as a single visual chain.

This mirrors the pipeline behavior but for the organizational tree: any node demonstrates the full agent/task/artifact/memory hierarchy at a glance.

### Decision branching (Decision → PathA / PathB and feedback loop)

The same template contains decision and feedback edges:

- `Decision[Agent Decision] -->|Context Found| PathA[Use GraphRAG]`
- `Decision -->|Context Missing| PathB[Fallback to LLM]`
- `Generation --> Evaluation[Evaluator]`
- `Evaluation -->|Refine| Retrieval`

When rendered:

- The Canvas includes `MermaidNode` nodes for `Decision`, `PathA`, `PathB`, `Evaluation`, and uses `pointsTo` edges for each arrow (including those with labels like `|Context Found|`).
- In Semantic mode, with Mermaid nodes visible:
  - Selecting `Decision` highlights the branching decision subgraph:
    - `Decision`, `PathA`, and `PathB` are all fully opaque.
    - The `pointsTo` edges from `Decision` to `PathA` and from `Decision` to `PathB` are highlighted in the selected-edge style.
    - Pipeline and hierarchy nodes not on this decision path remain dimmed.
  - Selecting `Evaluation` highlights the feedback loop:
    - `Evaluation`, `Retrieval`, and the associated `pointsTo` edges (`Generation → Evaluation`, `Evaluation → Retrieval`) are emphasized as a mini-path within the broader pipeline.
    - The helper traverses along `pointsTo` in both directions so that upstream and downstream steps in the feedback loop are treated as neighbors of the selected `Evaluation` node.

Combined with the core pipeline example, these patterns let curators:

- Use a single diagram and a single markdown file to express:
  - Linear pipelines (Input → Output),
  - Hierarchical agent structures (Root → AgentNode → TaskNode → ArtifactNode → MemoryNode),
  - Branching decisions and feedback loops (Decision → PathA/PathB, Generation/Evaluation/Retrieval).
- Then use Canvas selection plus the Mermaid legend/filter to visually isolate and inspect each subgraph while the rest of the document-derived structure (anchors, internal links, Document node) remains available in the same graph.

### Manual QA checklist

To quickly verify that Mermaid-derived paths and highlighting behave correctly in Canvas for `md-mmd-template.md`:

- Preconditions:
  - Semantic layer mode is active.
  - Mermaid nodes are visible via the `MermaidNode · pointsTo` legend/filter.
  - Markdown changes have been applied so the graph is up to date.

- Core pipeline (Input → Retrieval → Augmentation → Generation → Output):
  - Click `Input`:
    - Verify that 5 Mermaid nodes (`Input`, `Retrieval`, `Augmentation`, `Generation`, `Output`) are fully visible and not dimmed.
    - Verify that 4 `pointsTo` edges for the pipeline (`Input → Retrieval → Augmentation → Generation → Output`) are highlighted in blue with higher opacity and width.
  - Click `Generation`:
    - Verify the same 5 nodes and 4 edges remain highlighted as one continuous path.

- Agents hierarchy (Root → AgentNode → TaskNode → ArtifactNode → MemoryNode):
  - Click `Root`:
    - Verify that 5 Mermaid nodes in the hierarchy are fully visible and not dimmed.
    - Verify that 4 `pointsTo` edges (`Root → AgentNode → TaskNode → ArtifactNode → MemoryNode`) are highlighted as a single chain.
  - Click `TaskNode`:
    - Verify the same 5 hierarchy nodes and 4 edges remain highlighted, with `TaskNode` now the selected node.

- Decision branching and feedback loop:
  - Click `Decision`:
    - Verify that 3 nodes (`Decision`, `PathA`, `PathB`) are fully visible and not dimmed.
    - Verify that 2 `pointsTo` edges (`Decision → PathA`, `Decision → PathB`) are highlighted in blue.
  - Click `Evaluation`:
    - Verify that 3 nodes (`Generation`, `Evaluation`, `Retrieval`) are fully visible and not dimmed.
    - Verify that 2 `pointsTo` edges (`Generation → Evaluation`, `Evaluation → Retrieval`) are highlighted as a feedback mini-path within the pipeline.
