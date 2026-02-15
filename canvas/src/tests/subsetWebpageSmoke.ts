import {
  testWebpageLayoutAsciiExtractsMockupBeforeLegend,
  testWebpageLayoutAsciiExtractsTextFence,
  testWebpageLayoutAsciiUpsertCreatesFenceWhenMissing,
  testWebpageLayoutAsciiUpsertPreservesBodyOutsideFence,
  testWebpageLayoutAsciiUpsertPreservesLegendTail,
} from '@/__tests__/webpageLayoutAscii.test'
import { testWebpageMarkdownArtifactIncludesLayoutAndMotionFrames } from '@/__tests__/webpageMarkdownArtifact.test'
import { testWebpageMarkdownArtifactFixtureLikeSections } from '@/__tests__/webpageMarkdownArtifactFixtureLike.test'
import {
  testWebsiteImportWorkspaceWritesArtifactDoc,
  testWebsiteImportWorkspaceWritesSourceFaithfulDoc,
} from '@/__tests__/websiteImportWorkspaceArtifact.test'
import {
  testMarkdownWorkspaceWebpageHtmlViewRendersIframe,
  testMarkdownWorkspaceWebpageHtmlViewUsesWebsiteImportArtifactForHtml,
  testMarkdownWorkspaceHtmlEditorSharesMarkdownSsot,
} from '@/__tests__/markdownWorkspaceWebpageHtmlView.test'
import { testMarkdownWorkspaceWebpageHtmlSidecarDeletionDoesNotRecreate } from '@/__tests__/markdownWorkspaceWebpageHtmlSidecarDeletion.test'
import { testSettingsRegistryReadWrite } from '@/__tests__/settings.test'
import { testImportUrlWebpageCreatesHtmlFrontmatterStub } from '@/__tests__/importUrlWebpageStub.test'

async function main() {
  testWebpageLayoutAsciiExtractsTextFence()
  testWebpageLayoutAsciiExtractsMockupBeforeLegend()
  testWebpageLayoutAsciiUpsertPreservesBodyOutsideFence()
  testWebpageLayoutAsciiUpsertPreservesLegendTail()
  testWebpageLayoutAsciiUpsertCreatesFenceWhenMissing()
  testWebpageMarkdownArtifactIncludesLayoutAndMotionFrames()
  testWebpageMarkdownArtifactFixtureLikeSections()
  testWebsiteImportWorkspaceWritesArtifactDoc()
  await testMarkdownWorkspaceWebpageHtmlViewRendersIframe()
  await testMarkdownWorkspaceWebpageHtmlViewUsesWebsiteImportArtifactForHtml()
  await testMarkdownWorkspaceHtmlEditorSharesMarkdownSsot()
  await testMarkdownWorkspaceWebpageHtmlSidecarDeletionDoesNotRecreate()
  testSettingsRegistryReadWrite()
  await testImportUrlWebpageCreatesHtmlFrontmatterStub()
  console.log('OK subsetWebpageSmoke')
  testWebsiteImportWorkspaceWritesSourceFaithfulDoc()
}



main().catch((err) => {
  console.error(err)
  process.exit(1)
})
