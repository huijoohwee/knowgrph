import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorMinimapIsEnabled() {
  const p = resolve(process.cwd(), 'src', 'components', 'CanvasViewport.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('<MinimapLazy')) {
    throw new Error('expected CanvasViewport to render Minimap overlay in workspace variant')
  }
  if (!text.includes("canvas2dRenderer === 'flowEditor'")) {
    throw new Error('expected FlowEditor renderer to enable the Minimap overlay')
  }
}
