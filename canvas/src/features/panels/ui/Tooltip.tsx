import React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  computeTooltipMaxWidthPx,
  computeTooltipPositionFromAnchor,
  constrainTooltipPosition,
  getTooltipPortalTarget,
} from '@/features/panels/ui/tooltipUtils'

interface TooltipProps {
  content: React.ReactNode
  className?: string
  children: React.ReactNode
  maxWidthFromPrevSibling?: boolean
  maxWidthPx?: number
  contentClassName?: string
  open?: boolean
  anchorStyle?: React.CSSProperties
}

export default function Tooltip({ content, className, children, maxWidthFromPrevSibling, maxWidthPx, contentClassName, open: controlledOpen, anchorStyle }: TooltipProps) {
  const anchorRef = React.useRef<HTMLSpanElement | null>(null)
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const open = typeof controlledOpen === 'boolean' ? controlledOpen : uncontrolledOpen
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null)
  const [maxW, setMaxW] = React.useState<number | undefined>(undefined)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const scrollTimerRef = React.useRef<number | null>(null)
  const scrollDelayRef = React.useRef<number | null>(null)
  const scrollAllowedRef = React.useRef<boolean>(false)
  const delayElapsedRef = React.useRef<boolean>(false)
  const constrainedRef = React.useRef<boolean>(false)

  const updatePosition = React.useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    constrainedRef.current = false
    setPos(computeTooltipPositionFromAnchor(el, 4))
    setMaxW(computeTooltipMaxWidthPx(el, { maxWidthFromPrevSibling, maxWidthPx, defaultMaxWidthPx: 250 }))
  }, [maxWidthFromPrevSibling, maxWidthPx])

  const onEnter = React.useCallback(() => {
    if (typeof controlledOpen === 'boolean') {
      updatePosition()
      return
    }
    updatePosition()
    setUncontrolledOpen(true)
  }, [controlledOpen, updatePosition])

  const onLeave = React.useCallback(() => {
    if (typeof controlledOpen === 'boolean') {
      return
    }
    setUncontrolledOpen(false)
  }, [controlledOpen])

  const stopScroll = React.useCallback(() => {
    if (scrollTimerRef.current !== null) {
      window.clearInterval(scrollTimerRef.current)
      scrollTimerRef.current = null
    }
    if (scrollDelayRef.current !== null) {
      window.clearTimeout(scrollDelayRef.current)
      scrollDelayRef.current = null
    }
    scrollAllowedRef.current = false
    delayElapsedRef.current = false
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [])

  const startScroll = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    if (scrollTimerRef.current !== null) return
    if (el.scrollHeight <= el.clientHeight) return
    if (!scrollAllowedRef.current) return
    scrollTimerRef.current = window.setInterval(() => {
      const maxScroll = el.scrollHeight - el.clientHeight
      if (maxScroll <= 0) return
      const next = el.scrollTop + 1
      if (next >= maxScroll) {
        el.scrollTop = 0
      } else {
        el.scrollTop = next
      }
    }, 30)
  }, [])

  React.useEffect(() => {
    if (!open) return
    updatePosition()
    let frame: number | null = null
    const h = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        updatePosition()
        frame = null
      })
    }
    window.addEventListener('scroll', h, true)
    window.addEventListener('resize', h, true)
    return () => {
      window.removeEventListener('scroll', h, true)
      window.removeEventListener('resize', h, true)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [open, updatePosition])

  React.useLayoutEffect(() => {
    if (!open) return
    if (!pos) return
    if (constrainedRef.current) return
    const tip = scrollRef.current
    const anchor = anchorRef.current
    if (!tip || !anchor) return
    const paddingPx = 8
    const viewportW = Math.max(1, window.innerWidth || 1)
    const viewportH = Math.max(1, window.innerHeight || 1)
    const rect = tip.getBoundingClientRect()
    const ar = anchor.getBoundingClientRect()
    const next = constrainTooltipPosition({
      pos,
      tooltipRect: rect,
      anchorRect: ar,
      viewportW,
      viewportH,
      paddingPx,
      offsetPx: 4,
    })
    if (next.left !== pos.left || next.top !== pos.top) {
      setPos(next)
    }
    constrainedRef.current = true
  }, [open, pos])

  React.useEffect(() => {
    if (!open) {
      stopScroll()
    }
    return () => {
      stopScroll()
    }
  }, [open, stopScroll])

  return (
    <>
      <span
        ref={anchorRef}
        className={cn('inline-flex items-center', className)}
        style={anchorStyle}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onFocusCapture={onEnter}
        onBlurCapture={onLeave}
      >
        {children}
      </span>
      {open && pos && createPortal(
        <div
          ref={scrollRef}
          className={cn(`px-2 py-1 text-xs rounded ${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text} whitespace-normal break-words overflow-hidden pointer-events-auto z-[10000]`, contentClassName)}
          style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-50%)', maxWidth: maxW ? `${maxW}px` : '250px' }}
          onMouseEnter={() => {
            if (scrollDelayRef.current !== null) return
            delayElapsedRef.current = false
            scrollDelayRef.current = window.setTimeout(() => {
              scrollDelayRef.current = null
              delayElapsedRef.current = true
              if (scrollAllowedRef.current) {
                startScroll()
              }
            }, 500)
          }}
          onMouseLeave={() => {
            stopScroll()
          }}
          onMouseMove={e => {
            const el = scrollRef.current
            if (!el) return
            const rect = el.getBoundingClientRect()
            const y = e.clientY - rect.top
            const frac = rect.height > 0 ? y / rect.height : 0.5
            const allow = frac > 0.25 && frac < 0.95
            scrollAllowedRef.current = allow
            if (!allow) {
              stopScroll()
              return
            }
            if (delayElapsedRef.current && scrollTimerRef.current === null) {
              startScroll()
            }
          }}
        >
          {content}
        </div>,
        getTooltipPortalTarget(anchorRef.current)
      )}
    </>
  )
}
