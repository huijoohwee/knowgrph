import React from 'react'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'

export type RichMediaPanelResizeHandlers = {
  onResizeStart?: (args: { pointerId: number; clientX: number; clientY: number }) => void
  onResize?: (args: { pointerId: number; clientX: number; clientY: number; dx: number; dy: number }) => void
  onResizeEnd?: (args: { pointerId: number; clientX: number; clientY: number }) => void
}

export function beginRichMediaPanelResizeDrag(
  args: RichMediaPanelResizeHandlers & {
    event: React.PointerEvent<HTMLElement>
    onBeforeStart?: (event: PointerEvent) => void
  },
): boolean {
  const event = args.event
  if (event.button !== 0) return false
  const native = event.nativeEvent
  const pointerId = native.pointerId
  const x0 = native.clientX
  const y0 = native.clientY
  try {
    args.onBeforeStart?.(native)
  } catch {
    void 0
  }
  try {
    event.preventDefault()
    event.stopPropagation()
  } catch {
    void 0
  }
  try {
    args.onResizeStart?.({ pointerId, clientX: x0, clientY: y0 })
  } catch {
    void 0
  }
  startPointerDrag({
    ev: native,
    cursor: 'nwse-resize',
    onMove: nextEvent => {
      try {
        args.onResize?.({
          pointerId: nextEvent.pointerId,
          clientX: nextEvent.clientX,
          clientY: nextEvent.clientY,
          dx: nextEvent.clientX - x0,
          dy: nextEvent.clientY - y0,
        })
      } catch {
        void 0
      }
    },
    onEnd: nextEvent => {
      try {
        args.onResizeEnd?.({
          pointerId: nextEvent.pointerId,
          clientX: nextEvent.clientX,
          clientY: nextEvent.clientY,
        })
      } catch {
        void 0
      }
    },
    onCancel: nextEvent => {
      try {
        args.onResizeEnd?.({
          pointerId: nextEvent.pointerId,
          clientX: nextEvent.clientX,
          clientY: nextEvent.clientY,
        })
      } catch {
        void 0
      }
    },
  })
  return true
}

export function RichMediaPanelResizeHandle(props: {
  onPointerDown: React.PointerEventHandler<HTMLButtonElement>
  placement?: 'root' | 'panel'
  style?: React.CSSProperties
}) {
  return (
    <button
      type="button"
      aria-label="Resize"
      data-kg-resize-handle="se"
      data-kg-rich-media-resize-handle="1"
      data-kg-rich-media-resize-placement={props.placement || 'root'}
      data-kg-canvas-wheel-ignore="true"
      data-kg-overlay-pan-ignore="true"
      data-kg-canvas-overlay-control="true"
      style={{
        position: 'absolute',
        right: 0,
        bottom: 0,
        width: 22,
        height: 22,
        background: 'transparent',
        cursor: 'nwse-resize',
        pointerEvents: 'auto',
        zIndex: 20,
        ...(props.style || null),
      }}
      onPointerDown={props.onPointerDown}
    >
      <span
        aria-hidden="true"
        data-kg-rich-media-resize-handle-shape="corner"
        style={{
          position: 'absolute',
          right: 5,
          bottom: 5,
          width: 9,
          height: 9,
          borderRadius: 0,
          background: 'transparent',
          borderRight: '1px solid var(--kg-text-tertiary, rgba(100, 116, 139, 0.6))',
          borderBottom: '1px solid var(--kg-text-tertiary, rgba(100, 116, 139, 0.6))',
          boxShadow: 'none',
          opacity: 0.72,
          transition: 'var(--kg-transition-group-resize-dot)',
        }}
      />
    </button>
  )
}
