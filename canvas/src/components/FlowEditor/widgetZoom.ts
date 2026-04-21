export const WIDGET_BASE_SIZE = {
  width: 360,
  height: 520,
} as const

export type ZoomScaleExtent = { minK: number; maxK: number }
export type WidgetScaleMode = 'pinnedInCanvas' | 'floating'

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo
  return Math.max(lo, Math.min(hi, v))
}

export function computeWidgetScale(
  zoomK: number,
  extent?: ZoomScaleExtent | null,
  opts?: { mode?: WidgetScaleMode },
): number {
  void extent
  const mode = opts?.mode === 'floating' ? 'floating' : 'pinnedInCanvas'
  if (mode === 'floating') return 1

  const k = Number.isFinite(zoomK) ? zoomK : 1
  const PINNED_MIN_SCALE = 0.05
  const PINNED_MAX_SCALE = 1
  return clamp(k, PINNED_MIN_SCALE, PINNED_MAX_SCALE)
}

export function computeWidgetScaledSize(scale: number): { width: number; height: number } {
  const s = Number.isFinite(scale) ? scale : 1
  return {
    width: WIDGET_BASE_SIZE.width * s,
    height: WIDGET_BASE_SIZE.height * s,
  }
}
