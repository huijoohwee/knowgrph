## themeMode

- Area: UI Appearance
- Responsibility: Global color theme (Light, Dark, or System)
- Notes:
  - Controls the application color palette.
  - Light mode follows GitHub Light Tritanopia (`bg-white` panels, `text-gray-900` primary text).
  - Dark mode follows GitHub Dark Tritanopia (`bg-[#0d1117]` panels, `text-gray-100` primary text).
  - System mode automatically syncs with the OS preference.
  - Configurable via the "Theme Mode" preset buttons in the Settings panel.

## selectionFlashDurationMs

- Area: Selection Flash
- Responsibility: Duration of canvas-driven selection flash highlights in milliseconds.
- Notes:
  - Applies to selection flashes driven from the graph canvas into:
    - Markdown gutter highlights in the Bottom Panel.
    - Markdown Preview selection flashes.
    - Graph Data Table row flashes.
  - Clamped between 100ms and 2000ms to avoid excessively long or imperceptibly short flashes.
  - Lower values reduce visual dwell and make flashes feel subtle and responsive.

## selectionFlashOpacity

- Area: Selection Flash
- Responsibility: Opacity of canvas-driven selection flash overlays.
- Notes:
  - Controls alpha for overlay-based flashes instead of native selection colors.
  - Accepts values between 0.0 and 1.0; default is a subtle 0.18.
  - Affects Markdown editor gutter flashes, Markdown Preview block flashes, and Graph Data Table row flashes.

## graphHoverPreview

- Area: Graph Interaction
- Responsibility: Configures the visibility of information in the graph hover tooltip.
- Keys:
  - `graphHoverPreview.showNodeId`: Show Node ID (default: false).
  - `graphHoverPreview.showNodeName`: Show Node Name/Label (default: true).
  - `graphHoverPreview.showNodeLabel`: Show Node Type/Category (default: true).
  - `graphHoverPreview.showNodeDescription`: Show Node Description (default: true).
  - `graphHoverPreview.showNodeProperties`: Show Node Properties (default: true).
  - `graphHoverPreview.showEdgeId`: Show Edge ID (default: false).
  - `graphHoverPreview.showEdgeLabel`: Show Edge Label (default: true).
  - `graphHoverPreview.showEdgeWeight`: Show Edge Weight (default: true).
  - `graphHoverPreview.showEdgeProperties`: Show Edge Properties (default: true).
- Notes:
  - These settings provide fine-grained control over what information is displayed when hovering over nodes and edges in the graph.
  - Useful for reducing clutter or focusing on specific attributes during presentation or analysis.

## Settings schema extraction (`build:settings`)

- The canvas dev and build scripts call `build:settings` to generate `settings-flow.json` and `settings-flow.schema.json` from the repository’s settings flow markdown table.
- The extraction script reads `knowgrph-codebase-responsibility-flow.md` at the repo root when present; when the source document is missing it falls back to a small default schema and prints a “source doc missing, defaults only” message to stdout.
- On a typical macOS dev machine the entire `build:settings` step completes in roughly 0.4–0.7 seconds, with most of the time spent starting Node and the TSX runtime rather than parsing or writing the settings schema.
