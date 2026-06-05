import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildNodeMediaInventory } from '@/components/GraphCanvas/helpers'

export function testBuildNodeMediaInventoryCountsKindsAcrossCanonicalMediaSpecs() {
  const inventory = buildNodeMediaInventory([
    {
      id: 'image',
      type: 'Image',
      label: 'Image',
      properties: { image: 'https://example.com/a.png' },
    },
    {
      id: 'svg',
      type: 'Image',
      label: 'SVG',
      properties: { media_kind: 'svg', media_url: 'https://example.com/a.svg' },
    },
    {
      id: 'video',
      type: 'Video',
      label: 'Video',
      properties: { video: 'https://example.com/a.mp4' },
    },
    {
      id: 'audio',
      type: 'Audio',
      label: 'Audio',
      properties: { media_kind: 'audio', media_url: 'https://example.com/a.mp3' },
    },
    {
      id: 'iframe',
      type: 'IFrame',
      label: 'IFrame',
      properties: { iframe_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
    },
  ] as Parameters<typeof buildNodeMediaInventory>[0])

  if (inventory.totalCount !== 5) throw new Error(`expected 5 media nodes, got ${inventory.totalCount}`)
  if (inventory.imageCount !== 1) throw new Error(`expected 1 image node, got ${inventory.imageCount}`)
  if (inventory.svgCount !== 1) throw new Error(`expected 1 svg node, got ${inventory.svgCount}`)
  if (inventory.imageLikeCount !== 2) throw new Error(`expected 2 image-like nodes, got ${inventory.imageLikeCount}`)
  if (inventory.videoCount !== 1) throw new Error(`expected 1 video node, got ${inventory.videoCount}`)
  if (inventory.audioCount !== 1) throw new Error(`expected 1 audio node, got ${inventory.audioCount}`)
  if (inventory.iframeCount !== 1) throw new Error(`expected 1 iframe node, got ${inventory.iframeCount}`)
  if (inventory.rows.length !== 5) throw new Error(`expected 5 listed rows, got ${inventory.rows.length}`)
}

export function testBuildNodeMediaInventoryCanLimitRowsWithoutChangingListedStatsMode() {
  const inventory = buildNodeMediaInventory([
    {
      id: 'image:1',
      type: 'Image',
      label: 'Image 1',
      properties: { image: 'https://example.com/1.png' },
    },
    {
      id: 'image:2',
      type: 'Image',
      label: 'Image 2',
      properties: { image: 'https://example.com/2.png' },
    },
  ] as Parameters<typeof buildNodeMediaInventory>[0], {
    maxRows: 1,
    limitStatsToRows: true,
  })

  if (inventory.totalCount !== 1) throw new Error(`expected listed-only total count 1, got ${inventory.totalCount}`)
  if (inventory.imageLikeCount !== 1) throw new Error(`expected listed-only image-like count 1, got ${inventory.imageLikeCount}`)
  if (inventory.rows.length !== 1) throw new Error(`expected 1 listed row, got ${inventory.rows.length}`)
}

export function testMediaNodesSectionUsesSharedInventoryHelper() {
  const filePath = resolve(process.cwd(), 'src', 'features', 'panels', 'views', 'MediaNodesSection.tsx')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes('buildNodeMediaInventory')) {
    throw new Error('expected MediaNodesSection to use shared media inventory helper')
  }
  if (!text.includes('inventory.audioCount')) {
    throw new Error('expected MediaNodesSection to surface shared audio media counts')
  }
  if (!text.includes("MEDIA_NODES_STATS_GRID_CLASS_NAME = 'grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5'") || text.includes('grid grid-cols-5 gap-2')) {
    throw new Error('expected MediaNodesSection stats grid to use a mobile-first responsive owner')
  }
  if (text.includes('hasNodeMedia(n)')) {
    throw new Error('expected MediaNodesSection to remove local media node scan loop')
  }
}

export function testUseRichMediaOverlays2dUsesSharedInventoryHelperForMetrics() {
  const filePath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useRichMediaOverlays2d.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes('const inventory = buildNodeMediaInventory(nodes)')) {
    throw new Error('expected useRichMediaOverlays2d metrics to use shared media inventory helper')
  }
  if (!text.includes('audioCount: inventory.audioCount')) {
    throw new Error('expected useRichMediaOverlays2d metrics to report shared audio media counts')
  }
  if (text.includes('let iframeCount = 0')) {
    throw new Error('expected useRichMediaOverlays2d to remove duplicated local media counters')
  }
}

export function testAudioMediaUsesSharedCardPanelAndHtmlViewerOwners() {
  const cardPreview = readFileSync(resolve(process.cwd(), 'src', 'lib', 'cards', 'CardMediaPreview.tsx'), 'utf8')
  const htmlViewer = readFileSync(resolve(process.cwd(), 'src', 'lib', 'graph', 'htmlViewer', 'buildGraphHtmlViewerMarkup.ts'), 'utf8')
  const htmlViewerRuntime = readFileSync(resolve(process.cwd(), 'src', 'lib', 'graph', 'htmlViewer', 'runtimeScript.ts'), 'utf8')
  const richMediaPanel = readFileSync(resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx'), 'utf8')
  const richMediaOverlayLayer = readFileSync(resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'components', 'RichMediaOverlayLayer2d.tsx'), 'utf8')
  const webpageLayoutToGraph = readFileSync(resolve(process.cwd(), 'src', 'lib', 'websites', 'webpageLayoutToGraph.ts'), 'utf8')

  if (!cardPreview.includes('data-kg-card-media-kind="audio"') || !cardPreview.includes('<audio')) {
    throw new Error('expected shared CardMediaPreview to render audio through the card media owner')
  }
  if (!richMediaPanel.includes("kind === 'video' || kind === 'audio'") || !richMediaPanel.includes('kind={kind}')) {
    throw new Error('expected RichMediaPanel to render audio through shared CardMediaPreview')
  }
  if (!richMediaOverlayLayer.includes("n.kind === 'audio'")) {
    throw new Error('expected D3 rich media overlay layer to preserve shared audio media kind')
  }
  if (!webpageLayoutToGraph.includes("t === 'AUDIO'") || !webpageLayoutToGraph.includes("tag === 'VIDEO' ? 'video' : 'audio'")) {
    throw new Error('expected webpage layout graph import to preserve audio media tags through shared media properties')
  }
  if (!htmlViewer.includes('audio[src]') || !htmlViewer.includes('.kg-mediaBody audio')) {
    throw new Error('expected exported HTML viewer to discover and style audio media nodes')
  }
  if (
    !htmlViewerRuntime.includes("querySelectorAll('iframe,img,video,audio,source')")
    || !htmlViewerRuntime.includes("kind === 'audio'")
  ) {
    throw new Error('expected exported HTML viewer runtime to preserve audio interactivity')
  }
}
