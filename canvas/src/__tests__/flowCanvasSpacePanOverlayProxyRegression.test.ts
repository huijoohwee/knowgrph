import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowCanvasSpacePanCanStartFromOverlay() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'bindNativeInteractions.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('onWindowPointerDownCapture')) {
    throw new Error('expected FlowCanvas to install a window pointerdown capture handler for overlay space-pan')
  }
  if (!text.includes('[data-kg-node-quick-editor]') && !text.includes('flow-editor-overlay-proxy')) {
    throw new Error('expected FlowCanvas overlay space-pan proxy to target node quick editor overlays (direct selector or shared proxy helper)')
  }
  if (!text.includes('shouldAllowPanDragForPointerEvent')) {
    throw new Error('expected FlowCanvas overlay pan proxy to reuse viewport pan gating SSOT')
  }
  if (!text.includes('capture: true')) {
    throw new Error('expected FlowCanvas overlay space-pan proxy listeners to use capture')
  }
}
