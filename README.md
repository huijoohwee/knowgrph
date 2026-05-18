---
title: "Knowgrph"
id: md:knowgrph-readme-harness-current
author: joohwee
date: "2026-05-18"
kgCanvasSurfaceMode: "2d"
kgCanvasRenderMode: "2d"
kgCanvas2dRenderer: "flowEditor"
kgDocumentSemanticMode: "document"
kgFrontmatterModeEnabled: true
kgDocumentStructureBaselineLock: false
---

# Knowgrph

Knowgrph is a Markdown-to-graph workspace, canvas UI, and Codex-compatible super-agent harness for long-running rich-media generation workflows.

The current high-signal deliverable is the harness: a deterministic agent loop that accepts a goal or brief, plans text/image/video/canvas work, writes artifacts, checkpoints state, verifies the result, and emits a workspace document that the Knowgrph Flow Editor can open as a live widget graph.

## Current Harness Claim

Knowgrph is built to satisfy a harness-style evaluation, not just a demo app:

- Long autonomous run: `python3 -m knowgrph_parser superagent ...` executes planner, worker, verifier, and synthesizer tasks without interactive babysitting.
- Designed termination: stop rules, max step budget, retry budget, wall-clock budget, terminal task markers, and verification status are persisted in `state.json`.
- Designed verification: the judge validates artifact existence, graph topology, trace completeness, provenance, and the rich-media workspace route.
- Designed recovery: retryable failures are bounded, written to `trace.jsonl`, checkpointed, and resumable.
- Deliberate orchestration: agents, tools, tasks, dependencies, memory scope, artifact ownership, and completion signals are explicit Python objects.
- Codex integration: Codex can run the same CLI directly, through `/goal`-style prompts, or through the MCP stdio server tool `knowgrph.superagent.run`.

The harness emits both static artifacts and a live app-route artifact for:

```text
MainPanel Integrations -> FloatingPanel Chat UI -> Editor Workspace -> Canvas -> Balanced 16:9 (1920x1080) Layout for Widgets (Text, Image, Video) AND Rich Media Panel AND Edges
```

## Execution Contract

Canonical source work happens in `/Users/huijoohwee/Documents/GitHub/knowgrph`. Production artifacts sync to `/Users/huijoohwee/Documents/GitHub/huijoohwee/content/knowgrph`, then publish at `airvio.co/knowgrph`.

Refactor and harness work must land at the upstream owner first: keep files under 600 lines, chunks under 500 KiB, centralize config/constants, reuse shared utilities, and remove stale aliases or downstream patches instead of preserving compatibility shims. Focused validation should prove each touched slice before any publish or schema mirror update.

## Quick Start

From the repo root:

```bash
npm install
npm run superagent:test
npm run superagent:example
npm run goal:run
npm run dev
```

The example run writes to:

```text
data/outputs/superagent-neutral-example/
```

Open the generated workspace artifact in the app:

```text
data/outputs/superagent-neutral-example/artifacts/workspace/rich-media-flow.md
```

## Run The Harness Directly

For Codex `/goal` setup, see [knowgrph-codex-goal-setup.md](docs/documents/knowgrph-codex-goal-setup.md). The checked-in `goal` file is the durable objective for repo-level long-running work, and `npm run goal:run` executes that contract through the same harness with deterministic mock providers.

```bash
python3 -m knowgrph_parser superagent \
  --input knowgrph_parser/fixtures/superagent-neutral.md \
  --output-dir data/outputs/superagent-neutral-example \
  --run-id superagent-neutral-example \
  --print-summary
```

Checkpoint after a bounded number of steps:

```bash
python3 -m knowgrph_parser superagent \
  --input knowgrph_parser/fixtures/superagent-neutral.md \
  --output-dir data/outputs/superagent-checkpoint \
  --run-id superagent-checkpoint \
  --stop-after-step 2
```

Resume from the checkpoint:

```bash
python3 -m knowgrph_parser superagent \
  --resume \
  --output-dir data/outputs/superagent-checkpoint
```

Exercise recovery with one injected retryable failure:

```bash
python3 -m knowgrph_parser superagent \
  --input knowgrph_parser/fixtures/superagent-neutral.md \
  --output-dir data/outputs/superagent-retry \
  --run-id superagent-retry \
  --fail-once video.generate.mock
```

## Outputs

A completed run writes:

```text
state.json
trace.jsonl
goal.json
final-report.md
harness-proof.json
artifacts/input/brief.md
artifacts/text/scene-plan.md
artifacts/image/reference-frame.svg
artifacts/video/storyboard-video.html
artifacts/canvas/canvas.graph.json
artifacts/canvas/canvas-preview.html
artifacts/workspace/rich-media-flow.md
```

The workspace artifact contains frontmatter-flow metadata with:

- `TextGeneration`, `ImageGeneration`, `VideoGeneration`, and `RichMediaPanel` nodes.
- Canonical widget form ids and typed port handles.
- A balanced 1920x1080 layout frame.
- Edge route hints between text, image, video, and rich-media widgets.
- Provenance back to the harness run id, goal, verification result, and artifacts.

`harness-proof.json` is the judge-facing manifest: it records the Codex/MCP integration route, agent contracts, tool registry, plan dependencies, stop rules, retry policy, trace event counts, verification checks, recovery events, and artifact existence.

## MCP Server

The stdio MCP server exposes the same harness for external MCP clients.

Install server dependencies:

```bash
npm --prefix mcp install
```

Smoke test from the repo root:

```bash
KNOWGRPH_ROOT="$(pwd)" KNOWGRPH_PYTHON="python3" node ./mcp/server.js
```

Tool of interest:

```text
knowgrph.superagent.run
```

Typical tool payload:

```json
{
  "inputPath": "knowgrph_parser/fixtures/superagent-neutral.md",
  "outputDir": "data/outputs/superagent-neutral-example",
  "runId": "superagent-neutral-example"
}
```

See `mcp/README.md` for full MCP client configuration.

## Validation

Baseline harness tests:

```bash
npm run superagent:test
```

Focused Flow Editor rich-media overlay regression:

```bash
cd canvas
TMPDIR=/private/tmp node --preserve-symlinks --preserve-symlinks-main ./node_modules/tsx/dist/cli.cjs -e "void (async () => { const mod = await import('./src/__tests__/flowEditorRichMediaPanelOpenWidgetExclusionRegression.test.ts'); for (const name of Object.keys(mod).filter(name => name.startsWith('test')).sort()) { await mod[name](); console.log('passed', name); } })();"
```

Focused live workspace UI proof:

```bash
cd canvas
TMPDIR=/private/tmp node --preserve-symlinks --preserve-symlinks-main ./node_modules/tsx/dist/cli.cjs -e "void (async () => { const t = await import('./src/__tests__/workspaceImportVideoDemoRendererIsolation.test.tsx'); await t.testVideoDemoRuntimeWidgetUiVisibleInHideFieldsMode(); await t.testVideoDemoRuntimeCollectiveBalancedFit1920x1080Viewport(); console.log('focused workspace rich-media UI tests passed'); })();"
```

Latest local verification snapshot:

```text
npm run superagent:test                                                   OK, 5 tests
flowEditorRichMediaPanelOpenWidgetExclusionRegression focused exports    passed
workspaceImportVideoDemoRendererIsolation rich-media focused exports      passed
```

## Repository Map

```text
knowgrph_parser/
  superagent_harness.py        Agent loop, tool registry, planner, verifier, artifacts
  superagent_harness_test.py   Harness tests for run, resume, recovery, and outputs
  fixtures/                   Example briefs

canvas/
  src/components/FlowEditor/  Flow Editor widget overlays and rich-media panel runtime
  src/components/FlowCanvas/  Canvas graph state, rich-media overlay derivation
  src/__tests__/              Runtime, regression, and route-level tests

mcp/
  server.js                   stdio MCP wrapper around parser and harness commands

docs/documents/
  knowgrph-superagent-harness.md
  knowgrph-superagent-swarm-checklist.md
```

## Architecture Notes

The super-agent harness is deterministic by default. The current provider mode uses mock text, image, and video tools so a judge can run it without network access or provider credentials. Real providers can be added behind the same typed tool registry without changing the loop contract.

The Flow Editor route is not just a static export. The generated workspace mounts Text, Image, Video, and Rich Media Panel nodes as widget overlays with typed handles and edge surfaces. Rich Media Panel widgets are now eligible for the same open-widget overlay path as the other flow widgets, while duplicate rich-media display overlays are suppressed when the panel is already open as a widget.

## Known Boundaries

- The checked-in baseline is offline and deterministic; production provider credentials are not required for validation.
- The MCP server is stdio-first and path-restricted to `KNOWGRPH_ROOT` by default.
- The app surface is under active development, so broader `npm test` coverage may include unrelated work-in-progress areas in a dirty local tree.
