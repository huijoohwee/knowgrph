# Knowgrph Graph Data Curation (curagrph Extraction)

## Overview

Knowgrph hosts the end-to-end import → parse → store → render pipeline, while the Graph Data curation and document presentation surfaces are owned by the sibling repo `curagrph`.

**Goal**: enforce single-source-of-truth ownership for Graph Data UI (tables + editors + presentation) without changing the visible frontend/UI behavior.

Canonical ownership and contract details live in:

- `curagrph/docs/documents/curagrph-graph-data-curation-document.md`

---

## Ownership Boundary

### Knowgrph (host)

- Owns pipeline orchestration: ingest/import → parser selection → GraphData commit → canvas render.
- Owns global state wiring (Zustand store and app routing) and calls Graph Data surfaces as UI modules.

### curagrph (Graph Data surfaces)

- Owns Graph Data curation/presentation UI and supporting modules:
  - BottomPanel curator + markdown section + JSON-backed markdown helpers
  - Graph Data Table (filter/sort/group + cell editors)
  - Markdown viewer/editor/presentation/gallery
  - Preview panel UI primitives used by markdown/presentation (e.g. gallery + overlays)
  - JSON Editor used by curation/workflow inspectors

This boundary mirrors the earlier pattern used for Geospatial Mode extraction (implementation lives in a sibling repo; Knowgrph remains host-only).

---

## Module Map

**curagrph**
- `curagrph/src/components/BottomPanel/*`: BottomPanel submodules that implement curation and document views.
- `curagrph/src/features/graph-data-table/*`: Graph Data Table model and UI.
- `curagrph/src/features/markdown/*`: Markdown lexing/rendering/presentation surfaces.
- `curagrph/src/features/json/JsonEditor.tsx`: Monaco-backed JSON/YAML editor.
- `curagrph/src/features/panels/views/preview-panel/ui/*`: gallery + preview overlay primitives used by markdown/presentation.

**knowgrph**
- `knowgrph/canvas/src/*`: continues to host the app entrypoints, renderers, store orchestration, and pipeline logic.

---

## Build & Runtime Integration

Knowgrph integrates the extracted Graph Data code via:

- Local dependency wiring for `curagrph` (sibling repo).
- Runtime module resolution targets the installed package copy at `knowgrph/canvas/node_modules/curagrph/src` (not direct sibling `../../curagrph/src` imports) to avoid cross-repo path coupling.
- Host resolution preserves symlink paths in both Vite and TypeScript so extracted modules resolve dependencies from the host install (single node_modules truth).
- Host bundler config dedupes shared deps (notably `react` and `highlight.js`) and pre-optimizes `highlight.js` so extracted markdown rendering does not hit ESM/CJS default-export hazards at runtime.
- Tailwind content scanning includes `node_modules/curagrph/src` so UI classes remain stable.

---

## Verification (bounded)

Graph Data extraction is verified using bounded execution:

- TypeScript no-emit checks (host + extracted module).
- Filtered CI runner cases only for impacted surfaces (BottomPanel/Markdown/JSON editor/Preview gallery), avoiding full-suite runs.
