export const HASH_CHANGE_EVENT = 'hashchange' as const

export function emitHashChange(): void {
  if (typeof window === 'undefined') return
  try {
    const EventCtor = typeof window.Event === 'function' ? window.Event : Event
    window.dispatchEvent(new EventCtor(HASH_CHANGE_EVENT))
  } catch {
    void 0
  }
}

export function subscribeHashChange(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => void 0
  const handle = () => {
    listener()
  }
  window.addEventListener(HASH_CHANGE_EVENT, handle as EventListener)
  return () => {
    window.removeEventListener(HASH_CHANGE_EVENT, handle as EventListener)
  }
}
