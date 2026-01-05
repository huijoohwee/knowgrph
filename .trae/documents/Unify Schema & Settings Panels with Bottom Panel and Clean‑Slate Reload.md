## Overview
- Align `Schema` and `Settings` panels to the Bottom Panel’s UI and behavior for consistency and maintainability.
- Implement a clean‑slate reload for both panels that resets their data and UI state deterministically (no stale cache), while preserving public APIs.
- Extract shared utilities into feature‑scoped modules and tighten memoization to reduce re‑renders and memory leaks.

## Current State
- Bottom Panel already defines a consistent header, actions row, code textarea flows:
  - Header and tabs: `canvas/src/features/panels/ui/TabHeader.tsx:21-60`
  - Actions row: `canvas/src/features/panels/ui/ActionsRow.tsx:12-24`
  - BottomPanel implementation uses those: `canvas/src/components/BottomPanel.tsx:224-241` and actions/text area: `canvas/src/components/BottomPanel.tsx:248-316`
- Settings Panel and Schema Editor already use `TabHeader`/`ActionsRow`, but differ in header behavior and actions:
  - Settings: `canvas/src/components/SettingsPanel.tsx:140-168` (search + Apply/Reset list)
  - Schema: `canvas/src/components/SchemaEditorPanel.tsx:143-170` (Format/New/Import/Export/Clear/Apply/Reset)
- Shared helpers exist but are panel‑specific:
  - Bottom Panel helpers: `canvas/src/features/bottom-panel/utils.ts:1-49`
  - JSON editor behaviors: `canvas/src/features/hooks/useCodeJsonEditor.ts:6-45`

## UI Unification
- Adopt Bottom Panel’s header pattern (collapse toggle + tab buttons + optional search) for both panels:
  - Add `collapsed` state and `onToggle` to `SettingsPanel` and `SchemaEditorPanel` using `TabHeader` like Bottom Panel (`BottomPanel.tsx:226-241`).
  - For `SettingsPanel`, surface a single content tab (e.g., `catalog`) with search, mirroring Bottom Panel’s layout wrapper (`PanelContainer`).
  - For `SchemaEditorPanel`, keep its internal tabs (`Types`, `Properties`, `Advanced`) rendered as a secondary tab row beneath actions, but the top `TabHeader` adopts collapse and search.
- Standardize action buttons styling and ordering with `ActionsRow`:
  - Place actions above the main editor area; ensure primary action rightmost as in Bottom Panel (`BottomPanel.tsx:248-256`).

## Clean‑Slate Reload Behavior
- Schema:
  - Implement “New” and “Reset to Defaults” as clean‑slate operations based on `defaultSchema` (`SchemaEditorPanel.tsx:102-127`).
  - Ensure any derived caches (unique types/labels) recompute after reset: memoized off `schema` only (`SchemaEditorPanel.tsx:76-80`).
  - Add a guarded “Clear Customizations” that strips styles/rules (`SchemaEditorPanel.tsx:129-134`).
  - After any reset, clear local error state and reformat JSON consistently (match Bottom Panel’s formatting flow `useCodeJsonEditor.ts:6-29`).
- Settings:
  - Introduce “Reset to Defaults” that writes defaults, not just re‑reading current values:
    - Extend `settingsRegistry` entries with an optional `default` provider drawn from store’s initializers (e.g., `uiSlice.ts:11-15` for opacity/height) and env constants (`registry.ts:81-93`).
    - Add `resetToDefaults` that iterates registry and calls `write(default)` when writable; then reload `values` from `read()` to ensure no stale UI cache (`SettingsPanel.tsx:73-78`).
  - Retain existing “Reset” to drop unsaved edits only; add a “Revert” to re‑read persisted values for single entry (mirrors Bottom Panel’s `Revert` behavior `BottomPanel.tsx:252-255`).
- Both panels:
  - Clear any timers/subscriptions on unmount to prevent leaks (pattern in `BottomPanel.tsx:181-188`).

## Utilities Extraction
- Create feature‑scoped utilities under `canvas/src/features/panels/utils`:
  - `json.ts`: `tryFormatJson`, `safeStringify`, error messages; used by Bottom, Schema.
  - `editor.ts`: caret preservation, `centerBlock`, `countLinesUpTo`, `smoothScrollTextareaToCenter` adapters; shared between code editors.
  - `idle.ts`: `scheduleIdle` with fallback (`bottom-panel/utils.ts:11-15`).
  - `header.tsx`: lightweight `React.memo` wrappers for `TabHeader` and `ActionsRow` to standardize memoization.
- Preserve existing import surfaces by re‑exporting from previous paths where needed to avoid breaking API.

## Performance & Stability
- Memoization:
  - Memoize actions arrays and callbacks with `useMemo`/`useCallback` to avoid re‑creating functions on every render in `SettingsPanel` and `SchemaEditorPanel`.
  - Use `useDeferredValue` for search fields where lists are large (mirror Bottom Panel `BottomPanel.tsx:50`), supplement `useDebouncedValue` as appropriate.
- Re‑render control:
  - Wrap `TabHeader` and `ActionsRow` with `React.memo` and ensure props are stable.
  - Split large sections in Schema Editor into smaller memoized components (`TypesSection`, `PropertiesSection`, `AdvancedSection` are already split; enforce prop stability).
- Leak prevention:
  - Standardize timer cleanup and pointer listeners following `useDragResize` and Bottom Panel’s cleanup patterns (`BottomPanel.tsx:181-188`, `useDragResize.ts:27-31`).
- Virtualization:
  - Respect `enableVirtualTables` (`useGraphStore.ts:136-140`) in nodes/edges tables; ensure `SettingsPanel` large lists can optionally virtualize if needed.

## File Size & Organization
- Keep each panel file under 600 lines (ESLint guard `registry.ts:109-114`).
- Move helper functions (e.g., `renderInput` in `SettingsPanel.tsx:80-107`) into `features/settings/ui.tsx` and import back to keep the panel focused.

## API Compatibility
- External API remains unchanged: component names, exported hooks, and props stay intact.
- Provide shims or re‑exports for any moved utilities to avoid breaking imports.

## Verification
- Manual flows:
  - Schema clean‑slate: New → Apply → derived lists update; Reset → default restored.
  - Settings clean‑slate: Reset to Defaults → Apply All → store values match defaults; Revert confirms persistence.
  - Bottom Panel retained behavior with no regressions.
- Performance checks:
  - Confirm reduced re‑render counts using React DevTools while typing/searching.
  - Confirm no dangling timers/listeners on unmount.

## Deliverables
- Unified headers/actions across panels.
- Clean‑slate operations implemented and reliable.
- Shared utilities extracted and memoization tightened.
- Non‑breaking refactor with line‑count boundaries and leak prevention.
