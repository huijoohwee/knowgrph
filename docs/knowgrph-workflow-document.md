# Interactive Product Tour & Onboarding Flow

*Aligned with Generic KG/RAG Pipeline Principles and the INGEST → PRODUCE → REUSE architecture defined in `docs/knowgrph-raci-document.md`.*

---

**Phase Mapping**

- The Main Panel **Workflow** tab follows the 8‑step AgenticRAG pipeline from `docs/knowgrph-raci-document.md`. Step labels and short/long descriptions are single‑sourced from `WORKFLOW_STEP_COPY` in `canvas/src/features/panels/config.ts`:
  1. Schema (decide meaning once)
  2. UI curation layer
  3. Ingest
  4. Enrich
  5. Index and store
  6. Agentic reasoning
  7. Produce
  8. Reuse and render

---

## Workflow Presets

<!-- WORKFLOW_PRESETS_TABLE_START -->

| Preset ID | Dataset | Schema | Primary use case |
|---|---|---|---|
| `sample-investors-top3-3d` | `data/test-data/graph_202512091600.json` | `schema-config/knowgrph-universal-schema-config.jsonld` | Demo: Sample Investors Top-3 (3D) |
| `ai-kg-viz` | `data/test-data/ai-kg-viz_1500.json` | `schema-config/knowgrph-universal-schema-config.jsonld` | Demo: AI KG Visualization |
| `ai-customer-voice-management` | `data/test-data/ai-customer-voice-management.graph.json` | `schema-config/knowgrph-universal-schema-config.jsonld` | Demo: AI Customer Voice Management |
| `universal-lean-startup-kg` | `data/test-data/universal-lean-startup-kg.json` | `schema-config/knowgrph-universal-schema-config.jsonld` | Demo: Universal Lean Startup Knowledge Graph |
| `a0-investors-kg` | `data/test-data/a0.jsonld` | `schema-config/knowgrph-universal-schema-config.jsonld` | Demo: A0 Investors Knowledge Graph |
| `venture-capital-portfolio` | `data/test-data/graph_202512091600.json` | `schema-config/knowgrph-universal-schema-config.jsonld` | Demo: Venture Capital Portfolio |

<!-- WORKFLOW_PRESETS_TABLE_END -->

---

## Tooltip Semantics (Workflow tab)

- `WORKFLOW_STEP3_PARSER_TOOLTIP` – Parser tab → load parser specs, apply presets, and run ingest flows → keep CSV/JSON inputs mapped predictably into AgenticRAG `GraphData`.
- `WORKFLOW_STEP6_ORCHESTRATOR_TOOLTIP` – Orchestrator presets → run Agentic GraphRAG traversal helpers from the Orchestrator tab → keep traversal docs and behavior aligned with the Graph Traversal floating panel.
- `WORKFLOW_STEP8_BOTTOM_TABS_TOOLTIP` – Bottom panel tabs → combine Data, Table, and Render views on `GraphData` → validate, visualize, and export layouts with consistent AgenticRAG semantics.

### JSON‑LD fixtures for workflow tooltips

The Workflow tab tooltip helpers are also represented as AgenticRAG `rag:RoleActionOutcome` JSON‑LD fixtures that keep UI copy, RACI roles, and AgenticRAG semantics aligned. The fixtures live under `schema-config/` and are exercised by schema‑driven copy tests in `canvas/src/__tests__/orchestratorCopy.test.ts`:

- Parser (Step 3) – `WORKFLOW_STEP3_PARSER_TOOLTIP` ↔ `schema-config/workflow-step3-parser-role-action-outcome.jsonld`.
- Orchestrator (Step 6) – `WORKFLOW_STEP6_ORCHESTRATOR_TOOLTIP` ↔ `schema-config/workflow-step6-orchestrator-role-action-outcome.jsonld`.
- Bottom panel tabs (Step 8) – `WORKFLOW_STEP8_BOTTOM_TABS_TOOLTIP` ↔ `schema-config/workflow-step8-bottom-tabs-role-action-outcome.jsonld`.

Together with the Orchestrator, Graph Fields, Graph Data Table, Workflow links, Agentic reasoning labels, `graphRAGPath` metadata, traversal preset UI, Canvas cheatsheet, and codebase index entry-point fixtures described in `knowgrph-semantics-document.md`, these JSON‑LD objects provide a machine‑readable contract for the Role → Actions → Outcome semantics used across the Workflow, Help, and Orchestrator surfaces.

---

## Step 1 – Load Data (Ingest: Loader → Parser → Validator)

**Action**: Load graph data from any source so Loader and Parser can transform it into canonical `GraphData` without domain assumptions.

**Supported Sources**:
- File upload (JSON, CSV, JSON-LD)
- API endpoint URL
- Database connection string
- Paste raw JSON
- Markdown document import (Local Device or URL ending in `.md`) via Toolbar → Workspace Actions → Markdown → Import, which parses the document into an AgenticRAG-aligned JSON-LD graph and opens the bottom panel Markdown editor/viewer for inspection, selection-driven provenance, and export.

**Markdown Import Flow (UI → Parser → GraphData → Viewer)**:
- Floating panel Workspace Actions triggers `ToolbarToolMenuAreas` → `ToolbarMenuLauncher` to pick local/URL markdown text.
- Loader runs `loadGraphDataFromTextViaParser()` which auto-selects the built-in `markdown` parser (`features/parsers/default.ts`).
- Parser builds JSON-LD blocks with `metadata.documentPath`, `metadata.timestamp`, `metadata.lineStart/lineEnd` and converts to `GraphData` via `parseJsonLd()` (`lib/graph/jsonld.ts`).
- Bottom panel Markdown section renders source + preview, highlights selected node/edge line ranges, and suppresses resize-driven auto-scroll so drag-resizing the split pane does not jump the editor or preview (`BottomPanelMarkdownSection` + `MarkdownPreview`).
- Markdown preview is tokenized GFM-first (CommonMark-style fallback) and supports Slidev-style slide separators: standalone `---` lines split slides in Presentation Mode (`MarkdownPreview` + `markdownPreviewLex`).
- Presentation Mode renders a 16:9 slide stage, supports Prev/Next + keyboard navigation, and (when present) renders MDX slides with JSX components while still enabling GFM tables/task lists (`MarkdownPreview`).
- Mermaid code blocks render inline SVG in the bottom panel; a single-click on a diagram opens the MainPanel Preview tab with that Mermaid code focused in a 16:9 gallery stage, and a subsequent single-click inside the PreviewPanel diagram promotes it into a fullscreen, zoomable viewer with Fit, zoom-in/out, wheel zoom, and drag-to-pan for detailed inspection (`MarkdownPreview` + `MermaidDiagram` + `PreviewPanelView`).
- Markdown preview supports safe rich media rendering (images, common iframe embeds, and mp4/webm links) and routes single-clicks on these rich media blocks to the MainPanel Preview tab, where a 3x3, 16:9 media gallery shows lightweight mini-previews in tiles and an enlarged 16:9 stage for the currently selected item (`MarkdownTokenRenderer` + `PreviewPanelView`).

**Process**:
1. Click **Load Data** button
2. Select source type
3. Loader validates JSON syntax
4. Parser validates against schema
5. Graph structure loaded: `{nodes[], edges[], metadata{}}`

**Principle Compliance**:
- ✅ Loader accepts any valid source (no hardcoded paths)
- ✅ Parser validates structure only (no domain assumptions)
- ✅ Zero references to specific files or datasets

---

## Step 2 – Validate & Inspect (Ingest: structural checks)

**Action**: Review parsed graph structure and quality metrics before moving into schema tuning or enrichment.

**Validation Checks**:
- Node ID uniqueness verified
- Edge references validated (source/target exist)
- Schema conformance confirmed
- Quality metrics calculated

**Inspection Tools**:
- Node count, edge count, metadata summary
- Validation report (errors/warnings)
- Sample preview (first 10 nodes/edges)
- Bottom panel **Parser** tab → Parser UI Editor for configuring parsers in JSON/YAML/Python while keeping transforms generic and domain-agnostic
- JSON-LD graph mapping summary in the bottom panel **Parser** tab showing node/edge counts, edge properties discovered from `@context` that are treated as `@id` relationships, and a small toggle surface for selecting which context edge properties participate in graph traversal. Selected keys are stored on the in-memory `GraphData.metadata.jsonLdMapping.contextEdgeProperties` contract so Loader, Schema, Orchestrator, Render, and Main panel Graph Fields can reuse the same mapping when exporting JSON-LD or wiring AgenticRAG workflows (`canvas/src/features/panels/views/ParserSections.tsx:205-247`, `canvas/src/lib/graph/jsonld.ts:38-107`, `canvas/src/lib/graph/types.ts:24-34`). When this contract is present on `GraphData.metadata` (for example from a codebase index JSON-LD generated by `python -m knowgrph_parser parse-codebase-index`), the GraphRAG workflow export builder reads `contextEdgeProperties` and seeds the first `rag:TraversalRule` with `allowedRelations` equal to the selected edge labels, falling back to all observed edge labels when no explicit selection is present (`canvas/src/features/panels/utils/graphragConfig.ts:139-193`). The Orchestrator text editor surfaces the active selection as a non-editable pill list so users can see which JSON-LD context relations the downstream AgenticRAG pipeline will treat as traversable (`canvas/src/features/panels/views/RenderSettingsSection.tsx:1568-1790`). The bottom panel Parser toolbar’s `Collapse All` / `Expand All` behavior is kept in sync with the underlying parser workflow state via `useParserBottomPanelState`, allowing `BottomPanelBody` to treat Parser, Orchestrator, and Render tabs uniformly when wiring toolbar controls and future analytics events (`canvas/src/features/panels/hooks/useParserBottomPanelState.ts:1-56`, `canvas/src/components/BottomPanel/BottomPanelBody.tsx:84-116`).

**Principle Compliance**:
- ✅ Parser ignores domain-specific property names
- ✅ Validation is structural only (no semantic checks)
- ✅ Works with any domain (finance, biology, AI)

---

## Step 3 – Configure Visualization (Schema and Graph Fields)

**Action**: Apply styling and layout rules

**Configuration Options**:
- **Node styling**: Size by property, color by type, shape selection
- **Edge styling**: Width by weight, color by relationship type
- **Layout algorithm**: Force-directed, hierarchical, radial, grid
- **Interaction**: Enable/disable click, drag, hover, expansion
- Main panel **Graph Fields** tab opens as a centered overlay (~80% viewport) sharing the same header/footer/container as Help, using a scrollable split layout for defining derived fields and toggling visibility from generic node/edge properties only
- Bottom panel **Curation** toolbar `Graph Fields` button no longer opens a separate fields editor; it routes to the Main panel Graph Fields tab so field configuration, Graph Data Table columns, and text editors stay in sync via shared `graphFieldSettingsById` and column visibility/order state

**Schema Templates**:
- Load pre-configured templates (not tied to specific datasets)
- Customize rules in Schema UI Editor
- Import `schema-config/*.json` via Schema tab to replace the active schema (clean-slate)
- Export configuration for reuse

**Principle Compliance**:
- ✅ Renderer uses generic node/edge structures
- ✅ Styling based on properties (not hardcoded domain logic)
- ✅ Templates are domain-agnostic

---

## Step 4 – Visualize & Explore (Reuse: renderer focus)

**Action**: Interact with graph visualization

**Visualization Features**:
- Dynamic layout rendering
- Multi-dimensional views (2D/3D toggle)
- Minimap navigation
- Zoom/pan controls
- Search and filter nodes/edges
- Bottom panel Graph Data Table aggregates numeric fields by group and renders a toggleable aggregate chart per group row using `GraphDataTableAggregateNumericSummary` and a D3-backed layout (`canvas/src/features/graph-data-table/graphDataTable.ts:33–54`, `canvas/src/features/graph-data-table/ui/GraphDataTableTable.tsx:25–190,565–696`). Users can cycle a single “Chart” toggle through `Off → Radial hull → Bars → Sparkline`, and a small Graph Data Table setting (exposed in both the Settings panel and the bottom panel **Table view** dropdown as “Start with charts off / Start with radial charts”) controls whether the initial mode is `radial` or `none`, keeping behavior user-configurable while reusing the same underlying aggregate data and avoiding dataset-specific presets.
 - Canvas **Group Polygons** toolbar button toggles phase/step-style convex hull outlines around related nodes in both 2D and 3D views. Group membership comes from JSON-LD array properties (for example, arrays of node ids or compact IRIs on phase/section nodes), and styling is driven by `schema.metadata["canvas:polygons"]` so fill, opacity, stroke, dash patterns, and grouping metadata (for example, `groupingLogic`, `layer`, `label`, `tooltip`, and `schemaDrivenStylingEntrypoint`) stay schema- and metadata-driven instead of hardcoded. The Main Panel **Graph Fields** tab exposes a polygon presets editor under Field Settings → Schema extras so teams can tune these defaults without changing renderer code.

**Exploration Tools**:
- Click node → highlight connections
- Double-click → expand neighbors
- Hover → show tooltip (properties)
- Run graph traversal queries
- Export subgraph selections
- Inspect grouped aggregates in the bottom panel Graph Data Table: when a node or edge is selected in the 2D/3D canvas, the corresponding group’s aggregate chart (radial hull, bars, or sparkline) is highlighted via a shared selection map (`selectedNodeId`/`selectedEdgeId` and neighbor sets) while non-selected groups keep the neutral stroke, keeping table aggregates, renderer selection, and AgenticRAG semantics aligned without relying on dataset-specific labels or IDs.
- Use canvas group polygons together with selection and traversal: selecting a node highlights its neighbors, dims unrelated nodes, and keeps its group polygon visible so users can see which phase or section owns the selected node while still treating all groups as generic JSON-LD-derived clusters (no dataset-specific stage names or labels).

**Principle Compliance**:
- ✅ Renderer visualizes generic structures
- ✅ No hardcoded domain-specific UI elements (polygon grouping is JSON-LD- and schema-driven)
- ✅ Works with any validated graph input

---

## Step 5 – Export & Share (Produce → Reuse)

**Action**: Export graph and configuration

**Export Formats**:
- **Graph data**: JSON, JSON-LD, CSV, GraphML, Cypher
- **Markdown documents**: `.md` files exported from the bottom panel Markdown editor via the Toolbar → Workspace Actions → Markdown area. These remain plain-text, dataset-agnostic sources that AgenticRAG pipelines treat as `rag:Markdown` inputs for the `python -m knowgrph_parser markdown` flow and downstream GraphRAG JSON-LD generation.
- **Visualization**: PNG, SVG, PDF
- **Configuration**: Schema JSON (reusable)
- **Report**: Validation summary, quality metrics
- **Workflow state**: History JSON-LD where each `kg:HistoryEntry` can optionally include a snapshot of `graphFieldSettingsById` (`kg:graphFieldSettings`) so field configuration versions track graph snapshots
- **Field configuration**: Graph Fields JSON-LD export containing one `kg:GraphFieldSetting` per field, with optional `kg:fieldType` and `kg:description` hints aligned to the AgenticRAG-friendly `kg:` schema prefix for downstream tooling; a minimal reference snippet for AgenticRAG pipelines is documented in `knowgrph-schema-catalog.md` under “Graph Fields Settings JSON‑LD”.
- **GraphRAG workflow**: JSON-LD export whose root `@type` is `rag:GraphRAGWorkflow`, aligned with UI anchors `rag:Embedding` and `rag:GraphRAGWorkflow` so downstream AgenticRAG pipelines can consume a stable, schema-driven workflow document independent of the raw graph data or schema files. The underlying shape matches the `GraphRagWorkflowJsonLd` type: it includes `graphId`, `retrievalMethod: 'graph-traversal'`, `maxHops`, a `traversalRules[]` array of `rag:TraversalRule` objects (`ruleType: 'relation-constraint'`, `allowedRelations[]`, optional `rulePriority`), and a `contextWindow` block (`@type: 'rag:ContextWindow'`, `contextSize`, `contextStrategy`), plus optional `dataset`, `chunking`, and `embeddingModel` sections used by CLI and offline pipelines. When `GraphData.metadata.jsonLdMapping.contextEdgeProperties` is present (toggled in the Parser UI), `buildGraphRagWorkflowFromGraphData` seeds the first `traversalRules[].allowedRelations` array from those keys so the AgenticRAG orchestrator respects the JSON-LD context edge choices (`canvas/src/features/panels/utils/graphragConfig.ts:139-193`, `canvas/src/features/panels/views/ParserSections.tsx:116-170`). The Main Panel **Workflow** tab exposes this as an inline JSON editor inside the Agentic Reasoning step that can be reset to a template, expanded for more vertical space, populated by importing an existing GraphRAG config JSON/JSON-LD file, or generated from the current `GraphData` (seeding traversal rules from edge labels). The import flow also accepts the CLI-style `config.yaml` format (for example `canvas/public/examples/graphrag-demo/config.yaml` or `configs/graphrag/aiap22-codebase-config.yaml`) and transforms it into the `rag:GraphRAGWorkflow` JSON-LD template automatically; when that YAML includes a `duckdb_queries` block, the importer maps it onto a `duckdbQueries[]` array on the workflow JSON-LD (`canvas/src/features/panels/utils/graphragConfig.ts:35-50,52-137`), and the Orchestrator tab reads those entries to populate the DuckDB query presets dropdown in the **Traversal presets and helpers** section so dataset-specific call-graph and diagnostics queries stay configuration-driven rather than hardcoded, with the presets dropdown and SQL editor automatically resetting to reflect the active workflow whenever you switch datasets or import a new GraphRAG YAML (`canvas/src/features/panels/views/OrchestratorSettingsSection.tsx:119-165,525-571`, `canvas/src/features/panels/views/OrchestratorTraversalPanels.tsx:16-29,258-304`).
  - Agentic traversal performance is influenced primarily by GraphRAG traversal helpers (`canvas/src/lib/graph/graphragTraversal.ts:1-158`) and selection/renderer subscribers (GraphCanvas, ThreeGraph, NodeEditor). Neighbor map caching and bounded BFS traversal keep path computation fast even on large graphs; see `knowgrph-system-performance-catalog.md` for budgets and module references.
  - Local Chat reasoning is an optional, metadata-driven surface powered by a user-configured OpenAI-compatible `/v1/chat/completions` endpoint. The Canvas Chat panel sends the selected node’s id/type, an ordered sample of its properties (prioritizing title/name/description/chunk_text/tags/url), and—when available—a markdown line-range excerpt derived from `metadata.lineStart/lineEnd` plus the imported markdown document, alongside the live conversation history. This keeps export and AgenticRAG workflow semantics unchanged while enabling local DeepSeek-R1-0528-Qwen3-8B or similar models to answer questions about the active graph without any dataset-specific logic in Loader, Parser, Schema, or Renderer (`canvas/src/pages/Canvas.tsx`, `canvas/src/hooks/store/uiSlice.ts`, `canvas/src/features/settings/registry-ui.ui.ts`).

### History JSON‑LD export example

```jsonld
{
  "@context": { "kg": "http://example.org/kg#" },
  "@type": "kg:HistoryExport",
  "kg:exportedAt": 1766229000000,
  "kg:historyIndex": 1,
  "kg:history": [
    {
      "@type": "kg:HistoryEntry",
      "@id": "history-1",
      "kg:label": "Initial import",
      "kg:timestamp": 1766228800000,
      "kg:data": {
        "context": "demo",
        "type": "Graph",
        "nodes": [],
        "edges": []
      },
      "kg:graphFieldSettings": {
        "node:chunk_text": {
          "displayName": "Chunk text",
          "isHidden": false,
          "fieldType": "Long text"
        },
        "edge:weight": {
          "displayName": "Weight",
          "isHidden": false,
          "fieldType": "Number"
        }
      }
    }
  ]
}
```

**CLI / Offline Pipelines**:
- Use the unified Python CLI parser under `python -m knowgrph_parser` for offline / batch workflows:
  - `jsonld-universal` for structural JSON/JSON-LD to `GraphData` conversion (optionally delegating to a loaded parser module).
  - `markdown` (default) for Markdown → AgenticRAG-aligned JSON-LD with Canvas provenance deep-links (`metadata.codebasePath#Lx-y`).
  - `parse-codebase-index` for converting `test-data/knowgrph-workflow.json` into a JSON-LD codebase index graph (`data/outputs/codebase-index-viz.jsonld`) enriched with traversal metadata plus runtime tracing events.
  - `embed-codebase-index` and `test-embedding-sanity` for deterministic embeddings and validation.
  - `workflow-artifacts` for emitting workflow CSV/summary artifacts used by the Orchestrator tab.
    - Each node in the exported codebase index includes:
      - Structural fields: `@id`, `@type`, `name`, `path`, and codebase edges (`imports`, `renders`, `usesWorker`, etc.).
      - AgenticRAG path metadata: an optional `graphRAGPath` object (`query`, `traverse[]`, `multiHop[]`/`hops[]`, `context`) that drives orchestrated traversal in the Canvas Orchestrator tab.
        - Examples include:
          - Canvas entry path for end-to-end rendering: `canvas/src/pages/Canvas.tsx` → `canvas/src/components/GraphCanvas.tsx` → `canvas/src/workers/graphParser.worker.ts`.
          - Pipeline entry path: `npm run pipeline` → `python -m knowgrph_parser parse-codebase-index` → `embed-codebase-index` → `test-embedding-sanity` → `data/outputs/codebase-index-viz.jsonld`.
          - Store-to-index paths tying UI state to the pipeline: `canvas/src/hooks/store/schemaSlice.ts` and `canvas/src/hooks/store/historySlice.ts` → `canvas/src/features/panels/views/WorkflowSection.tsx` → `canvas/src/features/panels/hooks/useWorkflowExportActions.ts` → `python -m knowgrph_parser parse-codebase-index`.
      - RAG grounding text: a synthesized `chunk_text` string derived from `graphRAGPath` for direct use as `AgenticRagNodeView.chunkText` (see `canvas/src/lib/graph/jsonld.ts:132-181`).
      - Orchestrator and Settings panels use a shared two-column Key/Value row primitive (`KeyValueRow` in `canvas/src/features/panels/ui/KeyValueRow.tsx`) so traversal controls (start node id, max depth, label filters) and non-traversal settings (3D formulas, workflow indexing summaries, traversal delay sliders) present consistent “label on the left, control on the right” layouts across the workflow.
      - Per-node provenance: a `metadata` object compatible with `AgenticRagNodeProvenance` (`canvas/src/lib/graph/types.ts:60-76`), including `source`, `timestamp`, `codebasePath`, `codebaseArea`, optional `curator` (from `owner`), a normalized `confidence` score derived from `testCoverage` when available, and `codebaseId` for multi-codebase scenarios.
        - The `codebasePath` can point at JSON-LD exports such as `data/outputs/codebase-index-viz.jsonld`; Canvas treats this value as provenance metadata surfaced in the Orchestrator and Graph Data Table views rather than as a clickable file opener. Dev tooling and downstream viewers can still map repository-relative `codebasePath` values to Vite `/@fs` URLs (resolved relative to `VITE_CODEBASE_ROOT` for non-absolute paths) and interpret `#L<number>` fragments when opening files outside the core canvas UI.
    - Optional embedding stage: run `embed-codebase-index` to compute deterministic embeddings from each node's `chunk_text` and populate `embedding` arrays plus an `embeddingConfiguration` block in the top-level `metadata`. The script defaults to a 64-dimensional vector space and records the model identity using the patterns from `knowgrph-metadata-lint-patterns.md` (for example `example:embedding-config-codebase` with `modelName: "text-embedding-3-large"` and `provider: "OpenAI"`). This keeps the codebase index JSON-LD ready for vector search while remaining schema- and provider-agnostic. For local pipelines and CI, `knowgrph_parser/pipeline_cmd.py` wires `parse-codebase-index`, `embed-codebase-index`, and `test-embedding-sanity` into a single `npm run pipeline` command that validates structural, embedding, traversal, tracing, and AgenticRAG metadata performance end-to-end.
    - Canvas workflow: run `parse-codebase-index` (and optionally `embed-codebase-index`), then in the Panel Parser tab load `data/outputs/codebase-index-viz.jsonld` with the JSON-LD parser and import `schema-config/codebase-index-schema.json` in the Schema tab before switching to Render. The Orchestrator tab can then expose the selected node as an `AgenticRagNodeView` and operate over the embedded `graphRAGPath`, `chunkText`, `embedding`, provenance, and runtime events.
- To drive the full Agentic GraphRAG codebase pipeline (parse → optional file-backed embeddings → embedding sanity check) from the repo root alongside `npm run lint` and `npm run check`, run:
  - `npm run pipeline` – calls `python -m knowgrph_parser pipeline` to:
    - Execute `python -m knowgrph_parser parse-codebase-index` using `orchestrator-config/knowgrph-universal-orchestrator-config.yaml`.
    - Run `python -m knowgrph_parser embed-codebase-index` with the `file` backend and `knowgrph_parser/codebase-index-embeddings-example.json` for quick end-to-end checks (currently using a 4-dimensional vector space).
    - Invoke `python -m knowgrph_parser test-embedding-sanity` with matching dimensions so the step fails fast if any node with `chunk_text` is missing, has malformed embeddings, or falls out of alignment with the traversal/tracing metadata.
- In Canvas development builds, the **Run pipeline** control in the toolbar and Workflow tab triggers the same markdown → graph pipeline that is exposed in the Help tab command copy:
  - Start the dev server from `knowgrph/canvas/`: `pnpm install` (once) and `pnpm run dev`.
  - Open the Canvas app in the browser and ensure `VITE_CODEBASE_ROOT` points at the repo root so the `/@fs` loader can resolve pipeline outputs (for example `data/knowgrph-workflow-preview/knowgrph-workflow-document-*.jsonld`).
  - Click **Run pipeline** from the toolbar floating menu or the Render → Markdown pipeline helper section; Canvas calls a dev-only `window.knowgrphRunMarkdownPipeline()` hook.
  - The dev server uses a small local middleware to execute the canonical markdown pipeline command (`python -m knowgrph_parser markdown ...`) and write fresh graph, schema, and workflow artifacts before the UI reloads them via `/@fs` URLs.
- These tools keep canvas loaders and parsers generic while enabling schema-aware batch workflows and database connectors outside the browser. The browser pipeline still ingests generic `GraphData` artifacts only, independent of source format or domain.

**Sharing Options**:
- Save to file
- Copy to clipboard
- Generate shareable link (if backend available)
- Export for production use

**Principle Compliance**:
- ✅ Export format independent of source format
- ✅ Configuration portable across datasets
- ✅ No coupling to specific file names or paths

---

## Complete Workflow Example

### Finance Dataset
```
1. Load: Upload "investments.json"
2. Validate: 50 nodes (Person, Company), 75 edges (INVESTED_IN)
3. Configure: Color by node type, size by investment amount
4. Visualize: Force-directed layout, expand investor networks
5. Export: GraphML for Neo4j import
```

### Biology Dataset
```
1. Load: Fetch from API "https://bio-kg.example.com/proteins"
2. Validate: 200 nodes (Protein, Gene), 350 edges (INTERACTS_WITH)
3. Configure: Hierarchical layout, color by pathway
4. Visualize: 3D view, filter by confidence score
5. Export: JSON-LD for semantic web integration
```

### AI Concepts Dataset
```
1. Load: Paste JSON with embeddings and chunk_text
2. Validate: 40 nodes (Concept, Technique), 60 edges (enables, requires)
3. Configure: Size by importance, layer-based layout
4. Visualize: 2D with graph traversal simulation
5. Export: Schema + data for RAG pipeline
```

### Customer Voice Dataset
```
1. Load: Open bottom panel Parser tab → Workflows → "Demo: AI Customer Voice Management"
2. Validate: Nodes (CustomerFeedback, Customer, Topic, PointOfContact, Reviewer, Priority, Status, Group) and edges (submittedBy, hasTopic, assignedTo, reviewedBy, handledBy, hasPriority, hasStatus, belongsToGroup)
3. Configure: Priority-based sizing via CustomerFeedback.visual:importance and schema-config/ai-customer-voice-management-schema.json
4. Visualize: 3D view with priority colors (P1/P2/P3) and tuned charge/collision
5. Export: JSON/JSON-LD/CSV/GraphML/Cypher for downstream RAG pipelines
```

---

## Onboarding Tips

**First Time Users**:
1. Start with sample data (provided in any format)
2. Use default visualization template
3. Explore with tooltips and minimap
4. Export results to understand output format

**Advanced Users**:
1. Load from API or database directly
2. Create custom schema configurations
3. Build reusable visualization templates
4. Integrate exports into production pipelines

**Best Practices**:
- Always validate before visualizing
- Use quality metrics to assess data completeness
- Save schema configurations for consistent styling
- Export configurations along with data for reproducibility

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Load Data | `Ctrl/Cmd + O` |
| Export Graph | `Ctrl/Cmd + E` |
| Toggle 2D/3D | `Space` |
| Reset View | `R` |
| Search Nodes | `Ctrl/Cmd + F` |
| Help | `?` |

---

## Troubleshooting

**Issue**: "Validation failed: duplicate node IDs"
- **Solution**: Ensure all `nodes[].id` values are unique

**Issue**: "Broken reference: edge source not found"
- **Solution**: Verify all `edges[].source` and `edges[].target` match existing `nodes[].id`

**Issue**: "No visualization rendered"
- **Solution**: Check that graph has at least 1 node; apply default schema if custom schema fails

**Issue**: "Export format not supported"
- **Solution**: Use JSON/JSON-LD for maximum compatibility; convert via external tools if needed

---

## Technical Requirements

**Browser Support**:
- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

**Data Limits**:
- Max nodes: 10,000 (recommended for smooth visualization)
- Max edges: 50,000 (recommended for smooth visualization)
- Use clustering/LOD for larger graphs

**File Size Limits**:
- Upload: 50 MB max
- Export: No limit (browser-dependent)

**Security**:
- All processing client-side (no data sent to servers)
- API/DB credentials stored locally (browser storage)
- Clear data option available in settings

---
