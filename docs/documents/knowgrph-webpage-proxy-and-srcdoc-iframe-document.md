# Webpage Proxy + Sandboxed `srcdoc` Iframe Rendering

## Goal

Render imported webpages with high fidelity (rich media, animations) while preserving the app invariants:

- **Sandbox boundary**: untrusted HTML must never escape the iframe.
- **View-only switching**: `Markdown | JSON | HTML | Wireframe` must not mutate graph/layout/zoom.
- **Neutrality**: no site-specific hacks or hardcoded domains.

## Surfaces

- **Editor**: shows Markdown by default; JSON and Wireframe are read-only overrides.
- **Viewer / Presentation / Slides Gallery**: render either Markdown (view=markdown) or HTML (view ∈ {json, html, wireframe}).

## Frontmatter Contract (per imported page)

- `kgWebpageUrl`: source URL
- `kgWebpageView`: `markdown | json | html | wireframe`
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
  - `wireframe.md`

### `GET /__website_import/artifact?importId=...&nodeId=...&kind=...`

- Returns stored artifact content.
- Used for fast view switching in the active-row dropdown.

## `srcdoc` Rendering Rules

Default HTML rendering uses sandboxed `srcdoc` iframes:

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

- `sandbox="allow-scripts allow-forms allow-popups allow-downloads allow-modals allow-pointer-lock allow-presentation"`
- `referrerPolicy="no-referrer"`

The sandbox must forbid top-level navigation (do not include `allow-top-navigation`).

## View Mode Semantics

- `Markdown`: Editor shows Markdown; Viewer/Presentation/Slides render Markdown.
- `JSON`: Editor shows conversion JSON (read-only); Viewer/Presentation/Slides render sandboxed HTML.
- `HTML`: Editor shows Markdown; Viewer/Presentation/Slides render sandboxed HTML.
- `Wireframe`: Editor shows ASCII wireframe (read-only); Viewer/Presentation/Slides render sandboxed HTML.
