export const IDLE_FALLBACK_MS = 200

type IdleCallback = (cb: () => void) => number
type CancelIdleCallback = (handle: number) => void

export const scheduleIdle = (fn: () => void): number => {
  const ri = (globalThis as unknown as { requestIdleCallback?: IdleCallback }).requestIdleCallback
  if (typeof ri === 'function') return ri(fn)
  return window.setTimeout(fn, IDLE_FALLBACK_MS)
}

export const cancelIdle = (handle: number): void => {
  const ci = (globalThis as unknown as { cancelIdleCallback?: CancelIdleCallback }).cancelIdleCallback
  if (typeof ci === 'function') {
    ci(handle)
    return
  }
  window.clearTimeout(handle)
}

export const runInIdle = async <T,>(fn: () => T | Promise<T>, opts?: { timeoutMs?: number }): Promise<T> => {
  const timeoutMs = typeof opts?.timeoutMs === 'number' && Number.isFinite(opts.timeoutMs) ? Math.max(0, Math.floor(opts.timeoutMs)) : 350
  const ri = (globalThis as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number }).requestIdleCallback
  if (typeof ri === 'function') {
    return await new Promise<T>((resolve, reject) => {
      ri(async () => {
        try {
          resolve(await fn())
        } catch (e) {
          reject(e)
        }
      }, { timeout: timeoutMs })
    })
  }
  await new Promise<void>(resolve => window.setTimeout(resolve, 0))
  return await fn()
}
