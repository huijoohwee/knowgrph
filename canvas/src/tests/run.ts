import { testBuildEnvelope } from '@/__tests__/tabSync.test'
import { testEdgeExists, testNormalizeEdgesForSimFiltersDanglingEndpoints } from '@/__tests__/edges.test'
import {
  testFinalizeCreateEdge,
  testFinalizeUseExistingEdge,
  testFinalizeUpdateSource,
  testFinalizeUpdateTarget,
} from '@/__tests__/edgeCreation.test'
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
import {
  testCsvRoundTrip,
  testGraphMlExport,
  testCypherExport,
  testGraphFieldsDerivedFromCsvJsonJsonLd,
  testGraphFieldsDerivedFromPlainEdgesCsv,
} from '@/__tests__/roundtrip.test'
import { testLRUCacheBasic, testLRUCacheClear } from '@/__tests__/cache.test'
import { testReorderListBasicMoves, testReorderListNoopAndBounds } from '@/__tests__/reorder.test'
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
import { testBottomPanelMarkdownFullscreenOpensOverlay } from '@/__tests__/bottomPanelFullscreenUi.test'
import { testSearchCacheKeysRespectVersion } from '@/__tests__/searchCache.test'
import { testN8nParsingBasic } from '@/__tests__/n8nParse.test'
import { testJsonEditorLineHeightConstant } from '@/__tests__/jsonEditorRendering.test'
import {
  testBuildSelectionSubgraphFromNode,
  testBuildSelectionSubgraphFromEdge,
} from '@/__tests__/selectionExport.test'
import {
  testGraphValidationEmptyGraphSummary,
  testGraphValidationDuplicateNodeIdsAndDanglingEdges,
  testGraphValidationNodeRulesApplied,
  testGraphValidationMetricsWithSyntheticRawDataset,
} from '@/__tests__/graphValidation.test'
import { testMarkdownMermaidFrontmatterLabeledEdgeAndMentions } from '@/__tests__/markdownMermaidFrontmatter.test'
import { testMermaidLayoutDoesNotFailOnMarkdownSlideDemo } from '@/__tests__/mermaidLayoutStability.test'
import {
  testGraphRagTraversalHappyPath,
  testGraphRagTraversalIgnoresInvalidShapes,
  testGraphRagTraversalHandlesMissingOwner,
  testFindGraphRagOwnerNodePrefersSelectedOwner,
  testFindGraphRagOwnerNodePrefersOwnerWithSelectedInTraverse,
} from '@/__tests__/graphRagTraversal.test'
import { testGraphTraversalFloatingPanelGenericDepthClamp } from '@/__tests__/graphTraversalFloatingPanel.test'
import { testThemeModePersistence } from '@/__tests__/theme.test'
import { runMarkdownTests } from '@/tests/runners/runMarkdownTests'
import { runSchemaTests } from '@/tests/runners/runSchemaTests'
import { runJsonLdTests } from '@/tests/runners/runJsonLdTests'
import { runParserTests } from '@/tests/runners/runParserTests'
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
  testWorkflowPresetPipelinesAreSelfConsistent,
  testExportFunctionsAcceptBrandedPaths,
} from '@/__tests__/workflowPresetPipeline.test'
import {
  testHelpPipelineCopyMatchesCommandConstant,
  testMarkdownParserMetadataAnchorsAreAgenticRagCompatible,
} from '@/__tests__/helpPipelineCopy.test'
import {
  testOrchestratorTooltipRoleActionOutcomeShape,
  testOrchestratorToolMenuUsesTooltipCopyHelper,
  testOrchestratorSectionListLabelIncludesExpectedSections,
  testGraphDataTableToolMenuUsesCurationCopyHelper,
  testOrchestratorRoleActionOutcomeJsonLdFixtureMatchesTooltip,
  testAgenticRagNodeInspectorTooltipUsesCopyHelper,
  testAgenticRagContextTooltipUsesCopyHelper,
} from '@/__tests__/orchestratorCopy.test'
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
import {
  testPreviewGalleryArrowMovesThirdSlideAboveSecond,
  testPreviewGalleryDragMovesThirdSlideAboveSecond,
  testPreviewGalleryDragMovesFirstSlideBelowThird,
  testPreviewGalleryDragMovesFirstSlideToLastInLongerList,
  testPreviewGalleryDragMovesLastSlideToFirstInLongerList,
} from '@/__tests__/previewGalleryReorder.test'
import { useGraphStore } from '@/hooks/useGraphStore'
import { testMediaInteractiveDefaults } from '@/__tests__/mediaInteractiveDefaults.test'
import { testTreeSeparationSchemaRoundTrip } from '@/__tests__/treeSeparationRoundTrip.test'
import { testExampleWorkflowSliceTreeDerivationUsesWorkflowEdges } from '@/__tests__/exampleWorkflowTree.test'
import {
  testSemanticLayerVisualFillParity2dVs3d,
  testDocumentStructureLayerOpacityParity2dVs3d,
  testLayerModeNodeBaseFillConsistentAcrossModes,
} from '@/__tests__/layerVisualParity.test'
import { testStatsTokensByGraphLayerUsesPaletteFillForMarkdownSlideDemo } from '@/__tests__/statsGraphLayerTokens.test'
import { testFrontmatterModeFiltersGraphToMermaidNodes } from '@/__tests__/frontmatterModeGraphFilter.test'
import { testFrontmatterModeEdaMlpFiltersGraphToMermaidFrontmatter } from '@/__tests__/frontmatterModeEdaMlpGraphFilter.test'
import { testMermaidSubgraphLayoutCoordinates } from '@/__tests__/markdown/reproduce_mermaid_subgraph_layout.test'

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
  const filter = process.argv.slice(2).find(arg => !arg.startsWith('-'))
  const results: { name: string; ok: boolean; error?: string }[] = []
  const exec = async (name: string, fn: () => void | Promise<void>) => {
    if (filter && !name.toLowerCase().includes(filter.toLowerCase())) return
    try {
      console.log(`RUN ${name}`)
      const timeoutMs = 120_000
      let timeoutId: ReturnType<typeof setTimeout> | null = null
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${name} timed out after ${timeoutMs}ms`)), timeoutMs)
      })
      try {
        await Promise.race([Promise.resolve().then(fn), timeoutPromise])
      } finally {
        if (timeoutId != null) clearTimeout(timeoutId)
      }
      results.push({ name, ok: true })
    } catch (e: unknown) {
      const msg = (() => {
        const em = e as { message?: unknown }
        return String(em?.message ?? e)
      })()
      results.push({ name, ok: false, error: msg })
    }
  }

  // Runners
  await runMarkdownTests(results)
  await runSchemaTests(results)
  await runJsonLdTests(results)
  await runParserTests(results)

  // Remaining tests
  
  await exec('previewGalleryReorder: arrow moves third above second', testPreviewGalleryArrowMovesThirdSlideAboveSecond)
  await exec('previewGalleryReorder: drag moves third above second', testPreviewGalleryDragMovesThirdSlideAboveSecond)
  await exec('previewGalleryReorder: drag moves first below third', testPreviewGalleryDragMovesFirstSlideBelowThird)
  await exec(
    'previewGalleryReorder: drag moves first to last in longer list',
    testPreviewGalleryDragMovesFirstSlideToLastInLongerList,
  )
  await exec(
    'previewGalleryReorder: drag moves last to first in longer list',
    testPreviewGalleryDragMovesLastSlideToFirstInLongerList,
  )

  await exec('markdown.mermaidFrontmatter.labeledEdgeAndMentions', testMarkdownMermaidFrontmatterLabeledEdgeAndMentions)
  await exec('markdown.mermaidLayout.slideDemo.noDagreFailure', testMermaidLayoutDoesNotFailOnMarkdownSlideDemo)

  await exec('tabSync.buildEnvelope', testBuildEnvelope)
  await exec('graph.edgeExists', testEdgeExists)
  await exec(
    'graph.normalizeEdgesForSim.filtersDangling',
    testNormalizeEdgesForSimFiltersDanglingEndpoints,
  )
  await exec('edgeCreation.finalizeCreate', testFinalizeCreateEdge)
  await exec('edgeCreation.finalizeExisting', testFinalizeUseExistingEdge)
  await exec('edgeCreation.finalizeUpdateSource', testFinalizeUpdateSource)
  await exec('edgeCreation.finalizeUpdateTarget', testFinalizeUpdateTarget)
  
  await exec('minimap.computeViewRect', testComputeViewRect)
  await exec(
    'graph.selectionHighlight.nodeNeighbors',
    testSelectionHighlightNeighborsFromNodeSelection,
  )
  await exec(
    'graph.selectionHighlight.edgeEndpoints',
    testSelectionHighlightEdgeSelectionEndpointsAndEdges,
  )
  await exec(
    'graph.selectionZoom.nodeSelectionSubset',
    testSelectionZoomNodeSelectionUsesNodeAndNeighbors,
  )
  await exec(
    'graph.selectionZoom.edgeSelectionSubset',
    testSelectionZoomEdgeSelectionUsesEndpointsAndNeighbors,
  )
  await exec('graph.selectionZoom.noSelectionSubset', testSelectionZoomNoSelectionReturnsEmptySubset)
  await exec('settings.registryReadWrite', testSettingsRegistryReadWrite)
  await exec('export.parseCombinedCsv', testParseCombinedCsv)
  await exec('csv.kindFormat', testParseKindCsv)
  await exec('csv.roundTrip', testCsvRoundTrip)
  await exec('export.graphMl', testGraphMlExport)
  await exec('export.cypher', testCypherExport)
  
  await exec('graphFields.derivedFromCsvJsonJsonLd', testGraphFieldsDerivedFromCsvJsonJsonLd)
  await exec('graphFields.derivedFromPlainEdgesCsv', testGraphFieldsDerivedFromPlainEdgesCsv)
  await exec('graphrag.traversal.happyPath', testGraphRagTraversalHappyPath)
  await exec('graphrag.traversal.ignoresInvalidShapes', testGraphRagTraversalIgnoresInvalidShapes)
  await exec('graphrag.traversal.missingOwner', testGraphRagTraversalHandlesMissingOwner)
  await exec('graphrag.owner.prefersSelectedOwner', testFindGraphRagOwnerNodePrefersSelectedOwner)
  await exec(
    'graphrag.owner.prefersOwnerWithSelectedInTraverse',
    testFindGraphRagOwnerNodePrefersOwnerWithSelectedInTraverse,
  )
  await exec(
    'ui.graphTraversalFloatingPanel.genericDepthClamp',
    testGraphTraversalFloatingPanelGenericDepthClamp,
  )
  await exec('cache.lruBasic', testLRUCacheBasic)
  await exec('cache.lruClear', testLRUCacheClear)
  await exec('util.reorderList.basicMoves', testReorderListBasicMoves)
  await exec('util.reorderList.noopAndBounds', testReorderListNoopAndBounds)
  await exec('ui.panelUnifiedExport', testUnifiedPanelExport)
  await exec('ui.settingsCollapsePersistence', testSettingsViewCollapsePersistence)
  await exec('ui.bottomPanelCollapsePersistence', testBottomPanelCollapsePersistence)
  await exec('ui.bottomPanel.markdownFullscreenOpensOverlay', testBottomPanelMarkdownFullscreenOpensOverlay)
  await exec('ui.graphFieldsPruneOnGraphDataChange', testGraphFieldsPruneOnGraphDataChange)
  await exec(
    'ui.graphFieldsStorePopulatesDerivedFields',
    testGraphFieldsStorePopulatesDerivedFields,
  )
  await exec(
    'ui.graphFieldsSyncOnNodeAndEdgeMutations',
    testGraphFieldsSyncOnNodeAndEdgeMutations,
  )
  await exec(
    'ui.graphFieldsSyncOnEdgePropertiesEditViaTableUi',
    testGraphFieldsSyncOnEdgePropertiesEditViaTableUi,
  )
  await exec('ui.graphFieldsSyncOnHistoryUndoRedo', testGraphFieldsSyncOnHistoryUndoRedo)
  await exec('ui.themeModePersistence', testThemeModePersistence)
  
  await exec('ui.launchSpotlightPersistence', testLaunchSpotlightStorageHelpers)
  await exec('persistence.storagePrimitives', testPersistencePrimitives)
  await exec('search.cacheVersionKey', testSearchCacheKeysRespectVersion)
  await exec('n8n.parseWorkflow', testN8nParsingBasic)
  
  await exec('jsonEditor.lineHeightConstant', testJsonEditorLineHeightConstant)
  
  await exec(
    'spreadsheet.filtersFallbackOnLastRemoval',
    testSpreadsheetFiltersFallbackOnLastRemoval,
  )
  await exec(
    'spreadsheet.filtersRemoveChildFromOnlyGroup',
    testSpreadsheetFiltersRemoveChildFromOnlyGroup,
  )
  await exec(
    'spreadsheet.sortsRemoveLastRuleKeepsFallback',
    testSpreadsheetSortsRemoveLastRuleKeepsFallback,
  )
  await exec(
    'spreadsheet.sortsDeduplicateSortKeysKeepsFirstRule',
    testSpreadsheetSortsDeduplicateSortKeysKeepsFirstRule,
  )
  await exec(
    'spreadsheet.sortsAddRuleSkipsExistingKeys',
    testSpreadsheetSortsAddRuleSkipsExistingKeys,
  )
  await exec('schemaLint.parseOwner', testParseSchemaLintOwner)
  await exec('schemaLint.summaryAndActivePath', testSchemaLintSummaryAndActivePath)
  await exec('graphValidation.emptyGraphSummary', testGraphValidationEmptyGraphSummary)
  await exec(
    'graphValidation.duplicatesAndDangling',
    testGraphValidationDuplicateNodeIdsAndDanglingEdges,
  )
  await exec('graphValidation.nodeRulesApplied', testGraphValidationNodeRulesApplied)
  await exec(
    'graphValidation.metricsSyntheticRaw',
    testGraphValidationMetricsWithSyntheticRawDataset,
  )
  await exec('export.selectionFromNode', testBuildSelectionSubgraphFromNode)
  await exec('export.selectionFromEdge', testBuildSelectionSubgraphFromEdge)
  await exec('schemaFixtures.universalSchemaAwareGraph', testUniversalSchemaValidatesSchemaAwareGraph)
  await exec(
    'schemaFixtures.universalGraphRagPathSpec',
    testUniversalSchemaHasGraphRagPathPropertySpecs,
  )
  await exec('schemaFixtures.graphRagPath', testGraphRagPathSchemaFixture)
  await exec(
    'schemaFixtures.schemaFromJsonLd',
    testSchemaFromJsonLdBuildsCatalogAndPropertySpecs,
  )
  await exec(
    'schemaFixtures.schemaJsonLdRoundTripLayers',
    testSchemaJsonLdRoundTripPreservesLayers,
  )
  await exec(
    'schemaFixtures.jsonldRoundTrip',
    testJsonLdGraphsParseAndValidateWithUniversalSchema,
  )
  await exec('schemaFixtures.miniVizComputes', testMiniVizComputesOnSelectionSubgraph)
  await exec(
    'schemaFixtures.exampleWorkflowSchemaSnippetParsesHiddenNodeTypes',
    testExampleWorkflowSchemaSnippetParsesHiddenNodeTypes,
  )
  await exec(
    'schemaFixtures.exampleWorkflowJsonLdSemanticVsDocumentStructureLayers',
    testExampleWorkflowJsonLdSemanticVsDocumentStructureLayers,
  )
  await exec('workflowPreset.selfConsistent', testWorkflowPresetPipelinesAreSelfConsistent)
  await exec('workflowPreset.exportBrandedPaths', testExportFunctionsAcceptBrandedPaths)
  await exec('ui.help.pipelineCopyMatchesCommand', testHelpPipelineCopyMatchesCommandConstant)
  await exec(
    'ui.markdown.parserMetadataAnchors',
    testMarkdownParserMetadataAnchorsAreAgenticRagCompatible,
  )
  await exec('ui.media.mediaInteractiveDefaults', testMediaInteractiveDefaults)
  await exec('tree.derivation.exampleWorkflow', testExampleWorkflowSliceTreeDerivationUsesWorkflowEdges)
  await exec(
    'graph.layerVisualParity.semanticVisualFill2dVs3d',
    testSemanticLayerVisualFillParity2dVs3d,
  )
  await exec(
    'graph.layerVisualParity.documentStructureOpacity2dVs3d',
    testDocumentStructureLayerOpacityParity2dVs3d,
  )
  await exec(
    'graph.layerVisualParity.layerModeNodeBaseFillConsistentAcrossModes',
    testLayerModeNodeBaseFillConsistentAcrossModes,
  )
  await exec(
    'stats.tokensByGraphLayer.usesPaletteFillForMarkdownSlideDemo',
    testStatsTokensByGraphLayerUsesPaletteFillForMarkdownSlideDemo,
  )

  await exec(
    'graph.frontmatterMode.filtersToMermaidFrontmatter',
    testFrontmatterModeFiltersGraphToMermaidNodes,
  )

  await exec(
    'graph.frontmatterMode.edaMlpFiltersToMermaidFrontmatter',
    testFrontmatterModeEdaMlpFiltersGraphToMermaidFrontmatter,
  )

  await exec('tree.separation.roundTrip', testTreeSeparationSchemaRoundTrip)

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    const modShowOnCanvas = await import('@/__tests__/markdownPreviewShowOnCanvas.test')
    await exec(
      'ui.markdown.preview.showOnCanvas',
      modShowOnCanvas.testMarkdownPreviewShowOnCanvasSelectsExpectedNode,
    )

    await import('@/__tests__/markdownSelectionScrollHighlight.test')
    // await exec(
    //   'ui.markdown.selection.scrollAndHighlight',
    //   modSelectionScroll.testCanvasSelectionScrollsAndHighlightsMarkdown,
    // )

    const modCollapsible = await import('@/__tests__/collapsibleDefaults.test')
    await exec(
      'ui.collapsibleDefaultsCompactAndAnchoredToLsKeys',
      modCollapsible.testCollapsibleDefaultsCompactAndAnchoredToLsKeys,
    )

    const modFrontmatterToggle = await import('@/__tests__/frontmatterModeCanvasToggle.test')
    await exec(
      'ui.graph.frontmatterMode.canvasToggleFiltersNodesAndEdges2dAnd3d',
      modFrontmatterToggle.testFrontmatterModeCanvasToggleFiltersNodesAndEdgesFor2dAnd3d,
    )

    const enableMicrobench =
      process.env.KG_RUN_MICROBENCH === '1' ||
      process.env.KG_RUN_MICROBENCH === 'true' ||
      process.env.KG_RUN_MICROBENCH === 'yes'

    if (
      enableMicrobench &&
      typeof modFrontmatterToggle.testFrontmatterModeHullMicrobenchmarkForMarkdownSlideDemo === 'function'
    ) {
      await exec(
        'graph.frontmatterMode.hullMicrobenchmark.markdownSlideDemo',
        modFrontmatterToggle.testFrontmatterModeHullMicrobenchmarkForMarkdownSlideDemo,
      )
    }

    if (typeof modFrontmatterToggle.testFrontmatterModeGraphLayersHideMermaidSubgraphNodesIn2dLayer === 'function') {
      await exec(
        'graph.frontmatterMode.graphLayersHideMermaidSubgraphNodesIn2dLayer',
        modFrontmatterToggle.testFrontmatterModeGraphLayersHideMermaidSubgraphNodesIn2dLayer,
      )
    }

    if (typeof modFrontmatterToggle.testFrontmatterModeGraphLayersShowMermaidSubgraphNodesIn2dLayerWhenOff === 'function') {
      await exec(
        'graph.frontmatterMode.graphLayersShowMermaidSubgraphNodesIn2dLayerWhenOff',
        modFrontmatterToggle.testFrontmatterModeGraphLayersShowMermaidSubgraphNodesIn2dLayerWhenOff,
      )
    }
  }

  await exec(
    'ui.orchestrator.tooltipRoleActionOutcomeShape',
    testOrchestratorTooltipRoleActionOutcomeShape,
  )
  await exec(
    'ui.orchestrator.toolMenuUsesTooltipCopyHelper',
    testOrchestratorToolMenuUsesTooltipCopyHelper,
  )
  await exec(
    'ui.orchestrator.sectionListLabelIncludesExpectedSections',
    testOrchestratorSectionListLabelIncludesExpectedSections,
  )
  await exec(
    'ui.orchestrator.roleActionOutcomeJsonLdFixtureMatchesTooltip',
    testOrchestratorRoleActionOutcomeJsonLdFixtureMatchesTooltip,
  )
  await exec(
    'ui.orchestrator.agenticRagNodeInspectorTooltipUsesCopyHelper',
    testAgenticRagNodeInspectorTooltipUsesCopyHelper,
  )
  await exec(
    'ui.orchestrator.agenticRagContextTooltipUsesCopyHelper',
    testAgenticRagContextTooltipUsesCopyHelper,
  )
  await exec(
    'ui.graphDataTable.toolMenuUsesCurationCopyHelper',
    testGraphDataTableToolMenuUsesCurationCopyHelper,
  )
  await exec(
    'agenticRag.ignoreFilters.invalidPrefixes',
    testAgenticRagIgnoreFiltersInvalidPrefixes,
  )
  await exec(
    'agenticRag.ignoreFilters.emptySummary',
    testAgenticRagIgnoreFiltersEmptySummaryReturnsEmptyPrefixes,
  )
  await exec(
    'agenticRag.ignoreFilters.nullSummary',
    testAgenticRagIgnoreFiltersNullSummaryReturnsEmptyPrefixes,
  )
  await exec(
    'agenticRag.ignoreFilters.applyIgnoreCodebasePathsUpdateUsesParsedPatterns',
    testApplyIgnoreCodebasePathsUpdateUsesParsedPatterns,
  )
  await exec(
    'schema.applySchemaUiSnapshot.skipsWhenEditorClosed',
    testApplySchemaUiSnapshotSkipsWhenEditorClosed,
  )
  await exec(
    'schema.applySchemaUiSnapshot.callsApplyWhenHashMatches',
    testApplySchemaUiSnapshotCallsApplyWhenHashMatches,
  )
  await exec('markdown.mermaid.subgraphLayoutCoordinates', testMermaidSubgraphLayoutCoordinates)

  return results
}

declare global {
  interface Window {
    knowgrphRunTests?: typeof runAllTests
    knowgrphInitGraphDataTablePerf?: () => void
    knowgrphReadGraphDataTablePerf?: () => {
      count: number
      avgMs: number
      p95Ms: number
      maxMs: number
    }
  }
}

if (
  typeof window !== 'undefined' &&
  typeof document !== 'undefined' &&
  import.meta &&
  (import.meta as ImportMeta).env &&
  (import.meta as ImportMeta).env.DEV
) {
  window.knowgrphRunTests = runAllTests
  window.knowgrphInitGraphDataTablePerf = initGraphDataTablePerfHarness
  window.knowgrphReadGraphDataTablePerf = readGraphDataTablePerfHarness
}
