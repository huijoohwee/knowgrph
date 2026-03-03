import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testD3ZoomDoesNotSnapToFitToView() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'zoom.ts')
  const text = readFileSync(p, 'utf8')
  if (text.includes('snapToFitToView')) {
    throw new Error('expected D3 zoom not to snap-to-fit when zooming out at min scale')
  }
}

