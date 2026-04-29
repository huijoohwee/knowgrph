export function installWheelForwardingAndBrowserZoomGuards(
  el: Element,
  opts?: {
    forwardWheelTo?: () => Element | null
    shouldForwardWheel?: (e: WheelEvent) => boolean
    stopPropagationOnForward?: boolean
    stopPropagationOnPreventZoom?: boolean
    forwardedFlagKey?: string
  },
): () => void {
  const forwardedFlagKey = String(opts?.forwardedFlagKey || '__kgForwarded')
  const stopPropOnForward = opts?.stopPropagationOnForward !== false
  const stopPropOnPreventZoom = opts?.stopPropagationOnPreventZoom === true
  const getForwardTo = typeof opts?.forwardWheelTo === 'function' ? opts.forwardWheelTo : null
  const shouldForwardWheel = typeof opts?.shouldForwardWheel === 'function' ? opts.shouldForwardWheel : null

  const handleWheel = (e: WheelEvent) => {
    try {
      if ((e as unknown as Record<string, unknown>)[forwardedFlagKey] === true) return
    } catch {
      void 0
    }

    const forwardTo = getForwardTo ? getForwardTo() : null
    const forwardAllowed = (() => {
      if (!forwardTo) return false
      if (!shouldForwardWheel) return true
      try {
        return shouldForwardWheel(e) === true
      } catch {
        return false
      }
    })()
    if (forwardTo && forwardAllowed) {
      try {
        e.preventDefault()
      } catch {
        void 0
      }
      if (stopPropOnForward) {
        try {
          e.stopPropagation()
        } catch {
          void 0
        }
      }
      try {
        const ev = new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          clientX: e.clientX,
          clientY: e.clientY,
          deltaX: e.deltaX,
          deltaY: e.deltaY,
          deltaZ: e.deltaZ,
          deltaMode: e.deltaMode,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
        })
        ;(ev as unknown as Record<string, unknown>)[forwardedFlagKey] = true
        forwardTo.dispatchEvent(ev)
      } catch {
        void 0
      }
      return
    }

    if (e.ctrlKey !== true && e.metaKey !== true) return
    try {
      e.preventDefault()
    } catch {
      void 0
    }
    if (stopPropOnPreventZoom) {
      try {
        e.stopPropagation()
      } catch {
        void 0
      }
    }
  }

  const handleGesture = (e: Event) => {
    try {
      e.preventDefault()
    } catch {
      void 0
    }
    if (stopPropOnPreventZoom) {
      try {
        e.stopPropagation()
      } catch {
        void 0
      }
    }
  }

  el.addEventListener('wheel', handleWheel as EventListener, { passive: false, capture: true })
  el.addEventListener('gesturestart', handleGesture as EventListener, { passive: false, capture: true } as AddEventListenerOptions)
  el.addEventListener('gesturechange', handleGesture as EventListener, { passive: false, capture: true } as AddEventListenerOptions)
  el.addEventListener('gestureend', handleGesture as EventListener, { passive: false, capture: true } as AddEventListenerOptions)

  return () => {
    el.removeEventListener('wheel', handleWheel as EventListener, { capture: true } as EventListenerOptions)
    el.removeEventListener('gesturestart', handleGesture as EventListener, { capture: true } as EventListenerOptions)
    el.removeEventListener('gesturechange', handleGesture as EventListener, { capture: true } as EventListenerOptions)
    el.removeEventListener('gestureend', handleGesture as EventListener, { capture: true } as EventListenerOptions)
  }
}
