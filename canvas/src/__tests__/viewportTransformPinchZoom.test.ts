import * as d3 from 'd3'

import { computePinchZoomTransform } from '@/lib/canvas/viewport-transform'

export function testViewportPinchZoomTransformKeepsWorldMidAnchored() {
  const t0 = d3.zoomIdentity.translate(0, 0).scale(1)
  const next = computePinchZoomTransform({
    startTransform: t0,
    startA: { sx: 0, sy: 50 },
    startB: { sx: 100, sy: 50 },
    curA: { sx: -50, sy: 50 },
    curB: { sx: 150, sy: 50 },
    scaleExtent: { minK: 0.05, maxK: 8 },
  })
  if (Math.abs(next.k - 2) > 1e-9) throw new Error(`expected k=2, got ${next.k}`)
  if (Math.abs(next.x - -50) > 1e-6) throw new Error(`expected x=-50, got ${next.x}`)
  if (Math.abs(next.y - -50) > 1e-6) throw new Error(`expected y=-50, got ${next.y}`)
}

export function testViewportPinchZoomTransformAllowsPanWhilePinching() {
  const t0 = d3.zoomIdentity.translate(0, 0).scale(1)
  const next = computePinchZoomTransform({
    startTransform: t0,
    startA: { sx: 0, sy: 50 },
    startB: { sx: 100, sy: 50 },
    curA: { sx: -40, sy: 50 },
    curB: { sx: 160, sy: 50 },
    scaleExtent: { minK: 0.05, maxK: 8 },
  })
  if (Math.abs(next.k - 2) > 1e-9) throw new Error(`expected k=2, got ${next.k}`)
  if (Math.abs(next.x - -40) > 1e-6) throw new Error(`expected x=-40, got ${next.x}`)
}

export function testViewportPinchZoomTransformClampsScaleExtent() {
  const t0 = d3.zoomIdentity.translate(0, 0).scale(1)
  const next = computePinchZoomTransform({
    startTransform: t0,
    startA: { sx: 0, sy: 0 },
    startB: { sx: 10, sy: 0 },
    curA: { sx: 0, sy: 0 },
    curB: { sx: 10_000, sy: 0 },
    scaleExtent: { minK: 0.1, maxK: 3 },
  })
  if (Math.abs(next.k - 3) > 1e-9) throw new Error(`expected k clamped to 3, got ${next.k}`)
}

export function testViewportPinchZoomTransformRespectsZoomExponentMultiplier() {
  const t0 = d3.zoomIdentity.translate(0, 0).scale(1)
  const next = computePinchZoomTransform({
    startTransform: t0,
    startA: { sx: 0, sy: 50 },
    startB: { sx: 100, sy: 50 },
    curA: { sx: -50, sy: 50 },
    curB: { sx: 150, sy: 50 },
    scaleExtent: { minK: 0.05, maxK: 8 },
    zoomExponentMultiplier: 2,
  })
  if (Math.abs(next.k - 4) > 1e-9) throw new Error(`expected k=4, got ${next.k}`)
}
