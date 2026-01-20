# Knowgrph Client-Side Parsers

## Parser Registry

- Parser selection is first-match ordered (`bestMatch`) over the registered parser list.
- Built-in parsers are registered in this order: CSV → JSON‑LD → JSON → n8n → Markdown → Python → GraphRAG.

## Markdown Parser (Client-Side)

- Entry: [default.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/parsers/default.ts)
- Output: JSON‑LD graph materialized into `GraphData` via `parseJsonLd`.
- Layer metadata:
  - When JSON‑LD originates from the markdown CLI (`knowgrph_parser.markdown_cmd` / `graph_builder.parse_markdown_to_graph_jsonld`), `graph_jsonld.metadata.layers` provides neutral hints that downstream tools can map into renderer behavior:
    - `semantic`: treats `Entity` nodes with co-occurrence edges (for example, `coOccursWith`) as a semantic similarity graph using PMI-derived weights and community identifiers.
    - `documentStructure`: lists structural node types (`Document`, `Section`, `Paragraph`, `List`, `ListItem`, `CodeBlock`, `Table`) and structural edge labels (`hasSection`, `hasBlock`, `hasItem`, `next`, `linksTo`) for document-centric views.
  - Canvas rendering uses `schema.layers.mode` (`document` | `schema` | `semantic`) to choose the active layer mode. Legacy graph metadata values such as `defaultLayer = "document-structure"` or `"property"` are normalized by the client into the current contract.
  - `metadata.defaultLayer` is typically set to `"semantic"` for markdown graphs so canvas defaults can remain dataset-agnostic.
  - Schema-config generation (`build_schema_config_jsonld`) reads these hints and copies them into `schema-config.metadata.layersFromGraph` and `schema-config.metadata.defaultLayerFromGraph`, then uses them to seed `schema-config.metadata.layers`:
    - `layers.semantic.similarityMetric` defaults to `"pmi"` and `layers.semantic.similarityEdgeLabel` adopts the parser’s `semantic.edgeLabel` (for example, `"coOccursWith"`).
    - `layers.semantic.hiddenNodeTypes` can be initialized from `metadata.layers.semantic.nodeTypes` so semantic mode can downweight or hide structural types while leaving other layer modes neutral.
    - `layers.documentStructure.structuralNodeTypes` and `layers.documentStructure.structuralEdgeLabels` are initialized from `metadata.layers.documentStructure` node/edge lists.
  - For quick inspection without writing artifacts, the markdown CLI exposes:
    - `python -m knowgrph_parser markdown --input docs/documents/knowgrph-parser-document.md --print-schema-layers`
    - This command prints only `schema-config.metadata.layers` derived from the parser-emitted graph metadata and exits.
- Inline refs:
  - Extracts `![alt](url)` images and `[label](url)` links from paragraph blocks.
  - Resolves relative `url` values against the document URL when `name` is `http(s)`.
- Mermaid Support:
  - Supports 100% of standard Mermaid Flowchart syntax including all node shapes:
    - Standard boxes `[text]`, `["text"]`
    - Rounded boxes `(text)`
    - Stadium/Pill `([text])`
    - Subroutine `[[text]]`
    - Cylinder `[(text)]`
    - Circle `((text))`
    - Asymmetric `>text]`
    - Rhombus `{text}`
    - Hexagon `{{text}}`
    - Parallelogram `[/text/]` and `[\text\]`
    - Trapezoid `[/text\]` and `[\text/]`
    - Double Circle `(((text)))`
  - Supports complex edge definitions including multi-directional and symbol edges (`o--o`, `x--x`, `<-->`).
  - Correctly parses class definitions (`classDef`, `class`) and style strings.
  - Handles nested subgraphs and click events.
- Media nodes:
  - `Image` nodes use `properties.image` / `properties.media_kind: "image"`.
  - `Video` nodes use `properties.video` / `properties.media_kind: "video"`.
  - `IFrame` nodes use `properties.iframe_url` / `properties.media_kind: "iframe"`.
  - All media nodes are tagged with `properties["visual:shape"] = "rect"` for panel-like rendering.
  - GitHub README URLs (for example, MLflow at `https://github.com/mlflow/mlflow/blob/master/README.md`) keep the blob URL as the document URL while resolving inline media relative to that URL.
  - Ingestion always emits media-capable nodes when media is detected; the **Render Media as Nodes** toggle in the canvas only affects how those nodes are rendered in the 2D scene, not whether they exist in the graph.

### Markdown Rendering (Canvas UI)

- Block/inline markdown rendering and preview lexing in Canvas use a markdown parser built on `markdown-it`.
- The UI maps markdown blocks (headings, paragraphs, lists, tables, code, blockquotes, HTML) into a neutral token AST for:
  - Line-aware preview and media extraction (for Mermaid, images, video, iframes).
  - HTML/PDF export of markdown documents via `markdown-it.render`.
  - **Token Sharing**: The markdown lexer runs once at the parent level, and tokens are shared between the Viewer, TOC, and Editor components to optimize performance and prevent redundant processing.
  - Heading reordering and folding reuse TOC tree helpers (`buildTocTree`, `findParent`) so sibling constraints stay consistent.
- Line mapping:
  - The markdown tokenizer preserves 1-based `lineStart`/`lineEnd` ranges for block-level tokens so downstream components can relate rendered text back to the original source.
  - When graphs carry `metadata.lineStart`/`metadata.lineEnd` on nodes and edges, the Bottom Panel markdown editor/viewer can scroll directly to the corresponding text range and keep it pinned under the editor viewport’s top edge when selections change on the canvas.
  - The same line metadata powers the Markdown Preview context menu so right-clicking a selection in the preview can locate and select the associated node or edge on the canvas when provenance is available.
- HTML blocks:
  - Single-tag `<img>`, `<video>`, and `<iframe>` blocks are rendered via [MarkdownHtmlBlock.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/markdown/ui/MarkdownHtmlBlock.tsx) using `isSafeHref`, `isSafeMediaSrc`, and `resolveHref` from [markdownPreviewLinks.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/markdown/ui/markdownPreviewLinks.tsx).
  - More complex HTML wrappers (for example `<center><img src="assets/rlhf.png" width="800"><br>…</center>`) are parsed with `DOMParser` via `renderSafeHtmlBlock`, which walks the DOM tree, applies the same safety checks, and resolves relative `src` attributes against the active markdown document path, so Canvas can render media from HTML blocks with relative assets as long as they satisfy the generic relative-path safety regex.
- The previous `Marked` dependency has been fully removed; all markdown parsing in the canvas now flows through the `markdown-it` parser and internal token adapters.
- Authoring for architecture and workflow docs uses Docusaurus-compatible Markdown in `docs/documents/`; Canvas previews those same files via the markdown-it pipeline for structural debugging and media verification, while the Docusaurus static site remains the source of truth for production theming and navigation.

## HTML → Markdown Conversion

- Entry: [html-parser.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/parsers/html-parser.ts)
- Converts HTML into Markdown while resolving `href`/`src` against the page URL.
- Emits `![Video](...)` and `![IFrame](...)` to allow the Markdown parser to materialize media nodes downstream.

## JSON‑LD and JSON Parsers (Client-Side)

- Entry: [default.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/parsers/default.ts)
- Unified parse entrypoint:
  - `parseGraph(name, text)` is the single parsing surface for `.csv`, graph-shaped `.json`, JSON‑LD, n8n workflows, and GraphRAG bundles ([adapter.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/lib/graph/io/adapter.ts)).
  - `parseTextToGraph(name, text)` remains as a compatibility wrapper and delegates to `parseGraph` so worker and non-worker paths cannot drift.
- JSON‑LD parser spec (`jsonldSpec`):
  - Uses `parseJsonLd` to turn any structurally valid JSON‑LD document into `GraphData`.
  - Treats `@graph` as the node/edge universe, applies AgenticRAG context handling when `@context` matches the canonical URL, and preserves all node and edge properties without dataset‑specific assumptions.
  - This single spec covers workflow graphs, ontologies, and assessment datasets (for example, multi‑ontology JSON‑LD, schema graphs, and workflow fixtures) without requiring custom parsers per dataset.
- JSON parser spec (`rawJsonSpec`):
  - Matches generic `.json` inputs that are not already claimed by more specific specs.
  - When the object exposes `nodes` and `edges` arrays with graph‑shaped entries, the data is treated as `GraphData` directly.
  - For all other shapes, `rawToGraphData` normalizes the input into `GraphData`:
    - Accepts top‑level arrays named `nodes`, `edges`, or `links` and suffix‑matched variants such as `extended_nodes` and `extended_nodes_v2`.
    - Merges non‑structural fields from each entry into `GraphNode.properties` or `GraphEdge.properties` while deriving neutral `id`, `label`, and `type` values.
    - Supports both `source`/`target` and `from`/`to` edge endpoints, assigning a default `"relatedTo"` label when no explicit type is provided.
  - This keeps the JSON parser neutral and dataset‑agnostic while allowing workflow‑style JSON documents to be ingested without code changes or hardcoded dataset logic.

## JSON / JSON‑LD → Markdown Conversion (Backend Utility)

- Entry: [json_to_markdown_cmd.py](file:///Users/huijoohwee/Documents/GitHub/knowgrph/knowgrph_parser/json_to_markdown_cmd.py)
- Purpose:
  - Converts arbitrary JSON or JSON‑LD into Markdown for inspection, documentation, or downstream authoring without embedding dataset‑specific rules.
  - Operates purely on structure so the same logic applies across workflows, ontologies, assessment fixtures, and generic JSON exports.
- Output modes:
  - Mode `table`:
    - Used for arrays of uniform objects when all entries share the same keys and cell values are scalars.
    - Renders a Markdown table with headers inferred from object keys and one row per array element.
  - Mode `key‑value`:
    - Used for single objects without nested structures.
    - Renders a bullet list where keys are bold and values are rendered inline.
  - Mode `hierarchical`:
    - Used when nested objects or mixed arrays are detected.
    - Renders indented lists, preserving the original structure and nesting depth.
- Mode selection:
  - Default behavior (`--mode auto`):
    - Arrays of uniform scalar objects → `table`.
    - Single objects without nested structures → `key‑value`.
    - Any structure with nested objects or arrays → `hierarchical`.
  - Modes can be forced explicitly via `--mode table`, `--mode key-value`, or `--mode hierarchical`.
- Configuration:
  - `--table-max-rows` and `--table-max-columns` control table truncation with a neutral summary line for omitted rows.
  - `--indent` and `--bullet` control hierarchical list formatting.
  - `--no-sort-keys` preserves original object key order instead of sorting.
- Example usage:
  - `python -m knowgrph_parser.json_to_markdown_cmd --input path/to/graph.json --mode auto`
  - `python -m knowgrph_parser.json_to_markdown_cmd --input path/to/fixture.jsonld --mode table --table-max-rows 50`
