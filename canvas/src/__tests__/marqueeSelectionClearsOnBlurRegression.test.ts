import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testMarqueeSelectionHasGlobalCancelFailsafe() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useMarqueeSelection2d.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes("window.addEventListener('pointerup'")) throw new Error('expected marquee selection to listen for pointerup')
  if (!text.includes("window.addEventListener('blur'")) throw new Error('expected marquee selection to cancel on blur')
  if (!text.includes("document.addEventListener('visibilitychange'")) throw new Error('expected marquee selection to cancel on visibilitychange')
  if (!text.includes('setTimeout(end, 12000')) throw new Error('expected marquee selection to include a watchdog timeout')
}
