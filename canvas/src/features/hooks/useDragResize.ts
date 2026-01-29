import { useEffect, useRef } from 'react'
import { PANEL_MIN_PX, PANEL_MAX_RATIO, PANEL_MIN_RATIO } from '@/features/panels/config'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'

type PointerMoveListener = (mv: PointerEvent) => void

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
  useEffect(() => { ratioRef.current = ratio }, [ratio])
  useEffect(() => { collapsedRef.current = collapsed }, [collapsed])

  useEffect(() => {
    const el = handleRef?.current
    if (!el) return
    let rafId: number | null = null

    const onDown = (ev: PointerEvent) => {
      if (collapsedRef.current) return
      if (ev.button !== undefined && ev.button !== 0) return

      const startY = ev.clientY
      const startRatio = ratioRef.current
      let pendingRatio = startRatio

      const onMove: PointerMoveListener = (mv) => {
        const run = () => {
          const dy = startY - mv.clientY
          const vh = window.innerHeight
          const dynamicMaxPx = Math.max(PANEL_MIN_PX, Math.min(vh * PANEL_MAX_RATIO, vh))
          const startPx = vh * startRatio
          const nextPxUnclamped = startPx + dy
          const nextPx = Math.max(PANEL_MIN_PX, Math.min(dynamicMaxPx, nextPxUnclamped))
          const nextRatio = Math.max(PANEL_MIN_RATIO, Math.min(PANEL_MAX_RATIO, nextPx / vh))
          pendingRatio = nextRatio
          setRatio(nextRatio)
        }
        if (rafId !== null) cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(run)
      }

      startPointerDrag({
        ev,
        cursor: 'row-resize',
        shouldStart: down => {
          if (collapsedRef.current) return false
          if (down.button !== undefined && down.button !== 0) return false
          return true
        },
        onMove,
        onEnd: () => {
          if (rafId !== null) {
            cancelAnimationFrame(rafId)
            rafId = null
          }
          setRatio(pendingRatio)
        },
        onCancel: () => {
          if (rafId !== null) {
            cancelAnimationFrame(rafId)
            rafId = null
          }
          setRatio(pendingRatio)
        },
      })
    }
    el.addEventListener('pointerdown', onDown)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
    }
  }, [handleRef, setRatio, collapsed])
}
