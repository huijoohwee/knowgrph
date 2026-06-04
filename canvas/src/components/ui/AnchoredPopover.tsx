import React from 'react'
import { createPortal } from 'react-dom'

import { clampOverlayTopLeftFullyInViewport } from '@/lib/ui/overlayClamp'
import { resolveOverlayVerticalTop } from '@/lib/ui/overlayPlacement'
import { useBodyPortalRoot } from '@/lib/ui/overlayPortalRoot'
import { buildNonBlockingPortalLayerStyle, withInteractivePortalContentStyle } from '@/lib/ui/overlayPortalStyle'
import { Z_INDEX_MENU } from '@/lib/ui/zIndex'

export type AnchoredPopoverPlacement = 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'

export type AnchoredPopoverProps = {
  open: boolean
  anchorEl: HTMLElement | null
  ariaLabel: string
  placement?: AnchoredPopoverPlacement
  gapPx?: number
  minWidthPx?: number
  maxWidthPx?: number
  maxHeightPx?: number
  zIndex?: number
  onClose: () => void
  children: React.ReactNode
}

export const AnchoredPopover = React.memo(function AnchoredPopover(props: AnchoredPopoverProps) {
  const rootRef = React.useRef<HTMLElement | null>(null)
  const [style, setStyle] = React.useState<React.CSSProperties | null>(null)
  const portalHost = useBodyPortalRoot(props.open)

  const updatePosition = React.useCallback(() => {
    const anchor = props.anchorEl
    if (!anchor || !anchor.isConnected) return
    const rect = anchor.getBoundingClientRect()

    const gap = typeof props.gapPx === 'number' ? props.gapPx : 8
    const placement = props.placement || 'top-start'
    const minWidth = typeof props.minWidthPx === 'number' ? props.minWidthPx : 240
    const maxWidth = typeof props.maxWidthPx === 'number' ? props.maxWidthPx : 420
    const maxHeight = typeof props.maxHeightPx === 'number' ? props.maxHeightPx : 360

    const viewportW = typeof window !== 'undefined' ? window.innerWidth : 0
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 0
    const padding = 8
    const availableWidth = Math.max(1, viewportW - padding * 2)
    const availableHeight = Math.max(1, viewportH - padding * 2)
    const width = Math.min(availableWidth, Math.max(minWidth, Math.min(maxWidth, Math.round(rect.width))))
    const safeMaxHeight = Math.min(maxHeight, availableHeight)

    const desiredTop = resolveOverlayVerticalTop({
      anchorRect: rect,
      overlayHeight: safeMaxHeight,
      viewportHeight: viewportH,
      margin: gap,
      preferredPlacement: placement.startsWith('top') ? 'top' : 'bottom',
    })
    const desiredLeft = placement.endsWith('end') ? rect.right - width : rect.left
    const clamped = clampOverlayTopLeftFullyInViewport({
      pos: { top: desiredTop, left: desiredLeft },
      size: { width, height: safeMaxHeight },
      viewport: { width: Math.max(1, viewportW), height: Math.max(1, viewportH) },
      snapPx: 1,
    })

    const next: React.CSSProperties = {
      position: 'fixed',
      width,
      maxHeight: safeMaxHeight,
      top: clamped.top,
      left: clamped.left,
      overflow: 'auto',
      overscrollBehavior: 'contain',
    }

    setStyle(prev => {
      if (!prev) return next
      if (
        prev.top === next.top &&
        prev.left === next.left &&
        prev.width === next.width &&
        prev.maxHeight === next.maxHeight
      ) {
        return prev
      }
      return next
    })
  }, [props.anchorEl, props.gapPx, props.maxHeightPx, props.maxWidthPx, props.minWidthPx, props.placement])

  React.useEffect(() => {
    if (!props.open) return
    if (!props.anchorEl) return
    if (!props.anchorEl.isConnected) {
      props.onClose()
      return
    }
    updatePosition()

    const openedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()

    let rafId: number | null = null
    const schedule = () => {
      if (rafId != null) return
      rafId = window.requestAnimationFrame(() => {
        rafId = null
        if (!props.open) return
        if (!props.anchorEl?.isConnected) {
          props.onClose()
          return
        }
        updatePosition()
      })
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      props.onClose()
    }

    const onPointerDown = (e: PointerEvent) => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
      if (now - openedAt < 120) return
      const target = e.target as Node | null
      if (!target) return
      const anchor = props.anchorEl
      const root = rootRef.current
      if (anchor && anchor.contains(target)) return
      if (root && root.contains(target)) return
      props.onClose()
    }

    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      if (rafId != null) {
        try {
          window.cancelAnimationFrame(rafId)
        } catch {
          void 0
        }
        rafId = null
      }
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [props.anchorEl, props.onClose, props.open, updatePosition])

  if (!props.open || !style || !portalHost) return null

  const zIndex = typeof props.zIndex === 'number' ? props.zIndex : Z_INDEX_MENU

  return createPortal(
    <section style={buildNonBlockingPortalLayerStyle(zIndex)}>
      <section
        ref={el => {
          rootRef.current = el
        }}
        style={withInteractivePortalContentStyle(style)}
        className="kg-anchored-popover"
        role="dialog"
        aria-label={props.ariaLabel}
      >
        {props.children}
      </section>
    </section>,
    portalHost,
  )
})
