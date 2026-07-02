# Agentic Canvas

**Tagline:** The canvas that runs document like a program

Knowgrph is an **AI/LLM-agent-native, markdown-based, self-runnable agentic
widget canvas**. A Knowgrph document is plain Markdown with a typed YAML
frontmatter flow: nodes are **widgets** (input, compute, rich-media panels),
edges are typed **sockets**, and the whole document renders as an interactive
canvas that an agent — or a human — can **run, gate, persist, and replay**.

The same file is three things at once:

- a **human-readable Markdown doc** (read it in any editor or on the web),
- a **typed widget graph** (`kgc-computing-flow/v1` frontmatter — nodes, edges,
  sockets, run actions), and
- a **runnable agent program** (compute nodes, approval gates, budget meters,
  and media outputs that an LLM/MCP agent can execute end to end).

Knowgrph is provider-neutral and project-agnostic: it operates on any brief,
canvas graph, tool schema, or media provider without assuming a particular
vendor, document, or domain.

## What "self-runnable agentic widget canvas" means

- **Markdown-native.** The source of truth is a Markdown file. Its YAML
  frontmatter declares the flow (`flow.nodes[]`, `flow.edges[]`, `socket_types`,
  `modelSelection`) so the document is parseable, diffable, and version-control
  friendly — no proprietary binary scene format.
- **Widget canvas.** Nodes are typed widgets — `InputWidget`, `ComputeWidget`,
  `RichMediaPanel` (text, image, video) — laid out on a balanced, mobile-first
  canvas with readable, socket-typed edges.
- **Self-runnable.** Compute widgets carry a `canvas:runAction` (pure,
  inspectable functions) so a node can run from a button, a chat instruction, an
  MCP tool call, or a CLI/Codex entrypoint and write its outputs back into the
  same document.
- **Agent-native.** Agents reach the canvas over **MCP** (`airvio.co/knowgrph/mcp`),
  through the Floating Panel chat, or via the parser CLI/Codex. Every model call
  routes through **Cloudflare AI Gateway**; every spend boundary is gated by a
  single-use Approval_Token.
- **Gated, persisted, replayable.** Runs are dry-run by default; live spend halts
  at the first un-approved gate with zero paid actions. Outputs auto-save to
  Cloudflare (document → D1, media bytes → R2) and replay from storage with no
  further model call.

## The runnable document model

A Knowgrph document's frontmatter flow is the program. Minimal shape:

```yaml
---
schema: "kgc-computing-flow/v1"
kgCanvas2dRenderer: "storyboard"
socket_types:
  idea_signal:     {color: "#14b8a6", accepts: [idea_signal]}
  artifact_signal: {color: "#8b5cf6", accepts: [artifact_signal]}
flow:
  nodes:
    - id: {value: "source_input"}      # InputWidget  — typed inputs
    - id: {value: "compute_summary"}   # ComputeWidget — canvas:runAction
    - id: {value: "panel_image"}       # RichMediaPanel — image
    - id: {value: "panel_video"}       # RichMediaPanel — video
  edges:
    - {source: "source_input", target: "compute_summary", type: "idea_signal"}
    - {source: "compute_summary", target: "panel_image",  type: "artifact_signal"}
    - {source: "compute_summary", target: "panel_video",  type: "artifact_signal"}
---

# Body markdown renders alongside the canvas.
```

- **Nodes** carry typed handles, a `canvas:widgetCard` (preview + actions), and,
  for compute nodes, a `canvas:runAction` describing inputs, outputs, and side
  effects.
- **Edges** connect source/target handles with a declared `socket_type`, so the
  canvas can validate and route connections.
- **Run** a compute node and its outputs (text, image, video, dashboards) flow
  to the connected `RichMediaPanel` widgets and persist to storage.

## Agent + automation surfaces

| Surface | How an agent uses it |
| --- | --- |
| MCP (`airvio.co/knowgrph/mcp`) | Streamable-HTTP tool surface; list/call canvas tools, run flows, read back manifests. |
| Floating Panel Chat | In-canvas assistant with workspace, selection, and source-aware context. |
| Parser CLI / Codex | Run documents headlessly from the `knowgrph_parser` CLI or a Codex entrypoint. |
| Cloudflare AI Gateway | All model/media calls (chat, image, video) route here for cache, token count, fallback, and unified billing. |

Baseline runs are provable **offline with deterministic mock providers**; real
providers (e.g. BytePlus/ModelArk for chat, `seedream` image, `seedance` video)
activate only when their keys are wired and the matching gate is approved.

## Quick start: run a document

Execute a Knowgrph canvas document headlessly with the `knowgrph_parser` CLI.
The default provider mode is a deterministic **mock** — zero network, zero paid
calls — so this runs offline out of the box:

```bash
python3 -m knowgrph_parser run-goal \
  --input docs/documents/your-canvas-doc.md \
  --goal-file goal \
  --output-dir data/outputs/my-run \
  --run-id my-run \
  --print-summary
```

This writes the run to the output dir:

```text
data/outputs/my-run/
  state.json          # resumable run state
  trace.jsonl         # step-by-step execution trace
  final-report.md     # human-readable run report
  harness-proof.json  # verification manifest
  artifacts/          # generated text/image/video/canvas artifacts
```

Useful flags:

- `--provider-mode mock|pixverse` — `mock` (default, offline) or `pixverse` for
  live media (falls back to mock when unavailable).
- `--resume` — resume from `output-dir/state.json`.
- `--stop-after-step N` — checkpoint after N tasks, then stop (interruptible).
- `--fail-once <tool>` — inject one bounded failure for a tool (recovery testing).
- `--max-steps` / `--max-retries` / `--max-wall-seconds` — run budgets.

Convenience wrapper (uses the neutral fixture brief):

```bash
npm run goal:run
```

## Repository Role

This repository is the Dev source of truth:

```text
Dev:  /Users/huijoohwee/Documents/GitHub/knowgrph
Prod: /Users/huijoohwee/Documents/GitHub/huijoohwee/content/knowgrph
Live: https://airvio.co/knowgrph
```

Prod sync and Cloudflare deployment are explicit operator actions. Normal
implementation, testing, and documentation work should stay in Dev until publish
or deploy is requested.

## Workspace Surfaces

| Surface | Purpose |
| --- | --- |
| Source Files | Canonical Markdown documents (the runnable canvases), JSON, binary metadata, generated KGC, chat logs, traces. |
| Graph Canvas | Visual exploration + execution of the widget flow: nodes, edges, rich-media panels, layouts. |
| Floating Panel Chat | Agent-native assistant with workspace, selection, and source-aware context. |
| MainPanel Integrations | Provider, endpoint, model, auth-mode, storage, and runtime configuration. |
| Storyboard Widget | Structured widget/graph/media/workflow editing over source-backed Markdown documents. |
| Cloudflare Runtime | Pages, Workers (`McpAgent`), D1, R2, AI Gateway, and server-managed provider secrets. |

## Repo Layout

| Path | Purpose |
| --- | --- |
| `canvas/` | Vite/React app, editor workspace, Source Files, graph canvas, Storyboard Widget, MainPanel, chat UI, and focused tests. |
| `knowgrph_parser/` | Python parser and command-line tooling for markdown, GraphRAG, webpage, video, and workflow artifacts. |
| `grph-shared/` | Runtime-neutral TypeScript contracts for storage, rich media, markdown, payments, browser helpers, cache, and geometry. |
| `gympgrph/` | Geospatial package consumed by the canvas app. |
| `cloudflare/` | Pages handlers, Workers (incl. the `knowgrph-mcp` `McpAgent`), storage routes, D1 migrations, and R2-backed binary storage. |
| `mcp/` | MCP contracts, the video-remix agent runtime, and service documentation. |
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

Avoid broad test, publish, deploy, or remote mutation commands unless the current
task requires them.

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

Cloudflare deployment (Pages + Workers + `McpAgent`):

```bash
npm run pages:deploy-cloudflare
npm run mcp:worker:deploy
```

Run Cloudflare deployment, D1 mutation, R2 mutation, or production publish
commands only after explicit operator instruction.

## Storage And Source Authority

Source Files are the workspace contract. Git-backed authored Markdown documents
remain the source of truth; hosted storage mirrors and generated artifacts must
preserve path identity instead of inventing parallel files.

- Keep GitHub-authored docs authoritative first.
- Use D1 and public storage routes as hosted mirrors and runtime indexes.
- Use R2 for binary artifacts (generated image/video) and companion outputs that
  do not belong inline in markdown. Persist media bytes to R2 on generate and
  store the durable R2 URL; never store an ephemeral provider URL as the artifact.
- Keep generated KGC, chat logs, traces, and output manifests source-file
  addressable.
- Do not hardcode provider, path, route, or demo-specific behavior downstream
  when a shared Source Files or storage owner should handle it upstream.

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

Do not commit local screenshots, transient previews, duplicate root-level config,
local workspace notes, or runtime artifacts unless a specific test fixture
contract requires a bounded source artifact.

## Feature Docs

Feature-specific planning belongs in canonical docs instead of the root README:

| Feature | Docs |
| --- | --- |
| Agentic Canvas OS demo | `docs/documents/knowgrph-mcp-agentic-canvas-os-prd-tad.md` |
| AI provider layer (MiroMindAI) | `docs/documents/knowgrph-api-reference/knowgrph-miromind-api-prd-tad.md` |
| MCP | `docs/documents/knowgrph-mcp/` and `mcp/README.md` |
| Storage sync | `docs/documents/knowgrph-storage-sync-document.companion.md` |
| Strybldr | `docs/documents/knowgrph-strybldr-prd-tad.md` |
| Strybldr | `docs/documents/knowgrph-strybldr-prd-tad.md` |
| Strytree | `docs/documents/knowgrph-strytree-prd-tad.md` |
| Repo hygiene | `docs/documents/knowgrph-repo-hygiene-document.md` |
| Payment readiness | `docs/documents/knowgrph-mainpanel-commerce-prd-tad.md` |

## Hygiene Rules

- Fix root/source owners instead of layering downstream aliases, remaps, or
  compatibility shims.
- Keep the AI/agent layer, storage, graph, and Source Files behavior
  provider-neutral and file-agnostic where possible.
- Reuse shared helpers, semantic keys, and workspace contracts instead of
  hardcoded repo, file, route, or demo branches.
- Preserve source provenance for generated artifacts (link them to the goal,
  brief, plan, tool calls, and verification checks).
- Keep secrets out of source and use server-managed environment bindings for
  hosted provider keys.
- Keep Dev as the implementation source; publish mirror and Cloudflare outputs
  are generated from Dev.
