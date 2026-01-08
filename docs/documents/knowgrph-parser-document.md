# Knowgrph Client-Side Parsers

## Parser Registry

- Parser selection is first-match ordered (`bestMatch`) over the registered parser list.
- Built-in parsers are registered in this order: CSV → JSON‑LD → JSON → n8n → Markdown → Python → GraphRAG.

## Markdown Parser (Client-Side)

- Entry: [default.ts](file:///Users/huijoohwee/Documents/GitHub/knowgrph/canvas/src/features/parsers/default.ts)
- Output: JSON‑LD graph materialized into `GraphData` via `parseJsonLd`.
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
