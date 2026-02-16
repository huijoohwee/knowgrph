export function startPointerDrag(args: {
  ev: PointerEvent
  cursor: string
  shouldStart?: (ev: PointerEvent) => boolean
  onMove: (ev: PointerEvent) => void
  onEnd?: (ev: PointerEvent) => void
  onCancel?: (ev: PointerEvent) => void
}) {
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
  const body = document.body
  const docEl = document.documentElement

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
    target.removeEventListener('lostpointercapture', handleLostCapture)
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

  const handleMove = (mv: PointerEvent) => {
    if (!active) return
    if (pointerId != null && mv.pointerId !== pointerId) return
    onMove(mv)
  }

  const handleUp = (up: PointerEvent) => {
    if (pointerId != null && up.pointerId !== pointerId) return
    try {
      onEnd?.(up)
    } finally {
      cleanup()
    }
  }

  const handleCancel = (pc: PointerEvent) => {
    if (pointerId != null && pc.pointerId !== pointerId) return
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

  window.addEventListener('pointermove', handleMove)
  window.addEventListener('pointerup', handleUp)
  window.addEventListener('pointercancel', handleCancel)
  target.addEventListener('lostpointercapture', handleLostCapture)
}
