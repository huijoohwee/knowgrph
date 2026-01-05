## Objectives
- Start drag only when the cursor is near the viewport rectangle center
- Prevent false starts near the bottom/edges and remove conflicting behaviors
- On drag stop, ensure the view is centered exactly (viewport rectangle center alignment)

## Current Behavior (Summary)
- Drag gating checks local rect coordinates; starts only near center with a dynamic threshold
- Drag uses pointer capture, RAF-coalesced updates, clamps to graph bounds
- Stop cleans up state in all termination paths; no snap-to-center adjustment is applied explicitly

## Proposed Changes
1. Center-Gated Start (Tighten and unify)
- Use a single `centerThreshold` (e.g., `min(12px, max(6px, 8% of min(viewRect side)))`) for:
  - `onPointerDown` start gating
  - `onPointerEnter` (button held) start gating
- Keep hover indicator using the same threshold; cursor shows `grab` strictly in center zone

2. Precise Drag Updates (unchanged mechanics, small refinements)
- Continue RAF-coalesced `requestZoomTransform` with epsilon dedupe
- Maintain pointer capture and `pointerId` checks to avoid multi-pointer conflicts
- Keep clamp to graph bounds based on current `k`-scaled viewport size

3. Center-Exact Stop Alignment
- On `onPointerUp`:
  - Read final pointer position relative to minimap `svg`
  - Convert to graph space (`ux, uy`), use current `k`
  - Apply final snap transform via `computeTransformFromCenter(vw, vh, ux, uy, k)`
  - This guarantees the viewport rectangle’s center aligns under the cursor upon stop
- If clamping prevents exact alignment (near edges), compute the nearest allowed center and derive transform from that corrected center

4. Conflict Cleanup
- Ensure drag state resets on `pointercancel`, `lostpointercapture`, `pointerleave`
- Keep `touchAction: none` on the rect to avoid browser gestures
- Remove any redundant mouse listeners for start (pointer-only for initiation), retain mousemove only for hover indicator

## Implementation Steps
- `canvas/src/features/minimap/Minimap.tsx`
  - Tighten center threshold constant and reuse it across start/hover
  - In `onPointerUp`, compute final `{ux, uy}` and apply a final `requestZoomTransform` using `computeTransformFromCenter`
  - Add helper to compute nearest allowed center when clamped
- No changes to store or canvas zoom mechanics (already consume `transform` requests instantly)

## Validation
- Manual: Verify start only in center zone; dragging pans smoothly; releasing snaps the viewport so its center sits under the cursor
- Edge cases: Very small viewport, near graph bounds, rapid start/stop, touch input
- Confirm no re-render loops (epsilon dedupe) and no lingering drag state

## Notes
- All edits are localized to minimap component and its math utilities; public API remains unchanged
- Threshold can be tuned easily if you want stricter/looser sensitivity later