export type ProgressTicker = {
  start: () => void
  stop: (finalPercentage?: number) => void
}

const DEFAULT_UI_PROGRESS_INTERVAL_MS = 280
const DEFAULT_UI_PROGRESS_MAX_PERCENTAGE = 92
const DEFAULT_UI_PROGRESS_MAX_STEP_PERCENTAGE = 12

export type ProgressSession = {
  start: () => void
  finish: (finalPercentage?: number) => void
  stop: () => void
  cleanup: () => void
}

export function createProgressTicker(args: {
  onProgress: (percentage: number) => void
  intervalMs?: number
  maxPercentage?: number
  maxStepPercentage?: number
}): ProgressTicker {
  const onProgress = args.onProgress
  const intervalMs = Number.isFinite(args.intervalMs) ? Math.max(50, Math.floor(args.intervalMs || 0)) : 300
  const maxPercentage = Number.isFinite(args.maxPercentage) ? Math.max(0, Math.min(99, Math.floor(args.maxPercentage || 0))) : 90
  const maxStepPercentage = Number.isFinite(args.maxStepPercentage) ? Math.max(1, Math.min(30, Math.floor(args.maxStepPercentage || 0))) : 15

  let id: number | null = null
  let p = 0
  const tick = () => {
    if (p >= maxPercentage) return
    p += Math.random() * maxStepPercentage
    if (p > maxPercentage) p = maxPercentage
    onProgress(Math.round(p))
  }

  const start = () => {
    if (id != null) return
    id = window.setInterval(tick, intervalMs)
  }

  const stop = (finalPercentage?: number) => {
    if (id != null) {
      clearInterval(id)
      id = null
    }
    if (typeof finalPercentage === 'number' && Number.isFinite(finalPercentage)) {
      p = Math.max(0, Math.min(100, Math.floor(finalPercentage)))
      onProgress(p)
    }
  }

  return { start, stop }
}

export function stopProgressTickerSafely(ticker: ProgressTicker | null | undefined, finalPercentage?: number): void {
  if (!ticker) return
  try {
    if (typeof finalPercentage === 'number' && Number.isFinite(finalPercentage)) {
      ticker.stop(finalPercentage)
      return
    }
    ticker.stop()
  } catch {
    void 0
  }
}

export function createProgressSession(args: {
  onProgress: (percentage: number) => void
  intervalMs?: number
  maxPercentage?: number
  maxStepPercentage?: number
}): ProgressSession {
  const ticker = createProgressTicker(args)
  const start = () => ticker.start()
  const finish = (finalPercentage?: number) => stopProgressTickerSafely(ticker, finalPercentage)
  const stop = () => stopProgressTickerSafely(ticker)
  const cleanup = () => stopProgressTickerSafely(ticker)
  return {
    start,
    finish,
    stop,
    cleanup,
  }
}

export function createDefaultProgressSession(args: {
  onProgress: (percentage: number) => void
}): ProgressSession {
  return createProgressSession({
    onProgress: args.onProgress,
    intervalMs: DEFAULT_UI_PROGRESS_INTERVAL_MS,
    maxPercentage: DEFAULT_UI_PROGRESS_MAX_PERCENTAGE,
    maxStepPercentage: DEFAULT_UI_PROGRESS_MAX_STEP_PERCENTAGE,
  })
}

export function beginProgressSession(args: {
  progressSession: ProgressSession | null | undefined
  beforeStart?: (() => void) | null
}): void {
  try {
    args.beforeStart?.()
  } catch {
    void 0
  }
  try {
    args.progressSession?.start()
  } catch {
    void 0
  }
}

export function finishProgressSession(args: {
  progressSession: ProgressSession | null | undefined
  finalPercentage?: number
  afterFinish?: (() => void) | null
}): void {
  try {
    args.progressSession?.finish(args.finalPercentage)
  } catch {
    void 0
  }
  try {
    args.afterFinish?.()
  } catch {
    void 0
  }
}

export function failProgressSession(args: {
  progressSession: ProgressSession | null | undefined
  afterStop?: (() => void) | null
}): void {
  try {
    args.progressSession?.stop()
  } catch {
    void 0
  }
  try {
    args.afterStop?.()
  } catch {
    void 0
  }
}
