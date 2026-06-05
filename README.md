# Knowgrph

**Tagline:** What consensus misses, the graph finds.

Knowgrph is a MiroMindAI-enabled knowledge graph canvas for uncovering non-consensus investment signals, hidden alpha, and contrarian perspectives. It turns research coverage into an interactive canvas where nodes, clusters, and edges represent portfolio factors, market narratives, skew convergence signals, source evidence, and the relationships that ordinary linear notes miss.

The project is designed for investment research workflows that need to compare consensus views against graph-surfaced divergences. MiroMindAI integration supports research synthesis, graph-aware chat, structured KGC generation, and source-linked reasoning across portfolio themes, risk factors, catalysts, scenarios, and evidence trails.

Knowgrph is a research and analysis workspace, not financial advice.

## Research Model

Knowgrph treats investment research as a connected system:

- **Nodes** represent companies, sectors, assets, macro variables, events, narratives, portfolio exposures, claims, and source documents.
- **Clusters** group related themes such as factor regimes, policy shocks, liquidity conditions, supply-chain constraints, sentiment pockets, or catalyst windows.
- **Edges** encode causal, evidential, temporal, contrarian, convergence, divergence, and dependency relationships.
- **Signals** capture non-consensus patterns such as skew convergence, factor crowding, valuation dislocation, cross-asset inconsistency, narrative fatigue, and hidden alpha candidates.
- **Canvas views** let researchers move between markdown source files, graph structure, rich media panels, timeline views, and AI-assisted synthesis without breaking source provenance.

## MiroMindAI Integration

MiroMindAI is used as an AI research layer over the workspace rather than a replacement for the graph. The expected flow is:

1. Select source files, nodes, clusters, or workspace context.
2. Ask MiroMindAI to synthesize, challenge, extend, or structure the research.
3. Store the response as canonical Source Files artifacts such as KGC markdown, chat logs, traces, and companion outputs.
4. Project structured responses back into the graph canvas through shared Source Files and workspace-import owners.
5. Keep provider keys server-managed where possible; never commit API keys or secrets.

Cloudflare Pages and Worker environments can expose server-managed MiroMindAI access through `MIROMIND_API_KEY`. Local development can use the same provider contract through the app settings and runtime proxy path.

## Repository Role

This repository is the Dev source of truth:

```text
Dev:  /Users/huijoohwee/Documents/GitHub/knowgrph
Prod: /Users/huijoohwee/Documents/GitHub/huijoohwee/content/knowgrph
Live: https://airvio.co/knowgrph
```

Prod sync and Cloudflare deployment are explicit operator actions. Normal implementation, testing, and documentation work should stay in Dev until publish or deploy is requested.

## Workspace Surfaces

| Surface | Purpose |
| --- | --- |
| Source Files | Canonical markdown, JSON, binary metadata, generated KGC, chat logs, traces, and research documents. |
| Graph Canvas | Visual exploration of nodes, clusters, edges, layouts, rich media panels, and derived research structures. |
| Floating Panel Chat | MiroMindAI-enabled research assistant with workspace, selection, and source-aware context. |
| MainPanel Integrations | Provider, endpoint, model, auth-mode, storage, and runtime configuration. |
| Flow Editor | Structured graph, media, workflow, and diagram editing over source-backed documents. |
| Cloudflare Runtime | Pages, Workers, D1, R2, and server-managed provider secrets for hosted operation. |

## Repo Layout

| Path | Purpose |
| --- | --- |
| `canvas/` | Vite/React app, editor workspace, Source Files, graph canvas, Flow Editor, MainPanel, chat UI, and focused tests. |
| `knowgrph_parser/` | Python parser and command-line tooling for markdown, GraphRAG, webpage, video, and workflow artifacts. |
| `grph-shared/` | Runtime-neutral TypeScript contracts for storage, rich media, markdown, payments, browser helpers, cache, and geometry. |
| `gympgrph/` | Geospatial package consumed by the canvas app. |
| `cloudflare/` | Pages handlers, Workers, storage routes, D1 migrations, and R2-backed binary storage paths. |
| `mcp/` | Local MCP contracts and service documentation. |
| `data/config/` | Canonical config inputs for GraphRAG, schema, orchestrator, and LLM chat boundaries. |
| `docs/documents/` | Authored product, API, architecture, and feature documents. |
| `scripts/` | Repo checks, sync helpers, docs generation, storage seeding, payment readiness, and release tooling. |

## Setup

```bash
npm install
npm run setup
```

Prepare linked packages directly when working inside the canvas app:

```bash
npm --prefix canvas run prepare:linked-packages
```

## Local Development

```bash
npm run dev -- --host 127.0.0.1
```

Use focused checks for the behavior being changed:

```bash
npm --prefix canvas run test:ci:unit -- <test-name-or-filter>
npm --prefix canvas run typecheck
npm --prefix canvas run check
npm --prefix canvas run doc:sanity
npm run api-index:check
python3 -m knowgrph_parser.webpage_cmd_test
```

Avoid broad test, publish, deploy, or remote mutation commands unless the current task requires them.

## Build, Publish, Deploy

Local build:

```bash
npm run build
```

Publish mirror build and sync:

```bash
npm run pages:build-sync
npm run pages:check-sync
```

Cloudflare deployment:

```bash
npm run pages:deploy-cloudflare
```

Run Cloudflare deployment, D1 mutation, R2 mutation, or production publish commands only after explicit operator instruction.

## Storage And Source Authority

Source Files are the workspace contract. Git-backed authored docs remain the source of truth for repo documents; hosted storage mirrors and generated artifacts must preserve path identity instead of inventing parallel files.

- Keep GitHub-authored docs authoritative first.
- Use D1 and public storage routes as hosted mirrors and runtime indexes.
- Use R2 for binary artifacts and companion outputs that do not belong inline in markdown.
- Keep generated KGC, chat logs, traces, and output manifests source-file addressable.
- Do not hardcode provider, path, route, or demo-specific behavior downstream when a shared Source Files or storage owner should handle it upstream.

## Config And Generated Artifacts

Canonical config roots live under `data/config/`:

```text
data/config/graphrag/
data/config/llm-chat/
data/config/orchestrator/
data/config/schema/
```

Generated and local runtime outputs should stay ignored:

```text
.knowgrph-workspace/
data/outputs/
.wrangler/
*.tsbuildinfo
canvas/artifacts/live-verification/
canvas/.tmp-*
canvas/tmp-*
canvas/tmp_*
logs/
```

Do not commit local screenshots, transient previews, duplicate root-level config, local workspace notes, or runtime artifacts unless a specific test fixture contract requires a bounded source artifact.

## Feature Docs

Feature-specific planning belongs in canonical docs instead of the root README:

| Feature | Docs |
| --- | --- |
| MiroMindAI | `docs/documents/knowgrph-api-reference/knowgrph-miromind-api-prd-tad.md` |
| MCP | `docs/documents/knowgrph-mcp/` and `mcp/README.md` |
| Storage sync | `docs/documents/knowgrph-storage-sync-document.companion.md` |
| Stryfork | `docs/documents/knowgrph-stryfork-prd-tad.md` |
| Strybldr | `docs/documents/knowgrph-strybldr-prd-tad.md` |
| Strytree | `docs/documents/knowgrph-strytree-prd-tad.md` |
| Repo hygiene | `docs/documents/knowgrph-repo-hygiene-document.md` |
| Payment readiness | `docs/documents/knowgrph-mainpanel-commerce-prd-tad.md` |

## Hygiene Rules

- Fix root/source owners instead of layering downstream aliases, remaps, or compatibility shims.
- Keep MiroMindAI, storage, graph, and Source Files behavior provider-neutral and file-agnostic where possible.
- Reuse shared helpers, semantic keys, and workspace contracts instead of hardcoded repo, file, route, or demo branches.
- Preserve source provenance for generated research artifacts.
- Keep secrets out of source and use server-managed environment bindings for hosted provider keys.
- Keep Dev as the implementation source; publish mirror and Cloudflare outputs are generated from Dev.
