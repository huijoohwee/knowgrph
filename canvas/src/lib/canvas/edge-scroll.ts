export type EdgeScrollInsets = { top: number; right: number; bottom: number; left: number }

export type EdgeScrollOptions = {
  distancePx: number
  delayMs: number
  easeDurationMs: number
  speedPxPerSec: number
  coarsePointerWidthPx: number
}

export const DEFAULT_EDGE_SCROLL_OPTIONS: EdgeScrollOptions = {
  distancePx: 12,
  delayMs: 160,
  easeDurationMs: 200,
  speedPxPerSec: 900,
  coarsePointerWidthPx: 16,
}

export type EdgeScrollInput = {
  nowMs: number
  pointer: { sx: number; sy: number; kind: 'mouse' | 'touch' | 'pen' }
  viewport: { w: number; h: number }
  insets?: Partial<EdgeScrollInsets>
  zoomK: number
  enabled: boolean
}

export type EdgeScrollDeltaPx = { dx: number; dy: number }

type AxisState = { enteredAtMs: number | null }

export function createEdgeScrollController(opts?: Partial<EdgeScrollOptions>) {
  const options: EdgeScrollOptions = { ...DEFAULT_EDGE_SCROLL_OPTIONS, ...(opts || {}) }
  const xState: AxisState = { enteredAtMs: null }
  const yState: AxisState = { enteredAtMs: null }
  let lastNowMs: number | null = null

  const reset = () => {
    xState.enteredAtMs = null
    yState.enteredAtMs = null
    lastNowMs = null
  }

  const update = (input: EdgeScrollInput): EdgeScrollDeltaPx => {
    if (!input.enabled) {
      reset()
      return { dx: 0, dy: 0 }
    }

    const nowMs = Number.isFinite(input.nowMs) ? input.nowMs : Date.now()
    const dtMs = lastNowMs == null ? 0 : Math.max(0, Math.min(80, nowMs - lastNowMs))
    lastNowMs = nowMs

    const w = Math.max(1, Math.floor(input.viewport.w))
    const h = Math.max(1, Math.floor(input.viewport.h))

    const insets: EdgeScrollInsets = {
      top: Math.max(0, Math.floor(input.insets?.top ?? 0)),
      right: Math.max(0, Math.floor(input.insets?.right ?? 0)),
      bottom: Math.max(0, Math.floor(input.insets?.bottom ?? 0)),
      left: Math.max(0, Math.floor(input.insets?.left ?? 0)),
    }

    const dist = Math.max(1, options.distancePx)
    const coarseHalf = input.pointer.kind === 'touch' ? Math.max(0, options.coarsePointerWidthPx) / 2 : 0
    const sx = Number.isFinite(input.pointer.sx) ? input.pointer.sx : 0
    const sy = Number.isFinite(input.pointer.sy) ? input.pointer.sy : 0
    const leftEdge = insets.left
    const rightEdge = Math.max(leftEdge + 1, w - insets.right)
    const topEdge = insets.top
    const bottomEdge = Math.max(topEdge + 1, h - insets.bottom)

    const leftFactor = (() => {
      const inner = (sx - coarseHalf) - leftEdge
      if (inner >= dist) return 0
      const penetration = dist - inner
      return Math.max(0, Math.min(1, penetration / dist))
    })()
    const rightFactor = (() => {
      const inner = rightEdge - (sx + coarseHalf)
      if (inner >= dist) return 0
      const penetration = dist - inner
      return Math.max(0, Math.min(1, penetration / dist))
    })()
    const topFactor = (() => {
      const inner = (sy - coarseHalf) - topEdge
      if (inner >= dist) return 0
      const penetration = dist - inner
      return Math.max(0, Math.min(1, penetration / dist))
    })()
    const bottomFactor = (() => {
      const inner = bottomEdge - (sy + coarseHalf)
      if (inner >= dist) return 0
      const penetration = dist - inner
      return Math.max(0, Math.min(1, penetration / dist))
    })()

    const anyX = leftFactor > 0 || rightFactor > 0
    const anyY = topFactor > 0 || bottomFactor > 0
    if (!anyX) xState.enteredAtMs = null
    if (!anyY) yState.enteredAtMs = null
    if (anyX && xState.enteredAtMs == null) xState.enteredAtMs = nowMs
    if (anyY && yState.enteredAtMs == null) yState.enteredAtMs = nowMs

    if (dtMs <= 0) return { dx: 0, dy: 0 }

    const eased = (enteredAtMs: number | null): number => {
      if (enteredAtMs == null) return 0
      const elapsed = nowMs - enteredAtMs
      if (elapsed < options.delayMs) return 0
      const t = options.easeDurationMs > 0 ? Math.max(0, Math.min(1, (elapsed - options.delayMs) / options.easeDurationMs)) : 1
      return t * t * t
    }

    const easeX = eased(xState.enteredAtMs)
    const easeY = eased(yState.enteredAtMs)
    if (easeX <= 0 && easeY <= 0) return { dx: 0, dy: 0 }

    const zoomK = Number.isFinite(input.zoomK) && input.zoomK > 1e-6 ? input.zoomK : 1
    const speed = Math.max(0, options.speedPxPerSec)
    const dtSec = dtMs / 1000
    const dx = ((leftFactor - rightFactor) * speed * easeX * dtSec) / zoomK
    const dy = ((topFactor - bottomFactor) * speed * easeY * dtSec) / zoomK
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return { dx: 0, dy: 0 }
    return { dx, dy }
  }

  return { update, reset, options }
}
