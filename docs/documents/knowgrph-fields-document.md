## Graph Fields View: Source of Fields and Raw JSON Context

- The Graph Fields view is the canonical place to inspect and curate field semantics for the active graph.
- All visible fields come directly from the current `GraphData` object in the canvas store; the view never re‑parses the underlying source file.
- Field lists and samples are derived from node and edge properties plus a small set of structural fields (`id`, `label`, `type`, `source`, `target`) that are treated as first‑class AgenticRAG dimensions.
- When the active graph was built from text formats (Markdown, HTML, PDF), field names reflect the JSON‑LD schema produced by the parser pipeline.
- When the active graph was built from JSON / JSON‑LD / CSV, field names reflect exactly what the parser registry emitted from the ingested content.

## Raw JSON Graphs (`context: "raw-nodes-edges"`)

- Some JSON inputs do not declare a strict schema and instead expose workflow‑like or dataset‑specific shapes.
- When JSON ingestion routes through `rawToGraphData` (`canvas/src/lib/graph/rawToGraph.ts`), the resulting `GraphData` advertises `context: "raw-nodes-edges"`.
- In this context:
  - Node entries are normalized from arrays named `nodes`, `links`, `extended_nodes`, and similar variants.
  - Edge entries are normalized from arrays named `edges`, `links`, and related variants, accepting `source` / `target` or `from` / `to` link fields.
  - Known structural keys (`id`, `name`, `label`, `type`, `source`, `target`, `from`, `to`, `data`) are preserved, while all other keys are merged into `GraphNode.properties` or `GraphEdge.properties`.
  - No dataset‑specific assumptions are made; the transformation is purely structural so fields remain domain‑agnostic.
- The Graph Fields view surfaces these normalized properties as regular fields:
  - Structural fields appear alongside arbitrary workflow fields such as phases, layers, scores, categories, or tags, depending on the input JSON.
  - This allows the same UI to handle many workflow‑shaped JSON sources without hardcoding knowledge of any particular dataset.

## Raw JSON Context Banner in Graph Fields

- When the active `GraphData` has `context === "raw-nodes-edges"`, the Graph Fields view shows a context banner at the top of the panel.
- The banner copy is provided by the UI copy configuration (`canvas/src/lib/config-copy/uiCopy.ts`) using the following keys:
  - `graphFieldsRawContextBannerTitle`
  - `graphFieldsRawContextBannerDescription`
  - `graphFieldsRawContextBannerAction`
- The banner explains:
  - That the currently visible fields were derived by `rawToGraphData` from the ingested JSON structure.
  - That structural fields such as identifiers, labels, and link endpoints have been normalized into standard AgenticRAG graph fields.
  - That remaining properties were preserved as generic node and edge fields so they can be curated without changing the underlying source data.
- The banner is rendered in `GraphFieldsView` before the main field grid:
  - It appears only when `graphData.context === "raw-nodes-edges"`.
  - It uses neutral, configuration‑driven copy so deployments can customize language without changing application logic.

## Mapping Raw JSON Fields to Agentic Roles

- The Graph Fields view is where raw JSON properties can be mapped onto AgenticRAG roles via field configuration.
- Typical mappings for workflow‑style JSON graphs include:
  - Choosing a small set of key fields (for example, phase‑like, layer‑like, or outcome‑like fields) as primary Agentic dimensions.
  - Treating remaining fields as descriptive metadata that stays attached to nodes and edges but does not drive core Agentic behavior.
- The raw JSON banner is a reminder that:
  - No automatic, dataset‑specific mapping has been applied.
  - Operators should review fields in Graph Fields, decide which ones are key to their use case, and apply the appropriate field settings.
- This keeps the ingestion path neutral and schema‑driven while giving the Graph Fields view a clear, explainable UX story for raw JSON graphs.

## Lifecycle tags and graph layers

- Lifecycle roles such as `idea`, `hypothesis`, `execution`, `pivot`, and `alert` are stored as plain tags in `GraphNode.properties.tags` and participate in the same field catalog as other node properties.
- The Graph Layer view provides a dedicated **Lifecycle tags for layers** helper that updates `properties.tags` on the currently selected owner node using the renderer palette lifecycle keys, so the Graph Fields view reflects these tags alongside other workflow fields without introducing special‑case schema.
