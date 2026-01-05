## Canvas Toolbar: Global Search Button
- Insert a `Search` button immediately to the right of `Fit to Screen` in `src/components/Toolbar.tsx:284-286` using the existing `IconButton` and `lucide-react` `Search` icon.
- Add local state: `isSearchOpen`, `searchBtnRef`, `searchPanelRef`, `query`.
- Use existing `DropdownPanel` (`src/lib/ui/overlay.tsx:61-66`) anchored to the Search button for the search UI.

## Search Behavior
- Create shared `searchGraph(data, query)` utility (feature-scoped) that searches across both nodes and edges:
  - Nodes: match on `id`, `label`, `type`, and JSON-serialized `properties` (same fields BottomPanel filters today in `src/components/BottomPanel.tsx:86-98`).
  - Edges: match on `id`, `label`, `source`, `target`, and JSON-serialized `properties` (same as `src/components/BottomPanel.tsx:100-115`).
  - Case-insensitive substring matching; return top-N results (e.g., 50) ordered by simple heuristics (exact id match first, then label/type, then properties).
- Define a discriminated union `SearchResult` with `kind: 'node' | 'edge'`, `id`, `title`, and minimal `meta` to render.
- Location: `src/features/search/search.ts` (new feature-scoped module) and `src/features/search/types.ts`.

## Results Panel UX
- Panel content:
  - Input field with 150ms debounce; clear button when non-empty; ESC to close.
  - Two sections: `Nodes` and `Edges` with counts; each item shows `title` and subdued `meta` (e.g., type or endpoints).
  - Click selects the entity via store and closes the panel.
  - Keyboard: Enter selects the top result; Up/Down arrow to navigate list.
- Store integration: use `useGraphStore` `data`, `selectNode`, `selectEdge` (`src/hooks/useGraphStore.ts`). The existing canvas effect auto-fits to selection (`src/components/GraphCanvas.tsx:282-299`).

## DRY Refactor: Shared Search Utilities
- Extract the filtering logic from BottomPanel to reuse the shared utility:
  - Move `normalized` and `jsonStr` helpers plus filter functions out of `src/components/BottomPanel.tsx:77-85, 86-115, 100-115` into `src/features/search/search.ts`.
  - Update BottomPanel to import and call the utility for nodes/edges filtering, preserving its public behavior and UI.
- Extract sort helpers from BottomPanel:
  - Move `sortBy`, `toggleNodeSort`, `toggleEdgeSort` into `src/components/BottomPanel/sort.ts` and import in `BottomPanel.tsx` to reduce file size while keeping the same API.

## Cleanups and Consistency
- Replace the manual neighbor-id computation in the selection-highlighting effect with the existing helper `buildNeighborIds` (`src/components/GraphCanvas/simulation.ts:33-42`) to avoid duplicated logic in `src/components/GraphCanvas.tsx:214-243`.
- Keep file sizes under 600 lines; the current `GraphCanvas.tsx` (~441 lines) and `BottomPanel.tsx` (~456 lines) stay under this threshold after extractions.
- Avoid hardcoded strings in new code; reuse existing patterns (`IconButton`, `DropdownPanel`) and tailwind classes already in use.

## Types and API Preservation
- No breaking changes to existing component APIs.
- Add new feature-scoped types in `src/features/search/types.ts` and export them from `src/features/search/index.ts` for discoverability.

## Verification
- Manual checks:
  - Button renders next to `Fit to Screen` and opens/closes correctly.
  - Searching finds nodes and edges consistently with BottomPanel results.
  - Selecting a result highlights and auto-fits as before.
  - Works with empty data and empty query.
- Optional unit tests for `searchGraph` with small sample graphs.

## Rollout
- Implement the Search button and shared utility; refactor BottomPanel to use the utility.
- Keep changes localized, follow existing styling/components, and avoid conflicting/duplicate code paths.