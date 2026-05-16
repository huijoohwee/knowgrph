import {
  type BalancedSpreadViewportPreset,
  clampBalancedCollectiveScaleToViewport,
  computeBalancedSpreadLayout,
  computeBalancedSpreadSpacingPx,
  computeBalancedSpreadViewportMargins,
} from '@/lib/ui/overlayBalancedSpread'
import { COLLECTIVE_OVERLAY_SCALE_LIMITS_16X9 } from '@/lib/ui/overlayScaleLimits'

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
  viewportPreset?: BalancedSpreadViewportPreset
}): number {
  const viewportPreset = args.viewportPreset || 'widgetCanvas'
  const baseScale = computeWidgetScale(args.zoomK, args.extent, { mode: 'pinnedInCanvas' })
  const requestedHardMin =
    Number.isFinite(args.hardMinScale) ? Math.max(0.001, Number(args.hardMinScale)) : COLLECTIVE_OVERLAY_SCALE_LIMITS_16X9.widget.min
  const requestedHardMax =
    Number.isFinite(args.hardMaxScale) ? Math.max(0.001, Number(args.hardMaxScale)) : COLLECTIVE_OVERLAY_SCALE_LIMITS_16X9.widget.max
  let nextScale = clampBalancedCollectiveScaleToViewport({
    scale: baseScale,
    viewportW: args.viewportW,
    viewportH: args.viewportH,
    count: Math.max(1, Math.floor(Number(args.count) || 1)),
    baseWidth: Math.max(1, Number(args.baseWidth) || 1),
    baseHeight: Math.max(1, Number(args.baseHeight) || 1),
    quantizeStep: Number.isFinite(args.quantizeStep) ? Math.max(0.001, Number(args.quantizeStep)) : 0.02,
    hardMinScale: Math.min(requestedHardMin, baseScale),
    hardMaxScale: Math.max(requestedHardMax, baseScale),
    viewportPreset,
  })
  if (Math.max(1, Math.floor(Number(args.count) || 1)) <= 1) return nextScale
  const viewportW = Math.max(1, Number(args.viewportW) || 1)
  const viewportH = Math.max(1, Number(args.viewportH) || 1)
  const margins = computeBalancedSpreadViewportMargins({
    viewportW,
    viewportH,
    preset: viewportPreset,
  })
  const usableW = Math.max(1, viewportW - margins.left - margins.right)
  const usableH = Math.max(1, viewportH - margins.top - margins.bottom)
  const baseGapPx = Math.max(12, Math.min(40, Math.round(usableW * 0.012)))
  const count = Math.max(1, Math.floor(Number(args.count) || 1))
  const quantizeStep = Number.isFinite(args.quantizeStep) ? Math.max(0.001, Number(args.quantizeStep)) : 0.02
  const quantize = (value: number) => Math.round(value / quantizeStep) * quantizeStep
  let candidate = Math.max(0.05, nextScale)
  for (let i = 0; i < 24; i += 1) {
    const panel = computeWidgetScaledSize(candidate)
    const gapPx = computeBalancedSpreadSpacingPx({
      baseGapPx,
      zoomK: Number.isFinite(args.zoomK) ? Math.max(0.1, Number(args.zoomK)) : 1,
      count,
      preset: viewportPreset,
    })
    const layout = computeBalancedSpreadLayout({
      count,
      viewportW,
      viewportH,
      cellW: panel.width + gapPx,
      cellH: panel.height + gapPx,
      gapPx,
      zoomK: Number.isFinite(args.zoomK) ? Math.max(0.1, Number(args.zoomK)) : 1,
      marginLeftPx: margins.left,
      marginRightPx: margins.right,
      marginTopPx: margins.top,
      marginBottomPx: margins.bottom,
      snapPx: 1,
    })
    if (layout.gridW <= usableW + 1 && layout.gridH <= usableH + 1) {
      nextScale = Math.max(0.05, quantize(candidate))
      return nextScale
    }
    candidate = Math.max(0.05, quantize(candidate - quantizeStep))
  }
  return Math.max(0.05, quantize(candidate))
}
