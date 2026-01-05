## Current State
- `canvas/src/pages/Canvas.tsx:33–46` renders `Toolbar` and `SidebarTrigger` twice (inside both branches of the `!data` conditional), causing duplicate markup and potential stale state.
- `canvas/src/components/Toolbar.tsx:108` is the root toolbar `div` container; overlays are controlled via local state and closed by a document click listener (`Toolbar.tsx:84–104`).
- `GraphCanvas` fully rebuilds the SVG on `data` changes (`canvas/src/components/GraphCanvas.tsx:27–69`), so canvas reload is already from-scratch; toolbar should follow suit without lingering popovers.
- Vestigial/unused in `Toolbar`: local `creatingEdge` state (`Toolbar.tsx:16–17`) and store fields like `addEdge` pulled from `useGraphStore` that the toolbar does not call (`Toolbar.tsx:15`).

## Objectives
- Reload all toolbar UI elements cleanly when graph `data` changes or is cleared.
- Align toolbar layout with a single parent `div` and avoid conflicting/duplicate rendering.
- Remove stale/unused/duplicate code to reduce state drift and prevent ghost UI.

## Changes
- Deduplicate render points:
  - Move `Toolbar` and `SidebarTrigger` outside the `!data` conditional and render them once at the page level (`Canvas.tsx:31–48`).
- Align with container `div`:
  - Keep a single wrapper for the toolbar (absolute, centered) and ensure the `Toolbar` root `div` (`Toolbar.tsx:108`) owns spacing and background; no additional nested wrappers duplicating layout.
- Reliable "reload from scratch" for UI elements:
  - Add a `useEffect` in `Toolbar` to close all transient panels whenever `data` changes or becomes `null` (sets `isExportOpen`, `isHelpOpen`, `isHistoryOpen`, `isSettingsOpen`, `isSchemaOpen` to `false`).
  - On `clearData()` (`Toolbar.tsx:39–43`) and after successful `loadGraphFile()` (`Toolbar.tsx:34–37`), explicitly reset transient states.
- Remove conflicting/stale code:
  - Delete `creatingEdge` state and `handleAddEdgeHint` (`Toolbar.tsx:16,79–82`) if no UI indicates the hint.
  - Stop destructuring unused store fields from `useGraphStore` in `Toolbar` (`Toolbar.tsx:15`) to avoid stale references.
  - Keep zoom actions wired via props (`Toolbar.tsx:267–275`); leave TODOs in `Canvas.tsx:14–24` or implement later without blocking toolbar cleanup.

## Validation
- Visual: Start dev, load/clear data, open/close all menus; confirm they reset on data changes and that only one toolbar exists.
- Functional: Delete/select actions still work; overlays (`Settings`, `Schema`, `History`, `Help`) position and size correctly using `canvasDims`/`canvasPos`.
- Regression: Ensure `GraphCanvas` rebuild on `data` remains unaffected and that z-index layering keeps toolbar above the canvas.

## Deliverables
- Refactor `Canvas.tsx` to render `Toolbar`/`SidebarTrigger` once.
- Update `Toolbar.tsx` to reset transient UI on `data` changes; remove unused state/imports.
- No changes to `GraphCanvas` logic (already doing full reload correctly).

## Notes
- The browser shows an Excalidraw-like `App-toolbar`; no such component exists in this repo. After deduplication and state resets, our toolbar should not conflict; if the external toolbar persists, we will scope styles and z-index to avoid overlap in a follow-up.