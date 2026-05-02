export function subscribeWindowEscapeDismiss(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => void 0
  const handle = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    listener()
  }
  window.addEventListener('keydown', handle)
  return () => {
    window.removeEventListener('keydown', handle)
  }
}

export function subscribePointerDownDismiss(args: {
  listener: () => void
  root?: HTMLElement | null | undefined
  target?: 'window' | 'document'
  capture?: boolean
}): () => void {
  const eventTarget =
    args.target === 'window'
      ? typeof window !== 'undefined'
        ? window
        : null
      : typeof document !== 'undefined'
        ? document
        : null
  if (!eventTarget) return () => void 0
  const useCapture = args.capture === true
  const handle = (event: PointerEvent) => {
    const root = args.root
    if (root) {
      const target = event.target as Node | null
      if (!target || root.contains(target)) return
    }
    args.listener()
  }
  eventTarget.addEventListener('pointerdown', handle as EventListener, useCapture)
  return () => {
    eventTarget.removeEventListener('pointerdown', handle as EventListener, useCapture)
  }
}
