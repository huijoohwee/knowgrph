# Knowgrph Client-Side Parsers

## Parser Registry

- Parser selection is first-match ordered (`bestMatch`) over the registered parser list.
- Built-in parsers are registered in this order: CSV → JSON‑LD → JSON → n8n → Markdown → Python → GraphRAG.

## Markdown Parser (Client-Side)

- Entry: [default.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/parsers/default.ts)
- Output: JSON‑LD graph materialized into `GraphData` via `parseJsonLd`.
- Layer metadata:
  - When JSON‑LD originates from the markdown CLI (`knowgrph_parser.markdown_cmd` / `graph_builder.parse_markdown_to_graph_jsonld`), `metadata.layers` declares three neutral layer modes for downstream rendering:
    - `semantic`: treats `Entity` nodes with co-occurrence edges (for example, `coOccursWith`) as a semantic similarity graph using PMI-derived weights and community identifiers.
    - `documentStructure`: surfaces structural node types (`Document`, `Section`, `Paragraph`, `List`, `ListItem`, `CodeBlock`, `Table`) and structural edge labels (`hasSection`, `hasBlock`, `hasItem`, `next`, `linksTo`) for layout-aware views.
    - `property`: keeps nodes and edges as emitted by the parser, using `properties` as the container for node and edge attributes without additional semantic derivations.
  - `metadata.defaultLayer` is set to `"semantic"` for markdown graphs so canvas layer toggles can treat semantic mode as the default without hardcoding per dataset.
  - Schema-config generation (`build_schema_config_jsonld`) reads these hints and copies them into `schema-config.metadata.layersFromGraph` and `schema-config.metadata.defaultLayerFromGraph`, then uses them to seed `schema-config.metadata.layers`:
    - `layers.semantic.similarityMetric` defaults to `"pmi"` and `layers.semantic.similarityEdgeLabel` adopts the parser’s `semantic.edgeLabel` (for example, `"coOccursWith"`).
    - `layers.semantic.hiddenNodeTypes` can be initialized from `metadata.layers.semantic.nodeTypes` so semantic mode can downweight or hide structural types while leaving document-structure and property layers neutral.
    - `layers.documentStructure.structuralNodeTypes` and `layers.documentStructure.structuralEdgeLabels` are initialized from `metadata.layers.documentStructure` node/edge lists, keeping document-structure mode aligned with parser-emitted structure.
  - For quick inspection without writing artifacts, the markdown CLI exposes:
    - `python -m knowgrph_parser markdown --input docs/documents/knowgrph-parser-document.md --print-schema-layers`
    - This command prints only `schema-config.metadata.layers` derived from the parser-emitted graph metadata and exits.
- Inline refs:
  - Extracts `![alt](url)` images and `[label](url)` links from paragraph blocks.
  - Resolves relative `url` values against the document URL when `name` is `http(s)`.
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
- HTML blocks:
  - Single-tag `<img>`, `<video>`, and `<iframe>` blocks are rendered via [MarkdownHtmlBlock.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/markdown/ui/MarkdownHtmlBlock.tsx) using `isSafeHref`, `isSafeMediaSrc`, and `resolveHref` from [markdownPreviewLinks.tsx](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/markdown/ui/markdownPreviewLinks.tsx).
  - More complex HTML wrappers (for example `<center><img src="assets/rlhf.png" width="800"><br>…</center>`) are parsed with `DOMParser` via `renderSafeHtmlBlock`, which walks the DOM tree, applies the same safety checks, and resolves relative `src` attributes against the active markdown document path, so Canvas can render media from HTML blocks with relative assets as long as they satisfy the generic relative-path safety regex.
- The previous `Marked` dependency has been fully removed; all markdown parsing in the canvas now flows through the `markdown-it` parser and internal token adapters.

## HTML → Markdown Conversion

- Entry: [html-parser.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/parsers/html-parser.ts)
- Converts HTML into Markdown while resolving `href`/`src` against the page URL.
- Emits `![Video](...)` and `![IFrame](...)` to allow the Markdown parser to materialize media nodes downstream.
