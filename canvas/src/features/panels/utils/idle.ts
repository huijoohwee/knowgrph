export const IDLE_FALLBACK_MS = 200
export const scheduleIdle = (fn: () => void) => {
  type IdleCb = (cb: () => void) => number
  const ri = (window as { requestIdleCallback?: IdleCb }).requestIdleCallback
  if (typeof ri === 'function') return ri(fn)
  return setTimeout(fn, IDLE_FALLBACK_MS)
}
