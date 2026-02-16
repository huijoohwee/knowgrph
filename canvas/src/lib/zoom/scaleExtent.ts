import { DEFAULT_ZOOM_MAX_SCALE_HARD_CAP, DEFAULT_ZOOM_MIN_SCALE_HARD_CAP } from '@/lib/graph/layoutDefaults'

export type ScaleExtent = { minK: number; maxK: number }

export function safeScaleExtent(extent: ScaleExtent): ScaleExtent {
  let minK = Number.isFinite(extent.minK) ? extent.minK : DEFAULT_ZOOM_MIN_SCALE_HARD_CAP
  let maxK = Number.isFinite(extent.maxK) ? extent.maxK : DEFAULT_ZOOM_MAX_SCALE_HARD_CAP

  if (maxK < minK) {
    const t = minK
    minK = maxK
    maxK = t
  }

  if (!(maxK > minK + 1e-12)) {
    minK = Math.min(minK, DEFAULT_ZOOM_MIN_SCALE_HARD_CAP)
    maxK = Math.max(maxK, DEFAULT_ZOOM_MAX_SCALE_HARD_CAP)
    if (!(maxK > minK + 1e-12)) maxK = minK * 2
  }

  minK = Math.max(DEFAULT_ZOOM_MIN_SCALE_HARD_CAP, minK)
  maxK = Math.min(DEFAULT_ZOOM_MAX_SCALE_HARD_CAP, maxK)
  if (!(maxK > minK + 1e-12)) maxK = minK * 2
  return { minK, maxK }
}

export function mergeScaleExtentWithCurrent(args: {
  schemaMinK: number
  schemaMaxK: number
  curMinK?: number
  curMaxK?: number
}): ScaleExtent {
  const curMinK = typeof args.curMinK === 'number' && Number.isFinite(args.curMinK) ? args.curMinK : args.schemaMinK
  const curMaxK = typeof args.curMaxK === 'number' && Number.isFinite(args.curMaxK) ? args.curMaxK : args.schemaMaxK
  const minK = Math.min(curMinK, args.schemaMinK)
  const maxK = Math.max(curMaxK, args.schemaMaxK)
  return safeScaleExtent({ minK, maxK })
}

export function clampScale(k: number, extent: ScaleExtent): number {
  const { minK, maxK } = safeScaleExtent(extent)
  const kk = Number.isFinite(k) ? k : 1
  return Math.max(minK, Math.min(maxK, kk))
}
