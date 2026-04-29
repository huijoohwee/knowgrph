import React from 'react'
import * as d3 from 'd3'

import RichMediaPanel from '@/components/RichMediaPanel'
import { __flowCanvasDebug } from '@/components/FlowCanvas/flowCanvasDebug'
import type { FlowNativeDrawArgs, FlowNativeRuntime } from '@/components/FlowCanvas/nativeRuntime'
import { requestFlowNativeDraw, setFlowNativeTransform } from '@/components/FlowCanvas/nativeRuntime'
import { computeWidgetScale, computeCollectiveFollowPinnedScale } from '@/components/FlowEditor/widgetZoom'
import { useGraphStore } from '@/hooks/useGraphStore'
import { disableAutoZoomModesForUserGesture } from '@/lib/canvas/auto-zoom-modes'
import { computeOverlayDraggedPoint2d, computeOverlayPanTransform2d } from '@/lib/canvas/overlayInteractions2d'
import type { GraphSchema } from '@/lib/graph/schema'
import { createRafLatestScheduler, type RafLatestScheduler } from '@/lib/react/rafLatestScheduler'
import { isCanonicalNodeIdEqual } from '@/lib/graph/canonicalNodeIds'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import {
  commitRichMediaPanelChange,
  normalizeRichMediaPanelDensity,
  resolveRichMediaPanelInteractive,
} from '@/lib/render/richMediaSsot'
import { readNodeCenterWorld2d } from '@/lib/render/mediaAnchor'
import type { MediaOverlayNode } from '@/lib/render/mediaOverlayPool'
import { startMediaOverlayLayoutLoop2d } from '@/lib/render/mediaOverlayLayoutLoop2d'

export default function FlowCanvasMediaOverlays(args: {
  active: boolean
  mediaNodes: MediaOverlayNode[]
  panelOnlyNodeIdSet: Set<string> | null
  selectedOverlayNodeIdSet: Set<string>
  sceneGraphData: GraphData | null
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>
  runtimeRef: React.MutableRefObject<FlowNativeRuntime | null>
  drawArgsRef: React.MutableRefObject<FlowNativeDrawArgs>
  positionsDirtySinceCommitRef: React.MutableRefObject<boolean>
  requestCommit: () => void
  onInteractionFrame?: () => void
  schema: unknown
  canvas2dRenderer: string
  frontmatterModeEnabled: boolean
  documentSemanticMode: string
  flowEditorOverlayInteractionMode: boolean
  flowEditorFrontmatterInteractionMode: boolean
  mediaPanelDensity: 'default' | 'compact'
  renderMediaAsNodes: boolean
  infiniteCanvasInteractionMode: 'static' | 'interactive'
  viewportW: number
  viewportH: number
  threeIframeOverlayBaseWidthRatioDefault?: number
  threeIframeOverlayBaseWidthRatioCompact?: number
  threeIframeOverlayBaseWidthMinPxDefault?: number
  threeIframeOverlayBaseWidthMinPxCompact?: number
  threeIframeOverlayBaseWidthMaxPxDefault?: number
  threeIframeOverlayBaseWidthMaxPxCompact?: number
  onPlannedOverlayNodeIdsChange: (ids: string[]) => void
}) {
  const {
    active,
    mediaNodes,
    panelOnlyNodeIdSet,
    selectedOverlayNodeIdSet,
    sceneGraphData,
    canvasRef,
    runtimeRef,
    drawArgsRef,
    positionsDirtySinceCommitRef,
    requestCommit,
    onInteractionFrame,
    schema,
    canvas2dRenderer,
    frontmatterModeEnabled,
    documentSemanticMode,
    flowEditorOverlayInteractionMode,
    flowEditorFrontmatterInteractionMode,
    mediaPanelDensity,
    renderMediaAsNodes,
    infiniteCanvasInteractionMode,
    viewportW,
    viewportH,
    threeIframeOverlayBaseWidthRatioDefault,
    threeIframeOverlayBaseWidthRatioCompact,
    threeIframeOverlayBaseWidthMinPxDefault,
    threeIframeOverlayBaseWidthMinPxCompact,
    threeIframeOverlayBaseWidthMaxPxDefault,
    threeIframeOverlayBaseWidthMaxPxCompact,
    onPlannedOverlayNodeIdsChange,
  } = args
  const graphSchema = schema as GraphSchema

  const mediaOverlayElsRef = React.useRef<Map<string, HTMLElement>>(new Map())
  const mediaOverlayPanelSizeOverrideRef = React.useRef<Map<string, { w: number; h: number }>>(new Map())
  const mediaOverlayPanelSizeTargetWorldRef = React.useRef<Map<string, { w: number; h: number }>>(new Map())
  const mediaOverlayLayoutScheduleRef = React.useRef<null | (() => void)>(null)
  const mediaOverlayHeaderDragRef = React.useRef<null | { id: string; pointerId: number; startX: number; startY: number; startK: number; lastDx: number; lastDy: number }>(null)
  const mediaOverlayPanRef = React.useRef<null | { pointerId: number; startTransform: d3.ZoomTransform }>(null)
  const mediaOverlayResizeRef = React.useRef<null | { id: string; pointerId: number; startW: number; startH: number; startScale: number; headerH: number; bodyAspect: number; lastW: number; lastH: number }>(null)
  const mediaOverlayPanMoveLatestRef = React.useRef<{ pointerId: number; clientX: number; clientY: number; dx: number; dy: number; buttons: number; shiftKey: boolean } | null>(null)
  const mediaOverlayHeaderMoveLatestRef = React.useRef<{ id: string; pointerId: number; dx: number; dy: number } | null>(null)
  const mediaOverlayResizeMoveLatestRef = React.useRef<{ id: string; pointerId: number; dx: number; dy: number } | null>(null)
  const mediaOverlayPanMoveSchedulerRef = React.useRef<RafLatestScheduler<{ pointerId: number; clientX: number; clientY: number; dx: number; dy: number; buttons: number; shiftKey: boolean }> | null>(null)
  const mediaOverlayHeaderMoveSchedulerRef = React.useRef<RafLatestScheduler<{ id: string; pointerId: number; dx: number; dy: number }> | null>(null)
  const mediaOverlayResizeMoveSchedulerRef = React.useRef<RafLatestScheduler<{ id: string; pointerId: number; dx: number; dy: number }> | null>(null)
  const lastPlannedOverlayNodeIdsKeyRef = React.useRef<string>('')
  const sceneNodePropsByIdRef = React.useRef<Map<string, Record<string, unknown>>>(new Map())

  React.useEffect(() => {
    const next = new Map<string, Record<string, unknown>>()
    const nodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData.nodes as Array<{ id?: unknown; properties?: unknown }>) : []
    for (let i = 0; i < nodes.length; i += 1) {
      const id = String(nodes[i]?.id || '').trim()
      const props = nodes[i]?.properties
      if (!id || !props || typeof props !== 'object' || Array.isArray(props)) continue
      next.set(id, props as Record<string, unknown>)
    }
    sceneNodePropsByIdRef.current = next
  }, [sceneGraphData])

  React.useEffect(() => {
    __flowCanvasDebug.sceneNodeIds = Array.isArray(sceneGraphData?.nodes)
      ? sceneGraphData.nodes.map(node => String(node?.id || '').trim()).filter(Boolean)
      : []
  }, [sceneGraphData])
  React.useEffect(() => {
    __flowCanvasDebug.mediaNodeIds = mediaNodes.map(node => String(node.id || '').trim()).filter(Boolean)
    __flowCanvasDebug.overlayNodeIds = mediaNodes.map(node => String(node.id || '').trim()).filter(Boolean)
  }, [mediaNodes])
  React.useEffect(() => {
    try {
      ;(window as unknown as { __flowCanvasDebug?: unknown }).__flowCanvasDebug = __flowCanvasDebug
      return () => {
        try {
          const win = window as unknown as { __flowCanvasDebug?: unknown }
          if (win.__flowCanvasDebug === __flowCanvasDebug) delete win.__flowCanvasDebug
        } catch {
          void 0
        }
      }
    } catch {
      return () => void 0
    }
  }, [])

  const plannedOverlayNodeIds = React.useMemo(() => {
    const ids = mediaNodes.map(node => String(node.id || '').trim()).filter(Boolean)
    if (panelOnlyNodeIdSet) {
      for (const id of panelOnlyNodeIdSet) ids.push(id)
    }
    return ids.length <= 1 ? ids : Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b))
  }, [mediaNodes, panelOnlyNodeIdSet])
  const plannedOverlayNodeIdsKey = React.useMemo(() => plannedOverlayNodeIds.join('|'), [plannedOverlayNodeIds])
  const mediaLayoutItemIds = React.useMemo(
    () => mediaNodes.map(node => String(node.id || '').trim()).filter(Boolean),
    [mediaNodes],
  )
  const mediaLayoutItemIdsKey = React.useMemo(() => mediaLayoutItemIds.join('|'), [mediaLayoutItemIds])
  const mediaLayoutItems = React.useMemo(
    () => mediaLayoutItemIds.map(id => ({ id })),
    [mediaLayoutItemIdsKey],
  )

  React.useEffect(() => {
    if (lastPlannedOverlayNodeIdsKeyRef.current === plannedOverlayNodeIdsKey) return
    lastPlannedOverlayNodeIdsKeyRef.current = plannedOverlayNodeIdsKey
    onPlannedOverlayNodeIdsChange(plannedOverlayNodeIds)
  }, [onPlannedOverlayNodeIdsChange, plannedOverlayNodeIds, plannedOverlayNodeIdsKey])

  const buildDrawArgs = React.useCallback(() => drawArgsRef.current, [drawArgsRef])
  const handleFrame = React.useCallback(() => {
    mediaOverlayLayoutScheduleRef.current?.()
    onInteractionFrame?.()
  }, [onInteractionFrame])
  const stopEvent = React.useCallback((event: React.SyntheticEvent) => {
    try {
      event.stopPropagation()
    } catch {
      void 0
    }
  }, [])
  const isFlowEditorFrontmatterDocumentInteractionMode = React.useCallback(() => {
    return canvas2dRenderer === 'flowEditor'
      && frontmatterModeEnabled === true
      && String(documentSemanticMode || '').trim() === 'document'
  }, [canvas2dRenderer, documentSemanticMode, frontmatterModeEnabled])
  const computeOverlaySizingScale = React.useCallback((zoomK: number, itemCount: number, panelW: number, panelH: number) => {
    return computeCollectiveFollowPinnedScale({
      zoomK,
      viewportW,
      viewportH,
      count: itemCount,
      baseWidth: panelW,
      baseHeight: panelH,
      quantizeStep: 0.02,
      hardMinScale: 0.62,
      hardMaxScale: 1.08,
    })
  }, [viewportH, viewportW])

  const writeRichMediaResizeTrace = React.useCallback((parts: Array<string | number>) => {
    try {
      __flowCanvasDebug.lastRichMediaResizeTrace = parts.map(v => String(v)).join('|')
    } catch {
      void 0
    }
  }, [])

  const applyMediaOverlayPanMove = React.useCallback((queued: { pointerId: number; clientX: number; clientY: number; dx: number; dy: number; buttons: number; shiftKey: boolean }) => {
    if (!flowEditorOverlayInteractionMode) return
    const drag = mediaOverlayPanRef.current
    if (!drag || drag.pointerId !== queued.pointerId) return
    const runtime = runtimeRef.current
    if (!runtime) return
    const store = useGraphStore.getState() as { canvasPanSpeedMultiplier?: unknown; canvasInteractionSpeedMultiplier?: unknown }
    const next = computeOverlayPanTransform2d({
      startTransform: drag.startTransform,
      dxClientPx: queued.dx,
      dyClientPx: queued.dy,
      canvasPanSpeedMultiplier: store.canvasPanSpeedMultiplier,
      canvasInteractionSpeedMultiplier: store.canvasInteractionSpeedMultiplier,
      applySpeedMultipliers: true,
    })
    setFlowNativeTransform(runtime, next)
    requestFlowNativeDraw(runtime, buildDrawArgs())
    onInteractionFrame?.()
  }, [buildDrawArgs, flowEditorOverlayInteractionMode, onInteractionFrame, runtimeRef])

  const applyMediaOverlayHeaderDragMove = React.useCallback((id: string, queued: { pointerId: number; dx: number; dy: number }) => {
    if (!flowEditorOverlayInteractionMode) return
    const drag = mediaOverlayHeaderDragRef.current
    if (!drag || drag.id !== id || drag.pointerId !== queued.pointerId) return
    const runtime = runtimeRef.current
    const scene = runtime?.scene
    if (!runtime || !scene) return
    const node = scene.nodeById.get(id)
    if (!node) return
    drag.lastDx = queued.dx
    drag.lastDy = queued.dy
    const next = computeOverlayDraggedPoint2d({
      baseX: drag.startX,
      baseY: drag.startY,
      dxClientPx: queued.dx,
      dyClientPx: queued.dy,
      zoomK: drag.startK,
      schema: graphSchema,
      snapToGrid: false,
    })
    node.x = next.x
    node.y = next.y
    runtime.dirty = true
    positionsDirtySinceCommitRef.current = true
    requestFlowNativeDraw(runtime, buildDrawArgs())
    handleFrame()
  }, [buildDrawArgs, flowEditorOverlayInteractionMode, graphSchema, handleFrame, positionsDirtySinceCommitRef, runtimeRef])

  const applyMediaOverlayResizeMove = React.useCallback((id: string, queued: { pointerId: number; dx: number; dy: number }) => {
    if (!flowEditorOverlayInteractionMode) return
    const drag = mediaOverlayResizeRef.current
    if (!drag || drag.id !== id || drag.pointerId !== queued.pointerId) return
    const scale = Math.max(0.001, drag.startScale)
    const chosenW = Math.abs(queued.dy) > Math.abs(queued.dx)
      ? Math.max(1, drag.startH + queued.dy / scale - drag.headerH) / Math.max(0.001, drag.bodyAspect)
      : drag.startW + queued.dx / scale
    const nextW = Math.max(24, Math.round(chosenW))
    const nextH = Math.max(24 + drag.headerH, Math.round(nextW * drag.bodyAspect + drag.headerH))
    drag.lastW = nextW
    drag.lastH = nextH
    mediaOverlayPanelSizeOverrideRef.current.set(id, { w: nextW * scale, h: nextH * scale })
    mediaOverlayPanelSizeTargetWorldRef.current.set(id, { w: nextW, h: nextH })
    writeRichMediaResizeTrace(['phase=move', `id=${id}`, `pid=${queued.pointerId}`, `nextW=${nextW}`, `nextH=${nextH}`])
    handleFrame()
  }, [flowEditorOverlayInteractionMode, handleFrame, writeRichMediaResizeTrace])

  const beginMediaOverlayPan = React.useCallback((payload: { pointerId: number; clientX: number; clientY: number; buttons: number; shiftKey: boolean }) => {
    if (!active || !flowEditorOverlayInteractionMode) return
    const runtime = runtimeRef.current
    if (!runtime) return
    disableAutoZoomModesForUserGesture(useGraphStore.getState())
    mediaOverlayPanRef.current = { pointerId: payload.pointerId, startTransform: runtime.transform || d3.zoomIdentity }
  }, [active, flowEditorOverlayInteractionMode, runtimeRef])

  const beginMediaOverlayHeaderDrag = React.useCallback((id: string, pointerId: number) => {
    if (!active || !flowEditorOverlayInteractionMode) return
    const runtime = runtimeRef.current
    const scene = runtime?.scene
    const node = scene?.nodeById.get(id)
    if (!runtime || !scene || !node) return
    disableAutoZoomModesForUserGesture(useGraphStore.getState())
    mediaOverlayHeaderDragRef.current = { id, pointerId, startX: node.x, startY: node.y, startK: runtime.transform?.k || 1, lastDx: 0, lastDy: 0 }
  }, [active, flowEditorOverlayInteractionMode, runtimeRef])

  const beginMediaOverlayResize = React.useCallback((id: string, pointerId: number) => {
    if (!active || !flowEditorOverlayInteractionMode || !isFlowEditorFrontmatterDocumentInteractionMode()) {
      writeRichMediaResizeTrace(['phase=skip', `id=${id}`, `pid=${pointerId}`])
      return
    }
    const runtime = runtimeRef.current
    const scene = runtime?.scene
    if (!runtime || !scene) return
    disableAutoZoomModesForUserGesture(useGraphStore.getState())
    const zoomK = typeof runtime.transform?.k === 'number' && runtime.transform.k > 0 ? runtime.transform.k : 1
    const scale = computeWidgetScale(zoomK, null, { mode: 'pinnedInCanvas' })
    const el = mediaOverlayElsRef.current.get(id) || null
    const rect = el?.getBoundingClientRect()
    const measuredW = rect && Number.isFinite(rect.width) ? rect.width : 0
    const measuredH = rect && Number.isFinite(rect.height) ? rect.height : 0
    const headerPx = (() => {
      const headerEl = el?.querySelector('[data-kg-media-panel-header="1"]') as HTMLElement | null
      const headerRect = headerEl?.getBoundingClientRect()
      return headerRect && Number.isFinite(headerRect.height) ? headerRect.height : 0
    })()
    const headerWorldH = Math.max(0, headerPx / Math.max(0.001, scale))
    const store = useGraphStore.getState() as { graphData?: { nodes?: Array<{ id?: unknown; properties?: unknown }> } }
    const node = store.graphData?.nodes?.find(entry => String(entry?.id || '') === id) || null
    const baseProps =
      node?.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)
        ? (node.properties as Record<string, unknown>)
        : {}
    const storedW = Number(baseProps['visual:width'])
    const storedH = Number(baseProps['visual:height'])
    const startW = Number.isFinite(storedW) && storedW > 0 ? Math.max(24, Math.round(storedW)) : Math.max(24, Math.round(measuredW / Math.max(0.001, scale)))
    const startHRaw = Number.isFinite(storedH) && storedH > 0 ? Math.max(24, Math.round(storedH)) : Math.max(24, Math.round(measuredH / Math.max(0.001, scale)))
    const bodyAspect = Math.max(0.001, Math.max(24, startHRaw - headerWorldH) / Math.max(1, startW))
    const stableH = Math.max(24 + headerWorldH, Math.round(startW * bodyAspect + headerWorldH))
    mediaOverlayResizeRef.current = { id, pointerId, startW, startH: stableH, startScale: scale, headerH: headerWorldH, bodyAspect, lastW: startW, lastH: stableH }
    mediaOverlayPanelSizeOverrideRef.current.set(id, { w: startW * scale, h: stableH * scale })
    mediaOverlayPanelSizeTargetWorldRef.current.set(id, { w: startW, h: stableH })
    writeRichMediaResizeTrace(['phase=start', `id=${id}`, `pid=${pointerId}`, `startW=${startW}`, `startH=${stableH}`])
    handleFrame()
  }, [active, flowEditorOverlayInteractionMode, handleFrame, isFlowEditorFrontmatterDocumentInteractionMode, runtimeRef, writeRichMediaResizeTrace])

  React.useEffect(() => {
    if (canvas2dRenderer === 'flowEditor') return
    mediaOverlayPanMoveSchedulerRef.current?.cancel()
    mediaOverlayPanRef.current = null
    mediaOverlayHeaderMoveSchedulerRef.current?.cancel()
    mediaOverlayHeaderDragRef.current = null
    mediaOverlayResizeMoveSchedulerRef.current?.cancel()
    mediaOverlayResizeRef.current = null
    mediaOverlayPanelSizeOverrideRef.current.clear()
    mediaOverlayPanelSizeTargetWorldRef.current.clear()
  }, [canvas2dRenderer])

  React.useEffect(() => {
    if (flowEditorOverlayInteractionMode !== true) {
      mediaOverlayPanelSizeOverrideRef.current.clear()
      mediaOverlayPanelSizeTargetWorldRef.current.clear()
      return
    }
    const targets = mediaOverlayPanelSizeTargetWorldRef.current
    if (targets.size === 0) return
    const nodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData.nodes as Array<{ id?: unknown; properties?: unknown }>) : []
    const byId = new Map<string, Record<string, unknown>>()
    for (let i = 0; i < nodes.length; i += 1) {
      const id = String(nodes[i]?.id || '').trim()
      const props = nodes[i]?.properties
      if (id && props && typeof props === 'object' && !Array.isArray(props)) byId.set(id, props as Record<string, unknown>)
    }
    let changed = false
    for (const [id, target] of targets.entries()) {
      const props = byId.get(id)
      const width = Number(props?.['visual:width'])
      const height = Number(props?.['visual:height'])
      if (!Number.isFinite(width) || !Number.isFinite(height)) continue
      if (Math.abs(width - target.w) <= 0.5 && Math.abs(height - target.h) <= 0.5) {
        targets.delete(id)
        mediaOverlayPanelSizeOverrideRef.current.delete(id)
        changed = true
      }
    }
    if (changed) mediaOverlayLayoutScheduleRef.current?.()
  }, [flowEditorOverlayInteractionMode, sceneGraphData])

  React.useEffect(() => {
    if (!active || mediaLayoutItems.length === 0) return
    const density = normalizeRichMediaPanelDensity(mediaPanelDensity)
    const widthRatioRaw = density === 'compact' ? threeIframeOverlayBaseWidthRatioCompact : threeIframeOverlayBaseWidthRatioDefault
    const widthMinRaw = density === 'compact' ? threeIframeOverlayBaseWidthMinPxCompact : threeIframeOverlayBaseWidthMinPxDefault
    const widthMaxRaw = density === 'compact' ? threeIframeOverlayBaseWidthMaxPxCompact : threeIframeOverlayBaseWidthMaxPxDefault
    const loop = startMediaOverlayLayoutLoop2d({
      enabled: true,
      loop: 'onDemand',
      items: mediaLayoutItems,
      manualPlacement: flowEditorFrontmatterInteractionMode,
      density,
      viewportW,
      viewportH,
      readTransform: () => runtimeRef.current?.transform || d3.zoomIdentity,
      computeSizingZoomK: zoomK => computeOverlaySizingScale(zoomK, mediaLayoutItems.length, 360, 240),
      getPanelSizeForId: id => {
        if (!flowEditorFrontmatterInteractionMode) return null
        const override = mediaOverlayPanelSizeOverrideRef.current.get(id)
        if (override) return override
        const props = sceneNodePropsByIdRef.current.get(id) || null
        if (!props) return null
        const width = Number(props['visual:width'])
        const height = Number(props['visual:height'])
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
        const zoomK = typeof runtimeRef.current?.transform?.k === 'number' && runtimeRef.current.transform.k > 0 ? runtimeRef.current.transform.k : 1
        const scale = computeOverlaySizingScale(zoomK, mediaLayoutItems.length, Math.max(24, width), Math.max(24, height))
        return { w: Math.max(24, width) * scale, h: Math.max(24, height) * scale }
      },
      getElementForId: id => mediaOverlayElsRef.current.get(id) || null,
      getNodeWorldCenterForId: id => readNodeCenterWorld2d(runtimeRef.current?.scene?.nodeById.get(id), { coords: 'topLeft' }),
      sizingConfig: {
        widthRatio: Number.isFinite(widthRatioRaw) ? Math.max(0.001, Number(widthRatioRaw)) : 0.2,
        widthMinPx: Number.isFinite(widthMinRaw) ? Math.max(1, Math.floor(widthMinRaw)) : 210,
        widthMaxPx: Number.isFinite(widthMaxRaw) ? Math.max(1, Math.floor(widthMaxRaw)) : 360,
        quantizeStepPx: flowEditorFrontmatterInteractionMode ? 1 : 16,
      },
    })
    mediaOverlayLayoutScheduleRef.current = loop.schedule
    loop.schedule()
    return () => {
      loop.stop()
      if (mediaOverlayLayoutScheduleRef.current === loop.schedule) mediaOverlayLayoutScheduleRef.current = null
    }
  }, [
    active,
    mediaLayoutItems,
    mediaLayoutItemIdsKey,
    mediaPanelDensity,
    computeOverlaySizingScale,
    runtimeRef,
    threeIframeOverlayBaseWidthMaxPxCompact,
    threeIframeOverlayBaseWidthMaxPxDefault,
    threeIframeOverlayBaseWidthMinPxCompact,
    threeIframeOverlayBaseWidthMinPxDefault,
    threeIframeOverlayBaseWidthRatioCompact,
    threeIframeOverlayBaseWidthRatioDefault,
    viewportH,
    viewportW,
  ])

  React.useEffect(() => {
    const panelSizeOverrideRef = mediaOverlayPanelSizeOverrideRef
    const panelSizeTargetRef = mediaOverlayPanelSizeTargetWorldRef
    return () => {
      mediaOverlayPanMoveSchedulerRef.current?.cancel()
      mediaOverlayHeaderMoveSchedulerRef.current?.cancel()
      mediaOverlayResizeMoveSchedulerRef.current?.cancel()
      panelSizeOverrideRef.current.clear()
      panelSizeTargetRef.current.clear()
    }
  }, [])

  if (!(active && mediaNodes.length > 0)) return null
  return (
    <section aria-label="Flow media overlay" className="absolute inset-0 z-[80] pointer-events-none">
      {mediaNodes.map(node => {
        const isSelected = selectedOverlayNodeIdSet.has(node.id) || Array.from(selectedOverlayNodeIdSet).some(id => isCanonicalNodeIdEqual(id, node.id))
        const resizeInteractionActive = flowEditorOverlayInteractionMode && isSelected
        const updateNode = (id: string, patch: { properties: Record<string, unknown> }) => {
          useGraphStore.getState().updateNode(id, patch as Partial<GraphNode>)
        }
        return (
          <RichMediaPanel
            key={node.id}
            overlayId={node.id}
            ref={el => {
              if (!el) {
                mediaOverlayElsRef.current.delete(node.id)
                return
              }
              mediaOverlayElsRef.current.set(node.id, el)
            }}
            className="absolute left-0 top-0 pointer-events-auto"
            title={node.title}
            url={node.url}
            srcDoc={node.srcDoc}
            openUrl={node.openUrl}
            kind={node.kind}
            interactive={resolveRichMediaPanelInteractive({
              nodeInteractive: node.interactive,
              renderMediaAsNodes,
              infiniteCanvasInteractionMode,
            })}
            iframeMode="srcdoc-when-needed"
            panel={node.panel}
            onPanelChange={next => {
              if (!node.panel) return
              commitRichMediaPanelChange({ nodeId: node.id, next, updateNode })
            }}
            forwardWheelTo={() => canvasRef.current}
            onOverlayPanStart={flowEditorOverlayInteractionMode ? payload => beginMediaOverlayPan(payload) : undefined}
            onOverlayPan={flowEditorOverlayInteractionMode ? payload => {
              mediaOverlayPanMoveLatestRef.current = payload
              if (!mediaOverlayPanMoveSchedulerRef.current) {
                mediaOverlayPanMoveSchedulerRef.current = createRafLatestScheduler(applyMediaOverlayPanMove)
              }
              mediaOverlayPanMoveSchedulerRef.current.schedule(payload)
            } : undefined}
            onOverlayPanEnd={flowEditorOverlayInteractionMode ? payload => {
              const drag = mediaOverlayPanRef.current
              if (!drag || drag.pointerId !== payload.pointerId) return
              mediaOverlayPanMoveSchedulerRef.current?.cancel()
              if (mediaOverlayPanMoveLatestRef.current?.pointerId === payload.pointerId) {
                applyMediaOverlayPanMove(mediaOverlayPanMoveLatestRef.current)
              }
              mediaOverlayPanMoveLatestRef.current = null
              mediaOverlayPanRef.current = null
              requestCommit()
            } : undefined}
            onHeaderDragStart={flowEditorOverlayInteractionMode ? ({ pointerId }) => beginMediaOverlayHeaderDrag(node.id, pointerId) : undefined}
            onHeaderDrag={flowEditorOverlayInteractionMode ? ({ dx, dy, pointerId }) => {
              const queued = { id: node.id, pointerId, dx, dy }
              mediaOverlayHeaderMoveLatestRef.current = queued
              if (!mediaOverlayHeaderMoveSchedulerRef.current) {
                mediaOverlayHeaderMoveSchedulerRef.current = createRafLatestScheduler(entry => applyMediaOverlayHeaderDragMove(entry.id, entry))
              }
              mediaOverlayHeaderMoveSchedulerRef.current.schedule(queued)
            } : undefined}
            onHeaderDragEnd={flowEditorOverlayInteractionMode ? ({ pointerId }) => {
              const drag = mediaOverlayHeaderDragRef.current
              if (!drag || drag.id !== node.id || drag.pointerId !== pointerId) return
              mediaOverlayHeaderMoveSchedulerRef.current?.cancel()
              if (mediaOverlayHeaderMoveLatestRef.current?.id === node.id && mediaOverlayHeaderMoveLatestRef.current.pointerId === pointerId) {
                applyMediaOverlayHeaderDragMove(node.id, mediaOverlayHeaderMoveLatestRef.current)
              }
              mediaOverlayHeaderMoveLatestRef.current = null
              mediaOverlayHeaderDragRef.current = null
              requestCommit()
            } : undefined}
            resizable={flowEditorOverlayInteractionMode && isSelected}
            onResizeStart={resizeInteractionActive ? ({ pointerId }) => beginMediaOverlayResize(node.id, pointerId) : undefined}
            onResize={resizeInteractionActive ? ({ dx, dy, pointerId }) => {
              const queued = { id: node.id, pointerId, dx, dy }
              mediaOverlayResizeMoveLatestRef.current = queued
              if (!mediaOverlayResizeMoveSchedulerRef.current) {
                mediaOverlayResizeMoveSchedulerRef.current = createRafLatestScheduler(entry => applyMediaOverlayResizeMove(entry.id, entry))
              }
              mediaOverlayResizeMoveSchedulerRef.current.schedule(queued)
            } : undefined}
            onResizeEnd={resizeInteractionActive ? ({ pointerId }) => {
              const drag = mediaOverlayResizeRef.current
              if (!drag || drag.id !== node.id || drag.pointerId !== pointerId) return
              mediaOverlayResizeMoveSchedulerRef.current?.cancel()
              if (mediaOverlayResizeMoveLatestRef.current?.id === node.id && mediaOverlayResizeMoveLatestRef.current.pointerId === pointerId) {
                applyMediaOverlayResizeMove(node.id, mediaOverlayResizeMoveLatestRef.current)
              }
              mediaOverlayResizeMoveLatestRef.current = null
              mediaOverlayResizeRef.current = null
              try {
                const store = useGraphStore.getState() as { graphData?: { nodes?: Array<{ id?: unknown; properties?: unknown }> }; updateNode?: (id: string, updates: { properties: Record<string, unknown> }) => void }
                const currentNode = store.graphData?.nodes?.find(entry => String(entry?.id || '') === node.id) || null
                const baseProps =
                  currentNode?.properties && typeof currentNode.properties === 'object' && !Array.isArray(currentNode.properties)
                    ? (currentNode.properties as Record<string, unknown>)
                    : {}
                store.updateNode?.(node.id, { properties: { ...baseProps, 'visual:width': drag.lastW, 'visual:height': drag.lastH } })
              } catch {
                void 0
              }
              writeRichMediaResizeTrace(['phase=end', `id=${node.id}`, `pid=${pointerId}`, `finalW=${drag.lastW}`, `finalH=${drag.lastH}`])
              mediaOverlayLayoutScheduleRef.current?.()
              requestCommit()
            } : undefined}
            flowEditorInteractionMode={flowEditorOverlayInteractionMode}
            flowEditorFrontmatterDocumentMode={flowEditorFrontmatterInteractionMode}
            style={{ transform: 'translate(-99999px, -99999px)', width: 1, height: 1 }}
            onWheelCapture={stopEvent}
            onClickCapture={stopEvent}
            onDoubleClickCapture={stopEvent}
            onContextMenuCapture={stopEvent}
          />
        )
      })}
    </section>
  )
}
