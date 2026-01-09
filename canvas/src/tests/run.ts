import { testBuildEnvelope } from '@/__tests__/tabSync.test';
import { testEdgeExists, testNormalizeEdgesForSimFiltersDanglingEndpoints } from '@/__tests__/edges.test';
import { testFinalizeCreateEdge, testFinalizeUseExistingEdge, testFinalizeUpdateSource, testFinalizeUpdateTarget } from '@/__tests__/edgeCreation.test'
import { testValidateSchemaFillsDefaults, testValidateSchemaBehaviorDefaults, testAddRenameRemoveNodeType, testUpsertRemoveNodeProperty, testClampAlphaDecay, testSchemaTabEnterText, testSchemaPersistenceWrites, testResetImportSchemaTabTextSync, testResetImportSchemaTabApplyModifiedSync, testSchemaUiApplyUsesLatestStoreSchema, testSchemaUiApplyRegistrationGuardsAgainstImportRace, testParseSchemaTextRejectsInvalidJson, testClampCollisionRadiusUsesSharedBounds, testRenderNodeRadiusSemanticRespectsNodeSizeAndImportance } from '@/__tests__/schema.test'
import { testComputeViewRect } from '@/__tests__/minimap.test'
import {
  testSelectionHighlightNeighborsFromNodeSelection,
  testSelectionHighlightEdgeSelectionEndpointsAndEdges,
} from '@/__tests__/selectionHighlight.test'
import {
  testSelectionZoomNodeSelectionUsesNodeAndNeighbors,
  testSelectionZoomEdgeSelectionUsesEndpointsAndNeighbors,
  testSelectionZoomNoSelectionReturnsEmptySubset,
} from '@/__tests__/selectionZoom.test'
import { testSettingsRegistryReadWrite } from '@/__tests__/settings.test'
import { testParseCombinedCsv } from '@/__tests__/export.test'
import { testParseKindCsv } from '@/__tests__/csvKind.test'
import { testCsvRoundTrip, testGraphMlExport, testCypherExport, testGraphFieldsDerivedFromCsvJsonJsonLd, testGraphFieldsDerivedFromPlainEdgesCsv } from '@/__tests__/roundtrip.test'
import { testJsonLdRoundTrip, testJsonLdAiVizEdges, testJsonLdAgenticGraphEdges, testJsonLdAgenticGraphRagPathStaysInNodeProperties, testJsonLdWorkerPipelineParsesExpectedEdges, testJsonLdTriplesMatchExpectedSet } from '@/__tests__/jsonldRoundtrip.test'
import { testJsonLdInferredEdgesFromCompactIriArrays, testJsonLdPhaseMembershipArraysWithKgPrefix } from '@/__tests__/jsonldInferredEdges.test'
import { testLRUCacheBasic, testLRUCacheClear } from '@/__tests__/cache.test'
import { testUnifiedPanelExport } from '@/__tests__/panel.test'
import { testSettingsViewCollapsePersistence } from '@/__tests__/settingsCollapse.test'
import {
  testBottomPanelCollapsePersistence,
  testGraphFieldsPruneOnGraphDataChange,
  testGraphFieldsStorePopulatesDerivedFields,
  testGraphFieldsSyncOnEdgePropertiesEditViaTableUi,
  testGraphFieldsSyncOnHistoryUndoRedo,
  testGraphFieldsSyncOnNodeAndEdgeMutations,
} from '@/__tests__/bottomPanelPersistence.test'
import { testSearchCacheKeysRespectVersion } from '@/__tests__/searchCache.test'
import { testN8nParsingBasic } from '@/__tests__/n8nParse.test'
import { testParserRegistryCrud } from '@/__tests__/parserRegistry.test'
import { testCustomParserConversion } from '@/__tests__/customParser.test'
import { testCustomParserTransforms } from '@/__tests__/customParserTransforms.test'
import { testTransformArrayPath } from '@/__tests__/transformArrayPath.test'
import { testWildcardAggregation } from '@/__tests__/wildcardAgg.test'
import { testWildcardMinMaxAvg } from '@/__tests__/wildcardMinMaxAvg.test'
import { testWildcardPercentile } from '@/__tests__/wildcardPercentile.test'
import { testWildcardPercentileNearest } from '@/__tests__/wildcardPercentileMethod.test'
import { testWildcardPercentileTukeyHazen } from '@/__tests__/wildcardPercentileTukeyHazen.test'
import { testWildcardPercentileHF } from '@/__tests__/wildcardPercentileHF.test'
import { testCustomParserTypeMethodWarning } from '@/__tests__/customParserWarnings.test'
import { testParserAutoSelectOnLoad } from '@/__tests__/parserAutoApply.test'
import { testParserUIStateHydration } from '@/__tests__/parserUiState.test'
import { testYamlTransformsValidation } from '@/__tests__/yamlTransforms.test'
import { testParserCacheCfgKey } from '@/__tests__/parserCacheCfgKey.test'
import { testJsonEditorLineHeightConstant } from '@/__tests__/jsonEditorRendering.test'
import { testParserWorkflowPresetStorage } from '@/__tests__/parserWorkflowPersistence.test'
import {
  testRawJsonNodesArrayIngestion,
  testRawJsonExtendedNodesIngestion,
} from '@/__tests__/rawJsonIngestion.test'
import { testRawJsonWorkflowShapeIngestion } from '@/__tests__/rawJsonWorkflowShapeIngestion.test'
import { testBuildSelectionSubgraphFromNode, testBuildSelectionSubgraphFromEdge } from '@/__tests__/selectionExport.test'
import { testGraphValidationEmptyGraphSummary, testGraphValidationDuplicateNodeIdsAndDanglingEdges, testGraphValidationNodeRulesApplied, testGraphValidationMetricsWithSyntheticRawDataset } from '@/__tests__/graphValidation.test'
import {
  testGraphRagTraversalHappyPath,
  testGraphRagTraversalIgnoresInvalidShapes,
  testGraphRagTraversalHandlesMissingOwner,
  testFindGraphRagOwnerNodePrefersSelectedOwner,
  testFindGraphRagOwnerNodePrefersOwnerWithSelectedInTraverse,
} from '@/__tests__/graphRagTraversal.test'
import { testGraphTraversalFloatingPanelGenericDepthClamp } from '@/__tests__/graphTraversalFloatingPanel.test'
import { testThemeModePersistence } from '@/__tests__/theme.test'
import { testMarkdownLayoutModePersistence } from '@/__tests__/markdownLayoutModePersistence.test'
import { testMarkdownSyncScrollPersistence } from '@/__tests__/markdownSyncScrollPersistence.test'
import { testLaunchSpotlightStorageHelpers } from '@/__tests__/launchSpotlight.test'
import { testPersistencePrimitives } from '@/__tests__/persistencePrimitives.test'
import { testParseSchemaLintOwner, testSchemaLintSummaryAndActivePath } from '@/__tests__/schemaLintNav.test'
import {
  testUniversalSchemaValidatesSchemaAwareGraph,
  testUniversalSchemaHasGraphRagPathPropertySpecs,
  testGraphRagPathSchemaFixture,
  testSchemaFromJsonLdBuildsCatalogAndPropertySpecs,
  testSchemaJsonLdRoundTripPreservesLayers,
  testJsonLdGraphsParseAndValidateWithUniversalSchema,
  testMiniVizComputesOnSelectionSubgraph,
  testExampleWorkflowSchemaSnippetParsesHiddenNodeTypes,
  testExampleWorkflowJsonLdSemanticVsDocumentStructureLayers,
} from '@/__tests__/schemaFixtures.test'
import {
  testWorkflowJsonLdHistoryGraphShape,
  testWorkflowJsonLdGraphFieldSettingsGraphShape,
  testWorkflowJsonLdGraphFieldSettingsAgenticRagRoundTrip,
  testWorkflowJsonLdGraphRagWorkflowShape,
  testWorkflowJsonLdGraphRagCliYamlMapping,
} from '@/__tests__/workflowJsonLd.test'
import { testWorkflowJsonLdGraphRagPathGraphFieldSettingsFixture } from '@/__tests__/workflowJsonLd.test'
import {
  testWorkflowPresetPipelinesAreSelfConsistent,
  testExportFunctionsAcceptBrandedPaths,
} from '@/__tests__/workflowPresetPipeline.test'
import { testHelpPipelineCopyMatchesCommandConstant, testMarkdownParserMetadataAnchorsAreAgenticRagCompatible } from '@/__tests__/helpPipelineCopy.test'
import {
  testOrchestratorTooltipRoleActionOutcomeShape,
  testOrchestratorToolMenuUsesTooltipCopyHelper,
  testOrchestratorSectionListLabelIncludesExpectedSections,
  testGraphDataTableToolMenuUsesCurationCopyHelper,
  testOrchestratorRoleActionOutcomeJsonLdFixtureMatchesTooltip,
  testAgenticRagNodeInspectorTooltipUsesCopyHelper,
  testAgenticRagContextTooltipUsesCopyHelper,
} from '@/__tests__/orchestratorCopy.test'
import { testCollapsibleDefaultsCompactAndAnchoredToLsKeys } from '@/__tests__/collapsibleDefaults.test'
import {
  testAgenticRagIgnoreFiltersInvalidPrefixes,
  testAgenticRagIgnoreFiltersEmptySummaryReturnsEmptyPrefixes,
  testAgenticRagIgnoreFiltersNullSummaryReturnsEmptyPrefixes,
  testApplyIgnoreCodebasePathsUpdateUsesParsedPatterns,
} from '@/__tests__/agenticRagIgnoreFilters.test'
import {
  testApplySchemaUiSnapshotSkipsWhenEditorClosed,
  testApplySchemaUiSnapshotCallsApplyWhenHashMatches,
} from '@/__tests__/schemaSnapshot.test'
import {
  testSpreadsheetFiltersFallbackOnLastRemoval,
  testSpreadsheetFiltersRemoveChildFromOnlyGroup,
  testSpreadsheetSortsRemoveLastRuleKeepsFallback,
  testSpreadsheetSortsDeduplicateSortKeysKeepsFirstRule,
  testSpreadsheetSortsAddRuleSkipsExistingKeys,
} from '@/__tests__/spreadsheetFiltersSorts.test'
import { useGraphStore } from '@/hooks/useGraphStore'
import { testMediaInteractiveDefaults } from '@/__tests__/mediaInteractiveDefaults.test'
import {
  testExampleWorkflowMarkdownIngestionProducesGraph,
  testMarkdownFrontmatterOntologiesAndPolygonLayersRoundTrip,
} from '@/__tests__/exampleWorkflowMarkdownIngestion.test'
import { testExampleWorkflowSliceTidyTreeDerivationUsesWorkflowEdges } from '@/__tests__/exampleWorkflowTidyTree.test'

type GraphDataTablePerfSample = {
  durationMs: number
  ts: number
}

type GraphDataTableSelectionPerfDetail = {
  subscriber: 'graphDataTable'
  durationMs: number
  ts: number
}

type GraphDataTableSelectionPerfEvent = CustomEvent<GraphDataTableSelectionPerfDetail>

const graphDataTablePerfSamples: GraphDataTablePerfSample[] = []

let graphDataTablePerfListener: ((event: Event) => void) | null = null

const initGraphDataTablePerfHarness = () => {
  const g = globalThis as unknown as Window & typeof globalThis
  const state = useGraphStore.getState()
  if (state.setGraphDataTableVirtualDebugLogRanges) {
    state.setGraphDataTableVirtualDebugLogRanges(true)
  }
  const anyWindow = g as unknown as { __KG_SELECTION_PERF_ENABLED__?: boolean }
  anyWindow.__KG_SELECTION_PERF_ENABLED__ = true
  if (graphDataTablePerfListener && g.removeEventListener) {
    g.removeEventListener('kg-selection-perf', graphDataTablePerfListener as EventListener)
  }
  graphDataTablePerfSamples.length = 0
  graphDataTablePerfListener = (event: Event) => {
    const e = event as GraphDataTableSelectionPerfEvent
    const detail = e.detail
    if (!detail || typeof detail.durationMs !== 'number' || detail.subscriber !== 'graphDataTable') return
    graphDataTablePerfSamples.push({ durationMs: detail.durationMs, ts: detail.ts })
  }
  if (g.addEventListener && graphDataTablePerfListener) {
    g.addEventListener('kg-selection-perf', graphDataTablePerfListener as EventListener)
  }
}

const readGraphDataTablePerfHarness = () => {
  if (graphDataTablePerfSamples.length === 0) {
    return { count: 0, avgMs: 0, p95Ms: 0, maxMs: 0 }
  }
  const sorted = [...graphDataTablePerfSamples].sort((a, b) => a.durationMs - b.durationMs)
  const count = sorted.length
  let total = 0
  for (const sample of sorted) {
    total += sample.durationMs
  }
  const avgMs = total / count
  const p95Index = Math.floor(0.95 * (count - 1))
  const p95Ms = sorted[p95Index]?.durationMs ?? sorted[count - 1].durationMs
  const maxMs = sorted[count - 1].durationMs
  return { count, avgMs, p95Ms, maxMs }
}

export const runAllTests = async () => {
  const results: { name: string; ok: boolean; error?: string }[] = [];
  const exec = async (name: string, fn: () => void | Promise<void>) => {
    try {
      await fn();
      results.push({ name, ok: true });
    } catch (e: unknown) {
      const msg = (() => {
        const em = e as { message?: unknown }
        return String(em?.message ?? e)
      })()
      results.push({ name, ok: false, error: msg });
    }
  };
  await exec('tabSync.buildEnvelope', testBuildEnvelope);
  await exec('graph.edgeExists', testEdgeExists);
  await exec('graph.normalizeEdgesForSim.filtersDangling', testNormalizeEdgesForSimFiltersDanglingEndpoints);
  await exec('edgeCreation.finalizeCreate', testFinalizeCreateEdge);
  await exec('edgeCreation.finalizeExisting', testFinalizeUseExistingEdge);
  await exec('edgeCreation.finalizeUpdateSource', testFinalizeUpdateSource);
  await exec('edgeCreation.finalizeUpdateTarget', testFinalizeUpdateTarget);
  await exec('schema.validateDefaults', testValidateSchemaFillsDefaults);
  await exec('schema.behaviorDefaults', testValidateSchemaBehaviorDefaults);
  await exec('schema.typeCRUD', testAddRenameRemoveNodeType);
  await exec('schema.nodePropertyCRUD', testUpsertRemoveNodeProperty);
  await exec('schema.alphaDecayClamp', testClampAlphaDecay);
  await exec('schema.collisionRadiusClamp', testClampCollisionRadiusUsesSharedBounds);
  await exec('schema.semanticNodeRadiusUsesProps', testRenderNodeRadiusSemanticRespectsNodeSizeAndImportance);
  await exec('schema.tabEnterText', testSchemaTabEnterText);
  await exec('schema.persistenceWrites', testSchemaPersistenceWrites);
  await exec('schema.resetImportTextSync', testResetImportSchemaTabTextSync);
  await exec('schema.resetImportApplyModifiedTextSync', testResetImportSchemaTabApplyModifiedSync);
  await exec('schema.uiApplyUsesLatestStoreSchema', testSchemaUiApplyUsesLatestStoreSchema);
  await exec('schema.uiApplyRegistrationGuardsAgainstImportRace', testSchemaUiApplyRegistrationGuardsAgainstImportRace);
  await exec('schema.parseSchemaTextRejectsInvalidJson', testParseSchemaTextRejectsInvalidJson);
  await exec('minimap.computeViewRect', testComputeViewRect);
  await exec('graph.selectionHighlight.nodeNeighbors', testSelectionHighlightNeighborsFromNodeSelection);
  await exec('graph.selectionHighlight.edgeEndpoints', testSelectionHighlightEdgeSelectionEndpointsAndEdges);
  await exec('graph.selectionZoom.nodeSelectionSubset', testSelectionZoomNodeSelectionUsesNodeAndNeighbors);
  await exec('graph.selectionZoom.edgeSelectionSubset', testSelectionZoomEdgeSelectionUsesEndpointsAndNeighbors);
  await exec('graph.selectionZoom.noSelectionSubset', testSelectionZoomNoSelectionReturnsEmptySubset);
  await exec('settings.registryReadWrite', testSettingsRegistryReadWrite);
  await exec('export.parseCombinedCsv', testParseCombinedCsv);
  await exec('csv.kindFormat', testParseKindCsv);
  await exec('csv.roundTrip', testCsvRoundTrip);
  await exec('export.graphMl', testGraphMlExport);
  await exec('export.cypher', testCypherExport);
  await exec('jsonld.roundTrip', testJsonLdRoundTrip);
  await exec('jsonld.aiVizEdges', testJsonLdAiVizEdges);
  await exec('jsonld.agenticGraphEdges', testJsonLdAgenticGraphEdges);
  await exec('jsonld.inferredEdges.compactIriArrays', testJsonLdInferredEdgesFromCompactIriArrays);
  await exec('jsonld.phaseMembership.kgPrefix', testJsonLdPhaseMembershipArraysWithKgPrefix);
  await exec('jsonld.graphRagPathInNodeProperties', testJsonLdAgenticGraphRagPathStaysInNodeProperties);
  await exec('jsonld.workerPipelineEdges', testJsonLdWorkerPipelineParsesExpectedEdges);
  await exec('jsonld.triplesExpectedSet', testJsonLdTriplesMatchExpectedSet);
  await exec('jsonld.workflow.historyGraphShape', testWorkflowJsonLdHistoryGraphShape);
  await exec('jsonld.workflow.graphFieldSettingsGraphShape', testWorkflowJsonLdGraphFieldSettingsGraphShape);
  await exec('jsonld.workflow.graphFieldSettings.agenticRagRoundTrip', testWorkflowJsonLdGraphFieldSettingsAgenticRagRoundTrip);
  await exec('jsonld.workflow.graphRagWorkflowShape', testWorkflowJsonLdGraphRagWorkflowShape);
  await exec('jsonld.workflow.graphRagCliYamlMapping', testWorkflowJsonLdGraphRagCliYamlMapping);
  await exec('jsonld.workflow.graphRagPathGraphFieldSettingsFixture', testWorkflowJsonLdGraphRagPathGraphFieldSettingsFixture);
  await exec('graphFields.derivedFromCsvJsonJsonLd', testGraphFieldsDerivedFromCsvJsonJsonLd);
  await exec('graphFields.derivedFromPlainEdgesCsv', testGraphFieldsDerivedFromPlainEdgesCsv);
  await exec('graphrag.traversal.happyPath', testGraphRagTraversalHappyPath);
  await exec('graphrag.traversal.ignoresInvalidShapes', testGraphRagTraversalIgnoresInvalidShapes);
  await exec('graphrag.traversal.missingOwner', testGraphRagTraversalHandlesMissingOwner);
  await exec('graphrag.owner.prefersSelectedOwner', testFindGraphRagOwnerNodePrefersSelectedOwner);
  await exec(
    'graphrag.owner.prefersOwnerWithSelectedInTraverse',
    testFindGraphRagOwnerNodePrefersOwnerWithSelectedInTraverse,
  );
  await exec(
    'ui.graphTraversalFloatingPanel.genericDepthClamp',
    testGraphTraversalFloatingPanelGenericDepthClamp,
  );
  await exec('cache.lruBasic', testLRUCacheBasic);
  await exec('cache.lruClear', testLRUCacheClear);
  await exec('ui.panelUnifiedExport', testUnifiedPanelExport);
  await exec('ui.settingsCollapsePersistence', testSettingsViewCollapsePersistence);
  await exec('ui.bottomPanelCollapsePersistence', testBottomPanelCollapsePersistence);
  await exec('ui.graphFieldsPruneOnGraphDataChange', testGraphFieldsPruneOnGraphDataChange);
  await exec('ui.graphFieldsStorePopulatesDerivedFields', testGraphFieldsStorePopulatesDerivedFields);
  await exec('ui.graphFieldsSyncOnNodeAndEdgeMutations', testGraphFieldsSyncOnNodeAndEdgeMutations);
  await exec('ui.graphFieldsSyncOnEdgePropertiesEditViaTableUi', testGraphFieldsSyncOnEdgePropertiesEditViaTableUi);
  await exec('ui.graphFieldsSyncOnHistoryUndoRedo', testGraphFieldsSyncOnHistoryUndoRedo);
  await exec('ui.themeModePersistence', testThemeModePersistence);
  await exec('ui.markdown.layoutModePersistence', testMarkdownLayoutModePersistence);
  await exec('ui.markdown.syncScrollPersistence', testMarkdownSyncScrollPersistence);
  await exec('ui.launchSpotlightPersistence', testLaunchSpotlightStorageHelpers);
  await exec('persistence.storagePrimitives', testPersistencePrimitives);
  await exec('search.cacheVersionKey', testSearchCacheKeysRespectVersion);
  await exec('n8n.parseWorkflow', testN8nParsingBasic);
  await exec('parser.registryCrud', testParserRegistryCrud);
  await exec('parser.customConversion', testCustomParserConversion);
  await exec('parser.customTransforms', testCustomParserTransforms);
  await exec('parser.arrayPath', testTransformArrayPath);
  await exec('parser.wildcardAgg', testWildcardAggregation);
  await exec('parser.wildcardMinMaxAvg', testWildcardMinMaxAvg);
  await exec('parser.wildcardPercentile', testWildcardPercentile);
  await exec('parser.wildcardPercentileNearest', testWildcardPercentileNearest);
  await exec('parser.wildcardPercentileTukeyHazen', testWildcardPercentileTukeyHazen);
  await exec('parser.wildcardPercentileHF', testWildcardPercentileHF);
  await exec('parser.typeMethodWarning', testCustomParserTypeMethodWarning);
  await exec('parser.autoSelectOnLoad', testParserAutoSelectOnLoad);
  await exec('parser.uiStateHydration', testParserUIStateHydration);
  await exec('parser.yamlTransformsValidation', testYamlTransformsValidation);
  await exec('parser.cacheCfgKey', testParserCacheCfgKey);
  await exec('jsonEditor.lineHeightConstant', testJsonEditorLineHeightConstant);
  await exec('parser.workflowPresetStorage', testParserWorkflowPresetStorage);
  await exec('parser.rawJson.nodesArrayIngestion', testRawJsonNodesArrayIngestion);
  await exec('parser.rawJson.extendedNodesIngestion', testRawJsonExtendedNodesIngestion);
  await exec('parser.rawJson.workflowShapeIngestion', testRawJsonWorkflowShapeIngestion);
  await exec('spreadsheet.filtersFallbackOnLastRemoval', testSpreadsheetFiltersFallbackOnLastRemoval);
  await exec('spreadsheet.filtersRemoveChildFromOnlyGroup', testSpreadsheetFiltersRemoveChildFromOnlyGroup);
  await exec('spreadsheet.sortsRemoveLastRuleKeepsFallback', testSpreadsheetSortsRemoveLastRuleKeepsFallback);
  await exec('spreadsheet.sortsDeduplicateSortKeysKeepsFirstRule', testSpreadsheetSortsDeduplicateSortKeysKeepsFirstRule);
  await exec('spreadsheet.sortsAddRuleSkipsExistingKeys', testSpreadsheetSortsAddRuleSkipsExistingKeys);
  await exec('schemaLint.parseOwner', testParseSchemaLintOwner);
  await exec('schemaLint.summaryAndActivePath', testSchemaLintSummaryAndActivePath);
  await exec('graphValidation.emptyGraphSummary', testGraphValidationEmptyGraphSummary);
  await exec('graphValidation.duplicatesAndDangling', testGraphValidationDuplicateNodeIdsAndDanglingEdges);
  await exec('graphValidation.nodeRulesApplied', testGraphValidationNodeRulesApplied);
  await exec('graphValidation.metricsSyntheticRaw', testGraphValidationMetricsWithSyntheticRawDataset);
  await exec('export.selectionFromNode', testBuildSelectionSubgraphFromNode);
  await exec('export.selectionFromEdge', testBuildSelectionSubgraphFromEdge);
  await exec('schemaFixtures.universalSchemaAwareGraph', testUniversalSchemaValidatesSchemaAwareGraph);
  await exec('schemaFixtures.universalGraphRagPathSpec', testUniversalSchemaHasGraphRagPathPropertySpecs);
  await exec('schemaFixtures.graphRagPath', testGraphRagPathSchemaFixture);
  await exec('schemaFixtures.schemaFromJsonLd', testSchemaFromJsonLdBuildsCatalogAndPropertySpecs);
  await exec('schemaFixtures.schemaJsonLdRoundTripLayers', testSchemaJsonLdRoundTripPreservesLayers);
  await exec('schemaFixtures.jsonldRoundTrip', testJsonLdGraphsParseAndValidateWithUniversalSchema);
  await exec('schemaFixtures.miniVizComputes', testMiniVizComputesOnSelectionSubgraph);
  await exec(
    'schemaFixtures.exampleWorkflowSchemaSnippetParsesHiddenNodeTypes',
    testExampleWorkflowSchemaSnippetParsesHiddenNodeTypes,
  );
  await exec(
    'schemaFixtures.exampleWorkflowJsonLdSemanticVsDocumentStructureLayers',
    testExampleWorkflowJsonLdSemanticVsDocumentStructureLayers,
  );
  await exec('workflowPreset.selfConsistent', testWorkflowPresetPipelinesAreSelfConsistent);
  await exec('workflowPreset.exportBrandedPaths', testExportFunctionsAcceptBrandedPaths);
  await exec('ui.help.pipelineCopyMatchesCommand', testHelpPipelineCopyMatchesCommandConstant);
  await exec('ui.markdown.parserMetadataAnchors', testMarkdownParserMetadataAnchorsAreAgenticRagCompatible);
  await exec('ui.media.mediaInteractiveDefaults', testMediaInteractiveDefaults);
  await exec(
    'ui.markdown.exampleWorkflowMarkdownIngestionProducesGraph',
    testExampleWorkflowMarkdownIngestionProducesGraph,
  );
  await exec(
    'ui.markdown.frontmatterOntologiesAndPolygonLayersRoundTrip',
    testMarkdownFrontmatterOntologiesAndPolygonLayersRoundTrip,
  );
  await exec(
    'ui.markdown.exampleWorkflowSliceTidyTreeDerivationUsesWorkflowEdges',
    testExampleWorkflowSliceTidyTreeDerivationUsesWorkflowEdges,
  );
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    const mod = await import('@/__tests__/markdownMediaToggleE2e.test')
    await exec('ui.markdown.mediaToggleEndToEnd', mod.testMarkdownMediaToggleEndToEnd)
    await exec('ui.markdown.headMetaFrontmatterArrays', mod.testMarkdownHeadMetaFrontmatterArrays)
    await exec('ui.markdown.scrollSync.viewerToEditor', mod.testMarkdownScrollSyncViewerToEditor)
    const modShowOnCanvas = await import('@/__tests__/markdownPreviewShowOnCanvas.test')
    await exec('ui.markdown.preview.showOnCanvas', modShowOnCanvas.testMarkdownPreviewShowOnCanvasSelectsExpectedNode)
    const modSelectionScroll = await import('@/__tests__/markdownSelectionScrollHighlight.test')
    await exec('ui.markdown.selection.scrollAndHighlight', modSelectionScroll.testCanvasSelectionScrollsAndHighlightsMarkdown)
  }
  await exec('ui.orchestrator.tooltipRoleActionOutcomeShape', testOrchestratorTooltipRoleActionOutcomeShape);
  await exec('ui.orchestrator.toolMenuUsesTooltipCopyHelper', testOrchestratorToolMenuUsesTooltipCopyHelper);
  await exec('ui.orchestrator.sectionListLabelIncludesExpectedSections', testOrchestratorSectionListLabelIncludesExpectedSections);
  await exec('ui.orchestrator.roleActionOutcomeJsonLdFixtureMatchesTooltip', testOrchestratorRoleActionOutcomeJsonLdFixtureMatchesTooltip);
  await exec('ui.orchestrator.agenticRagNodeInspectorTooltipUsesCopyHelper', testAgenticRagNodeInspectorTooltipUsesCopyHelper);
  await exec('ui.orchestrator.agenticRagContextTooltipUsesCopyHelper', testAgenticRagContextTooltipUsesCopyHelper);
  await exec('ui.graphDataTable.toolMenuUsesCurationCopyHelper', testGraphDataTableToolMenuUsesCurationCopyHelper);
  await exec('ui.collapsibleDefaultsCompactAndAnchoredToLsKeys', testCollapsibleDefaultsCompactAndAnchoredToLsKeys);
  await exec('agenticRag.ignoreFilters.invalidPrefixes', testAgenticRagIgnoreFiltersInvalidPrefixes);
  await exec('agenticRag.ignoreFilters.emptySummary', testAgenticRagIgnoreFiltersEmptySummaryReturnsEmptyPrefixes);
  await exec('agenticRag.ignoreFilters.nullSummary', testAgenticRagIgnoreFiltersNullSummaryReturnsEmptyPrefixes);
  await exec('agenticRag.ignoreFilters.applyIgnoreCodebasePathsUpdateUsesParsedPatterns', testApplyIgnoreCodebasePathsUpdateUsesParsedPatterns);
  await exec('schema.applySchemaUiSnapshot.skipsWhenEditorClosed', testApplySchemaUiSnapshotSkipsWhenEditorClosed);
  await exec('schema.applySchemaUiSnapshot.callsApplyWhenHashMatches', testApplySchemaUiSnapshotCallsApplyWhenHashMatches);
  return results;
};

declare global {
  interface Window {
    knowgrphRunTests?: typeof runAllTests
    knowgrphInitGraphDataTablePerf?: () => void
    knowgrphReadGraphDataTablePerf?: () => { count: number; avgMs: number; p95Ms: number; maxMs: number }
  }
}
if (import.meta && (import.meta as ImportMeta).env && (import.meta as ImportMeta).env.DEV) {
  window.knowgrphRunTests = runAllTests;
  window.knowgrphInitGraphDataTablePerf = initGraphDataTablePerfHarness
  window.knowgrphReadGraphDataTablePerf = readGraphDataTablePerfHarness
}
