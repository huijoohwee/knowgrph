import type React from 'react'
import { isLocalWheelOwnerEvent } from 'grph-shared/dom/wheelGuards'

export function captureRichMediaPanelBoundaryEvent(event: React.SyntheticEvent): void {
  if (event.type === 'wheel' && isLocalWheelOwnerEvent(event.nativeEvent)) return
  const target = event.target instanceof Element ? event.target : null
  if (event.type === 'contextmenu' && target?.closest('[data-kg-rich-media-interaction-owner="1"]')) return
  try {
    event.stopPropagation()
  } catch {
    void 0
  }
}
