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
    const mod = (await import(importPath)) as Record<string, unknown>
    const fn = mod[exportName]
    if (typeof fn !== 'function') {
      throw new Error(`Missing test export: ${importPath} -> ${exportName}`)
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
    const modShowOnCanvas = await import('@/__tests__/markdownPreviewShowOnCanvas.test')
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

    await import('@/__tests__/markdownSelectionScrollHighlight.test')

    const modCollapsible = await import('@/__tests__/collapsibleDefaults.test')
    await execTest(
      results,
      'ui.collapsibleDefaultsCompactAndAnchoredToLsKeys',
      modCollapsible.testCollapsibleDefaultsCompactAndAnchoredToLsKeys,
    )

    const modStandaloneRewrite = await import('@/__tests__/htmlCanvasStandaloneRewrite.test')
    await execTest(
      results,
      'ui.export.htmlCanvas.standaloneRewriteRewritesAllUrlAttrs',
      modStandaloneRewrite.testStandaloneSvgRewriteRewritesAllUrlAttrs,
    )

    const modSvgInject = await import('@/__tests__/svgSnapshotMarkdownBlocksInject.test')
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

    const modSvgNodePos = await import('@/__tests__/svgNodePos.test')
    await execTest(
      results,
      'ui.export.svgNodePos.extractNodePosByIdFromSvgMarkup',
      modSvgNodePos.testExtractNodePosByIdFromSvgMarkupReadsNodesAndEdges,
    )

    const modFlowCanvasFilter = await import('@/__tests__/flowCanvasGraphFilterForOverlays.test')
    await execTest(
      results,
      'ui.flowCanvas.graphFilter.keepsOverlayNodes',
      modFlowCanvasFilter.testFlowCanvasDoesNotFilterGraphForOverlays,
    )

    const modMdGraphBlocks = await import('@/__tests__/markdownDesignLayoutGraphBlocks.test')
    await execTest(
      results,
      'ui.export.markdownDesignLayout.graphBlocks',
      modMdGraphBlocks.testDeriveMarkdownDesignLayoutFromGraphBlocksBuildsBlocks,
    )

    const modSvgEdgeGeom = await import('@/__tests__/svgEdgeGeometry.test')
    await execTest(
      results,
      'ui.export.svgEdgeGeometry.ensureSvgHasEdgeGeometry',
      modSvgEdgeGeom.testEnsureSvgHasEdgeGeometryInjectsLines,
    )

    const modHtmlViewerEdgeMeta = await import('@/__tests__/graphHtmlViewerEdgeMetaNormalize.test')
    await execTest(
      results,
      'ui.export.htmlViewer.normalizesEdgeMetaAndNodePos',
      modHtmlViewerEdgeMeta.testBuildGraphHtmlViewerNormalizesEdgeEndpointsAndNodePosFromSvg,
    )

    const modHtmlViewerPrefersMedia = await import('@/__tests__/graphHtmlViewerPreferredMediaNodes.test')
    await execTest(
      results,
      'ui.export.htmlViewer.prefersVisibleMediaNodes',
      modHtmlViewerPrefersMedia.testBuildGraphHtmlViewerPrefersVisibleMediaNodes,
    )

    const modDatasetRev = await import('@/__tests__/layoutDatasetKeyRevFallback.test')
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

    const modDetailsMenuPortal = await import('../__tests__/detailsMenuPortalNoFullscreenBlockerRegression.test')
    await execTest(
      results,
      'ui.detailsMenu.portal.noFullscreenBlocker',
      modDetailsMenuPortal.testDetailsMenuPortalDoesNotInstallBlockingFullscreenLayer,
    )

    const modMarquee = await import('../__tests__/marqueeSelectionClearsOnBlurRegression.test')
    await execTest(results, 'ui.d3.marqueeSelection.failsafeCancels', modMarquee.testMarqueeSelectionHasGlobalCancelFailsafe)

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

    const modDesignUnstick = await import('../__tests__/designCanvasGlobalUnstickRegression.test')
    await execTest(results, 'ui.design.globalUnstickFailsafe', modDesignUnstick.testDesignCanvasInstallsGlobalUnstickFailsafe)

    const modComposedCrudSync = await import('../__tests__/sourceFilesComposedCrudSyncRegression.test')
    await execTest(
      results,
      'ui.sourceFiles.compose.crudSync.updateNodeWritesBackToLayer',
      modComposedCrudSync.testComposedUpdateNodeSyncsToSourceFileAndRecomposes,
    )

    const modComposedPosDebounce = await import('../__tests__/sourceFilesComposedPositionDebounceRegression.test')
    await execTest(
      results,
      'ui.sourceFiles.compose.position.debouncedWriteBack',
      modComposedPosDebounce.testComposedPositionUpdateIsDebouncedToSourceFiles,
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
