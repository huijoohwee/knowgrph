type CoalescedEntry = {
  timerId: number | null
  fn: (() => void) | null
}

const entries = new Map<string, CoalescedEntry>()

const getEntry = (rawKey: string): CoalescedEntry => {
  const key = rawKey || 'default'
  const existing = entries.get(key)
  if (existing) return existing
  const next: CoalescedEntry = { timerId: null, fn: null }
  entries.set(key, next)
  return next
}

export const scheduleCoalescedTask = (rawKey: string, fn: () => void, delayMs: number): void => {
  const key = rawKey || 'default'
  const entry = getEntry(key)

  entry.fn = fn

  if (typeof window === 'undefined') {
    try {
      entry.fn?.()
    } catch {
      void 0
    }
    return
  }

  if (entry.timerId != null) {
    try {
      window.clearTimeout(entry.timerId)
    } catch {
      void 0
    }
    entry.timerId = null
  }

  const ms = Number.isFinite(delayMs) && delayMs >= 0 ? Math.floor(delayMs) : 0
  entry.timerId = window.setTimeout(() => {
    entry.timerId = null
    const fnRef = entry.fn
    if (!fnRef) return
    try {
      fnRef()
    } catch {
      void 0
    }
  }, ms)
}

export const cancelCoalescedTask = (rawKey: string): void => {
  const key = rawKey || 'default'
  const entry = entries.get(key)
  if (!entry) return

  if (typeof window !== 'undefined' && entry.timerId != null) {
    try {
      window.clearTimeout(entry.timerId)
    } catch {
      void 0
    }
  }
  entry.timerId = null
  entry.fn = null
}

