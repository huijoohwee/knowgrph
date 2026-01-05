## Goals
- Implement a Settings Panel that lists all configurable settings as `Key / Type / Value` and expands with responsibility‑flow details.
- Keep the panel in sync with `knowgrph-codebase-responsibility-flow.md` without manual copy.
- Extract toolbar Settings into a dedicated component, preserve existing APIs, and keep files ≤600 lines.
- Audit and improve caching/memory usage; remove stale/duplicate logic; prevent re‑renders and leaks.

## Settings Inventory (Current)
- UI translucency (store + CSS variables)
  - Keys: `uiOverlayOpacity`, `uiPanelOpacity`, `uiToolbarOpacity` (`canvas/src/hooks/store/uiSlice.ts:11–13`), persisted under `kg:ui:*` (`canvas/src/lib/persistence.ts:1–18`).
  - CSS vars defined in `canvas/src/index.css:23–26`; bound at runtime in `canvas/src/pages/Canvas.tsx:22–27`.
  - Controls in `canvas/src/components/Toolbar.tsx:207–217`.
- Editor/selection timing (store)
  - Keys: `codeHighlightDurationMs`, `codeSelectThrottleMs`, `codeHighlightUntilClick` (`canvas/src/hooks/store/uiSlice.ts:7–10`); controls in `Toolbar.tsx:189–205`.
- Panel sizing
  - Key: `bottomPanelHeightRatio` persisted under `kg:ui:bottomPanelHeight` (`canvas/src/hooks/store/uiSlice.ts:14,28`).
- Tab sync
  - Keys: `enableTabSync`, `graphId`, `tabId` (`canvas/src/hooks/useGraphStore.ts`); used in `canvas/src/pages/Canvas.tsx:31–57` and BottomPanel.
- Frontend env constants
  - `CLICK_URL` ← `VITE_TRAE_BADGE_URL`, `PUBLIC_FALLBACK_JSON` ← `VITE_PUBLIC_FALLBACK_JSON` (`canvas/src/lib/config.ts`).
- Backend env overrides
  - `KG_INPUT_PATH`, `KG_OUTPUT_DIR` (`scripts/pipeline.py`).
- ESLint guard
  - Max lines 600 (`canvas/.eslintrc.json`).

## Sync With Flow Doc
- Source: `knowgrph-codebase-responsibility-flow.md` sections:
  - Global Translucency Configuration (`lines 139–145`).
  - Config Constants (`lines 100–101`).
  - Pipeline Env (`lines 103–104`).
  - ESLint Guard (`lines 104–105`).
- Generate a machine‑readable schema from the markdown tables to populate `Area / Modules / Classes / Functions / Responsibility / Imports / Notes` for each setting.

## Implementation
### Settings Schema Extraction (Build‑time)
- Add `scripts/extract-settings-schema.ts` (Node, no external deps) to:
  - Read `knowgrph-codebase-responsibility-flow.md`.
  - Parse pipe‑tables by section headers using regex.
  - Produce `canvas/public/settings-flow.json` mapping keys to doc rows with fields: `area`, `modules`, `classes`, `functions`, `responsibility`, `imports`, `notes`, `lineRange`.
- Add npm script `canvas:build-settings` to run extraction before `dev`/`build`.

### Settings Registry (Runtime)
- `canvas/src/features/settings/types.ts`: Discriminated union for sources: `store | localStorage | env | backendEnv | eslint` with `read()` and optional `write(value)`.
- `canvas/src/features/settings/registry.ts`: Register settings with:
  - `key`, `type`, `source`, `read()` to get current value, `write()` where supported (store setters), `docKey` to join with `settings-flow.json` (and line refs).
  - Examples:
    - `uiOverlayOpacity` → type `number`, source `store/localStorage`, write via `setUiOverlayOpacity`.
    - `CLICK_URL` → type `string`, source `env` (read‑only).
    - `KG_INPUT_PATH` → type `string`, source `backendEnv` (read‑only for frontend).
    - `max-lines` → type `number`, source `eslint` (read‑only).

### Settings Panel UI
- New component `canvas/src/components/SettingsPanel.tsx`:
  - Renders list view: columns `Key / Type / Value` from registry.
  - Inline editing for writable items (clamped for `0–1` opacities; integer clamps for ms).
  - Row expand reveals responsibility details by joining `docKey` with `settings-flow.json`.
  - Uses existing semantic classes: `Island`, `ModalOverlay`, `ModalContainer`, `App-toolbar__divider`; reuses `DropdownPanel` for placement.
- Replace inline Settings block in `Toolbar.tsx` with the new `SettingsPanel` component to reduce file size and preserve behavior.

### File Extractions (≤600 lines)
- Move Settings UI/logic from `Toolbar.tsx` to `SettingsPanel.tsx` (and `features/settings/*`).
- Extract History list to `canvas/src/components/HistoryPanel.tsx`.
- Extract Search dropdown to `canvas/src/components/SearchPanel.tsx`.
- Keep `Toolbar.tsx` public API (props and refs) unchanged; import subcomponents to reduce line count.

### Performance & Cleanups
- Graph rendering
  - Cache adjacency map per `graphId` using `WeakMap` inside `GraphCanvas/utils.ts`; expose `getAdjacencyMap(data)` to avoid recomputation across effects.
  - Defer expensive DOM writes via `requestAnimationFrame` where applicable (selection highlight already optimized).
- Table virtualization
  - Confirm `NodesTable.tsx`/`EdgesTable.tsx` slice‑and‑spacer approach; guard with `enableVirtualTables` toggle.
- Event lifecycles
  - Audit all `addEventListener` usages to ensure cleanup (GraphCanvas cleans up: `GraphCanvas.tsx:225–237`).
  - Replace ad‑hoc listeners with a small `useEvent` helper where duplication exists.
- Persistence & caching
  - Centralize `localStorage` keys in `canvas/src/lib/config.ts` to avoid mismatches; reuse `lsNum/lsSetNum`.
- Remove stale/hardcoded/duplicate logic
  - Deduplicate color defaults by referencing schema styles only.
  - Ensure `scheduleDebouncedSearch` returns a cleanup and is only recreated when `data/searchQuery` change (already true).

## Testing & Verification
- Unit tests (frontend)
  - Settings registry `read/write` behavior: clamp, persistence, env read‑only.
  - Markdown extraction producing consistent `settings-flow.json` for sections above.
- Manual verification
  - Spin up dev server; settings panel reflects live values; edits update UI immediately.
  - Toggle tab sync and confirm cross‑tab selection messages.
- Lint/size checks
  - Ensure `Toolbar.tsx` < 600 lines after extraction; run ESLint with max‑lines guard.

## Rollout
- Non‑breaking: preserve `Toolbar` props and store APIs.
- Add `settings-flow.json` to public assets; handle missing schema gracefully with a fallback message.
- Document new scripts in `README`.

If this plan looks good, I’ll implement the extraction script, registry, and the new Settings Panel, then refactor Toolbar/Search/History into subcomponents and ship the performance tweaks with tests.