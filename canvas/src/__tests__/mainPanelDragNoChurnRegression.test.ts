import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testMainPanelDragUsesSharedPointerDragAndRaf() {
  const p = resolve(process.cwd(), 'src', 'features', 'toolbar', 'hooks', 'useMainPanelDrag.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('startPointerDrag')) throw new Error('expected main panel drag to use shared startPointerDrag')
  if (!text.includes('requestAnimationFrame')) throw new Error('expected main panel drag to batch updates with requestAnimationFrame')
}
