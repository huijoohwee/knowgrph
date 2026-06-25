import React from 'react'
import * as d3 from 'd3'
import { UI_RESPONSIVE_PASSIVE_FILL_SURFACE_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import RichMediaPanel from '@/components/RichMediaPanel'
import { resolveFlowCanvasMediaOverlayInteractionPolicy } from '@/components/FlowCanvas/shared'
import { __flowCanvasDebug, syncFlowCanvasDebugWindow } from '@/components/FlowCanvas/flowCanvasDebug'
import type { FlowNativeDrawArgs, FlowNativeRuntime } from '@/components/FlowCanvas/nativeRuntime'
import { requestFlowNativeDraw, setFlowNativeTransform } from '@/components/FlowCanvas/nativeRuntime'
import { computeWidgetScale, computeCollectiveFollowPinnedScale, computeCollectiveFollowZoomK } from '@/lib/canvas/overlayWidgetZoom'
import { useGraphStore } from '@/hooks/useGraphStore'
import { disableAutoZoomModesForUserGesture } from '@/lib/canvas/auto-zoom-modes'
import { computeOverlayDraggedPoint2d, computeOverlayPanTransform2d } from '@/lib/canvas/overlayInteractions2d'
import type { GraphSchema } from '@/lib/graph/schema'
import { isFlowEditorFrontmatterDocumentModeRequested } from '@/lib/graph/frontmatterMode'
import { COLLECTIVE_OVERLAY_SCALE_LIMITS_16X9 } from '@/lib/ui/overlayScaleLimits'
import { createRafLatestScheduler, type RafLatestScheduler } from '@/lib/react/rafLatestScheduler'
import { canonicalNodeIdSetHas } from '@/lib/graph/canonicalNodeIds'
import { readGraphDataRevision } from '@/lib/graph/documentMetadata'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { Z_INDEX_GRAPH_MEDIA_LAYER, Z_INDEX_GRAPH_OVERLAY_SELECTED } from '@/lib/ui/zIndex'
import {
  commitRichMediaPanelChange,
  normalizeRichMediaPanelDensity,
  resolveRichMediaPanelInteractive,
} from '@/lib/render/richMediaSsot'
import {
  collectCanonicalFlowEditorOverlayRectEntries,
  FLOW_EDITOR_OVERLAY_ROOT_SELECTOR,
  FLOW_EDITOR_OVERLAY_SURFACE_ROOT_ATTR,
  readFlowEditorOverlaySurfaceId,
} from '@/lib/canvas/flow-editor-overlay-proxy'
import { readNodeCenterWorld2d } from '@/lib/render/mediaAnchor'
import type { MediaOverlayNode } from '@/lib/render/mediaOverlayPool'
import { startMediaOverlayLayoutLoop2d } from '@/lib/render/mediaOverlayLayoutLoop2d'
import {
  computePanelFrameResizeFromDrag16x9,
  computePanelFrameSizeFromWidth16x9,
  readRichMediaPanelFrameMetrics,
  readStableRichMediaPanelSize,
  type MediaPanelCssMetrics,
} from '@/lib/render/mediaPanelLayout'
import { readOverlaySizingConfigForDensity, type OverlayDensitySizingConfigInput } from '@/lib/render/overlaySizing2d'
import { RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE } from '@/lib/render/richMediaPanelDefaults'
import { isWorkspaceEditorOverlayOpen, isWorkspaceGraphMutationBlocked } from '@/features/workspace-table/workspaceTableSsot'
import { hashSignatureParts } from '@/lib/hash/signature'
import { computeBalancedSpreadViewportMargins } from '@/lib/ui/overlayBalancedSpread'
import { clampMediaLayoutViewportToFrame16x9, coerceRichMediaPanelSizeForLayoutViewport, resolveFlowCanvasMediaLayoutViewport } from '@/components/FlowCanvas/flowCanvasMediaLayoutViewport'

function escapeSelectorAttrValue(value: string): string {
  const text = String(value || '')
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(text)
  return text.replace(/["\\]/g, '\\$&')
}

function readMediaLayoutMeasureKey(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? String(Math.round(n)) : ''
}

function readMediaLayoutNodePropsSignature(
  ids: string[],
  sceneGraphData: GraphData | null,
): string {
  if (ids.length === 0) return ''
  const wanted = new Set(ids)
  const nodes = Array.isArray(sceneGraphData?.nodes) ? sceneGraphData.nodes : []
  const parts: string[] = []
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const id = String(node?.id || '').trim()
    if (!id || !wanted.has(id)) continue
    const props =
      node?.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)
        ? (node.properties as Record<string, unknown>)
        : {}
    parts.push([
      id,
      readMediaLayoutMeasureKey(props['visual:width']),
      readMediaLayoutMeasureKey(props['visual:height']),
      String(props.outputLoadingKind || '').trim(),
      typeof props.output === 'string' && props.output.trim() ? 'text' : '',
      typeof props.imageUrl === 'string' && props.imageUrl.trim() ? 'image' : '',
      typeof props.videoUrl === 'string' && props.videoUrl.trim() ? 'video' : '',
      typeof props.audioUrl === 'string' && props.audioUrl.trim() ? 'audio' : '',
      typeof props.outputPath === 'string' && props.outputPath.trim() ? String(props.outputPath).trim() : '',
      String(props.richMediaActiveTab || '').trim(),
    ].join(':'))
  }
  parts.sort((a, b) => a.localeCompare(b))
  return hashSignatureParts(['flow-canvas-media-layout-props', ids.length, ...parts])
}

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
  overlaySizing?: OverlayDensitySizingConfigInput | null
  flowEditorSurfaceId?: string
  onPlannedOverlayNodeIdsChange: (ids: string[]) => void
  registerInteractionFrameLayoutScheduler?: (scheduler: null | (() => void)) => void
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
    overlaySizing,
    flowEditorSurfaceId,
    onPlannedOverlayNodeIdsChange,
    registerInteractionFrameLayoutScheduler,
  } = args

  const flowEditorFrontmatterDocumentModeRequested = React.useMemo(() => {
    return isFlowEditorFrontmatterDocumentModeRequested({
      canvas2dRenderer,
      frontmatterModeEnabled,
      documentSemanticMode,
    })
  }, [canvas2dRenderer, documentSemanticMode, frontmatterModeEnabled])
  const richMediaInfiniteCanvasMode = canvas2dRenderer === 'flowEditor' || canvas2dRenderer === 'flowCanvas'
  const mediaOverlayDragInteractionMode = canvas2dRenderer === 'flowEditor' || canvas2dRenderer === 'flowCanvas'
  const graphSchema = schema as GraphSchema
  const mediaOverlayElsRef = React.useRef<Map<string, HTMLElement>>(new Map())
  const mediaOverlayPanelSizeOverrideRef = React.useRef<Map<string, { w: number; h: number }>>(new Map())
  const mediaOverlayPanelSizeTargetWorldRef = React.useRef<Map<string, { w: number; h: number }>>(new Map())
  const mediaOverlayPanelLastKnownWorldSizeRef = React.useRef<Map<string, { w: number; h: number }>>(new Map())
  const mediaOverlayLayoutScheduleRef = React.useRef<null | (() => void)>(null)
  const mediaOverlayHeaderDragRef = React.useRef<null | { id: string; pointerId: number; startX: number; startY: number; startK: number; lastDx: number; lastDy: number }>(null)
  const mediaOverlayPanRef = React.useRef<null | { pointerId: number; startTransform: d3.ZoomTransform }>(null)
  const mediaOverlayResizeRef = React.useRef<null | {
    id: string
    pointerId: number
    startW: number
    startH: number
    bodyAspect: number
    startScale: number
    frameMetrics: Pick<MediaPanelCssMetrics, 'headerH' | 'padding' | 'borderW'>
    lastW: number
    lastH: number
  }>(null)
  const mediaOverlayPanMoveLatestRef = React.useRef<{ pointerId: number; clientX: number; clientY: number; dx: number; dy: number; buttons: number; shiftKey: boolean } | null>(null)
  const mediaOverlayHeaderMoveLatestRef = React.useRef<{ id: string; pointerId: number; dx: number; dy: number } | null>(null)
  const mediaOverlayResizeMoveLatestRef = React.useRef<{ id: string; pointerId: number; dx: number; dy: number } | null>(null)
  const mediaOverlayPanMoveSchedulerRef = React.useRef<RafLatestScheduler<{ pointerId: number; clientX: number; clientY: number; dx: number; dy: number; buttons: number; shiftKey: boolean }> | null>(null)
  const mediaOverlayHeaderMoveSchedulerRef = React.useRef<RafLatestScheduler<{ id: string; pointerId: number; dx: number; dy: number }> | null>(null)
  const mediaOverlayResizeMoveSchedulerRef = React.useRef<RafLatestScheduler<{ id: string; pointerId: number; dx: number; dy: number }> | null>(null)
  const flowEditorZoomBaselineKRef = React.useRef<number | null>(null)
  const lastPlannedOverlayNodeIdsKeyRef = React.useRef<string>('')
  const workspaceOverlayOpenRef = React.useRef(false)
  const workspaceMutationBlockedRef = React.useRef(false)
  const [workspaceOverlayOpenKey, setWorkspaceOverlayOpenKey] = React.useState(0)
  const [, setWorkspaceMutationBlockedKey] = React.useState(0)
  const sceneNodePropsByIdRef = React.useRef<Map<string, Record<string, unknown>>>(new Map())

  const cancelMediaOverlayInteractionState = React.useCallback(() => {
    mediaOverlayPanMoveSchedulerRef.current?.cancel()
    mediaOverlayHeaderMoveSchedulerRef.current?.cancel()
    mediaOverlayResizeMoveSchedulerRef.current?.cancel()
    mediaOverlayPanMoveLatestRef.current = null
    mediaOverlayHeaderMoveLatestRef.current = null
    mediaOverlayResizeMoveLatestRef.current = null
    mediaOverlayPanRef.current = null
    mediaOverlayHeaderDragRef.current = null
    mediaOverlayResizeRef.current = null
    mediaOverlayPanelSizeOverrideRef.current.clear()
    mediaOverlayPanelSizeTargetWorldRef.current.clear()
  }, [])
  const resetMediaOverlayInteractionState = React.useCallback((options?: { clearLastKnownWorldSize?: boolean }) => {
    cancelMediaOverlayInteractionState()
    if (options?.clearLastKnownWorldSize === true) mediaOverlayPanelLastKnownWorldSizeRef.current.clear()
  }, [cancelMediaOverlayInteractionState])

  React.useEffect(() => {
    const readWorkspaceOverlayOpen = () => isWorkspaceEditorOverlayOpen(useGraphStore.getState())
    const readWorkspaceMutationBlocked = () => isWorkspaceGraphMutationBlocked(useGraphStore.getState())
    const initialOpen = readWorkspaceOverlayOpen()
    const initialBlocked = readWorkspaceMutationBlocked()
    if (workspaceOverlayOpenRef.current !== initialOpen) setWorkspaceOverlayOpenKey(key => key + 1)
    if (workspaceMutationBlockedRef.current !== initialBlocked) setWorkspaceMutationBlockedKey(key => key + 1)
    workspaceOverlayOpenRef.current = initialOpen
    workspaceMutationBlockedRef.current = initialBlocked
    if (workspaceMutationBlockedRef.current) cancelMediaOverlayInteractionState()
    const unsub = useGraphStore.subscribe(
      s => [
        s.workspaceViewMode,
        s.workspaceCanvasPaneOpen,
        s.markdownWorkspaceIndexingInFlight,
        s.workspaceGraphMutationBlockUntilMs,
        s.workspaceGraphMutationBlockKey,
      ] as const,
      () => {
        const nextBlocked = readWorkspaceMutationBlocked()
        const nextOpen = readWorkspaceOverlayOpen()
        const overlayChanged = workspaceOverlayOpenRef.current !== nextOpen
        const blockedChanged = workspaceMutationBlockedRef.current !== nextBlocked
        workspaceOverlayOpenRef.current = nextOpen
        workspaceMutationBlockedRef.current = nextBlocked
        if (workspaceMutationBlockedRef.current) cancelMediaOverlayInteractionState()
        if (overlayChanged) setWorkspaceOverlayOpenKey(key => key + 1)
        if (blockedChanged) setWorkspaceMutationBlockedKey(key => key + 1)
      },
    )
    return () => unsub()
  }, [cancelMediaOverlayInteractionState])

  React.useEffect(() => {
    const next = new Map<string, Record<string, unknown>>()
    const lastKnownSizes = mediaOverlayPanelLastKnownWorldSizeRef.current
    const nodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData.nodes as Array<{ id?: unknown; properties?: unknown }>) : []
    for (let i = 0; i < nodes.length; i += 1) {
      const id = String(nodes[i]?.id || '').trim()
      const props = nodes[i]?.properties
      if (!id || !props || typeof props !== 'object' || Array.isArray(props)) continue
      const record = props as Record<string, unknown>
      next.set(id, record)
      const stableSize = readStableRichMediaPanelSize(record)
      if (stableSize) lastKnownSizes.set(id, stableSize)
    }
    for (const id of Array.from(lastKnownSizes.keys())) {
      if (!next.has(id)) lastKnownSizes.delete(id)
    }
    sceneNodePropsByIdRef.current = next
  }, [sceneGraphData])

  React.useEffect(() => {
    __flowCanvasDebug.sceneNodeIds = Array.isArray(sceneGraphData?.nodes)
      ? sceneGraphData.nodes.map(node => String(node?.id || '').trim()).filter(Boolean)
      : []
    syncFlowCanvasDebugWindow()
  }, [sceneGraphData])
  React.useEffect(() => {
    __flowCanvasDebug.mediaNodeIds = mediaNodes.map(node => String(node.id || '').trim()).filter(Boolean)
    __flowCanvasDebug.overlayNodeIds = mediaNodes.map(node => String(node.id || '').trim()).filter(Boolean)
    syncFlowCanvasDebugWindow()
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
    () => {
      const ids = mediaNodes.map(node => String(node.id || '').trim()).filter(Boolean)
      return ids.length <= 1 ? ids : Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b))
    },
    [mediaNodes],
  )
  const mediaLayoutItemIdsKey = React.useMemo(() => mediaLayoutItemIds.join('|'), [mediaLayoutItemIds])
  const flowEditorSurfaceInteractionMode =
    flowEditorOverlayInteractionMode
    || flowEditorFrontmatterInteractionMode
    || flowEditorFrontmatterDocumentModeRequested
  const flowEditorOverlaySurfaceId = flowEditorSurfaceInteractionMode ? flowEditorSurfaceId : ''
  const queryActiveFlowEditorOverlays = React.useCallback((): HTMLElement[] => {
    if (!flowEditorSurfaceInteractionMode || typeof document === 'undefined') return []
    const surfaceId = String(flowEditorOverlaySurfaceId || '').trim()
    if (!surfaceId) return []
    const surfaceRoot = surfaceId
      ? document.querySelector<HTMLElement>(`[${FLOW_EDITOR_OVERLAY_SURFACE_ROOT_ATTR}="${escapeSelectorAttrValue(surfaceId)}"]`)
      : null
    const queryRoot: ParentNode = surfaceRoot || document
    return Array.from(queryRoot.querySelectorAll<HTMLElement>(FLOW_EDITOR_OVERLAY_ROOT_SELECTOR))
      .filter(el => readFlowEditorOverlaySurfaceId(el) === surfaceId)
  }, [flowEditorSurfaceInteractionMode, flowEditorOverlaySurfaceId])
  const mediaLayoutItems = React.useMemo(
    () => mediaLayoutItemIdsKey ? mediaLayoutItemIdsKey.split('|').filter(Boolean).map(id => ({ id })) : [],
    [mediaLayoutItemIdsKey],
  )
  const mediaLayoutItemsKey = React.useMemo(() => mediaLayoutItems.map(item => item.id).join('|'), [mediaLayoutItems])
  const mediaViewportMargins = React.useMemo(
    () => computeBalancedSpreadViewportMargins({ viewportW, viewportH, preset: 'richMedia', minLeftPx: 16, minRightPx: 16, minTopPx: 16, minBottomPx: 16 }),
    [viewportH, viewportW],
  )
  const mediaViewportMargin = React.useMemo(() => Math.max(
    mediaViewportMargins.left,
    mediaViewportMargins.right,
    mediaViewportMargins.top,
    mediaViewportMargins.bottom,
  ), [
    mediaViewportMargins.bottom,
    mediaViewportMargins.left,
    mediaViewportMargins.right,
    mediaViewportMargins.top,
  ])
  const readMediaLayoutViewport = React.useCallback(() => resolveFlowCanvasMediaLayoutViewport({
    canvas2dRenderer,
    flowEditorSurfaceId: flowEditorOverlaySurfaceId,
    viewportW,
    viewportH,
  }), [canvas2dRenderer, flowEditorOverlaySurfaceId, viewportH, viewportW])
  const mediaLayoutPropsSignature = React.useMemo(
    () => readMediaLayoutNodePropsSignature(mediaLayoutItemIds, sceneGraphData),
    [mediaLayoutItemIds, sceneGraphData],
  )
  const sceneGraphDataRevision = React.useMemo(() => readGraphDataRevision(sceneGraphData), [sceneGraphData])

  React.useEffect(() => {
    const next: Record<string, { left: number; top: number; width: number; height: number }> = {}
    for (let i = 0; i < mediaNodes.length; i += 1) {
      const node = mediaNodes[i]
      const id = String(node?.id || '').trim()
      if (!id) continue
      const el = mediaOverlayElsRef.current.get(id)
      if (!el) continue
      const transformMatch = /translate3d\(([-0-9.]+)px,\s*([-0-9.]+)px,\s*0px\)/.exec(String(el.style.transform || ''))
      const left = transformMatch ? Number.parseFloat(transformMatch[1] || 'NaN') : Number.NaN
      const top = transformMatch ? Number.parseFloat(transformMatch[2] || 'NaN') : Number.NaN
      const width = Number.parseFloat(el.style.width || 'NaN')
      const height = Number.parseFloat(el.style.height || 'NaN')
      if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(width) || !Number.isFinite(height)) continue
      next[id] = { left, top, width, height }
    }
    __flowCanvasDebug.richMediaRectById = next
    syncFlowCanvasDebugWindow()
  }, [mediaNodes, mediaLayoutItemsKey, mediaLayoutPropsSignature, workspaceOverlayOpenKey])

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
  React.useEffect(() => {
    if (canvas2dRenderer !== 'flowEditor') {
      registerInteractionFrameLayoutScheduler?.(null)
      return () => registerInteractionFrameLayoutScheduler?.(null)
    }
    const scheduleLayout = () => {
      mediaOverlayLayoutScheduleRef.current?.()
    }
    registerInteractionFrameLayoutScheduler?.(scheduleLayout)
    return () => registerInteractionFrameLayoutScheduler?.(null)
  }, [canvas2dRenderer, registerInteractionFrameLayoutScheduler])
  const stopEvent = React.useCallback((event: React.SyntheticEvent) => {
    try {
      event.stopPropagation()
    } catch {
      void 0
    }
  }, [])
  React.useEffect(() => {
    flowEditorZoomBaselineKRef.current = null
  }, [canvas2dRenderer, flowEditorSurfaceId, mediaLayoutItemIdsKey])
  const computeOverlaySizingScale = React.useCallback((zoomK: number, itemCount: number, panelW: number, panelH: number) => {
    const layoutViewport = clampMediaLayoutViewportToFrame16x9(readMediaLayoutViewport())
    const sizingZoomK = (() => {
      if (canvas2dRenderer !== 'flowEditor') return zoomK
      const safeZoomK = Number.isFinite(zoomK) && zoomK > 0 ? zoomK : 1
      if (
        flowEditorZoomBaselineKRef.current == null
        || !Number.isFinite(flowEditorZoomBaselineKRef.current)
        || flowEditorZoomBaselineKRef.current <= 0
      ) {
        flowEditorZoomBaselineKRef.current = safeZoomK
      }
      return computeCollectiveFollowZoomK({
        zoomK: safeZoomK,
        baselineZoomK: flowEditorZoomBaselineKRef.current,
      })
    })()
    return computeCollectiveFollowPinnedScale({
      zoomK: sizingZoomK,
      viewportW: layoutViewport.width,
      viewportH: layoutViewport.height,
      count: itemCount,
      baseWidth: panelW,
      baseHeight: panelH,
      quantizeStep: 0.02,
      hardMinScale: COLLECTIVE_OVERLAY_SCALE_LIMITS_16X9.richMedia.min,
      hardMaxScale: COLLECTIVE_OVERLAY_SCALE_LIMITS_16X9.richMedia.max,
      fitToViewport: canvas2dRenderer === 'flowEditor' ? false : undefined,
    })
  }, [canvas2dRenderer, readMediaLayoutViewport])

  const writeRichMediaResizeTrace = React.useCallback((parts: Array<string | number>) => {
    try {
      __flowCanvasDebug.lastRichMediaResizeTrace = parts.map(v => String(v)).join('|')
    } catch {
      void 0
    }
  }, [])

  const applyMediaOverlayPanMove = React.useCallback((queued: { pointerId: number; clientX: number; clientY: number; dx: number; dy: number; buttons: number; shiftKey: boolean }) => {
    if (!mediaOverlayDragInteractionMode) return
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
  }, [buildDrawArgs, mediaOverlayDragInteractionMode, onInteractionFrame, runtimeRef])

  const applyMediaOverlayHeaderDragMove = React.useCallback((id: string, queued: { pointerId: number; dx: number; dy: number }) => {
    if (!mediaOverlayDragInteractionMode) return
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
  }, [buildDrawArgs, graphSchema, handleFrame, mediaOverlayDragInteractionMode, positionsDirtySinceCommitRef, runtimeRef])

  const applyMediaOverlayResizeMove = React.useCallback((id: string, queued: { pointerId: number; dx: number; dy: number }) => {
    if (!mediaOverlayDragInteractionMode || workspaceMutationBlockedRef.current) return
    const drag = mediaOverlayResizeRef.current
    if (!drag || drag.id !== id || drag.pointerId !== queued.pointerId) return
    const scale = Math.max(0.001, drag.startScale)
    const nextFrame = computePanelFrameResizeFromDrag16x9({
      startW: drag.startW,
      startH: drag.startH,
      dxClientPx: queued.dx,
      dyClientPx: queued.dy,
      scale,
      metrics: drag.frameMetrics,
      minPanelW: 24,
      minPanelH: 24,
    })
    const nextW = Math.max(24, Math.round(nextFrame.panelW))
    const nextH = Math.max(24, Math.round(nextW * drag.bodyAspect))
    drag.lastW = nextW
    drag.lastH = nextH
    mediaOverlayPanelSizeOverrideRef.current.set(id, { w: nextW * scale, h: nextH * scale })
    mediaOverlayPanelSizeTargetWorldRef.current.set(id, { w: nextW, h: nextH })
    writeRichMediaResizeTrace(['phase=move', `id=${id}`, `pid=${queued.pointerId}`, `nextW=${nextW}`, `nextH=${nextH}`])
    handleFrame()
  }, [handleFrame, mediaOverlayDragInteractionMode, writeRichMediaResizeTrace])

  const beginMediaOverlayPan = React.useCallback((payload: { pointerId: number; clientX: number; clientY: number; buttons: number; shiftKey: boolean }) => {
    if (!active || !mediaOverlayDragInteractionMode) return
    const runtime = runtimeRef.current
    if (!runtime) return
    disableAutoZoomModesForUserGesture(useGraphStore.getState())
    mediaOverlayPanRef.current = { pointerId: payload.pointerId, startTransform: runtime.transform || d3.zoomIdentity }
  }, [active, mediaOverlayDragInteractionMode, runtimeRef])

  const beginMediaOverlayHeaderDrag = React.useCallback((id: string, pointerId: number) => {
    if (!active || !mediaOverlayDragInteractionMode) return
    const runtime = runtimeRef.current
    const scene = runtime?.scene
    const node = scene?.nodeById.get(id)
    if (!runtime || !scene || !node) return
    disableAutoZoomModesForUserGesture(useGraphStore.getState())
    mediaOverlayHeaderDragRef.current = { id, pointerId, startX: node.x, startY: node.y, startK: runtime.transform?.k || 1, lastDx: 0, lastDy: 0 }
  }, [active, mediaOverlayDragInteractionMode, runtimeRef])

  const beginMediaOverlayResize = React.useCallback((id: string, pointerId: number) => {
    if (!active || !mediaOverlayDragInteractionMode || workspaceMutationBlockedRef.current) {
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
    const baseProps = sceneNodePropsByIdRef.current.get(id) || {}
    const storedW = Number(baseProps['visual:width'])
    const startW = Number.isFinite(storedW) && storedW > 0 ? Math.max(24, Math.round(storedW)) : Math.max(24, Math.round(measuredW / Math.max(0.001, scale)))
    const frameMetrics = readRichMediaPanelFrameMetrics(el)
    const stableFrame = computePanelFrameSizeFromWidth16x9({ panelW: startW, metrics: frameMetrics })
    const stableH = Math.max(24, Math.round(stableFrame.panelH))
    const bodyAspect = stableH > 0 && startW > 0 ? stableH / startW : 9 / 16
    mediaOverlayResizeRef.current = { id, pointerId, startW, startH: stableH, bodyAspect, startScale: scale, frameMetrics, lastW: startW, lastH: stableH }
    mediaOverlayPanelSizeOverrideRef.current.set(id, { w: startW * scale, h: stableH * scale })
    mediaOverlayPanelSizeTargetWorldRef.current.set(id, { w: startW, h: stableH })
    writeRichMediaResizeTrace(['phase=start', `id=${id}`, `pid=${pointerId}`, `startW=${startW}`, `startH=${stableH}`])
    handleFrame()
  }, [active, handleFrame, mediaOverlayDragInteractionMode, runtimeRef, writeRichMediaResizeTrace])

  React.useEffect(() => {
    if (canvas2dRenderer === 'flowEditor' || canvas2dRenderer === 'flowCanvas') return
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
    if (!mediaOverlayDragInteractionMode) {
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
  }, [mediaOverlayDragInteractionMode, mediaLayoutPropsSignature, sceneGraphData?.nodes, sceneGraphDataRevision])

  React.useEffect(() => {
    const stopPassiveLayoutWhileWorkspaceOverlayOpen =
      workspaceOverlayOpenRef.current && !flowEditorFrontmatterDocumentModeRequested
    if (!active) return
    if (stopPassiveLayoutWhileWorkspaceOverlayOpen) return
    mediaOverlayLayoutScheduleRef.current?.()
    onInteractionFrame?.()
  }, [
    active,
    canvas2dRenderer,
    workspaceOverlayOpenKey,
    flowEditorFrontmatterDocumentModeRequested,
    flowEditorFrontmatterInteractionMode,
    mediaLayoutItemIdsKey,
    mediaLayoutPropsSignature,
    onInteractionFrame,
    plannedOverlayNodeIdsKey,
  ])

  React.useEffect(() => {
    const stopPassiveLayoutWhileWorkspaceOverlayOpen =
      workspaceOverlayOpenRef.current && !flowEditorFrontmatterDocumentModeRequested
    if (!active || mediaLayoutItems.length === 0 || stopPassiveLayoutWhileWorkspaceOverlayOpen) {
      mediaOverlayLayoutScheduleRef.current = null
      return
    }
    const stableMediaLayoutItems = mediaLayoutItemsKey ? mediaLayoutItemsKey.split('|').filter(Boolean).map(id => ({ id })) : []
    const density = normalizeRichMediaPanelDensity(mediaPanelDensity)
    const sizingConfig = readOverlaySizingConfigForDensity({ density, sizing: overlaySizing || null })
    const loop = startMediaOverlayLayoutLoop2d({
      enabled: true,
      loop: 'onDemand',
      items: stableMediaLayoutItems,
      manualPlacement: richMediaInfiniteCanvasMode,
      density,
      viewportW,
      viewportH,
      readLayoutViewport: readMediaLayoutViewport,
      readTransform: () => runtimeRef.current?.transform || d3.zoomIdentity,
      computeSizingZoomK: zoomK => computeOverlaySizingScale(
        zoomK,
        stableMediaLayoutItems.length,
        RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE.width,
        RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE.height,
      ),
      scaleLayoutOnZoom: canvas2dRenderer === 'flowEditor',
      getPanelSizeForId: id => {
        if (!richMediaInfiniteCanvasMode) return null
        const override = mediaOverlayPanelSizeOverrideRef.current.get(id)
        if (override) {
          writeRichMediaResizeTrace(['phase=layout-override', `id=${id}`, `w=${override.w}`, `h=${override.h}`])
          const coerced = coerceRichMediaPanelSizeForLayoutViewport({ readLayoutViewport: readMediaLayoutViewport, width: override.w, height: override.h, minWidthPx: 220, minHeightPx: 160 })
          return { w: coerced.width, h: coerced.height }
        }
        const props = sceneNodePropsByIdRef.current.get(id) || null
        const stableSize = readStableRichMediaPanelSize(props) || mediaOverlayPanelLastKnownWorldSizeRef.current.get(id) || null
        if (!stableSize) return null
        const zoomK = typeof runtimeRef.current?.transform?.k === 'number' && runtimeRef.current.transform.k > 0 ? runtimeRef.current.transform.k : 1
        const scale = computeOverlaySizingScale(zoomK, stableMediaLayoutItems.length, stableSize.w, stableSize.h)
        const coerced = coerceRichMediaPanelSizeForLayoutViewport({ readLayoutViewport: readMediaLayoutViewport, width: stableSize.w * scale, height: stableSize.h * scale, minWidthPx: 220, minHeightPx: 160 })
        return { w: coerced.width, h: coerced.height }
      },
      getElementForId: id => mediaOverlayElsRef.current.get(id) || null,
      getNodeWorldCenterForId: id => readNodeCenterWorld2d(runtimeRef.current?.scene?.nodeById.get(id), { coords: 'topLeft' }),
      getCollisionObstacles: () => {
        const obstacles: Array<{ id: string; left: number; top: number; width: number; height: number }> = []
        const canonicalOverlayRects = collectCanonicalFlowEditorOverlayRectEntries(queryActiveFlowEditorOverlays())
        for (let i = 0; i < canonicalOverlayRects.length; i += 1) {
          const entry = canonicalOverlayRects[i]
          const id = entry?.id
          const rect = entry?.rect
          if (!id || !rect || mediaOverlayElsRef.current.has(id)) continue
          obstacles.push({ id, left: rect.left, top: rect.top, width: rect.width, height: rect.height })
        }
        return obstacles
      },
      schema: schema && typeof schema === 'object' ? (schema as GraphSchema) : null,
      collision: richMediaInfiniteCanvasMode
        ? { enabled: false }
        : { enabled: true },
      sizingConfig: {
        widthRatio: sizingConfig.widthRatio,
        widthMinPx: sizingConfig.widthMinPx,
        widthMaxPx: sizingConfig.widthMaxPx,
        quantizeStepPx: richMediaInfiniteCanvasMode ? 1 : 16,
      },
      clampToViewport: richMediaInfiniteCanvasMode
        ? null
        : { margin: mediaViewportMargin },
    })
    mediaOverlayLayoutScheduleRef.current = loop.schedule
    loop.schedule()
    return () => {
      loop.stop()
      if (mediaOverlayLayoutScheduleRef.current === loop.schedule) mediaOverlayLayoutScheduleRef.current = null
    }
  }, [
    active,
    workspaceOverlayOpenKey,
    flowEditorFrontmatterDocumentModeRequested,
    richMediaInfiniteCanvasMode,
    mediaViewportMargin,
    mediaLayoutItems.length,
    mediaLayoutItemsKey,
    mediaPanelDensity,
    computeOverlaySizingScale,
    readMediaLayoutViewport,
    writeRichMediaResizeTrace,
    queryActiveFlowEditorOverlays,
    runtimeRef,
    schema,
    overlaySizing,
    viewportH,
    viewportW,
  ])

  React.useEffect(() => {
    return () => resetMediaOverlayInteractionState({ clearLastKnownWorldSize: true })
  }, [resetMediaOverlayInteractionState])

  if (!(active && mediaNodes.length > 0)) return null
  const workspaceMutationBlocked = workspaceMutationBlockedRef.current
  return (
    <section
      aria-label="Flow media overlay"
      className={UI_RESPONSIVE_PASSIVE_FILL_SURFACE_CLASSNAME}
      style={{ zIndex: Z_INDEX_GRAPH_MEDIA_LAYER }}
    >
      {mediaNodes.map((node, index) => {
        const isSelected = canonicalNodeIdSetHas(selectedOverlayNodeIdSet, node.id)
        const mediaOverlayInteractionPolicy = resolveFlowCanvasMediaOverlayInteractionPolicy({
          rendererInteractionMode: mediaOverlayDragInteractionMode,
          workspaceMutationBlocked,
        })
        const overlayInteractionEnabled = mediaOverlayInteractionPolicy.overlayPanActive
        const headerDragInteractionActive = mediaOverlayInteractionPolicy.headerDragActive
        const resizeInteractionActive = mediaOverlayInteractionPolicy.resizeActive
        const resizeHandleVisible = resizeInteractionActive && (isSelected || canvas2dRenderer === 'flowCanvas')
        const overlayPanelPointerEventsClass = mediaOverlayInteractionPolicy.panelPointerEventsClassName
        const overlayZIndex = isSelected
          ? Z_INDEX_GRAPH_OVERLAY_SELECTED
          : Math.max(1, Z_INDEX_GRAPH_MEDIA_LAYER + Math.max(0, mediaNodes.length - index))
        const updateNode = (id: string, patch: { properties: Record<string, unknown> }) => {
          if (workspaceMutationBlockedRef.current) return
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
            className={`absolute left-0 top-0 ${overlayPanelPointerEventsClass}`}
            title={node.title}
            url={node.url}
            srcDoc={node.srcDoc}
            openUrl={node.openUrl}
            kind={node.kind}
            panelChrome="flowEditor"
            interactive={resolveRichMediaPanelInteractive({
              nodeInteractive: node.interactive,
              renderMediaAsNodes,
              infiniteCanvasInteractionMode,
              canvasRenderMode: '2d',
              canvas2dRenderer,
              frontmatterModeEnabled,
              documentSemanticMode,
            })}
            panel={node.panel}
            onPanelChange={next => {
              if (!node.panel) return
              commitRichMediaPanelChange({ nodeId: node.id, next, updateNode })
            }}
            forwardWheelTo={() => canvasRef.current}
            onOverlayPanStart={overlayInteractionEnabled ? payload => beginMediaOverlayPan(payload) : undefined}
            onOverlayPan={overlayInteractionEnabled ? payload => {
              mediaOverlayPanMoveLatestRef.current = payload
              if (!mediaOverlayPanMoveSchedulerRef.current) {
                mediaOverlayPanMoveSchedulerRef.current = createRafLatestScheduler(applyMediaOverlayPanMove)
              }
              mediaOverlayPanMoveSchedulerRef.current.schedule(payload)
            } : undefined}
            onOverlayPanEnd={overlayInteractionEnabled ? payload => {
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
            onHeaderDragStart={headerDragInteractionActive ? ({ pointerId }) => beginMediaOverlayHeaderDrag(node.id, pointerId) : undefined}
            onHeaderDrag={headerDragInteractionActive ? ({ dx, dy, pointerId }) => {
              const queued = { id: node.id, pointerId, dx, dy }
              mediaOverlayHeaderMoveLatestRef.current = queued
              if (!mediaOverlayHeaderMoveSchedulerRef.current) {
                mediaOverlayHeaderMoveSchedulerRef.current = createRafLatestScheduler(entry => applyMediaOverlayHeaderDragMove(entry.id, entry))
              }
              mediaOverlayHeaderMoveSchedulerRef.current.schedule(queued)
            } : undefined}
            onHeaderDragEnd={headerDragInteractionActive ? ({ pointerId }) => {
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
            resizable={resizeHandleVisible}
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
              if (!workspaceMutationBlockedRef.current) {
                try {
                  const store = useGraphStore.getState() as {
                    graphData?: GraphData | null
                    updateNode?: (id: string, updates: { properties: Record<string, unknown> }) => void
                  }
                  const baseProps = sceneNodePropsByIdRef.current.get(node.id) || {}
                  void store.graphData
                  store.updateNode?.(node.id, { properties: { ...baseProps, 'visual:width': drag.lastW, 'visual:height': drag.lastH } })
                } catch {
                  void 0
                }
                writeRichMediaResizeTrace(['phase=end', `id=${node.id}`, `pid=${pointerId}`, `finalW=${drag.lastW}`, `finalH=${drag.lastH}`])
                mediaOverlayLayoutScheduleRef.current?.()
                requestCommit()
              }
            } : undefined}
            flowEditorInteractionMode={flowEditorSurfaceInteractionMode}
            flowEditorFrontmatterDocumentMode={flowEditorFrontmatterDocumentModeRequested}
            flowEditorSurfaceId={flowEditorOverlaySurfaceId}
            style={{ transform: `translate(${Math.max(-99999, -mediaViewportMargins.left)}px, ${Math.max(-99999, -mediaViewportMargins.top)}px)`, width: 1, height: 1, zIndex: overlayZIndex }}
            onWheelCapture={mediaOverlayInteractionPolicy.capturePanelEvents ? stopEvent : undefined}
            onClickCapture={mediaOverlayInteractionPolicy.capturePanelEvents ? stopEvent : undefined}
            onDoubleClickCapture={mediaOverlayInteractionPolicy.capturePanelEvents ? stopEvent : undefined}
            onContextMenuCapture={mediaOverlayInteractionPolicy.capturePanelEvents ? stopEvent : undefined}
          />
        )
      })}
    </section>
  )
}
