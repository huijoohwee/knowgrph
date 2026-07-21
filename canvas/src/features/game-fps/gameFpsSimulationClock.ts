export type GameFpsSimulationClock = Readonly<{
  requestStep: () => void
  queueInputStep: () => void
  dispose: () => void
}>

let inputStepQueue: (() => void) | null = null

export function bindGameFpsSimulationInputQueue(queueInputStep: () => void): () => void {
  if (inputStepQueue && inputStepQueue !== queueInputStep) {
    throw new Error('Game FPS simulation input queue already has an active owner')
  }
  inputStepQueue = queueInputStep
  return () => {
    if (inputStepQueue === queueInputStep) inputStepQueue = null
  }
}

export function queueGameFpsSimulationInputStep(): void {
  inputStepQueue?.()
}

export function createGameFpsSimulationClock(options: Readonly<{
  runStep: () => Promise<void>
  onStepError: (error: unknown) => void
  minimumStepIntervalMs: number
  now?: () => number
  schedule?: (callback: () => void, delayMs: number) => unknown
  cancelScheduled?: (handle: unknown) => void
}>): GameFpsSimulationClock {
  if (!Number.isFinite(options.minimumStepIntervalMs) || options.minimumStepIntervalMs < 0) {
    throw new Error('Game FPS simulation clock interval must be a non-negative finite number')
  }
  const now = options.now || (() => (
    typeof performance === 'undefined' ? Date.now() : performance.now()
  ))
  const schedule = options.schedule || ((callback: () => void, delayMs: number) => (
    globalThis.setTimeout(callback, delayMs)
  ))
  const cancelScheduled = options.cancelScheduled || ((handle: unknown) => {
    globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>)
  })
  let disposed = false
  let stepPending = false
  let stepRequested = false
  let scheduledStep: Readonly<{ handle: unknown }> | null = null
  let lastStepStartedAt = Number.NEGATIVE_INFINITY

  const drain = () => {
    if (disposed || stepPending || !stepRequested || scheduledStep) return
    const delayMs = Math.max(
      0,
      lastStepStartedAt + options.minimumStepIntervalMs - now(),
    )
    if (delayMs > 0) {
      const scheduled = { handle: undefined as unknown }
      scheduled.handle = schedule(() => {
        if (scheduledStep !== scheduled) return
        scheduledStep = null
        drain()
      }, delayMs)
      scheduledStep = scheduled
      return
    }
    stepRequested = false
    stepPending = true
    lastStepStartedAt = now()
    void Promise.resolve()
      .then(options.runStep)
      .catch(error => {
        if (!disposed) options.onStepError(error)
      })
      .finally(() => {
        stepPending = false
        drain()
      })
  }

  const requestStep = () => {
    if (disposed) return
    stepRequested = true
    drain()
  }

  return Object.freeze({
    requestStep,
    queueInputStep: requestStep,
    dispose() {
      disposed = true
      stepRequested = false
      if (scheduledStep) cancelScheduled(scheduledStep.handle)
      scheduledStep = null
    },
  })
}
