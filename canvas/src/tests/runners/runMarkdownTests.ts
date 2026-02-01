import { execTest, TestResult } from './testRunnerUtils'
import { testMarkdownOutlineAndBacklinks, testWorkspaceFsSeedAndCrud } from '@/__tests__/markdownExplorerWorkspaceFs.test'
import { testMarkdownWorkspaceSyncsSourceUrlFromWorkspaceIndex } from '@/__tests__/markdownWorkspaceSourceUrlSync.test'
import { testMarkdownWorkspaceRefreshFromUrlUpdatesActiveDocumentAndGraphStore } from '@/__tests__/markdownWorkspaceRefreshFromUrl.test'
import { testMarkdownFileTreeFolderClickDoesNotClearSelection } from '@/__tests__/markdownFileTreeFolderClick.test'
import { testMarkdownTripDemoJsonFenceRegistersAsGeoDataset } from '@/__tests__/markdownGeoIntegrationTripDemo.test'

export const runMarkdownTests = async (results: TestResult[]) => {
  await execTest(results, 'workspaceFs.seedAndCrud', testWorkspaceFsSeedAndCrud)
  await execTest(results, 'markdownExplorer.outlineAndBacklinks', testMarkdownOutlineAndBacklinks)
  await execTest(results, 'markdownFileTree.folderClickKeepsSelection', testMarkdownFileTreeFolderClickDoesNotClearSelection)
  await execTest(results, 'markdown.geospatial.tripDemoRegistersGeoDataset', testMarkdownTripDemoJsonFenceRegistersAsGeoDataset)
  await execTest(results, 'markdownWorkspace.sourceUrlSync', testMarkdownWorkspaceSyncsSourceUrlFromWorkspaceIndex)
  await execTest(results, 'markdownWorkspace.refreshFromUrl', testMarkdownWorkspaceRefreshFromUrlUpdatesActiveDocumentAndGraphStore)
}
