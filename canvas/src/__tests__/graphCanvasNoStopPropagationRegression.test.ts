import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphCanvasDoesNotBlockWheelPropagation() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvas.tsx')
  const text = readFileSync(p, 'utf8')

  if (!text.includes("addEventListener('wheel'")) {
    throw new Error('expected GraphCanvas to install capture wheel listener to prevent page scroll')
  }
  if (!text.includes('passive: false') || !text.includes('capture: true')) {
    throw new Error('expected GraphCanvas to use non-passive capture listeners')
  }
  if (text.includes('stopPropagation')) {
    throw new Error('expected GraphCanvas scroll-lock listeners to not call stopPropagation (it blocks zoom handlers)')
  }
}

