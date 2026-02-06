export type RectLike = { left: number; top: number; width: number; height: number }

export type WheelAnchorResolution = {
  sx: number
  sy: number
  source: 'event' | 'fallback' | 'center'
}

export type WheelFallbackPoint = {
  sx: number
  sy: number
  ts?: number
}

export function coerceWheelFallback(args: {
  fallback: WheelFallbackPoint | null
  nowMs: number
  maxAgeMs: number
}): { sx: number; sy: number } | null {
  const fb = args.fallback
  if (!fb) return null
  if (!Number.isFinite(fb.sx) || !Number.isFinite(fb.sy)) return null
  const ts = typeof fb.ts === 'number' && Number.isFinite(fb.ts) ? fb.ts : null
  if (ts != null) {
    const ageMs = args.nowMs - ts
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > args.maxAgeMs) return null
  }
  return { sx: fb.sx, sy: fb.sy }
}

export function resolveWheelAnchor(args: {
  rect: RectLike
  clientX: number
  clientY: number
  fallback: null | { sx: number; sy: number }
}): WheelAnchorResolution {
  const rect = args.rect
  const sx = args.clientX - rect.left
  const sy = args.clientY - rect.top
  const inside = Number.isFinite(sx) && Number.isFinite(sy) && sx >= 0 && sy >= 0 && sx <= rect.width && sy <= rect.height
  if (inside) return { sx, sy, source: 'event' }

  const clamp = (v: number, lo: number, hi: number) => {
    if (!Number.isFinite(v)) return lo
    return Math.max(lo, Math.min(hi, v))
  }

  if (Number.isFinite(sx) && Number.isFinite(sy) && Number.isFinite(rect.width) && Number.isFinite(rect.height)) {
    const edgeSnapMarginPx = 24
    const clampedSx = clamp(sx, 0, rect.width)
    const clampedSy = clamp(sy, 0, rect.height)
    const outsideDx = sx < 0 ? -sx : sx > rect.width ? sx - rect.width : 0
    const outsideDy = sy < 0 ? -sy : sy > rect.height ? sy - rect.height : 0
    if (Math.max(outsideDx, outsideDy) <= edgeSnapMarginPx) {
      return { sx: clampedSx, sy: clampedSy, source: 'event' }
    }
  }
  const fb = args.fallback
  if (fb && Number.isFinite(fb.sx) && Number.isFinite(fb.sy)) {
    return { sx: fb.sx, sy: fb.sy, source: 'fallback' }
  }
  return { sx: rect.width * 0.5, sy: rect.height * 0.5, source: 'center' }
}
