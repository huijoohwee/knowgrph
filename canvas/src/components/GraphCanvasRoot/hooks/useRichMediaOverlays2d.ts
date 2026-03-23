import React, { useCallback, useEffect, useMemo, useRef, type MutableRefObject, type RefObject } from 'react'
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
import { applyPanelBox } from '@/lib/render/mediaPanelLayout'
import { listMediaOverlayNodes } from '@/lib/render/mediaOverlayPool'
import { readNodeCenterWorld2d } from '@/lib/render/mediaAnchor'
import { startMediaOverlayLayoutLoop2d } from '@/lib/render/mediaOverlayLayoutLoop2d'
import { emitMarkdownPanelMetric } from '@/features/metrics/uiMetrics'
import { getNodeMediaSpec } from '@/components/GraphCanvas/helpers'

export function useRichMediaOverlays2d(args: {
  active: boolean
  activeRef: MutableRefObject<boolean>
  svgRef: RefObject<SVGSVGElement | null>
  zoomRef: MutableRefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>
  simulationRef: MutableRefObject<d3.Simulation<GraphNode, GraphEdge> | null>
  sceneGraphData: GraphData | null
  sceneGraphDataRef: MutableRefObject<GraphData | null>
  graphDataRevision: number
  schemaRef: MutableRefObject<GraphSchema>
  renderMediaAsNodes: boolean
  mediaPanelDensity: unknown
  threeIframeOverlayPoolMax: unknown
  threeIframeOverlayBaseWidthRatioDefault: unknown
  threeIframeOverlayBaseWidthRatioCompact: unknown
  threeIframeOverlayBaseWidthMinPxDefault: unknown
  threeIframeOverlayBaseWidthMinPxCompact: unknown
  threeIframeOverlayBaseWidthMaxPxDefault: unknown
  threeIframeOverlayBaseWidthMaxPxCompact: unknown
  sceneWidth: number
  sceneHeight: number
}) {
  const {
    active,
    activeRef,
    svgRef,
    zoomRef,
    simulationRef,
    sceneGraphData,
    sceneGraphDataRef,
    graphDataRevision,
    schemaRef,
    renderMediaAsNodes,
    mediaPanelDensity,
    threeIframeOverlayPoolMax,
    threeIframeOverlayBaseWidthRatioDefault,
    threeIframeOverlayBaseWidthRatioCompact,
    threeIframeOverlayBaseWidthMinPxDefault,
    threeIframeOverlayBaseWidthMinPxCompact,
    threeIframeOverlayBaseWidthMaxPxDefault,
    threeIframeOverlayBaseWidthMaxPxCompact,
    sceneWidth,
    sceneHeight,
  } = args

  const iframeOverlayElsRef = useRef<Map<string, HTMLElement>>(new Map())
  const iframeNodeByIdRef = useRef<{ rev: number; sim: unknown | null; map: Map<string, GraphNode> }>({ rev: -1, sim: null, map: new Map() })
  const mediaOverlayScheduleRef = useRef<(() => void) | null>(null)
  const mediaOverlayScheduleRafRef = useRef<number | null>(null)
  const mediaOverlaySchedulePendingRef = useRef<boolean>(false)
  const iframeOverlayRefFnByIdRef = useRef<Map<string, (el: HTMLDivElement | null) => void>>(new Map())

  const requestMediaOverlaySchedule = useCallback(() => {
    const schedule = mediaOverlayScheduleRef.current
    if (schedule) {
      schedule()
      return
    }
    mediaOverlaySchedulePendingRef.current = true
    if (mediaOverlayScheduleRafRef.current != null) return
    mediaOverlayScheduleRafRef.current = requestAnimationFrame(() => {
      mediaOverlayScheduleRafRef.current = null
      try {
        mediaOverlayScheduleRef.current?.()
      } catch {
        void 0
      }
    })
  }, [])

  const stopEvent = React.useCallback((event: React.SyntheticEvent) => {
    try {
      event.stopPropagation()
    } catch {
      void 0
    }
  }, [])

  const mediaHeaderDragRef = useRef<null | { id: string; baseX: number; baseY: number; structured: boolean; frozen: boolean }>(null)
  const mediaOverlayPanRef = useRef<null | { pointerId: number; startClientX: number; startClientY: number; startTransform: d3.ZoomTransform }>(null)

  const beginMediaHeaderDrag = React.useCallback(
    (id: string, clientX: number, clientY: number) => {
      if (!activeRef.current) return
      if (useGraphStore.getState().canvasPointerMode2d === 'pan') return
      if (isSpacePanHeld()) return
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
      mediaHeaderDragRef.current = { id, baseX: x0, baseY: y0, structured, frozen }
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
    [activeRef, schemaRef, sceneGraphDataRef, simulationRef, svgRef],
  )

  const moveMediaHeaderDrag = React.useCallback(
    (dx: number, dy: number) => {
      const st = mediaHeaderDragRef.current
      if (!st) return
      if (useGraphStore.getState().canvasPointerMode2d === 'pan') return
      if (isSpacePanHeld()) return
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
      const nx = st.baseX + dx / k
      const ny = st.baseY + dy / k
      const constraint = schemaRef.current.behavior.dragConstraint || 'free'
      const grid = readSnapGridConfigFromSchema(schemaRef.current)
      const snapped = grid.enabled ? snapPointToGrid({ x: nx, y: ny }, grid.size) : { x: nx, y: ny }
      const snapX = snapped.x
      const snapY = snapped.y
      if (constraint === 'axis-x') {
        node.fx = snapX
        if (st.structured || st.frozen) node.x = snapX
      } else if (constraint === 'axis-y') {
        node.fy = snapY
        if (st.structured || st.frozen) node.y = snapY
      } else if (constraint === 'none') {
        node.fx = st.baseX
        node.fy = st.baseY
      } else {
        node.fx = snapX
        node.fy = snapY
        if (st.structured || st.frozen) {
          node.x = snapX
          node.y = snapY
        }
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
        requestMediaOverlaySchedule()
      } catch {
        void 0
      }
    },
    [requestMediaOverlaySchedule, schemaRef, sceneGraphDataRef, simulationRef, svgRef],
  )

  const endMediaHeaderDrag = React.useCallback(() => {
    const st = mediaHeaderDragRef.current
    if (!st) return
    mediaHeaderDragRef.current = null
    unlockGlobalUserSelect()
    const svgEl = svgRef.current
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
      const x =
        typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : typeof node.fx === 'number' ? node.fx : null
      const y =
        typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : typeof node.fy === 'number' ? node.fy : null
      if (x != null && y != null && useGraphStore.getState().workspaceViewMode === 'editor') {
        try {
          useGraphStore.getState().updateNode(st.id, { x, y })
        } catch {
          void 0
        }
      }
    }
    void svgEl
  }, [sceneGraphDataRef, simulationRef, svgRef])

  const startMediaOverlayPan = React.useCallback(
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
      mediaOverlayPanRef.current = {
        pointerId: args0.pointerId,
        startClientX: args0.clientX,
        startClientY: args0.clientY,
        startTransform: d3.zoomTransform(svgEl),
      }
    },
    [activeRef, svgRef, zoomRef],
  )

  const moveMediaOverlayPan = React.useCallback(
    (args0: { pointerId: number; clientX: number; clientY: number; dx: number; dy: number }) => {
      const drag = mediaOverlayPanRef.current
      if (!drag || drag.pointerId !== args0.pointerId) return
      const svgEl = svgRef.current
      const zoom = zoomRef.current
      if (!svgEl || !zoom) return
      const st = useGraphStore.getState()
      disableAutoZoomModesForUserGesture(st)
      const interactionSpeed =
        clampCanvasPanSpeedMultiplier(st.canvasPanSpeedMultiplier) * clampCanvasInteractionSpeedMultiplier(st.canvasInteractionSpeedMultiplier)
      const dx = args0.dx * interactionSpeed
      const dy = args0.dy * interactionSpeed
      const next = d3.zoomIdentity.translate(drag.startTransform.x + dx, drag.startTransform.y + dy).scale(drag.startTransform.k)
      d3.select(svgEl).call(
        zoom.transform as unknown as (sel: d3.Selection<SVGSVGElement, unknown, null, undefined>, t: d3.ZoomTransform) => void,
        next,
      )
    },
    [svgRef, zoomRef],
  )

  const endMediaOverlayPan = React.useCallback((args0: { pointerId: number }) => {
    const drag = mediaOverlayPanRef.current
    if (!drag || drag.pointerId !== args0.pointerId) return
    mediaOverlayPanRef.current = null
  }, [])

  const mediaOverlayNodes = useMemo(() => {
    const nodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData!.nodes as GraphNode[]) : []
    const poolMaxRaw = typeof threeIframeOverlayPoolMax === 'number' && Number.isFinite(threeIframeOverlayPoolMax) ? threeIframeOverlayPoolMax : 0
    const poolMax = poolMaxRaw > 0 ? poolMaxRaw : 24
    const st = useGraphStore.getState() as unknown as { selectedNodeId?: unknown; selectedNodeIds?: unknown }
    const preferredNodeIds = [st.selectedNodeId, ...(Array.isArray(st.selectedNodeIds) ? st.selectedNodeIds : [])]
    return listMediaOverlayNodes({ enabled: true, nodes, poolMax, preferredNodeIds })
  }, [sceneGraphData, threeIframeOverlayPoolMax])

  const { mediaOverlayNodeIdsKey, mediaOverlayNodeIdSet } = useMemo(() => {
    const ids = mediaOverlayNodes.map(n => n.id)
    const sortedIds = ids.length <= 1 ? ids : ids.slice().sort()
    return {
      mediaOverlayNodeIdsKey: sortedIds.join('|'),
      mediaOverlayNodeIdSet: new Set(sortedIds),
    }
  }, [mediaOverlayNodes])

  useEffect(() => {
    const anyImportMeta = import.meta as unknown as { env?: { DEV?: boolean } }
    if (!anyImportMeta.env?.DEV) return
    if (!active) return
    const nodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData!.nodes as GraphNode[]) : []
    let specCount = 0
    let iframeCount = 0
    let imageCount = 0
    let videoCount = 0
    let svgCount = 0
    for (let i = 0; i < nodes.length; i += 1) {
      const spec = getNodeMediaSpec(nodes[i]!)
      if (!spec) continue
      specCount += 1
      if (spec.kind === 'iframe') iframeCount += 1
      else if (spec.kind === 'image') imageCount += 1
      else if (spec.kind === 'video') videoCount += 1
      else if (spec.kind === 'svg') svgCount += 1
    }
    emitMarkdownPanelMetric('canvas.2d.d3.richMedia.pool', {
      enabled: renderMediaAsNodes === true,
      nodes: nodes.length,
      mediaSpecCount: specCount,
      iframeCount,
      imageCount,
      videoCount,
      svgCount,
      overlayPoolSize: mediaOverlayNodes.length,
      overlayIds: mediaOverlayNodes.slice(0, 6).map(n => n.id),
      poolMaxRaw: threeIframeOverlayPoolMax,
    })
  }, [active, mediaOverlayNodeIdsKey, mediaOverlayNodes, renderMediaAsNodes, sceneGraphData, threeIframeOverlayPoolMax])

  useEffect(() => {
    return () => {
      const raf = mediaOverlayScheduleRafRef.current
      if (raf == null) return
      mediaOverlayScheduleRafRef.current = null
      try {
        cancelAnimationFrame(raf)
      } catch {
        void 0
      }
    }
  }, [])

  useEffect(() => {
    const next = new Map<string, HTMLElement>()
    for (const n of mediaOverlayNodes) {
      const existing = iframeOverlayElsRef.current.get(n.id)
      if (existing) next.set(n.id, existing)
    }
    iframeOverlayElsRef.current = next
    const keep = new Set<string>(mediaOverlayNodes.map(n => n.id))
    const refMap = iframeOverlayRefFnByIdRef.current
    for (const [id] of refMap) {
      if (!keep.has(id)) refMap.delete(id)
    }
  }, [mediaOverlayNodeIdsKey, mediaOverlayNodes])

  const getOverlayRefForId = useCallback(
    (id: string) => {
      const key = String(id || '').trim()
      if (!key) return () => void 0
      const cached = iframeOverlayRefFnByIdRef.current.get(key)
      if (cached) return cached
      const fn = (el: HTMLElement | null) => {
        if (!el) {
          iframeOverlayElsRef.current.delete(key)
          return
        }
        const prev = iframeOverlayElsRef.current.get(key)
        if (prev === el) return
        iframeOverlayElsRef.current.set(key, el)
        try {
          applyPanelBox(el, { left: -99999, top: -99999, w: 1, h: 1, display: 'block', zIndex: 1 })
        } catch {
          void 0
        }
        try {
          requestMediaOverlaySchedule()
        } catch {
          void 0
        }
      }
      iframeOverlayRefFnByIdRef.current.set(key, fn)
      return fn
    },
    [requestMediaOverlaySchedule],
  )

  useEffect(() => {
    mediaOverlayScheduleRef.current = null
    if (!active) return
    if (mediaOverlayNodes.length === 0) return
    const density = mediaPanelDensity === 'compact' ? 'compact' : 'default'
    const widthRatioRaw = density === 'compact' ? threeIframeOverlayBaseWidthRatioCompact : threeIframeOverlayBaseWidthRatioDefault
    const widthMinRaw = density === 'compact' ? threeIframeOverlayBaseWidthMinPxCompact : threeIframeOverlayBaseWidthMinPxDefault
    const widthMaxRaw = density === 'compact' ? threeIframeOverlayBaseWidthMaxPxCompact : threeIframeOverlayBaseWidthMaxPxDefault

    const loop = startMediaOverlayLayoutLoop2d({
      enabled: true,
      loop: 'always',
      items: mediaOverlayNodes,
      density,
      viewportW: sceneWidth,
      viewportH: sceneHeight,
      readTransform: () => {
        const svgEl = svgRef.current
        if (!svgEl) return null
        return d3.zoomTransform(svgEl as unknown as SVGSVGElement)
      },
      getElementForId: id => iframeOverlayElsRef.current.get(id) || null,
      getNodeWorldCenterForId: id => {
        const graph = sceneGraphDataRef.current
        const sim = simulationRef.current
        const simNodes = sim ? (sim.nodes() as unknown as GraphNode[]) : []
        const graphNodes = Array.isArray(graph?.nodes) ? (graph!.nodes as GraphNode[]) : []
        const rev = typeof graphDataRevision === 'number' && Number.isFinite(graphDataRevision) ? graphDataRevision : 0
        if (iframeNodeByIdRef.current.rev !== rev || iframeNodeByIdRef.current.sim !== sim) {
          const map = new Map<string, GraphNode>()
          for (let i = 0; i < graphNodes.length; i += 1) {
            const n = graphNodes[i]
            const key = String(n?.id || '').trim()
            if (!key) continue
            map.set(key, n)
          }
          for (let i = 0; i < simNodes.length; i += 1) {
            const n = simNodes[i]
            const key = String(n?.id || '').trim()
            if (!key) continue
            map.set(key, n)
          }
          iframeNodeByIdRef.current = { rev, sim: sim || null, map }
        }
        const n = iframeNodeByIdRef.current.map.get(id) || null
        return readNodeCenterWorld2d(n, { coords: 'center' })
      },
      sizingConfig: {
        widthRatio: Number.isFinite(widthRatioRaw) ? Math.max(0.001, Number(widthRatioRaw)) : 0.2,
        widthMinPx: Number.isFinite(widthMinRaw) ? Math.max(1, Math.floor(Number(widthMinRaw))) : 210,
        widthMaxPx: Number.isFinite(widthMaxRaw) ? Math.max(1, Math.floor(Number(widthMaxRaw))) : 360,
      },
    })

    mediaOverlayScheduleRef.current = loop.schedule
    if (mediaOverlaySchedulePendingRef.current) {
      mediaOverlaySchedulePendingRef.current = false
      loop.schedule()
    }

    return () => {
      loop.stop()
      if (mediaOverlayScheduleRef.current === loop.schedule) {
        mediaOverlayScheduleRef.current = null
      }
    }
  }, [
    active,
    graphDataRevision,
    mediaOverlayNodeIdsKey,
    mediaOverlayNodes,
    mediaPanelDensity,
    sceneHeight,
    sceneWidth,
    sceneGraphDataRef,
    simulationRef,
    svgRef,
    threeIframeOverlayBaseWidthMaxPxCompact,
    threeIframeOverlayBaseWidthMaxPxDefault,
    threeIframeOverlayBaseWidthMinPxCompact,
    threeIframeOverlayBaseWidthMinPxDefault,
    threeIframeOverlayBaseWidthRatioCompact,
    threeIframeOverlayBaseWidthRatioDefault,
  ])

  return {
    mediaOverlayNodes,
    mediaOverlayNodeIdSet,
    getOverlayRefForId,
    stopEvent,
    beginMediaHeaderDrag,
    moveMediaHeaderDrag,
    endMediaHeaderDrag,
    startMediaOverlayPan,
    moveMediaOverlayPan,
    endMediaOverlayPan,
    requestMediaOverlaySchedule,
  }
}
