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
  testGroupBboxCollideByDepthSeparatesOuterAndInnerSiblings,
  testNestedGroupInnerBorderDoesNotTouchParentOuterBorder,
} from '@/__tests__/groupOverlapByDepthForce.test'
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
  testGeospatialModeEventContractIsShared,
} from '@/__tests__/geospatialHostIntegration.test'
import {
  testMarkdownPreviewViewerForcesPrimaryTextColor,
  testMarkdownWorkspaceAvoidsHardcodedLightThemeClasses,
} from '@/__tests__/markdownWorkspaceTheme.test'
import { testMarkdownSelectionTargetEmptyDocPathFallsBackToAnyDocument } from '@/__tests__/markdownSelectionTargetEmptyDocPath.test'
import { testGraphDataMetadataHashIncludesRevision } from '@/__tests__/graphDataHashRevision.test'
import {
  testGraphTableDbAllocatesAndCreatesRows,
  testGraphTableDbConcurrentSyncDoesNotConflict,
  testGraphTableDbNoopSyncDoesNotRewriteRows,
  testGraphTableDbSyncsCollapsedGraphViewRows,
  testGraphTableDbSeedsBaseTablesAndColumns,
  testGraphTableDbSyncsGraphAndInfersPropertyColumns,
  testGraphTableDbUpdatesCellValues,
} from '@/__tests__/rxdbGraphTableDb.test'
import {
  testGympgrphApplyMediaProxyNormalizesGithubBlobUrl,
  testGympgrphApplyMediaProxySkipsProxyWhenNotLocalhost,
  testGympgrphApplyMediaProxyProxiesOpenFreeMapOnLocalhost,
  testGympgrphCoerceFetchUrlAcceptsAbsolutePath,
  testGympgrphCoerceFetchUrlRejectsFileScheme,
} from '@/__tests__/gympgrphUrlInterop.test'
import { testMainPanelTypographyUsesUiSettings } from '@/__tests__/mainPanelTypography.test'
import { testGraphTableTypographyUsesUiSettings } from '@/__tests__/graphTableTypography.test'
import { testCanvasZoomWheelParityBetweenD3AndNative } from '@/__tests__/canvasZoomWheelParity.test'
import { testSpacePanKeyStateTracksHeldSpace } from '@/__tests__/spacePanKeyState.test'
import { testViewportControlsPanDragPreset } from '@/__tests__/viewportControlsPanDragPreset.test'
import { testViewportControlsSelectionDragPreset } from '@/__tests__/viewportControlsSelectionDragPreset.test'
import { testFlowEditorForcesDesignViewportControlsPreset } from '@/__tests__/flowEditorViewportControlsPreset.test'
import { testFlowWheelZoomUsesSmoothFactorNotDiscreteSteps } from '@/__tests__/flowWheelZoomSmoothRegression.test'
import { testD3WheelZoomIsContinuousAndUsesSharedWheelFactor } from '@/__tests__/d3WheelZoomSmoothRegression.test'
import { testD3WheelZoomScaleExtentDoesNotClampToSchemaOnly } from '@/__tests__/d3ZoomScaleExtentRegression.test'
import { testD3WheelZoomOverridesDesignPresetToZoom } from '@/__tests__/d3WheelZoomPresetOverrideRegression.test'
import { testWheelZoomUsesCtrlKeyBoostHelper } from '@/__tests__/wheelZoomCtrlKeyBoostRegression.test'
import {
  testFlowZoomDefaultsMigrationUpgradesPriorDefaults,
  testFlowZoomDefaultsMigrationDoesNotOverrideCustomValues,
  testFlowZoomDefaultsMigrationNoopsWhenVersionAlreadySet,
  testFlowZoomDefaultsMigrationWorksWithoutExistingKeys,
} from '@/__tests__/flowZoomDefaultsMigration.test'
import { testCanvasZoomDoesNotAllowPageScroll } from '@/__tests__/canvasNoScrollRegression.test'
import { testCanvasWheelIgnoreIsAppliedToExternalPanels } from '@/__tests__/canvasWheelIgnoreExternalPanels.test'
import { testGraphCanvasDoesNotBlockWheelPropagation } from '@/__tests__/graphCanvasNoStopPropagationRegression.test'
import { testFlowCanvasResizeMarksDirtySoCanvasDoesNotGoBlank } from '@/__tests__/flowCanvasResizeDirtyRegression.test'
import { testFlowCanvasUsesAbsoluteSurfaceSizing } from '@/__tests__/flowCanvasSizingRegression.test'
import {
  testFlowTransformShowingGraphAcceptsIdentityWhenGraphNearOrigin,
  testFlowTransformShowingGraphRejectsClearlyOffscreenTransform,
  testFlowTransformShowingGraphRejectsUnknownBounds,
} from '@/__tests__/flowTransformShowingGraph.test'
import {
  testViewportPinchZoomTransformAllowsPanWhilePinching,
  testViewportPinchZoomTransformClampsScaleExtent,
  testViewportPinchZoomTransformKeepsWorldMidAnchored,
  testViewportPinchZoomTransformRespectsZoomExponentMultiplier,
} from '@/__tests__/viewportTransformPinchZoom.test'
import {
  testEdgeScrollDoesNotMoveBeforeDelay,
  testEdgeScrollMovesAfterDelayTowardInterior,
  testEdgeScrollRespectsZoomK,
} from '@/__tests__/edgeScrollController.test'
import {
  testZoomActionsUseDiscreteStepsWhenConfigured,
  testZoomActionsDefaultToPow2StepsWhenUnset,
  testZoomActionsToolbarZoomDoesNotNoopOnDegenerateScaleExtent,
  testZoomToBoundsFitsWithInset,
} from '@/__tests__/zoomStepsAndBounds.test'
import {
  testWheelAnchorFallsBackWhenClientCoordsOutsideRect,
  testWheelAnchorClampsNearEdgeToPreventJump,
  testWheelAnchorUsesCenterWhenNoFallback,
  testWheelFallbackAcceptsFreshPoint,
  testWheelFallbackRejectsStalePoint,
} from '@/__tests__/canvasWheelAnchor.test'
import { testZoomWheelGuardBlocksBounceAtMinScale } from '@/__tests__/canvasZoomWheelGuard.test'
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
import { testEditorWorkspaceImportForcesDocumentModeForGraphFiles } from '@/__tests__/editorWorkspaceImportSemanticMode.test'
import { testWorkspaceFsChangedBatchCoalescesNotifications } from '@/__tests__/workspaceFsEventsBatch.test'
import { testWorkspaceFsMemoryInitialEntries } from '@/__tests__/workspaceFsMemoryInitialEntries.test'
import { testHashStringContractIsSharedAcrossRepos } from '@/__tests__/hashingInterop.test'
import { testMarkdownSlideDemoParsesMediaAndGeo } from '@/__tests__/markdownSlideDemo.test'
import { testGraphCanvasDisplayFilterFallback } from '@/__tests__/graphCanvasDisplayFilterFallback.test'
import { testGraphDataForDisplayFiltersNodesAndEdgesTogether } from '@/__tests__/graphDataForDisplay.test'
import { testDocumentStructureBaselineLockGuardsModeSwitches } from '@/__tests__/baselineLockGuardsModeSwitch.test'
import { testDocumentStructureBaselineLockRestoresPriorState } from '@/__tests__/baselineLockRestore.test'
import {
  testLayoutPositioningCacheKeyIncludesViewKey,
  testLayoutPositioningCacheKeyIsolatesMediaDensity,
  testLayoutPositioningCacheKeyIsolatesRenderMediaAsNodes,
  testLayoutPositioningCacheKeyUsesRenderVariant,
  testLayoutPositioningDoesNotReuseCacheAcrossDatasets,
  testLayoutPositioningForcesLayoutWhenVariantChanges,
  testLayoutPositioningSkipsReseedOnToggle,
} from '@/__tests__/layoutPositioning.test'
import { testZoomViewKeyIsIsolatedAcross2dRenderers } from '@/__tests__/zoomViewKeySharedAcross2dRenderers.test'
import {
  testFrontmatterModeEffectiveNoopWhenNoSeeds,
  testFrontmatterModeEffectiveWhenSeedsExist,
} from '@/__tests__/frontmatterModeEffective.test'
import {
  testElkLayoutReturnsNodePositions,
  testElkLayoutTimeoutIsBounded,
  testFlowHandlesByNodeDeterministicOrdering,
  testFlowHandlesDefaultsAreInjectedWhenRequested,
} from '@/__tests__/flowElkMultipleHandles.test'
import { testFlowSchemaFieldPortKeysCreateStableHandlesForSchemaFields } from '@/__tests__/flowSchemaFieldPortKeys.test'
import { testFlowSchemaPortsBuildDisplayLabel, testFlowSchemaPortsInfluenceEdgeValidation } from '@/__tests__/flowSchemaPortEdgeValidation.test'
import { testFlowHandlesIncludeRegistryPortsWithoutEdges } from '@/__tests__/flowHandlesRegistryPorts.test'
import {
  testFlowDataflowConnectedValuesBySchemaPath,
  testComputingDataFlowsDemoBundleParsesAndComputes,
  testFlowDataflowConnectedValuesRgbTransforms,
  testFlowDataflowConnectedValuesTransformsAndPropagation,
} from '@/__tests__/flowDataflowConnectedValues.test'
import {
  testFlowNodeQuickEditorRegistryResolveHonorsNodeOverride,
  testFlowNodeQuickEditorRegistryResolvePrefersDefault,
} from '@/__tests__/flowNodeQuickEditorRegistryResolve.test'
import { testNodeQuickEditorBundleRoundtripParsesWithRegistryMetadata } from '@/__tests__/nodeQuickEditorBundleRoundtrip.test'
import {
  testFlowPortHandlesCanBeHiddenForSelectedNodesWhenRequested,
  testFlowPortHandlesRenderWhenSelectedNodeGlyphHidden,
} from '@/__tests__/flowPortHandlesVisibleWhenNodeHidden.test'
import {
  testFlowEditorConvertToLoopSetsTypeAndKind,
  testFlowEditorEnableHandlesForAllInputsIsIdempotent,
} from '@/__tests__/flowNodeQuickEditorActions.test'
import { testPinnedDisablesDragAcrossPanels } from '@/__tests__/pinSemantics.test'
import { testIconButtonPointerDownPreventsTextSelection } from '@/__tests__/iconButtonNoTextSelect.test'
import { testNodeQuickEditorHidesIdentityAndMovesActionsToToolbar } from '@/__tests__/nodeQuickEditorUiContract.test'
import {
  testFlowCanvasAutoFitToScreenRunsInFlowRenderer,
  testFlowCanvasAutoZoomToSelectionRunsInFlowRenderer,
  testFlowCanvasRebuildsSceneWhenPortHandlesToggleChangesSchemaPresentation,
  testFlowCanvasUsesActiveGraphRenderDataAndZoomState,
} from '@/__tests__/flowCanvasIntegration.test'
import { testFlowExtractNodePositionsExtractsFinitePositions, testFlowExtractNodePositionsReturnsNullWhenNone } from '@/__tests__/flowSeedPositions.test'
import { testFlowSeedFromOtherRendererPrefersExpectedVariant } from '@/__tests__/flowSeedOtherRendererVariant.test'
import {
  testGeoJsonMapPreviewRendersMapContainerAboveSvgFallback,
  testGeoJsonMapPreviewSupportsContainerHeightMode,
  testInlineMarkdownGeoJsonMapReusesSharedBasemapHook,
  testMapLibreBasemapBootTimeoutDoesNotRequireStrictStyleLoadedOnly,
} from '@/__tests__/geojsonMapPreviewRegressionGuards.test'
import { testFlowCollisionRelaxSeparatesOverlappingNodes } from '@/__tests__/flowCollisionRelax.test'
import { testNodeBboxCollideZRespectsSchemaGating, testNodeBboxCollideZRequiresExplicitZ } from '@/__tests__/bboxCollisionZNode.test'
import { testGroupNodeNoStickSeparatesExternalNodeFromGroupBorder } from '@/__tests__/groupNodeNoStickRegression.test'
import { testFlowHitTestGroupUsesLabelTopExtra } from '@/__tests__/flowGroupHitTest.test'
import { testFlowGroupRelaxAddsGapBetweenSingleNodeGroups } from '@/__tests__/flowGroupSpacingRelax.test'
import { testFlowNestedGroupRelaxAddsGapAtMultipleDepths } from '@/__tests__/flowNestedGroupSpacingRelax.test'
import {
  testFlowEdgeRoutingAvoidsObstacleByShiftingLaneLR,
  testFlowEdgeRoutingAvoidsObstacleByShiftingLaneTB,
  testFlowEdgeRoutingIgnorePointsSkipsEndpointObstacles,
} from '@/__tests__/flowEdgeRouting.test'
import {
  testCuragrphAliasContractInViteConfig,
  testCanvas2dRendererSwitchWarmsInactiveRenderer,
  testForbidEditorJsDependencies,
  testForbidMagicLocalStorageKeysOutsideCentralConstants,
  testForbidSiblingRepoSourceImports,
  testForbidLegacyToolbarToolMenuAreasSystem,
  testForbidGympgrphHookUsageInHost,
  testHostGympgrphIntegrationUsesPackageRootOnly,
  testForbidReactFlowAndLiteGraphDependencies,
  testForbidHardcodedSandboxAbsolutePaths,
  testForbidTopLevelElkImportInFlowLayout,
} from '@/__tests__/crossRepoBoundaryGuards.test'
import {
  testFlowEditorManagerRegistryStorageRoundTrip,
  testFlowEditorManagerRegistryValidatesAndNormalizes,
  testFlowEditorManagerSeedsGenerateVideoRegistryEntry,
} from '@/__tests__/flowEditorManagerRegistry.test'
import {
  testFlowEditorManagerMappingRowsRoundTripPreservesLabels,
  testFlowEditorManagerMappingRowsValidationDetectsDuplicates,
} from '@/__tests__/flowEditorManagerMappingRows.test'
import {
  testFlowEditorSpecNodeValidationAcceptsDefault,
  testFlowEditorSpecWorkflowValidationRejectsDuplicateNodeIds,
} from '@/__tests__/flowEditorSpecSchemas.test'
import { testFloatingPanelInspectorTypographyUsesUiSettings } from '@/__tests__/floatingPanelInspectorTypography.test'
import { testFlowNodeQuickEditorTypographyInheritsPanelSettings } from '@/__tests__/flowNodeQuickEditorTypography.test'
import { testFlowNodeQuickEditorZoomUpdatesDoNotRerenderPanel } from '@/__tests__/flowNodeQuickEditorZoomRerenderGuard.test'
import { testFlowNodeQuickEditorRendersPortHandleGutterWhenEnabled } from '@/__tests__/flowNodeQuickEditorPortHandleGutter.test'
import { testFlowNodeQuickEditorSchemaFieldPortsRenderRowHandles } from '@/__tests__/flowNodeQuickEditorSchemaFieldPorts.test'
import {
  testFlowNodeQuickEditorDragPayloadReadsFromApplicationJsonFallback,
  testFlowNodeQuickEditorDragPayloadReadsFromTextPlainFallback,
  testFlowNodeQuickEditorDragPayloadReadsFromUriListFallback,
  testFlowNodeQuickEditorDragPayloadReturnsNullWhenMissing,
  testFlowNodeQuickEditorDragPayloadRoundTrip,
} from '@/__tests__/flowNodeQuickEditorDrag.test'
import { testCanvasWheelIgnoreOverlayPreventsZoom } from '@/__tests__/canvasWheelIgnoreOverlay.test'
import { testCanvasEventCoordsFallsBackToClientRect, testCanvasEventCoordsPrefersOffsetXY } from '@/__tests__/canvasEventCoords.test'
import { testFlowRelaxStepPolicyBoundedAndMonotonic } from '@/__tests__/flowRelaxStepPolicy.test'
import {
  testCanvasHelpShortcutsSsotHasUniqueIdsAndLines,
  testHelpTabSearchAndCopyIncludesCanvasShortcutLines,
} from '@/__tests__/canvasHelpShortcutsSsot.test'
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
import { testMarkdownImportActionAppliesImportedMarkdownToStore } from '@/__tests__/markdownImportActionWiresStore.test'
import { testGroupCollapseDerivationCollapsesCommunityIntoGroupNode } from '@/__tests__/groupCollapse.test'
import {
  testMarkdownWorkspaceSplitPreviewFlushesOnDocKeyChange,
  testWorkspaceAutosaveGuardsAgainstPathSwitchOverwrite,
} from '@/__tests__/workspaceAutosave.test'
import { testMarkdownWorkspaceExplorerCrudActionsCreateAndDeleteFile } from '@/__tests__/markdownWorkspaceCrudActions.test'
import { testWorkspaceEnsureSeedDoesNotReseedAfterUserDeletesAllFiles } from '@/__tests__/workspaceSeedPersistence.test'
import {
  testEmbeddedEditorShellRendersCanvasPreviewIframe,
  testEmbeddedPreviewGraphUpdatesApplyToParentStore,
  testEditorWorkspaceInspectorUsesSelectionInspectorWhenFlowEditorNotMounted,
  testToolbarEditorButtonTogglesWorkspaceViewMode,
} from '@/__tests__/embeddedEditorMode.test'
import {
  testGraphRagAnalyticsWritesNamespacedCausalityComponents,
  testKeywordGraphWritesKeywordFrequencyAndStrengthScore,
} from '@/__tests__/metricsProperties.test'
import {
  testDensityClusteringReturnsEmptyWhenMaxNodesExceeded,
  testDensityClusteringRespectsMaxSteps,
} from '@/__tests__/densityClusteringBounded.test'
import { testPinnedZoomAdjustKeepsWorldCenter } from '@/__tests__/pinnedZoomNoJump.test'
import { testFitToViewAllowsZoomOutBelowSchemaMinScale } from '@/__tests__/zoomOutFitAll.test'
import { testZoomActionsZoomInOutPreserveViewportCenterNoBounce } from '@/__tests__/zoomInOutViewportCenterNoBounce.test'
import { testDisableAutoZoomModesForUserGesture } from '@/__tests__/autoZoomModesDisable.test'
import { testNodeQuickEditorScaledSizeTracksZoomK } from '@/__tests__/nodeQuickEditorZoom.test'
import {
  testZoomActionsFitTransformIsCachedAcrossRequests,
  testZoomActionsZoomOutAutoMinScaleTracksFitToView,
} from '@/__tests__/zoomActionsSsot.test'
import {
  testPickInitialZoomTransformReusesZoomAcrossPresentationChanges,
  testPickInitialZoomTransformRejectsStaleZoomWhenNotPinned,
} from '@/__tests__/zoomStatePick.test'
import { testZoomViewKeyIncludesPresentationKeys } from '@/__tests__/zoomViewKey.test'
import { testZoomStateEqMatchesAllFields, testZoomStateEqRejectsNulls } from '@/__tests__/zoomStateEq.test'
import { testZoomStateQuantizeCustomSteps, testZoomStateQuantizeDefaults } from '@/__tests__/zoomStateQuantize.test'
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
import { testOverlayClampKeepsPanelInViewport, testOverlayClampSnapPxRoundsToGrid } from '@/__tests__/overlayClamp.test'
import {
  testFlowNativeNodeShapeForbidCircleCoercesToRect,
  testFlowNativeNodeShapeForbidCircleLeavesNonCircleUnchanged,
} from '@/__tests__/flowNodeShapeForbidCircle.test'
import {
  testNormalizeMermaidMmdToMarkdownKeepsFencedMarkdown,
  testNormalizeMermaidMmdToMarkdownWrapsPlainMermaid,
} from '@/__tests__/mmdNormalization.test'
import { testMarkdownSlideThemeNeversinkAliasesToAcademic } from '@/__tests__/markdownThemeAlias.test'
import { testMarkdownViewerShowsMissingDocumentPathMessage } from '@/__tests__/markdownMissingDocumentPathMessage.test'
import { testWorkspaceFolderSelectionDoesNotClearMarkdownDocument } from '@/__tests__/workspaceImportFolderDoesNotClearMarkdownDocument.test'
import {
  testLayoutGroupKeyPrefersDeepestMermaidSubgraph,
  testSemanticModeSchemaIsolationRestoresSchemaAndClearsSelection,
} from '@/__tests__/semanticModeSchemaIsolation.test'
import {
  testEdgeOpacityUsesBaseOpacityWhenGroupsDisabled,
  testEdgeOpacityUsesUnderGroupOpacityWhenGroupsEnabled,
} from '@/__tests__/edgeOpacityDefaults.test'
import {
  testGroupBoxInnerDoesNotStickToOtherOuterBorder,
  testDeepNestingNoStick,
  testNoStickUsesZAxisWhenProvided,
  testNoStickDoesNotAccidentallyPushInZFromXyGaps,
  testNoStickUsesZAxisWhenGapZProvidedEvenWithZeroDepth,
} from '@/__tests__/groupBoxNoStickRegression.test'
import { testCorrectlyNestsH2InsideH1AndEnforcesContainmentSeparation } from '@/__tests__/flowCollisionSticking.test'
import { testMarkdownDocumentPathNormalization } from '@/__tests__/markdownDocumentPathNormalization.test'

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

  await exec('flowCollisionSticking: testCorrectlyNestsH2InsideH1AndEnforcesContainmentSeparation', testCorrectlyNestsH2InsideH1AndEnforcesContainmentSeparation)
  await exec('markdownDocumentPathNormalization: testMarkdownDocumentPathNormalization', testMarkdownDocumentPathNormalization)
  await runParserTests(results)

  // Remaining tests
  await exec('policy.boundary.forbidSiblingRepoSourceImports', testForbidSiblingRepoSourceImports)
  await exec('policy.boundary.hostGympgrphRootOnly', testHostGympgrphIntegrationUsesPackageRootOnly)
  await exec('policy.boundary.forbidGympgrphHookUsage', testForbidGympgrphHookUsageInHost)
  await exec('policy.boundary.forbidFlowLibs', testForbidReactFlowAndLiteGraphDependencies)
  await exec('policy.boundary.forbidHardcodedSandboxAbsolutePaths', testForbidHardcodedSandboxAbsolutePaths)
  await exec('policy.boundary.canvas2dSwitchWarmsInactiveRenderer', testCanvas2dRendererSwitchWarmsInactiveRenderer)
  await exec('policy.boundary.forbidTopLevelElkImport', testForbidTopLevelElkImportInFlowLayout)
  await exec('policy.persistence.forbidMagicLocalStorageKeys', testForbidMagicLocalStorageKeysOutsideCentralConstants)
  await exec('policy.curagrph.aliasContractInViteConfig', testCuragrphAliasContractInViteConfig)
  await exec('policy.markdown.forbidEditorJs', testForbidEditorJsDependencies)
  await exec('policy.toolbar.forbidLegacyToolMenuAreasSystem', testForbidLegacyToolbarToolMenuAreasSystem)

  await exec('toolbar.editorToggle.togglesWorkspaceViewMode', testToolbarEditorButtonTogglesWorkspaceViewMode)
  await exec('editorShell.rendersCanvasPreviewIframe', testEmbeddedEditorShellRendersCanvasPreviewIframe)
  await exec(
    'ui.editorWorkspace.inspector.usesSelectionInspectorWhenFlowEditorNotMounted',
    testEditorWorkspaceInspectorUsesSelectionInspectorWhenFlowEditorNotMounted,
  )
  await exec('ui.editorWorkspace.previewGraphUpdates.applyToParentStore', testEmbeddedPreviewGraphUpdatesApplyToParentStore)

  await exec('modeLock.baseline.guardsModeSwitches', testDocumentStructureBaselineLockGuardsModeSwitches)
  await exec('modeLock.baseline.restoresPriorState', testDocumentStructureBaselineLockRestoresPriorState)

  await exec('interaction.spacePan.keyState', testSpacePanKeyStateTracksHeldSpace)

  await exec('viewport.flowEditor.forcesDesignPreset', testFlowEditorForcesDesignViewportControlsPreset)
  await exec('zoom.wheel.flow.smooth', testFlowWheelZoomUsesSmoothFactorNotDiscreteSteps)
  await exec('zoom.wheel.d3.smooth', testD3WheelZoomIsContinuousAndUsesSharedWheelFactor)
  await exec('zoom.wheel.d3.scaleExtent.ssot', testD3WheelZoomScaleExtentDoesNotClampToSchemaOnly)
  await exec('zoom.wheel.d3.presetOverride.design', testD3WheelZoomOverridesDesignPresetToZoom)
  await exec('zoom.wheel.ctrlKey.boost', testWheelZoomUsesCtrlKeyBoostHelper)
  await exec('zoom.defaults.migration.upgradesPriorDefaults', testFlowZoomDefaultsMigrationUpgradesPriorDefaults)
  await exec('zoom.defaults.migration.noOverrideCustom', testFlowZoomDefaultsMigrationDoesNotOverrideCustomValues)
  await exec('zoom.defaults.migration.versionGuard', testFlowZoomDefaultsMigrationNoopsWhenVersionAlreadySet)
  await exec('zoom.defaults.migration.missingKeys', testFlowZoomDefaultsMigrationWorksWithoutExistingKeys)
  await exec('canvas.zoom.noPageScroll', testCanvasZoomDoesNotAllowPageScroll)
  await exec('canvas.wheelIgnore.externalPanels', testCanvasWheelIgnoreIsAppliedToExternalPanels)
  await exec('canvas.zoom.scrollLock.noStopPropagation', testGraphCanvasDoesNotBlockWheelPropagation)
  await exec('flowCanvas.resize.dirty', testFlowCanvasResizeMarksDirtySoCanvasDoesNotGoBlank)
  await exec('viewport.pinchZoom.transform.worldMidAnchored', testViewportPinchZoomTransformKeepsWorldMidAnchored)
  await exec('viewport.pinchZoom.transform.allowsPan', testViewportPinchZoomTransformAllowsPanWhilePinching)
  await exec('viewport.pinchZoom.transform.clampsScale', testViewportPinchZoomTransformClampsScaleExtent)
  await exec('viewport.pinchZoom.transform.multiplier', testViewportPinchZoomTransformRespectsZoomExponentMultiplier)
  await exec('viewport.edgeScroll.delay', testEdgeScrollDoesNotMoveBeforeDelay)
  await exec('viewport.edgeScroll.direction', testEdgeScrollMovesAfterDelayTowardInterior)
  await exec('viewport.edgeScroll.zoomScaling', testEdgeScrollRespectsZoomK)

  await exec('zoom.steps.discrete', testZoomActionsUseDiscreteStepsWhenConfigured)
  await exec('zoom.steps.defaultPow2', testZoomActionsDefaultToPow2StepsWhenUnset)
  await exec('zoom.toolbar.degenerateExtent.noNoop', testZoomActionsToolbarZoomDoesNotNoopOnDegenerateScaleExtent)
  await exec('zoom.bounds.fitsInset', testZoomToBoundsFitsWithInset)
  await exec('viewport.preset.panDrag.gating', testViewportControlsPanDragPreset)
  await exec('viewport.preset.selectionDrag.gating', testViewportControlsSelectionDragPreset)

  await exec('ui.typography.floatingPanelInspector.usesUiSettings', testFloatingPanelInspectorTypographyUsesUiSettings)
  await exec('ui.typography.flowNodeQuickEditor.usesUiSettings', testFlowNodeQuickEditorTypographyInheritsPanelSettings)
  await exec('ui.flowNodeQuickEditor.zoomUpdates.noRerender', testFlowNodeQuickEditorZoomUpdatesDoNotRerenderPanel)
  await exec('ui.pinSemantics.pinnedDisablesDrag', testPinnedDisablesDragAcrossPanels)
  await exec('ui.iconButton.preventsTextSelection', testIconButtonPointerDownPreventsTextSelection)
  await exec('ui.flowNodeQuickEditor.uiContract', testNodeQuickEditorHidesIdentityAndMovesActionsToToolbar)
  await exec('ui.flowNodeQuickEditor.portHandles.gutterRendersWhenEnabled', testFlowNodeQuickEditorRendersPortHandleGutterWhenEnabled)
  await exec('ui.flowNodeQuickEditor.schemaFieldPorts.renderRowHandles', testFlowNodeQuickEditorSchemaFieldPortsRenderRowHandles)
  await exec('dnd.flowNodeQuickEditorDragPayload.roundTrip', testFlowNodeQuickEditorDragPayloadRoundTrip)
  await exec('dnd.flowNodeQuickEditorDragPayload.missingReturnsNull', testFlowNodeQuickEditorDragPayloadReturnsNullWhenMissing)
  await exec('dnd.flowNodeQuickEditorDragPayload.applicationJsonFallback', testFlowNodeQuickEditorDragPayloadReadsFromApplicationJsonFallback)
  await exec('dnd.flowNodeQuickEditorDragPayload.textPlainFallback', testFlowNodeQuickEditorDragPayloadReadsFromTextPlainFallback)
  await exec('dnd.flowNodeQuickEditorDragPayload.uriListFallback', testFlowNodeQuickEditorDragPayloadReadsFromUriListFallback)
  await exec('io.nodeQuickEditorBundle.roundtrip.includesRegistryMetadata', testNodeQuickEditorBundleRoundtripParsesWithRegistryMetadata)
  await exec('ui.wheelIgnore.overlay.preventsCanvasZoom', testCanvasWheelIgnoreOverlayPreventsZoom)
  await exec('ui.canvasEventCoords.prefersOffsetXY', testCanvasEventCoordsPrefersOffsetXY)
  await exec('ui.canvasEventCoords.fallsBackToClientRect', testCanvasEventCoordsFallsBackToClientRect)
  await exec('flow.relaxStepPolicy.boundedAndMonotonic', testFlowRelaxStepPolicyBoundedAndMonotonic)

  await exec('ui.help.canvasShortcuts.ssot.uniqueIdsAndLines', testCanvasHelpShortcutsSsotHasUniqueIdsAndLines)
  await exec('ui.help.canvasShortcuts.helpSearchIncludesSsotLines', testHelpTabSearchAndCopyIncludesCanvasShortcutLines)
  await exec('ui.typography.mainPanel.usesUiSettings', testMainPanelTypographyUsesUiSettings)
  await exec('ui.typography.graphTable.usesUiSettings', testGraphTableTypographyUsesUiSettings)

  await exec('policy.forbidHardcodedYouTubeUrlLiteral', testForbidHardcodedYouTubeUrlLiteral)
  await exec('ingest.youtube.importPopulatesMarkdownAndJsonEditors', testYouTubeImportPopulatesMarkdownAndJsonEditors)
  await exec('ingest.markdown.importActionWiresStore', testMarkdownImportActionAppliesImportedMarkdownToStore)

  await exec('layout.positioning.skipsReseedOnToggle', testLayoutPositioningSkipsReseedOnToggle)
  await exec('layout.positioning.cacheKeyUsesRenderVariant', testLayoutPositioningCacheKeyUsesRenderVariant)
  await exec('layout.positioning.forcesLayoutWhenVariantChanges', testLayoutPositioningForcesLayoutWhenVariantChanges)
  await exec('layout.positioning.doesNotReuseCacheAcrossDatasets', testLayoutPositioningDoesNotReuseCacheAcrossDatasets)
  await exec('layout.positioning.cacheKeyIncludesViewKey', testLayoutPositioningCacheKeyIncludesViewKey)
  await exec('layout.positioning.isolatesMediaDensity', testLayoutPositioningCacheKeyIsolatesMediaDensity)
  await exec('layout.positioning.isolatesRenderMediaAsNodes', testLayoutPositioningCacheKeyIsolatesRenderMediaAsNodes)
  await exec('zoom.viewKey.isolates2dRenderers', testZoomViewKeyIsIsolatedAcross2dRenderers)
  await exec('zoom.actions.inOut.preserveViewportCenterNoBounce', testZoomActionsZoomInOutPreserveViewportCenterNoBounce)
  await exec('zoom.wheel.parity.d3AndNative', testCanvasZoomWheelParityBetweenD3AndNative)
  await exec('zoom.wheel.anchor.fallbackWhenOutside', testWheelAnchorFallsBackWhenClientCoordsOutsideRect)
  await exec('zoom.wheel.anchor.clampsNearEdge', testWheelAnchorClampsNearEdgeToPreventJump)
  await exec('zoom.wheel.anchor.centerWhenNoFallback', testWheelAnchorUsesCenterWhenNoFallback)
  await exec('zoom.wheel.fallback.rejectsStale', testWheelFallbackRejectsStalePoint)
  await exec('zoom.wheel.fallback.acceptsFresh', testWheelFallbackAcceptsFreshPoint)
  await exec('zoom.wheel.guard.blocksMinBounce', testZoomWheelGuardBlocksBounceAtMinScale)
  await exec('layout.groupKey.prefersDeepestMermaidSubgraph', testLayoutGroupKeyPrefersDeepestMermaidSubgraph)
  await exec('semanticMode.schemaIsolation.restoresAndClears', testSemanticModeSchemaIsolationRestoresSchemaAndClearsSelection)
  await exec('layout.edges.opacity.usesUnderGroups', testEdgeOpacityUsesUnderGroupOpacityWhenGroupsEnabled)
  await exec('layout.edges.opacity.usesBaseWhenGroupsDisabled', testEdgeOpacityUsesBaseOpacityWhenGroupsDisabled)

  await exec('graph.groups.nestedBorder.noTouchParentOuter', testNestedGroupInnerBorderDoesNotTouchParentOuterBorder)

  await exec('frontmatterMode.effective.noopWhenNoSeeds', testFrontmatterModeEffectiveNoopWhenNoSeeds)
  await exec('frontmatterMode.effective.whenSeedsExist', testFrontmatterModeEffectiveWhenSeedsExist)
  await exec('layout.flow.elkMultipleHandles.deterministicOrdering', testFlowHandlesByNodeDeterministicOrdering)
  await exec('layout.flow.handles.defaultsInjected', testFlowHandlesDefaultsAreInjectedWhenRequested)
  await exec('layout.flow.schemaFieldPortKeys.stableHandles', testFlowSchemaFieldPortKeysCreateStableHandlesForSchemaFields)
  await exec('schema.flowPorts.validation.schemaPortsAffectCanAddEdge', testFlowSchemaPortsInfluenceEdgeValidation)
  await exec('schema.flowPorts.label.buildDisplayLabelFromPorts', testFlowSchemaPortsBuildDisplayLabel)
  await exec('flow.handles.registryPorts.presentWithoutEdges', testFlowHandlesIncludeRegistryPortsWithoutEdges)
  await exec('flow.dataflow.connectedValues.bySchemaPath', testFlowDataflowConnectedValuesBySchemaPath)
  await exec('flow.dataflow.connectedValues.transformsAndPropagation', testFlowDataflowConnectedValuesTransformsAndPropagation)
  await exec('flow.dataflow.connectedValues.rgbTransforms', testFlowDataflowConnectedValuesRgbTransforms)
  await exec('flow.dataflow.demo.computingDataFlows.bundleParsesAndComputes', testComputingDataFlowsDemoBundleParsesAndComputes)
  await exec('flow.quickEditor.registry.resolve.prefersDefault', testFlowNodeQuickEditorRegistryResolvePrefersDefault)
  await exec('flow.quickEditor.registry.resolve.honorsNodeOverride', testFlowNodeQuickEditorRegistryResolveHonorsNodeOverride)
  await exec('mainPanel.flowEditorManager.registry.validateAndNormalize', testFlowEditorManagerRegistryValidatesAndNormalizes)
  await exec('mainPanel.flowEditorManager.registry.storageRoundTrip', testFlowEditorManagerRegistryStorageRoundTrip)
  await exec('mainPanel.flowEditorManager.registry.seedGenerateVideo', testFlowEditorManagerSeedsGenerateVideoRegistryEntry)
  await exec('mainPanel.flowEditorManager.mappingRows.roundTripPreservesLabels', testFlowEditorManagerMappingRowsRoundTripPreservesLabels)
  await exec('mainPanel.flowEditorManager.mappingRows.detectsDuplicateKeys', testFlowEditorManagerMappingRowsValidationDetectsDuplicates)
  await exec('mainPanel.flowEditorManager.spec.node.acceptsDefault', testFlowEditorSpecNodeValidationAcceptsDefault)
  await exec('mainPanel.flowEditorManager.spec.workflow.rejectsDuplicateNodeIds', testFlowEditorSpecWorkflowValidationRejectsDuplicateNodeIds)
  await exec('layout.flow.elkMultipleHandles.timeoutBounded', testElkLayoutTimeoutIsBounded)
  await exec('layout.flow.elkMultipleHandles.returnsNodePositions', testElkLayoutReturnsNodePositions)
  await exec('flowEditor.actions.enableHandlesForAllInputs.idempotent', testFlowEditorEnableHandlesForAllInputsIsIdempotent)
  await exec('flowEditor.actions.convertToLoop.idempotentAndSetsKind', testFlowEditorConvertToLoopSetsTypeAndKind)
  await exec('flowCanvas.integration.renderDataAndZoomState', testFlowCanvasUsesActiveGraphRenderDataAndZoomState)
  await exec('flowCanvas.zoom.autoFitToScreen', testFlowCanvasAutoFitToScreenRunsInFlowRenderer)
  await exec('flowCanvas.zoom.autoZoomToSelection', testFlowCanvasAutoZoomToSelectionRunsInFlowRenderer)
  await exec(
    'flowCanvas.scene.rebuildsWhenPortHandlesToggleChangesSchemaPresentation',
    testFlowCanvasRebuildsSceneWhenPortHandlesToggleChangesSchemaPresentation,
  )
  await exec('flowPortHandles.visibleWhenNodeHidden', testFlowPortHandlesRenderWhenSelectedNodeGlyphHidden)
  await exec('flowPortHandles.hidePortHandlesForSelectedNodes', testFlowPortHandlesCanBeHiddenForSelectedNodesWhenRequested)
  await exec('flow.seed.extractNodePositions.extractsFinite', testFlowExtractNodePositionsExtractsFinitePositions)
  await exec('flow.seed.extractNodePositions.nullWhenNone', testFlowExtractNodePositionsReturnsNullWhenNone)
  await exec('flow.seed.otherRenderer.prefersExpectedVariant', testFlowSeedFromOtherRendererPrefersExpectedVariant)

  await exec('collision.nodeBbox.zAxis.gated', testNodeBboxCollideZRespectsSchemaGating)
  await exec('collision.nodeBbox.zAxis.requiresExplicitZ', testNodeBboxCollideZRequiresExplicitZ)
  await exec('flow.collision.relax.separatesOverlappingNodes', testFlowCollisionRelaxSeparatesOverlappingNodes)
  await exec('flow.groups.hitTest.usesLabelTopExtra', testFlowHitTestGroupUsesLabelTopExtra)
  await exec('flow.groups.relax.addsGapBetweenSingleNodeGroups', testFlowGroupRelaxAddsGapBetweenSingleNodeGroups)
  await exec('flow.groups.relax.nested.addsGapAtMultipleDepths', testFlowNestedGroupRelaxAddsGapAtMultipleDepths)

  await exec('groupBoxNoStickRegression.outerVsInner', testGroupBoxInnerDoesNotStickToOtherOuterBorder)
  await exec('groupBoxNoStickRegression.deepNesting', testDeepNestingNoStick)
  await exec('groupBoxNoStickRegression.zAxis', testNoStickUsesZAxisWhenProvided)
  await exec('groupBoxNoStickRegression.noAccidentalZ', testNoStickDoesNotAccidentallyPushInZFromXyGaps)
  await exec('groupBoxNoStickRegression.gapZEnablesZEvenWithZeroDepth', testNoStickUsesZAxisWhenGapZProvidedEvenWithZeroDepth)

  await exec('groupNodeNoStickRegression.externalVsGroupBorder', testGroupNodeNoStickSeparatesExternalNodeFromGroupBorder)

  await exec('flow.edges.routing.avoidsObstacleLR', testFlowEdgeRoutingAvoidsObstacleByShiftingLaneLR)
  await exec('flow.edges.routing.avoidsObstacleTB', testFlowEdgeRoutingAvoidsObstacleByShiftingLaneTB)
  await exec('flow.edges.routing.ignorePoints.skipsEndpointObstacles', testFlowEdgeRoutingIgnorePointsSkipsEndpointObstacles)

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
  await exec('workspaceFs.seed.noReseedAfterUserDeletesAll', testWorkspaceEnsureSeedDoesNotReseedAfterUserDeletesAllFiles)
  await exec('workspaceFs.events.batch.coalescesNotifications', testWorkspaceFsChangedBatchCoalescesNotifications)
  await exec('workspaceFs.memory.initialEntries', testWorkspaceFsMemoryInitialEntries)
  await exec('graphCanvas.displayFilter.fallback', testGraphCanvasDisplayFilterFallback)
  await exec('graphCanvas.displayFilter.graphDataForDisplay.filtersNodesAndEdgesTogether', testGraphDataForDisplayFiltersNodesAndEdgesTogether)
  await exec('flowCanvas.transformShowingGraph.rejectsUnknownBounds', testFlowTransformShowingGraphRejectsUnknownBounds)
  await exec('flowCanvas.transformShowingGraph.rejectsOffscreenTransform', testFlowTransformShowingGraphRejectsClearlyOffscreenTransform)
  await exec('flowCanvas.transformShowingGraph.acceptsIdentityNearOrigin', testFlowTransformShowingGraphAcceptsIdentityWhenGraphNearOrigin)
  await exec('flowCanvas.sizing.usesAbsoluteSurfaceSizing', testFlowCanvasUsesAbsoluteSurfaceSizing)

  await exec('geospatial.host.overlayNotGatedBySidebar', testGeospatialOverlayHostNotGatedBySidebar)
  await exec('geospatial.canvas.forbidGraphWhenGeoEnabled', testCanvasForbidsGraphWhenGeospatialEnabled)
  await exec('geospatial.contract.modeEventIsShared', testGeospatialModeEventContractIsShared)
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
  await exec('graph.groups.bboxCollideByDepth.separatesSiblings', testGroupBboxCollideByDepthSeparatesOuterAndInnerSiblings)
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
  await exec('rxdb.graphTable.seed', testGraphTableDbSeedsBaseTablesAndColumns)
  await exec('rxdb.graphTable.sync', testGraphTableDbSyncsGraphAndInfersPropertyColumns)
  await exec('rxdb.graphTable.syncConcurrentNoConflict', testGraphTableDbConcurrentSyncDoesNotConflict)
  await exec('rxdb.graphTable.noopSyncNoRewrite', testGraphTableDbNoopSyncDoesNotRewriteRows)
  await exec('rxdb.graphTable.syncCollapsedView', testGraphTableDbSyncsCollapsedGraphViewRows)
  await exec('rxdb.graphTable.updateCell', testGraphTableDbUpdatesCellValues)
  await exec('rxdb.graphTable.createRow', testGraphTableDbAllocatesAndCreatesRows)
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
  await exec('zoom.fitToView.allowsBelowSchemaMinScale', testFitToViewAllowsZoomOutBelowSchemaMinScale)
  await exec('zoom.autoModes.disableOnGesture', testDisableAutoZoomModesForUserGesture)
  await exec('ui.flowNodeQuickEditor.scalesWithZoomK', testNodeQuickEditorScaledSizeTracksZoomK)
  await exec('zoom.ssot.fit.cachedAcrossRequests', testZoomActionsFitTransformIsCachedAcrossRequests)
  await exec('zoom.ssot.out.autoMinScaleTracksFitToView', testZoomActionsZoomOutAutoMinScaleTracksFitToView)
  await exec('zoom.pick.reusesAcrossPresentationChanges', testPickInitialZoomTransformReusesZoomAcrossPresentationChanges)
  await exec('zoom.pick.rejectsStaleWhenNotPinned', testPickInitialZoomTransformRejectsStaleZoomWhenNotPinned)
  await exec('zoom.viewKey.includesPresentation', testZoomViewKeyIncludesPresentationKeys)
  await exec('zoom.state.eq.matchesAllFields', testZoomStateEqMatchesAllFields)
  await exec('zoom.state.eq.rejectsNulls', testZoomStateEqRejectsNulls)
  await exec('zoom.state.quantize.defaults', testZoomStateQuantizeDefaults)
  await exec('zoom.state.quantize.customSteps', testZoomStateQuantizeCustomSteps)
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
  await exec('workspace.import.semanticMode.forcesDocumentForGraphFiles', testEditorWorkspaceImportForcesDocumentModeForGraphFiles)

  await exec('markdown.selectionTarget.emptyDocumentPath', testMarkdownSelectionTargetEmptyDocPathFallsBackToAnyDocument)
  await exec('graph.data.hashIncludesRevision', testGraphDataMetadataHashIncludesRevision)

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
  await exec('ui.overlayClamp.keepsPanelInViewport', testOverlayClampKeepsPanelInViewport)
  await exec('ui.overlayClamp.snapPxRoundsToGrid', testOverlayClampSnapPxRoundsToGrid)
  await exec('flow.shape.forbidCircle.coercesToRect', testFlowNativeNodeShapeForbidCircleCoercesToRect)
  await exec('flow.shape.forbidCircle.preservesNonCircle', testFlowNativeNodeShapeForbidCircleLeavesNonCircleUnchanged)
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
