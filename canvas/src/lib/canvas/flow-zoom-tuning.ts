export const FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_DEFAULT = 0.25
export const FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_MIN = 0.25
export const FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_MAX = 2.5

export const FLOW_WHEEL_ZOOM_INCREMENT_MULTIPLIER_DEFAULT = 3
export const FLOW_WHEEL_ZOOM_INCREMENT_MULTIPLIER_MIN = 0.25
export const FLOW_WHEEL_ZOOM_INCREMENT_MULTIPLIER_MAX = 5

export const FLOW_WHEEL_ZOOM_SMOOTH_MIN_DURATION_DEFAULT_MS = 40
export const FLOW_WHEEL_ZOOM_SMOOTH_MAX_DURATION_DEFAULT_MS = 110
export const FLOW_WHEEL_ZOOM_SMOOTH_DURATION_MIN_MS = 10
export const FLOW_WHEEL_ZOOM_SMOOTH_DURATION_MAX_MS = 400

export function clampFlowWheelZoomSpeedMultiplier(v: number): number {
  const safe = Number.isFinite(v) ? v : FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_DEFAULT
  return Math.max(FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_MIN, Math.min(FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_MAX, safe))
}

export function clampFlowWheelZoomIncrementMultiplier(v: number): number {
  const safe = Number.isFinite(v) ? v : FLOW_WHEEL_ZOOM_INCREMENT_MULTIPLIER_DEFAULT
  return Math.max(FLOW_WHEEL_ZOOM_INCREMENT_MULTIPLIER_MIN, Math.min(FLOW_WHEEL_ZOOM_INCREMENT_MULTIPLIER_MAX, safe))
}

export function clampFlowWheelZoomSmoothDurationMs(v: number): number {
  const safe = Number.isFinite(v) ? v : FLOW_WHEEL_ZOOM_SMOOTH_MIN_DURATION_DEFAULT_MS
  return Math.max(FLOW_WHEEL_ZOOM_SMOOTH_DURATION_MIN_MS, Math.min(FLOW_WHEEL_ZOOM_SMOOTH_DURATION_MAX_MS, Math.floor(safe)))
}

export function coerceFlowWheelZoomSmoothRange(args: { minMs: number; maxMs: number }): { minMs: number; maxMs: number } {
  const minMs = clampFlowWheelZoomSmoothDurationMs(args.minMs)
  const maxMs = clampFlowWheelZoomSmoothDurationMs(args.maxMs)
  if (maxMs >= minMs) return { minMs, maxMs }
  return { minMs: maxMs, maxMs: maxMs }
}
