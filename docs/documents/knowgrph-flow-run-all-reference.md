# knowgrph - Flow Editor Run All Sequence Reference (Runtime SSOT)

App SSOT entrypoint: `canvas/src/lib/flowEditor/runAllSequenceSsot.ts`
Generated file: `docs/documents/knowgrph-flow-run-all-reference.md`.

Validation script target: `sandbox/test-data/test-generate-video/knowgrph-demo-video.md`.

| Sequence | phase id | label |
| --- | --- | --- |
| 1 | `text` | Text |
| 2 | `imageFoundation` | Character + Location Image |
| 3 | `imageScene` | Scene Image |
| 4 | `video` | Video |

Run-order policy:
- Execute in phase order: Text -> Character/Location Image -> Scene Image -> Video.
- Keep ordering stable by node position (`y`, then `x`, then `id`) inside each phase.
- Prioritize scene images that feed video reference edges before other scene images.

Computing-flow policy:
- Run All reads connected widget inputs through the shared Flow Editor computing-flow helpers, not through renderer-local DOM state.
- Each phase consumes and emits values by semantic port key and normalized schema path; duplicate visible labels must not collapse ports, fields, or connected values.
- Empty `null` / `undefined` branch outputs are stop signals and must not be forwarded to downstream phases.
- Generated widget outputs write into existing graph nodes only. Run All must not rewrite Flow Editor layout, rich-media panel frames, or edge topology while computing.
