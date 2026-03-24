import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testThreeGraphHasOverlayDragGlobalFailsafe() {
  const p = resolve(process.cwd(), 'src', 'features', 'three', 'ThreeGraph.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('overlayHeaderDrag3dRef')) {
    throw new Error('expected ThreeGraph to track overlay 3d header drag state')
  }
  if (!text.includes("window.addEventListener('pointerup', onAnyEnd, { capture: true })")) {
    throw new Error('expected ThreeGraph overlay drag failsafe to listen for pointerup in capture phase')
  }
  if (!text.includes("window.addEventListener('pointercancel', onAnyEnd, { capture: true })")) {
    throw new Error('expected ThreeGraph overlay drag failsafe to listen for pointercancel in capture phase')
  }
  if (!text.includes("window.addEventListener('pointerdown', onAnyEnd, { capture: true })")) {
    throw new Error('expected ThreeGraph overlay drag failsafe to recover on next pointerdown')
  }
  if (!text.includes('window.setInterval(() => {')) {
    throw new Error('expected ThreeGraph overlay drag failsafe to include a watchdog interval')
  }
}
