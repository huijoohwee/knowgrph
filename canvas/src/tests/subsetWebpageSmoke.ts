import {
  testWebpageLayoutAsciiExtractsMockupBeforeLegend,
  testWebpageLayoutAsciiExtractsTextFence,
  testWebpageLayoutAsciiUpsertCreatesFenceWhenMissing,
  testWebpageLayoutAsciiUpsertPreservesBodyOutsideFence,
  testWebpageLayoutAsciiUpsertPreservesLegendTail,
} from '@/__tests__/webpageLayoutAscii.test'
import { testWebpageMarkdownArtifactIncludesLayoutAndMotionFrames } from '@/__tests__/webpageMarkdownArtifact.test'
import { testWebpageMarkdownArtifactRemotionFixtureSections } from '@/__tests__/webpageMarkdownArtifactRemotionFixture.test'
import {
  testMarkdownWorkspaceWebpageHtmlViewRendersIframe,
  testMarkdownWorkspaceWebpageHtmlViewUsesWebsiteImportArtifactForHtml,
} from '@/__tests__/markdownWorkspaceWebpageHtmlView.test'
import { testSettingsRegistryReadWrite } from '@/__tests__/settings.test'

async function main() {
  testWebpageLayoutAsciiExtractsTextFence()
  testWebpageLayoutAsciiExtractsMockupBeforeLegend()
  testWebpageLayoutAsciiUpsertPreservesBodyOutsideFence()
  testWebpageLayoutAsciiUpsertPreservesLegendTail()
  testWebpageLayoutAsciiUpsertCreatesFenceWhenMissing()
  testWebpageMarkdownArtifactIncludesLayoutAndMotionFrames()
  testWebpageMarkdownArtifactRemotionFixtureSections()
  await testMarkdownWorkspaceWebpageHtmlViewRendersIframe()
  await testMarkdownWorkspaceWebpageHtmlViewUsesWebsiteImportArtifactForHtml()
  testSettingsRegistryReadWrite()
  console.log('OK subsetWebpageSmoke')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

