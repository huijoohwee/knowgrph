import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowCanvasHandlesSafariGesturePinchZoom() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'bindNativeInteractions.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes("addEventListener('gesturestart'")) {
    throw new Error('expected FlowCanvas interactions to install a gesturestart capture handler')
  }
  if (!text.includes("addEventListener('gesturechange'")) {
    throw new Error('expected FlowCanvas interactions to install a gesturechange capture handler')
  }
  if (!text.includes("addEventListener('gestureend'")) {
    throw new Error('expected FlowCanvas interactions to install a gestureend capture handler')
  }
  if (!text.includes('computeAnchoredZoomTransform')) {
    throw new Error('expected gesture pinch zoom to use anchored zoom transform helper')
  }
}

