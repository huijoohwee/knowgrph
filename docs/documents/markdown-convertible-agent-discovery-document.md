---
title: "Markdown-Convertible Agent Discovery Document"
doc_type: "PRD + TAD"
version: "1.0.0"
status: "implemented"
date: "2026-07-11"
lang: "en-US"
owners:
  - "knowgrph"
  - "huijoohwee.github.io"
frontmatter_contract: "required"
---

# Markdown-Convertible Agent Discovery Document

## Goal

Keep the Knowgrph Live Canvas Hero human-first in React while exposing the same landing context as compact Markdown for agent discovery, low-token retrieval, and publish-safe cross-repo release flow.

## Problem Statement

The hero message, invocation grammar, and entry actions originally lived inside the React surface. That made the browser experience rich, but it left agent discovery dependent on the compiled app shell and created avoidable drift risk between source docs, publish artifacts, and Cloudflare delivery.

## Outcome

The Live Canvas Hero now reads its editorial content from a canonical Markdown document:

- source canonical doc: `knowgrph/docs/documents/knowgrph-live-canvas-hero.md`
- public discovery route: `https://airvio.co/knowgrph/knowgrph-live-canvas-hero.md`
- alternate discovery link: `https://airvio.co/knowgrph/`
- LLM index advertisement: `https://airvio.co/knowgrph/llms.txt`

This keeps one source of truth for:

- eyebrow
- headline
- lede
- execution posture
- public discovery route

## User Stories

**As a** human visitor  
**I want** the root and `/knowgrph/` surfaces to keep the interactive Live Canvas Hero  
**So that** I can enter the app and hand off agent-ready queries without losing the visual canvas experience

**As an** external agent  
**I want** a compact Markdown route for the landing context  
**So that** I can discover the product, grammar, and entry actions without paying the cost of parsing the full React shell

**As a** maintainer  
**I want** the hero copy to be source-backed and mirrored cleanly into publish  
**So that** wording drift is removed from the release path

## Acceptance Criteria

- The canonical hero copy lives in `docs/documents/knowgrph-live-canvas-hero.md`
- The React Live Canvas Hero reads bundled Markdown sourced from that document
- The public route `/knowgrph-live-canvas-hero.md` returns `text/markdown`
- `/knowgrph/` includes an alternate markdown discovery link
- `/knowgrph/llms.txt` advertises the discovery markdown route
- publish sync keeps the markdown asset in the root-managed file set
- Cloudflare deploy proof shows the markdown route live on `airvio.co`

## Architecture Overview

```text
knowgrph source doc
  docs/documents/knowgrph-live-canvas-hero.md
    -> Vite define injects bundled markdown into the React runtime
    -> public build emits /knowgrph-live-canvas-hero.md
    -> pages:build-sync mirrors artifacts into huijoohwee publish surfaces
    -> Cloudflare Pages serves:
         /knowgrph/
         /knowgrph/llms.txt
         /knowgrph/knowgrph-live-canvas-hero.md
```

## Implementation Contract

### Source of Truth

The hero editorial contract is owned by `knowgrph-live-canvas-hero.md`, not by hardcoded JSX strings and not by downstream publish-only patches.

### React Consumption

The browser runtime consumes bundled markdown injected at build time. This avoids browser-facing `node:fs/promises` fallbacks and keeps the source-backed contract compatible with Vite production builds.

### Discovery Surfaces

The publish surface must expose the same landing context through three paths:

1. interactive app shell at `/knowgrph/`
2. compact markdown route at `/knowgrph-live-canvas-hero.md`
3. discovery advertisement in `/knowgrph/llms.txt`

### Publish Ownership

`knowgrph` owns the source doc, build wiring, and sync rules.  
`huijoohwee` owns the published route copies and Cloudflare-facing delivery.  
The mirror repo must not invent alternate wording.

## Live Proof

The implemented route is live and verified:

- `curl -i https://airvio.co/knowgrph/knowgrph-live-canvas-hero.md`
  - expected: `HTTP 200`
  - expected: `content-type: text/markdown; charset=utf-8`
- `curl https://airvio.co/knowgrph/llms.txt`
  - expected line: `Live Canvas Hero discovery markdown: /knowgrph-live-canvas-hero.md`
- `curl https://airvio.co/knowgrph/`
  - expected alternate link to `/knowgrph-live-canvas-hero.md`

## Validation Commands

```bash
npm run pages:build-sync
npm run test:ci:unit -- ui.mainPanel.ktvRows.sharedEditableValueCell
curl -i https://airvio.co/knowgrph/knowgrph-live-canvas-hero.md
curl -s https://airvio.co/knowgrph/llms.txt
```

## Decisions

### Decision: Markdown remains canonical

**Rationale**: lowest drift risk and lowest token-cost discovery surface  
**Rejected alternative**: keep hero copy hardcoded in React and document it separately

### Decision: discovery is additive, not a separate landing stack

**Rationale**: preserve the human React hero while giving agents a compact Markdown path  
**Rejected alternative**: create a second manually maintained landing page just for agents

### Decision: fix browser warnings from the source module

**Rationale**: root/upstream neutralization is better than tolerating browser-incompatible fallbacks in importable modules  
**Rejected alternative**: ignore the warning because deploy still passes

## Risks and Mitigations

- Risk: source and mirror wording drift
  - Mitigation: keep identical wording in `knowgrph` and `huijoohwee.github.io`
- Risk: build regressions from Node-only fallbacks in browser-importable modules
  - Mitigation: use Vite-injected bundled markdown instead of browser-visible Node imports
- Risk: publish sync drops the root markdown asset
  - Mitigation: keep the route in the root-managed publish file set and cover it with sync tests

## Cross-References

- `knowgrph/docs/documents/knowgrph-live-canvas-hero.md`
- `knowgrph/canvas/src/features/agentic-os/liveCanvasHeroContent.ts`
- `knowgrph/canvas/src/features/panels/mainPanelSectionDescriptions.ts`
- `knowgrph/scripts/sync-pages-knowgrph.mjs`
- `huijoohwee.github.io/docs/documents/hjh-topology-document.md`
