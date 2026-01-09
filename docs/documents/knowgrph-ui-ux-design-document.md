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
- Selection alignment:
  - Canvas node/edge selections with markdown provenance scroll the Bottom Panel markdown editor and viewer so the associated text range snaps to the top of the viewport, avoiding “lost in the middle” placements.
  - The highlighted range is visually distinct but deliberately lightweight, preserving the primary reading experience while still making the canvas↔markdown relationship obvious.
- Markdown Preview context action:
  - Right-clicking a non-empty selection in the Markdown Preview exposes a “Show on Canvas” action when the selection maps to a known node or edge.
  - Triggering this action updates the graph selection using the same selection pathways as other tools, so viewport zoom, highlight, and related panels behave consistently.
