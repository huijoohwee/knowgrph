import { clampBalancedCollectiveScaleToViewport } from '@/lib/ui/overlayBalancedSpread'

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

export function computeCollectiveFollowPinnedScale(args: {
  zoomK: number
  extent?: ZoomScaleExtent | null
  viewportW: number
  viewportH: number
  count: number
  baseWidth: number
  baseHeight: number
  quantizeStep?: number
  hardMinScale?: number
  hardMaxScale?: number
}): number {
  const baseScale = computeWidgetScale(args.zoomK, args.extent, { mode: 'pinnedInCanvas' })
  const requestedHardMin = Number.isFinite(args.hardMinScale) ? Math.max(0.001, Number(args.hardMinScale)) : 0.68
  const requestedHardMax = Number.isFinite(args.hardMaxScale) ? Math.max(0.001, Number(args.hardMaxScale)) : 1.06
  return clampBalancedCollectiveScaleToViewport({
    scale: baseScale,
    viewportW: args.viewportW,
    viewportH: args.viewportH,
    count: Math.max(1, Math.floor(Number(args.count) || 1)),
    baseWidth: Math.max(1, Number(args.baseWidth) || 1),
    baseHeight: Math.max(1, Number(args.baseHeight) || 1),
    quantizeStep: Number.isFinite(args.quantizeStep) ? Math.max(0.001, Number(args.quantizeStep)) : 0.02,
    hardMinScale: Math.min(requestedHardMin, baseScale),
    hardMaxScale: Math.max(requestedHardMax, baseScale),
  })
}
