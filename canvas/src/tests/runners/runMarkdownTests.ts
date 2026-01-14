import { execTest, TestResult } from './testRunnerUtils'
import { testMarkdownLayoutModePersistence } from '@/__tests__/markdownLayoutModePersistence.test'
import { testMarkdownSyncScrollPersistence } from '@/__tests__/markdownSyncScrollPersistence.test'
import {
  testExampleWorkflowMarkdownIngestionProducesGraph,
  testMarkdownFrontmatterOntologiesAndGraphLayersRoundTrip,
  testMarkdownMermaidFrontmatterTemplateProducesEntitiesEdgesAndMentions,
  testEdaMlpInterviewSessionMarkdownFixtureFromDisk,
  testEdaMlpInterviewSessionMarkdownTidyTreeDensityFromFixture,
  testEdaMlpInterviewSessionMarkdownPresentationFromDisk,
  testMarkdownFrontmatterPolygonLayersAliasWarning,
} from '@/__tests__/exampleWorkflowMarkdownIngestion.test'
import { testMarkdownMermaidFrontmatterTidyTreeMetadataDefaults } from '@/__tests__/markdownMermaidTidyTreeMetadata.test'
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
import {
  testMarkdownEditorDoubleClickScrollsViewerToBlockStartLine,
  testMarkdownViewerDoubleClickScrollsEditor,
} from '@/__tests__/markdown/markdownDoubleClick.test'

export const runMarkdownTests = async (results: TestResult[]) => {
  await execTest(results, 'ui.markdown.layoutModePersistence', testMarkdownLayoutModePersistence)
  await execTest(results, 'ui.markdown.syncScrollPersistence', testMarkdownSyncScrollPersistence)
  
  await execTest(results, 'markdown.exampleWorkflow.ingestion', testExampleWorkflowMarkdownIngestionProducesGraph)
  await execTest(results, 'markdown.exampleWorkflow.frontmatterRoundTrip', testMarkdownFrontmatterOntologiesAndGraphLayersRoundTrip)

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    const pathMod = await import('node:path')
    const fsMod = await import('node:fs')
    const mdPath = pathMod.resolve(
      process.cwd(),
      'src/__tests__/sandbox/md-mmd-template.md',
    )
    const mdText = fsMod.readFileSync(mdPath, 'utf8')
    await execTest(
      results,
      'markdown.exampleWorkflow.mermaidTemplate',
      () => testMarkdownMermaidFrontmatterTemplateProducesEntitiesEdgesAndMentions(mdText)
    )

    await execTest(results, 'markdown.edaMlp.fixtureFromDisk', testEdaMlpInterviewSessionMarkdownFixtureFromDisk)
    await execTest(results, 'markdown.edaMlp.tidyTreeDensity', testEdaMlpInterviewSessionMarkdownTidyTreeDensityFromFixture)
    await execTest(results, 'markdown.edaMlp.presentation', testEdaMlpInterviewSessionMarkdownPresentationFromDisk)
  }

  await execTest(results, 'markdown.frontmatter.polygonLayersWarning', testMarkdownFrontmatterPolygonLayersAliasWarning)

  await execTest(results, 'markdown.mermaid.tidyTreeMetadataDefaults', testMarkdownMermaidFrontmatterTidyTreeMetadataDefaults)

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
  await execTest(results, 'markdown.scrollSync.editorDblClick', testMarkdownEditorDoubleClickScrollsViewerToBlockStartLine)
  await execTest(results, 'markdown.scrollSync.viewerDblClick', testMarkdownViewerDoubleClickScrollsEditor)
}
