import { buildGraphHtmlViewerMarkup } from '@/lib/graph/graphHtmlViewer'

export async function testExportHtmlViewerIsSvgOnlyAndBlocksBrowserZoomAndSelection() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 20 20"><g><circle cx="0" cy="0" r="5" fill="red"/></g></svg>`
  const html = await buildGraphHtmlViewerMarkup({ title: 'T', svgMarkup: svg })
  if (!html) throw new Error('expected html')
  if (!html.includes('maximum-scale=1') || !html.includes('user-scalable=no')) {
    throw new Error('expected viewport to block browser zoom')
  }
  if (!html.includes('user-select:none') && !html.includes('user-select: none')) {
    throw new Error('expected selection disabled')
  }
  if (!html.includes('.kg-mediaTitle') || !html.includes('pointer-events:none')) {
    throw new Error('expected rich media title to be non-interactive to avoid text selection')
  }
  if (!html.includes('kg-media-toggle') || !html.includes('Toggle media interaction')) {
    throw new Error('expected media interaction toggle control')
  }
  if (!html.includes('setPanHeld') || !html.includes('Spacebar')) {
    throw new Error('expected space-to-pan support for interactive media mode')
  }
  if (!html.includes("addEventListener('wheel', onWheel, { passive: false, capture: true })")) {
    throw new Error('expected wheel listener to capture and prevent browser zoom')
  }
  if (html.includes('kg-imgWrap') || html.includes('kg-img') || html.includes('<img')) {
    throw new Error('expected svg-only viewer (no png/img fallback)')
  }
}

export async function testExportHtmlViewerIncludesRichMediaNodesWithDefaultPoolMax() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 20 20"><g><circle cx="0" cy="0" r="5" fill="red"/></g></svg>`
  const html = await buildGraphHtmlViewerMarkup({
    title: 'T',
    svgMarkup: svg,
    includeRichMediaOverlays: true,
    graphData: {
      type: 'Graph',
      nodes: [{ id: 'm1', label: 'Media', type: 'Entity', properties: { media_url: 'https://example.com/test.png' } }],
      edges: [],
    },
  })
  if (!html) throw new Error('expected html')
  if (!html.includes('example.com/test.png')) {
    throw new Error('expected rich media node to be embedded in exported html viewer')
  }
}
