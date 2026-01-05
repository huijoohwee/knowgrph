## Overview
- Current behavior: clicking outside some panels does not close them.
- Cause: `BottomPanel` and the right `Sidebar` do not register outside‑click handling; modals in `Toolbar` already use `useOutsideClose`.
- Approach: reuse shared `useOutsideClose` for all panels, avoid duplicate ad‑hoc handlers, and keep file sizes within constraints. No new dependencies.

## Changes
### BottomPanel
- Add `panelRef` and `toggleRef`; map `collapsed` state to an `open` setter.
- Wire `useOutsideClose(!collapsed, setBottomOpen, panelRef, [toggleRef])`.
- Attach `ref={panelRef}` to the `ModalContainer` and `ref={toggleRef}` to the chevron button.
- File: `canvas/src/components/BottomPanel.tsx` (around lines 10–20 for refs; 364 for `ModalContainer`; 367 for toggle button).

### Sidebar
- Add `asideRef` and `sidebarToggleRef` in `CanvasPage`.
- Wrap `<SidebarTrigger />` with a ref container; attach `ref={asideRef}` to the `<aside>`.
- Wire `useOutsideClose(isSidebarOpen, setSidebarOpen, asideRef, [sidebarToggleRef])`.
- File: `canvas/src/pages/Canvas.tsx` (top imports + state destructure; line ~46 to wrap trigger; line ~56 to add `ref` on `<aside>`).

### Consistency
- Keep `Toolbar` modals’ overlay for visual feedback; rely primarily on `useOutsideClose` for closure to avoid duplicated onClick logic. No behavior change for `Settings`, `Schema`, `History`, `Export`, `Help`.

## Validation
- Open each panel (`BottomPanel`, `Sidebar`, `Settings`, `Schema`, `History`, `Export`, `Help`), click outside → panel closes.
- Check edge cases: clicking the toggle while open does not prematurely close; drag within panel does not close.
- Confirm `Sidebar` `aria-hidden` reflects `isSidebarOpen` and outside click sets it to false.

## Code Quality
- Maximize shared utilities: reuse existing `useOutsideClose`.
- Avoid duplicates: remove any redundant ad‑hoc outside handlers if present later.
- File size: keep diffs small; optionally extract `BottomPanel` helper functions to a small utility in a follow‑up to get under 600 lines without altering behavior.

## Files Affected
- `canvas/src/components/BottomPanel.tsx`
- `canvas/src/pages/Canvas.tsx`
- (No new files; no package changes)