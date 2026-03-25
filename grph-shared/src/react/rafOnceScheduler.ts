export type RafOnceScheduler = {
  schedule: () => void
  cancel: () => void
}

export function createRafOnceScheduler(onTick: () => void): RafOnceScheduler {
  let raf: number | null = null

  const flush = () => {
    raf = null
    onTick()
  }

  const schedule = () => {
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
  }

  return { schedule, cancel }
}

