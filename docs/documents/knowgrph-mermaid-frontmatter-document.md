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
    A[Data] --> B[Visualization]
    B -->|filters| C[Informs]
    C --> D[Gr8]
---

# Analytics Overview

Narrative text here.
```

- `title` is treated as the Document name when no H1 heading is present.
- `mermaid` is parsed as a multi-line string; its contents are attached as a `MermaidDiagram` node and also parsed into `MermaidNode` graph nodes and `pointsTo` edges between them.

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
    - For each Mermaid node like `Input[User Query]`, emits a `MermaidNode` with `properties.nodeName` and `properties.label`.
    - For each arrow like `Input --> Retrieval`, emits a `pointsTo` edge from the `MermaidNode` for `Input` to the `MermaidNode` for `Retrieval`.
    - For `click` directives of the form `click Retrieval "#agent"`, adds a `pointsTo` edge from the `MermaidNode` to the corresponding `Anchor` node (created from `<a id="agent"></a>`), when present.
  - Scans markdown body lines for:
    - HTML anchors of the form `<a id="..."></a>` and emits `Anchor` nodes linked from the `Document` via `hasAnchor`.
    - Internal hash links of the form `[Label](#anchor-id)` and emits `InternalLink` nodes linked from the `Document` via `hasInternalLink`, with optional `pointsTo` edges when the referenced anchor exists.
    - Regular markdown/HTML links and images, emitting `Link` and media-capable nodes.

- When frontmatter includes `mermaidAnchorsOnly: true`:
  - `buildMarkdownJsonLd` omits structural block nodes such as `Section`, `Paragraph`, `List`, `ListItem`, `CodeBlock`, and `Table`.
  - It still scans body lines for:
    - HTML anchors `<a id="..."></a>`, emitting `Anchor` nodes linked from the `Document` via `hasAnchor`.
    - Internal hash links `[Label](#anchor-id)`, emitting `InternalLink` nodes linked from the `Document` via `hasInternalLink` (and `pointsTo` when the anchor exists).
  - External links and images from the body are not converted into graph nodes in this mode.
  - The resulting graph for that markdown document contains:
    - One `Document` node.
    - One `MermaidDiagram` node for the frontmatter `mermaid:` block (when present).
    - Any `MermaidNode` nodes derived from the diagram.
    - Any `pointsTo` edges between `MermaidNode` nodes and between `MermaidNode` and `Anchor` nodes (when `click` directives target anchors).
    - Any `Anchor` and `InternalLink` nodes discovered from the body.
  - The full markdown text (frontmatter + body) is still preserved for the Bottom Panel Markdown editor/viewer; the `mermaidAnchorsOnly` flag affects only which nodes are emitted into Canvas graph data, not what text is displayed.

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
- **Graph Layers (comments/subgraphs → metadata only):** Diagram layer hints such as `%% Core pipeline` or `%% Agents hierarchy` are preserved as comments inside `properties.code` on the `MermaidDiagram` node. They do not create separate Layer nodes or edges. Canvas layer modes (`semantic`, `document structure`, `property`) are driven by the JSON‑LD schema and structural nodes (`Document`, `Section`, `Paragraph`, etc.), not by Mermaid comments.
- **Anchors (`<a id="...">` → Anchor nodes):** HTML anchors like `<a id="agent"></a>` in the markdown body are promoted to `Anchor` nodes with `@type: "Anchor"` and `properties.anchorId`. The `Document` points to each via `hasAnchor`. When a Mermaid `click AgentNode "#agent"` directive is present, the parser adds a `pointsTo` edge from the corresponding `MermaidNode` to the `Anchor` node so anchor targets participate directly in the Mermaid-derived subgraph.
- **Links (`[Label](#anchor)` → InternalLink nodes):** Markdown links such as `[Agents](#agent)` are converted into `InternalLink` nodes with `properties.anchorId` and `properties.label`. The `Document` links to each via `hasInternalLink`, and when a matching `Anchor` exists, the `InternalLink` points to it via `pointsTo`. This keeps the table/list links in the template aligned with the same anchor targets that Mermaid `click` bindings use.

## Canvas behavior

- Bottom Panel markdown:
  - Live edits update the rendered Mermaid diagram in the Preview panel.
  - The “Apply” button re-parses markdown and updates GraphData using the markdown ingestion pipeline (sections, paragraphs, lists, links, images, code, tables, Mermaid frontmatter).
- Preview panel:
  - Shows a dedicated “Mermaid diagram from frontmatter” card derived from `meta.mermaid`.
  - Markdown content (including anchors like `<a id="agent"></a>` and hash links like `[Agents](#agent)`) is rendered via the standard Markdown preview and can be surfaced as media or selection targets.
- Canvas:
  - Renders Markdown-derived `Document`, `Section`, `Paragraph`, `List`, `ListItem`, `Link`, media nodes, `Anchor`, and `InternalLink` nodes produced by `buildMarkdownJsonLd`.
  - Renders Mermaid-derived `MermaidNode` nodes and `pointsTo` edges so that the frontmatter diagram appears as a central, navigable subgraph on the Canvas.
  - When a `MermaidNode` is selected, highlights the entire `pointsTo` path for that node’s Mermaid pipeline component so that all downstream and upstream Mermaid steps (for example, `Input → Retrieval → Augmentation → Generation → Output`) and the connecting `pointsTo` edges are visually emphasized together.
  - Shows the markdown‑derived `Document` node only in `document-structure` layer mode; semantic mode focuses on semantic and Mermaid subgraphs rather than document scaffolding.
  - Exposes a semantic-layer filter row (`schema.layers.semantic.hiddenNodeTypes`) with a dedicated `MermaidNode · pointsTo` legend chip so curators can quickly show or hide Mermaid-derived nodes in semantic views without affecting the underlying markdown graph.
  - Keeps edge and node selection logic layout‑mode aware and data‑driven: tidy‑tree, force, and other layout modes all read from the same schema‑aligned `MermaidNode` + `pointsTo` graph without hardcoding any particular template, file path, or pipeline stage names. Tests that use `md-mmd-template.md` validate this behavior but do not change how the renderer reasons about edges.

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
