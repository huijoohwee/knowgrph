## Objectives
- Rebuild Schema Panel and Settings Panel from a clean slate, mirroring Help button UI patterns.
- Extract utilities into feature-scoped modules while preserving existing public API.
- Remove conflicting/hardcoded/stale/duplicate code; prevent re-render storms, infinite loops, and memory leaks.
- Enhance cache, memory, and memoization performance across panels and graph features.

## Current State Overview
- Panels live under overlays controlled by the toolbar; Help is a dropdown anchored to the Help `IconButton`.
  - `SchemaEditorPanel`: `canvas/src/components/SchemaEditorPanel.tsx`
  - `SettingsPanel`: `canvas/src/components/SettingsPanel.tsx`
  - Help dropdown and triggers: `canvas/src/components/Toolbar.tsx` (circa 242–255)
- Panel UI helpers: `canvas/src/features/panels/ui/*` (`PanelContainer`, `PanelHeader`, `TabHeader`, `ActionsRow`).
- Useful utilities: `canvas/src/lib/utils.ts`, `canvas/src/lib/persistence.ts`, `canvas/src/features/panels/utils/*`, `canvas/src/features/toolbar/utils.ts`.
- Caching/memoization exists ad hoc (e.g., `WeakMap` adjacency cache in `GraphCanvas/simulation.ts`).
- Noted issues to address:
  - Event listener cleanup gaps in `CollapsiblePanel.tsx` and `useDragResize.ts`.
  - Stale reads dependency risk in `BottomPanel.tsx`.
  - Re-render hotspots and heavy effects in `GraphCanvas.tsx`.

## Panel Redesign
- Create a consistent panel frame that mirrors Help UI affordances:
  - Introduce `PanelFrame` with composed `PanelHeader`, `PanelBody`, `PanelFooter`, and `PanelActionsRow` for uniform styling and behavior.
  - Use the Help `IconButton` style for panel triggers and in-panel action buttons to unify visual language.
- Rebuild `SchemaEditorPanel` and `SettingsPanel` as declarative, small components:
  - Extract subcomponents (forms/sections/tabs) into `features/schema/ui/*` and `features/settings/ui/*`.
  - Keep props and callback signatures stable; re-export legacy names to avoid breaking call sites.
- Overlay behavior
  - Standardize modal overlays via `lib/ui/overlay.tsx` (`DropdownPanel`/modal) with consistent focus trap, ESC close, and outside-click handling.
  - Make Help dropdown a reference pattern for panel header actions and compact layouts.

## Utilities Extraction (Feature-Scoped)
- Organize by feature to keep files < 600 lines and improve discoverability:
  - `features/schema/{ui,utils,state,types}/` and `features/settings/{ui,utils,state,types}/`.
  - Move panel-specific helpers from `features/panels/utils/*` into their respective feature folders; retain barrel re-exports to preserve API.
  - Consolidate shared UI helpers under `lib/ui/*` (icons, classnames `cn`, overlay primitives), and shared persistence under `lib/persistence.ts`.
  - Graph-related helpers under `features/graph/*` (adjacency, fit, drag, highlight) with `index.ts` re-export mirroring current public paths.
- Preserve current imports by adding `index.ts` barrels and temporary re-exports from old locations during the transition.

## Performance & Stability Fixes
- Event listener leaks
  - `CollapsiblePanel.tsx`: store `onMove`/`onUp` in refs and remove exact references in cleanup.
  - `useDragResize.ts`: add unconditional cleanup for document listeners in effect return; track active handlers via refs.
- Effects and stale dependencies
  - `BottomPanel.tsx`: remove stale read risks by including missing dependencies or restructuring effect logic.
  - Split heavy effects in `GraphCanvas.tsx`: separate simulation init/update from visual highlighting/zoom.
- Re-render control
  - Memoize derived data with `useMemo` and stabilize store callbacks.
  - Throttle/idle-schedule expensive scroll/center operations; dedupe repeated work.

## Caching Strategy Enhancements
- Adopt a consistent cache layer:
  - `WeakMap` per-data caches for graph-derived adjacency/geometry.
  - Introduce a small `LRUCache` utility with configurable `maxSize` and optional `ttl` for search/minimap derived data and schema parsing.
- Normalize memoization:
  - Wrap compute-heavy functions (search ranking, minimap aggregation, CSV/JSON-LD transforms) with memo/LRU.
  - Use `useDebouncedValue` and `scheduleIdle` for UI-bound, non-critical computations.
- Provide explicit invalidation APIs (e.g., `clearAdjacencyCacheFor(data)` patterns) for correctness after mutations.

## File Size Discipline (< 600 lines)
- Split large or dense components into subcomponents and hooks:
  - `GraphCanvas.tsx`: extract simulation orchestration to `features/graph/simulation.ts` and interaction hooks.
  - Panels: move tabs/sections into small files, export via barrels.
- Add lightweight lint rule or CI check for file line count; enforce during refactor.

## Testing & Verification
- Unit tests for cache utilities (LRU correctness, TTL expiry, invalidation).
- Component tests for panels (open/close, focus management, hotkeys).
- Integration tests for Help-like actions on Schema/Settings panels.
- Manual validation:
  - Inspect DevTools for detached listeners after panel open/close and drag operations.
  - Use React Profiler to confirm reduced re-renders for `GraphCanvas` and panels.

## Migration & Risk Management
- Keep existing public API stable via re-exports; perform incremental import path updates with codemods if needed.
- Remove hardcoded values by centralizing defaults in `features/*/config.ts`.
- Document cleanup of duplicate logic and stale code; add deprecation notes where relevant.

## Deliverables
- New `PanelFrame` and rebuilt `SchemaEditorPanel` + `SettingsPanel` mirroring Help UI.
- Feature-scoped modules with preserved API via barrels.
- Fixed leaks and optimized effects with verified lower re-render counts.
- Unified caching utilities and improved performance in graph/search/minimap flows.
- Tests and a short runbook for maintenance and future contributions.