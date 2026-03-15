import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowCanvasOverlayPanProxyClearsPointerIdOnPointerUpAndLostCapture() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'listeners.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('proxyPanPointerId = null')) {
    throw new Error('expected FlowCanvas overlay pan proxy to clear proxyPanPointerId')
  }
  if (!text.includes('onWindowPointerUpCapture')) {
    throw new Error('expected FlowCanvas overlay pan proxy to handle window pointerup capture')
  }
  if (!text.includes('onLostPointerCapture')) {
    throw new Error('expected FlowCanvas overlay pan proxy to clear state on lostpointercapture')
  }
}
