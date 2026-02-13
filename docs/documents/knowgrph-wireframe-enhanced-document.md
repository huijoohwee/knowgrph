# Wireframe-Enhanced (Wireframe+) Artifact

## Goal

Generate a deterministic, editable Markdown artifact that represents a webpage as a structured ASCII wireframe, without site-specific branching.

## Inputs

- Converted webpage markdown (from URL import / website import).
- Optional appended extracted blocks (preferred when present):
  - `## Extracted Navigation Menus`
  - `## Pricing Comparison (Extracted)`
  - `## Company License Options (Extracted)`
  - `## Pricing Details (Extracted)`
  - `## Rendering Options (Extracted)`

## Output

- A Markdown document containing:
  - a summary overview
  - page statistics tables
  - sectioned wireframe blocks using box-drawing frames (`┌─/│/└─`)
  - detailed breakdown sections (header navigation, hero breakdown, template showcase grid, per-feature section stats, pricing comparison, etc.) when signal sets indicate them

## Frontmatter Contract

- `kgWebpageUrl`: source URL
- `kgWebpageView`: `markdown | json | html | wireframe | wireframe-enhanced`

Wireframe-enhanced content is stored in the markdown file itself (editable), and Viewer/Presentation/Slides render the same markdown (view-only switching).

## Signal Sources (Domain-Neutral)

- Headings (H1/H2) and section bodies
- Link classification tokens: `[NAV]`, `[CTA]`, `[LINK]`
- Media tokens: `[MEDIA]`, `[IMG]`
- Pricing/timecode tokens: `[PRICE]`, `[TIME]`
- Optional extracted blocks appended by the converter

## Layout Structure Merge Policy

The `## 📐 Layout Structure` section contains a single ` ```ascii` block.

- Keep only box-drawing frames (`┌─/│/└─`).
- Merge top-level `[NAV]/[CTA]/[LINK]/[IMG]` items from the extracted Document Structure tail into the **GLOBAL NAVIGATION** box content.
- Forbid emitting `+---` style tree frames in the output.

## Fixture-Driven Parity (Without Hardcoded Domains)

Fixture-like blocks (template showcase grid, pricing tables, etc.) are emitted only when corresponding generic signals and/or extracted blocks are present.

- Never branch on the host name or on `kgWebpageUrl`.
- Regression fixture input lives under `canvas/src/__tests__/fixtures/` and is used only by tests.
