# Webpage Proxy + Sandboxed `srcdoc` Iframe Rendering

## Goal

Render imported webpages with high fidelity (rich media, animations) while preserving the app invariants:

- **Sandbox boundary**: untrusted HTML must never escape the iframe.
- **View-only switching**: `Markdown | JSON | HTML` must not mutate graph/layout/zoom.
- **Neutrality**: no site-specific hacks or hardcoded domains.

## Surfaces

- **Editor**: shows an editable Markdown SSOT; JSON may be shown as a read-only text override.
- **Viewer / Presentation / Slides Gallery**: render either Markdown (view = `markdown`) or a sandboxed iframe (view ∈ {json, html}).

## Frontmatter Contract (per imported page)

- `kgWebpageUrl`: source URL
- `kgWebpageView`: `markdown | json | html`
- `kgWebsiteImportId`: optional website-import job id
- `kgWebsiteNodeId`: optional stable node id
- `kgWebsiteOutputDirRel`: optional artifact root override

## Endpoints (dev server middleware)

### `POST /__webpage_convert?url=...`

- Returns conversion JSON including `markdown` (and optional structured fields like `title`).
- Used for **graph alignment** (Document Structure parsing derives nodes/edges from Markdown).
- Conversion is **static HTML fetch → Python convert** (no headless browser dependency). If the result looks incomplete (e.g. JS-rendered/accordion content is missing), the client may upgrade fidelity via the browser-native DOM export path.

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
  - `raw.html`
  - `page.md`
  - `conversion.json`
  - Webpage Markdown artifacts are generated client-side from Markdown signals and stored in the workspace markdown file.

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

Webpage HTML view supports **two** sandboxed iframe strategies, chosen per document and per available artifacts:

### Strategy A: Proxy `src` (highest fidelity)

- The iframe uses `src="/__webpage_proxy?url=..."`.
- Upstream scripts **can run** (still confined by the iframe sandbox), which preserves rich media, client-side routing, and JS-rendered sections.
- The injected layer rewrites asset requests to `/__webpage_asset_proxy` to keep asset loading same-origin.

### Strategy B: Sanitized `srcdoc` snapshot (editable / stable)

- The iframe uses `srcDoc=...` built from either:
  - website-import `raw.html` artifact when available, else
  - a one-time fetch from `GET /__webpage_proxy?url=...`.
- The `srcdoc` builder:
  - strips `Content-Security-Policy` and refresh `<meta http-equiv="...">` tags (avoid self-blocking / auto-redirect)
  - strips all `<script>` tags and inline `on*=` handlers (untrusted scripts do not execute)
  - upserts a sandbox CSP meta allowing images/media/styles while restricting scripts to injected utilities
  - injects scroll-sync utilities (iframe ↔ parent via `postMessage`)
  - upserts `<base>` to preserve correct resolution:
    - If the HTML already contains `/__webpage_proxy` or `/__webpage_asset_proxy`, base is set to `${window.location.origin}/`.
    - Otherwise base is set to the original URL.

The host chooses between Strategy A and B based on whether it has a safe, non-clipped HTML snapshot available (for example from website-import artifacts or an editor override).

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
- **Import URL fallback** when `/__webpage_convert` yields low-quality Markdown for JS-rendered pages.

## Iframe Sandbox Policy

All webpage HTML rendering in Viewer / Presentation / Slides uses a sandboxed iframe with:

- `sandbox="allow-scripts"`
- `referrerPolicy="no-referrer"`

The sandbox must forbid top-level navigation (do not include `allow-top-navigation`).

## Website Import → Workspace File Generation

When importing a website (sitemap/tree), each created workspace entry can be generated as a full **Webpage Markdown Artifact** (Document Structure analysis) instead of a frontmatter-only stub.

- Setting: `websiteImportGenerateWebpageArtifactDocs` (default `true`)
- Behavior: for each manifest node, fetch the stored `page.md` artifact and generate the detailed artifact markdown, while preserving the per-page frontmatter contract keys.

Additionally, the website import root folder includes a generated `website.sitemap.md` artifact that summarizes the imported pages (tree + pages table).

## View Mode Semantics

- `Markdown`: Editor shows Markdown; Viewer/Presentation/Slides render Markdown.
- `JSON`: Editor shows conversion JSON (read-only override); Viewer/Presentation/Slides render sandboxed JSON code (iframe `srcdoc`).
- `HTML`: Editor shows editable Markdown SSOT; Viewer/Presentation/Slides render sandboxed HTML (iframe `srcdoc`).

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
