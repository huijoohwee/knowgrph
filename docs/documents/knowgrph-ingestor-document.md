# Knowgrph Source File Ingestor (Markdown, HTML, PDF, JSON, JSON‑LD, CSV)

## End‑to‑End Flow (Source Files → Graph → Canvas)

- Entry: Canvas toolbar **Source Files** area (tool menu `area: "sourceFiles"`).
6→- Action: User chooses **Import** / **Import (Local)** / **Import (URL)** plus a format:
7→  - `markdown`
8→  - `html`
9→  - `pdf`
10→  - `jsonld`
11→  - `json`
12→  - `csv`
- Orchestration: `useToolbarMenuAction` routes the action to the appropriate import function:
  - Markdown: `performMarkdownImport`
  - HTML: `performHtmlImport`
  - PDF: `performPdfImport`
  - JSON / JSON‑LD: `performJsonImport`
- Parsing: All content that becomes Markdown flows through the client‑side parser registry in `canvas/src/features/parsers/default.ts`:
  - Markdown → JSON‑LD → `GraphData`
  - JSON‑LD → `GraphData`
  - JSON (nodes/edges or raw) → `GraphData`
- Rendering: `loadGraphDataFromTextViaParser` sets `graphData` in the store and opens the Curation tab so the imported graph appears on the canvas.
- Media: Image/video/iframe URLs are normalized into node properties (`media_url`, `media_kind`, `image`, `video`, `iframe_url`) during ingestion; rendering is controlled later by a view‑only canvas toggle.

This section describes how each format enters the system, how it is converted, and how media is propagated from the original source into the graph.

## Source Files Tool Menu

- Configuration:
  - Defined in `canvas/src/features/toolbar/toolMenu.ts` as `ToolMenuArea = "sourceFiles"`.
  - Supported actions: `new`, `import`, `importLocal`, `importUrl`, `export`, `clear`.
- Behavior:
  - `import` chooses between URL or local file at runtime via prompt.
  - `importLocal` opens a file picker constrained to the format’s extensions.
  - `importUrl` uses a provided URL payload (bypassing the prompt).
  - `export` writes the current document/graph back out as Markdown/HTML/PDF/JSON/JSON‑LD.
- Integration:
37→  - All import actions end by calling `loadGraphDataFromTextViaParser` (for text formats, CSV/JSON/JSON‑LD) or `loadGraphDataViaParser` (for generic parser loads).
  - Import status is tracked in `useParserUIState` (last input, warnings, counts, status message).

## Markdown Ingestion (Local Files and URLs)

- Entry points:
  - `Source Files` → `Import` / `Import (Local)` / `Import (URL)` with `format: "markdown"`.
  - Implementation: `canvas/src/features/toolbar/markdownImportAction.ts`.
- URL handling:
  - URLs are normalized via `coerceHttpUrl`.
  - `fetchRemoteMarkdownText` (`ingestUtils.ts`) fetches content via:
    - Same-origin proxy (`/__fetch_remote`) when origins differ or when running under dev server.
    - Direct `fetch` fallback when proxy is unavailable.
    - Git hosting URLs that use a `blob` path segment are normalized to their raw content endpoint before fetch, so Markdown and media are ingested from the underlying source file instead of the viewer HTML.
  - The fetched payload is passed through a light HTML detector:
    - If it looks like HTML, it is converted with `parseHtmlToMarkdown`.
    - Otherwise it is treated as raw Markdown.
- Local files:
  - Imported via `pickTextFileWithExtensions(['.md', '.markdown'])`.
- Parsing:
  - The Markdown text is passed to the parser registry (`default.ts`), which:
    - Splits blocks (`parseMarkdownBlocks`).
    - Builds JSON‑LD via `buildMarkdownJsonLd`.
    - Converts JSON‑LD into `GraphData` via `parseJsonLd`.
- Media:
  - Inline refs are extracted from paragraph text:
    - `![alt](url)` for images/media.
    - `[label](url)` for links.
    - `<img ...>` tags embedded directly in Markdown paragraphs (including simple wrappers such as `<center>...</center>`).
  - URLs are resolved against the document URL when the source `name` is `http(s)`.
  - A minimal smoke file for HTML image ingestion lives at:
    - `data/_tmp_md_smoke/markdown-html-img-smoke.md`
    - Load it via **Source Files → Import (Local)** with `format: "markdown"` to verify that HTML `<img>` content produces media-capable nodes and, when enabled, panel-like media nodes on the canvas.
  - End‑to‑end coverage:
    - A dedicated test `ui.markdown.mediaToggleEndToEnd` (`canvas/src/__tests__/markdownMediaToggleE2e.test.ts`) exercises:
      - Local Markdown: `data/_tmp_md_smoke/markdown-html-img-smoke.md`.
      - Remote Markdown: `https://github.com/chiphuyen/aie-book/blob/main/chapter-summaries.md` (GitHub blob URL).
    - The test asserts that:
      - Media‑capable nodes are present in the graph regardless of the canvas media toggle.
      - The Bottom Panel Markdown viewer (`BottomPanelMarkdownSection`) renders the same Docusaurus-compatible Markdown with `<img>` tags in the preview, using the canvas markdown‑it pipeline for structure while the Docusaurus site provides the production theme.
  - The global **Render Media as Nodes** canvas toggle:
    - Is available in the main toolbar (image icon, left of the 3D Mode button).
    - Is mirrored in the floating properties panel Media section and the toolbar settings export menu.
    - Is view‑only: it never changes ingestion or graph data; it only decides whether media properties are rendered as overlaid media panels on top of nodes in the 2D canvas.
  - Remote Markdown served through HTML viewers is handled by the same path:
    - The HTML response is converted to Markdown via `parseHtmlToMarkdown`.
    - Image, video, and iframe tags are lowered to the same `![alt](url)` markers.
  - When “Render Media as Nodes” is enabled:
    - Each distinct image/video/iframe becomes its own node (`Image`, `Video`, `IFrame`).
    - The node properties include:
      - `media_url` and `media` (canonical media URL).
      - `media_kind` in `{"image", "video", "iframe"}`.
      - `image` or `video` or `iframe_url` depending on type.
      - `visual:shape = "rect"` for panel‑like rendering.
    - Paragraphs link to media via `embedsImage` edges.
  - When “Render Media as Nodes” is disabled:
    - Images are preserved as `Link` nodes with `properties.url`.
    - Paragraphs use `linksTo` edges instead of `embedsImage`.

## HTML Ingestion (Local Files and URLs)

- Entry points:
  - `Source Files` → `Import` / `Import (Local)` / `Import (URL)` with `format: "html"`.
  - Implementation: `canvas/src/features/toolbar/htmlImportAction.ts`.
- Fetch and validation:
  - HTML is fetched via `fetchRemoteHtmlText`, which:
    - Uses the same proxy logic as Markdown ingestion.
    - Rejects dev‑server fallback HTML (`looksLikeViteDevIndexHtml`) to avoid importing the application shell.
  - Local HTML files are loaded via `pickTextFileWithExtensions(['.html', '.htm'])`.
- Conversion pipeline:
  - `parseHtmlToMarkdown` (`html-parser.ts`) turns the HTML into Markdown:
    - Preserves document structure (headings, paragraphs, lists, tables, code blocks, blockquotes).
    - Treats `main`, `article`, `section`, `nav`, `aside`, etc. as structural wrappers.
    - Handles feeds (RSS/Atom/XML) as Markdown sections when applicable.
  - Embedded JSON‑LD is extracted by `extractJsonLd` and optionally appended as a JSON block for inspection.
- Media mapping:
  - `<img>` → `![alt](resolvedUrl)`.
  - `<video>`:
    - Uses the first non‑empty `src` from the tag or descendants.
    - Emits `![Video](resolvedUrl)`.
  - `<iframe>` → `![IFrame](resolvedUrl)`.
  - All URLs are resolved against the page URL so relative paths remain valid.
  - These Markdown media markers are then treated by the Markdown parser as described above, producing rectangular media nodes or link fallbacks.
- Result:
  - The combined Markdown (plus optional JSON‑LD block) is ingested with the Markdown parser.
  - The resulting graph is immediately available in the Canvas Curation view.

## PDF Ingestion (Local Files and URLs)

- Entry points:
  - `Source Files` → `Import` / `Import (Local)` / `Import (URL)` with `format: "pdf"`.
  - Implementation: `canvas/src/features/toolbar/pdfImportAction.ts`.
- Conversion:
  - PDFs are posted to `/__convert_pdf`:
    - URL import: `POST /__convert_pdf?url=<encoded>` with the remote URL.
    - Local import: `POST /__convert_pdf` with raw PDF bytes and `Content-Type: application/pdf`.
  - The dev server routes requests to the Python backend (`knowgrph_parser`) which:
    - Parses the PDF into Markdown (using `pypdf`).
    - Emits a Markdown string plus an inferred display name.
  - The client receives `{ ok, markdown, name }` on success.
- Ingestion:
  - The converted Markdown is passed to `loadGraphDataFromTextViaParser`.
  - The Markdown parser path is identical to the native Markdown flow (blocks → JSON‑LD → `GraphData`).
- Media:
  - Extracted images are exposed as image URLs in the converted Markdown.
  - The Markdown parser turns them into `Image` nodes connected via `embedsImage` edges, honoring the global “Render Media as Nodes” setting.

## JSON‑LD, JSON, and CSV Ingestion

- Entry points:
-  - `Source Files` → `Import` / `Import (Local)` / `Import (URL)` with `format: "jsonld"` or `format: "json"`.
-  - `Source Files` → `Import` / `Import (Local)` with `format: "csv"`.
-  - Implementation: `canvas/src/features/toolbar/jsonImportAction.ts` plus the parser registry in `default.ts`.
- JSON‑LD:
  - If the top‑level object has `@context`, JSON‑LD import is used.
  - `parseJsonLd`:
    - Interprets `@graph` as nodes and edges.
    - Applies AgenticRAG context rules when `@context` references the canonical URL.
    - Preserves all non‑structural properties (including `media_url`, `media_kind`, `image`, `video`, `iframe_url`, `media`) on nodes.
  - Media URLs:
    - Remain as node properties.
    - Are interpreted by the renderer via `getNodeMediaSpec`, which normalizes GitHub `blob` URLs to their `raw.githubusercontent.com` equivalents and uses the same `/__fetch_remote?url=…` proxy endpoint that the ingestor uses when rendering media inside the canvas.
- JSON:
-  - If the JSON has `nodes` and `edges` arrays, they are used as‑is.
-  - Otherwise, `rawToGraphData` wraps the data into a `GraphData` object:
-    - `RawNode.data` becomes `GraphNode.properties`.
-    - Any media‑related fields present (`media_url`, `media_kind`, etc.) will be available to the renderer.
- CSV:
-  - Ingestion uses the CSV parser spec in `default.ts` (`csvSpec`).
-  - Tabular rows are mapped into nodes and edges based on column semantics.
-  - The imported CSV is also wrapped in a fenced Markdown block and stored as the active Markdown document so it appears in the Markdown preview bottom panel.

## Media Rendering Across Formats

- Canonical media properties:
  - `media_url`: canonical URL used to render media.
  - `media_kind`: `"image"`, `"svg"`, `"video"`, or `"iframe"`.
  - `image`, `video`, `iframe_url`, `media`: format‑specific helpers.
  - `media_interactive`: when explicitly `true` or `false`, overrides default interactivity for the media surface.
  - Renderer behavior:
  - `getNodeMediaSpec` (`GraphCanvas/helpers.ts`) inspects node properties and:
    - Chooses a single URL using the priority: `iframe_url` → `media_url` → `image` → `video` → `media`.
    - Infers the `kind` if `media_kind` is not explicitly set.
    - Normalizes and validates iframe URLs against an allowlist and drops unsafe iframe URLs.
    - Defaults `interactive` based on kind when `media_interactive` is not set:
      - `video` and `iframe` kinds are interactive by default so users can click play/pause and use native controls inside Media Node panels.
      - `image` and `svg` kinds are non‑interactive by default so clicks continue to select nodes on the canvas.
  - `createNodesLayer` (`GraphCanvas/layers/nodes.ts`) renders media in 2D as Media Node panels when `renderMediaAsNodes` is enabled:
    - Each media-capable node gets a dedicated panel with a rounded rectangle frame.
    - Each panel includes a header strip that displays the node label and type
      inline as `Label (Type)` so the panel is self-describing without relying
      on the default node label glyphs.
    - The media region renders:
      - Image/SVG media via `<image>` elements inside the panel bounds.
      - Video/IFrame media via `<foreignObject>` containers that host `<video>` or `<iframe>` elements. Pointer events are passed through to the embedded content when `interactive` is `true`, while canvas selection and drag handlers continue to ignore those events.
    - An SVG `<title>` element exposes the full node label and type as browser‑native hover text to match default circle node hover behavior.
    - In panel‑only mode, base circle/rect glyphs and separate text labels are suppressed for media‑capable nodes.
- User control:
  - Global toggle (view‑only):
    - `renderMediaAsNodes` (graph store UI slice) controls only whether Media Node panels are drawn for media‑capable nodes.
    - Toggling does not mutate `graphData`, re‑ingest sources, or re‑run parsers.
    - Exposed in:
      - Toolbar main bar (“Render Media as Nodes” button).
      - Toolbar Settings area.
      - Floating Properties Panel (Media section).
  - Per‑node media editing:
    - Floating panel model (`useFloatingPropsPanelModel`) allows editing:
      - `media_kind`
      - `media_url`
      - `media_interactive`
    - Updates propagate to the graph store and are immediately reflected on the canvas without re‑parsing the source file.

## End‑to‑End Source File Ingestion Summary

- All supported formats (Markdown, HTML, PDF, JSON‑LD, JSON) enter through a single **Source Files** entry point in the toolbar.
- URL and local file imports share consistent fetch, validation, and conversion behavior, with proxy support for remote content.
- Markdown is the common intermediate representation for text‑based sources (Markdown, HTML, PDF), ensuring consistent parsing and media extraction.
- JSON‑LD and JSON paths preserve existing graph structures and media properties without additional assumptions.
  - Media ingestion is format‑agnostic:
    - URLs are normalized into a shared node property schema.
    - The renderer uses these properties to optionally show media as panel‑like overlays in the canvas, controlled by the view‑only **Render Media as Nodes** toggle.
