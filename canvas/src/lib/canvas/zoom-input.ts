import { normalizeWheelDeltaYpx } from 'grph-shared/viewport/wheel'

export {
  VIEWPORT_WHEEL_ZOOM_SENSITIVITY as CANVAS_WHEEL_ZOOM_SENSITIVITY,
  normalizeWheelDeltaXpx,
  normalizeWheelDeltaYpx,
  normalizeWheelDeltasPx,
  computeWheelZoomFactor,
  computeWheelZoomLog2Delta as computeD3WheelDelta,
} from 'grph-shared/viewport/wheel'

export const CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_DEFAULT = 12
export const CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_MIN = 1
export const CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_MAX = 40

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
  const pinchBoost =
    e.ctrlKey === true || e.metaKey === true ? clampCanvasWheelZoomCtrlMetaBoostMultiplier(ctrlMetaBoostMultiplier) : 1
  return normalizeWheelDeltaYpx(e) * m * pinchBoost
}
