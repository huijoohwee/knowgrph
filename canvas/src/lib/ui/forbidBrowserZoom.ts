import React from 'react'

export function useForbidBrowserZoomWheel(
  targetRef: React.RefObject<HTMLElement | null>,
  enabled: boolean = true,
) {
  React.useEffect(() => {
    if (!enabled) return
    const el = targetRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey !== true && e.metaKey !== true) return
      try {
        e.preventDefault()
      } catch {
        void 0
      }
      try {
        e.stopPropagation()
      } catch {
        void 0
      }
    }

    const handleGesture = (e: Event) => {
      try {
        e.preventDefault()
      } catch {
        void 0
      }
    }

    el.addEventListener('wheel', handleWheel, { passive: false, capture: true })
    el.addEventListener('gesturestart', handleGesture, { passive: false, capture: true } as AddEventListenerOptions)
    el.addEventListener('gesturechange', handleGesture, { passive: false, capture: true } as AddEventListenerOptions)
    el.addEventListener('gestureend', handleGesture, { passive: false, capture: true } as AddEventListenerOptions)

    return () => {
      el.removeEventListener('wheel', handleWheel, { capture: true } as EventListenerOptions)
      el.removeEventListener('gesturestart', handleGesture, { capture: true } as EventListenerOptions)
      el.removeEventListener('gesturechange', handleGesture, { capture: true } as EventListenerOptions)
      el.removeEventListener('gestureend', handleGesture, { capture: true } as EventListenerOptions)
    }
  }, [enabled, targetRef])
}

