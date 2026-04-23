import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphCanvasScrollLockIsScopedToActive() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('props.active === false')) {
    throw new Error('expected GraphCanvas wheel scroll-lock to be disabled when renderer is inactive')
  }
}

