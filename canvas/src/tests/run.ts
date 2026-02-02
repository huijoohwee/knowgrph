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
  testSelectionHighlightMediaOpacityRespectsRenderToggleAndLayerOpacity,
} from '@/__tests__/selectionHighlight.test'
import {
  testSelectionZoomNodeSelectionUsesNodeAndNeighbors,
  testSelectionZoomEdgeSelectionUsesEndpointsAndNeighbors,
  testSelectionZoomNoSelectionReturnsEmptySubset,
  testFitAllTransformRespectsCollisionPaddingInViewportFit,
  testFitAllTransformTargetFillUsesCapped1920x1080Frame,
  testFitAllTransformTargetFillUses80to20Ratio,
  testReadFitAllOptionsEnforces80to20FillRatioForAllFitIntents,
  testForceSimulationSeedsClusterAwarePositionsWhenMissing,
} from '@/__tests__/selectionZoom.test'
import { testGroupBboxCollideSeparatesTopParentGroups } from '@/__tests__/groupOverlapForce.test'
import {
  testIsNodePointerTargetAcceptsPathNodes,
  testNodesLayerRendersDiamondAndHexPaths,
  testNodesLayerHonorsVisualShapeOverrides,
} from '@/__tests__/nodeShapes2d.test'
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
import { testFindNextSourceFileIndexNested, testFindNextSourceFileIndexRoot, testNormalizeParentPath } from '@/__tests__/sourceFileNaming.test'
import {
  testWebkitRelativePathDoesNotTreatFileNameAsFolder,
  testWebkitRelativePathFallsBackToFileName,
  testWebkitRelativePathStripsRootFolder,
} from '@/__tests__/webkitRelativePath.test'
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
import {
  testGraphRagTraversalHappyPath,
  testGraphRagTraversalIgnoresInvalidShapes,
  testGraphRagTraversalHandlesMissingOwner,
  testFindGraphRagOwnerNodePrefersSelectedOwner,
  testFindGraphRagOwnerNodePrefersOwnerWithSelectedInTraverse,
} from '@/__tests__/graphRagTraversal.test'
import { testGraphTraversalFloatingPanelGenericDepthClamp } from '@/__tests__/graphTraversalFloatingPanel.test'
import { testThemeModePersistence, testThemeSystemModeApplyAndSubscribe } from '@/__tests__/theme.test'
import { runMarkdownTests } from '@/tests/runners/runMarkdownTests'
import { runSchemaTests } from '@/tests/runners/runSchemaTests'
import { runJsonLdTests } from '@/tests/runners/runJsonLdTests'
import { runParserTests } from '@/tests/runners/runParserTests'
import { testLaunchSpotlightStorageHelpers } from '@/__tests__/launchSpotlight.test'
import { testPersistencePrimitives } from '@/__tests__/persistencePrimitives.test'
import { testParseSchemaLintOwner, testSchemaLintSummaryAndActivePath } from '@/__tests__/schemaLintNav.test'
import {
  testGeospatialOverlayHostNotGatedBySidebar,
  testCanvasForbidsGraphWhenGeospatialEnabled,
  testGympgrphDefaultInteractionModeIsAlways,
  testGympgrphGeospatialKeysAreNamespacedOnly,
  testGympgrphDefaultViewModeIs2d,
  testGeospatialOverlayHostSupportsCesiumRenderer,
  testHostEnableForcesAlwaysInteractionMode,
  testHostTailwindScansGympgrphClasses,
  testHoldSpaceKeyHandlingPreventsScrollAndIgnoresInputs,
} from '@/__tests__/geospatialHostIntegration.test'
import {
  testMarkdownPreviewViewerForcesPrimaryTextColor,
  testMarkdownWorkspaceAvoidsHardcodedLightThemeClasses,
} from '@/__tests__/markdownWorkspaceTheme.test'
import {
  testGympgrphApplyMediaProxyNormalizesGithubBlobUrl,
  testGympgrphApplyMediaProxySkipsProxyWhenNotLocalhost,
  testGympgrphApplyMediaProxyProxiesOpenFreeMapOnLocalhost,
  testGympgrphCoerceFetchUrlAcceptsAbsolutePath,
  testGympgrphCoerceFetchUrlRejectsFileScheme,
} from '@/__tests__/gympgrphUrlInterop.test'
import {
  testFetchRemoteTextPreflightHeadGuardsTooLarge,
  testFetchRemoteTextValidateSupportsStringAndArgs,
  testFetchRemoteTextWrapperUseProxyBoolean,
} from '@/__tests__/fetchRemoteTextInterop.test'
import { testSourceFilesCompositionOrderAndVisibility } from '@/__tests__/sourceFilesComposition.test'
import {
  testGympgrphCoerceFeatureCollectionIdsAddsMissingIds,
  testGympgrphIsPointOnlyFeatureCollectionDetectsPointOnly,
  testGympgrphIsPointOnlyFeatureCollectionRejectsPolygon,
  testGympgrphPickPoiSelectionSkipsClusterFeatures,
  testGympgrphEnsureDatasetLayerClusterCountUsesNotoSans,
} from '@/__tests__/gympgrphMapLibreBehaviors.test'
import { testMarkdownEmbeddedGeoJsonExtractionFindsFeatureCollections } from '@/__tests__/markdownEmbeddedGeoJson.test'
import {
  testMarkdownLoaderKeyNormalizesBasename,
  testMarkdownLoaderPrefersImportedForBasenameMatch,
} from '@/__tests__/markdownLoaderInterop.test'
import {
  testWorkspaceImportLocalFilesCreatesExpectedEntries,
  testWorkspaceImportLocalFolderCreatesNestedFolders,
  testNormalizeWorkspacePathCollapsesExtraSlashes,
  testWorkspaceImportSkipsUnsupportedFilesButContinues,
} from '@/__tests__/workspaceImportLocal.test'
import { testWorkspaceFsChangedBatchCoalescesNotifications } from '@/__tests__/workspaceFsEventsBatch.test'
import { testWorkspaceFsMemoryInitialEntries } from '@/__tests__/workspaceFsMemoryInitialEntries.test'
import { testHashStringContractIsSharedAcrossRepos } from '@/__tests__/hashingInterop.test'
import { testMarkdownSlideDemoParsesMediaAndGeo } from '@/__tests__/markdownSlideDemo.test'
import { testGraphCanvasDisplayFilterFallback } from '@/__tests__/graphCanvasDisplayFilterFallback.test'
import {
  testStratifyLayoutDoesNotReuseForceCacheKey,
  testStratifyLayoutDefaultsMatchFlowSpacing,
  testStratifyLayoutProducesStableLayering,
  testStratifyLayoutSnapsToGrid,
  testStratifyLayoutNoOverlapAfterGridSnap,
} from '@/__tests__/stratifyLayoutEnhancements.test'
import {
  testElkLayoutReturnsNodePositions,
  testElkLayoutTimeoutIsBounded,
  testFlowHandlesByNodeDeterministicOrdering,
} from '@/__tests__/flowElkMultipleHandles.test'
import {
  testGeoJsonMapPreviewRendersMapContainerAboveSvgFallback,
  testGeoJsonMapPreviewSupportsContainerHeightMode,
  testInlineMarkdownGeoJsonMapReusesSharedBasemapHook,
  testMapLibreBasemapBootTimeoutDoesNotRequireStrictStyleLoadedOnly,
} from '@/__tests__/geojsonMapPreviewRegressionGuards.test'
import {
  testCuragrphAliasContractInViteConfig,
  testForbidEditorJsDependencies,
  testForbidMagicLocalStorageKeysOutsideCentralConstants,
  testForbidSiblingRepoSourceImports,
  testForbidLegacyToolbarToolMenuAreasSystem,
  testForbidGympgrphHookUsageInHost,
  testHostGympgrphIntegrationUsesPackageRootOnly,
} from '@/__tests__/crossRepoBoundaryGuards.test'
import {
  testWorkflowPresetPipelinesAreSelfConsistent,
  testExportFunctionsAcceptBrandedPaths,
} from '@/__tests__/workflowPresetPipeline.test'
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
  testAgenticRagContextComparisonMatchesCanonical,
  testAgenticRagJsonLdStripsKgPrefixForLabelsAndEdgeLabels,
} from '@/__tests__/jsonldSemanticAlignment.test'
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
import { testKeywordModeDerivesEntitiesAndPredicateEdges, testKeywordModeMergesMediaNodesForOverlays } from '@/__tests__/keywordMode.test'
import { testToolMenuDoesNotExposeCuratorArea } from '@/__tests__/toolMenuCuratorActions.test'
import { testForbidHardcodedYouTubeUrlLiteral, testYouTubeImportPopulatesMarkdownAndJsonEditors } from '@/__tests__/youtubeImportAction.test'
import { testGroupCollapseDerivationCollapsesCommunityIntoGroupNode } from '@/__tests__/groupCollapse.test'
import {
  testMarkdownWorkspaceSplitPreviewFlushesOnDocKeyChange,
  testWorkspaceAutosaveGuardsAgainstPathSwitchOverwrite,
} from '@/__tests__/workspaceAutosave.test'
import { testMarkdownWorkspaceExplorerCrudActionsCreateAndDeleteFile } from '@/__tests__/markdownWorkspaceCrudActions.test'
import { testWorkspaceEnsureSeedDoesNotReseedAfterUserDeletesAllFiles } from '@/__tests__/workspaceSeedPersistence.test'
import { testBottomPanelMarkdownCollapseKeepsEditorContentMounted } from '@/__tests__/bottomPanelMarkdownCollapseKeepsContent.test'
import {
  testGraphRagAnalyticsWritesNamespacedCausalityComponents,
  testKeywordGraphWritesKeywordFrequencyAndStrengthScore,
} from '@/__tests__/metricsProperties.test'
import {
  testDensityClusteringReturnsEmptyWhenMaxNodesExceeded,
  testDensityClusteringRespectsMaxSteps,
} from '@/__tests__/densityClusteringBounded.test'
import { testPinnedZoomAdjustKeepsWorldCenter } from '@/__tests__/pinnedZoomNoJump.test'
import {
  testPickInitialZoomTransformReusesZoomAcrossPresentationChanges,
  testPickInitialZoomTransformRejectsStaleZoomWhenNotPinned,
} from '@/__tests__/zoomStatePick.test'
import { testZoomViewKeyIncludesPresentationKeys } from '@/__tests__/zoomViewKey.test'
import {
  testCoerceMediaUrlAcceptsSafeRelative,
  testCoerceMediaUrlRejectsExplicitScheme,
  testNormalizeImportNameDerivesJsonNameFromUrlAndFormat,
} from '@/__tests__/mediaUrlCoercion.test'
import {
  testApplyMediaProxyNormalizesGithubBlobUrl,
  testApplyMediaProxySkipsProxyWhenNotLocalhost,
  testApplyMediaProxyProxiesOpenFreeMapOnLocalhost,
} from '@/__tests__/mediaProxySrc.test'
import { testUiToastUpsertDoesNotExtendExpiry, testUiToastUpsertMovesToastToFront } from '@/__tests__/uiToastSlice.test'
import { testIconButtonStopsPropagation, testToolbarIconTooltipsDoNotInterceptClicks } from '@/__tests__/toolbarButtons.test'
import {
  testNormalizeMermaidMmdToMarkdownKeepsFencedMarkdown,
  testNormalizeMermaidMmdToMarkdownWrapsPlainMermaid,
} from '@/__tests__/mmdNormalization.test'
import { testMarkdownSlideThemeNeversinkAliasesToAcademic } from '@/__tests__/markdownThemeAlias.test'
import { testMarkdownViewerShowsMissingDocumentPathMessage } from '@/__tests__/markdownMissingDocumentPathMessage.test'
import { testWorkspaceFolderSelectionDoesNotClearMarkdownDocument } from '@/__tests__/workspaceImportFolderDoesNotClearMarkdownDocument.test'

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
      const timeoutMs = (() => {
        const raw = Number(process.env.KG_TEST_CASE_TIMEOUT_MS)
        if (Number.isFinite(raw) && raw > 1_000) return Math.max(5_000, Math.min(10 * 60_000, Math.floor(raw)))
        return 120_000
      })()
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
  await exec('policy.boundary.forbidSiblingRepoSourceImports', testForbidSiblingRepoSourceImports)
  await exec('policy.boundary.hostGympgrphRootOnly', testHostGympgrphIntegrationUsesPackageRootOnly)
  await exec('policy.boundary.forbidGympgrphHookUsage', testForbidGympgrphHookUsageInHost)
  await exec('policy.persistence.forbidMagicLocalStorageKeys', testForbidMagicLocalStorageKeysOutsideCentralConstants)
  await exec('policy.curagrph.aliasContractInViteConfig', testCuragrphAliasContractInViteConfig)
  await exec('policy.markdown.forbidEditorJs', testForbidEditorJsDependencies)
  await exec('policy.toolbar.forbidLegacyToolMenuAreasSystem', testForbidLegacyToolbarToolMenuAreasSystem)

  await exec('policy.forbidHardcodedYouTubeUrlLiteral', testForbidHardcodedYouTubeUrlLiteral)
  await exec('ingest.youtube.importPopulatesMarkdownAndJsonEditors', testYouTubeImportPopulatesMarkdownAndJsonEditors)

  await exec('layout.stratify.layeringStable', testStratifyLayoutProducesStableLayering)
  await exec('layout.stratify.defaultsMatchFlowSpacing', testStratifyLayoutDefaultsMatchFlowSpacing)
  await exec('layout.stratify.noForceCacheReuse', testStratifyLayoutDoesNotReuseForceCacheKey)
  await exec('layout.stratify.gridSnap', testStratifyLayoutSnapsToGrid)
  await exec('layout.stratify.gridNoOverlap', testStratifyLayoutNoOverlapAfterGridSnap)
  await exec('layout.flow.elkMultipleHandles.deterministicOrdering', testFlowHandlesByNodeDeterministicOrdering)
  await exec('layout.flow.elkMultipleHandles.timeoutBounded', testElkLayoutTimeoutIsBounded)
  await exec('layout.flow.elkMultipleHandles.returnsNodePositions', testElkLayoutReturnsNodePositions)

  await exec('sourceFiles.composition.orderAndVisibility', testSourceFilesCompositionOrderAndVisibility)
  await exec('sourceFiles.naming.normalizeParentPath', testNormalizeParentPath)
  await exec('sourceFiles.naming.findNextIndex.root', testFindNextSourceFileIndexRoot)
  await exec('sourceFiles.naming.findNextIndex.nested', testFindNextSourceFileIndexNested)
  await exec('sourceFiles.folderPicker.webkitRelativePath.stripsRootFolder', testWebkitRelativePathStripsRootFolder)
  await exec('sourceFiles.folderPicker.webkitRelativePath.fallsBackToFileName', testWebkitRelativePathFallsBackToFileName)
  await exec('sourceFiles.folderPicker.webkitRelativePath.doesNotTreatFileNameAsFolder', testWebkitRelativePathDoesNotTreatFileNameAsFolder)
  await exec('markdownWorkspace.autosave.guardsAgainstPathSwitchOverwrite', testWorkspaceAutosaveGuardsAgainstPathSwitchOverwrite)
  await exec('markdownWorkspace.preview.splitFlushesOnDocKeyChange', testMarkdownWorkspaceSplitPreviewFlushesOnDocKeyChange)
  await exec('markdownWorkspace.explorer.crudActions.createDelete', testMarkdownWorkspaceExplorerCrudActionsCreateAndDeleteFile)
  await exec('bottomPanel.markdown.collapseKeepsContent', testBottomPanelMarkdownCollapseKeepsEditorContentMounted)
  await exec('workspaceFs.seed.noReseedAfterUserDeletesAll', testWorkspaceEnsureSeedDoesNotReseedAfterUserDeletesAllFiles)
  await exec('workspaceFs.events.batch.coalescesNotifications', testWorkspaceFsChangedBatchCoalescesNotifications)
  await exec('workspaceFs.memory.initialEntries', testWorkspaceFsMemoryInitialEntries)
  await exec('graphCanvas.displayFilter.fallback', testGraphCanvasDisplayFilterFallback)

  await exec('geospatial.host.overlayNotGatedBySidebar', testGeospatialOverlayHostNotGatedBySidebar)
  await exec('geospatial.canvas.forbidGraphWhenGeoEnabled', testCanvasForbidsGraphWhenGeospatialEnabled)
  await exec('geospatial.persistence.keysAreNamespacedOnly', testGympgrphGeospatialKeysAreNamespacedOnly)
  await exec('geospatial.persistence.defaultViewModeIs2d', testGympgrphDefaultViewModeIs2d)
  await exec('geospatial.interaction.defaultAlways', testGympgrphDefaultInteractionModeIsAlways)
  await exec('geospatial.interaction.holdSpaceKeyHardening', testHoldSpaceKeyHandlingPreventsScrollAndIgnoresInputs)
  await exec('geospatial.host.enableForcesAlways', testHostEnableForcesAlwaysInteractionMode)
  await exec('geospatial.host.supportsCesiumRenderer', testGeospatialOverlayHostSupportsCesiumRenderer)
  await exec('geospatial.host.tailwindScansGympgrph', testHostTailwindScansGympgrphClasses)
  await exec('geospatial.gympgrphUrl.proxyNormalizesGithubBlob', testGympgrphApplyMediaProxyNormalizesGithubBlobUrl)
  await exec('geospatial.gympgrphUrl.proxySkipsWhenNotLocalhost', testGympgrphApplyMediaProxySkipsProxyWhenNotLocalhost)
  await exec('geospatial.gympgrphUrl.proxyOpenFreeMapOnLocalhost', testGympgrphApplyMediaProxyProxiesOpenFreeMapOnLocalhost)
  await exec('geospatial.gympgrphUrl.coerceFetchUrlAcceptsAbsolutePath', testGympgrphCoerceFetchUrlAcceptsAbsolutePath)
  await exec('geospatial.gympgrphUrl.coerceFetchUrlRejectsFileScheme', testGympgrphCoerceFetchUrlRejectsFileScheme)

  await exec(
    'geospatial.geojsonPreview.layering.mapAboveSvgFallback.geojsonMapPreview',
    testGeoJsonMapPreviewRendersMapContainerAboveSvgFallback,
  )
  await exec(
    'geospatial.geojsonPreview.sizing.containerHeightMode.geojsonMapPreview',
    testGeoJsonMapPreviewSupportsContainerHeightMode,
  )
  await exec(
    'policy.geospatial.inlineMarkdownGeoJson.reusesSharedBasemapHook.geojsonMapPreview',
    testInlineMarkdownGeoJsonMapReusesSharedBasemapHook,
  )
  await exec(
    'policy.geospatial.useMapLibreBasemap.bootTimeoutReadyCriteria.geojsonMapPreview',
    testMapLibreBasemapBootTimeoutDoesNotRequireStrictStyleLoadedOnly,
  )

  await exec('geospatial.markdown.embeddedGeoJsonExtraction', testMarkdownEmbeddedGeoJsonExtractionFindsFeatureCollections)

  await exec('markdown.workspace.noHardcodedLightTheme', testMarkdownWorkspaceAvoidsHardcodedLightThemeClasses)
  await exec('markdown.preview.forcesPrimaryTextColor', testMarkdownPreviewViewerForcesPrimaryTextColor)
  await exec('markdown.preview.missingDocumentPathMessage', testMarkdownViewerShowsMissingDocumentPathMessage)
  await exec('markdown.workspace.folderDoesNotClearMarkdown', testWorkspaceFolderSelectionDoesNotClearMarkdownDocument)
  await exec('markdown.loader.normalizesBasename', testMarkdownLoaderKeyNormalizesBasename)
  await exec('markdown.loader.prefersImportedBasenameMatch', testMarkdownLoaderPrefersImportedForBasenameMatch)
  await exec('policy.hashing.sharedContract', testHashStringContractIsSharedAcrossRepos)
  await exec('markdown.demo.slideMediaAndGeo', testMarkdownSlideDemoParsesMediaAndGeo)
  await exec('net.fetchRemoteText.validateSupportsStringAndArgs', testFetchRemoteTextValidateSupportsStringAndArgs)
  await exec('net.fetchRemoteText.preflightHeadGuardsTooLarge', testFetchRemoteTextPreflightHeadGuardsTooLarge)
  await exec('net.fetchRemoteText.wrapperUseProxyBoolean', testFetchRemoteTextWrapperUseProxyBoolean)
  await exec('geospatial.gympgrphMapLibre.pickSkipsClusters', testGympgrphPickPoiSelectionSkipsClusterFeatures)
  await exec('geospatial.gympgrphMapLibre.coerceFeatureIds', testGympgrphCoerceFeatureCollectionIdsAddsMissingIds)
  await exec('geospatial.gympgrphMapLibre.pointOnly.true', testGympgrphIsPointOnlyFeatureCollectionDetectsPointOnly)
  await exec('geospatial.gympgrphMapLibre.pointOnly.false', testGympgrphIsPointOnlyFeatureCollectionRejectsPolygon)
  await exec('geospatial.gympgrphMapLibre.clusterCountFont', testGympgrphEnsureDatasetLayerClusterCountUsesNotoSans)
  
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
    'graph.selectionHighlight.mediaOpacity.respectsToggleAndLayer',
    testSelectionHighlightMediaOpacityRespectsRenderToggleAndLayerOpacity,
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
  await exec('graph.nodes2d.rendersDiamondAndHex', testNodesLayerRendersDiamondAndHexPaths)
  await exec('graph.nodes2d.honorsVisualShapeOverrides', testNodesLayerHonorsVisualShapeOverrides)
  await exec('graph.pointerTarget.acceptsPathNodes', testIsNodePointerTargetAcceptsPathNodes)
  await exec(
    'graph.fitAllTransform.respectsCollisionPadding',
    testFitAllTransformRespectsCollisionPaddingInViewportFit,
  )
  await exec(
    'graph.fitAllTransform.targetFill.usesCappedFrame',
    testFitAllTransformTargetFillUsesCapped1920x1080Frame,
  )
  await exec(
    'graph.fitAllTransform.targetFill.uses80to20',
    testFitAllTransformTargetFillUses80to20Ratio,
  )
  await exec(
    'graph.fitAllTransform.options.enforces80to20ForAllFitIntents',
    testReadFitAllOptionsEnforces80to20FillRatioForAllFitIntents,
  )
  await exec(
    'graph.simulation.forceSeedsClusterAwarePositions',
    testForceSimulationSeedsClusterAwarePositionsWhenMissing,
  )
  await exec('graph.groups.bboxCollide.separatesTopParentGroups', testGroupBboxCollideSeparatesTopParentGroups)
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
  await exec('ui.themeSystemModeApplyAndSubscribe', testThemeSystemModeApplyAndSubscribe)
  await exec('keywordMode.derivesEntitiesAndPredicateEdges', testKeywordModeDerivesEntitiesAndPredicateEdges)
  await exec('keywordMode.mergesMediaNodesForOverlays', testKeywordModeMergesMediaNodesForOverlays)
  await exec('groupCollapse.derivation.collapsesCommunityIntoGroupNode', testGroupCollapseDerivationCollapsesCommunityIntoGroupNode)
  await exec('metrics.graphrag.writesNamespacedCausalityComponents', testGraphRagAnalyticsWritesNamespacedCausalityComponents)
  await exec('metrics.keywordGraph.writesKeywordFrequencyAndStrengthScore', testKeywordGraphWritesKeywordFrequencyAndStrengthScore)
  await exec('densityClustering.maxNodesExceededReturnsEmpty', testDensityClusteringReturnsEmptyWhenMaxNodesExceeded)
  await exec('densityClustering.respectsMaxSteps', testDensityClusteringRespectsMaxSteps)
  await exec('zoom.pinned.adjustKeepsWorldCenterOnResize', testPinnedZoomAdjustKeepsWorldCenter)
  await exec('zoom.pick.reusesAcrossPresentationChanges', testPickInitialZoomTransformReusesZoomAcrossPresentationChanges)
  await exec('zoom.pick.rejectsStaleWhenNotPinned', testPickInitialZoomTransformRejectsStaleZoomWhenNotPinned)
  await exec('zoom.viewKey.includesPresentation', testZoomViewKeyIncludesPresentationKeys)
  await exec('url.coerceMediaUrl.acceptsSafeRelative', testCoerceMediaUrlAcceptsSafeRelative)
  await exec('url.coerceMediaUrl.rejectsExplicitScheme', testCoerceMediaUrlRejectsExplicitScheme)
  await exec('url.normalizeImportName.jsonUrlDerivation', testNormalizeImportNameDerivesJsonNameFromUrlAndFormat)
  await exec('url.applyMediaProxySrc.normalizesGithubBlob', testApplyMediaProxyNormalizesGithubBlobUrl)
  await exec('url.applyMediaProxySrc.skipsProxyWhenNotLocalhost', testApplyMediaProxySkipsProxyWhenNotLocalhost)
  await exec('url.applyMediaProxySrc.proxiesOpenFreeMapOnLocalhost', testApplyMediaProxyProxiesOpenFreeMapOnLocalhost)
  
  await exec('ui.launchSpotlightPersistence', testLaunchSpotlightStorageHelpers)
  await exec('persistence.storagePrimitives', testPersistencePrimitives)
  await exec('search.cacheVersionKey', testSearchCacheKeysRespectVersion)
  await exec('n8n.parseWorkflow', testN8nParsingBasic)
  
  await exec('ui.toolMenu.noCuratorArea', testToolMenuDoesNotExposeCuratorArea)
  
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
  await exec('workflowPreset.selfConsistent', testWorkflowPresetPipelinesAreSelfConsistent)
  await exec('workflowPreset.exportBrandedPaths', testExportFunctionsAcceptBrandedPaths)
  await exec('ui.media.mediaInteractiveDefaults', testMediaInteractiveDefaults)
  await exec('workspace.import.localFiles', testWorkspaceImportLocalFilesCreatesExpectedEntries)
  await exec('workspace.import.localFolder', testWorkspaceImportLocalFolderCreatesNestedFolders)
  await exec('workspace.path.normalizeCollapsesSlashes', testNormalizeWorkspacePathCollapsesExtraSlashes)
  await exec('workspace.import.skipsUnsupportedContinues', testWorkspaceImportSkipsUnsupportedFilesButContinues)

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    const modShowOnCanvas = await import('@/__tests__/markdownPreviewShowOnCanvas.test')
    await exec(
      'ui.markdown.preview.showOnCanvas',
      modShowOnCanvas.testMarkdownPreviewShowOnCanvasSelectsExpectedNode,
    )
    await exec(
      'ui.markdown.preview.contextMenuRendersInsideRoot',
      modShowOnCanvas.testMarkdownPreviewContextMenuRendersInsideRoot,
    )
    await exec(
      'ui.markdown.preview.tokenCacheDoesNotCrossDocPath',
      modShowOnCanvas.testMarkdownPreviewTokenCacheDoesNotCrossDocumentPath,
    )
    await exec(
      'ui.markdown.preview.viewModeSwitchDoesNotCrossDocPath',
      modShowOnCanvas.testMarkdownPreviewViewModeSwitchDoesNotCrossDocumentPath,
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
    'jsonld.semanticAlignment.agenticRagContextMatches',
    testAgenticRagContextComparisonMatchesCanonical,
  )
  await exec(
    'jsonld.semanticAlignment.stripsKgPrefix',
    testAgenticRagJsonLdStripsKgPrefixForLabelsAndEdgeLabels,
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
  await exec('ui.toast.upsertDoesNotExtendExpiry', testUiToastUpsertDoesNotExtendExpiry)
  await exec('ui.toast.upsertMovesToastToFront', testUiToastUpsertMovesToastToFront)
  await exec('ui.toolbar.tooltipsDoNotInterceptClicks', testToolbarIconTooltipsDoNotInterceptClicks)
  await exec('ui.toolbar.iconButtonStopsPropagation', testIconButtonStopsPropagation)
  await exec('parser.mmd.wrapsPlainMermaid', testNormalizeMermaidMmdToMarkdownWrapsPlainMermaid)
  await exec('parser.mmd.keepsFencedMarkdown', testNormalizeMermaidMmdToMarkdownKeepsFencedMarkdown)
  await exec('markdown.slide.theme.neversinkAliasesToAcademic', testMarkdownSlideThemeNeversinkAliasesToAcademic)

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
