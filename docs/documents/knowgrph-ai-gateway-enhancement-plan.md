---
title: "Knowgrph AI Gateway Enhancement Plan"
doc_type: "Execution Plan"
status: "active"
date: "2026-07-11"
authors:
  - "airvio"
schema: "kgc-computing-flow/v1"
lang: "en-US"
frontmatter_contract: "required"
tags:
  - "cloudflare"
  - "ai-gateway"
  - "tco"
  - "token-economics"
  - "roadmap"
  - "no-code-edits"
related:
  - "README.md"
  - "docs/documents/knowgrph-cloudflare-document.md"
  - "docs/documents/knowgrph-next-step-priorities.md"
  - "canvas/src/features/panels/views/cloudflareAiGatewayMcpApiDocs.ts"
  - "web/src/lib/ai-gateway.js"
---

# Knowgrph AI Gateway Enhancement Plan

## Purpose

This document turns the current "AI Gateway-ready" position into a min-viable-max-value execution
queue.

It is optimized for the current operating mode:

- solo-dev, high-ROI execution
- no core runtime edits in this phase
- time-to-value before feature breadth
- token economics and TCO visibility before provider expansion
- Dev -> Prod -> Cloudflare discipline

## Current Repo Truth

Knowgrph already has the right structural boundary for Cloudflare AI Gateway:

- Cloudflare is the runtime boundary for hosted routes and secrets
- AI Gateway is already treated as the correct model-routing boundary
- the repo already documents caching, dynamic routing, observability, and control surfaces

The next highest-ROI move is not adding more providers. It is operationalizing the existing gateway
boundary so cost, routing, and proof become explicit operator contracts.

## Operating Rule

Prefer the smallest change that improves one or more of:

1. token-cost reduction
2. operator proof density
3. routing flexibility without redeploy churn
4. spend isolation
5. migration clarity toward current Cloudflare AI Gateway surfaces

If a task does not improve one of those five outcomes, defer it.

## Strict Priority Order

### 1. Cache deterministic context first

**Goal:** cut repeat token spend on stable context before changing model strategy.

**Why now:** this is the fastest measurable savings lane and requires the least product complexity.

**Cloudflare primitive:** per-request caching headers such as `cf-aig-cache-ttl`,
`cf-aig-cache-key`, and `cf-aig-skip-cache`.

**Apply to:**

- stable `@` context hydration
- repeated retrieval/RAG envelopes
- fixed system prompts and reusable orchestration scaffolds
- deterministic mock-to-live comparison prompts

**Do not apply to:**

- highly user-specific prompts without a stable cache key
- approval-bearing mutation steps
- prompts that intentionally depend on volatile state

**Proof:** observe `cf-aig-cache-status` and compare repeat-request latency/cost before and after.

### 2. Map intent to dynamic routes

**Goal:** let `#` semantics choose cost/latency/reliability policy without app redeploys.

**Why now:** Knowgrph already has grammar as the category anchor. Dynamic routes let Cloudflare own
provider selection while the app keeps owning intent.

**Cloudflare primitive:** `dynamic/<route-name>` with request metadata and fallback nodes.

**First route set:**

- `dynamic/draft` for lowest-cost acceptable drafting
- `dynamic/proof` for higher-reliability verification and review
- `dynamic/publish` for stricter quality or fallback coverage

**Proof:** capture the returned `cf-aig-model` and `cf-aig-provider` headers and confirm the route
selected the intended downstream model policy.

### 3. Attach spend and abuse limits to request metadata

**Goal:** stop runaway loops and budget drift at the gateway boundary.

**Why now:** for a solo startup, bounded spend is more valuable than broader model optionality.

**Cloudflare primitive:** spend limits, rate limiting, and request metadata.

**Metadata contract to standardize when runtime edits are open:**

- intent
- workspace or document id
- user or operator scope
- run or request id
- environment lane (`dev`, `prod`, `cloudflare`)

**Proof:** a controlled over-budget or over-rate test must block at the gateway and produce a clear
operator-visible reason.

### 4. Turn analytics into proof, not dashboard decoration

**Goal:** make token and cost data part of the source-owned operating loop.

**Why now:** observability only compounds when it feeds decisions, not when it stays isolated in a
vendor dashboard.

**Cloudflare primitive:** AI Gateway analytics, logs, and GraphQL usage queries.

**First output to materialize:**

- requests by intent
- tokens by intent
- cost by provider/model
- cache-hit rate for repeated context lanes
- error rate for dynamic-route fallback paths

**Proof:** one small daily or release-scoped summary that shows spend, cache-hit behavior, and the
highest-cost route by intent.

### 5. Modernize the canonical integration target

**Goal:** keep future implementation work aligned with current Cloudflare AI Gateway surfaces.

**Why now:** Cloudflare's 2026 AI Gateway REST API unifies model calling and makes old endpoint
guidance easier to misread if it remains implicit.

**Preferred future target when runtime edits are open:**

- `POST /ai/run` for universal model and modality coverage
- `POST /ai/v1/chat/completions` for OpenAI-compatible LLM flows
- `POST /ai/v1/responses` for agentic OpenAI-compatible flows
- `POST /ai/v1/messages` only where Anthropic-schema compatibility is the right fit

**Migration rule:** keep existing compat/universal references stable until a named runtime owner
updates them, then cut over source docs and operator surfaces together.

**Proof:** one named runtime owner and one focused verification path per adopted endpoint.

## Recommended Sequence

1. Document the metadata contract and cache policy.
2. Introduce one dynamic route for one low-risk intent.
3. Add spend/rate limits scoped by that same metadata.
4. Publish one small source-owned cost proof artifact.
5. Update remaining legacy endpoint wording only when the runtime owner is ready.

## First Runtime Slice When Code Edits Open

Start with one narrow lane only:

- preserve current gateway boundary
- add request metadata for intent plus run id
- add caching to deterministic context requests
- add one `dynamic/draft` route
- verify with cache-status plus returned model/provider headers

This is the best first slice because it improves token economics, routing flexibility, and proof
density with the least runtime churn.

## Non-Goals For This Slice

- broad provider expansion
- deep UI surface redesign
- changing the Dev -> Prod -> Cloudflare release contract
- replacing existing local harness proof with hosted-only proof
- claiming unified billing or provider-key removal in runtime surfaces before implementation exists

## Done For This Run

- source-owned canonical plan created
- README pointer added for first-read operators
- Cloudflare baseline linked to this queue
- planning ledger updated so the next runtime slice is explicit
- focused `ai-gateway:readiness:check` command added for source proof, publish smoke, and Pages-secret verification
- authenticated storage relay now derives the default AI Gateway `dynamic/draft` route and draft-cache TTL from request metadata
- current execution confirms the focused source proofs and publish-repo `__chat_proxy` smoke pass before the live gate
- `ai-gateway:readiness:check -- --skip-sync-check --skip-live` still stops at the Pages secret-list check when the `joohwee` project lacks an accepted AI Gateway secret
- latest bounded readiness run: source proof and publish proxy smoke passed, but Cloudflare Pages project `joohwee` is still missing both `KNOWGRPH_CHAT_PROXY_AI_GATEWAY_BASE_URL` in project config and an accepted AI Gateway secret, and no local operator AI Gateway envs were present to promote
- materialized the source-owned analytics proof artifact (`docs/reports/ai-gateway-cost-proof.md`) to anchor future cost tracking
- updated API documentation to explicitly distinguish legacy `gateway.ai.cloudflare.com` references from the modern `api.cloudflare.com/.../ai` REST endpoints
