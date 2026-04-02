import { runJsonLdTests } from './runners/runJsonLdTests'
import { runMarkdownTests } from './runners/runMarkdownTests'
import { runParserTests } from './runners/runParserTests'
import { runSchemaTests } from './runners/runSchemaTests'
import { execTest, TestResult } from './runners/testRunnerUtils'
import { initGraphDataTablePerfHarness, readGraphDataTablePerfHarness } from './perf/graphDataTableSelectionPerf'
import { TEST_CASES_PRE_PARSER } from './registry/preParserCases'
import { TEST_CASES_POST_PARSER_0 } from './registry/postParserCases0'
import { TEST_CASES_POST_PARSER_1 } from './registry/postParserCases1'
import { TEST_CASES_POST_PARSER_2 } from './registry/postParserCases2'
import { TEST_CASES_POST_PARSER_3 } from './registry/postParserCases3'
import type { TestCaseTuple } from './runner/testRunnerTypes'

const ALL_POST_PARSER: TestCaseTuple[] = [
  ...TEST_CASES_POST_PARSER_0,
  ...TEST_CASES_POST_PARSER_1,
  ...TEST_CASES_POST_PARSER_2,
  ...TEST_CASES_POST_PARSER_3,
]

const execTuple = async (results: TestResult[], tuple: TestCaseTuple) => {
  const [name, importPath, exportName] = tuple
  await execTest(results, name, async () => {
    const resolvedPath =
      typeof importPath === 'string' && importPath.startsWith('@/__tests__/')
        ? `../__tests__/${importPath.slice('@/__tests__/'.length)}`
        : importPath
    const mod = (await import(resolvedPath)) as Record<string, unknown>
    const fn = mod[exportName]
    if (typeof fn !== 'function') {
      throw new Error(`Missing test export: ${resolvedPath} -> ${exportName}`)
    }
    await (fn as () => void | Promise<void>)()
  })
}

const runNodeOnlyUiTests = async (results: TestResult[]) => {
  if (!(typeof window === 'undefined' || typeof document === 'undefined')) return

  const bootstrap =
    typeof document === 'undefined' ? (await import('@/tests/lib/jsdomHarness')).initJsdomHarness() : null
  if (bootstrap) {
    const w = bootstrap.dom.window as unknown as { URL?: { createObjectURL?: unknown } }
    if (w.URL && typeof w.URL.createObjectURL !== 'function') {
      ;(w.URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:kg-test'
    }
  }

  try {
    const modShowOnCanvas = await import('../__tests__/markdownPreviewShowOnCanvas.test')
    await execTest(results, 'ui.markdown.preview.showOnCanvas', modShowOnCanvas.testMarkdownPreviewShowOnCanvasSelectsExpectedNode)
    await execTest(results, 'ui.markdown.preview.contextMenuRendersInsideRoot', modShowOnCanvas.testMarkdownPreviewContextMenuRendersInsideRoot)
    await execTest(
      results,
      'ui.markdown.preview.tokenCacheDoesNotCrossDocPath',
      modShowOnCanvas.testMarkdownPreviewTokenCacheDoesNotCrossDocumentPath,
    )
    await execTest(
      results,
      'ui.markdown.preview.viewModeSwitchDoesNotCrossDocPath',
      modShowOnCanvas.testMarkdownPreviewViewModeSwitchDoesNotCrossDocumentPath,
    )

    await import('../__tests__/markdownSelectionScrollHighlight.test')

    const modCollapsible = await import('../__tests__/collapsibleDefaults.test')
    await execTest(
      results,
      'ui.collapsibleDefaultsCompactAndAnchoredToLsKeys',
      modCollapsible.testCollapsibleDefaultsCompactAndAnchoredToLsKeys,
    )

    const modStandaloneRewrite = await import('../__tests__/htmlCanvasStandaloneRewrite.test')
    await execTest(
      results,
      'ui.export.htmlCanvas.standaloneRewriteRewritesAllUrlAttrs',
      modStandaloneRewrite.testStandaloneSvgRewriteRewritesAllUrlAttrs,
    )

    const modSvgInject = await import('../__tests__/svgSnapshotMarkdownBlocksInject.test')
    await execTest(
      results,
      'ui.export.svgSnapshot.injectLiveMarkdownBlocks',
      modSvgInject.testInjectLiveMarkdownDesignBlocksIntoSvgMarkupEmbedsForeignObject,
    )

    await execTest(
      results,
      'ui.export.svgSnapshot.injectLiveMarkdownBlocksAnchored',
      modSvgInject.testInjectLiveMarkdownDesignBlocksIntoSvgMarkupAnchoredUsesNodeCenter,
    )

    const modSvgNodePos = await import('../__tests__/svgNodePos.test')
    await execTest(
      results,
      'ui.export.svgNodePos.extractNodePosByIdFromSvgMarkup',
      modSvgNodePos.testExtractNodePosByIdFromSvgMarkupReadsNodesAndEdges,
    )

    const modFlowCanvasFilter = await import('../__tests__/flowCanvasGraphFilterForOverlays.test')
    await execTest(
      results,
      'ui.flowCanvas.graphFilter.keepsOverlayNodes',
      modFlowCanvasFilter.testFlowCanvasDoesNotFilterGraphForOverlays,
    )

    const modFlowCanvasBlank = await import('../__tests__/flowCanvasBlankClickClearsSelectionRegression.test')
    await execTest(
      results,
      'ui.flowCanvas.blankClick.clearsSelection',
      modFlowCanvasBlank.testFlowCanvasBlankPointerDownClearsSelection,
    )

    const modFlowCanvasPanelOnlyHide = await import('../__tests__/flowCanvasPanelOnlyHideListUpdatesRegression.test')
    await execTest(
      results,
      'ui.flowCanvas.panelOnly.hideListUpdates',
      modFlowCanvasPanelOnlyHide.testFlowCanvasPanelOnlyHideListUpdatesOnPanelOnlyChange,
    )

    const modFlowCanvasPlannedOverlayHide = await import('../__tests__/flowCanvasPlannedOverlayHideSetRegression.test')
    await execTest(
      results,
      'ui.flowCanvas.overlays.hideSet.planned',
      modFlowCanvasPlannedOverlayHide.testFlowCanvasHidesPlannedOverlayNodesNotJustMountedElements,
    )

    const modMdGraphBlocks = await import('../__tests__/markdownDesignLayoutGraphBlocks.test')
    await execTest(
      results,
      'ui.export.markdownDesignLayout.graphBlocks',
      modMdGraphBlocks.testDeriveMarkdownDesignLayoutFromGraphBlocksBuildsBlocks,
    )

    const modSvgEdgeGeom = await import('../__tests__/svgEdgeGeometry.test')
    await execTest(
      results,
      'ui.export.svgEdgeGeometry.ensureSvgHasEdgeGeometry',
      modSvgEdgeGeom.testEnsureSvgHasEdgeGeometryInjectsLines,
    )

    const modHtmlViewerEdgeMeta = await import('../__tests__/graphHtmlViewerEdgeMetaNormalize.test')
    await execTest(
      results,
      'ui.export.htmlViewer.normalizesEdgeMetaAndNodePos',
      modHtmlViewerEdgeMeta.testBuildGraphHtmlViewerNormalizesEdgeEndpointsAndNodePosFromSvg,
    )

    const modHtmlViewerPrefersMedia = await import('../__tests__/graphHtmlViewerPreferredMediaNodes.test')
    await execTest(
      results,
      'ui.export.htmlViewer.prefersVisibleMediaNodes',
      modHtmlViewerPrefersMedia.testBuildGraphHtmlViewerPrefersVisibleMediaNodes,
    )

    const modDatasetRev = await import('../__tests__/layoutDatasetKeyRevFallback.test')
    await execTest(results, 'layout.datasetKey.revFallbackUsesRevision', modDatasetRev.testLayoutDatasetKeyRevFallbackUsesRevision)

    const modPointerDrag = await import('../__tests__/pointerDragUnstickOnAnyPointerDownRegression.test')
    await execTest(results, 'ui.pointerDrag.unstickOnAnyPointerDown', modPointerDrag.testPointerDragUnsticksOnAnyPointerDown)
    await execTest(results, 'ui.pointerDrag.watchdogTimeout', modPointerDrag.testPointerDragHasWatchdogTimeout)

    const modPointerDragTarget = await import('../__tests__/pointerDragTargetElementResolutionRegression.test')
    await execTest(
      results,
      'ui.pointerDrag.targetElementResolution.composedPathFallback',
      modPointerDragTarget.testPointerDragResolvesElementTargetFromComposedPath,
    )

    const modPointerDragDocEl = await import('../__tests__/pointerDragDocumentElementCaptureFallbackRegression.test')
    await execTest(
      results,
      'ui.pointerDrag.pointerCapture.documentElementFallback',
      modPointerDragDocEl.testPointerDragFallsBackToDocumentElementForPointerCapture,
    )

    const modPointerDragViewportReset = await import('../__tests__/pointerDragUnstickResetsViewportControllersRegression.test')
    await execTest(
      results,
      'ui.pointerDrag.unstick.resetsViewportControllers',
      modPointerDragViewportReset.testPointerDragUnstickResetsViewportControllersWhenActive,
    )

    const modPointerDragInstall = await import('../__tests__/pointerDragInstallsUnstickAndIframeBlockRegression.test')
    await execTest(
      results,
      'ui.pointerDrag.unstick.installsAndIframeBlock',
      modPointerDragInstall.testPointerDragInstallsUnstickAndTogglesIframeBlockClass,
    )

    const modOverlayUnstick = await import('../__tests__/useOverlayInteractions2dUnstickRegression.test')
    await execTest(
      results,
      'ui.overlayInteractions2d.cancelsOnPointerDownAndVisibility',
      modOverlayUnstick.testOverlayInteractions2dCancelsOnPointerDownAndVisibilityChange,
    )
    await execTest(results, 'ui.overlayInteractions2d.watchdogTimeout', modOverlayUnstick.testOverlayInteractions2dHasWatchdogTimeout)

    const modGraphCanvasDragPointerCapture = await import('../__tests__/graphCanvasNodeDragPointerCaptureRegression.test')
    await execTest(
      results,
      'ui.graphCanvas.drag.pointerCaptureAndFailsafe',
      modGraphCanvasDragPointerCapture.testGraphCanvasDragSetsPointerCaptureAndHasFailsafePointerDown,
    )

    const modGraphCanvasRootOverlayHideSet = await import('../__tests__/graphCanvasRootOverlayHideSetPrefersPlannedOverMountedRegression.test')
    await execTest(
      results,
      'ui.graphCanvasRoot.overlays.hideSet.prefersPlanned',
      modGraphCanvasRootOverlayHideSet.testGraphCanvasRootPrefersPlannedOverlayHideSet,
    )

    const modThreeTableAllowed = await import('../__tests__/threeGraphAllowsTableOverlaysInMultiDimRegression.test')
    await execTest(
      results,
      'ui.threeGraph.tableOverlays.allowedInMultiDim',
      modThreeTableAllowed.testThreeGraphAllowsTableOverlaysEvenInMultiDimMode,
    )

    const modVoxelSeed = await import('../__tests__/voxelSeedGroundPlane.test')
    await execTest(
      results,
      'three.voxel.seed.snappedXyGroundPlane.fullStackJson',
      modVoxelSeed.testVoxelModeSeedsOntoSnappedXyGroundPlaneFromFullStackJson,
    )


    const modD3ScenePreserve = await import('../__tests__/d3SceneRebuildPreservesSimPositionsRegression.test')
    await execTest(
      results,
      'ui.d3Scene.rebuild.preservesSimPositions',
      modD3ScenePreserve.testD3SceneRebuildPreservesSimulationPositions,
    )


    const modGraphCanvasRootPanelOnlyUngated = await import('../__tests__/graphCanvasRootPanelOnlyHideNotGatedByMarkdownRegression.test')
    await execTest(
      results,
      'ui.graphCanvasRoot.panelOnly.hide.ungated',
      modGraphCanvasRootPanelOnlyUngated.testGraphCanvasRootPanelOnlyHideIsNotGatedByMarkdownOverlayEnabled,
    )

    const modD3PresentationOverlayKey = await import('../__tests__/d3PresentationUpdatesIncludeMediaOverlayKeyRegression.test')
    await execTest(
      results,
      'ui.d3Presentation.key.includesMediaOverlay',
      modD3PresentationOverlayKey.testD3PresentationUpdatesKeyIncludesMediaOverlayIds,
    )

    const modStrictOverlapSettled = await import('../__tests__/strictOverlapDoesNotRunWhenSettledRegression.test')
    await execTest(
      results,
      'ui.physics2d.strictOverlap.noLateJumps',
      modStrictOverlapSettled.testStrictOverlapDoesNotRunWhenSettled,
    )

    const modGraphCanvasRootGraphBlockPanelFallback = await import('../__tests__/graphCanvasRootGraphBlockPanelDoesNotDropMissingPositionsRegression.test')
    await execTest(
      results,
      'ui.graphCanvasRoot.graphBlockPanel.offscreenFallback',
      modGraphCanvasRootGraphBlockPanelFallback.testGraphCanvasRootGraphBlockPanelDoesNotDropNodesWithoutPositions,
    )

    const modWorkspaceOverlayContract = await import('../__tests__/workspaceEditorOverlayPointerContract.test')
    await execTest(
      results,
      'ui.workspaceEditor.overlay.pointerContract.noBlockingScrim',
      modWorkspaceOverlayContract.testWorkspaceEditorOverlayDoesNotInstallBlockingScrim,
    )
    await execTest(
      results,
      'ui.graphDataTable.overlay.pointerContract.noFullscreenScrim',
      modWorkspaceOverlayContract.testGraphDataTableOverlayDoesNotUseFullscreenScrim,
    )

    const modMarkdownWorkspaceGraphDataChurn = await import('../__tests__/markdownWorkspaceAvoidsGraphDataChurnRegression.test')
    await execTest(
      results,
      'ui.markdownWorkspace.avoidsGraphDataChurnSubscriptions',
      modMarkdownWorkspaceGraphDataChurn.testMarkdownWorkspaceAvoidsGraphDataIdentityChurnSubscriptions,
    )

    const modComposedWritebackManual = await import('../__tests__/composedPositionWritebackIsManualRegression.test')
    await execTest(
      results,
      'store.composedPositionWriteback.manualOnly',
      modComposedWritebackManual.testComposedPositionWritebackIsManualOnly,
    )

    const modDetailsMenuPortal = await import('../__tests__/detailsMenuPortalNoFullscreenBlockerRegression.test')
    await execTest(
      results,
      'ui.detailsMenu.portal.noFullscreenBlocker',
      modDetailsMenuPortal.testDetailsMenuPortalDoesNotInstallBlockingFullscreenLayer,
    )

    const modMarquee = await import('../__tests__/marqueeSelectionClearsOnBlurRegression.test')
    await execTest(results, 'ui.d3.marqueeSelection.failsafeCancels', modMarquee.testMarqueeSelectionHasGlobalCancelFailsafe)

    const modArrayPatch = await import('../__tests__/sharedArrayPatchHelpersRegression.test')
    await execTest(results, 'ui.shared.arrayPatchHelpers.basic', modArrayPatch.testPatchArrayHelpersBehaveAndAvoidUnnecessaryCopies)

    const modOverlayCursor = await import('../__tests__/overlayDragCursorTrackingRegression.test')
    await execTest(results, 'ui.overlay.drag.cursorTracking.noSnapDuringMove.d3', modOverlayCursor.testOverlayHeaderDragDisablesGridSnapDuringMove)
    await execTest(results, 'ui.overlay.drag.edgeTracking.d3.xySyncedDuringDrag', modOverlayCursor.testOverlayHeaderDragKeepsNodeXySyncedDuringDrag)
    await execTest(results, 'ui.overlay.drag.coalescesMoves.rafValueScheduler', modOverlayCursor.testOverlayInteractions2dUsesRafValueSchedulerForDragMoves)
    await execTest(results, 'ui.overlay.drag.edgeTracking.d3.forcesTickRedraw', modOverlayCursor.testOverlayHeaderDragForcesTickRedrawDuringDrag)
    await execTest(results, 'ui.overlay.drag.cursorTracking.noSnapDuringMove.flow', modOverlayCursor.testFlowCanvasOverlayHeaderDragDisablesGridSnapDuringMove)
    await execTest(results, 'ui.overlay.drag.cursorTracking.noSnapDuringMove.design', modOverlayCursor.testDesignCanvasOverlayHeaderDragDisablesGridSnapDuringMove)
    await execTest(results, 'ui.overlay.pan.cursorTracking.ignoresSpeedMultipliers', modOverlayCursor.testOverlayPanIgnoresSpeedMultipliersForCursorTracking)
    await execTest(results, 'ui.overlay.schedule.includesMarkdownOverlays', modOverlayCursor.testGraphCanvasRootOverlayScheduleIncludesMarkdownOverlays)
    await execTest(results, 'ui.overlay.edges.panelNodes.pixelConstantPadOut', modOverlayCursor.testPanelNodeEdgeEndpointsUsePixelConstantPadOut)

    const modRichMediaEditorDrag = await import('../__tests__/richMediaPanelEditorModeDragRegression.test')
    await execTest(results, 'ui.richMediaPanel.editorMode.disablesContentPointerEvents', modRichMediaEditorDrag.testRichMediaPanelEditorModeDisablesInteractiveContentForDragging)

    const modGdtDrag = await import('../__tests__/graphDataTableDragUsesSharedPointerDragRegression.test')
    await execTest(results, 'ui.graphDataTable.drag.usesSharedPointerDrag', modGdtDrag.testGraphDataTableDoesNotInstallGlobalMouseDragListeners)
    await execTest(results, 'ui.graphDataTable.frozenDrag.usesSharedPointerDrag', modGdtDrag.testFrozenAreaDragUsesSharedPointerDrag)

    const modFloatingPanels = await import('../__tests__/floatingPanelsUseSharedPointerDragRegression.test')
    await execTest(results, 'ui.toolMenu.drag.usesSharedPointerDrag', modFloatingPanels.testToolMenuDragUsesSharedPointerDrag)
    await execTest(results, 'ui.spotlight.drag.usesSharedPointerDrag', modFloatingPanels.testSpotlightCardDragUsesSharedPointerDrag)

    const modAuxDrags = await import('../__tests__/canvasAuxDragsUseSharedPointerDragRegression.test')
    await execTest(results, 'ui.minimap.drag.usesSharedPointerDrag', modAuxDrags.testMinimapDragUsesSharedPointerDrag)
    await execTest(results, 'ui.preview.zoomPanViewport.usesSharedPointerDrag', modAuxDrags.testPreviewZoomPanViewportUsesSharedPointerDrag)
    await execTest(results, 'ui.preview.mermaid.codeblockPan.usesSharedPointerDrag', modAuxDrags.testMermaidCodeblockPanUsesSharedPointerDrag)

    const modRecovery = await import('../__tests__/interactionRecoveryResetsViewportControllersRegression.test')
    await execTest(results, 'ui.interactionRecovery.resetsViewportControllers', modRecovery.testInteractionRecoveryResetsViewportControllers)
    await execTest(results, 'ui.flow.viewportController.exposedForRecovery', modRecovery.testFlowCanvasRegistersViewportControllerDestroy)

    const modMainPanelChurn = await import('../__tests__/mainPanelDragNoChurnRegression.test')
    await execTest(results, 'ui.mainPanel.drag.noChurn', modMainPanelChurn.testMainPanelDragUsesSharedPointerDragAndRaf)

    const modMediaAnchor = await import('../__tests__/mediaAnchorUsesFxFyFallbackRegression.test')
    await execTest(results, 'ui.mediaAnchor.fxFyFallback', modMediaAnchor.testReadNodeCenterWorld2dFallsBackToFxFy)

    const modHoverTooltip = await import('../__tests__/hoverTooltipNonBlockingRegression.test')
    await execTest(results, 'ui.hoverTooltip.nonInteractiveDefault', modHoverTooltip.testGraphHoverTooltipIsNonInteractiveByDefault)
    await execTest(results, 'ui.hoverTooltip.disabledInCanvasRoot', modHoverTooltip.testGraphCanvasRootDisablesHoverTooltipInteractivity)

    const modThreeOverlayUnstick = await import('../__tests__/threeOverlayDragUnstickRegression.test')
    await execTest(results, 'ui.three.overlayDrag.globalFailsafe', modThreeOverlayUnstick.testThreeGraphHasOverlayDragGlobalFailsafe)

    const modThreeGroupResizeUnstick = await import('../__tests__/threeGroupResizeUnstickRegression.test')
    await execTest(results, 'ui.three.groupResize.globalFailsafe', modThreeGroupResizeUnstick.testThreeGroupResizeHasGlobalPointerFailsafe)

    const modSelectionNoDup = await import('../__tests__/selectionNoDuplicateTocFocusRegression.test')
    await execTest(results, 'ui.selection.noDuplicateTocFocusOnRepeatedSelect', modSelectionNoDup.testSelectingSameNodeDoesNotDispatchDuplicateTocFocus)

    const modWorkspaceAutoOpenGate = await import('../__tests__/canvasSelectionAutoOpenGatedByActiveRegression.test')
    await execTest(
      results,
      'ui.workspace.selection.doesNotAutoOpenWhenInactive',
      modWorkspaceAutoOpenGate.testCanvasSelectionDoesNotAutoOpenWorkspaceWhenInactive,
    )

    const modDesignUnstick = await import('../__tests__/designCanvasGlobalUnstickRegression.test')
    await execTest(results, 'ui.design.globalUnstickFailsafe', modDesignUnstick.testDesignCanvasInstallsGlobalUnstickFailsafe)

    const modComposedCrudSync = await import('../__tests__/sourceFilesComposedCrudSyncRegression.test')
    await execTest(
      results,
      'ui.sourceFiles.compose.crudSync.updateNodeWritesBackToLayer',
      modComposedCrudSync.testComposedUpdateNodeSyncsToSourceFileAndRecomposes,
    )

    const modPins = await import('../__tests__/nodePositionCommitClearsPinsRegression.test')
    await execTest(
      results,
      'ui.graph.updateNode.positionCommitClearsPins',
      modPins.testUpdateNodePositionCommitClearsFxFyPins,
    )
    await execTest(
      results,
      'ui.sourceFiles.compose.positionCommitClearsPins',
      modPins.testComposedPositionCommitClearsFxFyPinsInViewAndSourceFiles,
    )

    const modPaneGate = await import('../__tests__/workspacePaneInactiveGatesBackgroundChurnRegression.test')
    await execTest(
      results,
      'ui.workspacePane.gatesMarkdownWorkspaceWhenInactive',
      modPaneGate.testEmbeddedEditorShellPassesActiveToMarkdownWorkspace,
    )
    await execTest(
      results,
      'ui.workspacePane.gatesGraphTableSubscriptionsWhenInactive',
      modPaneGate.testGraphTableWorkspaceGatesRxdbSubscriptionsByActive,
    )

    const modComposedPosDebounce = await import('../__tests__/sourceFilesComposedPositionDebounceRegression.test')
    await execTest(
      results,
      'ui.sourceFiles.compose.position.debouncedWriteBack',
      modComposedPosDebounce.testComposedPositionUpdateIsDebouncedToSourceFiles,
    )

    const modTableDragChurn = await import('../__tests__/graphDataTableRepeatedDragNoLayoutThrashRegression.test')
    await execTest(
      results,
      'ui.graphDataTable.drag.reorderAvoidsPerMoveMeasure',
      modTableDragChurn.testGraphDataTableHeaderReorderDoesNotMeasureAllHeaderCellsOnEveryPointerMove,
    )
    await execTest(
      results,
      'ui.graphDataTable.drag.frozenIndicatorRafThrottled',
      modTableDragChurn.testGraphDataTableFrozenAreaDragIsRafThrottled,
    )
    await execTest(
      results,
      'ui.markdownDesignOverlay.drag.blockRafThrottled',
      modTableDragChurn.testMarkdownDesignOverlayBlockDragIsRafThrottled,
    )

    const modComposedPosNoChurn = await import('../__tests__/sourceFilesComposedPositionWritebackAvoidsComposeChurnRegression.test')
    await execTest(
      results,
      'ui.sourceFiles.compose.position.writebackUpdatesSourceLayerKeys',
      modComposedPosNoChurn.testComposedPositionWritebackUpdatesSourceLayerKeysInGraphDataMetadata,
    )

    const modZoomCommitRev = await import('../__tests__/zoomCommitIgnoresRevisionOnlyChangesRegression.test')
    await execTest(
      results,
      'ui.zoom.commit.ignoresRevisionOnlyChange',
      modZoomCommitRev.testZoomCommitDoesNotWriteWhenOnlyGraphDataRevisionChanges,
    )

    const modCoalescedScheduler = await import('../__tests__/coalescedScheduler.test')
    await execTest(
      results,
      'util.coalescedScheduler.coalescesLatestCallback',
      modCoalescedScheduler.testCoalescedSchedulerCoalescesLatestCallback,
    )
    await execTest(
      results,
      'util.coalescedScheduler.cancelPreventsCallback',
      modCoalescedScheduler.testCoalescedSchedulerCancelPreventsCallback,
    )
    await execTest(
      results,
      'util.workspaceSyncScheduler.suppressesRepeatedSignature',
      modCoalescedScheduler.testWorkspaceSyncSchedulerSuppressesRepeatedSignature,
    )

    const modGraphTableSync = await import('../__tests__/graphTableDbSyncDedupeRegression.test')
    await execTest(
      results,
      'ui.graphTable.dbSync.noModuleGlobalGuards',
      modGraphTableSync.testGraphTableDbSyncDoesNotUseModuleGlobalKeyGuards,
    )
    await execTest(
      results,
      'ui.graphTable.dbSync.selectionInspectorGatesSync',
      modGraphTableSync.testGraphTableSelectionInspectorGatesDbSyncWhenGraphTablePaneIsActive,
    )
    await execTest(
      results,
      'ui.overlayInteractions2d.cleanupCancelsActiveDrags',
      modGraphTableSync.testOverlayInteractions2dCleanupCancelsActiveDrags,
    )

    const modOverlayPanelBox = await import('../__tests__/overlayPanelsUseTransformBoxRegression.test')
    await execTest(
      results,
      'ui.overlayPanels.d3RichMedia.usesTransformBox',
      modOverlayPanelBox.testD3RichMediaOverlayDoesNotForceLeftTopPanelBox,
    )
    await execTest(
      results,
      'ui.overlayPanels.markdownDesign.usesTransformBox',
      modOverlayPanelBox.testMarkdownDesignOverlayDoesNotForceLeftTopPanelBox,
    )

    const modFlowOverlayDrag = await import('../__tests__/flowEditorOverlayDragUsesRafLatestSchedulerRegression.test')
    await execTest(
      results,
      'ui.flowEditor.nodeOverlay.drag.rafLatestScheduler',
      modFlowOverlayDrag.testFlowEditorNodeOverlayEditorUsesRafLatestSchedulerForDrags,
    )
  } finally {
    bootstrap?.restore()
  }
}

export const runAllTests = async () => {
  const results: TestResult[] = []

  await runMarkdownTests(results)
  await runSchemaTests(results)
  await runJsonLdTests(results)

  const modFitAll = await import('../__tests__/fitAllTransformCentersWhenNoCoordsRegression.test')
  await execTest(
    results,
    'ui.fitAllTransform.centersWhenNoCoords',
    modFitAll.testFitAllTransformCentersWhenNoNodesHaveCoords,
  )

  const modPinnedZoom = await import('../__tests__/zoomPinnedAllowsManualRequestsRegression.test')
  await execTest(
    results,
    'ui.zoom.pinned.allowsManualRequests',
    modPinnedZoom.testZoomPinnedDoesNotBlockManualZoomRequests,
  )

  const modMinimapBounds = await import('../__tests__/minimapBoundsIgnoreMissingCoordsRegression.test')
  await execTest(
    results,
    'ui.minimap.bounds.ignoresMissingCoords',
    modMinimapBounds.testMinimapBoundsIgnoresMissingNodeCoords,
  )

  for (const tuple of TEST_CASES_PRE_PARSER) {
    await execTuple(results, tuple)
  }

  await runParserTests(results)

  for (const tuple of ALL_POST_PARSER) {
    await execTuple(results, tuple)
    if (tuple[0] === 'graph.subgraph.crud.clusterKindDerivesStyle') {
      await runNodeOnlyUiTests(results)
    }
  }

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
