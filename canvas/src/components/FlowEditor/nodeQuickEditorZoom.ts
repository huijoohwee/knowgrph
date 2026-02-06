function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo
  return Math.max(lo, Math.min(hi, v))
}

const MIN_PANEL_SCALE = 0.6
const MAX_PANEL_SCALE = 2.25
const MID_PANEL_SCALE = 1

export const NODE_QUICK_EDITOR_BASE_SIZE = {
  width: 360,
  height: 520,
} as const

export type ZoomScaleExtent = { minK: number; maxK: number }

function isValidExtent(extent: ZoomScaleExtent | null | undefined): extent is ZoomScaleExtent {
  if (!extent) return false
  const { minK, maxK } = extent
  if (!Number.isFinite(minK) || !Number.isFinite(maxK)) return false
  return maxK > 0 && minK > 0 && maxK > minK
}

export function computeNodeQuickEditorScale(zoomK: number, extent?: ZoomScaleExtent | null): number {
  const k = Number.isFinite(zoomK) ? zoomK : 1

  if (isValidExtent(extent)) {
    const u = clamp((k - extent.minK) / (extent.maxK - extent.minK), 0, 1)
    const tri = 1 - Math.abs(2 * u - 1)
    const s = MIN_PANEL_SCALE + (MID_PANEL_SCALE - MIN_PANEL_SCALE) * tri
    return clamp(s, MIN_PANEL_SCALE, MAX_PANEL_SCALE)
  }

  if (k <= 0) return 1
  return clamp(1 / k, MIN_PANEL_SCALE, MAX_PANEL_SCALE)
}

export function computeNodeQuickEditorScaledSize(scale: number): { width: number; height: number } {
  const s = Number.isFinite(scale) ? scale : 1
  return {
    width: NODE_QUICK_EDITOR_BASE_SIZE.width * s,
    height: NODE_QUICK_EDITOR_BASE_SIZE.height * s,
  }
}
