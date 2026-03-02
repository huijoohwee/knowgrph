import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorDoesNotDisableCanvasNodeDragWhenEditorsPinned() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  if (text.includes('allowNodeDragOverride={anyEditorPinnedToNode ? false : undefined}')) {
    throw new Error('expected FlowEditorCanvas to avoid disabling node drag while quick editors are pinned')
  }
}
