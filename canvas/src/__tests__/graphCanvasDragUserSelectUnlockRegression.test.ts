import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphCanvasNodeDragDoesNotLeakUserSelectLockWhenSpacePanHeld() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'drag.ts')
  const text = readFileSync(p, 'utf8')
  const endIdx = text.indexOf(".on('end'")
  if (endIdx < 0) throw new Error('expected GraphCanvas node drag behavior to define an end handler')
  const snippet = text.slice(endIdx, Math.min(text.length, endIdx + 500))
  if (snippet.includes('if (isSpacePanHeld()) return')) {
    throw new Error('expected GraphCanvas node drag end handler to always perform cleanup (no early return)')
  }
  if (!snippet.includes('unlockGlobalUserSelect')) {
    throw new Error('expected GraphCanvas node drag end handler to unlock global user-select')
  }
}

