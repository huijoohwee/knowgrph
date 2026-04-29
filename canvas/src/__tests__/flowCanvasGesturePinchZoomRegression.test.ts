import * as d3 from 'd3'

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createSafariGestureZoomController } from '@/lib/canvas/safari-gesture-zoom'

export function testFlowCanvasHandlesSafariGesturePinchZoom() {
  const listenersPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'listeners.ts')
  const listenersText = readFileSync(listenersPath, 'utf8')
  if (!listenersText.includes("addEventListener('gesturestart'")) {
    throw new Error('expected FlowCanvas interactions to install a gesturestart capture handler')
  }
  if (!listenersText.includes("addEventListener('gesturechange'")) {
    throw new Error('expected FlowCanvas interactions to install a gesturechange capture handler')
  }
  if (!listenersText.includes("addEventListener('gestureend'")) {
    throw new Error('expected FlowCanvas interactions to install a gestureend capture handler')
  }

  const gesturePath = resolve(process.cwd(), 'src', 'lib', 'canvas', 'safari-gesture-zoom.ts')
  const gestureText = readFileSync(gesturePath, 'utf8')
  if (!gestureText.includes('computeAnchoredZoomTransform')) {
    throw new Error('expected Safari gesture zoom to use anchored zoom transform helper')
  }
  if (!gestureText.includes('resolveScaleExtentForInteractiveZoom')) {
    throw new Error('expected Safari gesture zoom to reuse shared interactive scale-extent expansion at zoom bounds')
  }

  let transform: d3.ZoomTransform = d3.zoomIdentity
  const controller = createSafariGestureZoomController({
    active: () => true,
    adapter: {
      getTransform: () => transform,
      setTransform: (t) => {
        transform = t
      },
    },
    getSchema: () => ({} as any),
    computeScaleExtent: () => ({ minK: 0.1, maxK: 10 }),
    readLocalPoint: (e) => ({ sx: (e as any).sx, sy: (e as any).sy, inBounds: true }),
    getBoundingRect: () => ({ left: 0, top: 0, width: 100, height: 100 } as any),
  })

  controller.handleGestureStart({ scale: 1, sx: 10, sy: 20, preventDefault() {} } as any)
  controller.handleGestureChange({ scale: 2, sx: 10, sy: 20, preventDefault() {} } as any)
  if (Math.abs(transform.k - 2) > 1e-9) {
    throw new Error(`expected k=2, got ${transform.k}`)
  }
  if (Math.abs(transform.x - -10) > 1e-9 || Math.abs(transform.y - -20) > 1e-9) {
    throw new Error(`expected x=-10,y=-20, got x=${transform.x},y=${transform.y}`)
  }

  let boundedTransform: d3.ZoomTransform = d3.zoomIdentity.scale(2)
  const bounded = createSafariGestureZoomController({
    active: () => true,
    adapter: {
      getTransform: () => boundedTransform,
      setTransform: (t) => {
        boundedTransform = t
      },
    },
    getSchema: () => ({} as any),
    computeScaleExtent: () => ({ minK: 0.5, maxK: 2 }),
    readLocalPoint: (e) => ({ sx: (e as any).sx, sy: (e as any).sy, inBounds: true }),
    getBoundingRect: () => ({ left: 0, top: 0, width: 100, height: 100 } as any),
  })
  bounded.handleGestureStart({ scale: 1, sx: 50, sy: 50, preventDefault() {} } as any)
  bounded.handleGestureChange({ scale: 2, sx: 50, sy: 50, preventDefault() {} } as any)
  if (!(boundedTransform.k > 2)) {
    throw new Error(`expected gesture zoom to expand past bounded max scale, got ${boundedTransform.k}`)
  }
}
