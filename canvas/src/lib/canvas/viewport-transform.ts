import * as d3 from 'd3'

import { clampScale, safeScaleExtent, type ScaleExtent } from '@/lib/zoom/scaleExtent'
import { screenToWorld } from '@/lib/zoom/viewport'

export type { ScaleExtent }

export { safeScaleExtent, clampScale }

export function computeAnchoredZoomTransform(args: {
  transform: d3.ZoomTransform
  anchor: { sx: number; sy: number }
  nextK: number
}): d3.ZoomTransform {
  const t0 = args.transform || d3.zoomIdentity
  const nextK = Number.isFinite(args.nextK) ? args.nextK : t0.k
  const sx = Number.isFinite(args.anchor.sx) ? args.anchor.sx : 0
  const sy = Number.isFinite(args.anchor.sy) ? args.anchor.sy : 0
  const world = screenToWorld({ transform: t0, sx, sy })
  const nextX = sx - world.x * nextK
  const nextY = sy - world.y * nextK
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

  const midWorld = screenToWorld({ transform: t0, sx: startMidSx, sy: startMidSy })
  const nextX = curMidSx - midWorld.x * nextK
  const nextY = curMidSy - midWorld.y * nextK
  return d3.zoomIdentity.translate(nextX, nextY).scale(nextK)
}

export function invertZoomPoint(transform: d3.ZoomTransform, p: { sx: number; sy: number }): { x: number; y: number } {
  const sx = Number.isFinite(p.sx) ? p.sx : 0
  const sy = Number.isFinite(p.sy) ? p.sy : 0
  return screenToWorld({ transform: transform || d3.zoomIdentity, sx, sy })
}
