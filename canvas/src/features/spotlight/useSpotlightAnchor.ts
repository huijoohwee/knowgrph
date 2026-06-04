import React from 'react'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { createRafOnceScheduler } from '@/lib/react/rafOnceScheduler'
import { createRafValueScheduler } from '@/lib/react/rafValueScheduler'

type Point = { top: number; left: number }

interface SpotlightAnchorOptions {
  enabled: boolean
  dismissed: boolean
  ready: boolean
  selector: string | null
}

export function useSpotlightAnchor({ enabled, dismissed, ready, selector }: SpotlightAnchorOptions) {
  const [anchor, setAnchor] = React.useState<Point | null>(null)
  const [dragPos, setDragPos] = React.useState<Point | null>(null)
  const dragStateRef = React.useRef<{
    startX: number
    startY: number
    startTop: number
    startLeft: number
  } | null>(null)
  const dragSchedulerRef = React.useRef(createRafValueScheduler((pos: Point) => setDragPos(pos)))
  const highlightRef = React.useRef<HTMLElement | null>(null)
  const observerRef = React.useRef<MutationObserver | null>(null)
  const cardRef = React.useRef<HTMLElement | null>(null)

  const clearObserver = React.useCallback(() => {
    const existing = observerRef.current
    if (existing) {
      existing.disconnect()
      observerRef.current = null
    }
  }, [])

  const updateAnchor = React.useCallback(() => {
    if (!enabled || dismissed || !ready) {
      clearObserver()
      setAnchor(null)
      setDragPos(null)
      const prev = highlightRef.current
      if (prev) {
        prev.classList.remove('kg-spotlight-halo')
        highlightRef.current = null
      }
      return
    }
    const prev = highlightRef.current
    if (!selector) {
      clearObserver()
      setAnchor(null)
      setDragPos(null)
      if (prev) {
        prev.classList.remove('kg-spotlight-halo')
        highlightRef.current = null
      }
      return
    }
    const el = document.querySelector(selector) as HTMLElement | null
    if (!el) {
      setAnchor(null)
      setDragPos(null)
      if (prev) {
        prev.classList.remove('kg-spotlight-halo')
        highlightRef.current = null
      }
      if (typeof MutationObserver !== 'undefined' && !observerRef.current) {
        const observer = new MutationObserver(() => {
          const nextEl = document.querySelector(selector) as HTMLElement | null
          if (!nextEl) return
          updateAnchor()
        })
        observer.observe(document.body, { childList: true, subtree: true })
        observerRef.current = observer
      }
      return
    }
    clearObserver()
    if (prev && prev !== el) {
      prev.classList.remove('kg-spotlight-halo')
    }
    el.classList.add('kg-spotlight-halo')
    if (typeof el.scrollIntoView === 'function') {
      try {
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
      } catch {
        void 0
      }
    }
    highlightRef.current = el
    const rect = el.getBoundingClientRect()
    setAnchor({
      top: rect.top,
      left: rect.left + rect.width / 2,
    })
    setDragPos(null)
  }, [enabled, dismissed, ready, selector, clearObserver])

  React.useEffect(() => {
    updateAnchor()
  }, [updateAnchor])

  React.useEffect(() => {
    if (!enabled || dismissed || !ready || !selector) return
    const scheduler = createRafOnceScheduler(updateAnchor)
    const handle = () => scheduler.schedule()
    window.addEventListener('resize', handle)
    window.addEventListener('scroll', handle, true)
    return () => {
      clearObserver()
      window.removeEventListener('resize', handle)
      window.removeEventListener('scroll', handle, true)
      scheduler.cancel()
    }
  }, [enabled, dismissed, ready, selector, updateAnchor, clearObserver])

  const handleCardPointerDown = React.useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const target = event.target as HTMLElement | null
    if (target) {
      const interactive = target.closest(
        'button, a, input, textarea, select, option, summary, [role="button"], [role="link"], [data-kg-spotlight-ignore-drag="true"]',
      )
      if (interactive) return
    }
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const startTop = rect.top + rect.height / 2
    const startLeft = rect.left + rect.width / 2
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startTop,
      startLeft,
    }
    setDragPos({ top: startTop, left: startLeft })

    const scheduler = dragSchedulerRef.current

    startPointerDrag({
      ev: event.nativeEvent,
      cursor: 'grabbing',
      shouldStart: down => {
        if (down.pointerType === 'mouse' && down.button !== 0) return false
        return true
      },
      onMove: mv => {
        const state = dragStateRef.current
        if (!state) return
        const dx = mv.clientX - state.startX
        const dy = mv.clientY - state.startY
        scheduler.schedule({
          top: state.startTop + dy,
          left: state.startLeft + dx,
        })
      },
      onEnd: () => {
        dragStateRef.current = null
        scheduler.flush()
      },
      onCancel: () => {
        dragStateRef.current = null
        scheduler.cancel()
      },
    })
  }, [])

  return { anchor, dragPos, cardRef, handleCardPointerDown }
}
