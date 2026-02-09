import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testCanvasZoomDoesNotAllowPageScroll() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes("addEventListener('wheel'")) {
    throw new Error('expected GraphCanvas to install a wheel listener to prevent page scroll')
  }
  if (!text.includes('passive: false')) {
    throw new Error('expected GraphCanvas wheel listener to be non-passive')
  }
  if (!text.includes('CANVAS_INTERACTIVE_CLASS')) {
    throw new Error('expected GraphCanvas SVG to use CANVAS_INTERACTIVE_CLASS (touch-none)')
  }
}

