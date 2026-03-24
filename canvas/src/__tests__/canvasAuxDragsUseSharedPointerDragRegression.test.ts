import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testMinimapDragUsesSharedPointerDrag() {
  const p = resolve(process.cwd(), 'src', 'features', 'minimap', 'Minimap.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('startPointerDrag')) throw new Error('expected minimap drag to use shared startPointerDrag')
  if (text.includes('.setPointerCapture(')) throw new Error('expected minimap not to call setPointerCapture directly')
  if (text.includes('.releasePointerCapture(')) throw new Error('expected minimap not to call releasePointerCapture directly')
}

export function testPreviewZoomPanViewportUsesSharedPointerDrag() {
  const p = resolve(process.cwd(), 'src', 'features', 'panels', 'views', 'preview-panel', 'ui', 'ZoomPanViewport.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('startPointerDrag')) throw new Error('expected preview ZoomPanViewport to use shared startPointerDrag')
  if (text.includes('.setPointerCapture(')) throw new Error('expected ZoomPanViewport not to call setPointerCapture directly')
  if (text.includes('.releasePointerCapture(')) throw new Error('expected ZoomPanViewport not to call releasePointerCapture directly')
}

export function testMermaidCodeblockPanUsesSharedPointerDrag() {
  const p = resolve(process.cwd(), 'src', 'features', 'panels', 'views', 'preview-panel', 'ui', 'MermaidDiagram.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('startPointerDrag')) throw new Error('expected Mermaid codeblock drag to use shared startPointerDrag')
  if (text.includes('.setPointerCapture(')) throw new Error('expected MermaidDiagram not to call setPointerCapture directly')
  if (text.includes('.releasePointerCapture(')) throw new Error('expected MermaidDiagram not to call releasePointerCapture directly')
}
