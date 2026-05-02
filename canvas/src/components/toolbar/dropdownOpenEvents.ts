export const TOOLBAR_DROPDOWN_OPEN_EVENT = 'kg:toolbar-dropdown-open' as const

export type ToolbarDropdownOpenEventDetail = {
  sourceId: string
}

export function emitToolbarDropdownOpen(sourceId: string): void {
  const normalizedSourceId = String(sourceId || '').trim()
  if (!normalizedSourceId) return
  if (typeof window === 'undefined') return
  try {
    const CustomEventCtor = typeof window.CustomEvent === 'function' ? window.CustomEvent : CustomEvent
    window.dispatchEvent(new CustomEventCtor(TOOLBAR_DROPDOWN_OPEN_EVENT, {
      detail: { sourceId: normalizedSourceId },
    }))
  } catch {
    void 0
  }
}

export function readToolbarDropdownOpenEventDetail(
  event: Event | null | undefined,
): ToolbarDropdownOpenEventDetail | null {
  if (!event || typeof event !== 'object' || !('detail' in event)) return null
  const detail = (event as CustomEvent<unknown>).detail
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return null
  const sourceId = String((detail as { sourceId?: unknown }).sourceId || '').trim()
  if (!sourceId) return null
  return { sourceId }
}

export function subscribeToolbarDropdownOpen(
  listener: (detail: ToolbarDropdownOpenEventDetail) => void,
): () => void {
  if (typeof window === 'undefined') return () => void 0
  const handle = (event: Event) => {
    const detail = readToolbarDropdownOpenEventDetail(event)
    if (!detail) return
    listener(detail)
  }
  window.addEventListener(TOOLBAR_DROPDOWN_OPEN_EVENT, handle as EventListener)
  return () => {
    window.removeEventListener(TOOLBAR_DROPDOWN_OPEN_EVENT, handle as EventListener)
  }
}
