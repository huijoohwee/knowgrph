import { normalizeWheelDeltaYpx } from 'grph-shared/viewport/wheel'

export {
  VIEWPORT_WHEEL_ZOOM_SENSITIVITY as CANVAS_WHEEL_ZOOM_SENSITIVITY,
  normalizeWheelDeltaXpx,
  normalizeWheelDeltaYpx,
  normalizeWheelDeltasPx,
  computeWheelZoomFactor,
  computeWheelZoomLog2Delta as computeD3WheelDelta,
} from 'grph-shared/viewport/wheel'

export const CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_DEFAULT = 120
export const CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_MIN = 1
export const CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_MAX = 400

export function clampCanvasWheelZoomCtrlMetaBoostMultiplier(v: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_DEFAULT
  if (v < CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_MIN) return CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_MIN
  if (v > CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_MAX) return CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_MAX
  return v
}

export function computeZoomWheelDeltaYpx(
  e: Pick<WheelEvent, 'deltaY' | 'deltaMode' | 'ctrlKey' | 'metaKey'>,
  multiplier: number,
  ctrlMetaBoostMultiplier: number = CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_DEFAULT,
): number {
  const m = typeof multiplier === 'number' && Number.isFinite(multiplier) ? multiplier : 1
  const base = normalizeWheelDeltaYpx(e)
  const isCtrlMeta = e.ctrlKey === true || e.metaKey === true
  const pinchBoost = (() => {
    if (!isCtrlMeta) return 1
    const absBase = Math.abs(base)
    const frac = Math.abs(base - Math.round(base))
    const looksLikeTrackpadPinch = absBase > 0 && absBase <= 240 && frac > 1e-3
    if (looksLikeTrackpadPinch) return clampCanvasWheelZoomCtrlMetaBoostMultiplier(ctrlMetaBoostMultiplier)
    const looksLikeMouseWheel = absBase >= 60 && frac <= 1e-3
    if (looksLikeMouseWheel) return 1
    if (absBase <= 40) return clampCanvasWheelZoomCtrlMetaBoostMultiplier(ctrlMetaBoostMultiplier)
    return 1
  })()
  return base * m * pinchBoost
}
