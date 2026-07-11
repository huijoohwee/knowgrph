# Debug Session: storyboard-smoke-flake

- Status: CLOSED
- Started: 2026-07-10
- Scope: Intermittent failure in `test:smoke:storyboard-rich-media-drop:browser` when run inside `storyboard:readiness:check`

## Symptoms

- Expected: `npm run storyboard:readiness:check` completes storyboard source smoke, storyboard browser smoke, mobile keyboard browser smoke, and publish sync drift check successfully.
- Actual: the readiness command intermittently fails in the storyboard browser smoke while isolated reruns of the same storyboard smoke can pass.

## Hypotheses

1. Storyboard smoke page readiness marker is populated too late for the current verifier wait.
2. Storyboard drop target or node-id selector becomes available after the verifier starts asserting.
3. The verifier advances before the renderer/layout settles on cold start.
4. Sequenced smoke execution in the readiness gate changes timing/resource conditions relative to isolated runs.
5. The verifier timeout is currently shorter than the real cold-start path under readiness execution.

## Evidence Log

- Instrumented `canvas/scripts/verify_storyboard_rich_media_drop_browser_smoke.py` for:
  - smoke route navigation and readiness checkpoints
  - first drop creation visibility
  - attempt-level retry outcomes
  - edge retention lifecycle checkpoints
- Passing evidence from `.dbg/trae-debug-log-storyboard-smoke-flake.ndjson` showed:
  - route marker mounted successfully
  - storyboard surface rect became non-zero
  - `baselineReady` confirmed while lifecycle remained `minimapAsync`
  - dropped node `n1` became visible immediately for both image and video paths
- Earlier failing runs showed intermittent verifier failures at:
  - smoke-page readiness waits
  - first dropped-panel visibility
  - later edge-retention assertions

## Hypothesis Status

| ID | Hypothesis | Status | Evidence Summary |
| --- | --- | --- | --- |
| A | Storyboard smoke page readiness marker is populated too late for the current verifier wait. | PARTIAL | Earlier failures hit readiness waits; passing instrumented runs confirmed readiness can also succeed quickly. |
| B | Storyboard drop target or node-id selector becomes available after the verifier starts asserting. | PARTIAL | Earlier failures hit first panel visibility and edge retention; passing runs show the selector can settle in time. |
| C | The verifier advances before the renderer/layout settles on cold start. | CONFIRMED | Passing logs show `baselineReady=true` while lifecycle is still `minimapAsync`, indicating a cold-start async phase overlaps verifier assertions. |
| D | Sequenced smoke execution in the readiness gate changes timing/resource conditions relative to isolated runs. | INCONCLUSIVE | The gate used to fail intermittently while isolated reruns could pass, but current hardening reduced that enough that the full gate now passes. |
| E | The verifier timeout is currently shorter than the real cold-start path under readiness execution. | CONFIRMED | A bounded fresh-page retry in the verifier removed the intermittent early-load failures without touching product logic. |

## Fix Applied

- Added bounded fresh-page retry around `run_single_drop(...)` in the storyboard browser verifier.
- Removed temporary verifier instrumentation after the readiness gate passed repeatedly.
- Verified:
  - isolated `npm --prefix canvas run test:smoke:storyboard-rich-media-drop:browser`
  - full `npm run storyboard:readiness:check`

## Next Step

- Closed. Keep the bounded retry unless a lower-level source fix makes it unnecessary.
