import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowCanvasResizeMarksDirtySoCanvasDoesNotGoBlank() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('if (resized) runtime.dirty = true')) {
    throw new Error('expected FlowCanvas to mark runtime.dirty on canvas resize so requestFlowNativeDraw repaints after width/height reset')
  }
}

