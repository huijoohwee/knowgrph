import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testToolMenuDragUsesSharedPointerDrag() {
  const p = resolve(process.cwd(), 'src', 'features', 'toolbar', 'useToolMenuState.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('startPointerDrag')) throw new Error('expected tool menu drag to use shared startPointerDrag')
  if (text.includes("window.addEventListener('pointermove'")) throw new Error('expected tool menu drag to avoid manual window pointermove listeners')
  if (text.includes("window.addEventListener('pointerup'")) throw new Error('expected tool menu drag to avoid manual window pointerup listeners')
}

export function testSpotlightCardDragUsesSharedPointerDrag() {
  const p = resolve(process.cwd(), 'src', 'features', 'spotlight', 'useSpotlightAnchor.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('startPointerDrag')) throw new Error('expected spotlight card drag to use shared startPointerDrag')
  if (text.includes("window.addEventListener('pointermove'")) throw new Error('expected spotlight drag to avoid manual window pointermove listeners')
  if (text.includes("window.addEventListener('pointerup'")) throw new Error('expected spotlight drag to avoid manual window pointerup listeners')
}
