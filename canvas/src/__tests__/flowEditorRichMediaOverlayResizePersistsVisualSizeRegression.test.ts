import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorRichMediaOverlayResizePersistsVisualSize() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx')
  const sharedPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'shared.ts')
  const text = readFileSync(p, 'utf8')
  const sharedText = readFileSync(sharedPath, 'utf8')
  if (!text.includes("'visual:width'") || !text.includes("'visual:height'")) {
    throw new Error('expected FlowCanvas rich media overlay resize to write visual:width/visual:height')
  }
  if (!text.includes('store.updateNode?.(')) {
    throw new Error('expected FlowCanvas media overlays to persist rich media overlay size via store updateNode')
  }
  if (!text.includes('graphData')) {
    throw new Error('expected FlowCanvas rich media overlay resize to merge from store graphData (avoid overwriting required props)')
  }
  if (!sharedText.includes('resizeActive: rendererInteractionMode && args.workspaceMutationBlocked !== true')) {
    throw new Error('expected FlowCanvas rich media overlay resize to stay blocked by shared workspace mutation policy')
  }
  if (!text.includes('const resizeHandleVisible = resizeInteractionActive && (isSelected || canvas2dRenderer === \'flowCanvas\')')) {
    throw new Error('expected FlowCanvas rich media overlay resize-handle visibility to stay mode/policy gated without selection-state-only coupling')
  }
  if (!text.includes('isFlowEditorFrontmatterDocumentModeRequested')) {
    throw new Error('expected FlowCanvas rich media overlay resize to reuse shared frontmatter-document mode request gate SSOT')
  }
  if (!text.includes('phase=layout-override') || !text.includes('lastRichMediaResizeTrace')) {
    throw new Error('expected FlowCanvas rich media overlay resize path to publish strict live trace for resize lifecycle and layout override consumption')
  }
}
