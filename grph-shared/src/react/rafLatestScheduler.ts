import { resolveRafRuntime } from './rafRuntime.js'

export type RafLatestScheduler<T> = {
  schedule: (next: T) => void
  cancel: () => void
}

export function createRafLatestScheduler<T>(onValue: (next: T) => void): RafLatestScheduler<T> {
  let raf: number | null = null
  let latest: T | null = null

  const flush = () => {
    raf = null
    if (latest == null) return
    const next = latest
    latest = null
    onValue(next)
  }

  const schedule = (next: T) => {
    latest = next
    if (raf != null) return
    raf = resolveRafRuntime().request(flush)
  }

  const cancel = () => {
    if (raf == null) return
    try {
      resolveRafRuntime().cancel(raf)
    } catch {
      void 0
    }
    raf = null
    latest = null
  }

  return { schedule, cancel }
}
