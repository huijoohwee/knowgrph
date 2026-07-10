# Knowgrph — Agentic Canvas

**The canvas that runs a document like a program.**

Knowgrph is an **AI/LLM-agent-native, markdown-based, self-runnable agentic widget canvas**. A Knowgrph document is plain Markdown with a typed YAML frontmatter flow: nodes are **widgets** (input, compute, rich-media panels), edges are typed **sockets**, and the whole document renders as an interactive canvas that an agent — or a human — can **run, gate, persist, and replay**.

The same file is three things at once:

- a **human-readable Markdown doc** (read it in any editor or on the web),
- a **typed widget graph** (`kgc-computing-flow/v1` frontmatter — nodes, edges, sockets, run actions), and
- a **runnable agent program** (compute nodes, approval gates, budget meters, and media outputs that an LLM/MCP agent can execute end to end).

Knowgrph is provider-neutral and project-agnostic: it operates on any brief, canvas graph, tool schema, or media provider without assuming a particular vendor, document, or domain.

## Why Knowgrph exists

Most agent frameworks separate "the agent's memory" from "the knowledge the human actually owns." That split creates two problems:

- **Vendor lock-in on state**: an agent's reasoning trail lives in a proprietary checkpointer or scene format you can't easily inspect, diff, or version.
- **Knowledge that agents can't operate on**: docs, notes, and diagrams sit in formats agents can read but not meaningfully edit, run, or extend.

Knowgrph closes that gap with **KGC (Knowledge Graph Canvas) markdown** — computing-flow-style KTV (`{key, type, value}`) frontmatter rows for graph-level fields, nodes, and widget metadata, with `flow.edges[]` as explicit, source-owned socket links. A plain markdown file *is* the graph, the audit trail, the human-readable doc, and the runnable program, all at once. Git is the provenance layer, for free.

> If you've used LangGraph, AutoGPT, or a Notion/Obsidian-style knowledge base and wished they were the same system — this is aimed at that gap.

## Where Knowgrph sits

Infinite-canvas tools split roughly into three tiers today:

- **Drawing surfaces** — Excalidraw, tldraw, FigJam, Miro. The canvas stores shapes and strokes; it doesn't understand them. Agents can *draw on* these canvases (via MCP servers, tldraw's Agent Starter Kit, Excalidraw skills), but a box is a box, not a node with meaning.
- **Knowledge surfaces** — Obsidian Canvas, Heptabase, Scrintal. Cards are real notes with links, backlinks, and tags. The canvas understands the cards as knowledge, but agent-write access is bolted on, not native, and state often lives outside a plain, git-diffable file.
- **Thinking surfaces** — Storyflow and similar. An AI reads the full board as context and reasons over structured cards. Closer to what Knowgrph does, but cloud-hosted, proprietary storage, no git-native provenance.

**Knowgrph is a fourth thing**: the canvas *is* a git-versioned, typed widget graph — not a UI layer sitting on top of one. There's no export step, no sync job, no proprietary board format underneath. A KGC markdown file committed to git *is* the node/edge data, the audit trail, and the thing an agent reads, runs, and rewrites — all in one artifact.

| | Knowgrph | Excalidraw / tldraw | Obsidian Canvas | Storyflow-style thinking canvas | LangGraph (raw) |
|---|---|---|---|---|---|
| Canvas understands content as a typed graph, not just shapes | ✅ | ❌ | ✅ | ✅ | N/A |
| State is plain, git-diffable markdown | ✅ | ❌ (JSON canvas format) | Partial (JSON Canvas + linked notes) | ❌ (cloud/proprietary) | ❌ (checkpointer) |
| Nodes are runnable (compute, gate, persist, replay), not just static shapes | ✅ | ❌ | ❌ | Partial | ✅ (state), ❌ (no canvas) |
| Agent read/write/run is native to the file format | ✅ | ❌ (MCP/skills layer on top) | ❌ | ✅ (but closed) | ✅ (state only) |
| FOSS, provider-neutral, project-agnostic | ✅ | ✅ (Excalidraw) / ✅ (tldraw core) | ❌ (Obsidian core is proprietary) | ❌ | ✅ |
| Git is the native provenance/audit layer | ✅ | ❌ | ❌ | ❌ | ❌ |

**The honest tradeoff:** Excalidraw and tldraw have years of polish on the actual drawing/sketching experience — Knowgrph doesn't try to compete there. What Knowgrph optimizes for is the layer underneath: a graph an agent can actually own, run, and version for free in a tool already on every machine — git.

## What "self-runnable agentic widget canvas" means

- **Markdown-native.** The source of truth is a Markdown file. Its YAML frontmatter declares the flow (`flow.nodes[]`, `flow.edges[]`, `socket_types`, `modelSelection`) with computing-flow-style KTV rows so the document is parseable, diffable, and version-control friendly — no proprietary binary scene format.
- **Widget canvas.** Nodes are typed widgets — `InputWidget`, `ComputeWidget`, `RichMediaPanel` (text, image, video) — laid out on a balanced, mobile-first canvas with readable, socket-typed edges.
- **Self-runnable.** Compute widgets carry a `canvas:runAction` (pure, inspectable functions) so a node can run from a button, a chat instruction, an MCP tool call, or a CLI/Codex entrypoint and write its outputs back into the same document.
- **Storyboard-projectable.** A frontmatter-owned 2D Storyboard can use source, ideation, invocation, projection, validation, and deploy-guard nodes to create cards, reusable elements, rich-media panels, and timeline lanes without hardcoded provider artifacts.
- **Agent-native.** Agents reach the canvas through local stdio MCP (`mcp/server.js`), read-only Pages HTTP MCP where deployed, Browser WebMCP, FloatingPanel Chat, or parser CLI/Codex entrypoints. Model or media calls are host-owned runtime decisions; paid, mutating, browser-auth, terminal, filesystem, egress, and deploy actions stay approval-gated.
- **Gated, persisted, replayable.** Runs are dry-run first; live spend halts at the first unapproved gate with zero paid actions. Outputs persist through the active Source Files, workspace, local artifact, or Cloudflare storage owner for the current lane.

## The runnable document model

A Knowgrph document's frontmatter flow is the program. Minimal shape:

```yaml
---
schema: "kgc-computing-flow/v1"
kgCanvas2dRenderer: "storyboard"
socket_types:
  idea_signal: {color: "#14b8a6", edgeWidthPx: 2, handleStrokeWidthPx: 2, accepts: [idea_signal]}
  artifact_signal: {color: "#8b5cf6", edgeWidthPx: 3, handleStrokeWidthPx: 3, accepts: [artifact_signal]}
flow:
  direction: {key: direction, type: string, value: "LR"}
  edgeType: {key: edgeType, type: string, value: "smoothstep"}
  balancedViewportPreset: {key: balancedViewportPreset, type: string, value: "widgetFrontmatter"}
  computed: {key: computed, type: boolean, value: true}
  snapToGrid: {key: snapToGrid, type: boolean, value: true}
  nodes:
    - id: {key: id, type: string, value: "source_input"}
      type: {key: type, type: string, value: "InputWidget"}
      label: {key: label, type: string, value: "Source Input"}
      handles: {key: handles, type: object, value: {"source":["idea"]}}
      "flow:portTypes": {key: "flow:portTypes", type: object, value: {"out":{"idea":"idea_signal"}}}
    - id: {key: id, type: string, value: "compute_summary"}
      type: {key: type, type: string, value: "ComputeWidget"}
      label: {key: label, type: string, value: "Compute Summary"}
      handles: {key: handles, type: object, value: {"target":["idea"],"source":["artifact"]}}
      "flow:portTypes": {key: "flow:portTypes", type: object, value: {"in":{"idea":"idea_signal"},"out":{"artifact":"artifact_signal"}}}
  edges:
    - {"id":"edge_source_to_compute","source":"source_input","sourceHandle":"idea","target":"compute_summary","targetHandle":"idea","type":"idea_signal"}
---

# Body markdown renders alongside the canvas.
```

- **Nodes** carry KTV fields, typed handles, a `canvas:widgetCard` (preview + actions), and, for compute nodes, a `canvas:runAction` describing inputs, outputs, and side effects.
- **Edges** connect source/target handles with a declared `socket_type`, so the canvas can validate and route connections.
- **Run** a compute node and its outputs (text, image, video, dashboards) flow to the connected `RichMediaPanel` widgets and persist to storage.
- **Project** a 2D Storyboard from frontmatter using the shared renderer contract: `flow.nodes[]` and `flow.edges[]` stay the source-owned SSOT, while Cards, Widgets, Rich Media Panels, BottomPanel Timeline, Gantt, and flowchart views render as projections.

## Agentic Canvas OS

Knowgrph is the Dev source for an **Agentic Canvas OS**: a local-first control plane where Markdown, KTV YAML frontmatter, Source Files, Canvas, chat, and MCP expose the same typed runtime state. The sibling `agentic-canvas-os/docs` tree is the current documentation control surface for this OS contract, defining the shared `/`, `#`, and `@` invocation dictionaries, runtime-readiness gates, MCP gateway rules, harness contracts, KTV computing-flow shape, and proof ledger.

The runtime direction:

- `/` commands describe bounded actions such as `/mcp.capabilities`, `/tool.catalog`, `/tool.route`, `/computing-flow`, `/superagent.run`, and `/runtime-ready.check`.
- `#` semantics scope intent, proof, and cost filters such as `#mcp`, `#tool-gateway`, `#computing-flow`, `#runtime-ready`, and `#long-horizon-harness`.
- `@` bindings name the source or runtime surface, e.g. `@source.frontmatter`, `@source.body`, `@mcp-gateway`, `@tool-policy`, `@sandbox-workspace`, and `@message-gateway`.
- MainPanel MCP shows readiness and non-secret setup metadata. It does not execute tools or store credentials in browser settings.
- MainPanel readiness claims distinguish `documented`, `browser-published`, and `runtime-executable` states so doc guidance, browser snapshots, and executable MCP owners don't drift into one label.
- FloatingPanel Chat and KGC keep source-backed runtime materialization on the existing Markdown → KTV frontmatter → Canvas path.
- Local MCP, Pages HTTP MCP, Browser WebMCP, and approved Cloudflare control-plane owners are separate surfaces with explicit transport boundaries.

This README describes the Dev repo. `agentic-canvas-os/docs` remains docs-control runtime proof only; Prod mirror and Cloudflare state stay gated until the operator explicitly opens those lanes.

### 2D Renderer: Storyboard template

The canonical neutral Storyboard seed sets `kgCanvasSurfaceMode: "2d"`, `kgCanvasRenderMode: "2d"`, and `kgCanvas2dRenderer: "storyboard"` so a source document can project into Cards, Widgets, Rich Media Panels, and BottomPanel Timeline without moving ownership out of frontmatter.

Its `flow` uses KTV rows for `direction`, `edgeType`, `balancedViewportPreset`, `computed`, `snapToGrid`, every node id/type/label, handles, port types, and runtime invocation fields. `socket_types` owns the allowed edge/port vocabulary, and every `flow.edges[]` entry references a declared socket type.

That template is intentionally local-first:

- runtime outputs start blank until an operator-approved local or live run returns evidence;
- `paid_call_count` starts at `0`;
- `source_url`, provider job ids, stream URLs, generated asset URLs, and runtime proof paths stay operator-supplied or runtime-generated;
- Prod mirror and Cloudflare are blocked until explicit instruction;
- Storyboard projection is view state only: authored frontmatter and source payloads own data, while visible connectors are projections of `flow.edges`;
- semantic HTML projection should use landmarks such as `main`, `section`, `article`, `header`, `nav`, `aside`, `figure`, `figcaption`, and `table` before falling back to generic layout wrappers.

The template's local runtime lane is source → ideation → invocation → Storyboard projection → runtime validation → deploy guard. In invocation grammar: `/source.normalize`, `/memory.seed`, `/harness.define`, `/canvas.project`, `/runtime-ready.check`, `/validation.run`, `/deploy.guard`, with `#frontmatter`, `#harness`, `#runtime-ready`, `#canvas`, `#approval-gate`, `#dev-only`, `@source.frontmatter`, `@source.body`, `@local-harness`, `@runtime-proof`, `@cost-log`, `@canvas`, `@operator`, `@dev-only`.

## Agent + automation surfaces

| Surface | How an agent uses it |
| --- | --- |
| Local stdio MCP (`mcp/server.js`) | Starts from an external MCP client and exposes Knowgrph-owned local tools: Source Files search/fetch, UI launch, pipelines, memory, probe tree, showrunner, OS status, SuperAgent, video remix, browser bridge, HTML video, annotation, and vdeoxpln inspection. |
| MainPanel MCP | Browser-local readiness and non-secret setup view for Knowgrph-owned and external MCP tool servers. |
| FloatingPanel Chat | In-canvas assistant with workspace, selection, invocation grammar, KGC generation, and source-aware context. |
| 2D Renderer: Storyboard | Projects frontmatter-owned source, ideation, invocation, runtime, review, and publish lanes into Cards, Widgets, Rich Media Panels, and timeline views. |
| Browser WebMCP | Browser-local read and inspection tools for Apps/WebMCP-capable hosts. |
| Pages HTTP MCP | Read-only published Source Files `search` / `fetch` surface where deployed. |
| Parser CLI / Codex | Run documents and harnesses headlessly from `knowgrph_parser` or Codex entrypoints. |
| Cloudflare control plane | Pages, Workers, D1, R2, AI Gateway, and payment/runtime owners when an explicit deploy lane is open. |

## MCP-compatible LLM readiness

MCP-compatible LLM hosts are ready to use Knowgrph today through the shipped public discovery and control-plane surfaces. The repo currently ships explicit setup and readiness contracts for ChatGPT/OpenAI Apps, Claude, Qwen Code, Kimi CLI, BytePlus ModelArk, and generic MCP clients that can talk to MCP over stdio or Streamable HTTP.

For the canonical third-party install boundary, host recipes, and the explicit public-discovery vs control-plane split, see [`docs/documents/knowgrph-mcp-install-contract.md`](docs/documents/knowgrph-mcp-install-contract.md). For the one-page onboarding path that also links the release note, agent-ready doc, and MCP overview, see [`docs/documents/knowgrph-mcp-onboarding-index.md`](docs/documents/knowgrph-mcp-onboarding-index.md).

**Current topology**

| Surface | Endpoint | Role | Status |
| --- | --- | --- | --- |
| Public discovery | `https://airvio.co/knowgrph/mcp` | Canonical public install and discovery endpoint; read-only retrieval, prompt discovery, resource discovery, and inspection | Shipped |
| Control plane | `https://airvio.co/knowgrph/control-plane/mcp` | Approval-gated orchestration endpoint; exposes `knowgrph.agentic_canvas_os.docs.invoke` for live remote `/`, `#`, and `@` grammar invocation | Shipped |
| Local stdio MCP | `mcp/server.js` | Repo-local MCP surface for hosts that want the same grammar tool and the richer local tool catalog without the remote control plane | Shipped |

An MCP-compatible LLM can install the public Knowgrph server for discovery and retrieval, then route grammar invocation to the control-plane MCP surface when it needs live `/`, `#`, and `@` resolution against the current Agentic Canvas OS documentation contract.

Baseline runs are provable **offline with deterministic mock providers**. Real providers activate only when host-owned keys are wired and the matching gate is approved.

For hosted app-builder platforms (Lovable, Vercel, and similar) that expect a network-reachable HTTP/SSE MCP endpoint rather than a spawned local process: the public discovery and control-plane endpoints above are that surface — point the platform's MCP integration at `https://airvio.co/knowgrph/mcp` for read-only discovery, or the control-plane URL for gated live invocation.

**MainPanel readiness states** — use one label per claim:

- `documented`: static setup or operator guidance exists, no browser or executable runtime proof implied
- `browser-published`: the browser publishes a runtime snapshot or inspection artifact for the claim
- `runtime-executable`: a local or remote runtime owner actually registers the tool, route, or action

Current repo truth:

- MainPanel Integrations is anchored to the broader Settings-backed provider universe; any demo or SuperAgent subset must be called out as scoped.
- MainPanel MCP can contain both browser-published rows and documented-only connection guidance.
- External bridge ids such as `knowgrph.tool.search`, `knowgrph.tool.describe`, and `knowgrph.tool.call` are planned contract targets, not current executable runtime owners.

Release-gate checklist and readiness rubric: `docs/documents/knowgrph-mainpanel-readiness-rubric.md`.

## Quick start: run a document

Execute a Knowgrph canvas document headlessly with the `knowgrph_parser` CLI. For a fully offline deterministic run, pass `--provider-mode mock`:

```bash
python3 -m knowgrph_parser run-goal \
  --input docs/documents/your-canvas-doc.md \
  --goal-file goal.md \
  --output-dir data/outputs/my-run \
  --run-id my-run \
  --provider-mode mock \
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

- `--provider-mode byteplus-modelark|mock` — `byteplus-modelark` (default, placeholder-backed media lane) or `mock` for deterministic offline runs.
- `--resume` — resume from `output-dir/state.json`.
- `--stop-after-step N` — checkpoint after N tasks, then stop (interruptible).
- `--fail-once <tool>` — inject one bounded failure for a tool (recovery testing).
- `--max-steps` / `--max-retries` / `--max-wall-seconds` — run budgets.

Convenience wrapper (uses the neutral fixture brief):

```bash
npm run goal:run
```

## Repository role

This repository is the Dev source of truth. Prod sync and Cloudflare deployment are explicit operator actions — normal implementation, testing, and documentation work stays in Dev until publish or deploy is requested. The live public surface is `https://airvio.co/knowgrph`.

## Workspace surfaces

| Surface | Purpose |
| --- | --- |
| Source Files | Canonical Markdown documents (the runnable canvases), JSON, binary metadata, generated KGC, chat logs, traces. |
| Graph Canvas | Visual exploration + execution of the widget flow: nodes, edges, rich-media panels, layouts. |
| Floating Panel Chat | Agent-native assistant with workspace, selection, and source-aware context. |
| MainPanel Integrations | Provider, endpoint, model, auth-mode, storage, and runtime configuration for the Settings-backed provider universe; any narrower subset must be labeled as scoped. |
| Storyboard Widget | Structured 2D renderer editing over source-backed Markdown documents: Cards, Widgets, Rich Media Panels, reusable elements, and timeline lanes. |
| MainPanel MCP | Readiness rows and connection templates for local stdio, read-only Pages HTTP, Browser WebMCP, and external MCP tool servers, labeled by `documented`, `browser-published`, or `runtime-executable` state. |
| Agentic OS docs | Sibling control surface for `/`, `#`, `@` route dictionaries, MCP gateway policy, harnesses, and runtime proof. |
| Cloudflare Runtime | Pages, Workers (`McpAgent`), D1, R2, AI Gateway, and server-managed provider secrets when deploy is explicitly opened. |

## Repo layout

| Path | Purpose |
| --- | --- |
| `canvas/` | Vite/React app, editor workspace, Source Files, graph canvas, Storyboard Widget, MainPanel, chat UI, and focused tests. |
| `knowgrph_parser/` | Python parser and command-line tooling for markdown, GraphRAG, webpage, video, and workflow artifacts. |
| `grph-shared/` | Runtime-neutral TypeScript contracts for storage, rich media, markdown, payments, browser helpers, cache, and geometry. |
| `gympgrph/` | Geospatial package consumed by the canvas app. |
| `cloudflare/` | Pages handlers, Workers (incl. the `knowgrph-mcp` `McpAgent`), storage routes, D1 migrations, and R2-backed binary storage. |
| `mcp/` | Local stdio MCP server, tool contracts, local runtimes, and service documentation. |
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

## Local development

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

## Build, publish, deploy

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

Run Cloudflare deployment, D1 mutation, R2 mutation, or production publish commands only after explicit operator instruction.

## Storage and source authority

Source Files are the workspace contract. Git-backed authored Markdown documents remain the source of truth; hosted storage mirrors and generated artifacts must preserve path identity instead of inventing parallel files.

- Keep GitHub-authored docs authoritative first.
- Use D1 and public storage routes as hosted mirrors and runtime indexes.
- Use R2 for binary artifacts (generated image/video) and companion outputs that do not belong inline in markdown. Persist media bytes to R2 on generate and store the durable R2 URL; never store an ephemeral provider URL as the artifact.
- Keep generated KGC, chat logs, traces, and output manifests source-file addressable.
- Use Launch → New .md for one-click authored Markdown creation under `/docs`; the action must reuse the shared Source Files creator and workspace timestamp helpers, then synchronously persist the blank file through the docs mirror instead of a toolbar-local file path.
- Do not hardcode provider, path, route, or demo-specific behavior downstream when a shared Source Files or storage owner should handle it upstream.

## Config and generated artifacts

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

## Feature docs

Feature-specific planning belongs in canonical docs instead of the root README:

| Feature | Docs |
| --- | --- |
| Agentic Canvas OS control surface | `../agentic-canvas-os/docs/` |
| Current startup priorities | `docs/documents/knowgrph-next-step-priorities.md` |
| 2D Renderer Storyboard template | `../huijoohwee.github.io/template/knowgrph-2d-renderer-storyboard-template.md` |
| Agentic Canvas OS PRD/TAD | `docs/documents/knowgrph-mcp/knowgrph-mcp-agentic-os-prd-tad.md` |
| AI provider layer (MiroMindAI) | `docs/documents/knowgrph-api-reference/knowgrph-miromind-api-prd-tad.md` |
| MCP | `docs/documents/knowgrph-mcp/` and `mcp/README.md` |
| Storage sync | `docs/documents/knowgrph-storage-sync-document.companion.md` |
| Strybldr | `docs/documents/knowgrph-strybldr-prd-tad.md` |
| Strytree | `docs/documents/knowgrph-strytree-prd-tad.md` |
| Repo hygiene | `docs/documents/knowgrph-repo-hygiene-document.md` |
| Payment readiness | `docs/documents/knowgrph-mainpanel-commerce-prd-tad.md` |

## Hygiene rules

- Fix root/source owners instead of layering downstream aliases, remaps, or compatibility shims.
- Keep the AI/agent layer, storage, graph, and Source Files behavior provider-neutral and file-agnostic where possible.
- Reuse shared helpers, semantic keys, and workspace contracts instead of hardcoded repo, file, route, or demo branches.
- Preserve source provenance for generated artifacts (link them to the goal, brief, plan, tool calls, and verification checks).
- Keep secrets out of source and use server-managed environment bindings for hosted provider keys.
- Keep Dev as the implementation source; publish mirror and Cloudflare outputs are generated from Dev.

## Get involved

- ⭐ Star the repo to follow progress
- 🐛 Issues and FOSS-alternative suggestions welcome
- 🤝 PRs should keep the AI/agent layer, storage, and canvas provider-neutral and file-agnostic

Built by [airvio](https://airvio.co) · Singapore, with a SEA-first multilingual orientation (English, Bahasa Malaysia, Mandarin, SEA-LION).

---

*Knowgrph is early-stage and evolving fast. `docs/documents/` and the sibling `agentic-canvas-os/docs` control surface are versioned alongside the code — check the repo for the latest.*
