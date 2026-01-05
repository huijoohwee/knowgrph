## Overview
- Replace the hardcoded "Edit Node" form in the right sidebar with a dynamic, read-only field viewer for the selected node.
- Remove duplicated editing UI from the sidebar; keep editing in the Bottom Panel "Data" tab.
- Show fields detected from the loaded CSV/JSON, including `type`, `name`, `description`, `image`, `reference`, `properties`, `degree`.

## Changes
- Remove the static form header and inputs from `NodeEditor` and the save button.
- Render a normalized field list derived from the selected node and its `properties`.
- Compute `degree` from incident edges and display it.
- Keep the existing "Related Nodes" and "Edges" sections under the field viewer.

## Field Mapping
- `name`: prefer `node.label`; fall back to `node.properties.name` if present.
- `type`: from `node.type`.
- `description`: from `node.properties.description`.
- `image`: from `node.properties.image` (render URL as image/thumb when valid).
- `reference`: from `node.properties.reference` (render URL as link when valid).
- `degree`: count of edges where `e.source === node.id || e.target === node.id`.
- `properties`: include remaining keys from `node.properties` not listed above; show nested JSON pretty-printed.

## UI Details
- Sidebar `NodeEditor` renders:
  - Placeholder when no selection: "Select a node to edit its properties."
  - When a node is selected: a "Fields" section listing key/value rows (monospace for JSON), then "Related Nodes" and "Edges".
- Do not include editing inputs or a "Save Changes" button; the Bottom Panel remains the edit surface.
- Add simple safeguards:
  - Treat non-string values via `JSON.stringify(value, null, 2)`.
  - Detect URL strings for `image`/`reference` via `^https?://`.

## Verification
- Load the test dataset via the existing "Test JSON" button.
- Select a node (e.g., Instacart) and verify the sidebar shows: `type`, `name`, `description` (if present), `image`/`reference` if present, `degree`, and the remaining `properties`.
- Confirm the Bottom Panel still allows editing; changes propagate to the field viewer.

## Code References
- Sidebar mounting: `canvas/src/pages/Canvas.tsx:75-79`.
- Node editor component: `canvas/src/components/NodeEditor.tsx:49-123` (placeholder at `51-53`, hardcoded form at `59-92`, related nodes/edges at `94-122`).
- Types: `canvas/src/lib/graph/types.ts:1-10` (node) and `12-18` (edge).
- JSON-LD import/export: `canvas/src/lib/graph/jsonld.ts:3-58` (parse) and `60-80` (toJsonLd).
- Test JSON mapping: `canvas/src/lib/graph/unicornLoader.ts:6-15` (nodes) and `17-26` (edges).
