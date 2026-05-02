import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphHoverTooltipIsNonInteractiveByDefault() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphHoverTooltip.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('tooltipInteractive = false')) {
    throw new Error('expected GraphHoverTooltip default to be non-interactive to avoid blocking canvas')
  }
}

export function testGraphCanvasRootDisablesHoverTooltipInteractivity() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'GraphCanvasRootImpl.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('tooltipInteractive={false}')) {
    throw new Error('expected GraphCanvasRoot to pass tooltipInteractive={false} to GraphHoverTooltip')
  }
}

export function testGraphHoverTooltipUsesCanonicalImageKeysOnly() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphHoverTooltip.tsx')
  const text = readFileSync(p, 'utf8')
  const requiredSnippets = [
    "getNodeImagePreviewUrls } from '@/components/GraphCanvas/helpers'",
    'const urls = getNodeImagePreviewUrls(node)',
  ]
  for (const snippet of requiredSnippets) {
    if (!text.includes(snippet)) {
      throw new Error(`expected GraphHoverTooltip to use shared image preview helper snippet: ${snippet}`)
    }
  }
  const forbiddenSnippets = [
    'mdImagesJson',
    'rec.images',
    'rec.imageUrls',
    'rec.mediaUrls',
    'rec.imageUrl',
    'rec.mediaUrl',
    'rec.image_urls',
    'rec.image_url',
    'rec.thumbnail_url',
    'rec.thumbnail',
    'rec.thumbnails',
    'rec.hero_image',
    'function collectImageUrls',
  ]
  for (const snippet of forbiddenSnippets) {
    if (text.includes(snippet)) {
      throw new Error(`expected GraphHoverTooltip to remove legacy image reader snippet: ${snippet}`)
    }
  }
}
