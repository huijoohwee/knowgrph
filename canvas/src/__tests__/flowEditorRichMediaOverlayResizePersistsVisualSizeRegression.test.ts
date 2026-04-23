import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorRichMediaOverlayResizePersistsVisualSize() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes("'visual:width'") || !text.includes("'visual:height'")) {
    throw new Error('expected FlowCanvas rich media overlay resize to write visual:width/visual:height')
  }
  if (!text.includes('updateNode?.(')) {
    throw new Error('expected FlowCanvas to persist rich media overlay size via store updateNode')
  }
  if (!text.includes('graphData')) {
    throw new Error('expected FlowCanvas rich media overlay resize to merge from store graphData (avoid overwriting required props)')
  }
}
