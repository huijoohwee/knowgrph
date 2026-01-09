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
  - `Source Files` → `Import` / `Import (Local)` / `Import (URL)` with `format: "jsonld"` or `format: "json"`.
  - `Source Files` → `Import` / `Import (Local)` with `format: "csv"`.
  - Implementation: `canvas/src/features/toolbar/jsonImportAction.ts` plus the parser registry in `default.ts`.
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
  - If the JSON has `nodes` and `edges` arrays, they are used as‑is.
  - Otherwise, `rawToGraphData` wraps the data into a `GraphData` object:
    - Top‑level objects that expose arrays named `nodes`, `edges`, `links`, or suffix‑matched keys such as `extended_nodes` and `extended_nodes_v2` are treated as generic graph containers.
    - Node entries keep `id`, `name`, `label`, and `type` while merging all other fields into `GraphNode.properties` so workflow‑style shapes remain dataset‑agnostic.
    - Edge entries accept `source`/`target` or `from`/`to` and preserve additional attributes in `GraphEdge.properties` with a neutral default label when no type is provided.
    - Any media‑related fields present (`media_url`, `media_kind`, etc.) remain available to the renderer.
- CSV:
  - Ingestion uses the CSV parser spec in `default.ts` (`csvSpec`).
  - Tabular rows are mapped into nodes and edges based on column semantics.
  - The imported CSV is also wrapped in a fenced Markdown block and stored as the active Markdown document so it appears in the Markdown preview bottom panel.

### Auxiliary JSON / JSON‑LD → Markdown Utility

- Backend utility:
  - The Python helper `json_to_markdown_cmd` in `knowgrph_parser` converts JSON and JSON‑LD payloads into Markdown for inspection and documentation.
  - This utility does not participate in canvas ingestion; it operates on files before or alongside ingestion to produce human‑readable views.
- Modes:
  - Defaults to a mode based on structure:
    - Arrays of uniform scalar objects → Markdown tables.
    - Flat objects → key‑value bullet lists.
    - Nested or mixed structures → hierarchical lists with indentation.
  - Supports explicit mode selection and basic layout configuration (maximum table rows/columns, indentation, and bullet markers).
- Typical usage:
  - Inspecting JSON/JSON‑LD fixtures during parser development.
  - Producing Markdown snippets for architecture documents in `docs/documents/` from existing JSON graph exports without adding dataset‑specific formatting logic.
  - Kept deliberately separate from the canvas pipeline so it remains a pure command‑line helper; the canvas uses a client‑side `jsonToMarkdown` helper with the same structural behavior but wires it into JSON import and the Markdown bottom panel instead of relying on pre‑generated Markdown files.

### Canvas JSON / JSON‑LD → Markdown Mode Selector

- Location:
  - The Markdown bottom panel header shows:
    - A **JSON-backed preview** badge whenever the active Markdown is derived from a JSON/JSON‑LD import. Hovering the badge reveals a tooltip: the panel is a preview of the last JSON/JSON‑LD import, graph structure should be edited via the JSON Editor or UI Editor, and Apply from Markdown is disabled for this mode. The Markdown **Apply** button is hard-disabled (greyed out with a tooltip) whenever the view is JSON-backed so users cannot accidentally mutate `graphData` from this preview.
    - A **JSON → Markdown mode** selector next to the Markdown status badge.
- Modes:
  - `Auto`: lets the converter choose a mode from structure (table, key‑value, or hierarchical).
  - `Table`: prefers Markdown tables when the JSON is an array of uniform objects without nested structures.
  - `Key‑value`: emits bullet lists of key‑value pairs for flat objects, with nested structures delegated to a hierarchical view.
  - `Hierarchical`: always renders nested bullet lists with indentation, regardless of the input shape.
- Behavior on JSON import:
  - When JSON or JSON‑LD is imported through the toolbar and parses successfully:
    - The raw JSON text is stored as the current JSON source document in the graph store under the derived base name (for example, `graph.json` or `graph.jsonld`).
    - The client‑side `jsonToMarkdown` helper renders Markdown from that JSON using the last chosen mode (persisted in `LS_KEYS.jsonMarkdownMode`) so the Markdown Section shows a human‑readable view instead of raw JSON.
    - The imported graph is stored as `graphData` and drives the Canvas, Graph Data Table, and JSON Editor views; changing the JSON → Markdown mode never mutates `graphData` or re‑runs the parser.
- Behavior on mode changes:
  - Changing the selector re‑runs JSON → Markdown conversion against the stored JSON source while the graph and Graph Data Table remain unchanged, so users can flip between table/key‑value/hierarchical views without re‑ingesting.
  - The selector also shows a **Suggested:** hint derived from the combination of the current Markdown content and the JSON structure so users can see which mode best matches the existing view while retaining full control over future conversions.

### JSON Import → Graph Data Table → JSON Editor → Markdown Workflow

1. JSON import:
   - Use **Source Files → Import** (URL or Local) with `format: "json"` or `format: "jsonld"` to load a JSON or JSON‑LD file into the canvas.
   - The parser normalizes the payload into `GraphData` and, when parsing succeeds, stores the raw text as the current JSON source document for the Markdown Section (or clears it when the payload is not valid JSON).
   - The initial Markdown in the bottom panel is derived from the stored JSON using the last chosen JSON → Markdown mode; when parsing fails, the raw JSON is shown inside a fenced code block instead of a rendered table or hierarchy.
2. Graph Data Table:
   - Open the **Curation** tab and switch to the Graph Data Table view to inspect nodes and edges derived from the imported JSON.
   - Changing the JSON → Markdown mode does not mutate `GraphData` or re‑run the parser, so table contents remain stable while the Markdown view changes.
3. JSON Editor:
   - In the Curation toolbar, click **JSON Editor** to view and edit the JSON representation that backs the current `GraphData` state.
   - Edits that apply back to `GraphData` update the graph store and keep the Graph Data Table and canvas views aligned with the same underlying dataset.
   - The JSON Editor apply path also updates the stored JSON source document when the active Markdown document represents a JSON or JSON‑LD file, keeping the JSON source, Markdown view, and graph in sync.
4. Markdown view with live modes:
   - Switch to the **Markdown Section** and use the JSON → Markdown mode selector to flip between Auto/Table/Key‑value/Hierarchical views.
   - The Markdown bottom panel re‑renders from the stored JSON source whenever the mode changes or the JSON source is updated (for example, after applying changes in the JSON Editor), while leaving `GraphData` unchanged so users can iterate on Markdown presentations independently of ingestion.
   - When the active Markdown document is associated with a `documentPath` in the graph (for example, repo documentation opened from Workspace Actions), clicking **Apply** re‑parses only that document and merges the result back into the existing `graphData`: nodes and edges whose metadata `documentPath` matches the active document are replaced, all other nodes, edges, and graph‑level metadata are preserved so Canvas structure for unrelated content is not disturbed.

#### Example: Workspace Actions → Markdown → Apply

1. In Canvas, open the **Workflow** tab and the **Workspace Actions** floating panel, then run the codebase indexing pipeline so markdown files under `docs/documents/` are ingested into `graphData` with `metadata.documentPath` pointing at their repo paths.
2. On the Canvas, click a node that came from one of those markdown files (for example, `docs/documents/knowgrph-ingestor-document.md`); the Bottom Panel opens the **Curation → Markdown Section** view for the selected document.
3. In the Markdown editor, update the text for that document and click **Apply**:
   - The markdown parser runs only on the active document.
   - The resulting nodes and edges are tagged with the same `documentPath` as the original document.
   - The graph store replaces nodes and edges whose `metadata.documentPath` matches that path and leaves all other nodes, edges, and graph‑level metadata unchanged.
   - The Canvas and Graph Data Table update to reflect the new structure for that document while the rest of the workspace graph remains intact.

- Gotchas:
  - When there is no `documentPath` for the active Markdown (for example, ad‑hoc Markdown that is not associated with a repo file), **Apply** falls back to treating the Markdown as a standalone dataset: the parser replaces the entire `graphData` with the parsed result instead of doing a per‑document merge, so use Workspace Actions and repo‑backed docs when you need scoped updates.

### Store Keys for JSON ↔ Markdown Sync

- `graphData`:
  - Canonical graph payload produced by the parser or JSON Editor.
  - Drives the Canvas, Graph Data Table, and JSON Editor views.
- `markdownDocumentName`:
  - Logical name of the active Markdown document (for example, `graph.json`, `graph.jsonld`, `document.md`).
  - Used by the Markdown Section to decide when JSON → Markdown conversion should run (only when the name ends in `.json` or `.jsonld`).
- `markdownDocumentText`:
  - Current Markdown content shown in the bottom panel editor/viewer.
  - Initialized from imports (Markdown/HTML/PDF/CSV/JSON/JSON‑LD) and overwritten when JSON → Markdown conversion runs.
- `jsonSourceDocumentText`:
  - Raw JSON text associated with the current JSON/JSON‑LD document.
  - Set on JSON/JSON‑LD import and updated when JSON Editor apply commits graph changes.
  - When non‑empty, the Markdown Section re‑renders `markdownDocumentText` from this JSON using the active JSON → Markdown mode; when empty or when the active document is not a JSON/JSON‑LD file, the Markdown Section leaves the existing Markdown unchanged.

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
