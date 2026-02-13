# Webpage Proxy + Sandboxed `srcdoc` Iframe Rendering

## Goal

Render imported webpages with high fidelity (rich media, animations) while preserving the app invariants:

- **Sandbox boundary**: untrusted HTML must never escape the iframe.
- **View-only switching**: `Markdown | JSON | HTML` must not mutate graph/layout/zoom.
- **Neutrality**: no site-specific hacks or hardcoded domains.

## Surfaces

- **Editor**: always shows Markdown (Markdown is the SSOT).
- **Viewer / Presentation / Slides Gallery**: render either Markdown (view = `markdown`) or a sandboxed iframe (view ∈ {json, html}).

## Frontmatter Contract (per imported page)

- `kgWebpageUrl`: source URL
- `kgWebpageView`: `markdown | json | html`
- `kgWebsiteImportId`: optional website-import job id
- `kgWebsiteNodeId`: optional stable node id
- `kgWebsiteOutputDirRel`: optional artifact root override

## Endpoints (dev server middleware)

### `POST /__webpage_convert?url=...`

- Returns conversion JSON including `markdown` (and optionally a pretty JSON payload for the editor).
- Used for **graph alignment** (Document Structure parsing derives nodes/edges from Markdown).

### `GET /__webpage_proxy?url=...`

- Fetches upstream HTML and **injects a same-origin compatibility layer**:
  - strips CSP / XFO meta tags and upstream `<base>`
  - rewrites asset URLs (including relative URLs) to `/__webpage_asset_proxy?url=...`
  - ensures `/__webpage_*` links resolve same-origin in iframe context
  - injects scroll-sync to align Editor ↔ iframe scroll ratio

### `GET /__webpage_asset_proxy?url=...`

- Proxies assets (CSS/JS/images/fonts/media) as same-origin responses to improve fidelity.
- Must be bounded (timeout/max-bytes) and not rely on streaming indefinite bodies.

### `POST /__website_import/import-url`

- Persists per-URL artifacts to `.knowgrph-workspace/...`:
  - `raw.html`
  - `page.md`
  - `conversion.json`
  - Webpage Markdown artifacts are generated client-side from Markdown signals and stored in the workspace markdown file.

### `GET /__website_import/artifact?importId=...&nodeId=...&kind=...`

- Returns stored artifact content.
- Used for fast view switching in the active-row dropdown.

## `srcdoc` Rendering Rules

HTML/JSON rendering is enforced via sandboxed `srcdoc` iframes (no `src` mode):

- The HTML payload is sourced from:
  - website-import `raw.html` artifact when available, else
  - `GET /__webpage_proxy?url=...`
- The `srcdoc` builder:
  - strips `Content-Security-Policy` `<meta http-equiv="...">` tags (to avoid self-blocking in `srcdoc`)
  - injects a scroll-sync script (iframe ↔ parent via `postMessage`)
  - **upserts** a `<base>` tag:
    - If the HTML appears to contain `/__webpage_proxy` or `/__webpage_asset_proxy` links, base is set to `${window.location.origin}/` so same-origin routes resolve correctly.
    - Otherwise base is set to the original URL for correct relative URL resolution.

## Iframe Sandbox Policy

All webpage HTML rendering in Viewer / Presentation / Slides uses a sandboxed iframe with:

- `sandbox="allow-scripts"`
- `referrerPolicy="no-referrer"`

The sandbox must forbid top-level navigation (do not include `allow-top-navigation`).

## View Mode Semantics

- `Markdown`: Editor shows Markdown; Viewer/Presentation/Slides render Markdown.
- `JSON`: Editor shows Markdown; Viewer/Presentation/Slides render sandboxed JSON code (iframe `srcdoc`).
- `HTML`: Editor shows Markdown; Viewer/Presentation/Slides render sandboxed HTML (iframe `srcdoc`).

## Shared Signal Tokens (Mode-Independent)

All view modes share the same generic signal/token vocabulary derived from Markdown (no site-specific branching):

- `[NAV]`, `[CTA]`, `[LINK]`: classified link intent
- `[PRICE]`: price/cost tokens
- `[TIME]`: timecode tokens

The Markdown artifact can render these tokens inline (for example `Nav: [NAV] Docs | [CTA] Get started`) and the Document Structure section includes the same token prefixes.

## Webpage Markdown Artifact Structure (No Hardcoded Domains)

The Markdown artifact uses *generic extracted signals* plus optional extracted detail blocks to produce a more fixture-like, sectioned document without branching on any specific website.

### Required Signals (Generic)

- Header navigation must be derived from `[NAV]`/`[LINK]` intent plus optional `## Extracted Navigation Menus` blocks.
- Hero block must be derived from the main H1 + nearby summary paragraph + a first inline command (e.g. `$ npx ...`) + nearby CTAs.
- Section details must be derived from counts over the section body (paragraphs, links, media, price tokens, timecodes).

### Optional Extracted Blocks (Preferred When Present)

If the upstream conversion appends structured blocks, the artifact should use them directly:

- `## Pricing Comparison (Extracted)` → detailed pricing comparison table.
- `## Company License Options (Extracted)` → company-license option bullets + callouts.
- `## Pricing Details (Extracted)` → price-point table.
- `## Rendering Options (Extracted)` → rendering options table.

### Fixture Parity Policy

- Use fixture-like ASCII layouts only when the corresponding signal set is detected (for example, template set contains `Blank/Hello World/Next.js/Prompt to Motion/React Router/Find a template`).
- Never check `kgWebpageUrl` or host strings to decide formatting.

### Regression Testing (Offline)

- Keep a local upstream-markdown fixture (not HTML, not live fetch) that includes extracted blocks.
- Assert on structural invariants (presence of sections/tables/frames) and avoid asserting on domain content beyond the fixture itself.

## Local Webpage Markdown Artifact Generation

Generate a webpage markdown artifact file from a URL (domain-neutral, no hardcoded sites or fixture paths):

```bash
npm --prefix knowgrph/canvas run webpage:markdown -- --url "https://example.com/" --out "./webpage.md"
```
