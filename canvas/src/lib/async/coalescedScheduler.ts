type CoalescedEntry = {
  timerId: number | null
  fn: (() => void) | null
  microtaskPending?: boolean
}

const entries = new Map<string, CoalescedEntry>()

type CoalescedStats = {
  scheduled: number
  executed: number
  canceled: number
}

const stats = new Map<string, CoalescedStats>()

const getEntry = (rawKey: string): CoalescedEntry => {
  const key = rawKey || 'default'
  const existing = entries.get(key)
  if (existing) return existing
  const next: CoalescedEntry = { timerId: null, fn: null }
  entries.set(key, next)
  return next
}

const getStatsEntry = (rawKey: string): CoalescedStats => {
  const key = rawKey || 'default'
  const existing = stats.get(key)
  if (existing) return existing
  const next: CoalescedStats = { scheduled: 0, executed: 0, canceled: 0 }
  stats.set(key, next)
  return next
}

export const scheduleCoalescedTask = (rawKey: string, fn: () => void, delayMs: number): void => {
  const key = rawKey || 'default'
  const entry = getEntry(key)
  const stat = getStatsEntry(key)

  entry.fn = fn
  stat.scheduled += 1

  if (typeof window === 'undefined') {
    try {
      entry.fn?.()
      stat.executed += 1
    } catch {
      void 0
    }
    return
  }

  // If a previous setTimeout is pending, cancel it regardless of the next scheduling strategy.
  if (entry.timerId != null) {
    try {
      window.clearTimeout(entry.timerId)
    } catch {
      void 0
    }
    entry.timerId = null
  }

  const ms = Number.isFinite(delayMs) && delayMs >= 0 ? Math.floor(delayMs) : 0

  // For "immediate" work, prefer microtasks to avoid timer churn under rapid bursts.
  if (ms === 0) {
    if (entry.microtaskPending) return
    entry.microtaskPending = true
    const enqueue =
      typeof queueMicrotask === 'function'
        ? queueMicrotask
        : (cb: () => void) => Promise.resolve().then(cb)
    enqueue(() => {
      entry.microtaskPending = false
      const statInner = getStatsEntry(key)
      const fnRef = entry.fn
      if (!fnRef) return
      try {
        fnRef()
        statInner.executed += 1
      } catch {
        void 0
      }
    })
    return
  }

  entry.microtaskPending = false
  entry.timerId = window.setTimeout(() => {
    entry.timerId = null
    const statInner = getStatsEntry(key)
    const fnRef = entry.fn
    if (!fnRef) return
    try {
      fnRef()
      statInner.executed += 1
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
    const stat = getStatsEntry(key)
    try {
      window.clearTimeout(entry.timerId)
    } catch {
      void 0
    }
    stat.canceled += 1
  }
  entry.timerId = null
  entry.fn = null
  entry.microtaskPending = false
}

export const getCoalescedSchedulerStats = (): Record<string, CoalescedStats> => {
  const out: Record<string, CoalescedStats> = {}
  stats.forEach((value, key) => {
    out[key] = { ...value }
  })
  return out
}

export const logCoalescedSchedulerStats = (label?: string): void => {
  if (typeof console === 'undefined') return
  const snapshot = getCoalescedSchedulerStats()
  const header = label && label.length > 0 ? `Coalesced scheduler stats (${label})` : 'Coalesced scheduler stats'
  console.log(header)
  console.table(
    Object.entries(snapshot).map(([key, value]) => ({
      key,
      scheduled: value.scheduled,
      executed: value.executed,
      canceled: value.canceled,
    })),
  )
}
