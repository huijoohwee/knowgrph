export type RafLatestScheduler<T> = {
  schedule: (value: T) => void
  cancel: () => void
}

export function createRafLatestScheduler<T>(onValue: (value: T) => void): RafLatestScheduler<T> {
  let raf: number | null = null
  let hasValue = false
  let latest: T

  const flush = () => {
    raf = null
    if (!hasValue) return
    hasValue = false
    onValue(latest)
  }

  return {
    schedule: (value: T) => {
      latest = value
      hasValue = true
      if (raf != null) return
      raf = requestAnimationFrame(flush)
    },
    cancel: () => {
      if (raf == null) return
      try {
        cancelAnimationFrame(raf)
      } catch {
        void 0
      }
      raf = null
      hasValue = false
    },
  }
}

