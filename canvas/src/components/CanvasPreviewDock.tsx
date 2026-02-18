import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { VerticalResizeSeparatorHr } from '@/components/ui/VerticalResizeSeparatorHr'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { createRafValueScheduler } from '@/lib/react/rafValueScheduler'

export type CanvasPreviewDockProps = {
  children: React.ReactNode
  collapsed: boolean
  setCollapsed?: (next: boolean) => void
  widthPx: number
  setWidthPx: (next: number) => void
  collapsedWidthPx?: number
  minWidthPx?: number
  maxWidthPx?: number
  resizeAriaLabel?: string
  ariaLabel?: string
  ariaLabelCollapsed?: string
  frameAriaLabel?: string
}

export function CanvasPreviewDock(props: CanvasPreviewDockProps) {
  const {
    collapsed,
    setWidthPx,
    widthPx,
    collapsedWidthPx = 40,
    minWidthPx = 320,
    maxWidthPx = 960,
    resizeAriaLabel = 'Resize Canvas Preview',
    ariaLabel = 'Canvas Preview',
    ariaLabelCollapsed = 'Canvas Preview (collapsed)',
    frameAriaLabel = 'Canvas Preview frame',
  } = props

  const widthRef = React.useRef(widthPx)
  widthRef.current = widthPx
  const dragHandleRef = React.useRef<HTMLHRElement | null>(null)
  const rafSetWidthRef = React.useRef(createRafValueScheduler<number>(v => setWidthPx(v)))

  React.useEffect(() => {
    return () => {
      rafSetWidthRef.current.cancel()
    }
  }, [])

  React.useEffect(() => {
    const el = dragHandleRef.current
    if (!el) return
    const onDown = (ev: PointerEvent) => {
      if (ev.button !== undefined && ev.button !== 0) return
      if (collapsed) return
      const startX = ev.clientX
      const startWidth = widthRef.current
      let pending = startWidth
      startPointerDrag({
        ev,
        cursor: 'col-resize',
        shouldStart: down => {
          if (down.button !== undefined && down.button !== 0) return false
          return true
        },
        onMove: mv => {
          const dx = startX - mv.clientX
          const next = Math.max(minWidthPx, Math.min(maxWidthPx, Math.round(startWidth + dx)))
          pending = next
          rafSetWidthRef.current.schedule(next)
        },
        onEnd: () => {
          rafSetWidthRef.current.flush()
          setWidthPx(pending)
        },
        onCancel: () => {
          rafSetWidthRef.current.flush()
          setWidthPx(pending)
        },
      })
    }
    el.addEventListener('pointerdown', onDown)
    return () => el.removeEventListener('pointerdown', onDown)
  }, [collapsed, maxWidthPx, minWidthPx, setWidthPx])

  return (
    <>
      {collapsed ? null : (
        <VerticalResizeSeparatorHr
          ref={el => {
            dragHandleRef.current = el
          }}
          ariaLabel={resizeAriaLabel}
        />
      )}
      <aside
        className={`shrink min-w-0 min-h-0 ${UI_THEME_TOKENS.panel.bg} flex flex-col ${collapsed ? `border-l ${UI_THEME_TOKENS.panel.divider}` : ''}`}
        style={{ width: collapsed ? `${collapsedWidthPx}px` : `${widthPx}px` }}
        aria-label={collapsed ? ariaLabelCollapsed : ariaLabel}
      >
        <section
          className={`flex-1 min-h-0 overflow-hidden bg-[var(--kg-canvas-bg)] ${collapsed ? 'hidden' : ''}`}
          aria-label={frameAriaLabel}
        >
          {props.children}
        </section>
      </aside>
    </>
  )
}
