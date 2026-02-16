import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testPointerDragCallsOnCancelOnLostPointerCapture() {
  const p = resolve(process.cwd(), '..', 'grph-shared', 'src', 'dom', 'pointerDrag.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('lostpointercapture')) {
    throw new Error('expected shared pointerDrag to handle lostpointercapture')
  }
  if (!text.includes('onCancel?.(')) {
    throw new Error('expected shared pointerDrag to call onCancel on lostpointercapture')
  }
}

