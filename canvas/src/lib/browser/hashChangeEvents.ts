export const HASH_CHANGE_EVENT = 'hashchange' as const

export function readBrowserLocationHash(): string {
  if (typeof window === 'undefined') return ''
  try {
    const location = (window as unknown as { location?: Location }).location
    return location ? String(location.hash || '') : ''
  } catch {
    return ''
  }
}

export function writeBrowserLocationHash(hash: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const location = (window as unknown as { location?: Location }).location
    if (!location) return false
    location.hash = String(hash || '')
    return true
  } catch {
    return false
  }
}

export function emitHashChange(): void {
  if (typeof window === 'undefined') return
  try {
    const target = window
    const EventCtor = typeof target.Event === 'function' ? target.Event : Event
    target.dispatchEvent(new EventCtor(HASH_CHANGE_EVENT))
  } catch {
    void 0
  }
}

export function subscribeHashChange(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => void 0
  let target: Window
  const handle = () => {
    listener()
  }
  try {
    target = window
    target.addEventListener(HASH_CHANGE_EVENT, handle as EventListener)
  } catch {
    return () => void 0
  }
  return () => {
    try {
      target.removeEventListener(HASH_CHANGE_EVENT, handle as EventListener)
    } catch {
      void 0
    }
  }
}
