export type ProgressTicker = {
  start: () => void
  stop: (finalPercentage?: number) => void
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

