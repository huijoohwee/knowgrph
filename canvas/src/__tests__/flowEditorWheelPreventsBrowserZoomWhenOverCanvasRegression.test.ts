import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorWheelPreventsBrowserZoomWhenOverCanvas() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'bindNativeInteractions.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('onWindowWheelCapture')) {
    throw new Error('expected FlowCanvas to install a window wheel capture handler')
  }
  if (!text.includes('elementFromPoint')) {
    throw new Error('expected FlowEditor to use elementFromPoint fallback to route wheel to canvas and prevent page zoom')
  }
  if (!text.includes('handleWheel(e, { skipIgnoreGuard: true })')) {
    throw new Error('expected FlowEditor to route wheel gestures over the canvas through handleWheel with skipIgnoreGuard')
  }
}
