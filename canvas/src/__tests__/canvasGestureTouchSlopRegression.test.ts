import * as d3 from 'd3'
import { createInfiniteCanvasViewportController } from '@/lib/canvas/infinite-canvas-engine/controller'

function createControllerHarness() {
  let transform = d3.zoomIdentity
  let lockCount = 0
  let unlockCount = 0
  let capturedPointerId: number | null = null

  const controller = createInfiniteCanvasViewportController({
    active: () => true,
    adapter: {
      getTransform: () => transform,
      setTransform: (next) => {
        transform = next
      },
    },
    getSchema: () => ({}) as never,
    getPreset: () => 'map',
    getPointerMode2d: () => 'pan',
    getWheelZoomCtrlMetaBoostMultiplier: () => 1,
    getCanvasPanSpeedMultiplier: () => 1,
    getCanvasInteractionSpeedMultiplier: () => 1,
    getFlowWheelZoomSpeedMultiplier: () => 1,
    getFlowWheelZoomIncrementMultiplier: () => 1,
    getFlowWheelZoomSmoothDuration: () => ({ minMs: 0, maxMs: 0 }),
    isSpacePanHeld: () => false,
    shouldIgnorePointerTarget: () => false,
    shouldIgnoreWheelEvent: () => false,
    lockUserSelect: () => {
      lockCount += 1
    },
    unlockUserSelect: () => {
      unlockCount += 1
    },
    disableAutoZoomModes: () => void 0,
    getWheelAnchorFallback: () => null,
    setWheelAnchorFallback: () => void 0,
    readLocalPoint: (e) => ({
      sx: Number(e.clientX || 0),
      sy: Number(e.clientY || 0),
      inBounds: true,
    }),
    getBoundingRect: () => new DOMRect(0, 0, 800, 600),
    pointerCapture: {
      setPointerCapture: (pointerId) => {
        capturedPointerId = pointerId
      },
      releasePointerCapture: (pointerId) => {
        if (capturedPointerId === pointerId) capturedPointerId = null
      },
      hasPointerCapture: (pointerId) => capturedPointerId === pointerId,
    },
    raf: {
      request: () => 1,
      cancel: () => void 0,
      now: () => 0,
    },
  })

  return {
    controller,
    getTransform: () => transform,
    getLockCount: () => lockCount,
    getUnlockCount: () => unlockCount,
  }
}

function makePointerEvent(args: { pointerId: number; pointerType: 'touch' | 'mouse' | 'pen'; clientX: number; clientY: number; buttons?: number }) {
  return {
    pointerId: args.pointerId,
    pointerType: args.pointerType,
    clientX: args.clientX,
    clientY: args.clientY,
    button: 0,
    buttons: args.buttons ?? 1,
    shiftKey: false,
    target: null,
    preventDefault: () => void 0,
  } as unknown as PointerEvent
}

export function testTouchPanSlopBlocksTinyViewportDrift() {
  const h = createControllerHarness()
  h.controller.handlePointerDown(makePointerEvent({ pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 }))
  h.controller.handlePointerMove(makePointerEvent({ pointerId: 1, pointerType: 'touch', clientX: 105, clientY: 104 }))
  const t = h.getTransform()
  if (Math.abs(t.x) > 1e-6 || Math.abs(t.y) > 1e-6) {
    throw new Error('expected touch pan slop to block viewport movement before the drag intent is clear')
  }
  h.controller.handlePointerUp(makePointerEvent({ pointerId: 1, pointerType: 'touch', clientX: 105, clientY: 104, buttons: 0 }))
  if (h.getLockCount() < 1 || h.getUnlockCount() < 1) {
    throw new Error('expected touch pan cleanup to preserve the existing user-select lock lifecycle')
  }
}

export function testTouchPanSlopStillAllowsIntentionalPan() {
  const h = createControllerHarness()
  h.controller.handlePointerDown(makePointerEvent({ pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 }))
  h.controller.handlePointerMove(makePointerEvent({ pointerId: 1, pointerType: 'touch', clientX: 112, clientY: 109 }))
  const t = h.getTransform()
  if (!(Math.abs(t.x - 12) < 1e-6) || !(Math.abs(t.y - 9) < 1e-6)) {
    throw new Error('expected touch pan slop to preserve intentional viewport panning after the threshold is crossed')
  }
}
