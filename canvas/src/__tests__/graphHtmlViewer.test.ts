import { buildGraphHtmlViewerMarkup } from '@/lib/graph/graphHtmlViewer'
import { listMediaOverlayNodes } from '@/lib/render/mediaOverlayPool'
import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { captureLiveRichMediaOverlayHtmlForHtmlViewerExport } from '@/lib/graph/htmlViewer/liveOverlayExport'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

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
  if (!html.includes('rebuildNodePosFromSvg')) {
    throw new Error('expected exported viewer to derive node positions from svg for fidelity')
  }
  if (!html.includes('translate\\(\\s*')) {
    throw new Error('expected exported viewer embedded regex literals to preserve backslashes')
  }
  if (!html.includes('scheduleOverlayUpdate')) {
    throw new Error('expected exported viewer to coalesce overlay updates (avoid churn)')
  }
  if (!html.includes("pointerMode !== 'pan'") || !html.includes('applyMediaPointerEvents')) {
    throw new Error('expected pan mode to disable media pointer events so overlay drag pans instead')
  }
  if (html.includes('mediaOffsetById') || html.includes('startMediaHeaderDrag')) {
    throw new Error('expected exported viewer media header drag to move node (not detach panel)')
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

export async function testExportHtmlViewerMediaPanelHasNonZeroLayout() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 20 20"><g data-node-id="m1"><circle data-role="node-circle" cx="0" cy="0" r="5" fill="red"/></g></svg>`
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
  if (!html.includes('.kg-media{') || !html.includes('display:flex') || !html.includes('flex-direction:column')) {
    throw new Error('expected exported viewer media panel to be flex column')
  }
  if (!html.includes('.kg-mediaBody{') || !html.includes('flex:1')) {
    throw new Error('expected exported viewer media body to fill panel height')
  }
  if (!html.includes('.kg-mediaBody iframe,.kg-mediaBody img,.kg-mediaBody video') || !html.includes('height:100%')) {
    throw new Error('expected exported viewer media content to size to container')
  }
}

export async function testExportHtmlViewerTreatsIFrameKindWithImageUrlAsImage() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 20 20"><g data-node-id="m1"><circle cx="0" cy="0" r="5" fill="red"/></g></svg>`
  const html = await buildGraphHtmlViewerMarkup({
    title: 'T',
    svgMarkup: svg,
    includeRichMediaOverlays: true,
    graphData: {
      type: 'Graph',
      nodes: [
        {
          id: 'm1',
          label: 'Media',
          type: 'Entity',
          properties: { media_kind: 'iframe', media_url: 'https://example.com/a.png' },
        },
      ],
      edges: [],
    },
  })
  if (!html) throw new Error('expected html')
  if (!html.includes('kgInferMediaKindFromUrl')) {
    throw new Error('expected exported html viewer to include url-based media kind inference')
  }
  if (!html.includes('kgInferMediaKindFromUrl2')) {
    throw new Error('expected exported html viewer to include extended media kind inference')
  }
  if (!html.includes('wx_fmt=')) {
    throw new Error('expected exported html viewer to treat wx_fmt images as images')
  }
  if (!html.includes("inferredKind && (kind === 'iframe'")) {
    throw new Error('expected iframe kind to be overridden by inferred image kind')
  }
}

export async function testExportHtmlViewerHudIncludesModeToggles() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 20 20"><g><circle cx="0" cy="0" r="5" fill="red"/></g></svg>`
  const html = await buildGraphHtmlViewerMarkup({ title: 'T', svgMarkup: svg })
  if (!html) throw new Error('expected html')
  if (!html.includes('kg-3d-toggle') || !html.includes('kg-rich-toggle') || !html.includes('kg-frontmatter-toggle')) {
    throw new Error('expected exported html viewer to include 3d/rich/frontmatter toggle controls')
  }
}

export async function testExportHtmlViewerMarkdownSnippetWeChatImageAppearsInOverlayPoolAndHtml() {
  const snippet =
    '![mmbiz.qpic.cn](https://mmbiz.qpic.cn/mmbiz_png/gdEn3pxzatSHAib7vomhHSibH0icqO2xD72VBSBEgWDypepymkibpnpmW9iczvnTShtBHPyGRN7MttLwmWbFCIz9MtLKtVxml3cXeO1icZ0DicibLew/640?wx_fmt=png&from=appmsg)'
  const parsed = await loadGraphDataFromTextViaParser('sandbox/test-data/snippet-wechat-image.md', snippet, { applyToStore: false })
  if (!parsed || !parsed.graphData) throw new Error('expected graphData from markdown snippet parser')
  const graphData = parsed.graphData
  const overlayNodes = listMediaOverlayNodes({
    enabled: true,
    nodes: graphData.nodes || [],
    poolMax: 24,
  })
  const expectedHost = 'mmbiz.qpic.cn/mmbiz_png/'
  const expectedQuery = 'wx_fmt=png'
  const inOverlayPool = overlayNodes.some(n => n.kind === 'image' && n.url.includes(expectedHost) && n.url.includes(expectedQuery))
  if (!inOverlayPool) {
    throw new Error('expected markdown snippet WeChat image to appear in media overlay node pool')
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 20 20"><g data-node-id="n"><circle cx="0" cy="0" r="5" fill="red"/></g></svg>`
  const html = await buildGraphHtmlViewerMarkup({
    title: 'snippet-wechat-image',
    svgMarkup: svg,
    includeRichMediaOverlays: true,
    graphData,
  })
  if (!html) throw new Error('expected html')
  if (!html.includes(expectedHost) || !html.includes(expectedQuery)) {
    throw new Error('expected markdown snippet WeChat image to be embedded in html viewer runtime payload')
  }
}

export async function testExportHtmlViewerRuntimeSupportsCentroidFitAndTouchDrag() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 20 20"><g data-node-id="n"><circle cx="0" cy="0" r="5" fill="red"/></g></svg>`
  const html = await buildGraphHtmlViewerMarkup({
    title: 'T',
    svgMarkup: svg,
    graphData: { nodes: [{ id: 'n', label: 'n', x: 0, y: 0 }], edges: [] } as any,
  })
  if (!html) throw new Error('expected html')
  if (!html.includes('getContentCentroid') || !html.includes('moveNodeDrag(-1')) {
    throw new Error('expected exported html viewer runtime to support centroid fit and touch node dragging')
  }
}

export async function testExportHtmlViewerRuntimeFallsBackToRawMediaWhenProxyFails() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 20 20"><g data-node-id="n"><circle cx="0" cy="0" r="5" fill="red"/></g></svg>`
  const html = await buildGraphHtmlViewerMarkup({
    title: 'T',
    svgMarkup: svg,
    includeRichMediaOverlays: true,
    graphData: {
      type: 'Graph',
      nodes: [{ id: 'm1', label: 'Media', type: 'Image', properties: { media_kind: 'image', media_url: 'https://mmbiz.qpic.cn/a.png?wx_fmt=png' } }],
      edges: [],
    },
  })
  if (!html) throw new Error('expected html')
  if (!html.includes('imgEl.onerror = function()') || !html.includes('vid.onerror = function()')) {
    throw new Error('expected html viewer runtime to attach media proxy fallback handlers')
  }
  if (!html.includes("cur !== raw")) {
    throw new Error('expected html viewer runtime fallback to switch source from proxy to raw url')
  }
}

export async function testExportHtmlViewerEmbedsProvidedOverlayHtml() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 20 20"><g><circle cx="0" cy="0" r="5" fill="red"/></g></svg>`
  const overlayHtml = '<article data-kg-rich-media-panel="1" data-node-id="m1"><div>Overlay</div></article>'
  const html = await buildGraphHtmlViewerMarkup({ title: 'T', svgMarkup: svg, overlayHtml })
  if (!html) throw new Error('expected html')
  if (!html.includes(overlayHtml)) {
    throw new Error('expected provided overlayHtml to be embedded in exported viewer')
  }
}

export async function testExportHtmlViewerRuntimeScriptParsesWithOverlayHtml() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 20 20"><g data-node-id="m1"><circle cx="0" cy="0" r="5" fill="red"/></g></svg>`
  const overlayHtml =
    '<article data-kg-rich-media-panel="1" data-node-id="m1"><header class="kg-mediaHeader" data-kg-media-panel-header="1">H</header><section class="kg-mediaBody"><iframe src="about:blank"></iframe></section></article>'
  const html = await buildGraphHtmlViewerMarkup({ title: 'T', svgMarkup: svg, overlayHtml })
  if (!html) throw new Error('expected html')
  const match = html.match(/<script>\n([\s\S]*?)\n\s*<\/script>/)
  const js = match && match[1] ? match[1] : ''
  if (!js.trim()) throw new Error('expected runtime script')
  try {
    new Function(js)
  } catch (e) {
    throw new Error(`expected runtime script to parse, got: ${String((e as Error)?.message || e)}`)
  }
}

export async function testExportHtmlViewerMediaInteractivityDefaultsOn() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 20 20"><g><circle cx="0" cy="0" r="5" fill="red"/></g></svg>`
  const html = await buildGraphHtmlViewerMarkup({ title: 'T', svgMarkup: svg })
  if (!html) throw new Error('expected html')
  if (!html.includes('--kg-media-pointer-events:auto')) {
    throw new Error('expected exported viewer to default to media interactivity enabled')
  }
  if (!html.includes('var mediaInteractive = true;')) {
    throw new Error('expected runtime mediaInteractive default to be true')
  }
  if (!html.includes("var pe = (mediaInteractive && pointerMode !== 'pan'")) {
    throw new Error('expected exported viewer to compute media pointer-events from mode state')
  }
}

export async function testExportHtmlViewerMediaPointerEventsRespectsNodeInteractivity() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 20 20"><g><circle cx="0" cy="0" r="5" fill="red"/></g></svg>`
  const html = await buildGraphHtmlViewerMarkup({ title: 'T', svgMarkup: svg })
  if (!html) throw new Error('expected html')
  if (!html.includes('var interactive0 = !!n.interactive;')) {
    throw new Error('expected runtime to apply media pointer-events per node interactive flag')
  }
  if (!html.includes("el.style.pointerEvents = perPe")) {
    throw new Error('expected runtime to set inline pointerEvents per media element')
  }
}

export async function testExportHtmlViewerOverlayExportStripsInteractionGuards() {
  const bootstrap = typeof document === 'undefined' ? initJsdomHarness() : null
  try {
  const root = document.createElement('div')
  const panel = document.createElement('article')
  panel.setAttribute('data-kg-rich-media-panel', '1')
  panel.setAttribute('data-node-id', 'm1')
  panel.setAttribute('data-kg-canvas-pointer-ignore', 'true')
  panel.setAttribute('data-kg-canvas-wheel-ignore', 'true')
  panel.style.pointerEvents = 'auto'
  panel.style.touchAction = 'none'
  panel.style.userSelect = 'none'
  panel.innerHTML = '<header class="kg-mediaHeader">H</header><section class="kg-mediaBody"><div style="pointer-events:auto">B</div></section>'
  root.appendChild(panel)

  const html = captureLiveRichMediaOverlayHtmlForHtmlViewerExport({ overlayRootEl: root })
  if (!html) throw new Error('expected overlay html')
  if (html.includes('data-kg-canvas-pointer-ignore') || html.includes('data-kg-canvas-wheel-ignore')) {
    throw new Error('expected overlay export to strip canvas ignore attributes')
  }
  if (html.toLowerCase().includes('pointer-events')) {
    throw new Error('expected overlay export to strip pointer-events inline styles')
  }
  } finally {
    bootstrap?.restore()
  }
}
