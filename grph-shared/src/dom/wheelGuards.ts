const WHEEL_SCROLLABLE_OVERFLOW_VALUES = new Set(['auto', 'scroll', 'overlay'])
export const LOCAL_WHEEL_OWNER_SELECTOR = '[data-kg-local-wheel-owner="1"]'

const isDomElement = (value: unknown): value is Element => {
  if (!value || typeof value !== 'object') return false
  if (typeof Element !== 'undefined') return value instanceof Element
  const rec = value as { nodeType?: unknown; parentElement?: unknown }
  return typeof rec.nodeType === 'number' && 'parentElement' in rec
}

const isDomHTMLElement = (value: Element): value is HTMLElement => {
  if (typeof HTMLElement !== 'undefined') return value instanceof HTMLElement
  const rec = value as unknown as { scrollHeight?: unknown; clientHeight?: unknown; style?: unknown }
  return typeof rec.scrollHeight === 'number' && typeof rec.clientHeight === 'number' && !!rec.style
}

const readWheelDelta = (event: WheelEvent, axis: 'x' | 'y'): number => {
  const raw = axis === 'x'
    ? (event as unknown as { deltaX?: unknown }).deltaX
    : (event as unknown as { deltaY?: unknown }).deltaY
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
}

const isElementScrollableForWheel = (node: HTMLElement, axis: 'x' | 'y'): boolean => {
  let overflowX = ''
  let overflowY = ''
  try {
    const styles = getComputedStyle(node)
    overflowX = String(styles.overflowX || '')
    overflowY = String(styles.overflowY || '')
  } catch {
    void 0
  }

  if (axis === 'y' && WHEEL_SCROLLABLE_OVERFLOW_VALUES.has(overflowY)) {
    const scrollHeight = Number(node.scrollHeight || 0)
    const clientHeight = Number(node.clientHeight || 0)
    return scrollHeight > clientHeight + 1
  }

  if (axis === 'x' && WHEEL_SCROLLABLE_OVERFLOW_VALUES.has(overflowX)) {
    const scrollWidth = Number(node.scrollWidth || 0)
    const clientWidth = Number(node.clientWidth || 0)
    return scrollWidth > clientWidth + 1
  }

  return false
}

const readWheelEventTargetElement = (event: Event): Element | null => {
  try {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : []
    for (const item of path) {
      if (isDomElement(item)) return item
    }
  } catch {
    void 0
  }

  const target = (event as unknown as { target?: unknown }).target
  return isDomElement(target) ? target : null
}

export function isLocalWheelOwnerEvent(event: Event, boundary?: Element | null): boolean {
  let current = readWheelEventTargetElement(event)
  const maxHops = 30
  for (let hops = 0; current && hops < maxHops; hops += 1) {
    if (current.matches(LOCAL_WHEEL_OWNER_SELECTOR)) return true
    if (boundary && current === boundary) break
    current = current.parentElement
  }
  return false
}

export type WheelScrollableTargetOptions = {
  allowModifierZoom?: boolean
}

export function shouldKeepWheelOnScrollableTarget(
  event: WheelEvent,
  boundary?: Element | null,
  opts?: WheelScrollableTargetOptions,
): boolean {
  const dx = readWheelDelta(event, 'x')
  const dy = readWheelDelta(event, 'y')
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return false

  // Explicit browser/canvas zoom gestures keep reaching the existing zoom guard unless a host
  // specifically needs inner panel scrolling to win over canvas zoom.
  if ((event.ctrlKey === true || event.metaKey === true) && opts?.allowModifierZoom !== false) return false

  let cur = readWheelEventTargetElement(event)
  const maxHops = 30
  for (let hops = 0; cur && hops < maxHops; hops += 1) {
    const node = isDomHTMLElement(cur) ? cur : null
    if (node) {
      if (dy !== 0 && isElementScrollableForWheel(node, 'y')) return true
      if (dx !== 0 && isElementScrollableForWheel(node, 'x')) return true
    }
    if (boundary && cur === boundary) break
    cur = cur.parentElement
  }

  return false
}

export type ScrollablePanelWheelEventLike = {
  ctrlKey?: boolean
  metaKey?: boolean
  preventDefault?: () => void
  stopPropagation?: () => void
}

export function consumeScrollablePanelWheelEvent(
  event: ScrollablePanelWheelEventLike,
  opts?: { preventModifierZoom?: boolean; stopPropagation?: boolean },
): void {
  if (opts?.stopPropagation !== false) {
    try {
      event.stopPropagation?.()
    } catch {
      void 0
    }
  }
  if (opts?.preventModifierZoom !== false && (event.ctrlKey === true || event.metaKey === true)) {
    try {
      event.preventDefault?.()
    } catch {
      void 0
    }
  }
}

export function installWheelForwardingAndBrowserZoomGuards(
  el: Element,
  opts?: {
    forwardWheelTo?: () => Element | null
    forwardWheelBeforeScrollableTarget?: boolean
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
  const forwardBeforeScrollableTarget = opts?.forwardWheelBeforeScrollableTarget === true

  const tryForwardWheel = (e: WheelEvent): boolean => {
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
    if (!forwardTo || !forwardAllowed) return false
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
    return true
  }

  const handleWheel = (e: WheelEvent) => {
    try {
      if ((e as unknown as Record<string, unknown>)[forwardedFlagKey] === true) return
    } catch {
      void 0
    }

    if (isLocalWheelOwnerEvent(e, el)) return

    if (forwardBeforeScrollableTarget && tryForwardWheel(e)) return

    if (shouldKeepWheelOnScrollableTarget(e, el)) return

    if (tryForwardWheel(e)) return

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
    if (isLocalWheelOwnerEvent(e, el)) return
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
