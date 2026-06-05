# Knowgrph

Knowgrph is the Dev source repo for the canvas, parser, storage, payment, MCP, and documentation surfaces that publish to:

```text
Dev:  /Users/huijoohwee/Documents/GitHub/knowgrph
Prod: /Users/huijoohwee/Documents/GitHub/huijoohwee/content/knowgrph
Live: https://airvio.co/knowgrph
```

Prod and Cloudflare deploys are explicit operator actions. Normal development work should stay in this repo until publish/deploy is requested.

## Repo Layout

| Path | Purpose |
| --- | --- |
| `canvas/` | Vite/React app, editor workspace, Flow Editor, MainPanel, tests, and UI docs generation. |
| `knowgrph_parser/` | Python parser and superagent CLIs for markdown, GraphRAG, webpage, video, and workflow artifacts. |
| `grph-shared/` | Shared TypeScript contracts for UI, payments, rich media, markdown, browser, cache, and geometry helpers. |
| `gympgrph/` | Geospatial package consumed by the canvas app. |
| `cloudflare/` | Workers, Pages handlers, and D1 migrations. |
| `mcp/` | Local MCP contract and service docs. |
| `data/config/` | Canonical config inputs for GraphRAG, schema, orchestrator, and LLM chat boundaries. |
| `docs/documents/` | Canonical authored docs. Generated previews belong under ignored `data/outputs/`. |
| `scripts/` | Repo-level checks, sync helpers, payment readiness, docs generation, and release tooling. |

## Setup

```bash
npm install
npm run setup
```

The canvas app prepares linked packages before dev/build/check commands. For direct package work:

```bash
npm --prefix canvas run prepare:linked-packages
```

## Local Development

```bash
npm run dev -- --host 127.0.0.1
```

Common focused commands:

```bash
npm --prefix canvas run doc:sanity
npm --prefix canvas run check
npm --prefix canvas run test:ci:unit -- <test-name-or-filter>
npm run api-index:check
python3 -m knowgrph_parser.webpage_cmd_test
```

Use focused tests for the files or behavior being changed. Avoid broad deploy, publish, or full-suite commands unless they are needed for the current change.

## Build And Publish

Local build:

```bash
npm run build
```

Publish mirror build/sync:

```bash
npm run pages:build-sync
npm run pages:check-sync
```

Cloudflare deployment is intentionally separate:

```bash
npm run pages:deploy-cloudflare
```

Run Cloudflare or remote D1 mutation commands only when explicitly authorized.

## Config And Artifacts

Config roots are consolidated under `data/config/`:

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
canvas/=
canvas/B,
canvas/{
{target}
logs/
```

Do not reintroduce root-level config duplicates, generated preview snapshots, `.trae/` workspace notes, or local verification screenshots as tracked source.

## Feature Docs

Feature-specific planning lives in canonical docs, not in the root README:

| Feature | Docs |
| --- | --- |
| Stryfork | `docs/documents/knowgrph-stryfork-prd-tad.md` |
| Strybldr | `docs/documents/knowgrph-strybldr-prd-tad.md` |
| Strytree | `docs/documents/knowgrph-strytree-prd-tad.md` |
| MCP | `docs/documents/knowgrph-mcp/` and `mcp/README.md` |
| Repo hygiene | `docs/documents/knowgrph-repo-hygiene-document.md` |
| Payment readiness | `docs/documents/knowgrph-mainpanel-commerce-prd-tad.md` and `docs/documents/knowgrph-api-reference/knowgrph-stripe-api-reference.md` |

## Hygiene Rules

- Fix root/source owners instead of adding downstream aliases or compatibility remaps.
- Keep generated artifacts out of tracked source unless a specific source contract requires a bounded fixture.
- Prefer shared helpers and semantic keys over hardcoded file, route, or repo-specific branches.
- Keep Dev as the source of truth; publish mirror and Cloudflare outputs are generated/deployed from Dev.
