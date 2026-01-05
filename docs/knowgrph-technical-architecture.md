# Knowgrph Technical Architecture

| Area                 | Responsibility                                        | Modules                                                                                           | Classes/Objects                 | Functions/Methods                                                                                                        | Key                                             | Type     | Value/Default                     | Dependencies / Imports | Notes                                                                                                        |
| -------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------- | ---------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| Workflow Presets     | Bind parser, dataset, and schema into presets         | `canvas/src/features/parsers/workflowPresets.ts`, `canvas/src/features/panels/views/ParserView.tsx`, `canvas/src/features/panels/views/ParserSections.tsx`, `canvas/src/features/parsers/uiUtils.ts`, `canvas/src/features/schema/io.ts`, `canvas/src/lib/graph/file.ts`, `canvas/src/lib/graph/graphragTraversal.ts` | `WORKFLOW_PRESETS`, Parser/Schema panels | `onApplyWorkflowPreset`, parser/file/schema IO helpers, `findGraphRagTraversalEdgeIds`                                                                  | `parserSpecId`, `datasetFileName`, `schemaFileName` triples | JSON/state | 6 curated presets (Unicorn Top‑3 3D, AI‑KG, AI Customer Voice Management, Universal Lean Startup, A0 Investors, Venture Capital Portfolio) | `window.localStorage`, file picker APIs | Architectural layer above parser/dataset/schema that stores curated workflows as JSON triples, wires them to UI buttons in the Parser Data section, and uses existing parser/file/schema import/export utilities so users can re‑apply complete workflows with a single click and export the resulting graphs (JSON‑LD/JSON/CSV) and schema configs (JSON/JSON‑LD/CSV). The AI‑KG preset pairs the JSON‑LD parser, `test-data/ai-kg-viz.json`, `schema-config/ai-kg-viz-schema.json`, the traversal helper, and tuned 3D styles including per‑label edge opacity and per‑layer node opacity (`three.layerOpacityByLayer`) so the layered 3D view and query traversal highlight are reproducible as a unit (`canvas/src/features/parsers/workflowPresets.ts:31–95`, `canvas/src/features/panels/views/ParserView.tsx:20–48,165–201`, `canvas/src/lib/graph/graphragTraversal.ts:1–49`, `schema-config/ai-kg-viz-schema.json`). |
| AgenticRAG Tooltips  | Centralize Role→Actions→Outcome UI tooltips and labels | `canvas/src/lib/config.copy.ts`, `canvas/src/lib/config.ts`, `canvas/src/features/panels/views/OrchestratorTraversalPanels.tsx`, `canvas/src/features/panels/views/HelpSections.tsx`, `canvas/src/features/toolbar/toolMenu.ts`, `canvas/src/features/panels/views/AiKgLayersSection.tsx` | `ORCHESTRATOR_TRAVERSAL_TOOLTIP`, `TRAVERSAL_PRESETS_SECTION_TOOLTIP`, `TRAVERSAL_EDITOR_AND_LAYERS_SECTION_TOOLTIP`, `TRAVERSAL_SEQUENCE_TOOLTIP`, `DUCKDB_SQL_FIELD_TOOLTIP`, `DUCKDB_QUERY_PRESETS_TOOLTIP`, `DUCKDB_QUERY_PRESET_ID_TOOLTIP`, `DUCKDB_QUERY_PRESET_DESCRIPTION_TOOLTIP`, `GRAPH_FIELDS_ICON_LEGEND_TOOLTIP`, `GRAPH_FIELDS_GRAPH_DATA_TABLE_MAPPING_TOOLTIP`, `WORKFLOW_LINKS_TOOLTIP`, `AGENTIC_REASONING_LABELS_TOOLTIP`, `GRAPHRAG_PATH_METADATA_TOOLTIP`, `GRAPHRAG_WORKFLOW_SUMMARY_TOOLTIP`, `AGENTIC_RAG_CONTEXT_IRI_TOOLTIP`, `ORCHESTRATOR_TRACING_OPTIONS_TOOLTIP` | `buildRoleActionOutcomeTooltip`, `getOrchestratorSectionListLabel`                                                   | `rag:RoleActionOutcome` tooltip copy helpers             | string  | `"Role → Action1 → … → Outcome"`         | AgenticRAG JSON‑LD fixtures under `schema-config/`, `orchestratorCopy.test.ts` | Single source of truth for Orchestrator, Graph Data Table, Graph Fields, Help, and traversal/layers tooltips aligned with the AgenticRAG schema (`https://huijoohwee.github.io/schema/AgenticRAG/v1/context.jsonld`). Tests in `canvas/src/__tests__/orchestratorCopy.test.ts` and JSON‑LD fixtures ensure tooltip copy stays in sync with the AgenticRAG `rag:RoleActionOutcome` catalog and that panels, tool menus, and workflow docs reuse the same wording and anchor semantics. |

<!-- SETTINGS_REGISTRY_TABLE_START -->

| Setting key | Type | Source | LS key (if any) | Owner |
| --- | --- | --- | --- | --- |
| `uiOverlayOpacity` | number | store | `kg:ui:overlayOpacity` | `ui.overlayOpacity` |
| `uiPanelOpacity` | number | store | `kg:ui:panelOpacity` | `ui.panelOpacity` |
| `uiToolbarOpacity` | number | store | `kg:ui:toolbarOpacity` | `ui.toolbarOpacity` |
| `uiIconScale` | string | store |  |  |
| `uiPanelTextFontClass` | string | store |  |  |
| `uiPanelKeyValueTextSizeClass` | string | store |  |  |
| `uiPanelKeyValueInputClass` | string | store |  |  |
| `uiPanelMonospaceTextClass` | string | store |  |  |
| `uiPanelRowDensityDefaultClass` | string | store |  |  |
| `uiHeaderRowHeightClass` | string | store |  |  |
| `uiHeaderRowPaddingClass` | string | store |  |  |
| `uiSectionHeaderRowHeightClass` | string | store |  |  |
| `uiSectionHeaderRowPaddingClass` | string | store |  |  |
| `uiIconFormat` | string | store |  |  |
| `uiIconStrokeWidth` | number | store |  |  |
| `uiIconColorClass` | string | store |  |  |
| `uiIconHoverBgClass` | string | store |  |  |
| `uiIconButtonPaddingClass` | string | store |  |  |
| `uiIconPillClass` | string | store |  |  |
| `uiIconPillLegendTextSizeClass` | string | store |  |  |
| `uiIconPillBadgeTextSizeClass` | string | store |  |  |
| `uiIconBadgeChipClass` | string | store |  |  |
| `uiIconBadgeChipTextSizeClass` | string | store |  |  |
| `uiPanelMicroLabelTextSizeClass` | string | store |  |  |
| `uiIconAnimationEnabled` | boolean | store |  |  |
| `bottomPanelHeightRatio` | number | localStorage | `kg:ui:bottomPanelHeight` | `ui.bottomPanel` |
| `floatingPanelWidthRatio` | number | localStorage | `kg:ui:floatingPanelWidthRatio` | `ui.floatingPanel` |
| `floatingPanelHeightRatio` | number | localStorage | `kg:ui:floatingPanelHeightRatio` | `ui.floatingPanel` |
| `floatingPanelZIndex` | number | localStorage | `kg:ui:floatingPanelZIndex` | `ui.floatingPanel` |
| `sidebarWidthRatio` | number | localStorage | `kg:ui:sidebarWidthRatio` | `ui.sidebar` |
| `enableLaunchSpotlight` | boolean | store |  |  |
| `spotlight.margin` | number | store |  |  |
| `spotlight.nearTopThreshold` | number | store |  |  |
| `chatEndpointUrl` | string | localStorage | `kg:chat:endpointUrl` | `ui.chat` |
| `chatModel` | string | localStorage | `kg:chat:model` | `ui.chat` |
| `chatTemperature` | number | localStorage | `kg:chat:temperature` | `ui.chat` |
| `chatSystemPrompt` | string | localStorage | `kg:chat:systemPrompt` | `ui.chat` |
| `graphFields.settingsById` | string | localStorage |  |  |
| `graphDataTable.visibleColumns` | string | localStorage |  |  |
| `graphDataTable.columnOrder` | string | localStorage |  |  |
| `graphDataTable.columnWidths` | string | localStorage |  |  |
| `graphDataTable.aggregateKeys` | string | localStorage |  |  |
| `graphDataTable.filterState` | string | localStorage |  |  |
| `graphDataTable.sortRules` | string | localStorage |  |  |
| `graphDataTable.groupKey` | string | localStorage |  |  |
| `graphDataTable.autoSortEnabled` | string | localStorage |  |  |
| `graphDataTable.rowDensity` | string | localStorage |  |  |
| `graphDataTable.disableAutoScroll` | string | localStorage |  |  |
| `graphDataTable.freezeFirstDataColumn` | string | localStorage |  |  |
| `graphDataTable.freezeFirstDataColumnByScope` | string | localStorage |  |  |
| `graphDataTable.virtualOverscanRows` | number | store | `kg:ui:tableVirtual:overscanRows` | `ui.bottomPanel` |
| `graphDataTable.overscanMultiplier` | number | store | `kg:ui:tableVirtual:overscanMultiplier` | `ui.bottomPanel` |
| `graphDataTable.minRows` | number | store | `kg:ui:tableVirtual:minRows` | `ui.bottomPanel` |
| `graphDataTable.debugLogRanges` | boolean | store | `kg:ui:tableVirtual:debugLogRanges` | `ui.bottomPanel` |
| `graphDataTable.aggregateIncludeMixedNumericFields` | boolean | store | `kg:curation:aggregate:includeMixed` | `curation.spreadsheet` |
| `graphDataTable.aggregateIncludeIdAsNumeric` | boolean | store | `kg:curation:aggregate:includeId` | `curation.spreadsheet` |
| `graphDataTable.aggregateIncludeSourceAsNumeric` | boolean | store | `kg:curation:aggregate:includeSource` | `curation.spreadsheet` |
| `graphDataTable.aggregateIncludeTargetAsNumeric` | boolean | store | `kg:curation:aggregate:includeTarget` | `curation.spreadsheet` |
| `graphDataTable.aggregateDefaultVizMode` | string | store | `kg:graphDataTable:aggregateDefaultVizMode` | `graphDataTable` |
| `graphDataTable.numericSampleLimit` | number | store | `kg:curation:aggregate:numericSampleLimit` | `curation.spreadsheet` |
| `graphDataTable.numericSampleMinCount` | number | store | `kg:curation:aggregate:numericSampleMinCount` | `curation.spreadsheet` |
| `graphDataTable.numericSampleMinRatio` | number | store | `kg:curation:aggregate:numericSampleMinRatio` | `curation.spreadsheet` |
| `graphDataTable.frozenDragStepNoneLabelPx` | number | store | `kg:curation:spreadsheet:frozenDragStepNoneLabelPx` | `curation.spreadsheet` |
| `graphDataTable.frozenDragStepLabelIdPx` | number | store | `kg:curation:spreadsheet:frozenDragStepLabelIdPx` | `curation.spreadsheet` |
| `historyDebounceMs` | number | store |  |  |
| `codeHighlightDurationMs` | number | store |  |  |
| `codeSelectThrottleMs` | number | store |  |  |
| `codeHighlightUntilClick` | boolean | store |  |  |
| `enableTabSync` | boolean | store |  |  |
| `enableVirtualTables` | boolean | store |  |  |
| `canvasRenderMode` | string | store |  |  |
| `orchestratorTraversalDelayMs` | number | localStorage | `kg:orchestrator:traversalDelayMs` | `orchestrator.prefs` |
| `orchestratorView` | string | localStorage | `kg:orchestrator:view` | `orchestrator.prefs` |
| `graph.behavior.selectMode` | string | store |  |  |
| `graph.behavior.createMode` | string | store |  |  |
| `schemaDeriveCacheCapacity` | number | store | `kg:perf:schemaDeriveCacheCapacity` | `schema.deriveCache` |
| `schema.layers.mode` | string | store |  |  |
| `schema.layers.documentStructure.minGroupSize` | number | store |  |  |
| `schema.layers.semantic.similarityEdgeLabel` | string | store |  |  |
| `schema.layers.semantic.similarityMetric` | string | store |  |  |
| `schema.layers.semantic.topKEdgesPerNode` | number | store |  |  |
| `schema.layers.semantic.minSimilarity` | number | store |  |  |
| `three.selection.selectedNodeGlowIntensity` | number | store |  |  |
| `three.selection.dimmedNodeOpacity` | number | store |  |  |
| `three.selection.dimmedEdgeOpacity` | number | store |  |  |
| `three.selection.selectedEdgeWidth` | number | store |  |  |
| `three.camera.backgroundColor` | string | store |  |  |
| `three.camera.fogColor` | string | store |  |  |
| `three.camera.fogNear` | number | store |  |  |
| `three.camera.fogFar` | number | store |  |  |
| `three.camera.dampingFactor` | number | store |  |  |
| `three.camera.rotateSpeed` | number | store |  |  |
| `three.camera.zoomSpeed` | number | store |  |  |
| `three.camera.panSpeed` | number | store |  |  |
| `three.camera.autoRotate` | boolean | store |  |  |
| `three.camera.autoRotateSpeed` | number | store |  |  |
| `three.graph.linkDirectionalArrowLength` | number | store |  |  |
| `three.graph.linkOpacity` | number | store |  |  |
| `three.graph.linkCurvature` | number | store |  |  |
| `three.graph.linkCurveRotation` | number | store |  |  |
| `three.graph.linkDirectionalParticles` | number | store |  |  |
| `three.graph.linkDirectionalParticleSpeed` | number | store |  |  |
| `three.graph.nodeSizingFormula` | string | store |  |  |
| `three.graph.edgeWidthFormula` | string | store |  |  |
| `three.graph.layerOpacityByLayer.1` | number | store |  |  |
| `three.graph.layerOpacityByLayer.2` | number | store |  |  |
| `three.graph.layerOpacityByLayer.3` | number | store |  |  |
| `three.graph.nodeMotionIntensity` | number | store |  |  |
| `three.graph.minimapOpacity` | number | store |  |  |
| `three.graph.polygons.elevationOffset` | number | store |  |  |
| `three.graph.polygons.opacityMultiplier` | number | store |  |  |
| `three.graph.starfieldEnabled` | boolean | store |  |  |
| `three.graph.starfieldCount` | number | store |  |  |
| `three.graph.starfieldRadius` | number | store |  |  |
| `three.graph.starfieldOpacity` | number | store |  |  |
| `three.graph.starfieldColor` | string | store |  |  |
| `three.layout.sphereRadius` | number | store |  |  |
| `three.layout.seed` | number | store |  |  |
| `three.layout.minSpacing` | number | store |  |  |
| `three.preset.presentation3d` | boolean | store |  |  |
| `CLICK_URL` | string | env |  |  |
| `PUBLIC_FALLBACK_JSON` | string | env |  |  |
| `KG_INPUT_PATH` | string | backendEnv |  |  |
| `KG_OUTPUT_DIR` | string | backendEnv |  |  |
| `max-lines` | number | eslint |  |  |

<!-- SETTINGS_REGISTRY_TABLE_END -->
