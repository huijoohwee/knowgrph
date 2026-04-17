# Knowgrph Flow Editor Node Quick Editor Document

**Context**: Flow Editor 2D renderer node editing
**Intent**: Provide a fast in-canvas edit surface for selected nodes without opening full inspectors
**Directive**: Reuse SSOT UI tokens (typography, icon sizing, opacity) and persist only canonical LS keys from `canvas/src/lib/config.ls.ts`

---

## Surface Contract

- **Surface**: an in-canvas overlay positioned near the selected Flow Editor node.
- **Shell**: reuse the host `FloatingPanel` element wrapper for consistent ARIA + theming.
- **Semantics**: semantic HTML only (`aside/section/header/nav/menu/form/fieldset/legend/label/input/select/textarea/button/table/thead/tbody/tr/th/td`).
- **Frontmatter-only policy**: When the 2D renderer is Flow/Flow Editor, the active view graph comes only from frontmatter-flow data; keyword/table/composed-source pipelines stay disabled so other document modes/renderers cannot mutate Flow Editor graph state.
- **Key/Value rows**: Node, Smart fields, Mapping, and Registry fields render as schema-like rows with **In Port / Key / Type / Value / Out Port** columns (1%/29%/10%/59%/1%) using SSOT typography/tokens; port dots render for every key row and value inputs/selects align to the same left/right borders without horizontal scrolling.
- **Toolbar**: AI-Flow-style icon toolbar for quick actions; hidden by default and shown only when the node is selected (top-center, outside the panel border), with no “More” menu.

---

## Supported Behaviors (MVP)

- **Pin/Unpin**: pin locks the overlay to node-anchored positioning with an adjustable anchor offset; unpin detaches (floating) and enables header drag, persisting a viewport position.
- **Containment envelopes**: layer/subgraph/cluster/group borders in Flow Editor must use a containment-safe AABB union (`explicit bounds ∪ computed member footprint`) so initialized quick-editor-heavy node sets do not render outside group borders on first paint.
- **Pinned panel extents**: containment AABBs must also include zoom-aware pinned quick-editor panel world extents (actual panel box) for member nodes so group borders, edge blockers, and label avoidance remain consistent at every zoom level.
- **Drag**: when unpinned (detached), header drag moves the overlay freely in the viewport (ignores pointerdown on interactive elements); when pinned, header drag adjusts the anchor offset so overlays and edges follow the pointer without bounce.
- **Pinned multi-drag**: dragging a pinned overlay applies the same offset to all pinned overlays in the open list to preserve relative layout.
- **Minimize/Restore**: collapses the editor body to header-only.
- **Opacity**: inherits `uiPanelOpacity` from UI settings.
- **Scroll isolation**: scrolling inside the editor must not zoom the canvas; mark the overlay as a wheel-ignore zone and guard wheel-zoom handlers via SSOT selector `UI_SELECTORS.canvasWheelIgnore`. In Flow Editor, overlay wheel-ignore must not be able to block wheel zoom if the top-most element under the pointer is still the canvas.
- **Toolbar actions**: open selected node in Sidepane, enable Handles for all inputs, convert selected node to a Loop node (schema + draft-graph edits only; no hidden background work; idempotent updates). The toolbar hides on unselect or outside click.
- **Baseline lock**: enable-handles action is gated when Document Structure baseline lock is enabled.
- **Multi-node overlays**: multiple Node Quick Editors may be open at the same time; overlays must remain visible and operable without DOM id collisions.
- **AI profile awareness**: Flow Editor Manager should surface the active official AI profile (BytePlus/OpenAI/local), region, and model through the shared chat settings path and link back to MainPanel Settings `chat` search instead of duplicating provider controls.

### Multi-node layout (detached)

- Detached overlays must avoid full overlap. Default placement must use a deterministic grid/stack derived from the open-list order and the current viewport dimensions (no stale 0×0 viewport refs).
- Pinned overlays seeded without existing world positions should distribute evenly inside the nearest containment group envelope first; if no containment group exists, use a deterministic centered viewport grid fallback.
- Persist detached positions per node id so reopening multiple editors restores a stable layout.
- When multiple detached overlays overlap, run a bounded collision pass that keeps the first overlay fixed and pushes others, using measured panel sizes and clamping back into the viewport.

## Live Sync (Canvas ↔ Editor Workspace ↔ Graph Data Table)

- **Open state SSOT**: `openQuickEditorNodeIds` is stored in shared graph view state, not local component state.
- **Canvas + Table parity**: Flow Editor canvas and Graph Table Inspector render the same Node Quick Editor panel when a node id is in the open list.
- **Editor Workspace codes**: Editor Workspace surfaces Node Quick Editor as bundle codes inside the Markdown editor/viewer (JSON/Markdown), without mounting a second quick-editor panel.
- **Prune on data change**: when `GraphData` changes, prune the open list to ids that still exist.

## Performance Invariants

- **Drag**: unpinned overlay drag must not trigger a render per raw pointermove; throttle state updates to animation frames.
- **Drag**: overlay header drag must lock global user-select so text never gets selected while dragging.
- **Pan/Zoom**: keep screen-space overlays in sync with the renderer transform during active panning (rAF-throttled zoom-state commits).
- **Pan/Zoom**: overlay positioning should prefer the live renderer transform (runtime) over store zoom state when available, to avoid restart-time key mismatches and stale keyed zoom.
- **Pan/Zoom**: if interval-gating is used, keep it bounded and avoid end-of-pan snap.
- **Pan/Zoom**: avoid forced layout reads in hot paths; prefer `offsetX/offsetY`-based local coordinates for canvas pointer/wheel interactions and only fall back to `getBoundingClientRect()` when offsets are unavailable.
- **Collision settling**: during node/group drag, collision relaxation must be rAF-throttled and step-bounded; large graphs may disable drag-time relaxation and rely on commit-time settling.
- **Render isolation**: zoom/pan should not re-render the editor form. Keep zoom-dependent work in a thin layout wrapper and memoize the panel body.
- **Anchor stability**: avoid rounding anchor positions during pan/zoom; use subpixel translate to prevent shimmy.
- **Multi-overlay safety**: all form control `id` values must be scoped per node to prevent label/input targeting collisions.

## Edge Rendering (Flow Editor)

- Flow Editor must reuse the native Flow renderer edge drawing (routing + style) for port-bound edges; avoid a second overlay-only edge rendering path that can drift.
- When Node Quick Editors are open, edges remain visible in the Flow renderer; the Quick Editor contributes the port-dot interaction surface.

---

## Zoom Behavior (Macro View)

- The overlay is **screen-space UI**, but it **scales** with the canvas zoom so it remains readable and consistent with user expectations in flow editors.
- Scale is computed from the schema zoom extent (`minK/maxK`) and current zoom `k`, then applied via CSS `transform` (translate + scale) to keep updates on the compositor path.
- **Macro view rule**: at **max zoom-out** and **max zoom-in**, the panel stays **small** (same size at both extremes) so the user can keep a wide overview.
- SSOT implementation lives in `canvas/src/components/FlowEditor/nodeQuickEditorZoom.ts` and must be reused by any future quick-editor overlays.
- Default detached placement SSOT lives in `canvas/src/components/FlowEditor/nodeQuickEditorLayout.ts`.

---

## Port Handles (Flow Editor)

- Port Handles are toggled via `schema.behavior.portHandles.enabled`.
- Node Quick Editor “Enable Handles for All Inputs” sets `schema.behavior.portHandles.enabled=true` and `schema.behavior.portHandles.showAllInputs=true` so Flow nodes without edges still render default in/out handles (visual + routing parity, bounded work).
- Shared gating helper is `isPortHandlesShowAllInputsEnabled(schema)` so Flow scene-building and UI actions cannot drift.
- For `metadata.kind=frontmatter-flow` overlays, quick-editor handle rendering must stay strict and flow-derived: use declared flow handles plus edge/registry-derived typed ports only, and do not synthesize fallback default handles.
- Frontmatter-flow overlay contracts must not render absent hardcoded ports (for example `compute` or `data`) unless those keys are explicitly present on the node properties.

### Schema Field Ports (Database-schema-node style)

- If a node carries `node.properties['schema:fields']` (array of strings or `{id|title,type}` objects), the Node Quick Editor renders a **schema field list** and places **row-aligned input/output port dots** that intersect the panel border line; in/out dots appear for every key row to keep the port grid continuous.
- The schema field surface is an inline **schema table editor** (semantic `table/thead/tbody/tr/th/td`), allowing users to add/remove fields and edit field name + type without leaving the canvas.
- When a schema field is renamed, any port-bound edges attached to that field must be rewritten to the new port key (`field:<nextId>`) and `edge.properties['flow:displayLabel']` must be recomputed to match.
- When creating edges in Flow Editor, edges may bind to specific ports using:
  - `edge.properties['flow:sourcePortKey']`
  - `edge.properties['flow:targetPortKey']`
  - Values are stable port keys, e.g. `field:<fieldId>`.
- When ports are present, schema-field edges are validated by:
  - `schema.endpointMatrix[edge.label]` (source/target node types)
  - Schema port existence (port key must refer to a field on that node)
  - Schema field type compatibility when both sides provide `type`
- Flow scene building attaches edge endpoints to these handle ids (falling back to `edge.id` when absent) and handle computation generates stable `field:<id>` handles so routing + port markers remain deterministic.
- Optional UI label override for port-bound edges: `edge.properties['flow:displayLabel']` (e.g., `warehouse_id → id`).
- When the Node Quick Editor is open, the selected node’s native FlowCanvas port handles are hidden to avoid duplicate “detached” dots; the quick editor is the active port UI surface.

### Edge Creation Paths

- Flow Editor canvas handle drags create edges; when a port dot is the source/target, edges set `edge.properties['flow:sourcePortKey']` / `edge.properties['flow:targetPortKey']` (else fall back to `edge.id`).
- Node Quick Editor port dots are the edge-creation surface for the selected node while the overlay is open.
- Port-bound edges may set `edge.properties['flow:displayLabel']` to surface a stable UI label (e.g., `sourceKey → targetKey`).

### Registry-Driven Forms (Flow Editor Manager)

- When a matching **enabled** entry exists in the Node Quick Editor Registry (Flow Editor Manager), the Node Quick Editor renders an additional **Registry** section for the selected node type.
- Registry fields read/write values via `schemaPath` (defaulting to `properties.<fieldKey>` when omitted).
- Registry ports render as clickable in/out ports and create edges bound via `flow:sourcePortKey` / `flow:targetPortKey`.
- Optional per-field/per-port visibility: `isHidden: true` hides the field/port from the Node Quick Editor UI and suppresses Flow port handles.
- Optional per-node overrides:
  - `node.properties['flow:quickEditorTypeId']`
  - `node.properties['flow:quickEditorFormId']`
- The mapping selector stays visible even when the quick editor fields are hidden; clearing the selection removes the override keys.
- The Smart Fields section includes a registry selector filtered to enabled mappings for the node type; selection updates the two override keys and emits a lightweight toast with the mapping label for visual confirmation.

### Mapping Editor (Flow Editor Manager)

- Mapping rows render in a schema-like table with **Key / Type / JSON Key / Direction** columns (SSOT typography + tokens).
- Direction options are `Default` (show input + output in Quick Editor), `input` (input-only), and `output` (output-only); values persist in registry entries.
- Apply/Reset in the MainPanel header gates persistence; Apply is enabled only when edits are dirty.
- The editor header owns the Add Row action; avoid nested section headers in the editor body.

---

## In-Editor Dataflow (Connected Inputs → Quick Editor)

- **Goal**: allow a node editor to reflect upstream values in real time, without copying external Flow libraries.
- **Inputs**: edges bound to ports via `edge.properties['flow:sourcePortKey']` / `edge.properties['flow:targetPortKey']`.
- **Port schemaPath**: registry `ports[].schemaPath` defines how a port reads/writes values on the node shape (defaults to `properties.<portKey>`).
- **Compute model (MVP)**:
  - For each node open in the Node Quick Editor overlay, compute a `connectedValuesBySchemaPath` map.
  - The compute path is shared across Flow Editor and Table Inspector so connected-value semantics do not drift across modes.
  - For each connected input port, the UI surfaces a **Connected:** hint next to the mapped field and provides an **Apply** action.
  - Applying writes the value into `node.properties` at the field schemaPath (using object-path setters), making the value explicit and exportable.
- **Propagation model (MVP)**:
  - Connected values are computed across upstream chains (A → B → C) without requiring intermediate nodes to mutate their stored properties.
  - The dataflow iteration is bounded and converges to a stable connected-value map (no unbounded loops).
- **Transform model (MVP)**:
  - Optional `registryEntry.schemaMappings[]` applies simple path-to-path transforms during compute.
  - `fromPath` is evaluated against a node-local context object `{ in, node }` where:
    - `in.<portKey>` is the current connected input value for that port key.
    - `node.<label|type|properties|metadata>` is the node’s own data.
  - `toPath` targets the node shape (normalized to `properties.*` when needed) and is surfaced as another computed connected value.
  - Optional `reduceId` applies when `fromPath` resolves to an array, then optional `transformId` applies to the reduced value.
  - Built-in ids are defined in `canvas/src/lib/flowEditor/flowDataflowTransforms.ts` and include:
    - Transforms: `identity`, `trim`, `lower`, `upper`, `to_number`, `to_boolean`, `stringify_json`, `json_parse`, `first`, `last`, `length`, `join_lines`, `join_comma`.
    - Transforms (computed preview helpers): `rgb_css`, `rgb_hex`, `contrast_text`.
    - Reducers: `first`, `last`, `concat_array`, `join_lines`, `join_comma`.
- **Auto-apply (MVP)**:
  - The Registry section includes an Apply All action that fills empty fields from connected values.
  - Optional Auto-apply continuously fills empty fields as connected values update, without mutating GraphData during compute.
- **Non-mutation rule**: connected values are computed at render time; the pipeline must not silently mutate `GraphData` while computing.

### Code Locations

- Dataflow compute: `canvas/src/lib/flowEditor/flowDataflow.ts`
- Overlay wiring: `canvas/src/components/FlowEditorCanvas.tsx`
- Connected-value UI hints: `canvas/src/components/FlowEditor/NodeOverlayEditorRegistrySection.tsx`

---

## Import / Export JSON Contract (Node Quick Editor Bundle)

### Canonical Bundle Shape

- **Kind**: `kg:flow:nodeQuickEditorBundle`
- **Version**: `1`
- **Purpose**: a project-agnostic JSON envelope that can carry:
  - a Node Quick Editor registry snapshot (`registry`)
  - an optional graph payload (`graph`) for import→render round-trips

```json
{
  "kind": "kg:flow:nodeQuickEditorBundle",
  "version": 1,
  "registry": [
    {
      "id": "qer-VideoGeneration-default-videoGeneration",
      "isEnabled": true,
      "nodeTypeId": "VideoGeneration",
      "quickEditorTypeId": "default",
      "formId": "videoGeneration",
      "fields": [{ "fieldKey": "prompt", "fieldType": "textarea", "schemaPath": "properties.prompt", "isHidden": false }],
      "ports": [{ "portKey": "videoUrl", "direction": "output", "isHidden": false }],
      "schemaMappings": [
        { "fromPath": "in.image", "toPath": "properties.reference_image", "transformId": "first" }
      ],
      "updatedAt": "2026-02-06T00:00:00.000Z"
    }
  ],
  "graph": { "type": "Graph", "nodes": [], "edges": [] }
}
```

### Import → Render Wiring

- On import, parsers may emit registry entries into `GraphData.metadata['flow:nodeQuickEditorRegistry']`.
- The graph commit path reads this metadata and applies it via the store action `setNodeQuickEditorRegistry(...)` (validated + normalized), enabling immediate Node Quick Editor rendering for matching `node.type`.
- The JSON import UX auto-switches to **Canvas → 2D → Flow Editor** when this metadata key is present so the imported workflow opens in an editor-first surface.

### Supported Import Shapes (Project-Agnostic)

- **Node Quick Editor bundle**: `kg:flow:nodeQuickEditorBundle` (registry + optional graph payload).
- **AI-Flow processor list**: array of processors that can be normalized into:
  - `GraphData.nodes[]` for processors
  - `GraphData.metadata['flow:nodeQuickEditorRegistry']` for per-processor quick editor fields/ports
- **ComfyUI workflow**: workflow JSON normalized into a minimal `VideoGeneration` graph plus a default registry entry for immediate Quick Editor rendering.

### Export Surface

- Flow Editor Manager exports either:
  - the selected mapping (preferred), or
  - all mappings (fallback)
  as a `kg:flow:nodeQuickEditorBundle` JSON.
- Flow Editor Inspector exports a full workflow bundle (draft graph + current registry snapshot).
- Flow Editor Inspector “Run” exports a per-node bundle (subgraph around the node + matching registry entries).

---

## Workflow Editor-like Drag-and-Drop (Palette → Canvas)

- **Surface**: Flow Editor Manager (MainPanel) exposes a **Node Quick Editor palette** sidebar.
- **Drag payload SSOT**:
  - `kind='kg:flow:nodeQuickEditorDrag'`
  - `version=1`
  - `mime='application/x-kg-flow-node-quick-editor'`
- **Drop target**: Flow Editor canvas accepts drops and creates a new node at the drop location (world coordinates).
- **Node binding**: created nodes set the per-node override keys so the registry entry is selected deterministically:
  - `node.properties['flow:quickEditorTypeId']=<entry.quickEditorTypeId>`
  - `node.properties['flow:quickEditorFormId']=<entry.formId>`

### Manager Shortcut (Add From Quick Editor)

- Flow Editor Manager provides an "Add from Quick Editor" action that seeds a new registry mapping using the currently selected node type and the Node Quick Editor smart fields schema paths.

## Loop Node Semantics (Flow Editor)

- Convert-to-loop sets `node.type='Loop'` and `node.properties['workflow:kind']='loop'` for the selected node (draft graph only until commit).
- Conversion is idempotent (re-running does not churn graph objects).

---

## Persistence (SSOT)

- All persistence keys are defined in `LS_KEYS` in `canvas/src/lib/config.ls.ts`:
  - `LS_KEYS.flowNodeQuickEditorPinned`
  - `LS_KEYS.flowNodeQuickEditorMinimized`
  - `LS_KEYS.flowNodeQuickEditorHideFields`
  - `LS_KEYS.flowNodeQuickEditorTopPx`
  - `LS_KEYS.flowNodeQuickEditorLeftPx`

---

## Code Locations

- Panel controller (positioning + persistence + toolbar/menu):
  - `canvas/src/components/FlowEditor/NodeOverlayEditor.tsx`
- Panel shell (FloatingPanel body + actions):
  - `canvas/src/components/FlowEditor/NodeOverlayEditorPanel.tsx`
- Form surface (fields mapped to `node.properties`):
  - `canvas/src/components/FlowEditor/NodeOverlayEditorForm.tsx`
- Schema field table editor:
  - `canvas/src/components/FlowEditor/NodeOverlayEditorSchemaTable.tsx`
- Registry section extraction:
  - `canvas/src/components/FlowEditor/NodeOverlayEditorRegistrySection.tsx`
- Key/Type/Value schema-like row table:
  - `canvas/src/components/FlowEditor/NodeOverlayEditorKvTable.tsx`
- Port-key helpers (SSOT):
  - `canvas/src/lib/graph/flowPorts.ts`
