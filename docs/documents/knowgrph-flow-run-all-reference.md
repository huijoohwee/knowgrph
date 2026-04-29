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
