import React, { useCallback, useRef, type MutableRefObject, type RefObject } from 'react'
import * as d3 from 'd3'

import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { useGraphStore } from '@/hooks/useGraphStore'
import { DEFAULT_DRAG_ALPHA_TARGET } from '@/lib/graph/layoutDefaults'
import { readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { lockGlobalUserSelect, unlockGlobalUserSelect } from '@/lib/canvas/interaction-user-select'
import { isSpacePanHeld } from '@/lib/canvas/space-pan'
import { disableAutoZoomModesForUserGesture } from '@/lib/canvas/auto-zoom-modes'
import { clampCanvasInteractionSpeedMultiplier, clampCanvasPanSpeedMultiplier } from '@/lib/canvas/camera-options-2d'
import { readSnapGridConfigFromSchema, snapPointToGrid } from '@/lib/canvas/gridSnap'
import { computeOverlayDraggedPoint2d, computeOverlayPanTransform2d } from '@/lib/canvas/overlayInteractions2d'

export function useOverlayInteractions2d(args: {
  activeRef: MutableRefObject<boolean>
  svgRef: RefObject<SVGSVGElement | null>
  zoomRef: MutableRefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>
  simulationRef: MutableRefObject<d3.Simulation<GraphNode, GraphEdge> | null>
  sceneGraphDataRef: MutableRefObject<GraphData | null>
  schemaRef: MutableRefObject<GraphSchema>
  requestOverlaySchedule?: () => void
}) {
  const { activeRef, svgRef, zoomRef, simulationRef, sceneGraphDataRef, schemaRef, requestOverlaySchedule } = args

  const stopEvent = useCallback((event: React.SyntheticEvent) => {
    try {
      event.stopPropagation()
    } catch {
      void 0
    }
  }, [])

  const headerDragRef = useRef<null | { id: string; baseX: number; baseY: number; structured: boolean; frozen: boolean }>(null)
  const overlayPanRef = useRef<null | { pointerId: number; startClientX: number; startClientY: number; startTransform: d3.ZoomTransform }>(null)

  const shouldStartHeaderDrag = useCallback(() => {
    if (useGraphStore.getState().canvasPointerMode2d === 'pan') return false
    if (isSpacePanHeld()) return false
    return true
  }, [])

  const beginHeaderDrag = useCallback(
    (id: string, clientX: number, clientY: number) => {
      if (!activeRef.current) return
      if (!shouldStartHeaderDrag()) return
      const svgEl = svgRef.current
      if (!svgEl) return
      const sim = simulationRef.current
      const graph = sceneGraphDataRef.current
      const nodes = sim ? (sim.nodes() as unknown as GraphNode[]) : Array.isArray(graph?.nodes) ? (graph!.nodes as GraphNode[]) : []
      let node: GraphNode | null = null
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i]
        if (String(n?.id || '') === id) {
          node = n
          break
        }
      }
      if (!node) return
      const x0 = typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : 0
      const y0 = typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : 0
      const mode = readLayoutMode(schemaRef.current)
      const structured = mode === 'radial'
      const frozen = svgEl.getAttribute('data-kg-layout-frozen') === '1'
      lockGlobalUserSelect()
      headerDragRef.current = { id, baseX: x0, baseY: y0, structured, frozen }
      if (sim && !structured && !frozen) {
        const alphaTarget = (() => {
          try {
            const v = useGraphStore.getState().graphDragAlphaTarget2d
            return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(0.6, v)) : DEFAULT_DRAG_ALPHA_TARGET
          } catch {
            return DEFAULT_DRAG_ALPHA_TARGET
          }
        })()
        try {
          sim.alphaTarget(alphaTarget).restart()
        } catch {
          void 0
        }
      }
      node.fx = x0
      node.fy = y0
      void clientX
      void clientY
    },
    [activeRef, schemaRef, sceneGraphDataRef, shouldStartHeaderDrag, simulationRef, svgRef],
  )

  const moveHeaderDrag = useCallback(
    (dx: number, dy: number) => {
      const st = headerDragRef.current
      if (!st) return
      if (!shouldStartHeaderDrag()) return
      const svgEl = svgRef.current
      if (!svgEl) return
      const sim = simulationRef.current
      const graph = sceneGraphDataRef.current
      const nodes = sim ? (sim.nodes() as unknown as GraphNode[]) : Array.isArray(graph?.nodes) ? (graph!.nodes as GraphNode[]) : []
      let node: GraphNode | null = null
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i]
        if (String(n?.id || '') === st.id) {
          node = n
          break
        }
      }
      if (!node) return
      const t = d3.zoomTransform(svgEl as unknown as SVGSVGElement)
      const k = typeof t.k === 'number' && Number.isFinite(t.k) && t.k > 0 ? t.k : 1
      const p = computeOverlayDraggedPoint2d({ baseX: st.baseX, baseY: st.baseY, dxClientPx: dx, dyClientPx: dy, zoomK: k, schema: schemaRef.current })
      node.fx = p.x
      node.fy = p.y
      if (st.structured || st.frozen) {
        node.x = p.x
        node.y = p.y
      }
      node.vx = 0
      node.vy = 0
      if (st.structured || st.frozen) {
        try {
          const tickHandler = sim?.on('tick')
          if (typeof tickHandler === 'function') {
            ;(tickHandler as unknown as () => void)()
          }
        } catch {
          void 0
        }
      }
      try {
        requestOverlaySchedule?.()
      } catch {
        void 0
      }
    },
    [requestOverlaySchedule, schemaRef, sceneGraphDataRef, shouldStartHeaderDrag, simulationRef, svgRef],
  )

  const endHeaderDrag = useCallback(() => {
    const st = headerDragRef.current
    if (!st) return
    headerDragRef.current = null
    unlockGlobalUserSelect()
    const sim = simulationRef.current
    const graph = sceneGraphDataRef.current
    const nodes = sim ? (sim.nodes() as unknown as GraphNode[]) : Array.isArray(graph?.nodes) ? (graph!.nodes as GraphNode[]) : []
    let node: GraphNode | null = null
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      if (String(n?.id || '') === st.id) {
        node = n
        break
      }
    }
    if (sim && !st.structured && !st.frozen) {
      try {
        sim.alphaTarget(0)
      } catch {
        void 0
      }
      if (node) {
        node.fx = null
        node.fy = null
      }
    }
    if (node) {
      const x = typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : typeof node.fx === 'number' ? node.fx : null
      const y = typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : typeof node.fy === 'number' ? node.fy : null
      if (x != null && y != null && useGraphStore.getState().workspaceViewMode === 'editor') {
        try {
          useGraphStore.getState().updateNode(st.id, { x, y })
        } catch {
          void 0
        }
      }
    }
  }, [sceneGraphDataRef, simulationRef])

  const startOverlayPan = useCallback(
    (args0: { pointerId: number; clientX: number; clientY: number }) => {
      if (!activeRef.current) return
      const svgEl = svgRef.current
      const zoom = zoomRef.current
      if (!svgEl || !zoom) return
      try {
        d3.select(svgEl).interrupt()
      } catch {
        void 0
      }
      const st = useGraphStore.getState()
      disableAutoZoomModesForUserGesture(st)
      overlayPanRef.current = {
        pointerId: args0.pointerId,
        startClientX: args0.clientX,
        startClientY: args0.clientY,
        startTransform: d3.zoomTransform(svgEl),
      }
    },
    [activeRef, svgRef, zoomRef],
  )

  const moveOverlayPan = useCallback(
    (args0: { pointerId: number; clientX: number; clientY: number; dx: number; dy: number }) => {
      const drag = overlayPanRef.current
      if (!drag || drag.pointerId !== args0.pointerId) return
      const svgEl = svgRef.current
      const zoom = zoomRef.current
      if (!svgEl || !zoom) return
      const st = useGraphStore.getState()
      disableAutoZoomModesForUserGesture(st)
      const next = computeOverlayPanTransform2d({
        startTransform: drag.startTransform,
        dxClientPx: args0.dx,
        dyClientPx: args0.dy,
        canvasPanSpeedMultiplier: st.canvasPanSpeedMultiplier,
        canvasInteractionSpeedMultiplier: st.canvasInteractionSpeedMultiplier,
      })
      d3.select(svgEl).call(
        zoom.transform as unknown as (sel: d3.Selection<SVGSVGElement, unknown, null, undefined>, t: d3.ZoomTransform) => void,
        next,
      )
      void args0.clientX
      void args0.clientY
    },
    [svgRef, zoomRef],
  )

  const endOverlayPan = useCallback((args0: { pointerId: number }) => {
    const drag = overlayPanRef.current
    if (!drag || drag.pointerId !== args0.pointerId) return
    overlayPanRef.current = null
  }, [])

  React.useEffect(() => {
    const onUp = (e: PointerEvent) => {
      const h = headerDragRef.current
      if (h) {
        try {
          endHeaderDrag()
        } catch {
          try {
            headerDragRef.current = null
            unlockGlobalUserSelect()
          } catch {
            void 0
          }
        }
      }
      const p = overlayPanRef.current
      if (p) {
        try {
          endOverlayPan({ pointerId: p.pointerId })
        } catch {
          try {
            overlayPanRef.current = null
          } catch {
            void 0
          }
        }
      }
      void e
    }
    const onBlur = () => {
      const h = headerDragRef.current
      if (h) {
        try {
          endHeaderDrag()
        } catch {
          try {
            headerDragRef.current = null
            unlockGlobalUserSelect()
          } catch {
            void 0
          }
        }
      }
      const p = overlayPanRef.current
      if (p) {
        try {
          endOverlayPan({ pointerId: p.pointerId })
        } catch {
          try {
            overlayPanRef.current = null
          } catch {
            void 0
          }
        }
      }
    }
    window.addEventListener('pointerup', onUp, { capture: true })
    window.addEventListener('pointercancel', onUp, { capture: true })
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('pointerup', onUp, { capture: true } as AddEventListenerOptions)
      window.removeEventListener('pointercancel', onUp, { capture: true } as AddEventListenerOptions)
      window.removeEventListener('blur', onBlur)
    }
  }, [endHeaderDrag, endOverlayPan])

  return {
    stopEvent,
    shouldStartHeaderDrag,
    beginHeaderDrag,
    moveHeaderDrag,
    endHeaderDrag,
    startOverlayPan,
    moveOverlayPan,
    endOverlayPan,
  }
}
