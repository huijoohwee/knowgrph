---
title: "Knowgrph Deterministic Knowledge-Graph Runtime"
doc_type: "Runtime Contract"
id: "knowgrph-deterministic-knowledge-graph-runtime"
version: "1.0.0"
status: "active"
created: "2026-07-22"
updated: "2026-07-22"
author: "airvio / joohwee"
domain: "knowgrph"
lang: "en-US"
frontmatter_contract: "required"
runtime_surface: "local-stdio-mcp"
inspiration_source: "https://github.com/Graphify-Labs/graphify"
copy_policy: "Clean-room, architecture-only inspiration; no copied code, prose, schemas, tool definitions, tests, fixtures, assets, prompts, commands, or outputs, and no clone, vendor, import, execute, call, or dependency relationship."
constraints:
  - "deterministic"
  - "local-first"
  - "no-vector-store"
  - "no-model-call"
  - "no-network-access"
  - "every-edge-explained"
  - "honest-unsupported-diagnostics"
tags:
  - "knowledge-graph"
  - "mcp"
  - "ast"
  - "lexical-traversal"
  - "provenance"
  - "runtime-contract"
related:
  - "docs/documents/knowgrph-query-prd-tad.md"
  - "mcp/README.md"
  - "README.md"
---

# Knowgrph Deterministic Knowledge-Graph Runtime

## Authority and Scope

This document is the focused contract for Knowgrph's deterministic local knowledge-graph runtime. The earlier [Queryable Corpus Graph PRD/TAD](knowgrph-query-prd-tad.md) remains authoritative for the 2026-05-29 browser, Source Files, Canvas, and FloatingPanel Chat implementation history.

The 2026-07-22 runtime extension narrowly supersedes that PRD's Phase 1 no-CLI/MCP non-goal. It adds local stdio ingest, query, and edge-explanation access over Knowgrph-owned corpus graph state. It does not authorize a remote service, hosted graph API, second graph store, MCP-only materialization pipeline, model-backed retrieval path, or deployment.

## Clean-Room Inspiration Boundary

[`Graphify-Labs/graphify`](https://github.com/Graphify-Labs/graphify) is architecture-only inspiration for the broad product category of turning a mixed local corpus into a queryable graph. It is not a specification, implementation source, oracle, or runtime component.

Knowgrph forbids:

- copying Graphify code, prose, schemas, tool definitions, tests, fixtures, assets, prompts, commands, examples, benchmarks, layouts, or output formats
- cloning or vendoring Graphify into a Knowgrph workspace, artifact, image, or repository
- importing or executing Graphify packages, binaries, scripts, generated artifacts, or tests
- calling a Graphify CLI, API, service, MCP server, subprocess, or hosted endpoint
- adding Graphify as a direct, optional, build, runtime, or transitive dependency
- using Graphify behavior or generated output as a conformance oracle for Knowgrph tests

Knowgrph's contracts, tool names, evidence model, implementation, tests, fixtures, and documentation remain independently authored from existing repository owners.

## Local Invocation Surface

The capability has exactly three local stdio MCP tool identities:

| Tool | Purpose |
|---|---|
| `knowgrph.knowledge_graph.ingest` | Build or refresh deterministic graph evidence for a supported local corpus. |
| `knowgrph.knowledge_graph.query` | Retrieve graph evidence using lexical matching and graph traversal. |
| `knowgrph.knowledge_graph.explain_edge` | Explain one stored edge from its source evidence and extraction basis. |

The matching Agentic Canvas OS aliases are:

| MCP tool | Exact Agentic Canvas OS invocation |
|---|---|
| `knowgrph.knowledge_graph.ingest` | `/knowledge.graph.ingest #knowledge-graph #mcp #runtime-ready @working-directory @knowledge-graph @operator @runtime-proof` |
| `knowgrph.knowledge_graph.query` | `/knowledge.graph.query #knowledge-graph #mcp #vcc @knowledge-graph @runtime-proof` |
| `knowgrph.knowledge_graph.explain_edge` | `/knowledge.graph.explain #knowledge-graph #mcp #vcc @knowledge-graph @runtime-proof` |

A stdio MCP client calls the tool identity directly. An ACOS-capable host resolves and validates the matching exact tuple above, then explicitly calls that tool; dictionary lookup alone never executes it. Callers use the input schema advertised by the running local server; authored docs do not duplicate that schema.

## Architecture and Ownership

The runtime follows one Knowgrph-owned path:

```text
local corpus -> deterministic structural adapters -> explained-edge graph artifact -> lexical graph traversal -> MCP evidence
```

- Existing corpus, GraphData, evidence, and local MCP owners remain authoritative.
- The MCP surface is an adapter over shared graph contracts, not a new graph owner.
- The deterministic runtime does not require Neo4j, a vector database, an embedding index, or an external parsing service.
- Optional FloatingPanel Chat answer synthesis remains a separate downstream harness concern and is not part of these three tools.

## Deterministic Coverage Contract

Coverage is capability-driven. A filename or extension never implies a successful parse by itself.

| Corpus family | Required local behavior |
|---|---|
| Supported code | Use a registered deterministic AST adapter for structural symbols and relationships. |
| Supported documentation | Extract only locally observable document structure, bounded non-code text units, and source references. |
| Supported SQL schemas | Extract only locally observable schema structure and relationships. |
| Supported configuration | Extract structural keys, sections, and non-secret references without executing the configuration. |
| Supported PDFs | Extract locally available text and document structure without remote OCR or model fallback. |
| Unsupported input | Return a bounded diagnostic and omit unsupported facts. |

Unknown languages, unavailable parsers, malformed or unreadable files, encrypted or image-only PDFs, unsupported syntax, and unresolved references must stay visible as unsupported or unresolved diagnostics. The runtime must not silently substitute an LLM, remote parser, embedding model, or guessed relationship.

## Every-Edge Explanation Contract

Every stored edge must be auditable from source-backed evidence:

- the edge identifies its relationship and direction
- its evidence identifies the source location and deterministic extraction basis
- its explanation states why that relationship exists without model-generated prose
- inferred or ambiguous resolution remains distinguishable from directly extracted structure
- supporting premises remain inspectable when an edge depends on other graph evidence
- missing or invalid evidence prevents the edge from being presented as authoritative

`knowgrph.knowledge_graph.explain_edge` reads this stored evidence. It does not recreate an explanation through a model or vector lookup.

## Query Contract

`knowgrph.knowledge_graph.query` uses lexical matching to select graph evidence and bounded graph traversal to expand it. Results retain edge direction, relationship labels, and source provenance.

The query path must:

- be deterministic for the same artifact and request
- honor runtime depth, result, and output bounds
- distinguish an empty match from an incomplete or unsupported result
- return evidence rather than an uncited synthesized answer
- make zero embedding, vector-store, model, and network calls

## Security Bounds

- Canonicalized source paths and resolved symlink targets remain inside the host-owned allowed root.
- Indexed content is parsed as data and is never executed as code, script, SQL, configuration, document action, or PDF behavior.
- Output remains inside the host-owned artifact boundary and must not present a partial or invalid run as complete.
- Canonical artifact hashing and replacement share a fixed 128 MiB ceiling; an oversized build fails before replacement and preserves the prior artifact.
- File, corpus, traversal, and output limits fail closed with explicit diagnostics.
- Configuration structure may be indexed, but secret values must not be returned as graph evidence.
- Source-controlled labels and evidence are sanitized before MCP output.
- The deterministic path makes no model call, network request, embedding request, or vector-store write.

## Honest Diagnostic Contract

| Condition | Required outcome |
|---|---|
| Root or symlink escape | Reject the request without reading the escaped target. |
| Unsupported parser or syntax | Identify the unsupported source or capability; do not guess. |
| Malformed, unreadable, encrypted, or image-only input | Return an explicit bounded diagnostic. |
| Unresolved relationship | Preserve the unresolved state or omit the edge; do not fabricate a target. |
| Missing graph artifact, node, or edge | Return a not-found diagnostic distinct from an empty successful query. |
| Runtime limit reached | Mark the result incomplete or rejected; do not imply full coverage. |
| Invalid edge evidence | Reject the authoritative edge explanation. |

## Acceptance and Validation

The runtime is ready only when all of the following hold:

- the local stdio inventory exposes the three declared knowledge-graph tool identities
- the `/`, `#`, and `@` mappings exactly match this contract
- supported code uses deterministic AST parsing and supported non-code inputs use deterministic structural extraction
- every returned edge has a source-backed deterministic explanation
- query uses lexical graph traversal with no vector store
- ingest, query, and explain make zero model and network calls
- path, symlink, secret, execution, size, traversal, and output bounds fail closed
- unsupported inputs and unresolved evidence return honest diagnostics
- Graphify is absent from package manifests, imports, subprocesses, runtime calls, vendored content, fixtures, tests, and generated assets

Documentation validation requires valid YAML frontmatter, `git diff --check`, and an authored-file length below 600 lines. Runtime implementation and tests remain owned by their existing code contracts; this document does not duplicate request schemas or test fixtures.

## Readiness Boundary

This contract proves only the local stdio knowledge-graph lane. It does not claim a Pages, Worker, Cloudflare, public HTTP, hosted MCP, browser WebMCP, vector, model, or cross-project graph service. Any future expansion requires a separate owner, threat model, acceptance gate, and explicit authorization.
