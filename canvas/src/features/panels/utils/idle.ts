export const IDLE_FALLBACK_MS = 200
export const scheduleIdle = (fn: () => void) => {
  type IdleCb = (cb: () => void) => void
  const ri = (window as { requestIdleCallback?: IdleCb }).requestIdleCallback
  if (typeof ri === 'function') ri(fn)
  else setTimeout(fn, IDLE_FALLBACK_MS)
}
