import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { clampOverlayTopLeftFullyInViewport } from '@/lib/ui/overlayClamp'
import { readOverlayElementSize, resolveOverlayVerticalTop } from '@/lib/ui/overlayPlacement'
import { Z_INDEX_ANCHOR_OVERLAY } from '@/lib/ui/zIndex'

type Align = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'bottom-center' | 'top-center'

interface AnchorOverlayProps {
  anchorRef: React.RefObject<HTMLElement>
  open: boolean
  onClose?: () => void
  align?: Align
  className?: string
  autoFocus?: boolean
  allowOverflowVisible?: boolean
  children: React.ReactNode
}

function createPortalRoot(): HTMLDivElement | null {
  if (typeof document === 'undefined') return null
  return document.createElement('div')
}

export function AnchorOverlay({
  anchorRef,
  open,
  onClose,
  align = 'bottom-right',
  className = '',
  autoFocus = true,
  allowOverflowVisible = false,
  children,
}: AnchorOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [portalRoot, setPortalRoot] = useState<HTMLDivElement | null>(() => createPortalRoot())
  const priorFocusedElementRef = useRef<HTMLElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  const updatePosition = React.useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const margin = 4
    const overlaySize = readOverlayElementSize(containerRef.current)
    const overlayWidth = overlaySize.width
    const overlayHeight = overlaySize.height
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1
    const top = resolveOverlayVerticalTop({
      anchorRect: r,
      overlayHeight,
      viewportHeight,
      margin,
      preferredPlacement: align.startsWith('bottom') ? 'bottom' : 'top',
    })
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

  useLayoutEffect(() => {
    if (!open) return
    if (portalRoot) return
    setPortalRoot(createPortalRoot())
  }, [open, portalRoot])

  useLayoutEffect(() => {
    if (!open) return
    if (!portalRoot) return
    if (typeof document === 'undefined') return
    if (!document.body) return
    try {
      if (!document.body.contains(portalRoot)) document.body.appendChild(portalRoot)
    } catch {
      void 0
    }
    return () => {
      try {
        if (portalRoot.parentNode) portalRoot.parentNode.removeChild(portalRoot)
      } catch {
        void 0
      }
    }
  }, [open, portalRoot])

  useEffect(() => {
    if (!open) return
    if (!autoFocus) return
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
  }, [autoFocus, open])

  const style = useMemo<React.CSSProperties>(
    () => ({
      position: 'fixed',
      top: pos.top,
      left: pos.left,
      zIndex: Z_INDEX_ANCHOR_OVERLAY,
      width: 'max-content',
      maxWidth: 'calc(100vw - var(--kg-safe-left, 0px) - var(--kg-safe-right, 0px) - 0.5rem)',
      maxHeight: 'var(--kg-overlay-max-height, calc(100dvh - var(--kg-safe-top, 0px) - var(--kg-safe-bottom, 0px) - 0.5rem))',
      overflow: allowOverflowVisible ? 'visible' : 'auto',
      overscrollBehavior: allowOverflowVisible ? undefined : 'contain',
      WebkitOverflowScrolling: allowOverflowVisible ? undefined : 'touch',
    }),
    [allowOverflowVisible, pos],
  )

  if (!open) return null
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
        className={['kg-anchor-overlay', className].filter(Boolean).join(' ')}
        data-kg-anchor-overlay="true"
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
