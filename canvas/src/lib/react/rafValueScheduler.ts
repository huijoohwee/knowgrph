export function createRafValueScheduler<T>(apply: (value: T) => void): {
  schedule: (value: T) => void
  flush: () => void
  cancel: () => void
} {
  let rafId: number | null = null
  let pending: T | null = null

  const schedule = (value: T) => {
    pending = value
    if (rafId != null) return
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      const v = pending
      pending = null
      if (v != null) apply(v)
      return
    }
    rafId = window.requestAnimationFrame(() => {
      rafId = null
      const v = pending
      pending = null
      if (v != null) apply(v)
    })
  }

  const flush = () => {
    if (rafId != null) {
      try {
        window.cancelAnimationFrame(rafId)
      } catch {
        void 0
      }
      rafId = null
    }
    const v = pending
    pending = null
    if (v != null) apply(v)
  }

  const cancel = () => {
    if (rafId != null) {
      try {
        window.cancelAnimationFrame(rafId)
      } catch {
        void 0
      }
      rafId = null
    }
    pending = null
  }

  return { schedule, flush, cancel }
}
