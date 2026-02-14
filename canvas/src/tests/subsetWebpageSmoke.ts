import {
  testWebpageLayoutAsciiExtractsMockupBeforeLegend,
  testWebpageLayoutAsciiExtractsTextFence,
  testWebpageLayoutAsciiUpsertCreatesFenceWhenMissing,
  testWebpageLayoutAsciiUpsertPreservesBodyOutsideFence,
  testWebpageLayoutAsciiUpsertPreservesLegendTail,
} from '@/__tests__/webpageLayoutAscii.test'
import { testWebpageMarkdownArtifactIncludesLayoutAndMotionFrames } from '@/__tests__/webpageMarkdownArtifact.test'
import { testWebpageMarkdownArtifactRemotionFixtureSections } from '@/__tests__/webpageMarkdownArtifactRemotionFixture.test'
import { testWebsiteImportWorkspaceWritesArtifactDoc } from '@/__tests__/websiteImportWorkspaceArtifact.test'
import {
  testMarkdownWorkspaceWebpageHtmlViewRendersIframe,
  testMarkdownWorkspaceWebpageHtmlViewUsesWebsiteImportArtifactForHtml,
  testMarkdownWorkspaceHtmlEditorSharesMarkdownSsot,
} from '@/__tests__/markdownWorkspaceWebpageHtmlView.test'
import { testMarkdownWorkspaceWebpageHtmlSidecarDeletionDoesNotRecreate } from '@/__tests__/markdownWorkspaceWebpageHtmlSidecarDeletion.test'
import { testSettingsRegistryReadWrite } from '@/__tests__/settings.test'

async function main() {
  testWebpageLayoutAsciiExtractsTextFence()
  testWebpageLayoutAsciiExtractsMockupBeforeLegend()
  testWebpageLayoutAsciiUpsertPreservesBodyOutsideFence()
  testWebpageLayoutAsciiUpsertPreservesLegendTail()
  testWebpageLayoutAsciiUpsertCreatesFenceWhenMissing()
  testWebpageMarkdownArtifactIncludesLayoutAndMotionFrames()
  testWebpageMarkdownArtifactRemotionFixtureSections()
  testWebsiteImportWorkspaceWritesArtifactDoc()
  await testMarkdownWorkspaceWebpageHtmlViewRendersIframe()
  await testMarkdownWorkspaceWebpageHtmlViewUsesWebsiteImportArtifactForHtml()
  await testMarkdownWorkspaceHtmlEditorSharesMarkdownSsot()
  await testMarkdownWorkspaceWebpageHtmlSidecarDeletionDoesNotRecreate()
  testSettingsRegistryReadWrite()
  console.log('OK subsetWebpageSmoke')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
