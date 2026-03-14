import { buildGraphHtmlViewerMarkup } from '@/lib/graph/graphHtmlViewer'

export async function testExportHtmlCanvasHonorsPreferWebgl3d() {
  const html = await buildGraphHtmlViewerMarkup({
    title: 't',
    svgMarkup: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><g data-node-id="n"><circle cx="5" cy="5" r="2"/></g></svg>',
    graphData: { nodes: [{ id: 'n', label: 'n', x: 0, y: 0 }], edges: [] } as any,
    preferWebgl3d: true,
  })
  if (!html || !html.includes('"preferWebgl3d":true')) {
    throw new Error('Expected preferWebgl3d=true to be embedded into interaction config')
  }
}

