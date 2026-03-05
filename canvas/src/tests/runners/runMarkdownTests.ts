import { execTest, TestResult } from './testRunnerUtils'
import { testMarkdownOutlineAndBacklinks, testWorkspaceFsSeedAndCrud } from '@/__tests__/markdownExplorerWorkspaceFs.test'
import { testWorkspaceEnsureSeedReseedsAfterStorageWipeWhenNotUserCleared } from '@/__tests__/workspaceSeedReseedAfterStorageWipe.test'
import { testMarkdownWorkspaceSyncsSourceUrlFromWorkspaceIndex } from '@/__tests__/markdownWorkspaceSourceUrlSync.test'
import { testMarkdownWorkspaceRefreshFromUrlUpdatesActiveDocumentAndGraphStore } from '@/__tests__/markdownWorkspaceRefreshFromUrl.test'
import { testMarkdownFileTreeFolderClickDoesNotClearSelection } from '@/__tests__/markdownFileTreeFolderClick.test'
import { testMarkdownWorkspaceViewerUsesMarkdownPreviewSsot } from '@/__tests__/markdownWorkspaceViewerSsot.test'
import { testMarkdownWorkspaceViewerRendersRemotionArtifactRichMedia } from '@/__tests__/markdownWorkspaceRemotionViewerRenders.test'
import {
  testGeospatialDatasetLoaderParsesEmbeddedGeoJsonFromMarkdownUrl,
  testMarkdownTripDemoJsonFenceLoadsGraphData,
  testMarkdownTripDemoJsonFenceRegistersAsGeoDataset,
  testMarkdownTripDemoMmdJsonFenceLoadsGraphData,
  testMarkdownTripDemoMmdJsonFenceRegistersAsGeoDataset,
} from '@/__tests__/markdownGeoIntegrationTripDemo.test'
import { testMarkdownPoiImagesRegistryEnrichesMatchingNodes } from '@/__tests__/markdownPoiImagesRegistry.test'
import { testMarkdownApplyWithoutFrontmatterBuildsGraph } from '@/__tests__/markdownApplyWithoutFrontmatter.test'
import { testMermaidElkLayoutRegistersLoadersBeforeInit } from '@/__tests__/mermaidElkLayoutSupport.test'
import {
  testWebpageLayoutAsciiExtractsTextFence,
  testWebpageLayoutAsciiExtractsMockupBeforeLegend,
  testWebpageLayoutAsciiUpsertCreatesFenceWhenMissing,
  testWebpageLayoutAsciiUpsertPreservesBodyOutsideFence,
  testWebpageLayoutAsciiUpsertPreservesLegendTail,
} from '@/__tests__/webpageLayoutAscii.test'
import {
  testWebpageMarkdownPostprocessHandlesCollapsedRemotionPricingBlob,
  testWebpageMarkdownPostprocessRemotionPricingToAsciiTable,
} from '@/__tests__/webpageMarkdownPostprocessRemotionPricing.test'
import {
  testWebpageMarkdownPostprocessCoalescesPlainCardBlocksIntoMarkdownTable,
  testWebpageMarkdownPostprocessNormalizesPlainListsIntoBullets,
  testWebpageMarkdownPostprocessCoalescesNavLinksToTable,
  testWebpageMarkdownPostprocessCoalescesHtmlGridNavIntoTable,
} from '@/__tests__/webpageMarkdownPostprocessCardGrid.test'
import { testMarkdownPreviewRendersHtmlVideoAutoplayAndGridSpans } from '@/__tests__/markdownHtmlRichMediaAndGridPreview.test'
import { testMarkdownPreviewRendersHtmlTableDivAndPictureSources } from '@/__tests__/markdownHtmlTableDivAndPicturePreview.test'
import { testMarkdownPreviewRendersInlineHtmlRichMedia } from '@/__tests__/markdownInlineHtmlRichMediaPreview.test'
import { testMarkdownPreviewRendersHtmlGridWithCalcGapImportant } from '@/__tests__/markdownHtmlGridCalcGapPreview.test'
import { testHtmlToMarkdownUnifiedPreservesGridSectionsAsHtml } from '@/__tests__/htmlToMarkdownUnifiedLayoutPreserve.test'
import { testHtmlToMarkdownUnifiedRewritesSrcsetPosterAndDataSrc } from '@/__tests__/htmlToMarkdownUnifiedUrlRewrite.test'
import {
  testMarkdownNormalizeAsciiBlocksWrapsPipeLayoutAndBoxDrawing,
  testMarkdownPreviewLexNormalizesAsciiBlocksToAsciiLangCodeTokens,
  testMarkdownNormalizeAsciiBlocksWrapsLooseBoxDrawingSectionFromRemotionLikePricing,
} from '@/__tests__/markdownAsciiBlocksNormalize.test'

export const runMarkdownTests = async (results: TestResult[]) => {
  await execTest(results, 'workspaceFs.seedAndCrud', testWorkspaceFsSeedAndCrud)
  await execTest(results, 'workspaceFs.seed.reseedsAfterStorageWipe', testWorkspaceEnsureSeedReseedsAfterStorageWipeWhenNotUserCleared)
  await execTest(results, 'markdownExplorer.outlineAndBacklinks', testMarkdownOutlineAndBacklinks)
  await execTest(results, 'markdownFileTree.folderClickKeepsSelection', testMarkdownFileTreeFolderClickDoesNotClearSelection)
  await execTest(results, 'markdown.geospatial.tripDemoRegistersGeoDataset', testMarkdownTripDemoJsonFenceRegistersAsGeoDataset)
  await execTest(results, 'markdown.geospatial.tripDemoLoadsGraphData', testMarkdownTripDemoJsonFenceLoadsGraphData)
  await execTest(results, 'markdown.geospatial.tripDemoMmdRegistersGeoDataset', testMarkdownTripDemoMmdJsonFenceRegistersAsGeoDataset)
  await execTest(results, 'markdown.geospatial.tripDemoMmdLoadsGraphData', testMarkdownTripDemoMmdJsonFenceLoadsGraphData)
  await execTest(results, 'markdown.geospatial.markdownUrlEmbedsGeoJsonLoadsAsDataset', testGeospatialDatasetLoaderParsesEmbeddedGeoJsonFromMarkdownUrl)
  await execTest(results, 'markdown.mediaRegistry.poiImagesEnrichMatchingNodes', testMarkdownPoiImagesRegistryEnrichesMatchingNodes)
  await execTest(results, 'markdown.applyWithoutFrontmatterBuildsGraph', testMarkdownApplyWithoutFrontmatterBuildsGraph)
  await execTest(results, 'markdown.mermaid.elkLayoutRegistersLoaders', testMermaidElkLayoutRegistersLoadersBeforeInit)
  await execTest(results, 'markdownWorkspace.sourceUrlSync', testMarkdownWorkspaceSyncsSourceUrlFromWorkspaceIndex)
  await execTest(results, 'markdownWorkspace.refreshFromUrl', testMarkdownWorkspaceRefreshFromUrlUpdatesActiveDocumentAndGraphStore)
  await execTest(results, 'markdownWorkspace.viewer.ssot', testMarkdownWorkspaceViewerUsesMarkdownPreviewSsot)
  await execTest(results, 'markdownWorkspace.viewer.remotionRichMedia', testMarkdownWorkspaceViewerRendersRemotionArtifactRichMedia)
  await execTest(results, 'markdown.webpageLayoutAscii.extractsTextFence', testWebpageLayoutAsciiExtractsTextFence)
  await execTest(results, 'markdown.webpageLayoutAscii.extractsMockupBeforeLegend', testWebpageLayoutAsciiExtractsMockupBeforeLegend)
  await execTest(results, 'markdown.webpageLayoutAscii.upsertPreservesBody', testWebpageLayoutAsciiUpsertPreservesBodyOutsideFence)
  await execTest(results, 'markdown.webpageLayoutAscii.upsertPreservesLegendTail', testWebpageLayoutAsciiUpsertPreservesLegendTail)
  await execTest(results, 'markdown.webpageLayoutAscii.upsertCreatesFence', testWebpageLayoutAsciiUpsertCreatesFenceWhenMissing)
  await execTest(results, 'markdown.asciiBlocks.normalize.wrapsPipeAndBoxDrawing', testMarkdownNormalizeAsciiBlocksWrapsPipeLayoutAndBoxDrawing)
  await execTest(results, 'markdown.asciiBlocks.previewLex.asciiLangTokens', testMarkdownPreviewLexNormalizesAsciiBlocksToAsciiLangCodeTokens)
  await execTest(results, 'markdown.asciiBlocks.normalize.wrapsLooseBoxDrawingSection', testMarkdownNormalizeAsciiBlocksWrapsLooseBoxDrawingSectionFromRemotionLikePricing)
  await execTest(results, 'markdown.webpagePostprocess.remotionPricingAscii', testWebpageMarkdownPostprocessRemotionPricingToAsciiTable)
  await execTest(results, 'markdown.webpagePostprocess.remotionPricingBlobAscii', testWebpageMarkdownPostprocessHandlesCollapsedRemotionPricingBlob)
  await execTest(results, 'markdown.webpagePostprocess.cardsToTable', testWebpageMarkdownPostprocessCoalescesPlainCardBlocksIntoMarkdownTable)
  await execTest(results, 'markdown.webpagePostprocess.plainLinesToBullets', testWebpageMarkdownPostprocessNormalizesPlainListsIntoBullets)
  await execTest(results, 'markdown.webpagePostprocess.navLinksToTable', testWebpageMarkdownPostprocessCoalescesNavLinksToTable)
  await execTest(results, 'markdown.webpagePostprocess.htmlGridNavToTable', testWebpageMarkdownPostprocessCoalescesHtmlGridNavIntoTable)
  await execTest(results, 'markdown.preview.htmlVideoAndGrid', testMarkdownPreviewRendersHtmlVideoAutoplayAndGridSpans)
  await execTest(results, 'markdown.preview.htmlTableDivAndPicture', testMarkdownPreviewRendersHtmlTableDivAndPictureSources)
  await execTest(results, 'markdown.preview.inlineHtmlRichMedia', testMarkdownPreviewRendersInlineHtmlRichMedia)
  await execTest(results, 'markdown.preview.htmlGridCalcGapImportant', testMarkdownPreviewRendersHtmlGridWithCalcGapImportant)
  await execTest(results, 'markdown.preview.pipelinePreservesGridHtml', testHtmlToMarkdownUnifiedPreservesGridSectionsAsHtml)
  await execTest(results, 'markdown.htmlToMdUnified.urlRewrite', testHtmlToMarkdownUnifiedRewritesSrcsetPosterAndDataSrc)
}
