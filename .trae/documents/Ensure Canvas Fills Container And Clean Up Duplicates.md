## Goal
- Make the `canvas` fill its containing `div` in all states (empty shell and graph view).
- Remove stale or duplicate UI/code so only one toolbar and one sidebar trigger appear.

## Current Assessment
- `GraphCanvas`: uses an `svg` with `absolute inset-0 w-full h-full` and `preserveAspectRatio="none"` (fills container). `z-0` keeps canvas below overlays.
- `ReferenceShell`: `canvas` is `absolute inset-0 z-0` and sized via `ResizeObserver` with DPR scaling; fills container.
- `Canvas.tsx`: toolbar is injected as an absolute overlay inside the canvas container; header removed; sidebar trigger centered-left overlay; duplicate import fixed.
- `Toolbar.tsx`: actions standardized to `div role="button"`; Settings and History open panel-style overlays; disabled states handled.

## Implementation Steps
1. Canvas Fill Correctness
- Verify `GraphCanvas` container is `relative w-full h-full` and the `svg` is `absolute inset-0 w-full h-full`.
- Verify `ReferenceShell` `canvas` DPR scaling and `absolute inset-0 z-0` so it fills the container.

2. Overlay Ordering
- Confirm toolbar overlay `div` sits at `z-20` and canvas at `z-0`.
- Confirm sidebar trigger appears once at center-left (`absolute left-3 top-1/2 -translate-y-1/2 z-10`).

3. Duplicate/Stale Cleanup
- Audit imports for duplicates and unused symbols (e.g., remove any leftover unused icons or hooks).
- Remove any legacy placeholder UI (mock menu button or duplicate toolbar blocks) from `ReferenceShell`.
- Optionally remove unused TODO zoom handlers or wire them to `GraphCanvas` zoom (decide based on preference).

4. Consistency With Excalidraw Style
- Keep the toolbar as a single panel-style overlay `div` on top.
- Keep modal panels (Settings, History) centered with backdrop within the canvas bounds.

## Verification
- Run dev server and open `/canvas`.
- Inspect DOM to ensure: one toolbar overlay, one sidebar trigger, canvas/`svg` fill the container.
- Check z-index layering: canvas below, overlays above.
- Confirm no duplicate imports or stale blocks.

## Deliverables
- Verified canvas fill behavior in both `ReferenceShell` and `GraphCanvas`.
- Cleaned imports and UI duplicates.
- Optional: basic implementations for zoom handlers to avoid TODOs (if desired).

## Confirmation
- If this aligns with your expectations, I’ll proceed to apply the minor cleanups (import pruning, optional zoom handler wiring) and re-verify the `/canvas` route end-to-end.