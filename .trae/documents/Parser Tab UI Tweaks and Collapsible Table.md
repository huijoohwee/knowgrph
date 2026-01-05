## Goals
- Rename the Parser tab action from "Load File" to "Load Data"
- Add a default-collapsed tabular view that expands on demand
- Show a table of Nodes/Edges after: Load Data → Select Parser → Apply Parser
- Keep changes feature-scoped, small, and non-breaking; avoid re-renders/leaks and improve memoization

## UI Changes
### Actions Row
- Update the action label passed by ParserView to "Load Data"
- Preserve the existing "Apply Parser" action

### Collapsible Table
- Add a collapsible section in ParserView right below counts
- Default: collapsed; header shows a toggle (Expand/Collapse)
- When expanded, render a simple tabbed table: Nodes and Edges
  - Nodes: columns `id`, `label`, `type` (with a limited properties preview)
  - Edges: columns `id`, `source`, `target`, `label`
- Use the store `data` from `useGraphStore(s => s.data)` (populated after applying parser)
- Memoize rows and derived slices to avoid unnecessary rerenders

## Implementation
### Files
- Update: `canvas/src/features/panels/views/ParserView.tsx`
  - Change ActionsRow actions array label to "Load Data"
  - Add local state `tableCollapsed` (default true) and a toggle button
  - Render the new Table component when expanded and `data` exists
- Add: `canvas/src/features/parsers/ui/ParserTable.tsx`
  - Stateless presentational component receiving `data`, `activeTab`, and `onTabChange`
  - Memoize `nodeRows` and `edgeRows` using `useMemo` keyed by lengths and ids
  - Keep file under ~200 lines
- Add: `canvas/src/features/parsers/ui/index.ts` barrel export (optional)

### Performance & Safety
- Use `useMemo` based on `data.nodes.length`, `data.edges.length`, and shallow ids to avoid churn
- Avoid effects; pure rendering; no subscriptions beyond store selector
- No new global state or side effects

## Non-Goals
- Do not modify IO or parser registry behavior
- No schema validation changes (toggle already exists)

## Verification
- Manual: Open Parser tab, confirm button label shows "Load Data"; apply a parser; expand the table; confirm node/edge rows render
- Automated: Light smoke test for table render not required; existing parser tests cover data path; focus on manual UI verification

## Code References
- ParserView: `canvas/src/features/panels/views/ParserView.tsx`
- Actions row: `canvas/src/features/panels/ui/ActionsRow.tsx`
- Store data access: `useGraphStore` (e.g., `data` used in ParserView)

## Notes
- All changes remain feature-scoped; no breaking API changes
- Keep components small (< 200 lines) and pure to prevent leaks