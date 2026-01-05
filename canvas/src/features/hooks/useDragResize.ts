import { useEffect, useRef } from 'react'
import { PANEL_MIN_PX, PANEL_MAX_RATIO, PANEL_MIN_RATIO } from '@/features/panels/config'

type PointerMoveListener = (mv: PointerEvent) => void
type PointerListener = (ev: PointerEvent) => void

export function useDragResize({
  collapsed,
  ratio,
  setRatio,
  handleRef,
}: {
  collapsed: boolean
  ratio: number
  setRatio: (r: number) => void
  handleRef?: React.RefObject<HTMLElement>
}) {
  const ratioRef = useRef(ratio)
  const collapsedRef = useRef(collapsed)
  const pidRef = useRef<number | null>(null)
  const isDraggingRef = useRef(false)
  const originalBodyUserSelectRef = useRef<string | null>(null)
  const originalBodyCursorRef = useRef<string | null>(null)
  const originalDocumentUserSelectRef = useRef<string | null>(null)
  const originalDocumentCursorRef = useRef<string | null>(null)
  useEffect(() => { ratioRef.current = ratio }, [ratio])
  useEffect(() => { collapsedRef.current = collapsed }, [collapsed])

  useEffect(() => {
    const el = handleRef?.current
    if (!el) return
    const onMoveRef = { current: null as PointerMoveListener | null }
    const onUpRef = { current: null as PointerListener | null }
    const onCancelRef = { current: null as PointerListener | null }
    let rafId: number | null = null

    const onDown = (ev: PointerEvent) => {
      if (collapsedRef.current) return
      if (ev.button !== undefined && ev.button !== 0) return
      ev.preventDefault()
      ev.stopPropagation()
      const body = document.body
      const docEl = document.documentElement
      if (!isDraggingRef.current) {
        originalBodyUserSelectRef.current = body.style.userSelect
        originalBodyCursorRef.current = body.style.cursor
        originalDocumentUserSelectRef.current = docEl.style.userSelect
        originalDocumentCursorRef.current = docEl.style.cursor
      }
      isDraggingRef.current = true
      body.style.userSelect = 'none'
      body.style.cursor = 'row-resize'
      docEl.style.userSelect = 'none'
      docEl.style.cursor = 'row-resize'
      const selection = window.getSelection()
      if (selection) selection.removeAllRanges()
      type PointerCaptureEl = Element & { setPointerCapture?: (id: number) => void; releasePointerCapture?: (id: number) => void }
      try { (ev.target as PointerCaptureEl).setPointerCapture?.(ev.pointerId) } catch { void 0 }
      pidRef.current = ev.pointerId
      const startY = ev.clientY
      const startRatio = ratioRef.current
      const onMove: PointerMoveListener = (mv) => {
        if (pidRef.current !== null && mv.pointerId !== pidRef.current) return
        const run = () => {
          const dy = startY - mv.clientY
          const vh = window.innerHeight
          const dynamicMaxPx = Math.max(PANEL_MIN_PX, Math.min(vh * PANEL_MAX_RATIO, vh))
          const startPx = vh * startRatio
          const nextPxUnclamped = startPx + dy
          const nextPx = Math.max(PANEL_MIN_PX, Math.min(dynamicMaxPx, nextPxUnclamped))
          const nextRatio = Math.max(PANEL_MIN_RATIO, Math.min(PANEL_MAX_RATIO, nextPx / vh))
          setRatio(nextRatio)
        }
        if (rafId !== null) cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(run)
      }
      const cleanup = () => {
        if (onMoveRef.current) document.removeEventListener('pointermove', onMoveRef.current)
        if (onUpRef.current) document.removeEventListener('pointerup', onUpRef.current as EventListener)
        if (onCancelRef.current) document.removeEventListener('pointercancel', onCancelRef.current as EventListener)
        if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
        if (isDraggingRef.current) {
          const body = document.body
          const docEl = document.documentElement
          if (originalBodyUserSelectRef.current !== null) body.style.userSelect = originalBodyUserSelectRef.current
          else body.style.removeProperty('user-select')
          if (originalBodyCursorRef.current !== null) body.style.cursor = originalBodyCursorRef.current
          else body.style.removeProperty('cursor')
          if (originalDocumentUserSelectRef.current !== null) docEl.style.userSelect = originalDocumentUserSelectRef.current
          else docEl.style.removeProperty('user-select')
          if (originalDocumentCursorRef.current !== null) docEl.style.cursor = originalDocumentCursorRef.current
          else docEl.style.removeProperty('cursor')
        }
        isDraggingRef.current = false
        const tgt = ev.target as PointerCaptureEl
        try { tgt.releasePointerCapture?.(pidRef.current as number) } catch { void 0 }
        pidRef.current = null
      }
      const onUp: PointerListener = (up) => {
        if (pidRef.current !== null && up.pointerId !== pidRef.current) return
        cleanup()
      }
      const onCancel: PointerListener = (pc) => {
        if (pidRef.current !== null && pc.pointerId !== pidRef.current) return
        cleanup()
      }
      onMoveRef.current = onMove
      onUpRef.current = onUp
      onCancelRef.current = onCancel
      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', onUp as EventListener)
      document.addEventListener('pointercancel', onCancel as EventListener)
    }
    el.addEventListener('pointerdown', onDown)
    const onLostCapture = () => {
      if (onMoveRef.current) document.removeEventListener('pointermove', onMoveRef.current)
      if (onUpRef.current) document.removeEventListener('pointerup', onUpRef.current as EventListener)
      if (onCancelRef.current) document.removeEventListener('pointercancel', onCancelRef.current as EventListener)
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
      if (isDraggingRef.current) {
        const body = document.body
        const docEl = document.documentElement
        if (originalBodyUserSelectRef.current !== null) body.style.userSelect = originalBodyUserSelectRef.current
        else body.style.removeProperty('user-select')
        if (originalBodyCursorRef.current !== null) body.style.cursor = originalBodyCursorRef.current
        else body.style.removeProperty('cursor')
        if (originalDocumentUserSelectRef.current !== null) docEl.style.userSelect = originalDocumentUserSelectRef.current
        else docEl.style.removeProperty('user-select')
        if (originalDocumentCursorRef.current !== null) docEl.style.cursor = originalDocumentCursorRef.current
        else docEl.style.removeProperty('cursor')
      }
      isDraggingRef.current = false
      pidRef.current = null
    }
    el.addEventListener('lostpointercapture', onLostCapture as EventListener)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      if (onMoveRef.current) document.removeEventListener('pointermove', onMoveRef.current)
      if (onUpRef.current) document.removeEventListener('pointerup', onUpRef.current as EventListener)
      if (onCancelRef.current) document.removeEventListener('pointercancel', onCancelRef.current as EventListener)
      el.removeEventListener('lostpointercapture', onLostCapture as EventListener)
    }
  }, [handleRef, setRatio, collapsed])
}
