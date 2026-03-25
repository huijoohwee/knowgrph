import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphCanvasRootGraphBlockPanelDoesNotDropNodesWithoutPositions() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'GraphCanvasRootImpl.tsx')
  const text = readFileSync(p, 'utf8')
  if (text.includes('if (x == null || y == null) continue')) {
    throw new Error('expected GraphCanvasRoot graphBlockPanel to not drop blocks when x/y missing')
  }
  if (!text.includes('?? -99999')) {
    throw new Error('expected GraphCanvasRoot graphBlockPanel to use offscreen fallback for missing positions')
  }
}

