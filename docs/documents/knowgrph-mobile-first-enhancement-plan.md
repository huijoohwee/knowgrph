---
title: "Knowgrph Mobile-First Enhancement Plan"
doc_type: "Implementation Plan"
status: "active"
lang: "en-US"
frontmatter_contract: "required"
---

# Knowgrph Mobile-First Enhancement Plan

## Authoring Contract

- The opening YAML frontmatter block remains the first-block metadata SSOT for this plan.
- This document is a canonical upstream implementation plan, not a generated publish artifact or runtime contract.
- Mobile-first enhancements must be implemented in Dev owners first, then mirrored to Prod artifacts and Cloudflare only through the normal publish path.
- This plan assumes the current no-code constraint; it defines source-owned priorities, acceptance criteria, and verification targets without mutating runtime code directly.

## Scope

This plan converts the current mobile-first design intent into a focused execution queue for:

- `/Users/huijoohwee/Documents/GitHub/knowgrph`
- `/Users/huijoohwee/Documents/GitHub/huijoohwee/content/knowgrph`
- `airvio.co/knowgrph`

The goal is not broad redesign. The goal is higher mobile time-to-value for the existing orchestration stack, especially:

- Agent-ready `/`, `#`, and `@` invocation reachability
- Touch-safe canvas and workspace interaction
- Lower mobile transfer, CPU, and memory cost
- Repeatable proof through harness and release discipline

## Priority Order

1. Grammar reachability
2. Heavy-runtime gating
3. Virtual-keyboard safety
4. Workflow evidence and budgets
5. Publish parity

This order follows startup ROI: reduce input friction first, then keep mobile sessions light, then lock in proof so future changes do not drift.

## Enhancement Queue

### 1. Grammar Quick Bar

**Why**

Mobile keyboards make `/`, `#`, and `@` slower to reach than plain text. That adds friction at the exact point where Agentic Canvas OS wants fast invocation.

**Recommendation**

- Add one source-owned mobile grammar quick bar for `/`, `#`, and `@`.
- Dock it in the same safe-area-aware thumb zone already used by the mobile toolbar direction.
- Reuse one shared trigger contract across FloatingPanel Chat UI, Editor Workspace, and any controlled command composer.

**Source owners**

- `knowgrph/canvas/src/pages/Canvas.tsx`
- `knowgrph/canvas/src/styles/responsive-toolbar.css`
- `knowgrph/canvas/src/features/chat/**`
- `knowgrph/canvas/src/features/markdown-workspace/**`

**Acceptance target**

- A mobile user can begin a slash, hash, or at-sign invocation in one tap without keyboard pane switching.

### 2. Heavy-Runtime Mobile Gating

**Why**

The current feature map already shows the main mobile cost centers clearly: Monaco, Mermaid plus ELK, MapLibre, and Three.

**Recommendation**

- Treat those runtimes as explicit-intent features on mobile.
- Keep default mobile entry routes on the lean shell and defer heavy activation until the user opens the feature.
- Prefer a static preview, placeholder, or summary state before full runtime hydration when the workflow allows it.

**Source owners**

- `knowgrph/docs/documents/knowgrph-feature-map.md`
- `knowgrph/canvas/src/components/CanvasViewport.tsx`
- `knowgrph/canvas/src/features/markdown/**`
- `knowgrph/canvas/src/features/three/**`
- `knowgrph/canvas/src/features/maps/**`

**Acceptance target**

- Common phone entry flows do not load Monaco, Mermaid+ELK, MapLibre, or Three unless the user explicitly asks for those surfaces.

### 3. Virtual-Keyboard Proof Contract

**Why**

The goal contract already forbids keyboard overlap, scroll traps, and hidden controls, but the proof should be explicit and repeatable.

**Recommendation**

- Extend the responsive proof path with a mobile keyboard state.
- Simulate viewport-height loss during chat streaming and workspace editing.
- Verify that input, recent context, primary action controls, and one visible recovery path remain reachable.

**Source owners**

- `knowgrph/knowgrph_parser/superagent_responsive.py`
- `knowgrph/knowgrph_parser/superagent_harness_test.py`
- `knowgrph/docs/documents/knowgrph-superagent-harness.md`
- `knowgrph/docs/documents/knowgrph-testing-document.md`

**Acceptance target**

- Mobile proof classes stay usable when the virtual keyboard is open and streamed output updates are still arriving.

### 4. Route-And-Action Mobile Evidence

**Why**

Bundle size alone is not enough. The useful question is which mobile journeys trigger expensive work and whether that work is necessary immediately.

**Recommendation**

- Maintain one route-and-action matrix for the top mobile workflows.
- Record which user action triggers each heavy chunk family.
- Mark each feature as immediate, deferred, or fallback-safe on phones.

**Source owners**

- `knowgrph/docs/documents/knowgrph-feature-map.md`
- `knowgrph/docs/documents/knowgrph-ui-ux-design-document.md`
- `knowgrph/docs/documents/knowgrph-cross-repo-publish-topology.md`

**Acceptance target**

- Mobile performance decisions are driven by workflow evidence instead of one-off intuition.

### 5. Dev -> Prod -> Cloudflare Responsive Parity

**Why**

Mobile fixes lose value when they only exist in one surface or are patched downstream.

**Recommendation**

- Keep responsive behavior source-owned in Dev.
- Mirror only generated artifacts into Prod.
- Treat mobile proof as a release gate before publish parity claims.

**Source owners**

- `knowgrph/goal.md`
- `knowgrph/docs/documents/knowgrph-cross-repo-publish-topology.md`
- `huijoohwee.github.io/schema/AgenticRAG/README.md`

**Acceptance target**

- Mobile behavior described upstream matches the published route and schema mirror without route-specific downstream patches.

## Release Gate Checklist

- Mobile grammar entry is reachable without symbol-pane switching.
- Default phone flows stay on the lean shell.
- Heavy feature families remain explicit-intent on phones.
- Virtual-keyboard proof covers chat and workspace surfaces.
- Mobile, tablet, desktop, and wide proof classes stay documented in one upstream path.
- Publish and schema mirrors describe only validated upstream behavior.

## Deferred Until Code Edits Are Allowed

- UI implementation of the grammar quick bar
- Mobile-specific preview surfaces for Mermaid, maps, or 3D
- Browser-smoke automation for the quick bar and mobile fallback states
- Route-level runtime gating changes in canvas owners

These remain the next execution slice once the no-code boundary is lifted.

## Companion Documents

- `docs/documents/knowgrph-ui-ux-design-document.md`
- `docs/documents/knowgrph-feature-map.md`
- `docs/documents/knowgrph-cross-repo-publish-topology.md`
- `docs/documents/knowgrph-superagent-harness.md`
- `docs/documents/knowgrph-testing-document.md`
