const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

const isClientPointInsideRect = (clientX: number, clientY: number, rect: DOMRect): boolean =>
  clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom

export function shouldIgnoreCanvasWheelEvent(args: { event: WheelEvent; ignoreSelector: string }): boolean {
  const { event, ignoreSelector } = args
  if (!ignoreSelector) return false
  if (typeof document === 'undefined') return false

  const clientX = (event as unknown as { clientX?: unknown }).clientX
  const clientY = (event as unknown as { clientY?: unknown }).clientY
  if (isFiniteNumber(clientX) && isFiniteNumber(clientY)) {
    const top = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(clientX, clientY) : null
    if (top && typeof (top as Element).closest === 'function') {
      if ((top as Element).closest(ignoreSelector)) return true
      return false
    }

    const ignoreNodes = document.querySelectorAll(ignoreSelector)
    if (ignoreNodes.length === 0) return false
    for (let i = 0; i < ignoreNodes.length; i += 1) {
      const el = ignoreNodes[i]
      if (!(el instanceof HTMLElement)) continue
      try {
        const styles = getComputedStyle(el)
        if (styles.display === 'none') continue
        if (styles.visibility === 'hidden') continue
        const opacity = Number.parseFloat(styles.opacity)
        if (Number.isFinite(opacity) && opacity <= 0.01) continue
        if (styles.pointerEvents === 'none') continue
      } catch {
        void 0
      }
      const rect = el.getBoundingClientRect()
      if (!(rect.width > 0 && rect.height > 0)) continue
      if (isClientPointInsideRect(clientX, clientY, rect)) return true
    }
    return false
  }

  const nativeTarget = (event as unknown as { target?: unknown }).target
  if (nativeTarget && nativeTarget instanceof Element) {
    if (nativeTarget.closest(ignoreSelector)) return true
  }

  const composedPath = (event as unknown as { composedPath?: (() => unknown[]) | undefined }).composedPath
  if (typeof composedPath === 'function') {
    const path = composedPath()
    for (let i = 0; i < path.length; i += 1) {
      const p = path[i]
      if (p instanceof Element && typeof p.closest === 'function') {
        if (p.closest(ignoreSelector)) return true
      }
    }
  }

  return false
}
