export const WIDGET_BASE_SIZE = {
  width: 360,
  height: 520,
} as const

export type ZoomScaleExtent = { minK: number; maxK: number }
export type WidgetScaleMode = 'pinnedInCanvas' | 'floating'
const FLOATING_MIN_SCALE = 0.86
const FLOATING_MAX_SCALE = 1.06
const FLOATING_SCALE_STEP = 0.02

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo
  return Math.max(lo, Math.min(hi, v))
}

function quantizeScale(v: number, step: number): number {
  const safeStep = Number.isFinite(step) && step > 0 ? step : 0.01
  return Math.round(v / safeStep) * safeStep
}

export function computeWidgetScaleKey(scale: number): string {
  const n = Number.isFinite(scale) ? scale : 1
  return n.toFixed(2)
}

export function computeWidgetScale(
  zoomK: number,
  extent?: ZoomScaleExtent | null,
  opts?: { mode?: WidgetScaleMode },
): number {
  void extent
  const mode = opts?.mode === 'floating' ? 'floating' : 'pinnedInCanvas'
  if (mode === 'floating') {
    const k = Number.isFinite(zoomK) ? Math.max(0.1, Math.min(6, zoomK)) : 1
    const adaptive = Math.pow(k, 0.42)
    return clamp(quantizeScale(clamp(adaptive, FLOATING_MIN_SCALE, FLOATING_MAX_SCALE), FLOATING_SCALE_STEP), FLOATING_MIN_SCALE, FLOATING_MAX_SCALE)
  }

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
