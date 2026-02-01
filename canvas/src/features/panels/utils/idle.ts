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
