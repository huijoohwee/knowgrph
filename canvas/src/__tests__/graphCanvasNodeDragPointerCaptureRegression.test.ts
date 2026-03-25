import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphCanvasDragSetsPointerCaptureAndHasFailsafePointerDown() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'drag.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('setPointerCapture')) {
    throw new Error('expected GraphCanvas drag to attempt pointer capture')
  }
  if (!text.includes("addEventListener('pointerdown'")) {
    throw new Error('expected GraphCanvas drag to install pointerdown failsafe')
  }
}

