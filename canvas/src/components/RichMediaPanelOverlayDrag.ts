import type React from 'react'
import {
  isOverlayPanStartButtonEvent,
  readOverlayPointerTargetState,
  shouldBlockOverlayPanTarget,
} from 'grph-shared/dom/overlayPointerGuards'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { installWheelForwardingAndBrowserZoomGuards } from 'grph-shared/dom/wheelGuards'

export type RichMediaPanelHeaderDragHandlers = {
  shouldStartHeaderDrag?: (e: PointerEvent) => boolean
  onHeaderDragStart?: (args: { pointerId: number; clientX: number; clientY: number }) => void
  onHeaderDrag?: (args: { pointerId: number; clientX: number; clientY: number; dx: number; dy: number }) => void
  onHeaderDragEnd?: (args: { pointerId: number; clientX: number; clientY: number }) => void
}

export type RichMediaPanelOverlayPanHandlers = {
  shouldForwardPointerDown?: (e: PointerEvent) => boolean
  onOverlayPanStart?: (args: { pointerId: number; clientX: number; clientY: number; buttons: number; shiftKey: boolean }) => void
  onOverlayPan?: (args: { pointerId: number; clientX: number; clientY: number; dx: number; dy: number; buttons: number; shiftKey: boolean }) => void
  onOverlayPanEnd?: (args: { pointerId: number; clientX: number; clientY: number; buttons: number; shiftKey: boolean }) => void
  onPointerDownCapture?: React.PointerEventHandler<HTMLElement>
}

export const installRichMediaOverlayWheelForwarding = (
  element: Element,
  options: {
    forwardWheelBeforeScrollableTarget?: boolean
    forwardWheelTo?: () => Element | null
    forwardedFlagKey?: string
    shouldForwardWheel?: (e: WheelEvent) => boolean
    stopPropagationOnForward?: boolean
    stopPropagationOnPreventZoom?: boolean
  },
): (() => void) => installWheelForwardingAndBrowserZoomGuards(element, options)

const readDragPointerId = (native: PointerEvent | MouseEvent): number => {
  const raw = (native as unknown as { pointerId?: unknown }).pointerId
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : -1
}

const readButtons = (native: PointerEvent | MouseEvent): number =>
  typeof native.buttons === 'number' ? native.buttons : 0

const tryPreventDragEvent = (e: React.SyntheticEvent): void => {
  try {
    e.preventDefault()
    e.stopPropagation()
  } catch {
    void 0
  }
}

export const startRichMediaPanelHeaderDrag = (
  native: PointerEvent | MouseEvent,
  handlers: RichMediaPanelHeaderDragHandlers,
): boolean => {
  if (typeof handlers.shouldStartHeaderDrag === 'function') {
    try {
      if (handlers.shouldStartHeaderDrag(native as PointerEvent) !== true) return false
    } catch {
      return false
    }
  }
  const pointerId = readDragPointerId(native)
  const x0 = native.clientX
  const y0 = native.clientY
  try {
    handlers.onHeaderDragStart?.({ pointerId, clientX: x0, clientY: y0 })
  } catch {
    void 0
  }
  startPointerDrag({
    ev: native as PointerEvent,
    cursor: 'grabbing',
    onMove: ev => {
      try {
        handlers.onHeaderDrag?.({ pointerId, clientX: ev.clientX, clientY: ev.clientY, dx: ev.clientX - x0, dy: ev.clientY - y0 })
      } catch {
        void 0
      }
    },
    onEnd: ev => {
      try {
        handlers.onHeaderDragEnd?.({ pointerId, clientX: ev.clientX, clientY: ev.clientY })
      } catch {
        void 0
      }
    },
    onCancel: ev => {
      try {
        handlers.onHeaderDragEnd?.({ pointerId, clientX: ev.clientX, clientY: ev.clientY })
      } catch {
        void 0
      }
    },
  })
  return true
}

export const handleRichMediaPanelOverlayDragStartCapture = (args: {
  event: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>
  installHeaderDrag: boolean
  installOverlayPan: boolean
  selectSelf: (native: PointerEvent | null) => void
  startHeaderDrag: (native: PointerEvent | MouseEvent) => boolean
  handlers: RichMediaPanelOverlayPanHandlers
}): boolean => {
  const native = args.event.nativeEvent as PointerEvent | MouseEvent
  args.selectSelf(native as PointerEvent)
  const pointerTarget = readOverlayPointerTargetState((native as unknown as { target?: EventTarget | null }).target)
  const scrollSurfaceCanForwardPointer = pointerTarget.isScrollSurface && typeof args.handlers.shouldForwardPointerDown === 'function'
    ? args.handlers.shouldForwardPointerDown(native as PointerEvent) === true
    : false
  const blockOverlayPanForTarget = shouldBlockOverlayPanTarget(pointerTarget, { scrollSurfaceCanForwardPointer })
  if (pointerTarget.isHeader && !blockOverlayPanForTarget && args.startHeaderDrag(native)) {
    tryPreventDragEvent(args.event)
    return true
  }
  if (!pointerTarget.isHeader && !blockOverlayPanForTarget && args.installOverlayPan && isOverlayPanStartButtonEvent(native)) {
    const pointerId = readDragPointerId(native)
    const x0 = native.clientX
    const y0 = native.clientY
    try {
      args.handlers.onOverlayPanStart?.({ pointerId, clientX: x0, clientY: y0, buttons: readButtons(native), shiftKey: native.shiftKey === true })
    } catch {
      void 0
    }
    startPointerDrag({
      ev: native as PointerEvent,
      cursor: 'grabbing',
      onMove: ev => {
        try {
          args.handlers.onOverlayPan?.({ pointerId, clientX: ev.clientX, clientY: ev.clientY, dx: ev.clientX - x0, dy: ev.clientY - y0, buttons: readButtons(ev), shiftKey: ev.shiftKey === true })
        } catch {
          void 0
        }
      },
      onEnd: ev => {
        try {
          args.handlers.onOverlayPanEnd?.({ pointerId, clientX: ev.clientX, clientY: ev.clientY, buttons: readButtons(ev), shiftKey: ev.shiftKey === true })
        } catch {
          void 0
        }
      },
      onCancel: ev => {
        try {
          args.handlers.onOverlayPanEnd?.({ pointerId, clientX: ev.clientX, clientY: ev.clientY, buttons: readButtons(ev), shiftKey: ev.shiftKey === true })
        } catch {
          void 0
        }
      },
    })
    return true
  }
  if (!(pointerTarget.isHeader && args.installHeaderDrag)) {
    try {
      if ('pointerId' in native) args.handlers.onPointerDownCapture?.(args.event as React.PointerEvent<HTMLElement>)
    } catch {
      void 0
    }
  }
  return false
}
