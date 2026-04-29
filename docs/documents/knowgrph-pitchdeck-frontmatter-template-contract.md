# Knowgrph Pitchdeck Frontmatter Template Contract

## Purpose

Document the canonical frontmatter-first contract for the reusable pitchdeck templates.

Keep template structure, widget fields, panel writeback, and parser expectations aligned across `knowgrph`, `huijoohwee.github.io`, and validation fixtures.

## Canonical Artifacts

| Artifact | Role | Directive |
| --- | --- | --- |
| `huijoohwee.github.io/template/pitchdeck-prd-tad-template-lite.md` | Minimal reusable template | Keep it frontmatter-first, generic, and parser-safe. |
| `huijoohwee.github.io/template/pitchdeck-prd-tad-template.md` | Full reusable template | Keep it frontmatter-first, generic, and parser-safe. |
| `sandbox/test-data/test-generate-video/knowgrph-demo-video.md` | Validation fixture | Use it to validate shape and behavior, not as a source of hardcoded content. |
| `canvas/src/features/flow-editor-manager/registryTemplates.ts` | Widget registry SSOT | Reuse canonical widget fields, ports, and `flow:widgetFormId` values. |
| `canvas/src/features/integrations/*Ssot*.ts` | Integration field SSOT | Reuse canonical integration field keys and row semantics. |
| `canvas/src/lib/render/richMediaSsot.ts` | Panel behavior SSOT | Reuse canonical Rich Media Panel writeback and tab behavior. |
| `canvas/src/__tests__/markdownFrontmatterFlowGraphImport.test.ts` | Parser fidelity SSOT | Keep typed envelopes and frontmatter-flow syntax aligned to test expectations. |

## Contract Rules

| Surface | Directive | Source |
| --- | --- | --- |
| Document shape | Keep one YAML frontmatter block as the machine SSOT and Markdown body as the human projection. | `kgc-pipeline/v1` templates |
| SSOT surfaces | Keep `widget_bundle`, `runner`, `pipeline`, `mermaid`, `flow`, and `graph_meta` mutually consistent. | frontmatter templates |
| Serialization | Keep widget and panel properties in typed envelope form `{key, type, value}`. | parser fidelity tests |
| Text widget | Reuse canonical text keys `chatProvider`, `chatAuthMode`, `chatEndpointUrl`, `chatModel`, `prompt`. | text integration SSOT |
| Image widget | Reuse canonical image keys `model`, `prompt`, `size`, `output_format`, `response_format`, `optimize_prompt_options`, `aspect_ratio`, `stream`, `watermark`, `seed`, `guidance_scale`, `reference_image`. | image integration SSOT |
| Video widget | Reuse canonical video keys `model`, `prompt`, `content_json`, `resolution`, `ratio`, `duration`, `generate_audio`, `draft`, `camera_fixed`, `image_url_url`, `reference_image`. | video integration SSOT |
| Rich Media Panel | Reuse canonical panel keys `output`, `imageUrl`, `videoUrl`, `outputSrcDoc`, `media_interactive`. | panel registry + render SSOT |
| Widget identity | Keep canonical `flow:widgetFormId` values: `textGeneration`, `imageGeneration`, `videoGeneration`, `richMediaPanel`. | parser + registry SSOT |
| Handles | Keep canonical port names: `prompt_in`, `text_out`, `reference_image`, `imageUrl`, `videoUrl`, `output`, `outputSrcDoc`. | registry SSOT |
| Output surface | Keep Rich Media Panel as the only canonical final render surface for widget outputs. | rich media render SSOT |
| Graph execution | Keep the flow acyclic; forbid feedback arcs, infinite loops, and repeated derived writeback. | template contract |
| Content neutrality | Forbid validation-demo scripts, scene names, asset URLs, or provider-specific stories in reusable templates. | authoring rule |

## Reuse Matrix

| Consumer | Reuse rule |
| --- | --- |
| FloatingPanel Props Panel | Read and write the same canonical `properties.*` keys serialized in template `flow.nodes`. |
| MainPanel Integrations | Reuse the same field names and row semantics as the widget registry SSOT. |
| NodeOverlayEditor KTV rows | Render the same typed envelope fields without local alias keys. |
| Frontmatter parser | Parse the same canonical `flow:widgetFormId`, handles, and typed envelopes emitted by the templates. |
| Rich Media renderer | Apply connected values before display filtering or media dedupe. |

## Authoring Rules

| Context | Directive |
| --- | --- |
| Placeholder data | Keep project-specific content inside frontmatter placeholders only. |
| Defaults | Use generic defaults; do not pin demo-only subjects, brands, assets, or scenes. |
| Extensions | Add new nodes and edges through the same typed-envelope pattern. |
| Drift prevention | Fix schema drift in shared TS SSOT sources, not in downstream docs or template prose. |
| Legacy cleanup | Remove stale or duplicate template formats instead of preserving compatibility shims. |

## Verification

| Check | Pass condition |
| --- | --- |
| Frontmatter fidelity | All declared SSOT surfaces describe the same graph. |
| Registry fidelity | Template field keys match shared widget and integration SSOT keys. |
| Panel fidelity | Widget outputs land on Rich Media Panel canonical properties. |
| Neutrality | Templates remain project-agnostic and validation-demo-agnostic. |
| Parser safety | Typed envelopes and `flow:widgetFormId` values remain parser-safe. |
