import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testThreeGroupResizeHasGlobalPointerFailsafe() {
  const p = resolve(process.cwd(), 'src', 'features', 'three', 'GroupOverlays.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('commitAndClearActiveResize')) {
    throw new Error('expected GroupOverlays3d to centralize active resize cleanup')
  }
  if (!text.includes("window.addEventListener('pointerup', onAnyEnd, { capture: true })")) {
    throw new Error('expected GroupOverlays3d resize failsafe to listen for pointerup in capture phase')
  }
  if (!text.includes("window.addEventListener('pointercancel', onAnyEnd, { capture: true })")) {
    throw new Error('expected GroupOverlays3d resize failsafe to listen for pointercancel in capture phase')
  }
  if (!text.includes("window.addEventListener('pointerdown', onAnyEnd, { capture: true })")) {
    throw new Error('expected GroupOverlays3d resize failsafe to recover on next pointerdown')
  }
}
