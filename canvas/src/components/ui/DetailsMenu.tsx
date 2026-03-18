import React from 'react'
import { createPortal } from 'react-dom'
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
    const top = Math.round(rect.bottom + gap)
    const placement = props.portalPlacement || 'bottom-start'

    const next: React.CSSProperties = {
      position: 'fixed',
      top,
      zIndex: Z_INDEX_MENU,
      pointerEvents: 'auto',
    }
    if (placement === 'bottom-end') {
      next.left = Math.round(rect.right)
      next.transform = 'translateX(-100%)'
    } else {
      next.left = Math.round(rect.left)
    }
    setPortalStyle(prev => {
      if (!prev) return next
      if (prev.top === next.top && prev.left === next.left && prev.transform === next.transform) return prev
      return next
    })
  }, [props.portalGapPx, props.portalPlacement])

  React.useEffect(() => {
    if (!props.portal) return
    if (!isOpen) return
    updatePortalPosition()

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

  return (
    <details
      ref={detailsRef}
      className={props.detailsClassName || ''}
      onToggle={e => {
        const next = (e.currentTarget as HTMLDetailsElement).open
        setIsOpen(next)
        if (next && props.portal) {
          try {
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
            <div
              ref={el => {
                portalRootRef.current = el
              }}
              style={portalStyle}
            >
              {menu}
            </div>,
            document.body,
          )
        : null}
    </details>
  )
})
