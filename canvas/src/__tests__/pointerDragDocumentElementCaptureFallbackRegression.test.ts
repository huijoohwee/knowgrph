import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testPointerDragFallsBackToDocumentElementForPointerCapture() {
  const p = resolve(process.cwd(), '..', 'grph-shared', 'src', 'dom', 'pointerDrag.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('docEl.setPointerCapture')) {
    throw new Error('expected shared pointerDrag to attempt pointer capture on documentElement as a fallback')
  }
}
