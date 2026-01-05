# Knowgrph Configurable Schema Documentation

### Type‑Safe Schema IO
- Export helpers accept `SchemaConfigPath` for suggested filenames: `exportSchemaAsJSON`, `exportSchemaAsJsonLd`, `exportSchemaAsCsv`.
- Workflow presets return schema paths as branded `SchemaConfigPath` via `getWorkflowPresetPipeline` for reproducible pipelines.
| Area                   | Responsibility                                       | Modules                                                                                       | Classes/Objects                            | Functions/Methods                                                                                                          | Key                                                                      | Type                  | Value                                   | Dependencies / Imports                      | Notes                                                      | Line Range |
| ---------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------- | --------------------------------------- | ------------------------------------------- | ---------------------------------------------------------- | :-------- |
| Styling                | Configure per-type node color/size/stroke           | `canvas/src/lib/graph/schema.ts`, `canvas/src/components/GraphCanvas.tsx`                     | `GraphSchema.nodeStyles/nodeSizes/nodeStroke` | `updateNodeStyle`, `updateNodeSize`, `updateNodeStroke`                                                                     | `nodeStyles[type].color`, `nodeSizes[type].radius`, `nodeStroke[type].{color,width}` | string/number         | per‑type                                 | `React`, `d3`, `zustand`                        | applied in canvas render; editable in Schema Panel          | `canvas/src/hooks/store/schemaSlice.ts:6–30`, `canvas/src/components/GraphCanvas.tsx:90–94` |
| Styling                | Configure label font size/color/offset              | `canvas/src/lib/graph/schema.ts`, `canvas/src/components/GraphCanvas.tsx`                     | `GraphSchema.labelStyles`                   | `setLabelStyles`, `setLabelOffset`                                                                                         | `labelStyles.fontSize`, `labelStyles.color`, `labelStyles.offset.{dx,dy}`                          | number/string         | 12 / `#111111` / 12,4                   | `React`, `d3`, `zustand`                        | defaults defined in schema; editable in Schema Panel        | `canvas/src/hooks/store/schemaSlice.ts:31–41`, `canvas/src/components/GraphCanvas.tsx:162–166` |
| Styling                | Configure edge color/width/arrow                    | `canvas/src/lib/graph/schema.ts`, `canvas/src/components/GraphCanvas.tsx`                     | `GraphSchema.edgeStyles`                    | `updateEdgeStyle`, `setEdgeArrow`                                                                                           | `edgeStyles[label].{color,width,arrow}`                                              | string/number/boolean | per‑label                               | `React`, `d3`, `zustand`                        | used for link stroke and markers                          | `canvas/src/hooks/store/schemaSlice.ts:11–15,121–126`, `canvas/src/components/GraphCanvas.tsx:69–74,320–337` |
| Layout (Forces)        | Physics charge, alpha decay, collision radius       | `canvas/src/lib/graph/schema.ts`, `canvas/src/components/GraphCanvas/simulation.ts`           | `GraphSchema.layout.forces`                 | `setCharge`, `setAlphaDecay`, `setCollisionByType`, `setLinkDistanceByLabel`                                              | `layout.forces.{charge,alphaDecay,collisionByType[type],linkDistanceByLabel[label]}` | number/object         | −300 / 0.02 / per‑type / per‑label      | `d3`                                        | clamps alphaDecay [0,1]; distances ≥1                      | `canvas/src/hooks/store/schemaSlice.ts:42–65`, `canvas/src/components/GraphCanvas/simulation.ts:19–29` |
| Layout (Fit)           | Viewport fit padding                                | `canvas/src/lib/graph/schema.ts`                                                              | `GraphSchema.layout.fitPadding`             | —                                                                                                                          | `layout.fitPadding`                                                        | number                | 80                                      | —                                           | used in fit transforms                                   | `canvas/src/lib/graph/schema.ts:99–108` |
| Behavior               | Node drag, edge creation, drag constraint, snap grid| `canvas/src/lib/graph/schema.ts`, `canvas/src/components/GraphCanvas.tsx`                     | `GraphSchema.behavior`                      | `setBehavior`, `setSelectMode`, `setCreateMode`, `setHover`                                                                | `behavior.{allowNodeDrag,allowEdgeCreation,dragConstraint,snapGrid,preventDuplicatesGlobal,preventSelfLoopsGlobal,selectMode,createMode,hover,defaultNodeType}` | boolean/string/object | toggles/modes                           | `d3`                                        | toggles drag behavior and creation modes                   | `canvas/src/hooks/store/schemaSlice.ts:16–20,127–142`, `canvas/src/components/GraphCanvas.tsx:95–97,103–121` |
| Validation & Rules     | Per‑type/label property validations                 | `canvas/src/lib/graph/schema.ts`, `canvas/src/features/schema/validation.ts`, `canvas/src/features/panels/views/graph-fields/GraphFieldsListPanel.tsx`, `canvas/src/features/panels/views/graph-fields/FieldLocalSchemaSection.tsx` | `GraphSchema.validation`                    | `upsertNodeValidation`, `upsertEdgeValidation`                                                                             | `validation.{node,edge}[type|label]`                                     | object                | {}                                      | —                                           | used by validators to gate edits; edited via Schema tab Validation/Rules rows and the Graph Fields local schema Validation facet, which organizes required/types/patterns/ranges/uniqueness per node type or edge label using property names derived from `propertySchemas` and sampled graph data. | `canvas/src/hooks/store/schemaSlice.ts:66–75`, `canvas/src/features/schema/validation.ts:4–44,46–81`, `canvas/src/features/panels/views/graph-fields/GraphFieldsListPanel.tsx`, `canvas/src/features/panels/views/graph-fields/FieldLocalSchemaSection.tsx` |
| Endpoint Matrix        | Constrain edge source/target types                  | `canvas/src/lib/graph/schema.ts`, `canvas/src/features/schema/validation.ts`                  | `GraphSchema.endpointMatrix`                | `setEndpointMatrix`                                                                                                       | `endpointMatrix[label]`                                                  | object                | {}                                      | —                                           | enforced by `canAddEdge`                                    | `canvas/src/hooks/store/schemaSlice.ts:76–79`, `canvas/src/features/schema/validation.ts:83–91` |
| Cardinality            | Per‑type and per‑label cardinality limits           | `canvas/src/lib/graph/schema.ts`, `canvas/src/features/schema/validation.ts`                  | `GraphSchema.cardinality`                   | `setCardinalityNodeType`, `setCardinalityEdgeLabel`                                                                       | `cardinality.nodeType[type]`, `cardinality.edgeLabel[label]`             | object                | {}                                      | —                                           | enforced by `canAddEdge`                                    | `canvas/src/hooks/store/schemaSlice.ts:81–91`, `canvas/src/features/schema/validation.ts:91–107` |
| Templates              | Default property templates                          | `canvas/src/lib/graph/schema.ts`                                                              | `GraphSchema.templates`                     | `setNodeTemplate`, `setEdgeTemplate`                                                                                    | `templates.{node[type],edge[label]}`                                     | object                | {}                                      | —                                           | drives default values in editors                          | `canvas/src/hooks/store/schemaSlice.ts:93–104`, `canvas/src/features/schema-editor/AdvancedSection.tsx:195–217` |
| Performance (LOD)      | Hide labels below zoom scale                        | `canvas/src/lib/graph/schema.ts`, `canvas/src/components/GraphCanvas/zoom.ts`                 | `GraphSchema.performance.lod`               | `setLodHideLabelsBelow`                                                                                                   | `performance.lod.hideLabelsBelowScale`                                   | number                | 0.0                                    | `d3`                                        | label opacity throttled during zoom                      | `canvas/src/hooks/store/schemaSlice.ts:105–110`, `canvas/src/components/GraphCanvas/zoom.ts:12–26` |
| Accessibility          | High contrast mode                                  | `canvas/src/lib/graph/schema.ts`                                                              | `GraphSchema.accessibility`                 | `setHighContrast`                                                                                                         | `accessibility.highContrast`                                             | boolean               | false                                   | —                                           | applies in schema styling consumers                        | `canvas/src/hooks/store/schemaSlice.ts:111–115` |
| Legend                 | Toggle legend show/hide                             | `canvas/src/lib/graph/schema.ts`                                                              | `GraphSchema.legend`                        | —                                                                                                                          | `legend.showLegend`                                                      | boolean               | false                                   | —                                           | reserved for UI consumers                                  | `canvas/src/lib/graph/schema.ts:114` |
| 3D Visual Config       | Configure 3D arrow/opacity/curvature/sphere/particles/motion/selection | `canvas/src/lib/graph/schema.ts`, `canvas/src/features/panels/views/ParserView.tsx`, `canvas/src/features/three/ThreeGraph.tsx` | `GraphSchema.three` | `setThreeConfig`                                                                                                         | `three.{linkDirectionalArrowLength,linkOpacity,linkCurvature,sphereRadius,seed,minSpacing,linkDirectionalParticles,linkDirectionalParticleSpeed,nodeMotionIntensity,minimapOpacity,selection.selectedNodeGlowIntensity,selection.dimmedNodeOpacity,selection.dimmedEdgeOpacity,selection.selectedEdgeWidth,edgeOpacityByLabel,layerOpacityByLayer,nodeSizingFormula,edgeWidthFormula,backgroundColor,fogColor,fogNear,fogFar,cameraDampingFactor,cameraRotateSpeed,cameraZoomSpeed,cameraPanSpeed,cameraAutoRotate,cameraAutoRotateSpeed}` | number/object/string | 8 / 0.55 / 0.0 / 120 / 1 / 0 / 0 / 0.6 / 1.0 / 0.7 / 0.8 / 0.2 / 0.2 / 3 / `{ '1':1.0,'2':0.9,'3':0.8 }` / `'schema'` / `'schema'` / `'#0f0c29'` / `'#24243e'` / 140 / 340 / 0.08 / 0.45 / 0.75 / 0.5 / false / 0.0 | `React` | consumed in 3D renderer for edge/arrow geometry, per‑label edge opacity, directional particles, node motion, minimap overlay, selection glow/tint, per‑layer node opacity, camera motion, and node/edge sizing formulas; edited in Schema → Render/Advanced sections, Panel → Render, and the bottom panel Render tab AI‑KG block and `Dataset Inspector`. AI‑KG schema uses `edgeOpacityByLabel`, `layerOpacityByLayer`, `nodeSizingFormula: 'importance'`, `edgeWidthFormula: 'weight'`, `edgeStyles.*.width`, and `three.backgroundColor` overrides in the workflow preset to make important nodes larger, `requires`/`feeds`/`collects` edges denser, and foreground bands stand out against softer background layers (`schema-config/ai-kg-viz-schema.json`, `canvas/src/features/panels/views/ParserView.tsx`). | `schema.ts:89–104,147–200`, `ParserView.tsx:321–428`, `ThreeGraph.tsx:72–193,257–397`, `GraphCanvas.tsx` |
| 3D Edge Curvature      | Per‑edge curvature and rotation overrides           | `canvas/src/features/three/ThreeGraph.tsx`                                                    | edge properties                         | read per‑edge from `properties`                                                                                        | `edge.properties.{curvature,curveRotation}`                              | number                | overrides default                       | —                                           | curved tube path via quadratic bezier and rotated perpendicular basis | `ThreeGraph.tsx:283–319` |
| Catalog                | Manage node types and edge labels                   | `canvas/src/lib/graph/schema.ts`, `canvas/src/features/schema/derive.ts`                       | `GraphSchema.catalog`                        | `addNodeType`, `renameNodeType`, `removeNodeType`, `addEdgeLabel`, `renameEdgeLabel`, `removeEdgeLabel`                   | `catalog.nodeTypes[]`, `catalog.edgeLabels[]`                             | array                 | []                                      | —                                           | drives Schema Panel Types section                       | `canvas/src/hooks/store/schemaSlice.ts:149–210,241–309`, `canvas/src/features/schema/derive.ts:4–20` |
| Property Schemas       | Define property specs by type/label                 | `canvas/src/lib/graph/schema.ts`                                                              | `GraphSchema.propertySchemas`               | `upsertNodeProperty`, `removeNodeProperty`, `upsertEdgeProperty`, `removeEdgeProperty`                                   | `propertySchemas.{node[type][key],edge[label][key]}`                      | object                | {}                                      | —                                           | synced with `validation` and `templates`; `summarizePropertySpec` derives compact badge metadata for each property spec, and those schema-driven badges are rendered via `getBadgeChipClass` in node/edge hover tooltips and the Node editor so JSON-LD/AgenticRAG surfaces can show consistent, schema-backed type/role badges without hand-coded Tailwind classes | `canvas/src/hooks/store/schemaSlice.ts:312–438`, `canvas/src/features/schema-editor/PropertiesSection.tsx:76–118`, `canvas/src/lib/graph/schema.ts:1–120`, `canvas/src/components/GraphHoverTooltip.tsx:66–134,136–224`, `canvas/src/components/NodeEditor.tsx:1–25,75–83,109–123,143–171` |
| Codebase Index Schema  | Visual and semantic config for codebase traversal graphs | `schema-config/codebase-index-schema.json`, `canvas/src/features/panels/views/RenderSettingsSection.tsx`, `canvas/src/features/panels/views/SchemaView.tsx` | `GraphSchema` | n/a | Codebase index visualization schema | schema | JSON | `nodeStyles`, `edgeStyles`, `catalog`, `propertySchemas.node.File.owner`, `propertySchemas.node.File.testCoverage` | Styles codebase index graphs and exposes ownership/coverage as semantic properties for traversal, export, and downstream AgenticRAG tooling |
| Store Architecture Schema | Visual config for the GraphState store architecture graph | `data/knowgrph-store-architecture_202512271830/store-architecture-schema-config.jsonld`, `data/knowgrph-store-architecture_202512271830/store-architecture-graph-data.jsonld`, `docs/knowgrph-state-catalog.md` | `GraphSchema` | n/a | Store architecture visualization schema | schema | JSON-LD | `nodeStyles`, `edgeStyles`, `catalog` | Styles `Store`, `StoreSlice`, and `StoreCategory` nodes plus `hasSlice` and `belongsToCategory` edges so the GraphState slice responsibilities documented in the state catalog can also be inspected as an AgenticRAG-compatible graph. |
| Serialization          | JSON‑LD mapping                                    | `canvas/src/lib/graph/schema.ts`, `canvas/src/features/schema-editor/AdvancedSection.tsx`     | `GraphSchema.serialization`                  | `setSerialization`                                                                                                       | `serialization.{predicatesByLabel,typesByNode,context,version}`          | object/string         | {}/undefined                           | —                                           | export uses simple predicate arrays for edges without properties and reified edge nodes when properties exist; node coordinates persisted under `kg:x/kg:y/kg:fx/kg:fy` | `canvas/src/hooks/store/schemaSlice.ts:143–146`, `canvas/src/features/schema-editor/AdvancedSection.tsx:84–105` |
| Import/Export Formats  | Round‑trip schema JSON/JSON‑LD/CSV                | `canvas/src/features/schema/io.ts`, `canvas/src/components/SchemaEditorPanel.tsx`, `canvas/src/components/BottomPanel.tsx` | schema IO helpers, Schema panels | `loadSchemaFromFile`, `exportSchemaAsJSON`, `exportSchemaAsJsonLd`, `exportSchemaAsCsv` | schema file chooser and exports | file dialogs / Blob | JSON (`schema.json`), JSON-LD (`schema.jsonld`), CSV (`schema.csv`) | `window.showOpenFilePicker`, `window.showSaveFilePicker`, `Blob` | Schema and render presets (including 3D tuning) can be imported from `schema-config/*.json` and exported in multiple formats from both the dedicated Schema Editor panel and the Bottom Panel Schema tab | `canvas/src/features/schema/io.ts:1–65`, `canvas/src/components/SchemaEditorPanel.tsx:10–12,68–105`, `canvas/src/components/BottomPanel.tsx:29–35,94–162` |
| Panel Schema Tab           | Edit global schema in UI                            | `canvas/src/features/panels/views/SchemaView.tsx`, `canvas/src/features/panels/ui/SchemaStepCopyAndStatus.tsx`, `canvas/src/features/panels/ui/SchemaSummary.tsx`, `canvas/src/features/schema-editor/AdvancedSection.tsx`, `canvas/src/features/panels/ui/CollapsibleSubsection.tsx`, `canvas/src/features/schema/ui/SchemaUiEditorPane.tsx`, `canvas/src/features/schema/ui/SchemaUiEditor.tsx`           | Panel Schema tab                               | section components                                                                                                       | —                                                                          | —                    | —                                       | `React`                                    | unified tabbed Panel; header `Apply`/`Reset` icons; centered "Edit Mode" button when disabled; mirrors Workflow **Step 3. Apply schema-config** and Schema tab subtasks **Step 3 Schema**, **Step 3.1. Apply presets from schema-config/**, **Step 3.1.1. Apply and manage schema-config presets**, **Step 3.2. Tune node, edge, and layout rules**, **Step 3.2.1. Refine schema behavior and layout**, **Step 3.3. Customize node and edge UI**, **Step 3.3.1. Customize node and edge UI with Schema UI Editor**, **Step 3.3.2. Validation and rules**, and **Step 3.3.3. Layout** for a consistent zero‑to‑one schema flow across Workflow, Parser Schema tab, Panel Schema tab, and bottom panel Schema UI Editor. `SchemaStepCopyAndStatus` renders the zero‑to‑one intro from `SCHEMA_FLOW_INTRO` plus the directive S‑V‑O Workflow Step 3 body text, while `SchemaInlineStatus` surfaces inline schema catalog counts next to data status to keep setup and status aligned. The `span` Step badges in `ParserSchemaTabContent`/`ParserSections` and the `Types`/`Properties`/`Styles` `div` subsections in Advanced (`CollapsibleSubsection` and `AdvancedSection`), together with Schema UI Editor badge rows bound to `SCHEMA_STEP_COPY['3.3.1']`/`['3.3.2']`/`['3.3.3']`, visually encode the same presets → rules → UI sequence as the extended Step 3.* S‑V‑O table in the Workflow catalog. |
| Panel Sections Persistence | Persist collapse state for schema sections         | `canvas/src/features/panels/views/SchemaView.tsx`, `canvas/src/features/panels/ui/CollapsibleSection.tsx`, `canvas/src/features/panels/ui/KeyValueRow.tsx` | `CollapsibleSection`, `KeyValueRow`      | `usePersistedBoolean`                                                                                                   | `schema.{schemaCollapsed,editorCollapsed,actionsCollapsed}`              | boolean               | true                                   | `window.localStorage`                        | collapsed by default; full‑header click toggles; chevron rotation; preserves **Step 3** and **Step 3.1**/**3.1.1.**/**3.2**/**3.2.1.**/**3.3**/**3.3.1.**/**3.3.2.**/**3.3.3.** groupings between sessions; `KeyValueRow` keeps small schema and workflow summaries aligned with Settings/Workflow layout patterns. |
| Graph Data Table Frozen Area | Persist and apply column freeze configuration for the spreadsheet view | `canvas/src/features/graph-data-table/ui/GraphDataTableTable.tsx`, `canvas/src/features/graph-data-table/ui/useGraphDataTableFrozenArea.tsx`, `canvas/src/hooks/store/uiSlice.ts`, `canvas/src/lib/config.ts` | `GraphDataTableFreezeMode`, `GraphDataTableFreezeModeByScope` | `useGraphDataTableFrozenArea`, `setGraphDataTableFreezeFirstDataColumn`, `parseGraphDataTableFreezeModeByScope` | `LS_KEYS.graphDataTableFreezeFirstDataColumnByScope`                     | JSON object           | `{ all: 'none' | 'label' | 'id', nodes: 'none' | 'label' | 'id', edges: 'none' | 'label' | 'id' }` | `React`, `zustand`, `window.localStorage`          | drag handle maps horizontal movement to freeze modes per scope; header and body cells stay in sync using a single frozen boundary column derived from the ordered visible column keys, and persisted state keeps the same behavior across sessions and AgenticRAG‑driven workflows. |
| Graph Fields Settings JSON‑LD | Export/import field configuration snapshots for AgenticRAG pipelines | `canvas/src/features/panels/utils/workflowJsonLd.ts`, `canvas/src/features/panels/hooks/workflowJsonLdActions.ts`, `canvas/src/features/panels/views/GraphFieldsView.tsx`, `canvas/src/features/graph-fields/graphFields.ts` | `GraphFieldSettingsById` map, history entries | `buildGraphFieldSettingsJsonLdDocument`, `parseGraphFieldSettingsDocument`, `buildHistoryJsonLdDocument` | `kg:GraphFieldSetting` items (`kg:graphId`, `kg:fieldId`, `kg:scope`, `kg:key`, `kg:settings`, optional `kg:fieldType`, `kg:description`), optional `kg:graphFieldSettings` on `kg:HistoryEntry` | object/map | field configuration snapshots keyed by `GraphFieldId` (`node:key` / `edge:key`) | `React`, `zustand` | Graph Fields tab and bottom panel curation editors share `graphFieldSettingsById` and Graph Data Table column state; JSON‑LD export adds small machine‑readable hints (`kg:fieldType`, `kg:description`) for each field and optionally attaches a `graphFieldSettingsById` snapshot to every history entry so AgenticRAG workflows can replay both graph structure and field configuration together. Curator UI editor columns use the shared base fields `kind`, `id`, `label`, `type`, `source`, `target`, `properties`, `metadata`, while the curation text editor and loaders operate on the canonical `{ context, type, nodes, edges }` `GraphData` shape described in `docs/knowgrph-raci-document.md`. | `canvas/src/features/panels/utils/workflowJsonLd.ts:320–373,437–497`, `canvas/src/features/panels/hooks/workflowJsonLdActions.ts:121–140,256–309`, `canvas/src/features/panels/views/GraphFieldsView.tsx:1–217`, `canvas/src/features/graph-fields/graphFields.ts:1–485` |
| GraphRAG Workflow JSON‑LD | Describe traversal rules, embedding model, and context window for Agentic GraphRAG pipelines | `canvas/src/features/panels/utils/workflowJsonLd.ts`, `canvas/src/features/panels/utils/graphragConfig.ts`, `canvas/src/features/panels/hooks/useWorkflowExportActions.ts`, `canvas/src/features/panels/views/WorkflowSection.tsx` | `GraphRagWorkflowJsonLd` document | `buildGraphRagWorkflowJsonLdDocument`, `validateGraphRagWorkflowJsonLdObject`, `parseGraphragCliConfigYamlToJsonLd`, `buildGraphRagWorkflowFromGraphData` | `@type: 'rag:GraphRAGWorkflow'`, `graphId`, `retrievalMethod`, `maxHops`, `traversalRules[].{'@type','ruleType','allowedRelations','rulePriority?'}`, `contextWindow.{ '@type',contextSize,contextStrategy }`, optional `dataset.{inputDir,outputDir}`, optional `chunking.{ '@type',method,chunkSize }`, optional `embeddingModel.{ '@type',provider,modelName }` | object/array/string | `retrievalMethod: 'graph-traversal'`, `maxHops: 3`, `contextWindow.contextSize: 8192` | `js-yaml`, `GraphData` edge labels, `useGraphStore.graphRagWorkflowJsonText` | Main Panel **Workflow** tab exports a `rag:GraphRAGWorkflow` JSON‑LD document aligned with AgenticRAG `rag:` schema; each traversal rule is a `rag:TraversalRule` block with `ruleType: 'relation-constraint'`, `allowedRelations[]`, and optional `rulePriority`, the `contextWindow` is a `rag:ContextWindow` with `contextSize` and `contextStrategy`, and CLI `config.yaml` imports are normalized via `parseGraphragCliConfigYamlToJsonLd` into the same workflow shape for downstream pipelines. | `canvas/src/features/panels/utils/workflowJsonLd.ts:231–252`, `canvas/src/features/panels/utils/graphragConfig.ts:1–183`, `canvas/src/features/panels/views/WorkflowSection.tsx:360–420` |

## Update Approach
- Maintain this catalog as the single source of truth for all schema‑related configuration.
- Map each `GraphSchema` key to S‑V‑O responsibility with precise module references and defaults.
- Render and edit these keys in the Schema Panel; write via store setters; non‑editable entries are documented as reference.

## Panel Schema Tab List View
- Show the top‑level list as: `Area | Key | Type | Value`.
- Expand a row to show: `Area | Modules | Classes/Objects | Functions/Methods | Responsibility | Dependencies / Imports | Notes`.
- Render within the unified Panel; header contains `Apply`/`Reset` icons, Toggle Search, Close. A centered "Edit Mode" button is shown when edit is disabled.

### Schema Panel Directives
- Source data directly from store `schema` and allow writes via `schemaSlice` setters.
- Provide fallbacks for missing keys to guarantee `Area` and `Responsibility`.
- Batch‑apply changes using the panel `Apply` button.
- Display non‑writable reference entries: layout fit padding, legend, and any reserved fields.

## Notes
- Enforce edge creation constraints using `endpointMatrix`, `cardinality`, and behavior flags.
- Prevent duplicates and self‑loops when enabled; gate creation/update using `canAddEdge`.
- Split canvas rebuild and style updates to avoid unnecessary rerenders and improve memory/cache performance.
- Centralize 3D schema reads with `getThreeConfig` and selection reads with `getThreeSelectionConfig` in `canvas/src/lib/graph/schema.ts:254–289`.
- Represent selection anchors as `SelectionAnchorIds` (`selectionNodeIds`, `selectionEdgeIds`) in `canvas/src/lib/graph/types.ts`; normalize them with `normalizeSelectionIds` in `canvas/src/components/GraphCanvas/highlight.ts` and feed them into `buildSelectionSubgraphForAnchorIds` in `canvas/src/lib/graph/file.ts` so canvas, panels, and exports share the same selection‑subgraph contract.

---
---

### Graph Fields JSON‑LD example (minimal graph)

```jsonld
{
  "@context": { "kg": "http://example.org/kg#" },
  "@type": "kg:GraphFieldSettingsExport",
  "kg:exportedAt": 1766229000000,
  "kg:graphId": "graph-1",
  "kg:fields": [
    {
      "@type": "kg:GraphFieldSetting",
      "kg:graphId": "graph-1",
      "kg:fieldId": "node:chunk_text",
      "kg:scope": "node",
      "kg:key": "chunk_text",
      "kg:settings": {
        "displayName": "Chunk text",
        "isHidden": false,
        "fieldType": "Long text"
      },
      "kg:fieldType": "Long text",
      "kg:description": "RAG grounding text per node"
    },
    {
      "@type": "kg:GraphFieldSetting",
      "kg:graphId": "graph-1",
      "kg:fieldId": "edge:weight",
      "kg:scope": "edge",
      "kg:key": "weight",
      "kg:settings": {
        "displayName": "Weight",
        "isHidden": false,
        "fieldType": "Number"
      },
      "kg:fieldType": "Number",
      "kg:description": "Edge strength used in ranking"
    }
  ]
}
```

### Graph Data Table behavior JSON‑LD example (codebase index)

This example shows how the Graph Data Table frozen‑area and density behavior is represented in the codebase‑index graph and aligned with the AgenticRAG schema and `graphRAGPath` metadata.

```jsonld
{
  "@context": {
    "@vocab": "https://huijoohwee.github.io/knowgrph#",
    "schema": "https://schema.org/",
    "graphRAGPath": {
      "@id": "https://huijoohwee.github.io/knowgrph#graphRAGPath"
    }
  },
  "@graph": [
    {
      "@id": "kg:canvas/src/features/graph-data-table/ui/GraphDataTableTable.tsx",
      "@type": [
        "File",
        "AgenticRagNodeView"
      ],
      "name": "GraphDataTableTable.tsx",
      "path": "canvas/src/features/graph-data-table/ui/GraphDataTableTable.tsx",
      "labels": [
        "GraphDataTable",
        "UIComponent"
      ],
      "properties": {
        "tableId": "graphDataTable",
        "rowDensityStateKey": "graphDataTableRowDensity",
        "freezeModeStateKey": "graphDataTableFreezeFirstDataColumnByScope",
        "visibleColumnsStateKey": "graphDataTableVisibleColumnsByScope"
      },
      "graphRAGPath": {
        "query": "How does the Graph Data Table persist frozen columns and density?",
        "traverse": [
          "kg:canvas/src/features/graph-data-table/ui/useGraphDataTableFrozenArea.tsx",
          "kg:canvas/src/hooks/store/uiSlice.ts",
          "kg:canvas/src/lib/config.ts"
        ],
        "context": "Follow from the table view into the frozen-area hook, UI store, and LocalStorage key registry so AgenticRAG can align UI table behavior with the codebase-index schema and LS_KEYS-backed state."
      }
    }
  ]
}
```

```

# Principle

- **generic function**: keep generic data loading, schema, parsing, rendering function; doesn’t hard‑code reference to any specific test data;

- **No layering violation**: lower‑level utilities does not depend on higher‑level or test‑specific artifacts, file names, or higher‑level context.

- **Separation**: The parser should never mention `ai-kg-viz.json` directly; it just consumes whatever text/data is passed in.

- **Reusability**: reuse the data loader, schema, parser, renderer for other datasets or production inputs

---

## Toolchain

- **Loader**: any source (file, API, DB) -> Fetches/reads JSON; doesn’t care about schema content;

- **Parser**: Converts JSON into graph objects (nodes/edges); doesn’t care about file names nor test-specific data;

- **Renderer**: Visualizes graph using generic node/edge structures.

```

### JSON Schema Blueprint for Reusable Knowledge Graph/RAG/GraphRAG pipelines


schema + validator is 100% generic: drop any compliant JSON file in, get clean nodes/edges out. No test-data coupling



-top-level metadata for provenance, versioning, and RAG-specific fields (embeddings, chunks, confidence) without violating layering



Enforces strict separation: generic loader/parser/renderer never references specific filenames, datasets, or domains



adds **top-level `metadata`** for provenance, versioning, and RAG-specific fields (embeddings, chunks, confidence) without violating layering.

#### Core Principles Enforced
- **Generic loader**: Reads any JSON → validates against this schema → yields `{ nodes: [], edges: [], metadata: {} }`.
- **No hard-coded references**: No mention of project-specific or domain-specific labels.
- **Parser independence**: Parser only processes `nodes[]` and `edges[]` arrays + optional `metadata`.
- **Reusability**: Works for any domain (investments, biology, supply chain) — just change values, not structure.
- **RAG-ready**: Supports rich text chunks, embeddings, provenance for hybrid retrieval + low hallucinations.

#### JSON Structure Blueprint

#### Why This Blueprint Wins
| Feature                          | Benefit for Separation & Reusability                                      |
|----------------------------------|---------------------------------------------------------------------------|
| Top-level `metadata`             | All file-level info isolated → loader/parser ignores it if not needed     |
| `nodes[].id` mandatory & unique  | Guarantees referential integrity without domain knowledge                 |
| `labels` as array                | Future-proof multi-type nodes (e.g., Person is also Investor)            |
| `properties` free-form object    | Domain-specific data without changing schema → true generic parsing      |
| Optional `embedding` + `chunk_text` | Direct hybrid GraphRAG support (vector + graph retrieval)               |
| Nested `metadata` per node/edge  | Provenance/confidence without polluting core properties                   |
| No required domain fields        | Parser never expects "name" or "INVESTED_IN" → works on any dataset      |

### Orchestrator section labels and schema docs

The Orchestrator bottom-panel section list is defined in `canvas/src/features/panels/config.ts:127` via `getOrchestratorSectionListLabel` and described in `docs/knowgrph-semantics-document.md` under “Semantic-frame tooltip phrasing for AgenticRAG”. When schema documentation needs to reference traversal presets, Traversal sequence, the AgenticRAG node inspector, or AgenticRAG context and ignore filters, it treats this helper as the single source of truth instead of restating the list so Orchestrator UI labels, schema examples, and RAG pipeline descriptions stay aligned.

The Graph Fields header tooltip that explains how field metadata, JSON‑LD roles, and Graph Data Table mapping stay aligned with schema presets is defined as `GRAPH_FIELDS_GRAPH_DATA_TABLE_MAPPING_TOOLTIP` in `canvas/src/lib/config.ts:403`. This tooltip is reused by the Graph Fields tab and the Help tab Graph Data Table mapping card and is intended to point back to the “Graph Data Table Frozen Area” row and “Graph Data Table behavior JSON‑LD example (codebase index)” section in this document. Its canonical Role → Actions → Outcome JSON‑LD representation lives in `schema-config/graph-fields-table-mapping-role-action-outcome.jsonld` and is validated at runtime by the schema‑driven tooltip copy test in `canvas/src/__tests__/orchestratorCopy.test.ts`.

The bottom-panel Curation tab also uses a standardized Graph Data Table curation helper, defined as `GRAPH_DATA_TABLE_CURATION_TOOLTIP` in `canvas/src/lib/config.ts:388` and consumed by the toolbar Tools menu curator entry in `canvas/src/features/toolbar/toolMenu.ts:31–36`. Together, `GRAPH_FIELDS_GRAPH_DATA_TABLE_MAPPING_TOOLTIP` and `GRAPH_DATA_TABLE_CURATION_TOOLTIP` describe how Graph Fields configuration (`GraphFieldSettingsById`, frozen-area and density settings in `LS_KEYS.graphDataTable*`) controls the spreadsheet-like Graph Data Table view and how curated node/edge rows are exported as JSON, AgenticRAG JSON‑LD, or CSV in alignment with the codebase‑index graph documented in the “Graph Data Table Frozen Area” row and “Graph Data Table behavior JSON‑LD example (codebase index)” section above. Their Role → Actions → Outcome JSON‑LD fixtures live in `schema-config/graph-fields-table-mapping-role-action-outcome.jsonld` and `schema-config/graph-data-table-curation-role-action-outcome.jsonld` and are exercised by the same schema‑driven tooltip copy tests so schema examples, tooltips, and JSON‑LD stay aligned.
