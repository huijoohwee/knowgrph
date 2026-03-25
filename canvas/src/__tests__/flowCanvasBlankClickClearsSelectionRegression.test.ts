import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowCanvasBlankPointerDownClearsSelection() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'pointerDown.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('state.selectNode(null)')) {
    throw new Error('expected FlowCanvas blank pointerdown to clear selected node')
  }
  if (!text.includes('state.selectEdge(null)')) {
    throw new Error('expected FlowCanvas blank pointerdown to clear selected edge')
  }
  if (!text.includes('state.selectGroup(null)')) {
    throw new Error('expected FlowCanvas blank pointerdown to clear selected group')
  }
  if (!text.includes('e.button === 0')) {
    throw new Error('expected FlowCanvas blank pointerdown selection clear to be gated on primary button')
  }
}

