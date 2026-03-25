import { useEffect, useRef } from 'react'
import { PANEL_MIN_PX, PANEL_MAX_RATIO, PANEL_MIN_RATIO } from '@/features/panels/config'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { createRafLatestScheduler } from '@/lib/react/rafLatestScheduler'

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
    const scheduler = createRafLatestScheduler((mv: PointerEvent) => {
      const startY = startYRef.current
      const startRatio = startRatioRef.current
      if (startY == null || startRatio == null) return
      const dy = startY - mv.clientY
      const vh = window.innerHeight
      const dynamicMaxPx = Math.max(PANEL_MIN_PX, Math.min(vh * PANEL_MAX_RATIO, vh))
      const startPx = vh * startRatio
      const nextPxUnclamped = startPx + dy
      const nextPx = Math.max(PANEL_MIN_PX, Math.min(dynamicMaxPx, nextPxUnclamped))
      const nextRatio = Math.max(PANEL_MIN_RATIO, Math.min(PANEL_MAX_RATIO, nextPx / vh))
      pendingRatioRef.current = nextRatio
      setRatio(nextRatio)
    })

    const startYRef = { current: null as number | null }
    const startRatioRef = { current: null as number | null }
    const pendingRatioRef = { current: ratioRef.current as number }

    const onDown = (ev: PointerEvent) => {
      if (collapsedRef.current) return
      if (ev.button !== undefined && ev.button !== 0) return

      startYRef.current = ev.clientY
      startRatioRef.current = ratioRef.current
      pendingRatioRef.current = ratioRef.current

      const onMove: PointerMoveListener = (mv) => {
        scheduler.schedule(mv)
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
          scheduler.cancel()
          setRatio(pendingRatioRef.current)
        },
        onCancel: () => {
          scheduler.cancel()
          setRatio(pendingRatioRef.current)
        },
      })
    }
    el.addEventListener('pointerdown', onDown)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      scheduler.cancel()
    }
  }, [handleRef, setRatio, collapsed])
}
