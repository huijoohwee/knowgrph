# Theme and Color Palette
- The application supports Light, Dark, and System theme modes, configurable in MainPanel Settings.
- Button and UI element colors follow the **GitHub Tritanopia** palette for optimal contrast and accessibility.
- **Light Mode**: Uses `text-gray-600` and `bg-gray-100` hover states, with `bg-white` panels.
- **Dark Mode**: Uses `text-gray-300` and `bg-gray-800` hover states, with `bg-[#0d1117]` panels.
- **Code Blocks**: Follows the PlayCanvas-style structure (`div` > `div` > `clipboard-copy`) with theme-aware syntax highlighting (Light: GitHub Light, Dark: GitHub Dark). Uses `UI_THEME_TOKENS.code` for consistent background and border styling (`slate` color family).
- **Consistency**: All icon buttons (`IconButton`), panels, tables, inputs, floating panel buttons, and code blocks use shared theme tokens defined in `UI_THEME_TOKENS` to ensure global consistency. Hardcoded styles (e.g., `text-gray-*`, `bg-blue-*`) are strictly forbidden in favor of semantic tokens.
- **Configuration**: Users can switch themes (Light/Dark/System) via the "UI Appearance" section in Settings.
- **Implementation**: Theme changes update the `data-theme` attribute on the root element and toggle the `dark` class, enabling Tailwind's `dark:` modifier.
- **Graph Data Table**: Table rows, headers, and sticky columns use `UI_THEME_TOKENS.table` for consistent light/dark backgrounds and borders. Zebra striping is disabled in favor of a clean, flat look (`rowBg`). Selected rows are highlighted with a subtle tint (`rowSelected`), replacing legacy blue borders. Redundant grey divs in Dark Mode are removed by enforcing `UI_THEME_TOKENS.panel.bg` on scroll containers.
- **Main Table Settings**: Key/Value rows in settings and property panels follow the same interaction model as the Graph Data Table, using `UI_THEME_TOKENS.table.rowHoverAmber` for hover states and `UI_THEME_TOKENS.table.rowSelected` for active/selected states.
- **Slides Gallery**: Follows the same selection and hover styles as the data table (`rowHoverAmber`, `rowSelected`), ensuring a unified visual experience across list-like views.
- **Canvas Visualization**: Graph nodes, edges, and labels use `UI_THEME_COLORS` (raw hex values) to match the theme palette in the D3/WebGL context.
- **Tooltips**: Tooltips use `UI_THEME_TOKENS.tooltip` for high-contrast overlays (dark background in both modes or theme-adaptive).
- **Status Badges**: Use `UI_THEME_TOKENS.status` (success, warning, error, neutral) for consistent feedback colors across the application.

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
  - When users select a media card sourced from the graph in the Slides Gallery, the Bottom Panel automatically opens the Curation tab in Markdown mode, keeping the media selection, canvas selection, and source text aligned without additional clicks.
- Markdown panel highlight:
  - Auto-opening the markdown curation view applies a brief, subtle highlight to the panel chrome so users can see where the source text came from without introducing long-lived visual noise.
- Markdown header layout:
  - The Bottom Panel markdown view splits responsibilities between a stateful container and a pure view component that renders three small header rows: the status row (JSON-backed badge and markdown status), the editor row (Apply, word-wrap toggle, and layout mode controls), and the viewer row (layout mode controls, presentation navigation, text highlight, and fullscreen).
  - Editor and viewer layout mode controls are shared via a `MarkdownLayoutControlsRow` helper that receives a text size class from the panel theme, so the icon buttons inherit the same typographic scale as surrounding header copy while keeping icon size and stroke width configurable per theme.
- Selection alignment:
  - Canvas node/edge selections with markdown provenance scroll the Bottom Panel markdown editor and viewer so the associated text range snaps to the top of the viewport, avoiding “lost in the middle” placements.
  - The markdown editor uses the textarea’s wrap model to align the first wrapped row of the selected range directly under the top border, and the viewer uses block-level `data-start-line` markers to anchor the corresponding rendered block to the top of its scroll container.
  - **Mermaid Frontmatter Sync**: When a Canvas node corresponds to a node defined in the Markdown frontmatter (Mermaid block), the editor auto-scrolls to the exact line of the node definition within the frontmatter code, rather than defaulting to the start of the frontmatter block.
  - When the Markdown “Text Highlight” toggle is on, the highlighted range uses the same semantic colors as the active selection on the canvas:
    - Node-backed ranges inherit the node’s fill color and appear as a tinted background band in the viewer and editor gutter.
    - Edge-backed ranges are rendered with an underline treatment that mirrors the edge color in the canvas.
    - Graph layer highlights reuse the layer’s background color so document-structure vs semantic vs property layers stay visually aligned.
  - When the toggle is off, markdown remains unadorned while scrolling and auto-alignment still work.
- Markdown Preview Interaction:
  - **Selection Toolbar**: Selecting text (or double-clicking a word) in the Markdown Viewer, Editor (Preview mode), or Presentation displays a floating toolbar with context-aware navigation options:
    - **Show on Canvas**: Highlights the corresponding node/edge on the graph.
    - **Show in Viewer**: Switches to Markdown Viewer mode.
    - **Show in Editor**: Switches to Markdown Editor mode.
    - **Show in Presentation**: Enters Presentation mode.
    - **Show in Slides Gallery**: Switches to Slides Gallery view (Presentation with thumbnails).
    - **Show in Graph Data Table**: Opens the Graph Data Table tab.
    - Irrelevant options (e.g., "Show in Viewer" when already in Viewer) are disabled.
  - **Right-Click Context Menu**: Unified with the Selection Toolbar. Right-clicking in the Viewer, Editor, Presentation, Slides Gallery, or Graph Data Table displays the context-aware Selection Toolbar, providing consistent access to all navigation actions (Show on Canvas, Show in Viewer, etc.).
  - **Double-Click Behavior**: Double-clicking a line in the Viewer or Editor jumps to the corresponding line in the other view. The mapping is precise, preserving line numbers even for nested content like lists.
  - For Mermaid frontmatter, Canvas selection and layout behavior follow the same neutrality guarantees as other graph content: `MermaidNode` and `pointsTo` edges are styled and filtered via schema‑driven layer configuration, and layout modes (force, radial, tidy‑tree) all operate on the same schema‑aligned subgraph without special cases for any particular template or dataset; see `docs/documents/knowgrph-mermaid-frontmatter-document.md` for details on Mermaid‑specific legend chips and path highlighting.
# Unified Markdown Layout (Editor & Viewer)
- Navigation and Layout:
  - Both Editor and Viewer modes share a unified `MarkdownPanelLayout` with a collapsible sidebar Table of Contents (TOC).
  - The layout uses semantic wrappers (`section`, `aside`, `header`, `main`, `article`, `figure`) for accessibility and code readability, replacing generic `div`s. `figure` is used for frontmatter Mermaid diagrams.
  - **Sidebar Position**: The sidebar is positioned on the **left** side of the panel (default layout).
  - **Token Sharing**: The markdown lexer runs once at the parent level, and tokens are shared between the Viewer, TOC, and Editor components to optimize performance and prevent redundant processing. Line maps are preserved during token processing to ensure accurate scroll synchronization.
- Interaction:
