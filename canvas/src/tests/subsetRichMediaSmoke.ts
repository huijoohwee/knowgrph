import {
  testD3RichMediaOverlayForwardsWheelBeforeScrollableBody,
  testRichMediaPanelEditorModeDisablesInteractiveContentForDragging,
  testRichMediaPanelStoryboardWidgetModifierWheelZoomKeepsInteractiveScroll,
  testRichMediaPanelStoryboardWidgetReusesSharedFloatingToolbarVariant,
} from '@/__tests__/richMediaPanelEditorModeDragRegression.test'
import {
  testRichMediaPanelStoryboardWidgetChromeMaintainsContentAspectAcrossZoom,
  testRichMediaPanelResizeDragMaintainsContentAspectFromSharedMath,
  testRichMediaPanelUsesSectionBodyResizeHandleSsot,
  testSharedRichMediaPanelUsesRootFrameAsResizeSurfaceSsot,
} from '@/__tests__/storyboardWidgetRichMediaPanelResizeHandleSsotRegression.test'
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
import { testStoryboardWidgetScreenAuthorityPanPreservesTranslateScaleTransforms } from '@/__tests__/storyboardWidgetScreenAuthorityTransformScaleRegression.test'
import { testStaticRichMediaPanelPreviewRendersImageVideoAndIframe } from '@/__tests__/staticRichMediaPanelPreview.test'

async function main() {
  testRichMediaPanelEditorModeDisablesInteractiveContentForDragging()
  await testRichMediaPanelStoryboardWidgetModifierWheelZoomKeepsInteractiveScroll()
  testD3RichMediaOverlayForwardsWheelBeforeScrollableBody()
  await testRichMediaPanelDirectImageSurfaceStartsOverlayDrag()
  testRichMediaPanelStoryboardWidgetReusesSharedFloatingToolbarVariant()

  testRichMediaPanelUsesSectionBodyResizeHandleSsot()
  testSharedRichMediaPanelUsesRootFrameAsResizeSurfaceSsot()
  testRichMediaPanelStoryboardWidgetChromeMaintainsContentAspectAcrossZoom()
  testRichMediaPanelResizeDragMaintainsContentAspectFromSharedMath()

  testRichMediaPanelTextFallbackRendersMarkdownBlocksAsHtml()
  testTextWidgetOutputSrcDocEscapesRawHtmlWhileRenderingMarkdown()
  testMarkdownTableGraphCacheUsesSharedSemanticKey()
  testRichMediaPanelInlineSrcDocUsesUnframedSharedSurface()
  testRichMediaPanelInlineSrcDocRefreshesSharedResetStyle()

  testRichMediaPanelMarkdownPayloadCoversRendererModeMatrix()
  testRichMediaSurfaceRuntimePathsReuseSharedOverlayOwners()
  testStoryboardWidgetScreenAuthorityPanPreservesTranslateScaleTransforms()
  await testStaticRichMediaPanelPreviewRendersImageVideoAndIframe()

  console.log('OK subsetRichMediaSmoke')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
