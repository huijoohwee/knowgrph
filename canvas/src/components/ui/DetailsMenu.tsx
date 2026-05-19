import React from 'react'
import { createPortal } from 'react-dom'
import { clampOverlayTopLeftFullyInViewport } from '@/lib/ui/overlayClamp'
import { readOverlayElementSize, resolveOverlayVerticalTop } from '@/lib/ui/overlayPlacement'
import { Z_INDEX_MENU } from '@/lib/ui/zIndex'

export type DetailsMenuApi = {
  close: () => void
}

export type DetailsMenuProps = {
  ariaLabel: string
  detailsClassName?: string
  summaryClassName?: string
  menuClassName?: string
  summary: React.ReactNode
  menu: React.ReactNode | ((api: DetailsMenuApi) => React.ReactNode)
  shouldToggleFromSummaryEvent?: (e: React.MouseEvent<HTMLElement>) => boolean
  onSummaryPointerDown?: (e: React.PointerEvent<HTMLElement>) => void
  portal?: boolean
  portalPlacement?: 'bottom-start' | 'bottom-end'
  portalGapPx?: number
}

export const DetailsMenu = React.memo(function DetailsMenu(props: DetailsMenuProps) {
  const detailsRef = React.useRef<HTMLDetailsElement | null>(null)
  const summaryRef = React.useRef<HTMLElement | null>(null)
  const portalRootRef = React.useRef<HTMLDivElement | null>(null)
  const [isOpen, setIsOpen] = React.useState(false)
  const [portalStyle, setPortalStyle] = React.useState<React.CSSProperties | null>(null)

  const close = React.useCallback(() => {
    const el = detailsRef.current
    if (!el) return
    el.open = false
    setIsOpen(false)
  }, [])

  const menu = typeof props.menu === 'function' ? props.menu({ close }) : props.menu

  const updatePortalPosition = React.useCallback(() => {
    const anchor = summaryRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const gap = typeof props.portalGapPx === 'number' ? props.portalGapPx : 8
    const placement = props.portalPlacement || 'bottom-start'
    const viewportWidth =
      typeof window !== 'undefined'
        ? window.innerWidth || document.documentElement.clientWidth || 0
        : 0
    const viewportHeight =
      typeof window !== 'undefined'
        ? window.innerHeight || document.documentElement.clientHeight || 0
        : 0
    const menuSize = readOverlayElementSize(portalRootRef.current)
    const desiredTop = viewportHeight > 0
      ? resolveOverlayVerticalTop({
          anchorRect: rect,
          overlayHeight: menuSize.height,
          viewportHeight,
          margin: gap,
          preferredPlacement: 'bottom',
        })
      : rect.bottom + gap
    const desiredLeft = placement === 'bottom-end' ? rect.right - menuSize.width : rect.left

    const next: React.CSSProperties = {
      position: 'fixed',
      width: 'max-content',
      maxWidth: 'calc(100vw - var(--kg-safe-left, 0px) - var(--kg-safe-right, 0px) - 1rem)',
      maxHeight: 'calc(100dvh - var(--kg-safe-top, 0px) - var(--kg-safe-bottom, 0px) - 1rem)',
      overflow: 'auto',
      overscrollBehavior: 'contain',
    }
    if (viewportWidth > 0 && viewportHeight > 0) {
      const clamped = clampOverlayTopLeftFullyInViewport({
        pos: { top: desiredTop - gap, left: desiredLeft - gap },
        size: menuSize,
        viewport: {
          width: Math.max(1, viewportWidth - gap * 2),
          height: Math.max(1, viewportHeight - gap * 2),
        },
        snapPx: 1,
      })
      next.top = clamped.top + gap
      next.left = clamped.left + gap
    } else {
      next.top = Math.round(desiredTop)
      next.left = Math.round(desiredLeft)
    }
    setPortalStyle(prev => {
      if (!prev) return next
      if (prev.top === next.top && prev.left === next.left && prev.maxWidth === next.maxWidth && prev.maxHeight === next.maxHeight) return prev
      return next
    })
  }, [props.portalGapPx, props.portalPlacement])

  React.useEffect(() => {
    if (!props.portal) return
    if (!isOpen) return
    updatePortalPosition()

    const openedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()

    let rafId: number | null = null
    const schedule = () => {
      if (rafId != null) return
      rafId = window.requestAnimationFrame(() => {
        rafId = null
        updatePortalPosition()
      })
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      close()
    }
    const onPointerDown = (e: PointerEvent) => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
      if (now - openedAt < 120) return
      const target = e.target as Node | null
      const details = detailsRef.current
      const portalRoot = portalRootRef.current
      if (props.portal && !portalRoot) return
      if (details && target && details.contains(target)) return
      if (portalRoot && target && portalRoot.contains(target)) return
      close()
    }

    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      if (rafId != null) window.cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [close, isOpen, props.portal, updatePortalPosition])

  React.useEffect(() => {
    if (!props.portal || !isOpen) return
    const root = portalRootRef.current
    if (!root) return
    updatePortalPosition()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => updatePortalPosition())
    observer.observe(root)
    const child = root.firstElementChild
    if (child instanceof HTMLElement) observer.observe(child)
    return () => observer.disconnect()
  }, [isOpen, props.portal, updatePortalPosition])

  React.useEffect(() => {
    if (!props.portal || !isOpen) return
    const root = portalRootRef.current
    if (!root) return
    if (typeof MutationObserver === 'undefined') return
    const observer = new MutationObserver(() => updatePortalPosition())
    observer.observe(root, { attributes: true, childList: true, subtree: true })
    return () => observer.disconnect()
  }, [isOpen, props.portal, updatePortalPosition])

  return (
    <details
      ref={detailsRef}
      className={props.detailsClassName || ''}
      onToggle={e => {
        const next = (e.currentTarget as HTMLDetailsElement).open
        setIsOpen(next)
        if (next && props.portal) {
          try {
            updatePortalPosition()
            requestAnimationFrame(() => updatePortalPosition())
          } catch {
            void 0
          }
        }
      }}
    >
      <summary
        className={props.summaryClassName || ''}
        aria-label={props.ariaLabel}
        ref={el => {
          summaryRef.current = el
        }}
        onPointerDown={props.onSummaryPointerDown}
        onClickCapture={
          props.shouldToggleFromSummaryEvent
            ? (e) => {
                const allow = props.shouldToggleFromSummaryEvent?.(e)
                if (allow) return
                e.preventDefault()
                const details = detailsRef.current
                if (details?.open) details.open = false
                try {
                  setTimeout(() => {
                    const d = detailsRef.current
                    if (d?.open) d.open = false
                  }, 0)
                } catch {
                  void 0
                }
              }
            : undefined
        }
      >
        {props.summary}
      </summary>
      <div
        aria-hidden="true"
        className={props.menuClassName || ''}
        style={{ display: props.portal ? 'none' : undefined }}
      >
        {props.portal ? null : menu}
      </div>

      {props.portal && isOpen && menu && portalStyle
        ? createPortal(
            <div style={{ position: 'fixed', inset: 0, zIndex: Z_INDEX_MENU, pointerEvents: 'none', isolation: 'isolate' }}>
              <div
                ref={el => {
                  portalRootRef.current = el
                  if (!el) return
                  updatePortalPosition()
                  if (typeof window.requestAnimationFrame === 'function') {
                    window.requestAnimationFrame(() => {
                      updatePortalPosition()
                      window.requestAnimationFrame(updatePortalPosition)
                    })
                  }
                }}
                style={{ ...portalStyle, pointerEvents: 'auto' }}
              >
                {menu}
              </div>
            </div>,
            document.body,
          )
        : null}
    </details>
  )
})
