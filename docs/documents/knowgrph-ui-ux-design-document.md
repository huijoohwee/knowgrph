# Media node panels
- Panel-only mode hides base circle/rect glyphs for media-capable nodes and
  renders standalone media panels.
- Each Media Node panel has a header strip that shows the node label and type
  inline in the form `Label (Type)`.
- Compact vs Standard density:
  - Compact panels use the minimap size as their base:
    - Height equals `MINIMAP_HEIGHT` (fixed).
    - Width is derived from height using a 16:9 aspect ratio:
      - `MINIMAP_WIDTH = round(MINIMAP_HEIGHT * 16 / 9)`.
  - Standard panels are tuned against maximum zoom:
    - Panel geometry is chosen so that at `ZOOM_MAX` (canvas max zoom-in)
      the visible Standard panel is ~`1.5 × MINIMAP_WIDTH` wide and
      ~`1.5 × MINIMAP_HEIGHT` tall on screen.
- The minimap dimensions and zoom bounds are defined once via:
  - `MINIMAP_WIDTH`, `MINIMAP_HEIGHT`, and `ZOOM_MAX` in
    `canvas/src/features/minimap/math.ts`.
- On the 2D canvas:
  - Panel geometry is expressed in graph units and scaled by the current
    zoom transform.
  - At maximum zoom, Standard panels visually match the “2× minimap”
    sizing; at lower zoom levels they scale down proportionally.
- Media URL behavior:
  - Node media URLs are normalized by `getNodeMediaSpec` in
    `canvas/src/components/GraphCanvas/helpers.ts`.
  - Image and video URLs are passed through `applyMediaProxySrc` so that
    cross-origin HTTP(S) media is fetched via `/__fetch_remote`.

# Media panel visual QA checklist
- Zoom behavior:
  - On initial load, confirm the canvas opens with Fit to Screen enabled:
    - The graph is centered in the viewport.
    - All visible nodes fit within the canvas with a small margin.
  - With Fit to Screen enabled, adding the first node to an empty canvas
    should produce a centered node: the new node should appear in the middle
    of the viewport (even if its simulation coordinates are offset) and
    subsequent nodes should remain inside the full-graph frame.
  - Toggle the toolbar “Fit to Screen” button off and on:
    - Off: viewport stays where it is while zoom/pan controls work normally.
    - On: viewport recenters on the full graph in 2D and 3D modes.
  - Use canvas zoom controls to zoom all the way to `ZOOM_MAX`.
  - At maximum zoom, confirm Standard panels are visually ~1.5× the minimap
    width and height.
- Compact vs Standard sizing:
  - With Panel-only enabled and density set to Compact:
    - A panel’s visible width should visually match the minimap width.
    - Height should visually match the minimap height.
  - Switch density to Standard:
    - At maximum zoom, panel width should appear about 1.5× the Compact
      width and match the “1.5× minimap” target.
    - Panel height should appear about 1.5× the Compact height and match
      the “1.5× minimap” target.
- Content padding:
  - Image/video content should not touch the panel border.
  - There should be a small uniform margin between the media frame and
    the outer panel edges.

# Canvas ↔ Markdown panel UX
- Bottom Panel auto-open:
  - When users select a media card sourced from the graph in the Preview gallery, the Bottom Panel automatically opens the Curation tab in Markdown mode, keeping the media selection, canvas selection, and source text aligned without additional clicks.
- Markdown panel highlight:
  - Auto-opening the markdown curation view applies a brief, subtle highlight to the panel chrome so users can see where the source text came from without introducing long-lived visual noise.
- Markdown header layout:
  - The Bottom Panel markdown view splits responsibilities between a stateful container and a pure view component that renders three small header rows: the status row (JSON-backed badge and markdown status), the editor row (Apply, word-wrap toggle, and layout mode controls), and the viewer row (layout mode controls, presentation navigation, text highlight, and fullscreen).
  - Editor and viewer layout mode controls are shared via a `MarkdownLayoutControlsRow` helper that receives a text size class from the panel theme, so the icon buttons inherit the same typographic scale as surrounding header copy while keeping icon size and stroke width configurable per theme.
- Selection alignment:
  - Canvas node/edge selections with markdown provenance scroll the Bottom Panel markdown editor and viewer so the associated text range snaps to the top of the viewport, avoiding “lost in the middle” placements.
  - The markdown editor uses the textarea’s wrap model to align the first wrapped row of the selected range directly under the top border, and the viewer uses block-level `data-start-line` markers to anchor the corresponding rendered block to the top of its scroll container.
  - When the Markdown “Text Highlight” toggle is on, the highlighted range uses the same semantic colors as the active selection on the canvas:
    - Node-backed ranges inherit the node’s fill color and appear as a tinted background band in the viewer and editor gutter.
    - Edge-backed ranges are rendered with an underline treatment that mirrors the edge color in the canvas.
    - Graph layer highlights reuse the layer’s background color so document-structure vs semantic vs property layers stay visually aligned.
  - When the toggle is off, markdown remains unadorned while scrolling and auto-alignment still work.
- Markdown Preview context action:
  - Right-clicking a non-empty selection in the Markdown Preview exposes a “Show on Canvas” action when the selection maps to a known node or edge.
  - Triggering this action updates the graph selection using the same selection pathways as other tools, so viewport zoom, highlight, and related panels behave consistently.
  - For Mermaid frontmatter, Canvas selection and layout behavior follow the same neutrality guarantees as other graph content: `MermaidNode` and `pointsTo` edges are styled and filtered via schema‑driven layer configuration, and layout modes (force, radial, tidy‑tree) all operate on the same schema‑aligned subgraph without special cases for any particular template or dataset; see `docs/documents/knowgrph-mermaid-frontmatter-document.md` for details on Mermaid‑specific legend chips and path highlighting.

# Reordering interactions
- Shared list reordering:
  - All list-style reordering (slides in the fullscreen gallery, graph field select options, and traversal path editors) uses a shared immutable helper: `reorderList` in `canvas/src/lib/reorder.ts`.
  - `reorderList` moves one item from `fromIndex` to `toIndex` in a shallow copy of the input array, preserving value identity while avoiding in-place mutation.
- Slide gallery sidebar:
  - The fullscreen Markdown slide gallery sidebar is implemented as a reusable `SlidesSidebar` component in `canvas/src/features/markdown/ui/SlidesSidebar.tsx`. `SlidesSidebar` owns the header copy, thumbnail/list toggle, selection state, and wiring to the shared `PreviewGallery` list while remaining presentation-agnostic: callers provide slide IDs, preview renderers, and ordering callbacks so future “slides-only” views (such as a dedicated slide manager) can reuse the same sidebar without changing the core presentation container.
  - The sidebar uses `reorderList` to update slide order when users drag thumbnails; the visual insertion bands (with up/down arrows) are purely presentational and map directly onto the same `reorderList` call for consistent “before/after” semantics. Slide drag results are fed into a markdown-aware helper (`reorderSlidesInMarkdown` in `canvas/src/features/markdown/ui/markdownPreviewSlides.ts`) that rewrites the underlying markdown source so the Bottom Panel editor, viewer, and on-disk document stay in sync while preserving frontmatter blocks, per-slide notes, and fenced code blocks that contain `---` as literal content.
- Slide gallery metrics:
  - Slide reordering in the fullscreen Markdown gallery emits a `markdownSlidesReordered` UI metric that records slide count and before/after index order for instrumentation and UX analysis.
- Graph field select options:
  - Graph field select options use the same helper when users drag the handle icon to reorder options, ensuring that option order changes follow identical index semantics to the slide gallery and traversal editors.
- Future reordering affordances:
  - New drag-to-reorder controls should call `reorderList` (or thin wrappers over it) instead of implementing bespoke splice logic, so UX expectations and edge-case handling remain consistent across panels.

# Primary blue and semantic palette helpers
- `UI_COLOR_PRIMARY_BLUE`, `UI_COLOR_PRIMARY_BLUE_BORDER`, `UI_COLOR_PRIMARY_BLUE_BG`:
  - Core role-based tokens for primary blue text, border, and background classes.
  - `UI_COLOR_PRIMARY_BLUE` encodes text color (`text-blue-600`).
  - `UI_COLOR_PRIMARY_BLUE_BORDER` encodes primary blue borders (`border-blue-500`).
  - `UI_COLOR_PRIMARY_BLUE_BG` encodes primary blue backgrounds (`bg-blue-50`).
- `UI_COLOR_WARNING_AMBER_BORDER`, `UI_COLOR_WARNING_AMBER_BG`:
  - Core tokens for warning/secondary amber surfaces.
  - `UI_COLOR_WARNING_AMBER_BORDER` encodes amber borders (`border-amber-400`).
  - `UI_COLOR_WARNING_AMBER_BG` encodes amber backgrounds (`bg-amber-50`).
- `UI_COLOR_DANGER_RED_BORDER`, `UI_COLOR_DANGER_RED_BG`, `UI_COLOR_DANGER_RED_TEXT`:
  - Core tokens for danger/red surfaces.
  - `UI_COLOR_DANGER_RED_BORDER` encodes red borders (`border-red-300`).
  - `UI_COLOR_DANGER_RED_BG` encodes red backgrounds (`bg-red-50`).
  - `UI_COLOR_DANGER_RED_TEXT` encodes red text (`text-red-700`).
- `uiToolbarToggleActiveClassName` and `uiDataTableToggleActiveClassName`:
  - Used for “primary active” toggle buttons that own a surface (e.g., toolbar settings toggles or graph data table toggles where the active state should be visually dominant).
  - Compose the full blue toggle surface from the tokens: `UI_COLOR_PRIMARY_BLUE_BORDER UI_COLOR_PRIMARY_BLUE_BG text-blue-700`.
- `uiSecondaryToggleActiveClassName`:
  - Used for the secondary (amber) variant of primary toggles.
  - Composes warning surfaces from the amber tokens: `UI_COLOR_WARNING_AMBER_BORDER UI_COLOR_WARNING_AMBER_BG text-amber-800`.
- `uiPrimaryPillActiveClassName`:
  - Used for pill-style chips and compact actions that sit inline with text but still represent a primary “on” state (e.g., icon tabs, Launch shortcuts).
  - Encodes a blue pill using `UI_COLOR_PRIMARY_BLUE_BG` for the background and `text-blue-700` for text.
- `uiPrimaryChipActiveClassName`:
  - Used for count chips and status badges that need a compact, bordered blue pill surface (e.g., traversal edge count badges).
  - Encodes pill + border using `UI_COLOR_PRIMARY_BLUE_BG` for the background, `text-blue-700` for text, and a light blue border.
- `uiPrimaryIconActiveClassName` and `uiPrimaryIconInactiveClassName`:
  - Used for icon‑only toggles and checkboxes (no surface change, just icon color).
  - Active icons use `uiPrimaryIconActiveClassName` (`text-blue-600`); inactive icons use `uiPrimaryIconInactiveClassName` (`text-gray-600`).
- Usage guidelines:
  - Prefer `uiPrimaryToggleActiveClassName` for buttons that change their background when active.
  - Prefer `uiPrimaryPillActiveClassName` or `uiPrimaryChipActiveClassName` for inline pills and count chips.
  - Prefer `uiPrimaryIconActiveClassName` / `uiPrimaryIconInactiveClassName` for icon-only toggles and controls that do not own a background surface.
  - Prefer amber and danger tokens for semantic variants:
    - Use `uiSecondaryToggleActiveClassName` (warning amber) for secondary toggles that still own a surface.
    - Use `UI_COLOR_DANGER_RED_BORDER` / `UI_COLOR_DANGER_RED_BG` / `UI_COLOR_DANGER_RED_TEXT` for destructive actions such as “Global Reset” in Main Panel Settings.
