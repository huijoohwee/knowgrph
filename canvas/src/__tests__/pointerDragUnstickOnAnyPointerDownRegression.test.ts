import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testPointerDragUnsticksOnAnyPointerDown() {
  const p = resolve(process.cwd(), '..', 'grph-shared', 'src', 'dom', 'pointerDrag.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes("'pointerdown'")) throw new Error('expected shared pointerDrag to listen for pointerdown')
  if (!text.includes('__kgPointerDragUnstickInstalled')) {
    throw new Error('expected shared pointerDrag to install an unstick handler once')
  }
  if (text.includes('isCanvas')) {
    throw new Error('expected shared pointerDrag to unstick without requiring a canvas target')
  }
  if (!text.includes('map.clear()')) {
    throw new Error('expected pointerdown unstick handler to clear active drags')
  }
}

export function testPointerDragHasWatchdogTimeout() {
  const p = resolve(process.cwd(), '..', 'grph-shared', 'src', 'dom', 'pointerDrag.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('watchdog')) {
    throw new Error('expected shared pointerDrag to include a watchdog for stuck drags')
  }
  if (!text.includes('window.setTimeout')) {
    throw new Error('expected shared pointerDrag to use a timeout watchdog')
  }
}
