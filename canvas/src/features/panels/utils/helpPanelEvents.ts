export const HELP_SCROLL_TO_ANCHOR_EVENT = 'kg:helpScrollToAnchor' as const

export function emitHelpScrollToAnchor(anchor: string): void {
  const normalizedAnchor = String(anchor || '').trim()
  if (!normalizedAnchor) return
  if (typeof window === 'undefined') return
  const CustomEventCtor = typeof window.CustomEvent === 'function' ? window.CustomEvent : CustomEvent
  window.dispatchEvent(new CustomEventCtor(HELP_SCROLL_TO_ANCHOR_EVENT, {
    detail: { anchor: normalizedAnchor },
  }))
}
