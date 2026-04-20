---
title: {{product}} · Chat → AI Markdown Pipeline
product: Knowgrph Canvas
pipeline: canvas → chat context → user intent → AI markdown → validation → render/save
status: canonical
---

# {{product}} · Chat → AI Markdown Pipeline

## Purpose
Define the end-to-end pipeline from FloatingPanel Chat input to Workspace-ingestible Markdown that can be parsed and rendered across Infinite Canvas, Workspace Editor, Multi-dimensional Table, and Kanban.

## Pipeline
`{{pipeline}}`.

## Phase 1 · Context Packaging (`packContext()`)
Chat prepends a system prompt that bundles:
- `selected_node`: id/label/type + clipped properties/metadata
- `connected_edges`: up to 50 incident edges
- `frontmatter`: active markdown document frontmatter (clipped)
- `graph_summary`: bounded graph summary string
- `guideline_digest`: condensed syntax rules and validator ids

Canonical source: `docs/documents/markdown-syntax-guidelines.md`.

## Phase 2 · AI Markdown Generation
Chat uses the provider proxy and sends:
- Base contract system prompt (`chatResponseBaseContract.ts`; `chatKnowgrph` vs standard)
- `packContext()` system prompt
- Optional bounded subgraph context and workspace-wide context
- Conversation history

When `chatStorageTarget=chatKnowgrph`, the assistant must output:
- A standalone parseable KGC markdown document aligned to `kgc-ai-pipeline-chat-response-base-template.md`
- Deterministic frontmatter↔body variable linkage using `{{}}`
- Canonical pipeline surfaces (`runtime`, `pipeline`, `mermaid`, `flow`) with validation-safe enums and pure compute blocks

## Phase 3 · Validation Gate (`validateMarkdown()`)
When `chatStorageTarget=chatKnowgrph`, the `kgc` block is validated before final persistence:

### Structural Gate
- Accept either one fenced `kgc` block or one raw standalone KGC markdown document.
- The KGC body must stay standalone parseable for Canvas/Workspace/Table/Kanban.
- No nested code fences inside the persisted KGC document.

### Syntax Rules (V-01..V-07)
- `V-01` Color sigil HEX is exactly 6 uppercase digits.
- `V-02` No quoted span ≥ 15 words.
- `V-03` `{{key}}` refs must resolve from context/frontmatter or inline declarations, and KGC body/`solution_md` must stay substantively linked and non-thin.
- KGC body must carry the real answer content; `{{solution_md}}` may support linkage but must not be the entire body output.
- `V-04` Inline-code arrays must be valid JSON.
- `V-05` `compute: |` blocks are pure (forbid `fetch`, `document`, `window`).
- `V-06` H1–H4 headings must not end with `...`.
- `V-07` `confidence:` values are exactly `low|medium|high`.

### Retry Loop
On failure, Chat re-prompts up to 3 attempts using:
- `@flag:correction`
- `failed_rule: V-0x`
- `reason: ...`
- A truncated invalid output excerpt (reference only)

If attempts are exhausted, Chat persists a parser-safe deterministic KGC fallback while still returning a concise answer; Workspace surfaces never ingest broken Markdown.

## Persistence Contract
- The Workspace `kgc_*.md` file is the standalone canonical KGC document.
- `chatKnowgrph` creates canonical files in the `kgc_yyyymmddhhmmss.md` pattern.
- On write, canonical KGC identity is kept base-template compliant; only `links.self_ref` is normalized from the `kgc_*.md` filename.
- Structural acceptance requires frontmatter↔body linkage: every body `{{key}}` reference must be declared in YAML frontmatter (base-template allows dotted `runtime.*` refs).
- Base-template Tier B sentinel keys (`product/domain/subject/objective/artifact/owner/version/status`) are allowed as unresolved placeholders when declared in frontmatter.
- Do not append `<!-- kg-chat-history -->` or any chat-history trailer to `kgc_*.md`.
- Continuation: fallback recovery and streaming handoff details are documented in `docs/documents/knowgrph-chat-ai-markdown-pipeline-document.fallback-recovery.md`.
