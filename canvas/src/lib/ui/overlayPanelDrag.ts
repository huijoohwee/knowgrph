import type React from 'react'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'

export type OverlayPanelDragPosition = {
  top: number
  left: number
}

export function beginOverlayPanelPositionDrag(args: {
  event: React.PointerEvent<HTMLElement>
  cursor?: string
  readStartPosition: () => OverlayPanelDragPosition | null
  clampPosition: (position: OverlayPanelDragPosition) => OverlayPanelDragPosition
  schedulePosition: (position: OverlayPanelDragPosition) => void
  flushPosition: () => void
  cancelPosition: () => void
  onDragStart?: (position: OverlayPanelDragPosition) => void
  onDragEnd?: () => void
  onDragCancel?: () => void
}) {
  const event = args.event
  if (event.pointerType === 'mouse' && event.button !== 0) return false
  const startPosition = args.readStartPosition()
  if (!startPosition) return false
  const start = {
    x: event.clientX,
    y: event.clientY,
    top: startPosition.top,
    left: startPosition.left,
  }
  const clampedStart = args.clampPosition(startPosition)
  args.onDragStart?.(clampedStart)
  startPointerDrag({
    ev: event.nativeEvent,
    cursor: args.cursor || 'grabbing',
    shouldStart: down => {
      if (down.pointerType === 'mouse' && down.button !== 0) return false
      return true
    },
    onMove: moveEvent => {
      args.schedulePosition(args.clampPosition({
        top: start.top + moveEvent.clientY - start.y,
        left: start.left + moveEvent.clientX - start.x,
      }))
    },
    onEnd: () => {
      args.flushPosition()
      args.onDragEnd?.()
    },
    onCancel: () => {
      args.cancelPosition()
      args.onDragCancel?.()
    },
  })
  return true
}
