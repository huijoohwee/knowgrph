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
  excludeNodeIdsKey?: string
  excludeNodeIdSet?: Set<string>
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
  freezeOverlayMembership?: boolean
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
    excludeNodeIdsKey,
    excludeNodeIdSet,
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
    freezeOverlayMembership,
  } = args

  const iframeOverlayElsRef = useRef<Map<string, HTMLElement>>(new Map())
  const [mountedOverlayIdsKey, setMountedOverlayIdsKey] = React.useState<string>('')

  const updateMountedOverlayIdsKey = React.useCallback(() => {
    try {
      const ids = Array.from(iframeOverlayElsRef.current.keys())
        .map(v => String(v || '').trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
        .join('|')
      setMountedOverlayIdsKey(prev => (prev === ids ? prev : ids))
    } catch {
      setMountedOverlayIdsKey('')
    }
  }, [])
  const iframeNodeByIdRef = useRef<{ rev: number; sim: unknown | null; map: Map<string, GraphNode> }>({ rev: -1, sim: null, map: new Map() })
  const mediaOverlayScheduleRef = useRef<(() => void) | null>(null)
  const mediaOverlayScheduleRafRef = useRef<number | null>(null)
  const mediaOverlaySchedulePendingRef = useRef<boolean>(false)
  const iframeOverlayRefFnByIdRef = useRef<Map<string, (el: HTMLDivElement | null) => void>>(new Map())
  const stickyOverlayNodeByIdRef = useRef<Map<string, ReturnType<typeof listMediaOverlayNodes>[number]>>(new Map())
  const stickyOverlayOrderRef = useRef<string[]>([])

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

  const mediaOverlayNodes = useMemo(() => {
    const nodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData!.nodes as GraphNode[]) : []
    const poolMaxRaw = typeof threeIframeOverlayPoolMax === 'number' && Number.isFinite(threeIframeOverlayPoolMax) ? threeIframeOverlayPoolMax : 0
    const poolMax = poolMaxRaw > 0 ? poolMaxRaw : 24
    const st = useGraphStore.getState() as unknown as { selectedNodeId?: unknown; selectedNodeIds?: unknown }
    const preferredNodeIds = [st.selectedNodeId, ...(Array.isArray(st.selectedNodeIds) ? st.selectedNodeIds : [])]
    const suggested = listMediaOverlayNodes({ enabled: true, nodes, poolMax, preferredNodeIds, excludeNodeIdSet })

    const stickyMap = stickyOverlayNodeByIdRef.current
    for (let i = 0; i < suggested.length; i += 1) {
      const n = suggested[i]!
      stickyMap.set(n.id, n)
    }

    const pinnedOrder = Array.from(iframeOverlayElsRef.current.keys())
    const prevOrder = stickyOverlayOrderRef.current
    if (freezeOverlayMembership === true) {
      const frozenSource = pinnedOrder.length > 0 ? pinnedOrder : prevOrder
      const frozenIds: string[] = []
      for (let i = 0; i < frozenSource.length; i += 1) {
        if (frozenIds.length >= poolMax) break
        const id = String(frozenSource[i] || '').trim()
        if (!id) continue
        if (frozenIds.includes(id)) continue
        const n = stickyMap.get(id)
        if (!n) continue
        frozenIds.push(id)
      }
      if (frozenIds.length > 0) {
        stickyOverlayOrderRef.current = frozenIds
        const outFrozen: typeof suggested = []
        for (let i = 0; i < frozenIds.length; i += 1) {
          const n = stickyMap.get(frozenIds[i]!)
          if (n) outFrozen.push(n)
        }
        return outFrozen
      }
    }
    const needed = new Set<string>()
    for (let i = 0; i < pinnedOrder.length; i += 1) {
      const id = String(pinnedOrder[i] || '').trim()
      if (id) needed.add(id)
    }
    for (let i = 0; i < prevOrder.length; i += 1) {
      const id = String(prevOrder[i] || '').trim()
      if (id) needed.add(id)
    }
    for (let i = 0; i < suggested.length; i += 1) {
      const id = String(suggested[i]!.id || '').trim()
      if (id) needed.add(id)
    }

    const nodeById = new Map<string, GraphNode>()
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]!
      const id = String(n?.id || '').trim()
      if (!id) continue
      if (!needed.has(id)) continue
      nodeById.set(id, n)
    }

    const isValidOverlayId = (id: string): boolean => {
      const key = String(id || '').trim()
      if (!key) return false
      if (excludeNodeIdSet?.has(key)) return false
      const n = nodeById.get(key)
      if (!n) return false
      const spec = getNodeMediaSpec(n)
      if (!spec) return false
      return true
    }

    const nextIds: string[] = []
    for (let i = 0; i < pinnedOrder.length; i += 1) {
      if (nextIds.length >= poolMax) break
      const id = String(pinnedOrder[i] || '').trim()
      if (!id) continue
      if (nextIds.includes(id)) continue
      if (!stickyMap.has(id)) continue
      if (!isValidOverlayId(id)) continue
      nextIds.push(id)
    }
    for (let i = 0; i < prevOrder.length; i += 1) {
      if (nextIds.length >= poolMax) break
      const id = String(prevOrder[i] || '').trim()
      if (!id) continue
      if (nextIds.includes(id)) continue
      if (!stickyMap.has(id)) continue
      if (!isValidOverlayId(id)) continue
      nextIds.push(id)
    }
    for (let i = 0; i < suggested.length; i += 1) {
      if (nextIds.length >= poolMax) break
      const id = String(suggested[i]!.id || '').trim()
      if (!id) continue
      if (nextIds.includes(id)) continue
      nextIds.push(id)
    }

    stickyOverlayOrderRef.current = nextIds
    const out: typeof suggested = []
    for (let i = 0; i < nextIds.length; i += 1) {
      const n = stickyMap.get(nextIds[i]!)
      if (n) out.push(n)
    }
    if (stickyMap.size > Math.max(96, poolMax * 6)) {
      const keep = new Set<string>(nextIds)
      for (const id of suggested) keep.add(id.id)
      for (const [id] of stickyMap) {
        if (!keep.has(id)) stickyMap.delete(id)
      }
    }
    return out
  }, [excludeNodeIdsKey, freezeOverlayMembership, sceneGraphData, threeIframeOverlayPoolMax])

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
    updateMountedOverlayIdsKey()
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
          updateMountedOverlayIdsKey()
          return
        }
        const prev = iframeOverlayElsRef.current.get(key)
        if (prev === el) return
        iframeOverlayElsRef.current.set(key, el)
        updateMountedOverlayIdsKey()
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

  const mediaOverlayHideNodeIdSet = React.useMemo(() => {
    if (!mountedOverlayIdsKey) return undefined
    const ids = mountedOverlayIdsKey.split('|').map(v => String(v || '').trim()).filter(Boolean)
    return ids.length ? new Set(ids) : undefined
  }, [mountedOverlayIdsKey])

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
    mediaOverlayHideNodeIdSet,
    getOverlayRefForId,
    requestMediaOverlaySchedule,
  }
}
