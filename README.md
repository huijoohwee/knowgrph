# Knowgrph Stryfork

> **Fork any demo video into structured storyboard artifacts — zero TCO, canvas-ready, inside TRAE.**

Stryfork is a TRAE-native AI harness that reverse-engineers any video into reusable storyboard
artifacts in under 5 minutes — turning a 4–6 hour manual process into a single command at $0.00/run.

---

## Why Stryfork

Founders and content strategists routinely study high-performing demo videos to understand what
makes them work. Today that process is entirely manual:

| Step | Time |
|---|---|
| Watch + rewatch, identify acts | 60–90 min |
| Transcribe key VO lines | 45–90 min |
| Sketch visual + audio cues | 30–60 min |
| Produce a reusable artifact | 0 (lost in notes) |
| **Total** | **3–6 hours** |

Stryfork replaces that workflow with one TRAE command and five typed artifacts.

---

## Concept

**"Fork" a video like forking a repo.**

Paste a URL. Stryfork clones the narrative *blueprint* — acts, beats, visual cues, audio cues,
representative VO lines — not the footage. Output lands directly in the Knowgrph Flow Editor
canvas as a typed `StoryboardPanel` knowledge graph node.

> Cloning top demos takes 6h manually. Stryfork uses TRAE as the unified harness entry:
> URL → AI extracts acts, beats, VO → SVG + HTML storyboard artifacts. $0 TCO. 6h → <5 min.

---

## How It Works

Four-stage superagent pipeline, all orchestrated from TRAE:

```
URL
 ├─ [1] video.extract.transcript   yt-dlp captions → faster-whisper fallback
 ├─ [2] video.extract.metadata     yt-dlp --dump-json (title, duration, chapters)
 ├─ [3] storyboard.analyse         Ollama qwen2.5:14b → acts[] JSON (local, $0.00)
 └─ [4] storyboard.render          Python stdlib → SVG + HTML + md + KGC node
```

Every tool emits a typed cost log. A nine-check verifier writes `harness-proof.json` on exit.

---

## TRAE Integration

TRAE is the single entry point. No secondary tools, no context switching.

### Invoke via TRAE

```bash
knowgrph.superagent.run \
  --input fixtures/superagent-storyboard-reverse.md \
  --var url="$KNOWGRPH_STORYTREE_SOURCE_URL" \
  --output-dir data/outputs/storyboard-fork \
  --run-id storyboard-fork-001 \
  --print-summary
```

### Multi-source orchestration from TRAE

| Source | Role |
|---|---|
| Video URL | Raw input via TRAE command palette |
| Ollama (local LLM) | Act decomposition; TRAE reads `OLLAMA_HOST` from workspace env |
| Knowgrph Flow Editor | Artifact consumer; TRAE imports `rich-media-flow.md` as canvas node |

### Cross-role collaboration — one tool, four roles

| Role | TRAE action | Artifact |
|---|---|---|
| Founder / strategist | Paste URL, trigger run | `scene-plan.md` |
| AI engineer | Review harness trace | `trace.jsonl` + `harness-proof.json` |
| Content designer | Open storyboard player | `storyboard-video.html` |
| Knowledge graph editor | Import to canvas | `rich-media-flow.md` → StoryboardPanel node |

---

## Output Artifacts

```
data/outputs/<run-id>/
├── state.json                          COMPLETE / FAILED / PARTIAL
├── trace.jsonl                         per-tool event log with cost fields
├── harness-proof.json                  9-check verifier manifest
└── artifacts/
    ├── input/transcript.txt            plain-text transcript
    ├── input/metadata.json             title, duration, chapters
    ├── text/scene-plan.md              human-readable act breakdown
    ├── text/scene-plan.json            validated acts[] (machine-readable)
    ├── image/reference-frame.svg       composite SVG frame grid, one <g> per act
    ├── video/storyboard-video.html     interactive storyboard player
    └── workspace/rich-media-flow.md    KGC canvas StoryboardPanel node
```

### scene-plan.json — act schema

```json
{
  "acts": [{
    "act_id": "act-01",
    "title": "The hook — world before",
    "timecode_start": "00:00:00",
    "timecode_end": "00:00:25",
    "beats": ["Developer at terminal", "Tab sprawl"],
    "visual_cue": "Close-up IDE, multiple tabs open",
    "audio_cue": "Lo-fi ambient",
    "vo_line": "Complex tasks take days. Bugs pile up."
  }]
}
```

---

## ROI Metrics

| Metric | Before | After | Delta |
|---|---|---|---|
| Time to storyboard | 4–6 hours | < 5 min | **−98%** |
| Reusable artifacts produced | 0 | 5 typed files | — |
| Monthly TCO | $0 (but 6h labour) | $0.00 | **−6h/run** |
| Context switches | 4–6 tools | 1 (TRAE) | **−80%** |
| Knowledge graph integration | Manual | Automatic node | **−100% steps** |
| Token cost per run | — | $0.00 (local) | **$0.00** |

```
ROI Score = (Impact × Reach) / (Build Hours + TCO + Token Cost/Month)
           = (5 × 30) / (10 + 0 + 0.03) ≈ 14.96
```

---

## Tech Stack

| Component | Tool | License | Monthly Cost |
|---|---|---|---|
| Video + caption fetch | `yt-dlp` | Unlicense | $0.00 |
| Speech-to-text fallback | `faster-whisper` | MIT | $0.00 |
| Act decomposition | Ollama + `qwen2.5:14b` | MIT / Apache 2.0 | $0.00 |
| Schema validation | `jsonschema` | MIT | $0.00 |
| SVG + HTML rendering | Python stdlib | PSF | $0.00 |
| **Total** | | | **$0.00** |

No cloud APIs. No egress. Fully offline after initial model pull.

---

## Quick Start

**Prerequisites**: Python 3.11+, Ollama running locally, `qwen2.5:14b` pulled, TRAE + Knowgrph MCP connected.

```bash
git clone https://github.com/huijoohwee/knowgrph
cd knowgrph
pip install -r requirements.txt        # adds yt-dlp, faster-whisper, jsonschema
```

```bash
# Fork a video
python3 -m knowgrph_parser superagent \
  --input knowgrph_parser/fixtures/superagent-storyboard-reverse.md \
  --var url="$KNOWGRPH_STORYTREE_SOURCE_URL" \
  --output-dir data/outputs/stryfork-demo \
  --run-id stryfork-demo-001 \
  --print-summary

# Resume a partial run
python3 -m knowgrph_parser superagent \
  --resume --output-dir data/outputs/stryfork-demo
```

---

## Configuration

| Env var | Default | Description |
|---|---|---|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | `qwen2.5:14b` | Model for act decomposition |
| `WHISPER_MODEL_SIZE` | `base` | faster-whisper model (`base` / `small` / `medium`) |
| `STRYFORK_MAX_ACTS_PER_SVG` | `12` | Acts before SVG pagination |

---

## Harness Verifier

Nine checks, written to `harness-proof.json` after every run:

```json
{
  "transcript_exists":            "pass",
  "metadata_chapters_parsed":     "pass",
  "scene_plan_act_count_gte_3":   "pass",
  "scene_plan_json_valid":        "pass",
  "svg_frame_count_matches_acts": "pass",
  "storyboard_html_renderable":   "pass",
  "workspace_storyboard_node":    "pass",
  "tco_zero":                     "pass",
  "trace_event_count_gte_4":      "pass"
}
```

All nine must pass for `state.json` to record `COMPLETE`.

---

## Architectural Decisions

| ADR | Decision | Reason |
|---|---|---|
| ADR-001 | Ollama `qwen2.5:14b` for decomposition | Zero TCO; offline; Apache 2.0; already in airvio stack |
| ADR-002 | `yt-dlp` + `faster-whisper` for extraction | Platform-agnostic; MIT/Unlicense; no cloud ASR cost |
| ADR-003 | Single composite SVG frame grid | Zero new deps; inline-renderable; ~10× smaller than PNG |

Full ADR text with TCO comparison tables: [`knowgrph-stryfork-prd-tad.md`](./knowgrph-stryfork-prd-tad.md).

---

## Roadmap

**Sprint 1 — MVP (current scope)**
- URL → 5 typed artifacts → 9 verifier checks → TRAE MCP integration

**Sprint 2 — Quality**
- Chapter-aware act boundary hints from YouTube metadata
- Remotion-compatible JSON export from `scene-plan.json`

**Sprint 3 — Scale**
- Multi-URL batch forking fixture
- Side-by-side storyboard diff view in Flow Editor

**Explicit non-goals**: cloud ASR/LLM, video re-generation or synthesis, copyright-flagged downloads.

---

## Contributing

1. Create `knowgrph_parser/tools/<name>.py` with a typed `Tool` class
2. Register in `superagent_harness.py` tool registry
3. Add verifier check in the verifier block
4. Add fixture task in `fixtures/superagent-storyboard-reverse.md`
5. Confirm `harness-proof.json` shows all checks as `pass`

All PRD/TAD changes must adhere to [`prd-tad-guidelines.md`](./prd-tad-guidelines.md).

---

## License

MIT — see [`LICENSE`](./LICENSE).

---

*Knowgrph Stryfork · airvio · Singapore · 2026 · TRAE Hackathon — Productivity Enhancement Track*

---

## Fixture Reference

`knowgrph_parser/fixtures/superagent-storyboard-reverse.md` — the harness brief that drives
the entire pipeline. Pass any video URL as `--var url=` at invocation time; all other task
sequencing, artifact paths, and verifier checks are declared inside the fixture.

```yaml
id: storyboard-reverse-v1
goal: "reverse-engineer storyboard from video URL"
input_url: "{{url}}"
output_schema: "kgc-computing-flow/v1"
max_steps: 8
max_wall_clock_seconds: 300
artifacts:
  - "text/scene-plan.md"
  - "text/scene-plan.json"
  - "image/reference-frame.svg"
  - "video/storyboard-video.html"
  - "workspace/rich-media-flow.md"
tasks:
  - { id: extract-transcript, tool: video.extract.transcript, inputs: { url: "{{url}}" } }
  - { id: extract-metadata,   tool: video.extract.metadata,   inputs: { url: "{{url}}" } }
  - { id: analyse,  tool: storyboard.analyse, depends_on: [extract-transcript, extract-metadata] }
  - { id: render,   tool: storyboard.render,  depends_on: [analyse] }
```

The fixture is the single source of truth for what a Stryfork run does.
Swap the URL, get a new storyboard. No code changes required.
