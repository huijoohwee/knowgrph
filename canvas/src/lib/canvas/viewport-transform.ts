import * as d3 from 'd3'

export type ScaleExtent = { minK: number; maxK: number }

export function safeScaleExtent(scaleExtent: ScaleExtent): ScaleExtent {
  const minK = Number.isFinite(scaleExtent.minK) ? scaleExtent.minK : 0.05
  const maxK = Number.isFinite(scaleExtent.maxK) ? scaleExtent.maxK : 8
  const lo = Math.max(0.001, Math.min(minK, maxK))
  const hi = Math.max(lo, maxK)
  return { minK: lo, maxK: hi }
}

export function clampScale(k: number, extent: ScaleExtent): number {
  const { minK, maxK } = safeScaleExtent(extent)
  const kk = Number.isFinite(k) ? k : 1
  return Math.max(minK, Math.min(maxK, kk))
}

export function computeAnchoredZoomTransform(args: {
  transform: d3.ZoomTransform
  anchor: { sx: number; sy: number }
  nextK: number
}): d3.ZoomTransform {
  const t0 = args.transform || d3.zoomIdentity
  const nextK = Number.isFinite(args.nextK) ? args.nextK : t0.k
  const sx = Number.isFinite(args.anchor.sx) ? args.anchor.sx : 0
  const sy = Number.isFinite(args.anchor.sy) ? args.anchor.sy : 0
  const wx = (sx - t0.x) / t0.k
  const wy = (sy - t0.y) / t0.k
  const nextX = sx - wx * nextK
  const nextY = sy - wy * nextK
  return d3.zoomIdentity.translate(nextX, nextY).scale(nextK)
}

export function computePinchZoomTransform(args: {
  startTransform: d3.ZoomTransform
  startA: { sx: number; sy: number }
  startB: { sx: number; sy: number }
  curA: { sx: number; sy: number }
  curB: { sx: number; sy: number }
  scaleExtent: ScaleExtent
  zoomExponentMultiplier?: number
}): d3.ZoomTransform {
  const t0 = args.startTransform || d3.zoomIdentity
  const startMidSx = (args.startA.sx + args.startB.sx) / 2
  const startMidSy = (args.startA.sy + args.startB.sy) / 2
  const curMidSx = (args.curA.sx + args.curB.sx) / 2
  const curMidSy = (args.curA.sy + args.curB.sy) / 2

  const startDx = args.startA.sx - args.startB.sx
  const startDy = args.startA.sy - args.startB.sy
  const curDx = args.curA.sx - args.curB.sx
  const curDy = args.curA.sy - args.curB.sy
  const startDist = Math.max(1e-6, Math.hypot(startDx, startDy))
  const curDist = Math.max(1e-6, Math.hypot(curDx, curDy))
  const ratio = curDist / startDist
  const m = Number.isFinite(args.zoomExponentMultiplier) ? (args.zoomExponentMultiplier as number) : 1
  const safeM = Math.max(0.01, m)
  const nextKRaw = t0.k * Math.pow(ratio, safeM)
  const nextK = clampScale(nextKRaw, args.scaleExtent)

  const midWorldX = (startMidSx - t0.x) / t0.k
  const midWorldY = (startMidSy - t0.y) / t0.k
  const nextX = curMidSx - midWorldX * nextK
  const nextY = curMidSy - midWorldY * nextK
  return d3.zoomIdentity.translate(nextX, nextY).scale(nextK)
}
