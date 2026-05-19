import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { clampOverlayTopLeftFullyInViewport } from '@/lib/ui/overlayClamp'
import { Z_INDEX_ANCHOR_OVERLAY } from '@/lib/ui/zIndex'

type Align = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'bottom-center' | 'top-center'

interface AnchorOverlayProps {
  anchorRef: React.RefObject<HTMLElement>
  open: boolean
  onClose?: () => void
  align?: Align
  className?: string
  children: React.ReactNode
}

function readOverlaySize(container: HTMLElement | null): { width: number; height: number } {
  if (!container) return { width: 1, height: 1 }
  const containerRect = container.getBoundingClientRect()
  const child = container.firstElementChild
  const childRect = child && typeof child.getBoundingClientRect === 'function' ? child.getBoundingClientRect() : null
  return {
    width: Math.max(1, containerRect.width || 0, childRect?.width || 0),
    height: Math.max(1, containerRect.height || 0, childRect?.height || 0),
  }
}

export function AnchorOverlay({ anchorRef, open, onClose, align = 'bottom-right', className = '', children }: AnchorOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const portalRootRef = useRef<HTMLDivElement | null>(null)
  const priorFocusedElementRef = useRef<HTMLElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  const updatePosition = React.useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const margin = 4
    const overlaySize = readOverlaySize(containerRef.current)
    const overlayWidth = overlaySize.width
    const overlayHeight = overlaySize.height
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1
    const top = align.startsWith('bottom') ? r.bottom + margin : r.top - margin - overlayHeight
    const left = align.endsWith('center')
      ? r.left + r.width / 2 - overlayWidth / 2
      : align.endsWith('right')
        ? r.right - overlayWidth
        : r.left
    const next = clampOverlayTopLeftFullyInViewport({
      pos: { top, left },
      size: { width: overlayWidth, height: overlayHeight },
      viewport: { width: viewportWidth, height: viewportHeight },
      snapPx: 1,
    })
    setPos(prev => (prev.top === next.top && prev.left === next.left ? prev : next))
  }, [align, anchorRef])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
  })

  useEffect(() => {
    if (!open) return
    updatePosition()
    const timeoutIds = [window.setTimeout(updatePosition, 0), window.setTimeout(updatePosition, 50)]
    return () => {
      timeoutIds.forEach(id => window.clearTimeout(id))
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    if (!onClose) return

    const openedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      onClose()
    }

    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
      if (now - openedAt < 120) return
      const anchorEl = anchorRef.current
      const containerEl = containerRef.current
      const t = e.target as Node | null
      if (!t) return
      if (anchorEl && anchorEl.contains(t)) return
      if (containerEl && containerEl.contains(t)) return
      onClose()
    }

    const handleReposition = () => {
      requestAnimationFrame(updatePosition)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousedown', handlePointerDown, true)
    window.addEventListener('scroll', handleReposition, true)
    window.addEventListener('resize', handleReposition)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousedown', handlePointerDown, true)
      window.removeEventListener('scroll', handleReposition, true)
      window.removeEventListener('resize', handleReposition)
    }
  }, [open, onClose, anchorRef, updatePosition])

  useEffect(() => {
    if (!open) return
    const containerEl = containerRef.current
    if (!containerEl) return
    updatePosition()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => updatePosition())
    observer.observe(containerEl)
    const child = containerEl.firstElementChild
    if (child instanceof HTMLElement) observer.observe(child)
    return () => observer.disconnect()
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const containerEl = containerRef.current
    if (!containerEl) return
    if (typeof MutationObserver === 'undefined') return
    const observer = new MutationObserver(() => updatePosition())
    observer.observe(containerEl, { attributes: true, childList: true, subtree: true })
    return () => observer.disconnect()
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    if (typeof document === 'undefined') return
    if (!document.body) return
    if (!portalRootRef.current) {
      portalRootRef.current = document.createElement('div')
    }
    const root = portalRootRef.current
    try {
      if (!document.body.contains(root)) document.body.appendChild(root)
    } catch {
      void 0
    }
    return () => {
      try {
        if (root.parentNode) root.parentNode.removeChild(root)
      } catch {
        void 0
      }
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const activeElement = typeof document !== 'undefined' ? document.activeElement : null
    priorFocusedElementRef.current = activeElement instanceof HTMLElement ? activeElement : null
    const rafId = requestAnimationFrame(() => {
      const containerEl = containerRef.current
      if (!containerEl) return
      const firstFocusable = containerEl.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      const target = firstFocusable || containerEl
      try {
        target.focus({ preventScroll: true })
      } catch {
        target.focus()
      }
    })
    return () => {
      cancelAnimationFrame(rafId)
      const target = priorFocusedElementRef.current
      priorFocusedElementRef.current = null
      if (!target) return
      try {
        target.focus({ preventScroll: true })
      } catch {
        target.focus()
      }
    }
  }, [open])

  const style = useMemo<React.CSSProperties>(
    () => ({
      position: 'fixed',
      top: pos.top,
      left: pos.left,
      zIndex: Z_INDEX_ANCHOR_OVERLAY,
      width: 'max-content',
      maxWidth: 'calc(100vw - var(--kg-safe-left, 0px) - var(--kg-safe-right, 0px) - 0.5rem)',
      maxHeight: 'calc(100dvh - var(--kg-safe-top, 0px) - var(--kg-safe-bottom, 0px) - 0.5rem)',
      overflow: 'auto',
      overscrollBehavior: 'contain',
    }),
    [pos],
  )

  if (!open) return null
  const portalRoot = portalRootRef.current
  if (!portalRoot) return null
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: Z_INDEX_ANCHOR_OVERLAY, pointerEvents: 'none', isolation: 'isolate' }}>
      <div
        ref={el => {
          containerRef.current = el
          if (!el) return
          updatePosition()
          if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => {
              updatePosition()
              window.requestAnimationFrame(updatePosition)
            })
          }
        }}
        style={{ ...style, pointerEvents: 'auto' }}
        className={className}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    portalRoot,
  )
}

interface DropdownPanelProps {
  anchorRef: React.RefObject<HTMLElement>
  open: boolean
  onClose?: () => void
  children: React.ReactNode
  align?: Align
}

export function DropdownPanel({ anchorRef, open, onClose, children, align = 'bottom-right' }: DropdownPanelProps) {
  void onClose
  return (
    <AnchorOverlay anchorRef={anchorRef} open={open} onClose={onClose} align={align}>
      {children}
    </AnchorOverlay>
  )
}
