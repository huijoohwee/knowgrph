export function startPointerDrag(args: {
  ev: PointerEvent
  cursor: string
  shouldStart?: (ev: PointerEvent) => boolean
  onMove: (ev: PointerEvent) => void
  onEnd?: (ev: PointerEvent) => void
  onCancel?: (ev: PointerEvent) => void
}) {
  const installUnstickHandler = (() => {
    const g = globalThis as unknown as {
      __kgPointerDragUnstickInstalled?: unknown
      __kgActivePointerDragByKey?: unknown
    }
    if (g.__kgPointerDragUnstickInstalled === true) return
    g.__kgPointerDragUnstickInstalled = true
    if (typeof window === 'undefined') return
    window.addEventListener(
      'pointerdown',
      (e: PointerEvent) => {
        const map = g.__kgActivePointerDragByKey as unknown as Map<string, () => void> | undefined
        if (!map || map.size === 0) return
        const t = (e as unknown as { target?: unknown }).target
        if (!(t instanceof Element)) return
        const isCanvas = !!t.closest('[data-kg-canvas-interactive="1"],svg[data-kg-canvas-interactive="1"]')
        if (!isCanvas) return
        const cleanups = Array.from(map.values())
        map.clear()
        for (let i = 0; i < cleanups.length; i += 1) {
          const fn = cleanups[i]
          if (typeof fn !== 'function') continue
          try {
            fn()
          } catch {
            void 0
          }
        }
      },
      { capture: true },
    )
  })
  void installUnstickHandler
  const { ev, cursor, shouldStart, onMove, onEnd, onCancel } = args

  if (shouldStart && shouldStart(ev) === false) return
  if (typeof window === 'undefined') return
  if (typeof document === 'undefined') return

  ev.preventDefault()
  ev.stopPropagation()

  const target = ev.target as (Element & {
    setPointerCapture?: (id: number) => void
    releasePointerCapture?: (id: number) => void
    addEventListener: (type: string, listener: EventListener, opts?: unknown) => void
    removeEventListener: (type: string, listener: EventListener, opts?: unknown) => void
  })

  const pointerId = typeof (ev as unknown as { pointerId?: unknown }).pointerId === 'number' ? ev.pointerId : null
  const dragKey = pointerId != null ? `pid:${pointerId}` : 'pid:mouse'
  const startButtons = typeof (ev as unknown as { buttons?: unknown }).buttons === 'number' ? ev.buttons : 1
  const body = document.body
  const docEl = document.documentElement

  const globalMap = ((globalThis as unknown as { __kgActivePointerDragByKey?: unknown }).__kgActivePointerDragByKey ||= new Map()) as Map<
    string,
    () => void
  >
  const prev = globalMap.get(dragKey)
  if (typeof prev === 'function') {
    try {
      prev()
    } catch {
      void 0
    }
  }

  const originalBodyUserSelect = body.style.userSelect
  const originalBodyCursor = body.style.cursor
  const originalDocUserSelect = docEl.style.userSelect
  const originalDocCursor = docEl.style.cursor

  body.style.userSelect = 'none'
  body.style.cursor = cursor
  docEl.style.userSelect = 'none'
  docEl.style.cursor = cursor

  const selection = window.getSelection()
  if (selection) selection.removeAllRanges()

  if (pointerId != null) {
    try {
      target.setPointerCapture?.(pointerId)
    } catch {
      void 0
    }
  }

  let active = true
  const cleanup = () => {
    if (!active) return
    active = false
    window.removeEventListener('pointermove', handleMove)
    window.removeEventListener('pointerup', handleUp)
    window.removeEventListener('pointercancel', handleCancel)
    window.removeEventListener('blur', handleWindowBlur)
    target.removeEventListener('lostpointercapture', handleLostCapture)
    try {
      const cur = globalMap.get(dragKey)
      if (cur === cleanup) globalMap.delete(dragKey)
    } catch {
      void 0
    }
    body.style.userSelect = originalBodyUserSelect
    body.style.cursor = originalBodyCursor
    docEl.style.userSelect = originalDocUserSelect
    docEl.style.cursor = originalDocCursor
    if (pointerId != null) {
      try {
        target.releasePointerCapture?.(pointerId)
      } catch {
        void 0
      }
    }
  }

  const cancelIfTargetDetached = (ev: PointerEvent): boolean => {
    if (!active) return true
    const connected = (() => {
      const maybe = target as unknown as { isConnected?: unknown }
      if (typeof maybe.isConnected === 'boolean') return maybe.isConnected
      try {
        return document.contains(target)
      } catch {
        return false
      }
    })()
    if (connected) return false
    try {
      onCancel?.(ev)
    } finally {
      cleanup()
    }
    return true
  }

  const handleMove = (mv: PointerEvent) => {
    if (!active) return
    if (pointerId != null && mv.pointerId !== pointerId) return
    if (cancelIfTargetDetached(mv)) return
    const buttons = typeof (mv as unknown as { buttons?: unknown }).buttons === 'number' ? mv.buttons : startButtons
    const pt = typeof (mv as unknown as { pointerType?: unknown }).pointerType === 'string' ? String((mv as any).pointerType) : ''
    if (startButtons !== 0 && buttons === 0 && (!pt || pt === 'mouse')) {
      try {
        onCancel?.(mv)
      } finally {
        cleanup()
      }
      return
    }
    onMove(mv)
  }

  const handleUp = (up: PointerEvent) => {
    if (pointerId != null && up.pointerId !== pointerId) return
    if (cancelIfTargetDetached(up)) return
    try {
      onEnd?.(up)
    } finally {
      cleanup()
    }
  }

  const handleCancel = (pc: PointerEvent) => {
    if (pointerId != null && pc.pointerId !== pointerId) return
    if (cancelIfTargetDetached(pc)) return
    try {
      onCancel?.(pc)
    } finally {
      cleanup()
    }
  }

  const handleLostCapture = (lost: Event) => {
    if (!active) return
    const ev = lost as unknown as PointerEvent
    try {
      onCancel?.(ev)
    } finally {
      cleanup()
    }
  }

  const handleWindowBlur = () => {
    if (!active) return
    try {
      onCancel?.(ev)
    } finally {
      cleanup()
    }
  }

  window.addEventListener('pointermove', handleMove)
  window.addEventListener('pointerup', handleUp)
  window.addEventListener('pointercancel', handleCancel)
  window.addEventListener('blur', handleWindowBlur)
  target.addEventListener('lostpointercapture', handleLostCapture)

  try {
    globalMap.set(dragKey, cleanup)
  } catch {
    void 0
  }
}
