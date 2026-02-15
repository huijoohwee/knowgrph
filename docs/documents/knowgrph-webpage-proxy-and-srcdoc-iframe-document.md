# Webpage Proxy + Sandboxed `srcdoc` Iframe Rendering

## Goal

Render imported webpages with high fidelity (rich media, animations) while preserving the app invariants:

- **Sandbox boundary**: untrusted HTML must never escape the iframe.
- **View-only switching**: `Markdown | JSON | HTML` must not mutate graph/layout/zoom.
- **Neutrality**: no site-specific hacks or hardcoded domains.

## Surfaces

- **Editor**: shows an editable Markdown SSOT; JSON may be shown as a read-only text override.
- **Viewer / Presentation / Slides Gallery**: render either Markdown (view = `markdown`) or a sandboxed iframe (view ∈ {json, html}).

## Editor Loading Invariants

- **Async Monaco init must not blank the buffer**: Monaco loads lazily; the initial model value must always be the latest `value` prop at the moment the editor is created (not a stale first-render snapshot). This prevents an “empty editor” when a large imported file hydrates after Monaco init starts, or when `kgWebpageView` toggles change the editor URI.
- **Webpage view switching must not write from stale editor state**: `kgWebpageView` switches must hydrate from disk (or last-loaded text) before writing, and must clear any HTML/JSON overrides immediately when switching back to Markdown.

## Frontmatter Contract (per imported page)

- `kgWebpageUrl`: source URL
- `kgWebpageView`: `markdown | json | html`
- `kgWebsiteImportId`: optional website-import job id
- `kgWebsiteNodeId`: optional stable node id
- `kgWebsiteOutputDirRel`: optional artifact root override

## Endpoints (dev server middleware)

### `GET /__webpage_proxy?url=...`

- Fetches upstream HTML and **injects a same-origin compatibility layer**:
  - strips CSP / XFO meta tags and upstream `<base>`
  - rewrites asset URLs (including relative URLs) to `/__webpage_asset_proxy?url=...`
  - ensures `/__webpage_*` links resolve same-origin in iframe context
  - injects scroll-sync to align Editor ↔ iframe scroll ratio

Additionally, the injected layer exposes a **DOM export bridge** (see `kg-export-dom`) that lets the host request a best-effort rendered `text` or `html` snapshot from inside the sandboxed iframe.

### `GET /__webpage_asset_proxy?url=...`

- Proxies assets (CSS/JS/images/fonts/media) as same-origin responses to improve fidelity.
- Must be bounded (timeout/max-bytes) and not rely on streaming indefinite bodies.

### `POST /__website_import/import-url`

- Persists per-URL artifacts to `.knowgrph-workspace/...`:
  - `raw.html` (guaranteed)
- `page.md` and `conversion.json` may exist for some imports; when present they are served via `/__website_import/artifact`, otherwise the client falls back to on-demand conversion.

### `GET /__website_import/artifact?importId=...&nodeId=...&kind=...`

- Returns stored artifact content.
- Used for fast view switching in the active-row dropdown.

### `GET /__website_import/status?importId=...`

- Returns a small **status + progress** snapshot for UI polling:
  - `status`: `queued | running | done | failed`
  - `progress.stage`: `queued | discovering | crawling | converting | done | failed`
  - `progress.total/processed/ok/error/queued`
  - `progress.lastUrl` (optional)
- Must be **bounded + backoff-aware** on the client (avoid tight polling loops).

### `GET /__website_import/manifest?importId=...`

- Returns the final manifest including `nodes[]` and `errors[]`.
- UI should treat this as a post-completion fetch (avoid repeatedly pulling a large node list while the job is running).

## `srcdoc` Rendering Rules

Webpage HTML/JSON view renders via a sandboxed iframe using a **sanitized `srcdoc` snapshot**.

The srcdoc builder:

- strips `Content-Security-Policy` and refresh `<meta http-equiv="...">` tags (avoid self-blocking / auto-redirect)
- strips all `<script>` tags and inline `on*=` handlers (untrusted scripts do not execute)
- upserts a sandbox CSP meta allowing images/media/styles while restricting scripts to injected utilities
- injects scroll-sync utilities (iframe ↔ parent via `postMessage`)
- upserts `<base>` to preserve correct resolution (use the original URL, or `${window.location.origin}/` when serving proxied assets)

This policy prioritizes safety and determinism. For JS-rendered content capture, use the DOM export bridge (`kg-export-dom`) to extract a rendered snapshot and then upgrade the saved Markdown.

## DOM Export Bridge (`kg-export-dom`)

The proxy-injected layer inside the sandboxed iframe listens for `postMessage` requests of the form:

- `kind`: `kg-export-dom`
- `id`: request correlation id
- `mode`: `text | html`
- `maxChars`: cap the exported payload
- `expandFaq`: best-effort click/expand for accordion-like FAQ sections
- `scrollCrawl`: best-effort scroll/settle loop to load lazy content and stabilize text

It replies with:

- `kind`: `kg-export-dom`
- `id`: same id
- `text`: exported content (either rendered visible text or serialized HTML)
- `title`: best-effort title
- `clipped`: whether the result was truncated

This bridge powers two native (no headless browser) fidelity upgrades:

- **Convert HTML → Markdown** from the viewer surface by exporting DOM text/HTML.
- **Import URL fallback** when the initial conversion yields low-quality Markdown for JS-rendered pages.

## Iframe Sandbox Policy

All webpage HTML rendering in Viewer / Presentation / Slides uses a sandboxed iframe with:

- `sandbox="allow-scripts"`
- `referrerPolicy="no-referrer"`

The sandbox must forbid top-level navigation (do not include `allow-top-navigation`).

## Website Import → Workspace File Generation

When importing a website (sitemap/tree), each created workspace entry can be generated as a full **Webpage Markdown Artifact** (Document Structure analysis) instead of a frontmatter-only stub.

- Setting: `websiteImportGenerateWebpageArtifactDocs` (default `true`)
- Behavior: for each manifest node, fetch the stored `raw.html` artifact and generate the detailed artifact markdown (HTML→artifact conversion), while preserving the per-page frontmatter contract keys.

Additionally, the website import root folder includes a generated `website.sitemap.md` artifact that summarizes the imported pages (tree + pages table).

## View Mode Semantics

- `Markdown`: Editor shows Markdown; Viewer/Presentation/Slides render Markdown.
- `JSON`: Editor shows conversion JSON (read-only override); Viewer/Presentation/Slides render sandboxed JSON code (iframe `srcdoc`).
- `HTML`: Editor shows editable Markdown SSOT; Viewer/Presentation/Slides render sandboxed HTML via sanitized `srcdoc`.

## Shared Signal Tokens (Mode-Independent)

All view modes share the same generic signal/token vocabulary derived from Markdown (no site-specific branching):

- `[NAV]`, `[CTA]`, `[LINK]`: classified link intent
- `[PRICE]`: price/cost tokens
- `[TIME]`: timecode tokens

The Markdown artifact can render these tokens inline (for example `Nav: [NAV] Docs | [CTA] Get started`) and the Document Structure section includes the same token prefixes.

The workspace toolbar also surfaces a compact token summary for webpage-backed docs so the same `[NAV]/[CTA]/[PRICE]/[TIME]` categorization is visible in `Markdown`, `JSON`, and `HTML` view modes.

## Webpage Markdown Artifact Structure (No Hardcoded Domains)

The Markdown artifact uses *generic extracted signals* plus optional extracted detail blocks to produce a more fixture-like, sectioned document without branching on any specific website.

### Required Signals (Generic)

- Header navigation must be derived from `[NAV]`/`[LINK]` intent plus optional `## Extracted Navigation Menus` blocks.
- Hero block must be derived from the main H1 + nearby summary paragraph + a first inline command (e.g. `$ npx ...`) + nearby CTAs.
- Section details must be derived from counts over the section body (paragraphs, links, media, price tokens, timecodes).

### Generic HTML Extraction Heuristics

- Navigation/header roots may not use semantic `<header>/<nav>` tags. Prefer elements marked by `role="navigation"`, `aria-label` containing `navigation/menu`, or menu-like containers with multiple links/buttons.
- Main content text may be nested in generic containers without `<p>/<h*>` tags. Extract leaf text blocks from containers when they do not contain known block descendants, while excluding `<script>/<style>` contents.
- Header image should prefer social preview metadata (`og:image` / `twitter:image`) when present; otherwise fall back to first meaningful content image.

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
