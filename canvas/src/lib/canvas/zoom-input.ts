export const CANVAS_WHEEL_ZOOM_SENSITIVITY = 0.001

export function normalizeWheelDeltaYpx(e: Pick<WheelEvent, 'deltaY' | 'deltaMode'>): number {
  const raw = typeof e.deltaY === 'number' && Number.isFinite(e.deltaY) ? e.deltaY : 0
  const mode = typeof e.deltaMode === 'number' && Number.isFinite(e.deltaMode) ? e.deltaMode : 0
  if (mode === 1) return raw * 16
  if (mode === 2) return raw * 800
  return raw
}

export function computeWheelZoomFactor(deltaYpx: number): number {
  const safe = Number.isFinite(deltaYpx) ? deltaYpx : 0
  return Math.exp(-safe * CANVAS_WHEEL_ZOOM_SENSITIVITY)
}

export function computeD3WheelDelta(e: Pick<WheelEvent, 'deltaY' | 'deltaMode'>): number {
  const deltaYpx = normalizeWheelDeltaYpx(e)
  return (-deltaYpx * CANVAS_WHEEL_ZOOM_SENSITIVITY) / Math.LN2
}
