import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testStoryboardWidgetScreenAuthorityPanUsesVectorPaintedDom() {
  const text = readFileSync(resolve(process.cwd(), 'src', 'lib', 'storyboardWidget', 'screenAuthorityCollectivePan.ts'), 'utf8')
  for (const snippet of [
    "from '@/lib/canvas/vectorPaintedOverlayProjection'",
    'readVectorPaintedOverlayPosition(root)',
    'applyVectorPaintedOverlayPosition(root, next)',
  ]) {
    if (!text.includes(snippet)) {
      throw new Error(`expected Storyboard Widget collective pan to reuse vector-painted DOM projection: ${snippet}`)
    }
  }
  for (const stale of [
    'readOverlayTransformScale',
    'const scaleFunction = transform.match',
    'scale\\(\\s*([-0-9.]+)\\s*\\)',
    'el.style.transform = `matrix',
    'translate3d',
  ]) {
    if (text.includes(stale)) {
      throw new Error(`expected Storyboard Widget collective pan not to preserve transform-scaled raster projection: ${stale}`)
    }
  }
}
