import {
  testD3RichMediaOverlayForwardsWheelBeforeScrollableBody,
  testRichMediaPanelEditorModeDisablesInteractiveContentForDragging,
  testRichMediaPanelFlowEditorModifierWheelZoomKeepsInteractiveScroll,
  testRichMediaPanelFlowEditorReusesSharedFloatingToolbarVariant,
} from '@/__tests__/richMediaPanelEditorModeDragRegression.test'
import {
  testRichMediaPanelFlowEditorChromeMaintainsContentAspectAcrossZoom,
  testRichMediaPanelResizeDragMaintainsContentAspectFromSharedMath,
  testRichMediaPanelUsesSectionBodyResizeHandleSsot,
  testSharedRichMediaPanelUsesRootFrameAsResizeSurfaceSsot,
} from '@/__tests__/flowEditorRichMediaPanelResizeHandleSsotRegression.test'
import {
  testRichMediaPanelDirectImageSurfaceStartsOverlayDrag,
} from '@/__tests__/richMediaPanelDirectSurfaceDragRegression.test'
import {
  testRichMediaPanelInlineSrcDocRefreshesSharedResetStyle,
  testRichMediaPanelInlineSrcDocUsesUnframedSharedSurface,
} from '@/__tests__/richMediaPanelWidget.test'
import {
  testMarkdownTableGraphCacheUsesSharedSemanticKey,
  testRichMediaPanelTextFallbackRendersMarkdownBlocksAsHtml,
  testTextWidgetOutputSrcDocEscapesRawHtmlWhileRenderingMarkdown,
} from '@/__tests__/richMediaPanelMarkdownSrcDoc.test'
import {
  testRichMediaPanelMarkdownPayloadCoversRendererModeMatrix,
  testRichMediaSurfaceRuntimePathsReuseSharedOverlayOwners,
} from '@/__tests__/richMediaSurfaceCoverage.test'
import { testStaticRichMediaPanelPreviewRendersImageVideoAndIframe } from '@/__tests__/staticRichMediaPanelPreview.test'

async function main() {
  testRichMediaPanelEditorModeDisablesInteractiveContentForDragging()
  await testRichMediaPanelFlowEditorModifierWheelZoomKeepsInteractiveScroll()
  testD3RichMediaOverlayForwardsWheelBeforeScrollableBody()
  await testRichMediaPanelDirectImageSurfaceStartsOverlayDrag()
  testRichMediaPanelFlowEditorReusesSharedFloatingToolbarVariant()

  testRichMediaPanelUsesSectionBodyResizeHandleSsot()
  testSharedRichMediaPanelUsesRootFrameAsResizeSurfaceSsot()
  testRichMediaPanelFlowEditorChromeMaintainsContentAspectAcrossZoom()
  testRichMediaPanelResizeDragMaintainsContentAspectFromSharedMath()

  testRichMediaPanelTextFallbackRendersMarkdownBlocksAsHtml()
  testTextWidgetOutputSrcDocEscapesRawHtmlWhileRenderingMarkdown()
  testMarkdownTableGraphCacheUsesSharedSemanticKey()
  testRichMediaPanelInlineSrcDocUsesUnframedSharedSurface()
  testRichMediaPanelInlineSrcDocRefreshesSharedResetStyle()

  testRichMediaPanelMarkdownPayloadCoversRendererModeMatrix()
  testRichMediaSurfaceRuntimePathsReuseSharedOverlayOwners()
  await testStaticRichMediaPanelPreviewRendersImageVideoAndIframe()

  console.log('OK subsetRichMediaSmoke')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
