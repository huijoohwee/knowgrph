export const TOC_FOCUS_EVENT = 'kg:tocFocus' as const

export function emitTocFocus(id: string): void {
  const safeId = String(id || '').trim()
  if (!safeId) return
  const w = typeof window !== 'undefined' ? window : null
  if (!w || typeof w.dispatchEvent !== 'function') return
  const CE =
    typeof w.CustomEvent === 'function'
      ? w.CustomEvent
      : (globalThis as unknown as { CustomEvent?: unknown }).CustomEvent
  if (typeof CE !== 'function') return
  try {
    w.dispatchEvent(new (CE as unknown as { new (type: string, init?: unknown): Event })(TOC_FOCUS_EVENT, {
      detail: { id: safeId },
    }))
  } catch {
    void 0
  }
}
