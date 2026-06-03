import { snapScalarToGrid } from '@/lib/canvas/gridSnap'
import type { SnapGridConfig } from '@/lib/canvas/gridSnap'

export type GroupResizeBounds = { x: number; y: number; w: number; h: number }

export function computeMinGroupResizeSize(args: {
  minBoundsSizePx: number
  explicitBounds: GroupResizeBounds
  autoBounds: GroupResizeBounds | null
}): { minW: number; minH: number } {
  const minBoundsSizePx = Number.isFinite(args.minBoundsSizePx) ? Math.max(1, Math.floor(args.minBoundsSizePx)) : 24
  const explicit = args.explicitBounds
  const auto = args.autoBounds
  if (!auto) return { minW: minBoundsSizePx, minH: minBoundsSizePx }
  const minWFromAuto = Number.isFinite(auto.x) && Number.isFinite(auto.w) ? auto.x + auto.w - explicit.x : Number.NaN
  const minHFromAuto = Number.isFinite(auto.y) && Number.isFinite(auto.h) ? auto.y + auto.h - explicit.y : Number.NaN
  return {
    minW: Number.isFinite(minWFromAuto) ? Math.max(minBoundsSizePx, minWFromAuto) : minBoundsSizePx,
    minH: Number.isFinite(minHFromAuto) ? Math.max(minBoundsSizePx, minHFromAuto) : minBoundsSizePx,
  }
}

export function computeGroupResizeBottomRight(args: {
  startBounds: GroupResizeBounds
  startWorld: { x: number; y: number }
  world: { x: number; y: number }
  minW: number
  minH: number
  snapGrid?: SnapGridConfig | { enabled: boolean; size: number } | null
  altDown?: boolean
}): GroupResizeBounds {
  const dx = args.world.x - args.startWorld.x
  const dy = args.world.y - args.startWorld.y
  const minW = Number.isFinite(args.minW) ? Math.max(1, args.minW) : 24
  const minH = Number.isFinite(args.minH) ? Math.max(1, args.minH) : 24
  const start = args.startBounds
  let w = Math.max(minW, start.w + dx)
  let h = Math.max(minH, start.h + dy)

  const snapEnabled = args.snapGrid?.enabled === true && args.altDown !== true
  if (snapEnabled) {
    w = Math.max(minW, snapScalarToGrid(w, args.snapGrid, 'x'))
    h = Math.max(minH, snapScalarToGrid(h, args.snapGrid, 'y'))
  }

  return { x: start.x, y: start.y, w, h }
}
