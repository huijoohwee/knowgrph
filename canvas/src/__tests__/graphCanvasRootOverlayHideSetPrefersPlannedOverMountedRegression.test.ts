import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphCanvasRootPrefersPlannedOverlayHideSet() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'GraphCanvasRootImpl.tsx')
  const text = readFileSync(p, 'utf8')
  if (text.includes('mediaOverlayHideNodeIdSet || richMedia.mediaOverlayNodeIdSet')) {
    throw new Error('expected GraphCanvasRoot to not prefer mounted-only overlay hide set')
  }
  if (!text.includes('mediaOverlayNodeIdSet: richMedia.mediaOverlayNodeIdSet')) {
    throw new Error('expected GraphCanvasRoot to pass planned overlay node id set to the scene')
  }
}

