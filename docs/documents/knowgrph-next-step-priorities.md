---
schema: kgc-computing-flow/v1
id: knowgrph-next-step-priorities
version: 1.0.0
status: implemented
created: 2026-07-10
updated: 2026-07-10
author: airvio / joohwee
domain: knowgrph
doc_type: "Priority Roadmap"
frontmatter_contract: required
tags: [strategy, roadmap, startup, mcp, harness, agentic-canvas-os, tco]
constraints:
  - solo-dev
  - ai-native
  - token-efficient
  - source-owned
  - no-code-edits
related:
  - README.md
  - docs/documents/knowgrph-mcp-install-contract.md
  - docs/documents/knowgrph-mcp-onboarding-index.md
  - docs/documents/knowgrph-agent-ready-document.md
  - docs/documents/knowgrph-superagent-harness.md
  - ../agentic-canvas-os/docs
  - ../huijoohwee/content/knowgrph
---

# Knowgrph Next-Step Priorities

## Purpose

This document turns the current README positioning into a strict, doc-first next-step queue for
Knowgrph.

It is optimized for the current operating mode:

- solo-dev startup execution
- AI-native orchestration and harness-first proof
- low TCO and strong token economics
- FOSS and provider-neutral positioning
- min-viable-max-value and short time-to-value
- Dev -> Prod -> Cloudflare promotion discipline
- no code edits in this phase

## Operating Rule

Prefer the shortest path that improves one of these outcomes:

1. external installability
2. product differentiation
3. proof density
4. offline evaluation
5. operator release clarity

Do not expand feature breadth before the current install, grammar, and proof surfaces become easier
to adopt and easier to trust.

## Strict Priority Order

### 1. Productize the install boundary

**Goal:** make remote MCP onboarding one-link simple for external hosts.

**Why now:** the README already claims shipped public discovery and control-plane readiness. The
fastest ROI is reducing install ambiguity, not widening capability.

**Do now:**

- treat `docs/documents/knowgrph-mcp-install-contract.md` as the canonical install rule
- treat `docs/documents/knowgrph-mcp-onboarding-index.md` as the one-page guided entry
- keep the public discovery vs control-plane split explicit in all operator-facing docs
- maintain a short host decision table for ChatGPT, Claude, Vercel, Lovable, and generic MCP

**Done when:**

- a new operator can choose the correct endpoint without reading architecture prose
- install-facing docs all route back to the same canonical boundary
- no doc implies one-URL grammar invocation where sessioned MCP support is required

## 2. Make Agentic Canvas OS grammar the category anchor

**Goal:** position Knowgrph around `/`, `#`, and `@` grammar over frontmatter SSOT, not as a
generic canvas.

**Why now:** this is the strongest differentiator against drawing canvases, generic agent
frameworks, and proprietary thinking surfaces.

**Do now:**

- keep `../agentic-canvas-os/docs` as the control surface for route dictionaries and harness rules
- describe Knowgrph as a git-native runnable document canvas for agents
- foreground global, centralized, frontmatter-owned runtime state
- keep grammar examples short, source-backed, and operator-legible

**Done when:**

- the top-level story is clearly "runnable markdown + frontmatter SSOT + grammar invocation"
- external readers can map `/`, `#`, and `@` to concrete operator value
- supporting docs reinforce the same category message without inventing new slogans

## 3. Sell proof, not possibility

**Goal:** tighten every public claim to documented proof states.

**Why now:** for a solo startup, trust compounds faster than breadth. README truthfulness and
readiness labeling are already part of the product surface.

**Do now:**

- use `documented`, `browser-published`, and `runtime-executable` consistently
- keep proof paths tied to source-owned docs, harness outputs, and executable checks
- avoid roadmap language that sounds shipped without a proof artifact
- keep release notes short and evidence-backed

**Done when:**

- each important claim resolves to one proof state
- onboarding, agent-ready, and MCP docs use the same readiness vocabulary
- release-facing docs help operators verify instead of infer

## 4. Push offline deterministic harness as the adoption wedge

**Goal:** make offline evaluation the easiest way to experience Knowgrph.

**Why now:** this aligns best with TCO, token economics, FOSS trust, and fast technical due
diligence.

**Do now:**

- treat `README.md` quick start as the baseline evaluation path
- package a small set of deterministic mock-provider demos
- route readers to harness and parser docs before paid-provider setup
- keep generated proofs bounded and source-addressable

**Done when:**

- an evaluator can run a meaningful demo without external keys
- harness outputs show state, trace, final report, and proof manifest clearly
- offline proof remains the default before any spend-bearing lane

## 5. Keep Dev -> Prod -> Cloudflare release discipline explicit

**Goal:** make promotion rules easy to follow and hard to misread.

**Why now:** strong operator discipline is a force multiplier for a solo founder and reduces
publish/deploy drift.

**Do now:**

- keep Dev as the authored source of truth
- keep `../huijoohwee/content/knowgrph` treated as generated publish output
- keep Cloudflare lanes explicitly operator-opened
- maintain concise release and post-deploy checklists in source-owned docs

**Done when:**

- source, publish, and deploy responsibilities are obvious to a future contributor or agent
- no doc treats publish artifacts as canonical authoring surfaces
- release steps stay checklist-driven and proof-backed

## Near-Term Non-Goals

- expanding the root README into a large feature catalog
- broadening provider-specific narratives before onboarding is sharper
- adding new runtime surfaces just to create more surface area
- hiding deploy boundaries behind convenience wording

## Canonical Reading Order

1. `README.md`
2. `docs/documents/knowgrph-mcp-install-contract.md`
3. `docs/documents/knowgrph-mcp-onboarding-index.md`
4. `docs/documents/knowgrph-agent-ready-document.md`
5. `docs/documents/knowgrph-superagent-harness.md`
6. `../agentic-canvas-os/docs`

## Execution Heuristic

When choosing between two doc-only tasks, do the one that most directly improves:

- endpoint clarity
- grammar-led differentiation
- proof density
- offline demoability
- release discipline

If a task does not move one of those five, defer it.
