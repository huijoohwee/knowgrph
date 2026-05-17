# Knowgrph Super-Agent Harness

This document describes the Codex-compatible harness implemented by:

```bash
python3 -m knowgrph_parser superagent --input knowgrph_parser/fixtures/superagent-neutral.md --output-dir data/outputs/superagent-neutral-example --run-id superagent-neutral-example
```

The harness is intentionally project-agnostic. It accepts a user-provided brief, extracts scenes from neutral frontmatter or markdown body text, generates deterministic mock text/image/video artifacts, composes a canvas graph, verifies the run, and writes a final report. Real media providers can be added behind the same typed tool registry without changing the run loop.

The canvas worker now emits both a standalone graph artifact and a Knowgrph workspace markdown artifact for the app route:

```text
MainPanel Integrations -> FloatingPanel Chat UI -> Editor Workspace -> Canvas -> Balanced 16:9 (1920x1080) Layout for Widgets (Text, Image, Video) AND Rich Media Panel AND Edges
```

That workspace document uses frontmatter-flow metadata with `TextGeneration`, `ImageGeneration`, `VideoGeneration`, and `RichMediaPanel` nodes, plus the canonical widget form ids, port handles, balanced 16:9 layout metadata, and edge route hints required by the editor widget surface and the Rich Media Panel render surface.

## Runtime Concepts

- `Goal`: parsed from the `/goal` file into intent, constraints, output contract, quality bar, and stop rules.
- `Run`: persisted in `state.json` with status, timestamps, budget, active plan, completed tasks, verification, and artifacts.
- `Step`: every task attempt is recorded with input summary, output summary, status, and error metadata.
- `Tool`: registered with required inputs, timeout metadata, retryability, and structured observations.
- `Agent`: each task is assigned to a role such as planner, text worker, image worker, video worker, canvas worker, verifier, or synthesizer.
- `Artifact`: text, image, video, canvas, trace, and report files are recorded with source step provenance.
- `Judge`: deterministic validation checks artifact existence, graph topology, trace completeness, and provenance.
- `Recovery`: retryable errors are bounded, logged as `recovery.retry`, and checkpointed.

## Outputs

A completed run writes:

- `state.json`
- `trace.jsonl`
- `goal.json`
- `final-report.md`
- `artifacts/input/brief.md`
- `artifacts/text/scene-plan.md`
- `artifacts/image/reference-frame.svg`
- `artifacts/video/storyboard-video.html`
- `artifacts/canvas/canvas.graph.json`
- `artifacts/canvas/canvas-preview.html`
- `artifacts/workspace/rich-media-flow.md`

## Resume And Recovery

Checkpoint a run:

```bash
python3 -m knowgrph_parser superagent --input knowgrph_parser/fixtures/superagent-neutral.md --output-dir data/outputs/superagent-checkpoint --run-id superagent-checkpoint --stop-after-step 2
```

Resume it:

```bash
python3 -m knowgrph_parser superagent --resume --output-dir data/outputs/superagent-checkpoint
```

Exercise bounded recovery:

```bash
python3 -m knowgrph_parser superagent --input knowgrph_parser/fixtures/superagent-neutral.md --output-dir data/outputs/superagent-retry --run-id superagent-retry --fail-once video.generate.mock
```

## Codex And MCP

Codex can run the harness directly from `/goal` using the CLI above. MCP clients can call `knowgrph.superagent.run`, which wraps the same command and returns the trace, state, report, canvas artifact paths, and workspace frontmatter-flow artifact.

Baseline validation is offline and deterministic. It does not require network access, provider credentials, or a specific pre-existing demo document.
