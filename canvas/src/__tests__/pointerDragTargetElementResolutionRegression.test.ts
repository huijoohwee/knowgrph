import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testPointerDragResolvesElementTargetFromComposedPath() {
  const p = resolve(process.cwd(), '..', 'grph-shared', 'src', 'dom', 'pointerDrag.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('composedPath')) {
    throw new Error('expected shared pointerDrag to resolve target element via composedPath when needed')
  }
  if (!text.includes('direct instanceof Element')) {
    throw new Error('expected shared pointerDrag to prefer direct Element target when available')
  }
}
