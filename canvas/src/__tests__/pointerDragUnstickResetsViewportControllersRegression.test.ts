import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testPointerDragUnstickResetsViewportControllersWhenActive() {
  const p = resolve(process.cwd(), '..', 'grph-shared', 'src', 'dom', 'pointerDrag.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('__kgViewportControllerDestroy')) {
    throw new Error('expected shared pointerDrag unstick handler to reset viewport controllers when recovering from a stuck drag')
  }
  if (!text.includes('querySelectorAll')) {
    throw new Error('expected shared pointerDrag unstick handler to scan interactive canvas elements for reset hooks')
  }
}
