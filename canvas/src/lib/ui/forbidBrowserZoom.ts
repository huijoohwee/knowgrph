import React from 'react'
import { installWheelForwardingAndBrowserZoomGuards } from 'grph-shared/dom/wheelGuards'

export function useForbidBrowserZoomWheel(
  targetRef: React.RefObject<HTMLElement | null>,
  enabled: boolean = true,
  opts?: { stopPropagation?: boolean },
) {
  React.useEffect(() => {
    if (!enabled) return
    const el = targetRef.current
    if (!el) return
    return installWheelForwardingAndBrowserZoomGuards(el, {
      stopPropagationOnForward: false,
      stopPropagationOnPreventZoom: opts?.stopPropagation !== false,
      forwardedFlagKey: '__kgForwarded',
    })
  }, [enabled, opts?.stopPropagation, targetRef])
}
