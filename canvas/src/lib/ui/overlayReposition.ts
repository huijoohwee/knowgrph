import type { RefObject } from 'react'
import { useEffect } from 'react'

type OverlayRepositionObserverArgs = {
  open: boolean
  rootRef: RefObject<HTMLElement | null>
  updatePosition: () => void
}

export const refreshOverlayPositionAfterMount = (updatePosition: () => void) => {
  updatePosition()
  if (typeof window.requestAnimationFrame !== 'function') return
  window.requestAnimationFrame(() => {
    updatePosition()
    window.requestAnimationFrame(updatePosition)
  })
}

export const useOverlayRepositionObservers = ({
  open,
  rootRef,
  updatePosition,
}: OverlayRepositionObserverArgs) => {
  useEffect(() => {
    if (!open) return
    const root = rootRef.current
    if (!root) return
    updatePosition()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => updatePosition())
    observer.observe(root)
    const child = root.firstElementChild
    if (child instanceof HTMLElement) observer.observe(child)
    return () => observer.disconnect()
  }, [open, rootRef, updatePosition])

  useEffect(() => {
    if (!open) return
    const root = rootRef.current
    if (!root) return
    if (typeof MutationObserver === 'undefined') return
    const observer = new MutationObserver(() => updatePosition())
    observer.observe(root, { attributes: true, childList: true, subtree: true })
    return () => observer.disconnect()
  }, [open, rootRef, updatePosition])
}
