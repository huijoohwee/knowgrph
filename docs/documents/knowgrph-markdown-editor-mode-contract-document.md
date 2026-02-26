# Markdown Editor Mode Contract (Webpage ↔ Markdown)

## Goal

- `HTML` / `DOM` / `Raw` views maximize inspection and render fidelity inside a sandboxed iframe.
- `Markdown` view maximizes information capture by preserving complex structures either as:
  - Markdown,
  - allowlisted HTML blocks (safe render), or
  - escaped code blocks when a block cannot be safely rendered.

## View Modes

Controlled by `kgWebpageView` in frontmatter:

- `markdown`: show the markdown artifact doc (SSOT).
- `markdown`: show the Markdown SSOT doc (frontmatter + Markdown body).
- `html`: render HTML via sandboxed iframe.
- `dom`: render a post-hydration DOM snapshot (best for JS-heavy pages).
- `raw`: show raw HTML source for debugging.
- `json`: show conversion/metadata JSON.

## Per-Document Fidelity Controls

Optional frontmatter keys:

`kgWebpageScriptPolicy: allow | strip`  
`kgWebpageIncludeImages: true | false`  
`kgWebpageFidelityLevel: 1 | 2 | 3 | 4`

Semantics:

- `kgWebpageScriptPolicy`: controls iframe script policy (`allow` = best render fidelity; `strip` = safest/static).
- `kgWebpageIncludeImages`: controls whether HTML→Markdown conversion keeps `<img>/<picture>` blocks.
- `kgWebpageFidelityLevel`: controls how aggressively complex HTML is preserved as HTML blocks during conversion.

## UI Placement (SSOT)

The canonical UI for webpage-backed docs is the Markdown toolbar `nav` ("Webpage" group):

- Selectors: `View`, `Script`, `Imgs`, `Fid`
- Action: `Sync` (DOM→Markdown)

No other surface should duplicate these controls.

## Round-Trip Rules

- Switching view modes must be lossless for frontmatter keys.
- `Sync` explicitly regenerates Markdown from a DOM snapshot:
  - DOM capture → HTML→Markdown conversion (with `IncludeImages` + `FidelityLevel`) → Markdown SSOT update.
- The Markdown SSOT output must be Markdown-only (no duplicate “artifact doc” wrapper sections, no YAML/HTML snapshot blocks, no “HTML Head” blocks). Metadata remains available via the HTML/Raw/JSON views.
- HTML→Markdown conversion must be URL-agnostic but URL-correct: resolve `href/src/action/poster/srcset` and common lazy-load `data-*` media attributes against `baseUrl`; upsert missing `<img src>` from `data-src` or `srcset` so markdown images do not become empty.
- Markdown preview must preserve layout and media fidelity for allowlisted HTML blocks:
  - **Grid**: `grid-cols-*` and `col-span-*`/`row-span-*` class-derived layout must render as CSS grid, and item spans must apply even when the item itself is not `display:grid`.
  - **Media**: allowlisted `<video>/<audio>` should preserve safe attributes (`autoplay`, `muted`, `loop`, `playsinline`, `poster`) and prefer `<source>` candidates when direct `src` is absent.
- Markdown preview renders allowlisted HTML blocks safely (no `dangerouslySetInnerHTML`). Unsupported blocks must never be silently dropped.
