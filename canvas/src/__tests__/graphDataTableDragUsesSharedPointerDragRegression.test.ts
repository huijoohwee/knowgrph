import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphDataTableDoesNotInstallGlobalMouseDragListeners() {
  const p = resolve(process.cwd(), 'src', 'lib', 'graph-data-table', 'ui', 'GraphDataTableTable.impl.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes("startPointerDrag")) throw new Error('expected GraphDataTableTable to use shared startPointerDrag')
  if (text.includes("window.addEventListener('mousemove'")) throw new Error('expected GraphDataTableTable to avoid global mousemove listeners')
  if (text.includes("window.addEventListener('mouseup'")) throw new Error('expected GraphDataTableTable to avoid global mouseup listeners')
  if (text.includes("window.addEventListener('pointermove'")) throw new Error('expected GraphDataTableTable to avoid custom global pointermove listeners')
}

export function testFrozenAreaDragUsesSharedPointerDrag() {
  const p = resolve(process.cwd(), 'src', 'features', 'graph-data-table', 'ui', 'useGraphDataTableFrozenArea.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes("startPointerDrag")) throw new Error('expected frozen area drag to use shared startPointerDrag')
  if (text.includes("window.addEventListener('mousemove'")) throw new Error('expected frozen area drag to avoid mousemove listeners')
  if (text.includes("window.addEventListener('mouseup'")) throw new Error('expected frozen area drag to avoid mouseup listeners')
}
