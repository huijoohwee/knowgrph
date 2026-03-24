import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testOverlayInteractions2dCancelsOnPointerDownAndVisibilityChange() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useOverlayInteractions2d.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes("'pointerdown'")) throw new Error('expected overlay interactions to listen for pointerdown')
  if (!text.includes("'visibilitychange'")) throw new Error('expected overlay interactions to listen for visibilitychange')
}

export function testOverlayInteractions2dHasWatchdogTimeout() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useOverlayInteractions2d.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('setTimeout(() =>')) {
    throw new Error('expected overlay interactions to include a watchdog timeout')
  }
}
