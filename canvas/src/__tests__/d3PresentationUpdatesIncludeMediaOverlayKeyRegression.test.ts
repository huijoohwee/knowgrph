import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testD3PresentationUpdatesKeyIncludesMediaOverlayIds() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useD3PresentationUpdates2d.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('mediaOverlayNodeIdsKey')) {
    throw new Error('expected useD3PresentationUpdates2d to compute mediaOverlayNodeIdsKey')
  }
  if (!text.includes('${panelOnlyNodeIdsKey}|${mediaOverlayNodeIdsKey}|')) {
    throw new Error('expected presentation applied key to include media overlay ids')
  }
}

