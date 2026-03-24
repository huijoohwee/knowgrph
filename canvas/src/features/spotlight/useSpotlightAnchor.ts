import React from 'react'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'

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
  const dragRafRef = React.useRef<number | null>(null)
  const pendingDragPosRef = React.useRef<Point | null>(null)
  const highlightRef = React.useRef<HTMLElement | null>(null)
  const observerRef = React.useRef<MutationObserver | null>(null)
  const cardRef = React.useRef<HTMLDivElement | null>(null)

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
    let frame: number | null = null
    const handle = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        updateAnchor()
        frame = null
      })
    }
    window.addEventListener('resize', handle)
    window.addEventListener('scroll', handle, true)
    return () => {
      clearObserver()
      window.removeEventListener('resize', handle)
      window.removeEventListener('scroll', handle, true)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [enabled, dismissed, ready, selector, updateAnchor, clearObserver])

  const handleCardPointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
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

    const flush = () => {
      const next = pendingDragPosRef.current
      pendingDragPosRef.current = null
      dragRafRef.current = null
      if (!next) return
      setDragPos(next)
    }

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
        pendingDragPosRef.current = {
          top: state.startTop + dy,
          left: state.startLeft + dx,
        }
        if (dragRafRef.current == null) dragRafRef.current = window.requestAnimationFrame(flush)
      },
      onEnd: () => {
        dragStateRef.current = null
        if (dragRafRef.current != null) {
          window.cancelAnimationFrame(dragRafRef.current)
          dragRafRef.current = null
        }
        if (pendingDragPosRef.current) {
          setDragPos(pendingDragPosRef.current)
          pendingDragPosRef.current = null
        }
      },
      onCancel: () => {
        dragStateRef.current = null
        if (dragRafRef.current != null) {
          window.cancelAnimationFrame(dragRafRef.current)
          dragRafRef.current = null
        }
        if (pendingDragPosRef.current) {
          setDragPos(pendingDragPosRef.current)
          pendingDragPosRef.current = null
        }
      },
    })
  }, [])

  return { anchor, dragPos, cardRef, handleCardPointerDown }
}
