import * as d3 from 'd3'

import { clampScale } from '@/lib/canvas/viewport-transform'

export function computeZoomToBoundsTransform(args: {
  bounds: { x: number; y: number; w: number; h: number }
  viewportW: number
  viewportH: number
  scaleExtent: { minK: number; maxK: number }
  insetPx?: number
  origin?: { x: number; y: number }
  minBoundsSizeWorld?: number
}): d3.ZoomTransform {
  const viewportW = Number.isFinite(args.viewportW) ? Math.max(1, Math.floor(args.viewportW)) : 1
  const viewportH = Number.isFinite(args.viewportH) ? Math.max(1, Math.floor(args.viewportH)) : 1

  const inset = typeof args.insetPx === 'number' && Number.isFinite(args.insetPx) ? Math.max(0, args.insetPx) : 0
  const viewW = Math.max(1, viewportW - inset * 2)
  const viewH = Math.max(1, viewportH - inset * 2)

  const ox = typeof args.origin?.x === 'number' && Number.isFinite(args.origin.x) ? Math.max(0, Math.min(1, args.origin.x)) : 0.5
  const oy = typeof args.origin?.y === 'number' && Number.isFinite(args.origin.y) ? Math.max(0, Math.min(1, args.origin.y)) : 0.5
  const targetSx = inset + viewW * ox
  const targetSy = inset + viewH * oy

  const minSize = typeof args.minBoundsSizeWorld === 'number' && Number.isFinite(args.minBoundsSizeWorld) ? Math.max(1e-6, args.minBoundsSizeWorld) : 1e-6
  const bx = Number.isFinite(args.bounds.x) ? args.bounds.x : 0
  const by = Number.isFinite(args.bounds.y) ? args.bounds.y : 0
  const bw = Number.isFinite(args.bounds.w) ? Math.max(minSize, args.bounds.w) : minSize
  const bh = Number.isFinite(args.bounds.h) ? Math.max(minSize, args.bounds.h) : minSize

  const kRaw = Math.min(viewW / bw, viewH / bh)
  const k = clampScale(kRaw, args.scaleExtent)

  const anchorWorldX = bx + bw * ox
  const anchorWorldY = by + bh * oy
  const x = targetSx - anchorWorldX * k
  const y = targetSy - anchorWorldY * k
  return d3.zoomIdentity.translate(x, y).scale(k)
}

