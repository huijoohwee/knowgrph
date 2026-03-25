export type RafValueScheduler<T> = {
  schedule: (next: T) => void
  flush: () => void
  cancel: () => void
}

export function createRafValueScheduler<T>(apply: (next: T) => void): RafValueScheduler<T> {
  let raf: number | null = null
  let pending: T | null = null

  const flush = () => {
    raf = null
    if (pending == null) return
    const next = pending
    pending = null
    apply(next)
  }

  const schedule = (next: T) => {
    pending = next
    if (raf != null) return
    if (typeof window === 'undefined') {
      flush()
      return
    }
    raf = window.requestAnimationFrame(flush)
  }

  const cancel = () => {
    if (raf == null) return
    try {
      window.cancelAnimationFrame(raf)
    } catch {
      void 0
    }
    raf = null
    pending = null
  }

  return { schedule, flush, cancel }
}

