import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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

export function AnchorOverlay({ anchorRef, open, onClose, align = 'bottom-right', className = '', children }: AnchorOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const portalRootRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!open) return
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const margin = 4
    let top = 0
    let left = 0
    if (align.startsWith('bottom')) top = r.bottom + margin
    else top = r.top - margin
    if (align.endsWith('center')) left = r.left + r.width / 2
    else if (align.endsWith('right')) left = r.right
    else left = r.left
    setPos({ top, left })
  }, [open, anchorRef, align])

  useEffect(() => {
    if (!open) return
    if (!onClose) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      onClose()
    }

    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      const anchorEl = anchorRef.current
      const containerEl = containerRef.current
      const t = e.target as Node | null
      if (!t) return
      if (anchorEl && anchorEl.contains(t)) return
      if (containerEl && containerEl.contains(t)) return
      onClose()
    }

    const handleReposition = () => {
      requestAnimationFrame(() => {
        const el = anchorRef.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const margin = 4
        let top = 0
        let left = 0
        if (align.startsWith('bottom')) top = r.bottom + margin
        else top = r.top - margin
        if (align.endsWith('center')) left = r.left + r.width / 2
        else if (align.endsWith('right')) left = r.right
        else left = r.left
        setPos({ top, left })
      })
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
  }, [open, onClose, anchorRef, align])

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

  const style = useMemo<React.CSSProperties>(
    () => ({
      position: 'fixed',
      top: pos.top,
      left: pos.left,
      zIndex: Z_INDEX_ANCHOR_OVERLAY,
      transform: (() => {
        const tx = align.endsWith('center') ? '-50%' : '0%'
        const ty = align.startsWith('top') ? '-100%' : '0%'
        if (tx === '0%' && ty === '0%') return undefined
        if (tx !== '0%' && ty !== '0%') return `translate(${tx}, ${ty})`
        if (tx !== '0%') return `translateX(${tx})`
        return `translateY(${ty})`
      })(),
    }),
    [pos, align],
  )

  if (!open) return null
  const portalRoot = portalRootRef.current
  if (!portalRoot) return null
  return createPortal(
    <div ref={containerRef} style={style} className={className}>
      {children}
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
