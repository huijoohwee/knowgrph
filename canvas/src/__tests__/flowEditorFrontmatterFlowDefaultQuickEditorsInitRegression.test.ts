import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorFrontmatterFlowDefaultsUnpinnedAndCenteredLayout() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(p, 'utf8')

  if (!text.includes("seededFrontmatterAutoQuickEditorsKeyRef")) {
    throw new Error('expected FlowEditorCanvas to seed default frontmatter-flow quick editor pin state')
  }
  if (!text.includes('setFlowNodeQuickEditorPinnedByNodeId')) {
    throw new Error('expected FlowEditorCanvas to write unpinned quick editor defaults into store')
  }
  if (!text.includes('overlayViewport.width * 0.1') || !text.includes('overlayViewport.height * 0.1')) {
    throw new Error('expected FlowEditorCanvas to reserve ~20% blank viewport space for default layout')
  }
  if (!text.includes('dockLeft = marginLeft + Math.max(0, Math.floor((usableW - usedW) / 2))')) {
    throw new Error('expected FlowEditorCanvas to center the default spread layout within blank margins')
  }
}

