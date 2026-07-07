# Debug Session: storyboard-open-widget-base
- **Status**: [OPEN]
- **Issue**: Storyboard Rich Media drop renders the open widget `aside` from a different world/screen authority path than the shell overlay, leaving the open widget offset after drop.
- **Debug Server**: pending
- **Log File**: .dbg/trae-debug-log-storyboard-open-widget-base.ndjson

## Reproduction Steps
1. Run `npm --prefix canvas run test:smoke:storyboard-rich-media-drop:browser`.
2. Trigger the storyboard smoke route rich-media drop.
3. Observe the dropped shell and the open widget `aside` positions for the new node.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | The open widget runtime receives a different world position than the shell for the dropped Rich Media node. | High | Low | Pending |
| B | The open widget runtime receives the same world position but a different zoom transform or scale authority than the shell. | High | Low | Pending |
| C | The pending-overlay/open-widget handoff swaps from pending node authority to committed graph authority with a coordinate-space mismatch. | Medium | Medium | Pending |
| D | A later clamp or floating-layout branch rewrites the open widget base after the initial storyboard placement path computes the correct box. | Medium | Medium | Pending |

## Log Evidence
- Pending

## Verification Conclusion
- Pending
