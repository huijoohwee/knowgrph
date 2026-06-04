import React from 'react'
import type { Camera, WebGLRenderer } from 'three'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { ThreeCameraPose } from '@/hooks/store/types'
import type { GraphData, GraphNode, JSONValue } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import RichMediaPanel from '@/components/RichMediaPanel'
import {
  listDisplayRichMediaOverlayNodes,
  commitRichMediaPanelChange,
  computeRichMediaOverlayConnectedValuesByNodeId,
  resolveRichMediaPanelInteractive,
} from '@/lib/render/richMediaSsot'
import { buildPanelOnlyNodeIdSetFromGraphNodes } from '@/lib/render/markdownPanelOverlayPool'
import { readWidgetRegistryMetadataEntries } from '@/lib/config.flow-editor'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { getCachedGraphLookup } from '@/lib/graph/lookupCache'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import {
  computeOverlayDragStartScreenSpace3d,
  computeOverlayDraggedWorldPos3d,
  computeThreeCameraPoseAfterOverlayPan,
} from '@/lib/canvas/overlayInteractions3d'
import {
  createThreeMediaOverlayLayoutScratch,
  updateThreeMediaOverlayLayout,
} from './threeRichMediaOverlayLayout'

type StoreSlice = {
  renderMediaAsNodes: boolean
  infiniteCanvasInteractionMode: 'static' | 'interactive'
  mediaPanelDensity: unknown
  threeIframeOverlayPoolMax: unknown
  threeIframeOverlayMaxVisibleDefault: unknown
  threeIframeOverlayMaxVisibleCompact: unknown
  threeIframeOverlayMaxDistanceDefault: unknown
  threeIframeOverlayMaxDistanceCompact: unknown
  threeIframeOverlayBaseWidthRatioDefault: unknown
  threeIframeOverlayBaseWidthRatioCompact: unknown
  threeIframeOverlayBaseWidthMinPxDefault: unknown
  threeIframeOverlayBaseWidthMinPxCompact: unknown
  threeIframeOverlayBaseWidthMaxPxDefault: unknown
  threeIframeOverlayBaseWidthMaxPxCompact: unknown
  threeIframeOverlaySizeScaleFactor: unknown
  graphDataRevision: number
  selectedNodeId: unknown
  selectedNodeIds: unknown
}

export function useThreeRichMediaOverlayController(args: {
  active: boolean
  sceneGraph: GraphData | null
  effectiveSchema: GraphSchema
  positions: Record<string, [number, number, number]>
  glCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>
  containerRef: React.MutableRefObject<HTMLElement | null>
  threeCameraRef: React.MutableRefObject<Camera | null>
  threeGlRef: React.MutableRefObject<WebGLRenderer | null>
  draggedNodeIdRef: React.MutableRefObject<string | null>
  setDraggedNodeId: React.Dispatch<React.SetStateAction<string | null>>
}) {
  const store = useGraphStore(
    useShallow((s): StoreSlice => ({
      renderMediaAsNodes: s.renderMediaAsNodes === true,
      infiniteCanvasInteractionMode: (s.infiniteCanvasInteractionMode || 'static') as 'static' | 'interactive',
      mediaPanelDensity: s.mediaPanelDensity,
      threeIframeOverlayPoolMax: s.threeIframeOverlayPoolMax,
      threeIframeOverlayMaxVisibleDefault: s.threeIframeOverlayMaxVisibleDefault,
      threeIframeOverlayMaxVisibleCompact: s.threeIframeOverlayMaxVisibleCompact,
      threeIframeOverlayMaxDistanceDefault: s.threeIframeOverlayMaxDistanceDefault,
      threeIframeOverlayMaxDistanceCompact: s.threeIframeOverlayMaxDistanceCompact,
      threeIframeOverlayBaseWidthRatioDefault: s.threeIframeOverlayBaseWidthRatioDefault,
      threeIframeOverlayBaseWidthRatioCompact: s.threeIframeOverlayBaseWidthRatioCompact,
      threeIframeOverlayBaseWidthMinPxDefault: s.threeIframeOverlayBaseWidthMinPxDefault,
      threeIframeOverlayBaseWidthMinPxCompact: s.threeIframeOverlayBaseWidthMinPxCompact,
      threeIframeOverlayBaseWidthMaxPxDefault: s.threeIframeOverlayBaseWidthMaxPxDefault,
      threeIframeOverlayBaseWidthMaxPxCompact: s.threeIframeOverlayBaseWidthMaxPxCompact,
      threeIframeOverlaySizeScaleFactor: s.threeIframeOverlaySizeScaleFactor,
      graphDataRevision: s.graphDataRevision || 0,
      selectedNodeId: s.selectedNodeId,
      selectedNodeIds: s.selectedNodeIds,
    })),
  )
  const overlayElsRef = React.useRef<Map<string, HTMLElement>>(new Map())
  const visibleIdsRef = React.useRef<Set<string>>(new Set())
  const scheduleRef = React.useRef<(() => void) | null>(null)
  const refFnByIdRef = React.useRef<Map<string, (el: HTMLElement | null) => void>>(new Map())
  const scheduleRafRef = React.useRef<number | null>(null)
  const schedulePendingRef = React.useRef<boolean>(false)
  const missFramesRef = React.useRef<Map<string, number>>(new Map())
  const pointerOverrideActiveRef = React.useRef<boolean>(false)
  const pointerOverrideResetTimerRef = React.useRef<number | null>(null)
  const dragOverridesRef = React.useRef<Record<string, [number, number, number]>>({})
  const headerDragRef = React.useRef<null | { id: string; pointerId: number; sx: number; sy: number; ndcZ: number; w: number; h: number }>(null)
  const overlayPanRef = React.useRef<null | { pointerId: number; pose: ThreeCameraPose }>(null)
  const scratchRef = React.useRef(createThreeMediaOverlayLayoutScratch())

  const sceneGraphSemanticKey = React.useMemo(
    () => buildScopedGraphSemanticKey('three-rich-media-overlays-scene-graph', { graphData: args.sceneGraph, graphRevision: store.graphDataRevision }),
    [args.sceneGraph, store.graphDataRevision],
  )
  const sceneGraphLookup = React.useMemo(() => getCachedGraphLookup({
    cacheScope: 'three-rich-media-overlays-scene-graph',
    graphData: args.sceneGraph,
    graphRevision: store.graphDataRevision,
    graphSemanticKey: sceneGraphSemanticKey,
    preferCurrentGraphDataRefs: true,
  }), [args.sceneGraph, sceneGraphSemanticKey, store.graphDataRevision])
  const richMediaConnectedValuesByNodeId = React.useMemo(() => {
    const metadata = (args.sceneGraph?.metadata || {}) as Record<string, unknown>
    const registry = readWidgetRegistryMetadataEntries<WidgetRegistryEntry>(metadata)
    return computeRichMediaOverlayConnectedValuesByNodeId({
      graphData: args.sceneGraph,
      registry,
      graphRevision: store.graphDataRevision,
      graphSemanticKey: sceneGraphSemanticKey,
      includeMediaSpecNodes: true,
    })
  }, [args.sceneGraph, sceneGraphSemanticKey, store.graphDataRevision])
  const overlayNodesPool = React.useMemo(() => {
    const nodes = args.sceneGraph && Array.isArray(args.sceneGraph.nodes) ? (args.sceneGraph.nodes as GraphNode[]) : []
    const poolMaxRaw = typeof store.threeIframeOverlayPoolMax === 'number' && Number.isFinite(store.threeIframeOverlayPoolMax) ? store.threeIframeOverlayPoolMax : 0
    const preferredNodeIds = [store.selectedNodeId, ...(Array.isArray(store.selectedNodeIds) ? store.selectedNodeIds : [])]
    return listDisplayRichMediaOverlayNodes({
      renderMediaAsNodes: store.renderMediaAsNodes,
      nodes,
      poolMax: poolMaxRaw > 0 ? poolMaxRaw : 24,
      preferredNodeIds,
      connectedValuesByNodeId: richMediaConnectedValuesByNodeId,
      nodeById: sceneGraphLookup?.nodeById || undefined,
    })
  }, [args.sceneGraph, richMediaConnectedValuesByNodeId, sceneGraphLookup, store.renderMediaAsNodes, store.selectedNodeId, store.selectedNodeIds, store.threeIframeOverlayPoolMax])
  const mediaNodesKey = React.useMemo(() => overlayNodesPool.map(n => n.id).join('|'), [overlayNodesPool])
  const requestSchedule = React.useCallback(() => {
    const schedule = scheduleRef.current
    if (schedule) {
      schedule()
      return
    }
    schedulePendingRef.current = true
    if (scheduleRafRef.current != null) return
    scheduleRafRef.current = requestAnimationFrame(() => {
      scheduleRafRef.current = null
      try {
        scheduleRef.current?.()
      } catch {
        void 0
      }
    })
  }, [])

  React.useEffect(() => () => {
    const raf = scheduleRafRef.current
    if (raf == null) return
    scheduleRafRef.current = null
    try {
      cancelAnimationFrame(raf)
    } catch {
      void 0
    }
  }, [])

  React.useEffect(() => {
    if (!args.active || overlayNodesPool.length === 0) return
    const schedule = () => {
      try {
        requestSchedule()
      } catch {
        void 0
      }
    }
    schedule()
    const canvas = args.glCanvasRef.current
    const container = args.containerRef.current
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      try {
        ro = new ResizeObserver(() => schedule())
        if (canvas) ro.observe(canvas)
        if (container) ro.observe(container)
      } catch {
        ro = null
      }
    }
    window.addEventListener('resize', schedule, { passive: true })
    return () => {
      window.removeEventListener('resize', schedule)
      ro?.disconnect()
    }
  }, [args.active, args.containerRef, args.glCanvasRef, mediaNodesKey, overlayNodesPool.length, requestSchedule])

  const getOverlayRefForId = React.useCallback((id: string) => {
    const key = String(id || '').trim()
    if (!key) return () => void 0
    const cached = refFnByIdRef.current.get(key)
    if (cached) return cached
    const fn = (el: HTMLElement | null) => {
      if (!el) {
        overlayElsRef.current.delete(key)
        missFramesRef.current.delete(key)
        return
      }
      const prev = overlayElsRef.current.get(key)
      if (prev === el) return
      overlayElsRef.current.set(key, el)
      try {
        el.style.left = '-99999px'
        el.style.top = '-99999px'
        el.style.width = '1px'
        el.style.height = '1px'
        el.style.display = 'block'
        requestSchedule()
      } catch {
        void 0
      }
    }
    refFnByIdRef.current.set(key, fn)
    return fn
  }, [requestSchedule])

  React.useEffect(() => {
    const keep = new Set<string>(overlayNodesPool.map(n => n.id))
    for (const [id] of overlayElsRef.current) if (!keep.has(id)) overlayElsRef.current.delete(id)
    for (const [id] of refFnByIdRef.current) if (!keep.has(id)) refFnByIdRef.current.delete(id)
    for (const [id] of missFramesRef.current) if (!keep.has(id)) missFramesRef.current.delete(id)
  }, [mediaNodesKey, overlayNodesPool])

  React.useEffect(() => {
    scheduleRef.current = null
    if (!args.active || overlayNodesPool.length === 0) return
    let raf: number | null = null
    const update = () => {
      visibleIdsRef.current = updateThreeMediaOverlayLayout({
        camera: args.threeCameraRef.current,
        gl: args.threeGlRef.current,
        overlayNodesPool,
        positions: args.positions,
        dragOverrides: dragOverridesRef.current,
        overlayEls: overlayElsRef.current,
        missFrames: missFramesRef.current,
        prevVisibleIds: visibleIdsRef.current,
        effectiveSchema: args.effectiveSchema,
        scratch: scratchRef.current,
        ...store,
      })
    }
    const schedule = () => {
      if (raf != null) return
      raf = requestAnimationFrame(() => {
        raf = null
        update()
      })
    }
    scheduleRef.current = schedule
    if (schedulePendingRef.current) {
      schedulePendingRef.current = false
      schedule()
    }
    schedule()
    return () => {
      if (raf != null) cancelAnimationFrame(raf)
      raf = null
      if (scheduleRef.current === schedule) scheduleRef.current = null
    }
  }, [args.active, args.effectiveSchema, args.positions, args.threeCameraRef, args.threeGlRef, mediaNodesKey, overlayNodesPool, store])

  const overlayHiddenNodeIdSet = React.useMemo(() => {
    const nodes = args.sceneGraph && Array.isArray(args.sceneGraph.nodes) ? (args.sceneGraph.nodes as GraphNode[]) : []
    const ids = new Set<string>(overlayNodesPool.map(n => n.id))
    for (const id of buildPanelOnlyNodeIdSetFromGraphNodes(nodes)) ids.add(id)
    return ids
  }, [args.sceneGraph, overlayNodesPool])

  useOverlayPointerOverride({ active: args.active, glCanvasRef: args.glCanvasRef, overlayElsRef, pointerOverrideActiveRef, pointerOverrideResetTimerRef })
  useOverlayDragWatchdog({
    draggedNodeIdRef: args.draggedNodeIdRef,
    dragOverridesRef,
    headerDragRef,
    overlayPanRef,
    setDraggedNodeId: args.setDraggedNodeId,
  })

  const stopEvent = React.useCallback((event: React.SyntheticEvent) => {
    try {
      event.stopPropagation()
    } catch {
      void 0
    }
  }, [])
  const overlayLayer = args.active && overlayNodesPool.length > 0 ? (
    <section aria-label="3D media overlay" className="absolute inset-0 z-[80] pointer-events-none">
      {overlayNodesPool.map(n => (
        <RichMediaPanel
          key={n.id}
          ref={getOverlayRefForId(n.id)}
          className="absolute left-0 top-0 pointer-events-auto"
          title={n.title}
          url={n.url}
          srcDoc={n.srcDoc}
          openUrl={n.openUrl}
          kind={n.kind}
          interactive={resolveRichMediaPanelInteractive({
            nodeInteractive: n.interactive,
            renderMediaAsNodes: store.renderMediaAsNodes,
            infiniteCanvasInteractionMode: store.infiniteCanvasInteractionMode,
          })}
          hideUntilReady={false}
          panel={n.panel}
          onPanelChange={next => {
            if (!n.panel) return
            commitRichMediaPanelChange({
              nodeId: n.id,
              next,
              updateNode: (id, patch) => useGraphStore.getState().updateNode(id, patch as Partial<GraphNode>),
            })
          }}
          forwardWheelTo={store.infiniteCanvasInteractionMode === 'interactive' ? undefined : (() => args.glCanvasRef.current)}
          onOverlayPanStart={({ pointerId }) => {
            const pose = useGraphStore.getState().captureThreeCameraPose()
            if (pose) overlayPanRef.current = { pointerId, pose }
          }}
          onOverlayPan={({ pointerId, dx, dy, shiftKey }) => {
            const st = overlayPanRef.current
            if (!st || st.pointerId !== pointerId) return
            useGraphStore.getState().restoreThreeCameraPose(computeThreeCameraPoseAfterOverlayPan({
              pose: st.pose,
              dxClientPx: dx,
              dyClientPx: dy,
              shiftKey: shiftKey === true,
            }))
          }}
          onOverlayPanEnd={({ pointerId }) => {
            const st = overlayPanRef.current
            if (st && st.pointerId === pointerId) overlayPanRef.current = null
          }}
          onHeaderDragStart={({ clientX, clientY, pointerId }) => {
            const camera = args.threeCameraRef.current
            const gl = args.threeGlRef.current
            const p = dragOverridesRef.current[n.id] || args.positions[n.id]
            if (!camera || !gl || !p) return
            const start = computeOverlayDragStartScreenSpace3d({
              camera,
              world: { x: p[0], y: p[1], z: p[2] },
              viewportW: gl.domElement.clientWidth || 1,
              viewportH: gl.domElement.clientHeight || 1,
            })
            headerDragRef.current = { id: n.id, pointerId, sx: start.sx, sy: start.sy, ndcZ: start.ndcZ, w: start.w, h: start.h }
            args.setDraggedNodeId(n.id)
            void clientX
            void clientY
          }}
          onHeaderDrag={({ dx, dy, pointerId }) => {
            const st = headerDragRef.current
            const camera = args.threeCameraRef.current
            if (!st || st.id !== n.id || st.pointerId !== pointerId || !camera) return
            const next = computeOverlayDraggedWorldPos3d({
              camera,
              startSx: st.sx,
              startSy: st.sy,
              dxClientPx: dx,
              dyClientPx: dy,
              ndcZ: st.ndcZ,
              viewportW: st.w || 1,
              viewportH: st.h || 1,
            })
            if (next) dragOverridesRef.current[n.id] = [next.x, next.y, next.z]
          }}
          onHeaderDragEnd={({ pointerId }) => {
            const st = headerDragRef.current
            if (st && st.id === n.id && st.pointerId === pointerId) headerDragRef.current = null
            const p = dragOverridesRef.current[n.id]
            if (p && useGraphStore.getState().workspaceViewMode === 'editor') {
              const s = useGraphStore.getState()
              const node0 = s.graphData?.nodes?.find(nn => String(nn.id) === String(n.id)) || null
              const baseProps = (node0?.properties || {}) as Record<string, JSONValue>
              try {
                s.updateNode(n.id, { properties: { ...baseProps, pos3d: [p[0], p[1], p[2]] as unknown as JSONValue } })
              } catch {
                void 0
              }
            }
            delete dragOverridesRef.current[n.id]
            args.setDraggedNodeId(null)
          }}
          onWheelCapture={stopEvent}
          onClickCapture={stopEvent}
          onDoubleClickCapture={stopEvent}
          onContextMenuCapture={stopEvent}
        />
      ))}
    </section>
  ) : null

  return { dragOverridesRef, overlayHiddenNodeIdSet, overlayLayer, requestSchedule, scheduleRef }
}

function useOverlayPointerOverride(args: {
  active: boolean
  glCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>
  overlayElsRef: React.MutableRefObject<Map<string, HTMLElement>>
  pointerOverrideActiveRef: React.MutableRefObject<boolean>
  pointerOverrideResetTimerRef: React.MutableRefObject<number | null>
}) {
  const { active, glCanvasRef, overlayElsRef, pointerOverrideActiveRef, pointerOverrideResetTimerRef } = args
  React.useEffect(() => {
    const canvas = glCanvasRef.current
    if (!active || !canvas) return
    const clearTimer = () => {
      const timer = pointerOverrideResetTimerRef.current
      if (timer == null) return
      pointerOverrideResetTimerRef.current = null
      window.clearTimeout(timer)
    }
    const setOverride = (enabled: boolean) => {
      if (pointerOverrideActiveRef.current === enabled) return
      pointerOverrideActiveRef.current = enabled
      for (const [, el] of overlayElsRef.current) {
        if (enabled) el.style.pointerEvents = 'none'
        else el.style.removeProperty('pointer-events')
      }
    }
    const onDown = () => {
      setOverride(true)
      clearTimer()
      pointerOverrideResetTimerRef.current = window.setTimeout(() => {
        pointerOverrideResetTimerRef.current = null
        setOverride(false)
      }, 1500)
    }
    const onUp = () => {
      clearTimer()
      setOverride(false)
    }
    const onWindowMove = (event: PointerEvent) => {
      if ((event.buttons || 0) === 0) onUp()
    }
    canvas.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    window.addEventListener('pointercancel', onUp, { passive: true })
    window.addEventListener('pointermove', onWindowMove, { passive: true })
    window.addEventListener('blur', onUp)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('pointermove', onWindowMove)
      window.removeEventListener('blur', onUp)
      clearTimer()
      setOverride(false)
    }
  }, [active, glCanvasRef, overlayElsRef, pointerOverrideActiveRef, pointerOverrideResetTimerRef])
}

function useOverlayDragWatchdog(args: {
  draggedNodeIdRef: React.MutableRefObject<string | null>
  dragOverridesRef: React.MutableRefObject<Record<string, [number, number, number]>>
  headerDragRef: React.MutableRefObject<null | { id: string; pointerId: number; sx: number; sy: number; ndcZ: number; w: number; h: number }>
  overlayPanRef: React.MutableRefObject<null | { pointerId: number; pose: ThreeCameraPose }>
  setDraggedNodeId: React.Dispatch<React.SetStateAction<string | null>>
}) {
  const { draggedNodeIdRef, dragOverridesRef, headerDragRef, overlayPanRef, setDraggedNodeId } = args
  React.useEffect(() => {
    const clearStaleOverlayDragState = () => {
      const header = headerDragRef.current
      if (header) {
        delete dragOverridesRef.current[header.id]
        headerDragRef.current = null
      }
      if (overlayPanRef.current) overlayPanRef.current = null
      if (draggedNodeIdRef.current != null) setDraggedNodeId(null)
    }
    const onAnyEnd = () => {
      if (!headerDragRef.current && !overlayPanRef.current && draggedNodeIdRef.current == null) return
      clearStaleOverlayDragState()
    }
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') onAnyEnd()
    }
    window.addEventListener('pointerup', onAnyEnd, { capture: true })
    window.addEventListener('pointercancel', onAnyEnd, { capture: true })
    window.addEventListener('pointerdown', onAnyEnd, { capture: true })
    window.addEventListener('blur', onAnyEnd)
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
    const watchdog = window.setInterval(onAnyEnd, 12000) as unknown as number
    return () => {
      window.removeEventListener('pointerup', onAnyEnd, { capture: true } as AddEventListenerOptions)
      window.removeEventListener('pointercancel', onAnyEnd, { capture: true } as AddEventListenerOptions)
      window.removeEventListener('pointerdown', onAnyEnd, { capture: true } as AddEventListenerOptions)
      window.removeEventListener('blur', onAnyEnd)
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(watchdog)
      clearStaleOverlayDragState()
    }
  }, [draggedNodeIdRef, dragOverridesRef, headerDragRef, overlayPanRef, setDraggedNodeId])
}
