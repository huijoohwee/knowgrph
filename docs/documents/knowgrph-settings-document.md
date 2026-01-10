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

## Settings schema extraction (`build:settings`)

- The canvas dev and build scripts call `build:settings` to generate `settings-flow.json` and `settings-flow.schema.json` from the repository’s settings flow markdown table.
- The extraction script reads `knowgrph-codebase-responsibility-flow.md` at the repo root when present; when the source document is missing it falls back to a small default schema and prints a “source doc missing, defaults only” message to stdout.
- On a typical macOS dev machine the entire `build:settings` step completes in roughly 0.4–0.7 seconds, with most of the time spent starting Node and the TSX runtime rather than parsing or writing the settings schema.
