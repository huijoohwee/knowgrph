export const VIEWPORT_WHEEL_ZOOM_SENSITIVITY = 0.001

export function normalizeWheelDeltaXpx(e: Pick<WheelEvent, 'deltaX' | 'deltaMode'>): number {
  const raw = typeof e.deltaX === 'number' && Number.isFinite(e.deltaX) ? e.deltaX : 0
  const mode = typeof e.deltaMode === 'number' && Number.isFinite(e.deltaMode) ? e.deltaMode : 0
  if (mode === 1) return raw * 16
  if (mode === 2) return raw * 800
  return raw
}

export function normalizeWheelDeltaYpx(e: Pick<WheelEvent, 'deltaY' | 'deltaMode'>): number {
  const raw = typeof e.deltaY === 'number' && Number.isFinite(e.deltaY) ? e.deltaY : 0
  const mode = typeof e.deltaMode === 'number' && Number.isFinite(e.deltaMode) ? e.deltaMode : 0
  if (mode === 1) return raw * 16
  if (mode === 2) return raw * 800
  return raw
}

export function normalizeWheelDeltasPx(e: Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode'>): { dx: number; dy: number } {
  return {
    dx: normalizeWheelDeltaXpx(e),
    dy: normalizeWheelDeltaYpx(e),
  }
}

export function computeWheelZoomFactor(deltaYpx: number): number {
  const safe = Number.isFinite(deltaYpx) ? deltaYpx : 0
  return Math.exp(-safe * VIEWPORT_WHEEL_ZOOM_SENSITIVITY)
}

export function computeWheelZoomLog2Delta(e: Pick<WheelEvent, 'deltaY' | 'deltaMode'>): number {
  const deltaYpx = normalizeWheelDeltaYpx(e)
  return (-deltaYpx * VIEWPORT_WHEEL_ZOOM_SENSITIVITY) / Math.LN2
}

