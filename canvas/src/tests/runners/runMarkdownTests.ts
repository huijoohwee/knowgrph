import { execTest, TestResult } from './testRunnerUtils'
import { testMarkdownOutlineAndBacklinks, testWorkspaceFsSeedAndCrud } from '@/__tests__/markdownExplorerWorkspaceFs.test'
import { testWorkspaceEnsureSeedReseedsAfterStorageWipeWhenNotUserCleared } from '@/__tests__/workspaceSeedReseedAfterStorageWipe.test'
import { testMarkdownWorkspaceSyncsSourceUrlFromWorkspaceIndex } from '@/__tests__/markdownWorkspaceSourceUrlSync.test'
import { testMarkdownWorkspaceRefreshFromUrlUpdatesActiveDocumentAndGraphStore } from '@/__tests__/markdownWorkspaceRefreshFromUrl.test'
import { testMarkdownFileTreeFolderClickDoesNotClearSelection } from '@/__tests__/markdownFileTreeFolderClick.test'
import {
  testMarkdownTripDemoJsonFenceLoadsGraphData,
  testMarkdownTripDemoJsonFenceRegistersAsGeoDataset,
} from '@/__tests__/markdownGeoIntegrationTripDemo.test'
import { testMarkdownPoiImagesRegistryEnrichesMatchingNodes } from '@/__tests__/markdownPoiImagesRegistry.test'
import { testMarkdownApplyWithoutFrontmatterBuildsGraph } from '@/__tests__/markdownApplyWithoutFrontmatter.test'
import { testMermaidElkLayoutRegistersLoadersBeforeInit } from '@/__tests__/mermaidElkLayoutSupport.test'
import {
  testWireframeAsciiExtractsTextFence,
  testWireframeAsciiExtractsMockupBeforeLegend,
  testWireframeAsciiUpsertCreatesFenceWhenMissing,
  testWireframeAsciiUpsertPreservesBodyOutsideFence,
  testWireframeAsciiUpsertPreservesLegendTail,
} from '@/__tests__/wireframeAscii.test'

export const runMarkdownTests = async (results: TestResult[]) => {
  await execTest(results, 'workspaceFs.seedAndCrud', testWorkspaceFsSeedAndCrud)
  await execTest(results, 'workspaceFs.seed.reseedsAfterStorageWipe', testWorkspaceEnsureSeedReseedsAfterStorageWipeWhenNotUserCleared)
  await execTest(results, 'markdownExplorer.outlineAndBacklinks', testMarkdownOutlineAndBacklinks)
  await execTest(results, 'markdownFileTree.folderClickKeepsSelection', testMarkdownFileTreeFolderClickDoesNotClearSelection)
  await execTest(results, 'markdown.geospatial.tripDemoRegistersGeoDataset', testMarkdownTripDemoJsonFenceRegistersAsGeoDataset)
  await execTest(results, 'markdown.geospatial.tripDemoLoadsGraphData', testMarkdownTripDemoJsonFenceLoadsGraphData)
  await execTest(results, 'markdown.mediaRegistry.poiImagesEnrichMatchingNodes', testMarkdownPoiImagesRegistryEnrichesMatchingNodes)
  await execTest(results, 'markdown.applyWithoutFrontmatterBuildsGraph', testMarkdownApplyWithoutFrontmatterBuildsGraph)
  await execTest(results, 'markdown.mermaid.elkLayoutRegistersLoaders', testMermaidElkLayoutRegistersLoadersBeforeInit)
  await execTest(results, 'markdownWorkspace.sourceUrlSync', testMarkdownWorkspaceSyncsSourceUrlFromWorkspaceIndex)
  await execTest(results, 'markdownWorkspace.refreshFromUrl', testMarkdownWorkspaceRefreshFromUrlUpdatesActiveDocumentAndGraphStore)
  await execTest(results, 'markdown.wireframeAscii.extractsTextFence', testWireframeAsciiExtractsTextFence)
  await execTest(results, 'markdown.wireframeAscii.extractsMockupBeforeLegend', testWireframeAsciiExtractsMockupBeforeLegend)
  await execTest(results, 'markdown.wireframeAscii.upsertPreservesBody', testWireframeAsciiUpsertPreservesBodyOutsideFence)
  await execTest(results, 'markdown.wireframeAscii.upsertPreservesLegendTail', testWireframeAsciiUpsertPreservesLegendTail)
  await execTest(results, 'markdown.wireframeAscii.upsertCreatesFence', testWireframeAsciiUpsertCreatesFenceWhenMissing)
}
