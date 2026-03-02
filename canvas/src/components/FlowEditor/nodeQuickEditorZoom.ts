export const NODE_QUICK_EDITOR_BASE_SIZE = {
  width: 360,
  height: 520,
} as const

export type ZoomScaleExtent = { minK: number; maxK: number }
export type NodeQuickEditorScaleMode = 'pinnedInCanvas' | 'floating'

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo
  return Math.max(lo, Math.min(hi, v))
}

export function computeNodeQuickEditorScale(
  zoomK: number,
  extent?: ZoomScaleExtent | null,
  opts?: { mode?: NodeQuickEditorScaleMode },
): number {
  void extent
  void opts

  const k = Number.isFinite(zoomK) ? zoomK : 1
  const PINNED_MIN_SCALE = 0.05
  const PINNED_MAX_SCALE = 1
  return clamp(k, PINNED_MIN_SCALE, PINNED_MAX_SCALE)
}

export function computeNodeQuickEditorScaledSize(scale: number): { width: number; height: number } {
  const s = Number.isFinite(scale) ? scale : 1
  return {
    width: NODE_QUICK_EDITOR_BASE_SIZE.width * s,
    height: NODE_QUICK_EDITOR_BASE_SIZE.height * s,
  }
}
