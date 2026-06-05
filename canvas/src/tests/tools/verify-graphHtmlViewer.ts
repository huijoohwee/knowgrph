import { testExportHtmlViewerIsSvgOnlyAndBlocksBrowserZoomAndSelection, testExportHtmlViewerIncludesRichMediaNodesWithDefaultPoolMax, testExportHtmlViewerMediaPanelHasNonZeroLayout } from '@/__tests__/graphHtmlViewer.test'

async function main() {
  await testExportHtmlViewerIsSvgOnlyAndBlocksBrowserZoomAndSelection()
  await testExportHtmlViewerIncludesRichMediaNodesWithDefaultPoolMax()
  await testExportHtmlViewerMediaPanelHasNonZeroLayout()
  console.log('OK verify-graphHtmlViewer')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

