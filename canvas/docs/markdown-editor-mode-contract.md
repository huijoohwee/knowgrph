# Markdown Editor Mode Contract

This contract defines how a workspace document round-trips between **Webpage (HTML)** and **Markdown**, with explicit fidelity controls.

## Goal

- **100% HTML fidelity** is guaranteed in `HTML` and `DOM` views (pixel/render fidelity inside a sandboxed viewer).
- **Markdown view** guarantees **100% information capture** (content + links + media + interactive embeds) by preserving rich structures as either:
  - safe-renderable Markdown, or
  - safe-renderable HTML blocks (allowlisted), or
  - escaped code blocks when a block cannot be safely rendered.

## Webpage View Modes

These are controlled by `kgWebpageView` in frontmatter.

- `html`: Renders the webpage as sandboxed HTML (srcdoc) with `<base href>`.
- `dom`: Captures the post-hydration DOM snapshot and renders it (best for JS-heavy sites).
- `raw`: Displays raw HTML source for inspection/debugging.
- `json`: Displays conversion/metadata JSON.
- `markdown`: Displays the generated Markdown artifact doc.

## Frontmatter Keys

Minimal required:

```yaml
kgWebpageUrl: "https://example.com/"
kgWebpageView: "html"
```

Optional fidelity controls:

```yaml
kgWebpageScriptPolicy: "allow" | "strip"
kgWebpageIncludeImages: "true" | "false"
kgWebpageFidelityLevel: "1" | "2" | "3" | "4"
```

Semantics:

- `kgWebpageScriptPolicy`
  - `allow`: keep scripts in the HTML sandbox (best render fidelity).
  - `strip`: remove scripts/handlers for safer static rendering.
  - omitted: uses global viewer default.
- `kgWebpageIncludeImages`
  - Controls whether HTML→Markdown conversion preserves images/picture blocks.
  - omitted: uses global import default.
- `kgWebpageFidelityLevel`
  - Controls how aggressively HTML structures are preserved during HTML→Markdown conversion.
  - Higher levels preserve more blocks as HTML (media, SVG, complex layout wrappers).
  - omitted: uses global fidelity default.

## Round-trip Rules

- Switching view modes MUST be lossless for frontmatter keys.
- `Sync` regenerates Markdown from a DOM snapshot:
  - DOM capture → HTML→Markdown conversion (with `IncludeImages` + `FidelityLevel`) → Markdown artifact doc.
- Markdown preview renders safe HTML blocks through an allowlist.
  - Unsupported blocks are shown as code (never silently dropped).

