---
schema: kgc-computing-flow/v1
doc_id: knowgrph-research-agent-prd-tad
doc_type: prd-tad
version: 0.2.0
status: reference-only-not-implemented
updated: 2026-05-29
repo_dev: /Users/huijoohwee/Documents/GitHub/knowgrph
repo_prod: /Users/huijoohwee/Documents/GitHub/huijoohwee/content/knowgrph
deploy_url: airvio.co/knowgrph
---

# Knowgrph Research Agent Reference PRD/TAD

## Document Purpose

This document preserves the research-agent concept as a reference-only contract. It is not an implementation claim and does not define an active runtime path. The repo currently has no native research-agent seeder, no research-agent reasoner Worker, no skill-loop writer, and no simulator runtime.

The implemented adjacent surfaces are:

| Surface | Current owner |
|---------|---------------|
| Queryable corpus | `docs/documents/knowgrph-query-prd-tad.md` |
| KGC prompt and canvas apply contract | `docs/documents/knowgrph-llm-prompt-contract-prd-tad.md` |
| Agent-ready WebMCP/runtime readiness | `docs/documents/knowgrph-agent-ready-prd-tad.md` |
| DeerFlow local gateway provider | `docs/documents/knowgrph-deerflow/knowgrph-deerflow-prd-tad.md` |

Any future research-agent work must reuse those owners where behavior already exists. It must not introduce a competing graph schema, duplicate source-file ingestion path, local-only patch stack, or second chat-to-canvas application pipeline.

## Current Repo State

| Capability | Status | Boundary |
|------------|--------|----------|
| Research seeding from external sources | Not implemented as a research-agent surface | Use existing Import URL, queryable corpus, and Source Files paths for current ingestion. |
| Canvas-side reasoner suggestions | Not implemented as a research-agent surface | Use KGC semantic graph/query and existing chat-to-canvas apply flows. |
| Session skill loop | Not implemented as a research-agent surface | No write path may create independent memory files without source-owner tests. |
| Scenario simulator | Not implemented as a research-agent surface | No simulator runtime or scenario-diff overlay is active. |
| Cloudflare research Worker | Not implemented | No Worker route should be documented as shipped until source and deploy validation exist. |

## Product Concept

A future research-agent surface may help users enrich a graph from external knowledge, ask query-relevant follow-up questions, and stage candidate graph primitives for review. The key product requirement is review-first graph enrichment: generated nodes and edges must be inspectable before they change the active graph.

Candidate outcomes:

- A user starts from a query, source file, URL import, or selected graph node.
- The system gathers context through existing ingestion and corpus primitives.
- Candidate KGC primitives are produced as reviewable suggestions.
- Accepted suggestions reuse the existing KGC apply path and preserve graph semantics.
- Rejected suggestions leave no persisted graph changes.

These outcomes remain inactive until implemented in source.

## Activation Requirements

Before this document can become implemented, the work must add source owners and tests for:

| Contract | Required proof |
|----------|----------------|
| Input selection | Reuse existing Import URL, Source Files, or queryable corpus selection owners. |
| Planning | Bounded plan generation with deterministic inputs and no repeated recomputation loop. |
| Source retrieval | Source-file-aware fetch/import ownership with visible provenance. |
| KGC extraction | Reuse KGC semantic parser/query helpers and existing graph apply semantics. |
| Review UI | A review surface that separates candidate primitives from committed graph data. |
| Persistence | No independent memory or skill files unless a canonical source owner and cleanup policy exist. |
| Cloudflare deployment | Worker or Pages route validation if any server runtime is added. |
| Validation | Unit tests, docs/source-owner guard, hygiene check, TypeScript, and focused workflow smoke. |

## Technical Direction

An active implementation should be built as an extension of current source owners:

- Use Import URL and Source Files for source acquisition rather than introducing a second ingestion stack.
- Use queryable corpus and KGC semantic graph helpers for retrieval and graph-language interpretation.
- Use existing chat-to-canvas apply contracts for committing accepted primitives.
- Use shared semantic-key helpers for any derived query, source, or candidate cache.
- Keep all generated candidate state reviewable and discardable until the user accepts it.
- Bound all agent loops by explicit iteration, time, and source-count limits.

## Non-Goals

- No external agent framework dependency.
- No unreviewed graph mutation.
- No independent schema that competes with `kgc-computing-flow/v1`.
- No generated memory directory without a source-owned lifecycle.
- No provider-specific model names in this reference document.
- No Cloudflare route claim without deployable Worker or Pages source.

## Acceptance Gate

This document can move from reference-only to implemented only when:

1. Source owners exist for retrieval, planning, candidate generation, review, and commit.
2. The implementation reuses current Import URL, Source Files, queryable corpus, KGC semantic, and chat-to-canvas owners where applicable.
3. Tests guard the source-owner map and reject duplicate ingestion or graph-apply paths.
4. The real workflow passes focused unit tests, `npm run hygiene:check`, TypeScript, and any required Cloudflare smoke.

Until then, the research-agent concept remains inactive and must not be presented as a shipped feature in UI, docs, tests, or deployment notes.
