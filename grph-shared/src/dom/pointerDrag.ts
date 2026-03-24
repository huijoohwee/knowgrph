let activePointerDragCount = 0

const setPointerDragActiveClass = (active: boolean) => {
  try {
    if (typeof document === 'undefined') return
    const body = document.body
    if (!body || !body.classList) return
    if (active) body.classList.add('kg-pointer-drag-active')
    else body.classList.remove('kg-pointer-drag-active')
  } catch {
    void 0
  }
}

export function startPointerDrag(args: {
  ev: PointerEvent
  cursor: string
  shouldStart?: (ev: PointerEvent) => boolean
  onMove: (ev: PointerEvent) => void
  onEnd?: (ev: PointerEvent) => void
  onCancel?: (ev: PointerEvent) => void
}) {
  ;(() => {
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
        try {
          if (typeof document === 'undefined') return
          const els = Array.from(
            document.querySelectorAll('[data-kg-canvas-interactive="1"],svg[data-kg-canvas-interactive="1"]'),
          ) as unknown as Array<{ __kgViewportControllerDestroy?: (() => void) | null }>
          for (let i = 0; i < els.length; i += 1) {
            const el = els[i]
            const destroy = el?.__kgViewportControllerDestroy
            if (typeof destroy !== 'function') continue
            try {
              destroy()
            } catch {
              void 0
            }
          }
        } catch {
          void 0
        }
      },
      { capture: true },
    )
  })()
  const { ev, cursor, shouldStart, onMove, onEnd, onCancel } = args

  if (shouldStart && shouldStart(ev) === false) return
  if (typeof window === 'undefined') return
  if (typeof document === 'undefined') return

  ev.preventDefault()
  ev.stopPropagation()

  const startClientX = typeof (ev as unknown as { clientX?: unknown }).clientX === 'number' ? ev.clientX : 0
  const startClientY = typeof (ev as unknown as { clientY?: unknown }).clientY === 'number' ? ev.clientY : 0

  const resolvedTarget = (() => {
    const direct = (ev as unknown as { target?: unknown }).target
    if (direct instanceof Element) return direct
    try {
      const pe = (direct as unknown as { parentElement?: unknown }).parentElement
      if (pe instanceof Element) return pe
    } catch {
      void 0
    }
    try {
      const path = (ev as unknown as { composedPath?: () => unknown[] }).composedPath?.()
      if (Array.isArray(path)) {
        for (let i = 0; i < path.length; i += 1) {
          const p = path[i]
          if (p instanceof Element) return p
        }
      }
    } catch {
      void 0
    }
    return null
  })()

  const docEl = document.documentElement
  const target = (resolvedTarget || docEl) as Element & {
    setPointerCapture?: (id: number) => void
    releasePointerCapture?: (id: number) => void
    addEventListener: (type: string, listener: EventListener, opts?: unknown) => void
    removeEventListener: (type: string, listener: EventListener, opts?: unknown) => void
    isConnected?: boolean
  }

  const pointerId = typeof (ev as unknown as { pointerId?: unknown }).pointerId === 'number' ? ev.pointerId : null
  const dragKey = pointerId != null ? `pid:${pointerId}` : 'pid:mouse'
  const startButtons = typeof (ev as unknown as { buttons?: unknown }).buttons === 'number' ? ev.buttons : 1
  const body = document.body

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
  activePointerDragCount += 1
  if (activePointerDragCount === 1) setPointerDragActiveClass(true)

  const selection = window.getSelection()
  if (selection) selection.removeAllRanges()

  const captureTarget = (() => {
    if (pointerId == null) return null
    try {
      if (typeof target.setPointerCapture === 'function') {
        target.setPointerCapture(pointerId)
        return target
      }
    } catch {
      void 0
    }
    try {
      if (typeof docEl.setPointerCapture === 'function') {
        docEl.setPointerCapture(pointerId)
        return docEl as unknown as typeof target
      }
    } catch {
      void 0
    }
    return null
  })()

  let active = true
  let watchdog: number | null = null
  let clickSuppressed = false
  const suppressNextClickCapture = (e: Event) => {
    try {
      ;(e as unknown as { preventDefault?: () => void }).preventDefault?.()
    } catch {
      void 0
    }
    try {
      ;(e as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.()
    } catch {
      void 0
    }
    try {
      ;(e as unknown as { stopPropagation?: () => void }).stopPropagation?.()
    } catch {
      void 0
    }
  }
  const cleanup = () => {
    if (!active) return
    active = false
    window.removeEventListener('pointermove', handleMove)
    window.removeEventListener('pointerup', handleUp)
    window.removeEventListener('pointercancel', handleCancel)
    window.removeEventListener('blur', handleWindowBlur)
    ;(captureTarget || target).removeEventListener('lostpointercapture', handleLostCapture)
    if (watchdog != null) {
      try {
        window.clearTimeout(watchdog)
      } catch {
        void 0
      }
      watchdog = null
    }
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
    activePointerDragCount = Math.max(0, activePointerDragCount - 1)
    if (activePointerDragCount === 0) setPointerDragActiveClass(false)
    if (pointerId != null) {
      try {
        captureTarget?.releasePointerCapture?.(pointerId)
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

    try {
      mv.preventDefault()
    } catch {
      void 0
    }
    try {
      mv.stopPropagation()
    } catch {
      void 0
    }

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
      up.preventDefault()
    } catch {
      void 0
    }
    try {
      up.stopPropagation()
    } catch {
      void 0
    }
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
      pc.preventDefault()
    } catch {
      void 0
    }
    try {
      pc.stopPropagation()
    } catch {
      void 0
    }
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
  ;(captureTarget || target).addEventListener('lostpointercapture', handleLostCapture)

  if (!clickSuppressed) {
    clickSuppressed = true
    try {
      window.addEventListener('click', suppressNextClickCapture, { capture: true, once: true })
      window.addEventListener('auxclick', suppressNextClickCapture, { capture: true, once: true })
    } catch {
      void 0
    }
  }

  watchdog = window.setTimeout(() => {
    if (!active) return
    try {
      onCancel?.(ev)
    } finally {
      cleanup()
    }
  }, 12000) as unknown as number

  try {
    globalMap.set(dragKey, cleanup)
  } catch {
    void 0
  }
}
