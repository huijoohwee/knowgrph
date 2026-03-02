import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testMinimapAllowsViewportOutsideGraphBounds() {
  const p = resolve(process.cwd(), 'src', 'features', 'minimap', 'Minimap.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('viewRectWorld') || !text.includes('Math.min(graphBounds.minX') || !text.includes('Math.max(graphBounds.maxX')) {
    throw new Error('expected minimap to union graph bounds with current viewport rect for infinite canvas')
  }
  if (text.includes('Math.max(bounds.minX') && text.includes('bounds.maxX -')) {
    throw new Error('expected minimap viewport rect to not clamp into graph bounds')
  }
}
