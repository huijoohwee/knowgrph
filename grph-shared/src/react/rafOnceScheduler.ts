import { resolveRafRuntime } from './rafRuntime.js'

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
  }

  return { schedule, cancel }
}
