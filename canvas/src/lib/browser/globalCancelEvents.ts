export type GlobalCancelVisibilityBehavior = 'any' | 'hidden-only' | 'off'

export function subscribeGlobalCancelEvents(args: {
  listener: (event?: Event) => void
  capture?: boolean
  includePointerDown?: boolean
  includeLostPointerCapture?: boolean
  visibilityBehavior?: GlobalCancelVisibilityBehavior
}): () => void {
  const useCapture = args.capture === true
  const visibilityBehavior = args.visibilityBehavior || 'off'
  if (typeof window === 'undefined') return () => void 0

  const handle = (event: Event) => {
    args.listener(event)
  }
  const onVisibility = (event: Event) => {
    if (visibilityBehavior === 'off') return
    if (visibilityBehavior === 'hidden-only') {
      try {
        if (typeof document !== 'undefined' && document.visibilityState !== 'hidden') return
      } catch {
        return
      }
    }
    args.listener(event)
  }

  window.addEventListener('pointerup', handle, useCapture)
  window.addEventListener('pointercancel', handle, useCapture)
  if (args.includeLostPointerCapture === true) {
    window.addEventListener('lostpointercapture', handle, useCapture)
  }
  window.addEventListener('blur', handle, useCapture)
  if (args.includePointerDown === true) {
    window.addEventListener('pointerdown', handle, useCapture)
  }
  if (visibilityBehavior !== 'off' && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility, useCapture)
  }

  return () => {
    window.removeEventListener('pointerup', handle, useCapture)
    window.removeEventListener('pointercancel', handle, useCapture)
    if (args.includeLostPointerCapture === true) {
      window.removeEventListener('lostpointercapture', handle, useCapture)
    }
    window.removeEventListener('blur', handle, useCapture)
    if (args.includePointerDown === true) {
      window.removeEventListener('pointerdown', handle, useCapture)
    }
    if (visibilityBehavior !== 'off' && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility, useCapture)
    }
  }
}

export function subscribeGlobalCancelWatchdog(args: {
  listener: (event?: Event) => void
  capture?: boolean
  includePointerDown?: boolean
  includeLostPointerCapture?: boolean
  visibilityBehavior?: GlobalCancelVisibilityBehavior
  timeoutMs: number
}): () => void {
  const unsubscribeCancelEvents = subscribeGlobalCancelEvents(args)
  if (typeof window === 'undefined') return unsubscribeCancelEvents
  const timeoutMs = Number.isFinite(args.timeoutMs) ? Math.max(0, args.timeoutMs) : 0
  const watchdog = window.setTimeout(() => {
    args.listener()
  }, timeoutMs) as unknown as number
  return () => {
    unsubscribeCancelEvents()
    try {
      window.clearTimeout(watchdog)
    } catch {
      void 0
    }
  }
}

export function subscribeGlobalCancelIntervalWatchdog(args: {
  listener: (event?: Event) => void
  capture?: boolean
  includePointerDown?: boolean
  includeLostPointerCapture?: boolean
  visibilityBehavior?: GlobalCancelVisibilityBehavior
  intervalMs: number
}): () => void {
  const unsubscribeCancelEvents = subscribeGlobalCancelEvents(args)
  if (typeof window === 'undefined') return unsubscribeCancelEvents
  const intervalMs = Number.isFinite(args.intervalMs) ? Math.max(0, args.intervalMs) : 0
  const watchdog = window.setInterval(() => {
    args.listener()
  }, intervalMs) as unknown as number
  return () => {
    unsubscribeCancelEvents()
    try {
      window.clearInterval(watchdog)
    } catch {
      void 0
    }
  }
}
