# Debug Session: storyboard-media-panel-loop
- **Status**: [OPEN]
- **Issue**: Storyboard live route accepts media-panel drops into graph state, but the created Rich Media panel does not become visibly mounted and a post-drop `Maximum update depth exceeded` loop follows.
- **Scope**: `Canvas` live route -> apply the operator-provided Strybldr validation document -> drag image/video from FloatingPanel Media onto Storyboard canvas.
- **Constraint**: No business-logic modification before runtime evidence is collected.

## Symptoms
- Dropping image/video on the live Storyboard surface creates a graph node such as `ws:...::n1`.
- No new visible rich-media shell appears after the drop.
- Browser console reports `Maximum update depth exceeded` after drop.

## Hypotheses
1. Post-drop selection forcing still oscillates between canonical and composed ids, repeatedly rewriting selection/open state.
2. Storyboard runtime writes open-widget state into the active renderer bucket, while overlay-collision or shell warmup still listens to the hardcoded `storyboardWidget` bucket and reschedules churn.
3. A graph commit or rematerialization path normalizes widget-open state immediately after drop and retriggers overlay/runtime effects without changing the visible shell set.
4. The created node is valid in graph state but is still parked hidden because overlay layout never stabilizes after the post-drop state loop begins.
5. Inspector/runtime derived state reacts to draft-graph identity churn after the drop and amplifies the selection loop into React max-depth failure.

## Plan
1. Add instrumentation to selection bookkeeping and overlay-collision scheduling only.
2. Reproduce with the focused live-route verifier.
3. Compare the post-drop trace for selected id, override id, pending ids, active renderer, renderer-scoped open-widget ids, and visible shell ids.
4. Apply the smallest upstream fix once the repeated write path is confirmed.
