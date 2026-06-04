import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testMinimapAllowsViewportOutsideGraphBounds() {
  const p = resolve(process.cwd(), 'src', 'features', 'minimap', 'Minimap.tsx')
  const mathPath = resolve(process.cwd(), 'src', 'features', 'minimap', 'math.ts')
  const text = readFileSync(p, 'utf8')
  const mathText = readFileSync(mathPath, 'utf8')
  if (!text.includes('viewRectWorld') || !text.includes('unionMinimapBoundsWithRect(graphBounds, viewRectWorld)')) {
    throw new Error('expected minimap to union graph bounds with current viewport rect through the shared helper')
  }
  if (!mathText.includes('export const unionMinimapBoundsWithRect') || !mathText.includes('Math.min(bounds.minX, rect.x)') || !mathText.includes('Math.max(bounds.maxX, rect.x + rect.w)')) {
    throw new Error('expected minimap viewport bounds union to live in shared math utilities')
  }
  if (text.includes('Math.max(bounds.minX') && text.includes('bounds.maxX -')) {
    throw new Error('expected minimap viewport rect to not clamp into graph bounds')
  }
}
