import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testStoryboardWidgetScreenAuthorityPanPreservesTranslateScaleTransforms() {
  const text = readFileSync(resolve(process.cwd(), 'src', 'lib', 'storyboardWidget', 'screenAuthorityCollectivePan.ts'), 'utf8')
  if (!text.includes('const scaleFunction = transform.match')
    || !text.includes('scale\\(\\s*([-0-9.]+)\\s*\\)')
    || !text.includes('const scale = readOverlayTransformScale(el)')
    || !text.includes('el.style.transform = `matrix(${scale}, 0, 0, ${scale}, ${pos.left}, ${pos.top})`')) {
    throw new Error('expected Storyboard Widget collective pan to preserve translate3d(... scale(...)) overlay scale while updating position')
  }
}
