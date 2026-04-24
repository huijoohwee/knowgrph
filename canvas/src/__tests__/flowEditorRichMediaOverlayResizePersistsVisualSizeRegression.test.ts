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
  if (!text.includes('isFlowEditorFrontmatterDocumentInteractionMode')) {
    throw new Error('expected FlowCanvas rich media overlay resize to be hard-gated by frontmatter document interaction mode')
  }
  if (!text.includes('const resizeInteractionActive = flowEditorFrontmatterInteractionMode')) {
    throw new Error('expected FlowCanvas rich media overlay resize-handle visibility to be mode-gated without fragile selection-state coupling')
  }
  if (!text.includes('isFlowEditorFrontmatterDocumentModeRequested')) {
    throw new Error('expected FlowCanvas rich media overlay resize to reuse shared frontmatter-document mode request gate SSOT')
  }
  if (!text.includes('phase=layout-override') || !text.includes('lastRichMediaResizeTrace')) {
    throw new Error('expected FlowCanvas rich media overlay resize path to publish strict live trace for resize lifecycle and layout override consumption')
  }
}
