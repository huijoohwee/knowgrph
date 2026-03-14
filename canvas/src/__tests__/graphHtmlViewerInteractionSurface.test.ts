import { buildGraphHtmlViewerMarkup } from '@/lib/graph/graphHtmlViewer'

export async function testGraphHtmlViewerOverlayDoesNotBlockCanvasPointerEvents() {
  const html = await buildGraphHtmlViewerMarkup({
    title: 't',
    svgMarkup: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><g data-node-id="n"><circle cx="5" cy="5" r="2"/></g></svg>',
    graphData: { nodes: [{ id: 'n', label: 'n', x: 0, y: 0 }], edges: [] } as any,
    includeRichMediaOverlays: true,
  })
  if (!html || !html.includes('#kg-overlay{position:fixed;inset:0;pointer-events:none}')) {
    throw new Error('Expected overlay to use pointer-events:none so the canvas remains interactive')
  }
}

export async function testGraphHtmlViewerMediaPanelsAreNotPointerIgnored() {
  const html = await buildGraphHtmlViewerMarkup({
    title: 't',
    svgMarkup: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><g data-node-id="n"><circle cx="5" cy="5" r="2"/></g></svg>',
    graphData: { nodes: [{ id: 'n', label: 'n', x: 0, y: 0 }], edges: [] } as any,
    includeRichMediaOverlays: true,
  })
  if (!html) throw new Error('Expected HTML to be generated')
  if (html.includes("el.setAttribute('data-kg-canvas-pointer-ignore'")) {
    throw new Error('Media panels must remain draggable; they should not be marked pointer-ignore')
  }
}

