import { execTest, TestResult } from './testRunnerUtils'
import { testMarkdownLayoutModePersistence } from '@/__tests__/markdownLayoutModePersistence.test'
import { testMarkdownSyncScrollPersistence } from '@/__tests__/markdownSyncScrollPersistence.test'
import {
  testGuidelinesMarkdownHighlightGuardWithLargeGraph,
  testGuidelinesMarkdownHighlightGuardWithSmallGraph,
  testGuidelinesMarkdownIngestionLexingAndSlides,
} from '@/__tests__/markdownGuidelinesIngestion.test'
import {
  testMarkdownInlineAbbrAndSpanRenderingFromSlideDemo,
  testMarkdownHeadMetaFrontmatterArrays,
} from '@/__tests__/markdown/markdownRendering.test'
import { testMarkdownMediaToggleEndToEnd } from '@/__tests__/markdown/markdownMediaToggle.test'
import {
  testMarkdownLayoutViewToggleEndToEnd,
  testMarkdownPresentationFullscreenFromBottomPanelControls,
} from '@/__tests__/markdown/markdownLayoutToggle.test'
import {
  testMarkdownScrollSyncViewerToEditor,
  testMarkdownEditToggleKeepsScrollPosition,
  testMarkdownScrollSyncMixedContentViewerToEditor,
} from '@/__tests__/markdown/markdownScrollSync.test'
import { testMarkdownYouTubeRendering } from '@/__tests__/markdown/markdownRichMedia.test'
import {
  testMarkdownEditorDoubleClickScrollsViewerToBlockStartLine,
  testMarkdownViewerDoubleClickScrollsEditor,
} from '@/__tests__/markdown/markdownDoubleClick.test'
import { testFrontmatterModeFiltersToFrontmatterMermaidOnly } from '@/__tests__/frontmatterModeFilter.test'
import { testMarkdownHeadingGroupsDerivation } from '@/__tests__/markdownHeadingGroups.test'
import {
  testMarkdownGeoJsonCodeBlockRegistersAsGeospatialDataset,
  testMarkdownGeoJsonRenderFailureShowsVisibleError,
} from '@/__tests__/markdown/markdownGeoJsonOverlayRegistration.test'
import { testMarkdownAnnotateDisplay } from '@/__tests__/markdown/markdownAnnotateDisplay.test'
import { testMarkdownFrontmatterBlocksRenderInViewer } from '@/__tests__/markdown/markdownFrontmatterViewer.test'
import { testMarkdownGeoJsonBasemapErrorsAreSuppressed } from '@/__tests__/markdown/markdownGeoJsonBasemapErrors.test'
import { testMarkdownGeoJsonDefaultsToInlineInViewerMode } from '@/__tests__/markdown/markdownGeoJsonDefaultRenderMode.test'
import { testMarkdownGeoJsonJsonTagDefaultsToInlineInViewerAndRenderInPresentation } from '@/__tests__/markdown/markdownGeoJsonJsonTagDefaultRender.test'
import { testMarkdownMermaidCodeBlockFrontmatterParsesAndMerges } from '@/__tests__/markdown/markdownMermaidCodeBlockFrontmatter.test'
import { testMarkdownGeoJsonRendersInPresentationAfterPerBlockOverride } from '@/__tests__/markdown/markdownGeoJsonPresentationRender.test'
import { testMarkdownGeoJsonInlineMapRendersStableContainerDom } from '@/__tests__/markdown/markdownGeoJsonInlineMapStableDom.test'
import { testMarkdownGeoJsonRenderUpdatesWhenGeoRendererBecomesAvailable } from '@/__tests__/markdown/markdownGeoJsonRendererUnavailableFix.test'
import { testNewSourceFileOpensBottomPanelMarkdownViewer } from '@/__tests__/markdown/newSourceFileOpensViewer.test'
import { testMarkdownSidebarNewSourceFileButtonCreatesFile } from '@/__tests__/markdown/markdownSourceFilesTreeNewFile.test'

export const runMarkdownTests = async (results: TestResult[]) => {
  await execTest(results, 'ui.markdown.layoutModePersistence', testMarkdownLayoutModePersistence)
  await execTest(results, 'ui.markdown.syncScrollPersistence', testMarkdownSyncScrollPersistence)

  await execTest(results, 'markdown.guidelines.highlightGuardLarge', testGuidelinesMarkdownHighlightGuardWithLargeGraph)
  await execTest(results, 'markdown.guidelines.highlightGuardSmall', testGuidelinesMarkdownHighlightGuardWithSmallGraph)
  await execTest(results, 'markdown.guidelines.ingestionLexingSlides', testGuidelinesMarkdownIngestionLexingAndSlides)

  await execTest(results, 'markdown.rendering.inlineAbbrAndSpan', testMarkdownInlineAbbrAndSpanRenderingFromSlideDemo)
  await execTest(results, 'markdown.rendering.headMetaArrays', testMarkdownHeadMetaFrontmatterArrays)
  await execTest(results, 'markdown.mediaToggle.e2e', testMarkdownMediaToggleEndToEnd)
  await execTest(results, 'markdown.layoutToggle.e2e', testMarkdownLayoutViewToggleEndToEnd)
  await execTest(results, 'markdown.presentation.fullscreen', testMarkdownPresentationFullscreenFromBottomPanelControls)
  await execTest(results, 'markdown.scrollSync.viewerToEditor', testMarkdownScrollSyncViewerToEditor)
  await execTest(results, 'markdown.scrollSync.editToggleKeepsPos', testMarkdownEditToggleKeepsScrollPosition)
  await execTest(results, 'markdown.scrollSync.mixedContent', testMarkdownScrollSyncMixedContentViewerToEditor)
  await execTest(results, 'markdown.richMedia', testMarkdownYouTubeRendering)
  await execTest(results, 'markdown.scrollSync.editorDblClick', testMarkdownEditorDoubleClickScrollsViewerToBlockStartLine)
  await execTest(results, 'markdown.scrollSync.viewerDblClick', testMarkdownViewerDoubleClickScrollsEditor)
  await execTest(results, 'markdown.frontmatterMode.filtersMermaidOnly', testFrontmatterModeFiltersToFrontmatterMermaidOnly)
  await execTest(results, 'markdown.headingGroups.derivation', testMarkdownHeadingGroupsDerivation)
  await execTest(results, 'markdown.geojson.registersToGeo', testMarkdownGeoJsonCodeBlockRegistersAsGeospatialDataset)
  await execTest(results, 'markdown.geojson.renderFailureVisible', testMarkdownGeoJsonRenderFailureShowsVisibleError)
  await execTest(results, 'markdown.geojson.basemapErrorsSuppressed', testMarkdownGeoJsonBasemapErrorsAreSuppressed)
  await execTest(results, 'markdown.geojson.defaultInlineInViewer', testMarkdownGeoJsonDefaultsToInlineInViewerMode)
  await execTest(results, 'markdown.geojson.jsonTagDefaultInlineViewerRenderPresentation', testMarkdownGeoJsonJsonTagDefaultsToInlineInViewerAndRenderInPresentation)
  await execTest(results, 'markdown.geojson.presentationRender', testMarkdownGeoJsonRendersInPresentationAfterPerBlockOverride)
  await execTest(results, 'markdown.geojson.inlineMapStableDom', testMarkdownGeoJsonInlineMapRendersStableContainerDom)
  await execTest(results, 'markdown.geojson.rendererUnavailableFix', testMarkdownGeoJsonRenderUpdatesWhenGeoRendererBecomesAvailable)
  await execTest(results, 'markdown.mermaid.codeblockFrontmatter', testMarkdownMermaidCodeBlockFrontmatterParsesAndMerges)
  await execTest(results, 'markdown.annotateDisplay.perCodeBlockToggle', testMarkdownAnnotateDisplay)
  await execTest(results, 'markdown.frontmatter.blocksInViewer', testMarkdownFrontmatterBlocksRenderInViewer)
  await execTest(results, 'markdown.sourceFiles.newFileOpensViewer', testNewSourceFileOpensBottomPanelMarkdownViewer)
  await execTest(results, 'markdown.sidebar.sourceFilesTree.newFile', testMarkdownSidebarNewSourceFileButtonCreatesFile)
}
