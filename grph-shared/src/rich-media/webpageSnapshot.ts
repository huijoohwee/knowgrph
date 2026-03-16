export type SnapshotRect = { rect: { x: number; y: number; w: number; h: number }; text: string }

export type SnapshotLike = {
  elements?: Array<{
    rect?: { x?: number; y?: number; w?: number; h?: number }
    text?: unknown
  }>
}

export function normalizeSnapshotInlineText(raw: unknown): string {
  return String(raw || '').replace(/\s+/g, ' ').trim()
}

export function pickWebpageSnapshotRects(snap: SnapshotLike, maxRects = 90): SnapshotRect[] {
  const elements = Array.isArray(snap?.elements) ? snap.elements : []
  const candidates = elements
    .map((el) => {
      const r = el?.rect
      const x = r && typeof r.x === 'number' ? r.x : NaN
      const y = r && typeof r.y === 'number' ? r.y : NaN
      const w = r && typeof r.w === 'number' ? r.w : NaN
      const h = r && typeof r.h === 'number' ? r.h : NaN
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return null
      if (w < 8 || h < 8) return null
      const text = normalizeSnapshotInlineText(el?.text)
      const area = w * h
      return { rect: { x, y, w, h }, area, text }
    })
    .filter(Boolean) as { rect: { x: number; y: number; w: number; h: number }; area: number; text: string }[]

  candidates.sort((a, b) => b.area - a.area)
  const limit = Number.isFinite(maxRects) ? Math.max(1, Math.floor(maxRects)) : 90
  return candidates.slice(0, limit).map(c => ({ rect: c.rect, text: c.text }))
}

export function shouldAutoLoadWebpageSnapshot(opts?: { allowNodeJsUserAgent?: boolean }): boolean {
  try {
    const anyGlobal = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: unknown }
    if (anyGlobal.IS_REACT_ACT_ENVIRONMENT === true) return false
    const nav = typeof navigator !== 'undefined' ? navigator : null
    if (nav) {
      const ua = String(nav.userAgent || '')
      if (/\bjsdom\b/i.test(ua)) return false
      if (opts?.allowNodeJsUserAgent !== true && /node\.js/i.test(ua)) return false
    }
    if (typeof window === 'undefined') return false
    const proto = String(window.location?.protocol || '')
    if (proto && proto !== 'http:' && proto !== 'https:') return false
    return true
  } catch {
    return false
  }
}
