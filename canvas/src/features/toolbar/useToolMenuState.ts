import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import { LS_KEYS, UI_LAYOUT } from '@/lib/config'
import { lsBool } from '@/lib/persistence'
import { clampOverlayTopLeftToViewport } from '@/lib/ui/overlayClamp'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'

type ToolMenuDragPosition = {
  top: number
  left: number
}

export function useToolMenuState() {
  const [isToolMenuOpen, setIsToolMenuOpen] = useState(false)

  const toolMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const toolMenuCardRef = useRef<HTMLElement | null>(null)
  const [toolMenuDragPos, setToolMenuDragPos] = useState<ToolMenuDragPosition | null>(null)
  const toolMenuDragStateRef = useRef<{
    startX: number
    startY: number
    startTop: number
    startLeft: number
  } | null>(null)
  const dragRafRef = useRef<number | null>(null)
  const pendingDragPosRef = useRef<ToolMenuDragPosition | null>(null)

  const clampToolMenuPos = useCallback((pos: ToolMenuDragPosition): ToolMenuDragPosition => {
    if (typeof window === 'undefined') return pos
    const el = toolMenuCardRef.current
    const rect = el ? el.getBoundingClientRect() : null
    const w = rect && Number.isFinite(rect.width) && rect.width > 0 ? rect.width : 320
    const h = rect && Number.isFinite(rect.height) && rect.height > 0 ? rect.height : 420
    return clampOverlayTopLeftToViewport({
      pos,
      size: { width: w, height: h },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      visiblePx: 32,
    })
  }, [])

  const handleToolMenuCardPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      const el = toolMenuCardRef.current
      if (!el) return

      const rect = el.getBoundingClientRect()
      toolMenuDragStateRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        startTop: rect.top,
        startLeft: rect.left,
      }

      const flush = () => {
        const next = pendingDragPosRef.current
        pendingDragPosRef.current = null
        dragRafRef.current = null
        if (!next) return
        setToolMenuDragPos(next)
      }

      startPointerDrag({
        ev: event.nativeEvent,
        cursor: 'grabbing',
        shouldStart: down => {
          if (down.pointerType === 'mouse' && down.button !== 0) return false
          return true
        },
        onMove: mv => {
          const state = toolMenuDragStateRef.current
          if (!state) return
          const dx = mv.clientX - state.startX
          const dy = mv.clientY - state.startY
          pendingDragPosRef.current = clampToolMenuPos({
            top: state.startTop + dy,
            left: state.startLeft + dx,
          })
          if (dragRafRef.current == null) dragRafRef.current = window.requestAnimationFrame(flush)
        },
        onEnd: () => {
          toolMenuDragStateRef.current = null
          if (dragRafRef.current != null) {
            window.cancelAnimationFrame(dragRafRef.current)
            dragRafRef.current = null
          }
          if (pendingDragPosRef.current) {
            setToolMenuDragPos(pendingDragPosRef.current)
            pendingDragPosRef.current = null
          }
        },
        onCancel: () => {
          toolMenuDragStateRef.current = null
          if (dragRafRef.current != null) {
            window.cancelAnimationFrame(dragRafRef.current)
            dragRafRef.current = null
          }
          if (pendingDragPosRef.current) {
            setToolMenuDragPos(pendingDragPosRef.current)
            pendingDragPosRef.current = null
          }
        },
      })
    },
    [clampToolMenuPos],
  )

  const toolbarOffsetPx = UI_LAYOUT.toolbarOffsetPx

  const getToolbarBottomPx = useCallback((): number => {
    if (typeof document === 'undefined') return toolbarOffsetPx
    const toolbar = document.querySelector('.App-toolbar')
    return toolbar instanceof HTMLElement ? toolbar.getBoundingClientRect().bottom : toolbarOffsetPx
  }, [toolbarOffsetPx])

  const getDefaultToolMenuPos = useCallback((): ToolMenuDragPosition => {
    if (typeof window === 'undefined') {
      return { top: toolbarOffsetPx * 2, left: 16 }
    }

    const measuredWidth = toolMenuCardRef.current?.getBoundingClientRect().width
    const width = Number.isFinite(measuredWidth) && measuredWidth ? measuredWidth : 320
    const toolbarBottom = getToolbarBottomPx()
    const top = toolbarBottom + 36
    const left = window.innerWidth - 72 - width

    return { top, left }
  }, [getToolbarBottomPx, toolbarOffsetPx])

  useEffect(() => {
    if (!isToolMenuOpen) return
    if (toolMenuDragPos) return
    if (typeof window === 'undefined') return
    const raf = window.requestAnimationFrame(() => {
      setToolMenuDragPos(clampToolMenuPos(getDefaultToolMenuPos()))
    })
    return () => window.cancelAnimationFrame(raf)
  }, [clampToolMenuPos, getDefaultToolMenuPos, isToolMenuOpen, toolMenuDragPos])

  useEffect(() => {
    if (!isToolMenuOpen) return
    if (!toolMenuDragPos) return
    if (typeof window === 'undefined') return
    const raf = window.requestAnimationFrame(() => {
      const next = clampToolMenuPos(toolMenuDragPos)
      if (next.top === toolMenuDragPos.top && next.left === toolMenuDragPos.left) return
      setToolMenuDragPos(next)
    })
    return () => window.cancelAnimationFrame(raf)
  }, [clampToolMenuPos, isToolMenuOpen, toolMenuDragPos])

  const toolMenuCardStyle = useMemo(() => {
    if (!toolMenuDragPos) {
      const pos = clampToolMenuPos(getDefaultToolMenuPos())
      return {
        position: 'absolute' as const,
        top: pos.top,
        left: pos.left,
      }
    }
    return {
      position: 'absolute' as const,
      top: toolMenuDragPos.top,
      left: toolMenuDragPos.left,
    }
  }, [clampToolMenuPos, getDefaultToolMenuPos, toolMenuDragPos])

  const closeToolMenu = useCallback(() => {
    setIsToolMenuOpen(false)
    const pinned = lsBool(LS_KEYS.floatingPanelPinned, false)
    if (!pinned) setToolMenuDragPos(null)
  }, [])

  const toggleToolMenu = useCallback(() => {
    setIsToolMenuOpen(prev => {
      const next = !prev
      if (!next) {
        const pinned = lsBool(LS_KEYS.floatingPanelPinned, false)
        if (!pinned) setToolMenuDragPos(null)
      }
      return next
    })
  }, [])

  return {
    isToolMenuOpen,
    setIsToolMenuOpen,
    toolMenuButtonRef,
    toolMenuCardRef,
    toolMenuCardStyle,
    setToolMenuDragPos,
    handleToolMenuCardPointerDown,
    closeToolMenu,
    toggleToolMenu,
  }
}
