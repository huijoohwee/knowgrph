import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { readSnapGridConfigFromSchema, snapScalarToGrid } from '@/lib/canvas/gridSnap'
import { shouldStartSelectionDragForPreset } from '@/lib/canvas/viewport-controls'
import { isSpacePanHeld } from '@/lib/canvas/space-pan'
import type { GraphSchema } from '@/lib/graph/schema'
import type { DesignCanvasFrameRect, DesignCanvasResizeHandle } from '@/components/DesignCanvas/types'

type VisibleNode = {
  id: string
}

type ResizeState = {
  id: string
  handle: DesignCanvasResizeHandle
  startWorld: { x: number; y: number }
  startRect: DesignCanvasFrameRect
  aspect: number
  pointerId: number
}

type ResizePendingState = {
  id: string
  x: number
  y: number
  w: number
  h: number
}

type MarqueeState = {
  start: { x: number; y: number }
  end: { x: number; y: number }
  mode: 'replace' | 'add'
  pointerId: number
}

type PointerToWorld = (event: React.PointerEvent, svgEl: SVGSVGElement) => { x: number; y: number } | null

type UseResizeMarqueeControllerArgs = {
  active: boolean
  interactionActive: boolean
  canvasPointerMode2d: string
  documentStructureBaselineLock: boolean
  viewportControlsPreset: 'map' | 'design'
  schema: GraphSchema | null | undefined
  svgRef: React.MutableRefObject<SVGSVGElement | null>
  positions: Record<string, DesignCanvasFrameRect>
  visibleNodes: VisibleNode[]
  pointerToWorld: PointerToWorld
  frameElByIdRef: React.MutableRefObject<Map<string, SVGGElement>>
  frameRectElByIdRef: React.MutableRefObject<Map<string, SVGRectElement>>
  frameStatusElByIdRef: React.MutableRefObject<Map<string, SVGPathElement>>
  resizeOverlayElRef: React.MutableRefObject<SVGGElement | null>
  commitDesignFrameRectHistory: (args: {
    label: string
    framePosPatch?: Record<string, { x: number; y: number }>
    frameSizePatch?: Record<string, { w: number; h: number }>
  }) => void
}

export function useResizeMarqueeController(args: UseResizeMarqueeControllerArgs) {
  const {
    active,
    interactionActive,
    canvasPointerMode2d,
    documentStructureBaselineLock,
    viewportControlsPreset,
    schema,
    svgRef,
    positions,
    visibleNodes,
    pointerToWorld,
    frameElByIdRef,
    frameRectElByIdRef,
    frameStatusElByIdRef,
    resizeOverlayElRef,
    commitDesignFrameRectHistory,
  } = args

  const resizeRef = React.useRef<ResizeState | null>(null)
  const resizeRafRef = React.useRef<number | null>(null)
  const resizePendingRef = React.useRef<ResizePendingState | null>(null)
  const marqueeRef = React.useRef<MarqueeState | null>(null)
  const [marqueeBox, setMarqueeBox] = React.useState<null | DesignCanvasFrameRect>(null)

  const scheduleResizeVisual = React.useMemo(() => {
    return () => {
      if (resizeRafRef.current != null) return
      resizeRafRef.current = window.requestAnimationFrame(() => {
        resizeRafRef.current = null
        const pending = resizePendingRef.current
        if (!pending) return
        const id = String(pending.id || '').trim()
        if (!id) return
        const frameEl = frameElByIdRef.current.get(id)
        if (frameEl) {
          try {
            frameEl.setAttribute('transform', `translate(${pending.x},${pending.y})`)
          } catch {
            void 0
          }
        }
        const rectEl = frameRectElByIdRef.current.get(id)
        if (rectEl) {
          try {
            rectEl.setAttribute('width', String(Math.max(1, pending.w)))
            rectEl.setAttribute('height', String(Math.max(1, pending.h)))
          } catch {
            void 0
          }
        }
        const statusEl = frameStatusElByIdRef.current.get(id)
        if (statusEl) {
          try {
            const width = Math.max(1, pending.w)
            statusEl.setAttribute('d', `M 0 8 Q 0 0 8 0 L ${width - 8} 0 Q ${width} 0 ${width} 8 L ${width} 32 L 0 32 Z`)
          } catch {
            void 0
          }
        }
        const overlay = resizeOverlayElRef.current
        if (!overlay) return
        try {
          overlay.setAttribute('transform', `translate(${pending.x},${pending.y})`)
        } catch {
          void 0
        }
        const outline = overlay.querySelector('rect[data-kg-resize-outline="1"]') as SVGRectElement | null
        if (outline) {
          try {
            outline.setAttribute('width', String(Math.max(0, pending.w + 2)))
            outline.setAttribute('height', String(Math.max(0, pending.h + 2)))
          } catch {
            void 0
          }
        }
        const handleSize = 9
        const handleOffset = handleSize / 2
        const width = Math.max(1, pending.w)
        const height = Math.max(1, pending.h)
        const points: Array<{ key: DesignCanvasResizeHandle; x: number; y: number }> = [
          { key: 'nw', x: 0, y: 0 },
          { key: 'n', x: width / 2, y: 0 },
          { key: 'ne', x: width, y: 0 },
          { key: 'e', x: width, y: height / 2 },
          { key: 'se', x: width, y: height },
          { key: 's', x: width / 2, y: height },
          { key: 'sw', x: 0, y: height },
          { key: 'w', x: 0, y: height / 2 },
        ]
        for (let i = 0; i < points.length; i += 1) {
          const point = points[i]!
          const handleEl = overlay.querySelector(`rect[data-kg-resize-handle="${point.key}"]`) as SVGRectElement | null
          if (!handleEl) continue
          try {
            handleEl.setAttribute('x', String(point.x - handleOffset))
            handleEl.setAttribute('y', String(point.y - handleOffset))
          } catch {
            void 0
          }
        }
      })
    }
  }, [frameElByIdRef, frameRectElByIdRef, frameStatusElByIdRef, resizeOverlayElRef])

  React.useEffect(() => {
    return () => {
      if (resizeRafRef.current != null) {
        try {
          window.cancelAnimationFrame(resizeRafRef.current)
        } catch {
          void 0
        }
        resizeRafRef.current = null
      }
      resizePendingRef.current = null
      resizeRef.current = null
      marqueeRef.current = null
    }
  }, [])

  const beginResize = React.useMemo(() => {
    return (
      event: React.PointerEvent,
      args: { id: string; handle: DesignCanvasResizeHandle; rect: { x: number; y: number; w: number; h: number } },
    ) => {
      if (!interactionActive) return
      if (!active) return
      if (documentStructureBaselineLock) return
      if (isSpacePanHeld()) return
      if (canvasPointerMode2d === 'pan') return
      if (event.button !== 0) return
      const svgEl = svgRef.current
      if (!svgEl) return
      const world = pointerToWorld(event, svgEl)
      if (!world) return
      event.stopPropagation()
      try {
        ;(event.currentTarget as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(event.pointerId)
      } catch {
        void 0
      }
      const id = String(args.id || '').trim()
      if (!id) return
      try {
        const store = useGraphStore.getState()
        store.setSelectionSource('canvas')
        if (store.selectedNodeId !== id) store.selectNodesExpanded({ nodeIds: [id], activeNodeId: id })
      } catch {
        void 0
      }
      const width = Math.max(1, args.rect.w)
      const height = Math.max(1, args.rect.h)
      resizeRef.current = {
        id,
        handle: args.handle,
        startWorld: world,
        startRect: { x: args.rect.x, y: args.rect.y, w: width, h: height },
        aspect: width / height,
        pointerId: event.pointerId,
      }
      resizePendingRef.current = { id, x: args.rect.x, y: args.rect.y, w: width, h: height }
    }
  }, [active, canvasPointerMode2d, documentStructureBaselineLock, interactionActive, pointerToWorld, svgRef])

  const handleSvgPointerDown = React.useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    if (!interactionActive) return false
    if (!active) return false
    const selectionOnDrag = canvasPointerMode2d !== 'pan'
    const allowSelectionDrag = shouldStartSelectionDragForPreset({
      preset: viewportControlsPreset,
      button: event.button,
      shiftKey: event.shiftKey,
      spacePanHeld: isSpacePanHeld(),
      selectionOnDrag,
    })
    if (!allowSelectionDrag || event.button !== 0) return false
    const svgEl = svgRef.current
    if (!svgEl) return false
    const world = pointerToWorld(event, svgEl)
    if (!world) return false
    try {
      ;(event.currentTarget as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(event.pointerId)
    } catch {
      void 0
    }
    const mode: 'replace' | 'add' = event.shiftKey ? 'add' : 'replace'
    marqueeRef.current = { start: world, end: world, mode, pointerId: event.pointerId }
    setMarqueeBox({ x: world.x, y: world.y, w: 0, h: 0 })
    return true
  }, [active, canvasPointerMode2d, interactionActive, pointerToWorld, svgRef, viewportControlsPreset])

  const handleSvgPointerMove = React.useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const resize = resizeRef.current
    if (resize && event.pointerId === resize.pointerId) {
      if (!active) return true
      const svgEl = svgRef.current
      if (!svgEl) return true
      const world = pointerToWorld(event, svgEl)
      if (!world) return true
      const dx = world.x - resize.startWorld.x
      const dy = world.y - resize.startWorld.y
      const minW = 24
      const minH = 18
      let x = resize.startRect.x
      let y = resize.startRect.y
      let w = resize.startRect.w
      let h = resize.startRect.h
      if (resize.handle.includes('e')) w = resize.startRect.w + dx
      if (resize.handle.includes('s')) h = resize.startRect.h + dy
      if (resize.handle.includes('w')) {
        w = resize.startRect.w - dx
        x = resize.startRect.x + dx
      }
      if (resize.handle.includes('n')) {
        h = resize.startRect.h - dy
        y = resize.startRect.y + dy
      }
      if (event.shiftKey && Number.isFinite(resize.aspect) && resize.aspect > 0.001) {
        const aspect = resize.aspect
        if (resize.handle.length === 2) {
          const widthFromHeight = h * aspect
          const heightFromWidth = w / aspect
          if (Math.abs(w - widthFromHeight) > Math.abs(h - heightFromWidth)) h = w / aspect
          else w = h * aspect
        } else if (resize.handle === 'e' || resize.handle === 'w') {
          h = w / aspect
        } else if (resize.handle === 'n' || resize.handle === 's') {
          w = h * aspect
        }
        if (resize.handle.includes('w')) x = resize.startRect.x + (resize.startRect.w - w)
        if (resize.handle.includes('n')) y = resize.startRect.y + (resize.startRect.h - h)
      }
      w = Math.max(minW, w)
      h = Math.max(minH, h)
      if (resize.handle.includes('w')) x = resize.startRect.x + (resize.startRect.w - w)
      if (resize.handle.includes('n')) y = resize.startRect.y + (resize.startRect.h - h)
      const grid = readSnapGridConfigFromSchema(schema)
      if (grid.enabled && !event.altKey) {
        x = snapScalarToGrid(x, grid, 'x')
        y = snapScalarToGrid(y, grid, 'y')
        w = Math.max(minW, snapScalarToGrid(w, grid, 'x'))
        h = Math.max(minH, snapScalarToGrid(h, grid, 'y'))
      }
      resizePendingRef.current = { id: resize.id, x, y, w, h }
      scheduleResizeVisual()
      return true
    }

    const marquee = marqueeRef.current
    if (!marquee || event.pointerId !== marquee.pointerId) return false
    const svgEl = svgRef.current
    if (!svgEl) return true
    const world = pointerToWorld(event, svgEl)
    if (!world) return true
    marqueeRef.current = { ...marquee, end: world }
    const x0 = Math.min(marquee.start.x, world.x)
    const y0 = Math.min(marquee.start.y, world.y)
    const x1 = Math.max(marquee.start.x, world.x)
    const y1 = Math.max(marquee.start.y, world.y)
    setMarqueeBox({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 })
    return true
  }, [active, pointerToWorld, scheduleResizeVisual, schema, svgRef])

  const handleSvgPointerUp = React.useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const resize = resizeRef.current
    if (resize && event.pointerId === resize.pointerId) {
      resizeRef.current = null
      const pending = resizePendingRef.current
      resizePendingRef.current = null
      if (resizeRafRef.current != null) {
        try {
          window.cancelAnimationFrame(resizeRafRef.current)
        } catch {
          void 0
        }
        resizeRafRef.current = null
      }
      if (!interactionActive || !pending) return true
      const id = String(pending.id || '').trim()
      if (!id) return true
      const framePosPatch = Number.isFinite(pending.x) && Number.isFinite(pending.y) ? { [id]: { x: pending.x, y: pending.y } } : undefined
      const frameSizePatch = Number.isFinite(pending.w) && Number.isFinite(pending.h) ? { [id]: { w: pending.w, h: pending.h } } : undefined
      if (framePosPatch || frameSizePatch) commitDesignFrameRectHistory({ label: 'Resize', framePosPatch, frameSizePatch })
      return true
    }

    const marquee = marqueeRef.current
    marqueeRef.current = null
    setMarqueeBox(null)
    if (!active || !marquee || event.pointerId !== marquee.pointerId) return false
    const box = {
      x: Math.min(marquee.start.x, marquee.end.x),
      y: Math.min(marquee.start.y, marquee.end.y),
      w: Math.max(marquee.start.x, marquee.end.x) - Math.min(marquee.start.x, marquee.end.x),
      h: Math.max(marquee.start.y, marquee.end.y) - Math.min(marquee.start.y, marquee.end.y),
    }
    if (box.w < 6 || box.h < 6) return true
    const hits: string[] = []
    for (let i = 0; i < visibleNodes.length; i += 1) {
      const id = String(visibleNodes[i]?.id || '').trim()
      if (!id) continue
      const position = positions[id]
      if (!position) continue
      const hitX = position.x < box.x + box.w && position.x + position.w > box.x
      const hitY = position.y < box.y + box.h && position.y + position.h > box.y
      if (hitX && hitY) hits.push(id)
    }
    const store = useGraphStore.getState()
    store.setSelectionSource('canvas')
    const prev = (marquee.mode === 'add' ? store.selectedNodeIds || [] : []).map(value => String(value || '').trim()).filter(Boolean)
    const nodeIds = Array.from(new Set<string>([...prev, ...hits]))
    store.selectNodesExpanded({ nodeIds, activeNodeId: nodeIds.length > 0 ? nodeIds[nodeIds.length - 1] : null })
    return true
  }, [active, commitDesignFrameRectHistory, interactionActive, positions, visibleNodes])

  const handleSvgPointerCancel = React.useCallback(() => {
    const resize = resizeRef.current
    if (resize) {
      resizeRef.current = null
      resizePendingRef.current = { id: resize.id, x: resize.startRect.x, y: resize.startRect.y, w: resize.startRect.w, h: resize.startRect.h }
      scheduleResizeVisual()
      resizePendingRef.current = null
      if (resizeRafRef.current != null) {
        try {
          window.cancelAnimationFrame(resizeRafRef.current)
        } catch {
          void 0
        }
        resizeRafRef.current = null
      }
    }
    marqueeRef.current = null
    setMarqueeBox(null)
  }, [scheduleResizeVisual])

  const cancelResizeAndMarquee = React.useCallback((svgEl: SVGSVGElement | null) => {
    const marquee = marqueeRef.current
    if (marquee) {
      marqueeRef.current = null
      setMarqueeBox(null)
      try {
        svgEl?.releasePointerCapture?.(marquee.pointerId)
      } catch {
        void 0
      }
    }

    const resize = resizeRef.current
    if (!resize) return
    resizeRef.current = null
    const pending = { id: resize.id, x: resize.startRect.x, y: resize.startRect.y, w: resize.startRect.w, h: resize.startRect.h }
    const id = String(pending.id || '').trim()
    if (id) {
      const frameEl = frameElByIdRef.current.get(id)
      if (frameEl) {
        try {
          frameEl.setAttribute('transform', `translate(${pending.x},${pending.y})`)
        } catch {
          void 0
        }
      }
      const rectEl = frameRectElByIdRef.current.get(id)
      if (rectEl) {
        try {
          rectEl.setAttribute('width', String(Math.max(1, pending.w)))
          rectEl.setAttribute('height', String(Math.max(1, pending.h)))
        } catch {
          void 0
        }
      }
      const statusEl = frameStatusElByIdRef.current.get(id)
      if (statusEl) {
        try {
          const width = Math.max(1, pending.w)
          statusEl.setAttribute('d', `M 0 8 Q 0 0 8 0 L ${width - 8} 0 Q ${width} 0 ${width} 8 L ${width} 32 L 0 32 Z`)
        } catch {
          void 0
        }
      }
      const overlay = resizeOverlayElRef.current
      if (overlay) {
        try {
          overlay.setAttribute('transform', `translate(${pending.x},${pending.y})`)
        } catch {
          void 0
        }
      }
    }
    if (resizeRafRef.current != null) {
      try {
        window.cancelAnimationFrame(resizeRafRef.current)
      } catch {
        void 0
      }
      resizeRafRef.current = null
    }
    resizePendingRef.current = null
    try {
      svgEl?.releasePointerCapture?.(resize.pointerId)
    } catch {
      void 0
    }
  }, [frameElByIdRef, frameRectElByIdRef, frameStatusElByIdRef, resizeOverlayElRef])

  return {
    resizeRef,
    resizeRafRef,
    resizePendingRef,
    marqueeRef,
    marqueeBox,
    beginResize,
    handleSvgPointerDown,
    handleSvgPointerMove,
    handleSvgPointerUp,
    handleSvgPointerCancel,
    cancelResizeAndMarquee,
  }
}
