import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testD3GraphSceneBuildKeyIncludesOverlayKeys() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useD3GraphScene2d.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('mediaOverlayNodeIdsKey')) {
    throw new Error('expected useD3GraphScene2d to receive mediaOverlayNodeIdsKey')
  }
  if (!text.includes('panelOnlyNodeIdsKey')) {
    throw new Error('expected useD3GraphScene2d to include panelOnlyNodeIdsKey in build key')
  }
  if (!text.includes('mediaOverlayNodeIdsKey,')) {
    throw new Error('expected useD3GraphScene2d build key to incorporate mediaOverlayNodeIdsKey')
  }
}

