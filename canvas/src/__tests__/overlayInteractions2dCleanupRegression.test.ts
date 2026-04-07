import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testOverlayInteractions2dCleanupCancelsActiveDrags() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useOverlayInteractions2d.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('return () =>') || !text.includes('cancelAllInteractions()')) {
    throw new Error('expected useOverlayInteractions2d cleanup to cancel active interactions')
  }
}
