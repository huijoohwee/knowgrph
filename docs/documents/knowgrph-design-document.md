# Knowgrph Design Document

## Purpose

This document is the design-level index for Knowgrph. It provides a stable entry point for the end-to-end pipeline and links to deeper, single-responsibility documents.

## End-to-end pipeline (summary)

1. **Author and ingest**: Markdown is ingested and normalized into a parseable form. `docs/workspace-readme.md` is the canonical workspace contract for the public Live Canvas Hero.
2. **Parse and derive**: Markdown (including Mermaid blocks) is converted into JSON-LD, then into `GraphData` (nodes + edges) with stable identifiers.
3. **Layout and render**: Seed layout + simulation constraints produce stable node/group positions; the React FlowCanvas renders nodes, edges, groups, and interactions with toggle-safe caching.
4. **Compose the launch surface**: `useKnowgrphLiveCanvasHero` derives the source-backed Hero model from the canonical workspace README (or a source-connected fallback when persisted state has not hydrated). `LiveCanvasHero` renders the visible `/`, `#`, and `@` invocation grammar over the same isolated `kgPreview=1&kgLiveHero=1` interactive runtime produced by **Share canvas embed** for the canonical workspace README; it never mounts the full `/knowgrph/` workspace behind Home. Explorer → Source Files → **Share canvas embed** is the background authority: the action selects and session-persists a same-origin `kgDoc` interactive runtime, which replaces the canonical embed after Home navigation. The action copies the selected published embed URL when available, otherwise a source-addressed `kgPreview=1&kgLiveHero=1` URL. The outer page receives the Hero visibility signal and removes toolbar/editor chrome; the viewport also removes Mermaid, timeline, minimap, metrics, paywall, and alternate-renderer surfaces. Every selected embed includes `kgLiveHero=1`; an asynchronously published URL may upgrade it only when same-origin, preserving the working local Dev canvas instead of mounting a production frame that security headers reject.
5. **Publish**: `npm run pages:build-sync` builds with `VITE_BASE_PATH=/knowgrph/` and synchronizes generated assets into `huijoohwee/content/knowgrph` plus the managed `huijoohwee/knowgrph` public-route surface. `npm run pages:functions:build` generates the Pages Functions bundle.
6. **Deliver and verify**: Cloudflare Pages serves `airvio.co/knowgrph/`. At `airvio.co/`, the generated root handler loads the published Knowgrph React shell, injects the `/knowgrph/` runtime alias, and renders the same source-backed Live Canvas Hero. If persisted workspace state lacks the canonical source, the root hook obtains `/docs/workspace-readme.md` and parses that text into the same interactive canvas rather than allowing a Mermaid/timeline workspace to own the root route. Verify Dev and Prod side by side before release completion.

The root hero is a live canvas composition, not a static image or copied HTML landing page. Its `Enter Knowgrph` action remains an ordinary link to `/knowgrph/`, preserving direct navigation and the public-route boundary.

## Key design documents

- Pipeline overview: `knowgrph-pipeline-document.md`
- Pipeline deep dive: `knowgrph-pipeline-deep-dive-document.md`
- Parser: `knowgrph-parser-document.md`
- Orchestrator: `knowgrph-orchestrator-document.md`
- Renderer: `knowgrph-renderer-document.md`
- Canvas UX: `knowgrph-ui-ux-design-document.md`
- Mermaid layout/config: `knowgrph-mermaid-layout-configuration.md`
- Schema: `knowgrph-schema-document.md`
- Semantic layer: `knowgrph-semantic-document.md`
- System design: `knowgrph-system-design-document.md`
- Cross-repo publish and Cloudflare E2E: `knowgrph-cross-repo-publish-topology.md`
