export function debounce<TArgs extends unknown[]>(
  func: (...args: TArgs) => void,
  wait: number,
  options: { leading?: boolean; trailing?: boolean; maxWait?: number } = {},
): ((...args: TArgs) => void) & { cancel: () => void; flush: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let lastArgs: TArgs | null = null
  let lastCallTime: number | null = null
  let lastInvokeTime: number = 0

  const leading = !!options.leading
  const trailing = 'trailing' in options ? !!options.trailing : true
  const maxing = 'maxWait' in options
  const maxWait = maxing ? Math.max(options.maxWait || 0, wait) : 0

  function invokeFunc(time: number) {
    const args = lastArgs

    lastArgs = null
    lastInvokeTime = time

    func(...args!)
  }

  function leadingEdge(time: number) {
    lastInvokeTime = time
    timeoutId = setTimeout(timerExpired, wait)
    return leading ? invokeFunc(time) : undefined
  }

  function remainingWait(time: number) {
    const timeSinceLastCall = time - (lastCallTime || 0)
    const timeSinceLastInvoke = time - lastInvokeTime
    const timeWaiting = wait - timeSinceLastCall

    return maxing
      ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
      : timeWaiting
  }

  function shouldInvoke(time: number) {
    const timeSinceLastCall = time - (lastCallTime || 0)
    const timeSinceLastInvoke = time - lastInvokeTime

    return (
      lastCallTime === null ||
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0 ||
      (maxing && timeSinceLastInvoke >= maxWait)
    )
  }

  function timerExpired() {
    const time = Date.now()
    if (shouldInvoke(time)) {
      return trailingEdge(time)
    }
    timeoutId = setTimeout(timerExpired, remainingWait(time))
  }

  function trailingEdge(time: number) {
    timeoutId = null

    if (trailing && lastArgs) {
      return invokeFunc(time)
    }
    lastArgs = null
    return undefined
  }

  function cancel() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
    lastInvokeTime = 0
    lastArgs = null
    timeoutId = null
  }

  function flush() {
    if (timeoutId === null) {
      return undefined
    }
    return trailingEdge(Date.now())
  }

  function debounced(...args: TArgs) {
    const time = Date.now()
    const isInvoking = shouldInvoke(time)

    lastArgs = args
    lastCallTime = time

    if (isInvoking) {
      if (timeoutId === null) {
        return leadingEdge(time)
      }
      if (maxing) {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(timerExpired, wait)
        return invokeFunc(time)
      }
    }
    if (timeoutId === null) {
      timeoutId = setTimeout(timerExpired, wait)
    }
    return undefined
  }

  debounced.cancel = cancel
  debounced.flush = flush
  return debounced
}
