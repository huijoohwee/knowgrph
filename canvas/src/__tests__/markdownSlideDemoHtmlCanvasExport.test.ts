import { buildGraphHtmlViewerMarkup } from '@/lib/graph/graphHtmlViewer'
import { readMarkdownSlideDemo, resolveMarkdownSlideDemoDocumentPath } from '@/tests/lib/markdownSlideDemo'
import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'

export async function testMarkdownSlideDemoHtmlCanvasExportHudAndMetadata() {
  const text = readMarkdownSlideDemo()
  if (!text || !text.trim()) throw new Error('expected markdown-slide-demo text')

  const documentPath = resolveMarkdownSlideDemoDocumentPath() || 'data/test-data/md-demo-00.md'
  const res = await loadGraphDataFromTextViaParser(documentPath, text, { applyToStore: false })
  if (!res || !res.graphData) throw new Error('expected graphData from markdown-slide-demo import')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><g data-kg-layer="nodes"><circle data-node-id="n" cx="0" cy="0" r="5"/></g></svg>`
  const html = await buildGraphHtmlViewerMarkup({
    title: 'markdown-slide-demo (Canvas)',
    svgMarkup: svg,
    graphData: res.graphData,
    includeRichMediaOverlays: true,
  })
  if (!html) throw new Error('expected html')

  if (!html.includes('kg-3d-toggle') || !html.includes('kg-rich-toggle') || !html.includes('kg-media-toggle') || !html.includes('kg-frontmatter-toggle')) {
    throw new Error('expected exported html canvas viewer to include 3d/rich/media/frontmatter hud toggles')
  }

  if (!html.includes('groupMembersByIdJson') && !html.includes('groupMembersById')) {
    throw new Error('expected exported html canvas viewer to embed group membership metadata')
  }

  if (!html.includes('nodePosByIdJson') && !html.includes('nodePosById')) {
    throw new Error('expected exported html canvas viewer to embed node position metadata')
  }
}
