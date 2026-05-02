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
      id: 'iframe',
      type: 'IFrame',
      label: 'IFrame',
      properties: { iframe_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
    },
  ] as Parameters<typeof buildNodeMediaInventory>[0])

  if (inventory.totalCount !== 4) throw new Error(`expected 4 media nodes, got ${inventory.totalCount}`)
  if (inventory.imageCount !== 1) throw new Error(`expected 1 image node, got ${inventory.imageCount}`)
  if (inventory.svgCount !== 1) throw new Error(`expected 1 svg node, got ${inventory.svgCount}`)
  if (inventory.imageLikeCount !== 2) throw new Error(`expected 2 image-like nodes, got ${inventory.imageLikeCount}`)
  if (inventory.videoCount !== 1) throw new Error(`expected 1 video node, got ${inventory.videoCount}`)
  if (inventory.iframeCount !== 1) throw new Error(`expected 1 iframe node, got ${inventory.iframeCount}`)
  if (inventory.rows.length !== 4) throw new Error(`expected 4 listed rows, got ${inventory.rows.length}`)
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
  if (text.includes('let iframeCount = 0')) {
    throw new Error('expected useRichMediaOverlays2d to remove duplicated local media counters')
  }
}
