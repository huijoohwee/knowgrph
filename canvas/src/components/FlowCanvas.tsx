import React from 'react'
import * as d3 from 'd3'
import { useShallow } from 'zustand/react/shallow'

import { useGraphStore } from '@/hooks/useGraphStore'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { useContainerDims } from '@/hooks/useContainerDims'
import { readFitAllOptions, readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { buildLayoutPositionCacheKey, buildLayoutViewKey, computeLayoutDatasetKey } from '@/components/GraphCanvas/layout/positioning'
import { cloneGraphDataForRender } from '@/components/GraphCanvas/renderClone'
import { deriveSceneDisplayGraph } from '@/lib/scene/sceneDerivation'
import { coerceNodesForFit, fitAllTransform } from '@/components/GraphCanvas/fit'
import { buildZoomViewKey } from '@/components/GraphCanvas/zoomViewKey'
import { pickInitialZoomTransform } from '@/lib/zoom/viewport'
import { pickZoomStateForView } from '@/lib/canvas/zoom-effective'
import { readFlowConfig } from '@/components/FlowCanvas/config'
import { buildAndSetFlowNativeScene } from '@/components/FlowCanvas/buildNativeScene'
import { buildGraphMetaKey, buildGraphMetaKeyIgnoringPending, deriveRankdir } from '@/components/FlowCanvas/layout'
import { isFlowTransformShowingGraph } from '@/components/FlowCanvas/transformGuards'
import { deriveSceneGroups } from '@/lib/scene/sceneDerivation'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { useAutoZoomModes2d } from '@/features/zoom/useAutoZoomModes2d'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import { buildSchemaLayoutEngineJson2d } from '@/lib/canvas/schema-layout-engine-json'
import { buildCollapsedGroupIdsKey } from '@/lib/canvas/collapsedGroupIdsKey'
import { computeArrangeCenters, type ArrangeAction2d } from '@/lib/canvas/arrange2d'
import { isEditableTarget, readArrangeShortcut, readNudgeDelta } from '@/lib/canvas/arrangeShortcuts'
import { readSnapGridConfigFromSchema, snapScalarToGrid } from '@/lib/canvas/gridSnap'
import { readCanvasGridConfigFromSchema, readCanvasGridWorldStepFromSchema } from '@/lib/canvas/canvasGridConfig'
import { disableAutoZoomModesForUserGesture } from '@/lib/canvas/auto-zoom-modes'
import { clampCanvasInteractionSpeedMultiplier, clampCanvasPanSpeedMultiplier } from '@/lib/canvas/camera-options-2d'
import { readAllowGroupResize } from '@/lib/canvas/groupResizePolicy'
import {
  createFlowNativeRuntime,
  requestFlowNativeDraw,
  setFlowNativePresentation,
  setFlowNativeTransform,
  setFlowNativeViewport,
  type FlowNativeDrawArgs,
  type FlowNativeRuntime,
} from '@/components/FlowCanvas/nativeRuntime'
import { createZoomWheelGuardState } from '@/lib/canvas/zoom-wheel-guard'
import { ensureSpacePanKeyListenerInstalled } from '@/lib/canvas/space-pan'
import { applyZoomRequestNative } from '@/components/FlowCanvas/applyZoomRequestNative'
import { setFlowAutoMinScale } from '@/components/FlowCanvas/flowScaleExtentOverride'
import { bindFlowCanvasNativeInteractions, type FlowCanvasDrag } from '@/components/FlowCanvas/bindNativeInteractions'
import { __flowCanvasDebug } from '@/components/FlowCanvas/flowCanvasDebug'
import { useFlowComputedPositions } from '@/components/FlowCanvas/useFlowComputedPositions'
import { fitFlowEditorPinnedQuickEditors } from '@/components/FlowCanvas/fitPinnedQuickEditors'
import { readFlowPresentation } from '@/components/FlowCanvas/presentation'
import { useFlowRequestCommit } from '@/components/FlowCanvas/useFlowRequestCommit'
import { computeCollisionDuringDrag } from '@/components/FlowCanvas/collisionPolicy'
import { CANVAS_INTERACTIVE_CLASS, CANVAS_SURFACE_CLASS } from '@/lib/canvas/surface'
import { computeNodeQuickEditorScale, computeNodeQuickEditorScaledSize, NODE_QUICK_EDITOR_BASE_SIZE } from '@/components/FlowEditor/nodeQuickEditorZoom'
import { computeNodeQuickEditorMaxAnchorShiftPx } from '@/components/FlowEditor/nodeQuickEditorLayout'
import { DEFAULT_FLOW_NODE_WIDTH_PX } from '@/lib/graph/layoutDefaults'
import type { GraphSchema } from '@/lib/graph/schema'
import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'
import { listMediaOverlayNodes } from '@/lib/render/mediaOverlayPool'
import RichMediaPanel from '@/components/RichMediaPanel'
import { readNodeCenterWorld2d } from '@/lib/render/mediaAnchor'
import { startMediaOverlayLayoutLoop2d } from '@/lib/render/mediaOverlayLayoutLoop2d'
import { computeMediaOverlaySizing } from '@/lib/render/mediaOverlaySizing'

const EMPTY_NODE_QUICK_EDITOR_REGISTRY: NodeQuickEditorRegistryEntry[] = []

function clampFinite(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo
  return Math.max(lo, Math.min(hi, v))
}

export default function FlowCanvas({
  active = true,
  graphDataOverride,
  graphDataRevisionOverride,
  collisionDuringDrag = false,
  allowNodeDragOverride,
  exposeRuntimeRef,
  onInteractionFrame,
  hideSelectedNodeGlyph = false,
  hideSelectedNodePortHandles,
  hideNodeIds,
  hidePortHandleNodeIds,
  renderEdges,
  renderGroups,
  renderNodes,
  forbidCircleNodes = false,
}: {
  active?: boolean
  graphDataOverride?: GraphData | null
  graphDataRevisionOverride?: number
  collisionDuringDrag?: boolean
  allowNodeDragOverride?: boolean
  exposeRuntimeRef?: (ref: React.MutableRefObject<FlowNativeRuntime | null>) => void
  onInteractionFrame?: () => void
  hideSelectedNodeGlyph?: boolean
  hideSelectedNodePortHandles?: boolean
  hideNodeIds?: string[]
  hidePortHandleNodeIds?: string[]
  renderEdges?: boolean
  renderGroups?: boolean
  renderNodes?: boolean
  forbidCircleNodes?: boolean
}) {
  const containerRef = React.useRef<HTMLElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const runtimeRef = React.useRef<FlowNativeRuntime | null>(null)
  const lastBuiltGraphKeyRef = React.useRef<string>('')
  const lastUserInteractionAtMsRef = React.useRef<number>(0)
  const lastInitTransformZoomViewKeyRef = React.useRef<string | null>(null)
  const lastAppliedPositionsRef = React.useRef<Record<string, { x: number; y: number }> | null>(null)
  const lastCommittedPositionsRef = React.useRef<Record<string, { x: number; y: number }> | null>(null)
  const positionsDirtySinceCommitRef = React.useRef(false)
  const selectedNodeIdsRef = React.useRef<string[]>([])
  const selectedEdgeIdsRef = React.useRef<string[]>([])
  const drawArgsRef = React.useRef<FlowNativeDrawArgs>({
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedGroupId: null,
    showGroupResizeHandle: false,
    hideNodeIds: undefined,
    hidePortHandleNodeIds: undefined,
    renderEdges: undefined,
    renderGroups: undefined,
    renderNodes: undefined,
    grid: null,
  })
  const lastPointerInCanvasRef = React.useRef<null | { sx: number; sy: number; ts: number }>(null)
  const lastWheelIntentRef = React.useRef<null | { dir: 'in' | 'out'; ts: number }>(null)
  const zoomWheelGuardRef = React.useRef(createZoomWheelGuardState())
  const userSelectLockPointerIdRef = React.useRef<number | null>(null)

  const registerCanvasSnapshotFns = useGraphStore(s => s.registerCanvasSnapshotFns)

  const { width, height, dpr } = useContainerDims(containerRef)
  const viewportW = Math.max(1, Math.floor(width))
  const viewportH = Math.max(1, Math.floor(height))

  React.useEffect(() => {
    const capturePng = async (pixelRatio?: number): Promise<Blob | null> => {
      try {
        const canvas = canvasRef.current
        if (!canvas) return null
        const ratio = pixelRatio && pixelRatio > 0 ? pixelRatio : 1
        if (ratio === 1 && typeof canvas.toBlob === 'function') {
          const directBlob = await new Promise<Blob | null>(resolve => {
            canvas.toBlob(b => resolve(b), 'image/png')
          })
          return directBlob || null
        }
        const width = Math.max(1, Math.floor(canvas.width * ratio))
        const height = Math.max(1, Math.floor(canvas.height * ratio))
        const target = document.createElement('canvas')
        target.width = width
        target.height = height
        const ctx = target.getContext('2d')
        if (!ctx) return null
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(canvas, 0, 0, width, height)
        const blob = await new Promise<Blob | null>(resolve => {
          target.toBlob(b => resolve(b), 'image/png')
        })
        return blob || null
      } catch {
        return null
      }
    }
    registerCanvasSnapshotFns('2d', { capturePng })
    return () => {
      registerCanvasSnapshotFns('2d', null)
    }
  }, [registerCanvasSnapshotFns])

  const [selectionBox, setSelectionBox] = React.useState<null | { left: number; top: number; width: number; height: number }>(null)
  const selectionBoxRafRef = React.useRef<number | null>(null)
  const requestSetSelectionBox = React.useCallback((next: null | { left: number; top: number; width: number; height: number }) => {
    if (selectionBoxRafRef.current != null) cancelAnimationFrame(selectionBoxRafRef.current)
    selectionBoxRafRef.current = requestAnimationFrame(() => {
      selectionBoxRafRef.current = null
      setSelectionBox(prev => {
        if (!prev && !next) return prev
        if (next) {
          const w = clampFinite(next.width, 0, 1_000_000)
          const h = clampFinite(next.height, 0, 1_000_000)
          const maxLeft = Math.max(0, viewportW - w)
          const maxTop = Math.max(0, viewportH - h)
          const left = clampFinite(next.left, 0, maxLeft)
          const top = clampFinite(next.top, 0, maxTop)
          next = { left, top, width: clampFinite(w, 0, viewportW - left), height: clampFinite(h, 0, viewportH - top) }
        }
        if (prev && next && prev.left === next.left && prev.top === next.top && prev.width === next.width && prev.height === next.height) return prev
        return next
      })
    })
  }, [viewportH, viewportW])

  React.useEffect(() => {
    ensureSpacePanKeyListenerInstalled()
  }, [])

  React.useEffect(() => {
    exposeRuntimeRef?.(runtimeRef)
  }, [exposeRuntimeRef])

  const handleInteractionFrame = React.useCallback(() => {
    lastUserInteractionAtMsRef.current = Date.now()
    onInteractionFrame?.()
  }, [onInteractionFrame])

  const buildDrawArgs = React.useCallback(
    () => drawArgsRef.current,
    [],
  )

  const drawRafRef = React.useRef<number | null>(null)
  const scheduleFlowDraw = React.useCallback(() => {
    if (drawRafRef.current != null) return
    drawRafRef.current = requestAnimationFrame(() => {
      drawRafRef.current = null
      if (!active) return
      const runtime = runtimeRef.current
      if (!runtime) return
      runtime.dirty = true
      requestFlowNativeDraw(runtime, buildDrawArgs())
    })
  }, [active, buildDrawArgs])

  const stopEvent = React.useCallback((event: React.SyntheticEvent) => {
    try {
      event.stopPropagation()
    } catch {
      void 0
    }
  }, [])

  React.useEffect(() => {
    return () => {
      if (drawRafRef.current != null) {
        try {
          cancelAnimationFrame(drawRafRef.current)
        } catch {
          void 0
        }
        drawRafRef.current = null
      }
      const rt = runtimeRef.current
      if (rt?.pendingRaf != null) {
        try {
          cancelAnimationFrame(rt.pendingRaf)
        } catch {
          void 0
        }
        rt.pendingRaf = null
      }
    }
  }, [])
  const collisionSchemaRef = React.useRef<typeof schema | null>(null)
  const collisionGraphDataRef = React.useRef<GraphData | null>(null)
  const collisionFlowConfigRef = React.useRef<typeof flowConfig | null>(null)
  const collisionPresentationRef = React.useRef<typeof flowPresentation | null>(null)
  const dragRef = React.useRef<FlowCanvasDrag>(null)
  const {
    schema,
    frontmatterModeEnabled,
    documentSemanticMode,
    documentStructureBaselineLock,
    collapsedGroupIds,
    renderMediaAsNodes,
    mediaPanelDensity,
    threeIframeOverlayPoolMax,
    threeIframeOverlayBaseWidthRatioDefault,
    threeIframeOverlayBaseWidthRatioCompact,
    threeIframeOverlayBaseWidthMinPxDefault,
    threeIframeOverlayBaseWidthMinPxCompact,
    threeIframeOverlayBaseWidthMaxPxDefault,
    threeIframeOverlayBaseWidthMaxPxCompact,
    canvasRenderMode,
    canvas2dRenderer,
    viewportControlsPreset,
    flowEditorSelectionOnDrag,
    setLayoutPositionsForMode,
    graphDataRevision: baseGraphDataRevision,
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
    selectedGroupId,
    zoomRequest,
    viewPinned,
    fitToScreenMode,
    zoomToSelectionMode,
    setZoomState,
    setZoomStateForKey,
    nodeQuickEditorRegistry,
    openQuickEditorNodeIds,
    flowNodeQuickEditorPinnedByNodeId,
    flowNodeQuickEditorWorldPosByNodeId,
    flowNodeQuickEditorPosByNodeId,
  } = useGraphStore(
    useShallow(s => ({
      schema: s.schema,
      frontmatterModeEnabled: s.frontmatterModeEnabled || false,
      documentSemanticMode: (s.documentSemanticMode || 'document') as 'document' | 'keyword',
      documentStructureBaselineLock: s.documentStructureBaselineLock === true,
      collapsedGroupIds: s.collapsedGroupIds || [],
      renderMediaAsNodes: s.renderMediaAsNodes,
      mediaPanelDensity: s.mediaPanelDensity,
      threeIframeOverlayPoolMax: s.threeIframeOverlayPoolMax,
      threeIframeOverlayBaseWidthRatioDefault: s.threeIframeOverlayBaseWidthRatioDefault,
      threeIframeOverlayBaseWidthRatioCompact: s.threeIframeOverlayBaseWidthRatioCompact,
      threeIframeOverlayBaseWidthMinPxDefault: s.threeIframeOverlayBaseWidthMinPxDefault,
      threeIframeOverlayBaseWidthMinPxCompact: s.threeIframeOverlayBaseWidthMinPxCompact,
      threeIframeOverlayBaseWidthMaxPxDefault: s.threeIframeOverlayBaseWidthMaxPxDefault,
      threeIframeOverlayBaseWidthMaxPxCompact: s.threeIframeOverlayBaseWidthMaxPxCompact,
      canvasRenderMode: s.canvasRenderMode,
      canvas2dRenderer: s.canvas2dRenderer,
      viewportControlsPreset: s.viewportControlsPreset,
      flowEditorSelectionOnDrag: s.flowEditorSelectionOnDrag === true,
      setLayoutPositionsForMode: s.setLayoutPositionsForMode,
      graphDataRevision: s.graphDataRevision || 0,
      selectedNodeId: s.selectedNodeId,
      selectedEdgeId: s.selectedEdgeId,
      selectedNodeIds: s.selectedNodeIds,
      selectedEdgeIds: s.selectedEdgeIds,
      selectedGroupId: s.selectedGroupId,
      zoomRequest: s.zoomRequest,
      viewPinned: s.viewPinned === true,
      fitToScreenMode: s.fitToScreenMode === true,
      zoomToSelectionMode: s.zoomToSelectionMode === true,
      setZoomState: s.setZoomState,
      setZoomStateForKey: s.setZoomStateForKey,
      nodeQuickEditorRegistry: s.effectiveNodeQuickEditorRegistry ?? EMPTY_NODE_QUICK_EDITOR_REGISTRY,
      openQuickEditorNodeIds: s.openQuickEditorNodeIds || [],
      flowNodeQuickEditorPinnedByNodeId: s.flowNodeQuickEditorPinnedByNodeId || {},
      flowNodeQuickEditorWorldPosByNodeId: (s as unknown as { flowNodeQuickEditorWorldPosByNodeId?: Record<string, { x: number; y: number }> }).flowNodeQuickEditorWorldPosByNodeId || {},
      flowNodeQuickEditorPosByNodeId: s.flowNodeQuickEditorPosByNodeId || {},
    })),
  )

  const graphDataRevision = typeof graphDataRevisionOverride === 'number' ? graphDataRevisionOverride : baseGraphDataRevision

  const mediaHideNodeIdsRef = React.useRef<string[]>([])

  React.useEffect(() => {
    const nodeIdSet = new Set<string>((selectedNodeIds || []).map(v => String(v)))
    if (selectedNodeId) nodeIdSet.add(String(selectedNodeId))
    const edgeIdSet = new Set<string>((selectedEdgeIds || []).map(v => String(v)))
    if (selectedEdgeId) edgeIdSet.add(String(selectedEdgeId))
    const nextSelectedNodeIds = Array.from(nodeIdSet)
    const nextSelectedEdgeIds = Array.from(edgeIdSet)
    selectedNodeIdsRef.current = nextSelectedNodeIds
    selectedEdgeIdsRef.current = nextSelectedEdgeIds
    drawArgsRef.current.selectedNodeIds = nextSelectedNodeIds
    drawArgsRef.current.selectedEdgeIds = nextSelectedEdgeIds
    drawArgsRef.current.selectedGroupId = selectedGroupId ? String(selectedGroupId || '').trim() : null
    drawArgsRef.current.showGroupResizeHandle = readAllowGroupResize(schema)
    const canvasGrid = readCanvasGridConfigFromSchema(schema)
    drawArgsRef.current.grid = canvasGrid.enabled
      ? {
          enabled: true,
          size: readCanvasGridWorldStepFromSchema(schema),
          variant: canvasGrid.variant,
          majorEvery: canvasGrid.majorEvery,
          dotRadiusPx: canvasGrid.dotRadiusPx,
        }
      : null
    const explicitHideNodeIds = (hideNodeIds || []).map(v => String(v)).filter(Boolean)
    const explicitHidePortHandleNodeIds = (hidePortHandleNodeIds || []).map(v => String(v)).filter(Boolean)
    const mediaHideNodeIds = renderMediaAsNodes === true ? mediaHideNodeIdsRef.current : []
    const baseHideNodeIds = explicitHideNodeIds.length > 0 || mediaHideNodeIds.length > 0 ? Array.from(new Set([...explicitHideNodeIds, ...mediaHideNodeIds])) : []
    drawArgsRef.current.hideNodeIds = hideSelectedNodeGlyph
      ? Array.from(new Set([...nextSelectedNodeIds, ...baseHideNodeIds]))
      : baseHideNodeIds.length > 0
        ? baseHideNodeIds
        : undefined
    drawArgsRef.current.hidePortHandleNodeIds = hideSelectedNodePortHandles
      ? Array.from(new Set([...nextSelectedNodeIds, ...explicitHidePortHandleNodeIds]))
      : explicitHidePortHandleNodeIds.length > 0
        ? explicitHidePortHandleNodeIds
        : undefined
    drawArgsRef.current.renderEdges = renderEdges
    drawArgsRef.current.renderGroups = renderGroups
    drawArgsRef.current.renderNodes = renderNodes
    scheduleFlowDraw()
  }, [
    active,
    buildDrawArgs,
    hideNodeIds,
    hidePortHandleNodeIds,
    hideSelectedNodeGlyph,
    hideSelectedNodePortHandles,
    renderEdges,
    renderGroups,
    renderNodes,
    renderMediaAsNodes,
    selectedEdgeId,
    selectedEdgeIds,
    selectedGroupId,
    selectedNodeId,
    selectedNodeIds,
    scheduleFlowDraw,
    schema,
  ])

  useAutoZoomModes2d({
    viewportW,
    viewportH,
    paused: !active,
  })

  const schemaLayoutEngineJson = React.useMemo(() => buildSchemaLayoutEngineJson2d(schema), [schema])

  const storeGraphData = useActiveGraphRenderData(active)
  const renderGraphData = graphDataOverride !== undefined ? graphDataOverride : storeGraphData
  const effectiveFrontmatter = React.useMemo(() => {
    return computeEffectiveFrontmatterMode({
      frontmatterModeEnabled: frontmatterModeEnabled === true && documentStructureBaselineLock !== true,
      documentSemanticMode,
      graphData: renderGraphData,
    })
  }, [documentSemanticMode, documentStructureBaselineLock, frontmatterModeEnabled, renderGraphData])

  const collapsedGroupIdsKey = React.useMemo(() => {
    return buildCollapsedGroupIdsKey(collapsedGroupIds)
  }, [collapsedGroupIds])

  const clonedGraphData = React.useMemo(() => {
    if (!renderGraphData) return null
    return cloneGraphDataForRender(renderGraphData) as GraphData
  }, [renderGraphData])

  const sceneDisplayGraphDerivation = React.useMemo(() => {
    if (!clonedGraphData) return null
    return deriveSceneDisplayGraph({ graphData: clonedGraphData })
  }, [clonedGraphData])

  const sceneGraphData = React.useMemo(() => {
    if (!clonedGraphData) return null
    return sceneDisplayGraphDerivation?.displayGraphData || clonedGraphData
  }, [clonedGraphData, sceneDisplayGraphDerivation])


  const mediaNodes = React.useMemo(() => {
    const nodes = Array.isArray(sceneGraphData?.nodes) ? (sceneGraphData!.nodes as unknown as GraphNode[]) : []
    const poolMaxRaw = typeof threeIframeOverlayPoolMax === 'number' && Number.isFinite(threeIframeOverlayPoolMax) ? threeIframeOverlayPoolMax : 0
    const poolMax = poolMaxRaw > 0 ? poolMaxRaw : 24
    return listMediaOverlayNodes({ enabled: true, nodes, poolMax })
  }, [renderMediaAsNodes, sceneGraphData, threeIframeOverlayPoolMax])

  const mediaNodeIdsKey = React.useMemo(() => mediaNodes.map(n => n.id).join('|'), [mediaNodes])
  React.useEffect(() => {
    mediaHideNodeIdsRef.current = []
  }, [mediaNodeIdsKey, mediaNodes, renderMediaAsNodes])
  const mediaOverlayElsRef = React.useRef<Map<string, HTMLDivElement>>(new Map())
  React.useEffect(() => {
    const next = new Map<string, HTMLDivElement>()
    for (const n of mediaNodes) {
      const existing = mediaOverlayElsRef.current.get(n.id)
      if (existing) next.set(n.id, existing)
    }
    mediaOverlayElsRef.current = next
  }, [mediaNodeIdsKey, mediaNodes])

  const mediaOverlayPanRef = React.useRef<null | { pointerId: number; startTransform: d3.ZoomTransform }>(null)
  const mediaOverlayHeaderDragRef = React.useRef<null | { id: string; pointerId: number; startX: number; startY: number; startK: number }>(null)
  const requestCommitRef = React.useRef<null | (() => void)>(null)

  const startMediaOverlayPan = React.useCallback((args: { pointerId: number }) => {
    if (!active) return
    const rt = runtimeRef.current
    if (!rt) return
    disableAutoZoomModesForUserGesture(useGraphStore.getState())
    mediaOverlayPanRef.current = { pointerId: args.pointerId, startTransform: rt.transform || d3.zoomIdentity }
  }, [active])

  const moveMediaOverlayPan = React.useCallback((args: { pointerId: number; dx: number; dy: number }) => {
    const drag = mediaOverlayPanRef.current
    if (!drag || drag.pointerId !== args.pointerId) return
    const rt = runtimeRef.current
    if (!rt) return
    const st = useGraphStore.getState()
    disableAutoZoomModesForUserGesture(st)
    const interactionSpeed =
      clampCanvasPanSpeedMultiplier(st.canvasPanSpeedMultiplier) * clampCanvasInteractionSpeedMultiplier(st.canvasInteractionSpeedMultiplier)
    const next = d3.zoomIdentity
      .translate(drag.startTransform.x + args.dx * interactionSpeed, drag.startTransform.y + args.dy * interactionSpeed)
      .scale(drag.startTransform.k)
    setFlowNativeTransform(rt, next)
    requestFlowNativeDraw(rt, buildDrawArgs())
    requestCommitRef.current?.()
    onInteractionFrame?.()
  }, [buildDrawArgs, onInteractionFrame])

  const endMediaOverlayPan = React.useCallback((args: { pointerId: number }) => {
    const drag = mediaOverlayPanRef.current
    if (!drag || drag.pointerId !== args.pointerId) return
    mediaOverlayPanRef.current = null
  }, [])

  const beginMediaOverlayHeaderDrag = React.useCallback((id: string, pointerId: number) => {
    if (!active) return
    const rt = runtimeRef.current
    const scene = rt?.scene
    if (!rt || !scene) return
    const node = scene.nodeById.get(id)
    if (!node) return
    disableAutoZoomModesForUserGesture(useGraphStore.getState())
    mediaOverlayHeaderDragRef.current = { id, pointerId, startX: node.x, startY: node.y, startK: rt.transform?.k || 1 }
  }, [active])

  const moveMediaOverlayHeaderDrag = React.useCallback((id: string, args: { pointerId: number; dx: number; dy: number }) => {
    const drag = mediaOverlayHeaderDragRef.current
    if (!drag || drag.id !== id || drag.pointerId !== args.pointerId) return
    const rt = runtimeRef.current
    const scene = rt?.scene
    if (!rt || !scene) return
    const node = scene.nodeById.get(id)
    if (!node) return
    const k = Number.isFinite(drag.startK) && drag.startK > 0 ? drag.startK : 1
    node.x = drag.startX + args.dx / k
    node.y = drag.startY + args.dy / k
    rt.dirty = true
    positionsDirtySinceCommitRef.current = true
    requestFlowNativeDraw(rt, buildDrawArgs())
    requestCommitRef.current?.()
    onInteractionFrame?.()
  }, [buildDrawArgs, onInteractionFrame])

  const endMediaOverlayHeaderDrag = React.useCallback((id: string, pointerId: number) => {
    const drag = mediaOverlayHeaderDragRef.current
    if (!drag || drag.id !== id || drag.pointerId !== pointerId) return
    mediaOverlayHeaderDragRef.current = null
  }, [])

  React.useEffect(() => {
    if (!active) return
    if (mediaNodes.length === 0) return
    const density = mediaPanelDensity === 'compact' ? 'compact' : 'default'
    const widthRatioRaw = density === 'compact' ? threeIframeOverlayBaseWidthRatioCompact : threeIframeOverlayBaseWidthRatioDefault
    const widthMinRaw = density === 'compact' ? threeIframeOverlayBaseWidthMinPxCompact : threeIframeOverlayBaseWidthMinPxDefault
    const widthMaxRaw = density === 'compact' ? threeIframeOverlayBaseWidthMaxPxCompact : threeIframeOverlayBaseWidthMaxPxDefault

    const loop = startMediaOverlayLayoutLoop2d({
      enabled: true,
      loop: 'always',
      items: mediaNodes,
      density,
      viewportW,
      viewportH,
      readTransform: () => runtimeRef.current?.transform || d3.zoomIdentity,
      getElementForId: (id) => mediaOverlayElsRef.current.get(id) || null,
      getNodeWorldCenterForId: (id) => {
        const rt = runtimeRef.current
        const node = rt?.scene?.nodeById.get(id) as unknown as { x?: unknown; y?: unknown; width?: unknown; height?: unknown } | undefined
        return readNodeCenterWorld2d(node || { x: 0, y: 0 }, { coords: 'topLeft' })
      },
      sizingConfig: {
        widthRatio: Number.isFinite(widthRatioRaw) ? Math.max(0.001, Number(widthRatioRaw)) : 0.2,
        widthMinPx: Number.isFinite(widthMinRaw) ? Math.max(1, Math.floor(widthMinRaw)) : 210,
        widthMaxPx: Number.isFinite(widthMaxRaw) ? Math.max(1, Math.floor(widthMaxRaw)) : 360,
      },
    })
    return () => loop.stop()
  }, [
    active,
    mediaNodes,
    mediaNodeIdsKey,
    mediaPanelDensity,
    renderMediaAsNodes,
    threeIframeOverlayBaseWidthMaxPxCompact,
    threeIframeOverlayBaseWidthMaxPxDefault,
    threeIframeOverlayBaseWidthMinPxCompact,
    threeIframeOverlayBaseWidthMinPxDefault,
    threeIframeOverlayBaseWidthRatioCompact,
    threeIframeOverlayBaseWidthRatioDefault,
    viewportW,
    viewportH,
  ])

  const layoutViewKey = React.useMemo(() => {
    return buildLayoutViewKey({
      schemaLayoutEngineJson,
      frontmatterModeEnabled: effectiveFrontmatter,
      documentSemanticMode: String(documentSemanticMode),
      graphMetaKey: buildGraphMetaKey(sceneGraphData),
      renderMediaAsNodes: renderMediaAsNodes === true,
      mediaPanelDensity: String(mediaPanelDensity),
      collapsedGroupIdsKey,
    })
  }, [
    collapsedGroupIdsKey,
    documentSemanticMode,
    effectiveFrontmatter,
    mediaPanelDensity,
    renderMediaAsNodes,
    schemaLayoutEngineJson,
    sceneGraphData,
  ])

  const zoomViewKey = React.useMemo(() => {
    return buildZoomViewKey({
      canvasRenderMode,
      canvas2dRenderer,
      schemaLayoutEngineJson,
      frontmatterModeEnabled: effectiveFrontmatter,
      documentSemanticMode: String(documentSemanticMode),
      graphMetaKey: buildGraphMetaKeyIgnoringPending(sceneGraphData),
      renderMediaAsNodes: renderMediaAsNodes === true,
      mediaPanelDensity: String(mediaPanelDensity),
      collapsedGroupIdsKey,
    })
  }, [
    canvas2dRenderer,
    canvasRenderMode,
    collapsedGroupIdsKey,
    documentSemanticMode,
    effectiveFrontmatter,
    mediaPanelDensity,
    renderMediaAsNodes,
    schemaLayoutEngineJson,
    sceneGraphData,
  ])

  React.useEffect(() => {
    __flowCanvasDebug.lastZoomViewKey = zoomViewKey
  }, [zoomViewKey])

  const rankdir = deriveRankdir({ flowRankdir: schema?.layout?.flow?.rankdir })
  const flowConfig = React.useMemo(() => readFlowConfig({ schema, rankdir }), [rankdir, schema])
  const flowConfigEffective = React.useMemo(() => {
    if (documentSemanticMode !== 'keyword') return flowConfig
    const explicitElkLayout = schema?.layout?.flow?.elkLayout
    if (typeof explicitElkLayout === 'string' && explicitElkLayout.trim()) return flowConfig
    if (flowConfig.engine !== 'auto' && flowConfig.engine !== 'elk') return flowConfig
    if (flowConfig.elk.algorithm !== 'layered') return flowConfig
    return { ...flowConfig, elk: { ...flowConfig.elk, algorithm: 'stress' as const } }
  }, [documentSemanticMode, flowConfig, schema?.layout?.flow?.elkLayout])
  const layoutMode = schema ? readLayoutMode(schema) : 'force'

  const flowPresentation = React.useMemo(() => {
    const p = readFlowPresentation({ schema, documentSemanticMode })
    const gd = sceneGraphData as unknown as { context?: unknown; metadata?: unknown } | null
    const isMermaidLayout = (() => {
      if (!gd) return false
      if (String(gd.context || '') === 'frontmatter-mermaid') return true
      const meta = gd.metadata
      if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false
      return String((meta as Record<string, unknown>).layoutEngine || '') === 'mermaid'
    })()
    if (!isMermaidLayout) return p
    return {
      ...p,
      edges: {
        ...p.edges,
        underlay: { ...p.edges.underlay, enabled: false },
      },
    }
  }, [documentSemanticMode, schema, sceneGraphData])

  const layoutVariant = React.useMemo(() => {
    return [
      `e=${flowConfigEffective.engine}`,
      `rd=${rankdir}`,
      `dir=${flowConfigEffective.elk.direction}`,
      `alg=${flowConfigEffective.elk.algorithm}`,
      `n=${flowConfigEffective.node.widthPx}x${flowConfigEffective.node.heightPx}`,
      `s=${flowConfigEffective.elk.nodeNodeSpacingPx},${flowConfigEffective.elk.layerSpacingPx},${flowConfigEffective.elk.edgeNodeSpacingPx}`,
      `h=${flowConfigEffective.handle.sizePx},${flowConfigEffective.handle.lineHeightPx}`,
      'cs=topLeftV2',
    ].join('|')
  }, [flowConfigEffective, rankdir])

  const sceneGroupsDerivation = React.useMemo(() => {
    return deriveSceneGroups({
      graphData: clonedGraphData,
      graphDataRevision,
      schema,
      documentSemanticMode: String(documentSemanticMode || ''),
      frontmatterModeEnabled: !!effectiveFrontmatter,
    })
  }, [clonedGraphData, documentSemanticMode, effectiveFrontmatter, graphDataRevision, schema])

  const sceneGroups = React.useMemo(() => {
    if (!flowPresentation.groups.enabled) return []
    return sceneGroupsDerivation?.allGroups || []
  }, [flowPresentation.groups.enabled, sceneGroupsDerivation])

  const datasetKey = React.useMemo(() => {
    return computeLayoutDatasetKey({
      graphData: sceneGraphData as unknown as { metadata?: unknown; nodes?: Array<{ type?: unknown; properties?: unknown; metadata?: unknown }> } | null,
      graphDataRevision,
    })
  }, [graphDataRevision, sceneGraphData])

  const cacheKey = React.useMemo(() => {
    return buildLayoutPositionCacheKey({
      datasetKey,
      mode: layoutMode,
      frontmatterMode: effectiveFrontmatter,
      semanticMode: documentSemanticMode,
      renderMode: '2d',
      viewKey: layoutViewKey,
      renderVariant: canvas2dRenderer,
      layoutVariant,
    })
  }, [canvas2dRenderer, datasetKey, documentSemanticMode, effectiveFrontmatter, layoutMode, layoutVariant, layoutViewKey])

  const layoutPositionsForMode = useGraphStore(s => (cacheKey ? (s.layoutPositionCacheByMode?.[cacheKey] ?? null) : null))

  const computedPositions = useFlowComputedPositions({
    active,
    cacheKey,
    datasetKey,
    graphDataRevision,
    layoutMode,
    layoutVariant,
    flowEditorMode: canvas2dRenderer === 'flowEditor',
    documentSemanticMode: String(documentSemanticMode || 'document'),
    effectiveFrontmatter,
    layoutViewKey,
    rankdir,
    sceneGraphData,
    sceneGroups,
    schema,
    flowConfig: flowConfigEffective,
    flowPresentation,
    layoutPositionsForMode,
    setLayoutPositionsForMode,
  })

  React.useEffect(() => {
    if (!active) return
    lastAppliedPositionsRef.current = null
  }, [active, cacheKey])

  const seededFallbackPositions = React.useMemo(() => {
    if (computedPositions) return null
    const g = sceneGraphData
    const nodes = Array.isArray(g?.nodes) ? (g!.nodes as GraphNode[]) : ([] as GraphNode[])
    if (nodes.length < 2) return null

    const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
    let finiteCount = 0
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    const seen = new Set<string>()
    for (let i = 0; i < nodes.length; i += 1) {
      const id = String(nodes[i]?.id || '').trim()
      if (!id || seen.has(id)) continue
      seen.add(id)
      const x = (nodes[i] as unknown as { x?: unknown }).x
      const y = (nodes[i] as unknown as { y?: unknown }).y
      if (!isFiniteNum(x) || !isFiniteNum(y)) continue
      finiteCount += 1
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }

    const spanX = maxX === -Infinity ? 0 : maxX - minX
    const spanY = maxY === -Infinity ? 0 : maxY - minY
    const looksCollapsed = finiteCount >= 2 && spanX < 1 && spanY < 1
    const shouldSeedAll = finiteCount < 2 || looksCollapsed

    const ids = nodes
      .map(n => String((n as unknown as { id?: unknown })?.id || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
    if (ids.length < 2) return null

    const gap = 48
    const cellW = Math.max(120, Math.floor(flowConfigEffective.node.widthPx + gap))
    const cellH = Math.max(120, Math.floor(flowConfigEffective.node.heightPx + gap))
    const aspect = viewportW / Math.max(1, viewportH)
    const idealCols = Math.ceil(Math.sqrt(Math.max(1, ids.length) * Math.max(0.45, aspect)))
    const maxCols = Math.max(1, Math.floor(Math.max(1, viewportW - 80) / Math.max(1, cellW)))
    const cols = Math.max(1, Math.min(maxCols, idealCols))
    const rows = Math.max(1, Math.ceil(ids.length / cols))
    const gridW = (cols - 1) * cellW
    const gridH = (rows - 1) * cellH

    const cx = viewportW / 2
    const cy = viewportH / 2
    const startX = cx - gridW / 2
    const startY = cy - gridH / 2

    const next: Record<string, { x: number; y: number }> = {}
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i]!
      if (!shouldSeedAll) {
        const n = nodes.find(nn => String((nn as unknown as { id?: unknown })?.id || '').trim() === id) || null
        const x0 = n ? (n as unknown as { x?: unknown }).x : null
        const y0 = n ? (n as unknown as { y?: unknown }).y : null
        if (isFiniteNum(x0) && isFiniteNum(y0)) continue
      }
      const col = i % cols
      const row = Math.floor(i / cols)
      next[id] = { x: startX + col * cellW, y: startY + row * cellH }
    }
    return Object.keys(next).length > 0 ? next : null
  }, [computedPositions, flowConfigEffective.node.heightPx, flowConfigEffective.node.widthPx, sceneGraphData, viewportH, viewportW])

  const graphDataForZoom = React.useMemo(() => {
    if (!sceneGraphData) return null
    const pos = computedPositions || seededFallbackPositions
    if (!pos) return sceneGraphData
    const nodes = Array.isArray(sceneGraphData.nodes) ? sceneGraphData.nodes : []
    const nextNodes = nodes.map(n => {
      const id = String(n.id || '')
      const p = id ? pos[id] : null
      if (!p) return n
      return { ...n, x: p.x, y: p.y }
    })
    return { ...sceneGraphData, nodes: nextNodes }
  }, [computedPositions, sceneGraphData, seededFallbackPositions])

  const nodesForFlowTransformGuard = React.useMemo(() => {
    const isFlowEditor = canvas2dRenderer === 'flowEditor'
    const base = (Array.isArray(graphDataForZoom?.nodes) ? graphDataForZoom!.nodes : []) as GraphNode[]
    if (!isFlowEditor) return base
    const pos = computedPositions || seededFallbackPositions
    if (!pos) return base
    const out: GraphNode[] = []
    for (let i = 0; i < base.length; i += 1) {
      const n = base[i]
      const id = String((n as unknown as { id?: unknown })?.id || '').trim()
      if (!id) continue
      const p = pos[id]
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
      out.push({ ...n, x: p.x, y: p.y })
    }
    return out
  }, [canvas2dRenderer, computedPositions, graphDataForZoom, seededFallbackPositions])

  const nodesForFlowZoom = React.useMemo(() => {
    const isFlowEditor = canvas2dRenderer === 'flowEditor'
    const baseForFit = (Array.isArray(graphDataForZoom?.nodes) ? graphDataForZoom!.nodes : []) as GraphNode[]
    const base = isFlowEditor ? nodesForFlowTransformGuard : baseForFit
    return coerceNodesForFit({
      nodes: base,
      coords: 'topLeft',
      defaultW: flowConfigEffective.node.widthPx,
      defaultH: flowConfigEffective.node.heightPx,
      setVisualRect: true,
    })
  }, [canvas2dRenderer, flowConfigEffective.node.heightPx, flowConfigEffective.node.widthPx, graphDataForZoom, nodesForFlowTransformGuard])

  const mediaPanelWorldSizeForFit = React.useMemo(() => {
    const density = mediaPanelDensity === 'compact' ? 'compact' : 'default'
    const widthRatioRaw = density === 'compact' ? threeIframeOverlayBaseWidthRatioCompact : threeIframeOverlayBaseWidthRatioDefault
    const widthRatio = Number.isFinite(widthRatioRaw) ? Math.max(0.001, Number(widthRatioRaw)) : 0.2
    const widthMinRaw = density === 'compact' ? threeIframeOverlayBaseWidthMinPxCompact : threeIframeOverlayBaseWidthMinPxDefault
    const widthMin = Number.isFinite(widthMinRaw) ? Math.max(1, Math.floor(widthMinRaw)) : 210
    const widthMaxRaw = density === 'compact' ? threeIframeOverlayBaseWidthMaxPxCompact : threeIframeOverlayBaseWidthMaxPxDefault
    const widthMax = Number.isFinite(widthMaxRaw) ? Math.max(1, Math.floor(widthMaxRaw)) : 360
    const sizing = computeMediaOverlaySizing({
      density,
      viewportW,
      zoomK: 1,
      config: { widthRatio, widthMinPx: widthMin, widthMaxPx: widthMax },
    })
    return { panelW: sizing.panelW, panelH: sizing.panelH }
  }, [
    mediaPanelDensity,
    threeIframeOverlayBaseWidthMaxPxCompact,
    threeIframeOverlayBaseWidthMaxPxDefault,
    threeIframeOverlayBaseWidthMinPxCompact,
    threeIframeOverlayBaseWidthMinPxDefault,
    threeIframeOverlayBaseWidthRatioCompact,
    threeIframeOverlayBaseWidthRatioDefault,
    viewportW,
  ])

  const nodesForFlowZoomCollective = React.useMemo(() => {
    if (!Array.isArray(nodesForFlowZoom) || nodesForFlowZoom.length === 0) return nodesForFlowZoom
    if (!Array.isArray(mediaNodes) || mediaNodes.length === 0) return nodesForFlowZoom
    const nodeById = new Map<string, GraphNode>()
    for (let i = 0; i < nodesForFlowZoom.length; i += 1) {
      const n = nodesForFlowZoom[i]
      const id = String(n?.id || '').trim()
      if (!id) continue
      nodeById.set(id, n)
    }
    const panelW = Math.max(2, Number(mediaPanelWorldSizeForFit.panelW) || 2)
    const panelH = Math.max(2, Number(mediaPanelWorldSizeForFit.panelH) || 2)
    const extras: GraphNode[] = []
    for (let i = 0; i < mediaNodes.length; i += 1) {
      const id = String(mediaNodes[i]?.id || '').trim()
      if (!id) continue
      const base = nodeById.get(id)
      if (!base) continue
      const x = typeof base.x === 'number' && Number.isFinite(base.x) ? base.x : null
      const y = typeof base.y === 'number' && Number.isFinite(base.y) ? base.y : null
      if (x == null || y == null) continue
      extras.push({
        id: `__fit_media_panel__:${id}`,
        type: 'MediaPanel',
        label: '',
        x,
        y,
        properties: {
          'visual:shape': 'rect',
          'visual:width': panelW,
          'visual:height': panelH,
        },
      })
    }
    return extras.length > 0 ? [...nodesForFlowZoom, ...extras] : nodesForFlowZoom
  }, [mediaNodes, mediaPanelWorldSizeForFit.panelH, mediaPanelWorldSizeForFit.panelW, nodesForFlowZoom])

  const flowEditorReservedW = React.useMemo(() => {
    if (canvas2dRenderer !== 'flowEditor') return 0
    const openCount = openQuickEditorNodeIds.length
    if (openCount <= 0) return 0
    const pinnedById = flowNodeQuickEditorPinnedByNodeId || {}
    let unpinnedCount = 0
    for (let i = 0; i < openQuickEditorNodeIds.length; i += 1) {
      const id = String(openQuickEditorNodeIds[i] || '').trim()
      if (!id) continue
      const v = pinnedById[id]
      const pinnedInCanvas = typeof v === 'boolean' ? v : true
      if (!pinnedInCanvas) unpinnedCount += 1
    }
    if (unpinnedCount <= 0) return 0

    const port = schema?.behavior?.portHandles || null
    const portEnabled = Boolean((port as { enabled?: unknown } | null)?.enabled)
    const portSizePx =
      typeof (port as { size?: unknown } | null)?.size === 'number' && Number.isFinite((port as { size: number }).size)
        ? Math.max(0, (port as { size: number }).size)
        : 4
    const portOffsetPx =
      typeof (port as { offset?: unknown } | null)?.offset === 'number' && Number.isFinite((port as { offset: number }).offset)
        ? Math.max(0, (port as { offset: number }).offset)
        : 2
    const portExtraPadPx = portEnabled ? Math.floor((portSizePx + portOffsetPx + 8) * 0.7) : 0

    const gapPx = (() => {
      const flow = schema?.layout?.flow
      const overlay = flow && typeof flow === 'object' ? (flow as { overlay?: { collisionGapPx?: unknown } }).overlay : null
      const raw = overlay ? overlay.collisionGapPx : null
      const base = typeof raw === 'number' && Number.isFinite(raw) ? raw : 12
      return Math.max(0, Math.min(40, Math.floor(base)))
    })()

    const marginLeft = 20
    const marginRight = 20
    const marginTop = 96
    const marginBottom = 24
    const cellW = NODE_QUICK_EDITOR_BASE_SIZE.width + gapPx + portExtraPadPx
    const cellH = Math.round(NODE_QUICK_EDITOR_BASE_SIZE.height * 0.76) + gapPx
    const rowsMax = Math.max(1, Math.floor((viewportH - marginTop - marginBottom) / Math.max(1, cellH)))
    const colsNeeded = Math.max(1, Math.ceil(unpinnedCount / rowsMax))
    const colsMax = Math.max(1, Math.min(3, Math.floor((viewportW - marginLeft - marginRight) / Math.max(1, cellW))))
    const cols = Math.max(1, Math.min(colsNeeded, colsMax))
    const dockWidth = cols * cellW - gapPx
    const raw = dockWidth + marginRight + 12
    return Math.max(0, Math.min(Math.floor(viewportW * 0.72), Math.floor(raw)))
  }, [
    canvas2dRenderer,
    flowNodeQuickEditorPinnedByNodeId,
    openQuickEditorNodeIds,
    schema?.behavior?.portHandles,
    schema?.layout?.flow,
    viewportH,
    viewportW,
  ])

  const graphDataForZoomRequests = React.useMemo(() => {
    if (!graphDataForZoom) return null
    return { ...graphDataForZoom, nodes: nodesForFlowZoomCollective }
  }, [graphDataForZoom, nodesForFlowZoomCollective])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime) return
    if (canvas2dRenderer !== 'flowEditor') {
      setFlowAutoMinScale(runtime, null)
      return
    }
    const nodes = nodesForFlowZoom
    if (!Array.isArray(nodes) || nodes.length === 0) {
      setFlowAutoMinScale(runtime, null)
      return
    }
    const mode = readLayoutMode(schema)
    const opts = readFitAllOptions({ schema, mode, intent: 'fitToView' })
    if (documentSemanticMode === 'document') {
      opts.detectClusters = false
      opts.includeGroupsBounds = true
      opts.deriveGroupsOptions = { forceDocumentStructure: true }
      opts.schema = {
        ...schema,
        layout: {
          ...(schema?.layout || {}),
          groups: {
            ...(schema?.layout?.groups || {}),
            enabled: true,
          },
        },
      } as GraphSchema
    }
    const fitW = Math.max(1, viewportW - flowEditorReservedW)
    const port = schema?.behavior?.portHandles || null
    const portEnabled = Boolean((port as { enabled?: unknown } | null)?.enabled)
    const portSizePx =
      typeof (port as { size?: unknown } | null)?.size === 'number' && Number.isFinite((port as { size: number }).size)
        ? Math.max(0, (port as { size: number }).size)
        : 4
    const portOffsetPx =
      typeof (port as { offset?: unknown } | null)?.offset === 'number' && Number.isFinite((port as { offset: number }).offset)
        ? Math.max(0, (port as { offset: number }).offset)
        : 2
    const portExtraPadScreenPx = portEnabled ? portSizePx + portOffsetPx + 8 : 0

    const fit = fitFlowEditorPinnedQuickEditors({
      nodes,
      fitW,
      viewportH,
      viewportW,
      openQuickEditorNodeIds,
      pinnedById: flowNodeQuickEditorPinnedByNodeId || {},
      worldPosById: flowNodeQuickEditorWorldPosByNodeId || {},
      portExtraPadScreenPx,
      graphData: graphDataForZoomRequests,
      fitOpts: opts,
    })
    const k = typeof fit?.k === 'number' && Number.isFinite(fit.k) ? fit.k : null
    setFlowAutoMinScale(runtime, k != null && k > 0 ? k : null)
  }, [
    active,
    canvas2dRenderer,
    documentSemanticMode,
    flowEditorReservedW,
    flowNodeQuickEditorPinnedByNodeId,
    flowNodeQuickEditorWorldPosByNodeId,
    flowNodeQuickEditorPosByNodeId,
    graphDataForZoomRequests,
    nodesForFlowZoom,
    openQuickEditorNodeIds,
    schema,
    viewportH,
    viewportW,
  ])

  React.useEffect(() => {
    collisionSchemaRef.current = schema
    collisionGraphDataRef.current =
      graphDataForZoom && typeof graphDataForZoom === 'object'
        ? (graphDataForZoom as GraphData)
        : sceneGraphData && typeof sceneGraphData === 'object'
          ? (sceneGraphData as GraphData)
          : null
    collisionFlowConfigRef.current = flowConfigEffective
    collisionPresentationRef.current = flowPresentation
  }, [flowConfigEffective, flowPresentation, graphDataForZoom, schema, sceneGraphData])

  const requestCommit = useFlowRequestCommit({
    cacheKey,
    flowConfig: flowConfigEffective,
    flowPresentation,
    graphDataRevision,
    runtimeRef,
    graphDataForZoomRef: collisionGraphDataRef,
    schemaRef: collisionSchemaRef,
    disableRelaxOnCommit: canvas2dRenderer === 'flowEditor',
    setLayoutPositionsForMode,
    setZoomState,
    setZoomStateForKey,
    viewportW,
    viewportH,
    zoomViewKey,
    positionsDirtySinceCommitRef,
    lastCommittedPositionsRef,
    buildDrawArgs,
  })
  requestCommitRef.current = requestCommit

  const selectedIds = React.useMemo(() => {
    const set = new Set<string>()
    if (selectedNodeId) {
      const id = String(selectedNodeId || '').trim()
      if (id) set.add(id)
    }
    const ids = Array.isArray(selectedNodeIds) ? selectedNodeIds : []
    for (let i = 0; i < ids.length; i += 1) {
      const id = String(ids[i] || '').trim()
      if (id) set.add(id)
    }
    return Array.from(set)
  }, [selectedNodeId, selectedNodeIds])

  const applyArrange = React.useMemo(() => {
    return (action: ArrangeAction2d) => {
      if (!active) return
      if (selectedIds.length < 2) return
      const runtime = runtimeRef.current
      const scene = runtime?.scene
      if (!runtime || !scene) return
      const byId = scene.nodeById
      const refId = (() => {
        const a = String(selectedNodeId || '').trim()
        if (a && selectedIds.includes(a)) return a
        return selectedIds[0] || ''
      })()
      const grid = readSnapGridConfigFromSchema(schema)
      const gridSize = grid.enabled ? grid.size : 0
      const snap = (v: number) => (grid.enabled ? snapScalarToGrid(v, grid.size) : v)

      const items = selectedIds
        .map(id => {
          const n = byId.get(id)
          if (!n) return null
          const cx = n.x + n.width / 2
          const cy = n.y + n.height / 2
          return { id, cx, cy, w: n.width, h: n.height }
        })
        .filter(Boolean) as { id: string; cx: number; cy: number; w: number; h: number }[]
      if (items.length < 2) return
      const next = computeArrangeCenters({ action, items, refId, minSpacing: gridSize || 24 })
      for (let i = 0; i < items.length; i += 1) {
        const id = items[i]!.id
        const n = byId.get(id)
        const p = next[id]
        if (!n || !p) continue
        n.x = snap(p.cx - n.width / 2)
        n.y = snap(p.cy - n.height / 2)
      }
      runtime.dirty = true
      positionsDirtySinceCommitRef.current = true
      scheduleFlowDraw()
      requestCommit()
    }
  }, [active, buildDrawArgs, requestCommit, schema?.behavior?.snapGrid, scheduleFlowDraw, selectedIds, selectedNodeId])

  React.useEffect(() => {
    if (!active) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return
      const arrange = readArrangeShortcut(e)
      if (arrange) {
        e.preventDefault()
        applyArrange(arrange)
        return
      }
      if (selectedIds.length === 0) return
      const grid = readSnapGridConfigFromSchema(schema)
      const delta = readNudgeDelta({ e, snapGridEnabled: grid.enabled, snapGridSize: grid.size })
      if (!delta) return
      const runtime = runtimeRef.current
      const scene = runtime?.scene
      if (!runtime || !scene) return
      e.preventDefault()
      for (let i = 0; i < selectedIds.length; i += 1) {
        const id = selectedIds[i]!
        const n = scene.nodeById.get(id)
        if (!n) continue
        n.x += delta.dx
        n.y += delta.dy
      }
      runtime.dirty = true
      positionsDirtySinceCommitRef.current = true
      scheduleFlowDraw()
      requestCommit()
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true } as AddEventListenerOptions)
    }
  }, [active, applyArrange, buildDrawArgs, requestCommit, scheduleFlowDraw, schema?.behavior?.snapGrid, selectedIds])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime) return
    const pos = computedPositions
    if (!pos) return
    if (lastAppliedPositionsRef.current === pos) return
    lastAppliedPositionsRef.current = pos

    const scene = runtime.scene
    if (!scene) return
    let applied = 0
    for (let i = 0; i < scene.nodes.length; i += 1) {
      const n = scene.nodes[i]
      const p = pos[n.id]
      if (!p) continue
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
      n.x = p.x
      n.y = p.y
      applied += 1
    }
    if (applied > 0) runtime.positionsReady = true
    runtime.dirty = true
    scheduleFlowDraw()
    if (!cacheKey || typeof setLayoutPositionsForMode !== 'function') return
    lastCommittedPositionsRef.current = pos
  }, [active, buildDrawArgs, cacheKey, computedPositions, setLayoutPositionsForMode])

  React.useEffect(() => {
    if (!active) return
    const canvasEl = canvasRef.current
    if (!canvasEl) return
    if (runtimeRef.current) return
    const ctx = canvasEl.getContext('2d')
    if (!ctx) return
    runtimeRef.current = createFlowNativeRuntime({
      canvas: canvasEl,
      ctx,
      viewportW,
      viewportH,
      dpr,
      rankdir,
      initialTransform: d3.zoomIdentity,
    })
  }, [active, dpr, rankdir, viewportH, viewportW])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime) return
    setFlowNativeViewport(runtime, { viewportW, viewportH, dpr })
    const canvasEl = runtime.canvas
    const nextW = Math.max(1, Math.floor(viewportW * dpr))
    const nextH = Math.max(1, Math.floor(viewportH * dpr))
    const resized = canvasEl.width !== nextW || canvasEl.height !== nextH
    if (canvasEl.width !== nextW) canvasEl.width = nextW
    if (canvasEl.height !== nextH) canvasEl.height = nextH
    if (resized) runtime.dirty = true
    scheduleFlowDraw()
  }, [active, buildDrawArgs, dpr, viewportH, viewportW])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime) return
    if (!graphDataForZoom) return

    const isFlowEditor = canvas2dRenderer === 'flowEditor'
    const effectiveFitToScreenMode = fitToScreenMode
    const effectiveZoomToSelectionMode = zoomToSelectionMode

    const nodesForTransformGuard = nodesForFlowTransformGuard
    const nodesForFit = nodesForFlowZoomCollective

    if (documentSemanticMode === 'keyword') {
      const meta = (sceneGraphData?.metadata || null) as Record<string, unknown> | null
      if (meta && meta.pending === true) return
    }

    const initKey = zoomViewKey
    const alreadyInitializedForKey = lastInitTransformZoomViewKeyRef.current === initKey
    const t0 = runtime.transform || d3.zoomIdentity
    const hasNonIdentityTransform = t0.k !== 1 || t0.x !== 0 || t0.y !== 0
    if (isFlowEditor && alreadyInitializedForKey) return
    if (!isFlowEditor && alreadyInitializedForKey && hasNonIdentityTransform) return

    const now = Date.now()
    const lastInteraction = lastUserInteractionAtMsRef.current
    if (lastInteraction && now - lastInteraction < 500) return

    const st = useGraphStore.getState()
    const z = pickZoomStateForView({
      zoomViewKey,
      zoomStateByKey: st.zoomStateByKey,
      viewPinned,
      fitToScreenMode: effectiveFitToScreenMode,
      zoomToSelectionMode: effectiveZoomToSelectionMode,
    })
    const initial = pickInitialZoomTransform({
      zoomState: z,
      pinned: viewPinned,
      graphDataRevision,
      nextViewportW: viewportW,
      nextViewportH: viewportH,
    })
    const schema = useGraphStore.getState().schema
    const mode = readLayoutMode(schema)
    const opts = readFitAllOptions({ schema, mode, intent: effectiveFitToScreenMode ? 'fitToScreen' : 'initialFit' })

    // In Document Structure Mode, enforce collective fit + center by disabling cluster detection
    // and ensuring groups are included in the bounds calculation.
    if (documentSemanticMode === 'document') {
      opts.detectClusters = false
      opts.includeGroupsBounds = true
      opts.deriveGroupsOptions = { forceDocumentStructure: true }
      // Force enable groups in the schema copy passed to fitAllTransform so it calculates their bounds
      // even if the base schema has them disabled.
      opts.schema = {
        ...schema,
        layout: {
          ...(schema?.layout || {}),
          groups: {
            ...(schema?.layout?.groups || {}),
            enabled: true,
          },
        },
      } as GraphSchema
    }

    if (isFlowEditor && nodesForTransformGuard.length === 0) return

    const fitW = Math.max(1, viewportW - (isFlowEditor ? flowEditorReservedW : 0))
    const fit = isFlowEditor
      ? (() => {
          const port = schema?.behavior?.portHandles || null
          const portEnabled = Boolean((port as { enabled?: unknown } | null)?.enabled)
          const portSizePx =
            typeof (port as { size?: unknown } | null)?.size === 'number' && Number.isFinite((port as { size: number }).size)
              ? Math.max(0, (port as { size: number }).size)
              : 4
          const portOffsetPx =
            typeof (port as { offset?: unknown } | null)?.offset === 'number' && Number.isFinite((port as { offset: number }).offset)
              ? Math.max(0, (port as { offset: number }).offset)
              : 2
          const portExtraPadScreenPx = portEnabled ? portSizePx + portOffsetPx + 8 : 0
          return fitFlowEditorPinnedQuickEditors({
            nodes: nodesForFit,
            fitW,
            viewportH,
            viewportW,
            openQuickEditorNodeIds,
            pinnedById: flowNodeQuickEditorPinnedByNodeId || {},
            worldPosById: flowNodeQuickEditorWorldPosByNodeId || {},
            portExtraPadScreenPx,
            graphData: graphDataForZoomRequests,
            fitOpts: opts,
          })
        })()
      : fitAllTransform(nodesForFit, fitW, viewportH, { ...opts, graphData: graphDataForZoomRequests || undefined })
    const fallbackInitial =
      !initial && !effectiveFitToScreenMode && !effectiveZoomToSelectionMode && hasNonIdentityTransform
        ? { k: t0.k, x: t0.x, y: t0.y }
        : null
    const seeded = initial || fallbackInitial
    const centered = (() => {
      if (effectiveFitToScreenMode || effectiveZoomToSelectionMode) return null
      if (!nodesForFit || nodesForFit.length === 0) return null
      if (isFlowEditor) {
        const zoomK = 1
        const targetSx = fitW / 2
        const targetSy = viewportH / 2

        let sumX = 0
        let sumY = 0
        let count = 0
        for (let i = 0; i < nodesForFit.length; i += 1) {
          const n = nodesForFit[i] as unknown as { x?: unknown; y?: unknown }
          const x = typeof n?.x === 'number' && Number.isFinite(n.x) ? (n.x as number) : null
          const y = typeof n?.y === 'number' && Number.isFinite(n.y) ? (n.y as number) : null
          if (x == null || y == null) continue
          sumX += x
          sumY += y
          count += 1
        }
        const openIds = openQuickEditorNodeIds || []
        const pinnedById = flowNodeQuickEditorPinnedByNodeId || {}
        const worldById = flowNodeQuickEditorWorldPosByNodeId || {}
        const panelScale = computeNodeQuickEditorScale(zoomK, null, { mode: 'pinnedInCanvas' })
        const panelScreen = computeNodeQuickEditorScaledSize(panelScale)
        const panelWorldW = panelScreen.width / Math.max(0.001, zoomK)
        const panelWorldH = panelScreen.height / Math.max(0.001, zoomK)
        for (let i = 0; i < openIds.length; i += 1) {
          const id = String(openIds[i] || '').trim()
          if (!id) continue
          const v = pinnedById[id]
          const pinned = typeof v === 'boolean' ? v : true
          if (!pinned) continue
          const wp = worldById[id]
          if (!wp || !Number.isFinite(wp.x) || !Number.isFinite(wp.y)) continue
          sumX += wp.x + panelWorldW / 2
          sumY += wp.y + panelWorldH / 2
          count += 1
        }
        if (count <= 0) return null
        const cx = sumX / count
        const cy = sumY / count
        return { k: zoomK, x: targetSx - cx * zoomK, y: targetSy - cy * zoomK }
      }

      const t = fitAllTransform(nodesForFit, fitW, viewportH, {
        ...opts,
        graphData: graphDataForZoomRequests || undefined,
        minScale: 1,
        maxScale: 1,
        maxScaleHardCap: 1,
        enforceAspectRatio: false,
        useCentroidCentering: true,
        centerMode: 'centroid',
      })
      return { k: t.k, x: t.x, y: t.y }
    })()
    const next = (() => {
      if (!seeded) return centered ? d3.zoomIdentity.translate(centered.x, centered.y).scale(centered.k) : fit
      const candidate = d3.zoomIdentity.translate(seeded.x, seeded.y).scale(seeded.k)
      if (isFlowEditor) return candidate
      const ok = isFlowTransformShowingGraph(
        { k: candidate.k, x: candidate.x, y: candidate.y },
        { nodes: nodesForTransformGuard as Array<{ x?: unknown; y?: unknown }>, viewportW, viewportH, nodeW: flowConfigEffective.node.widthPx, nodeH: flowConfigEffective.node.heightPx },
      )
      return ok ? candidate : fit
    })()

    lastInitTransformZoomViewKeyRef.current = initKey
    const curT = runtime.transform || d3.zoomIdentity
    const changed = Math.abs(curT.k - next.k) > 1e-9 || Math.abs(curT.x - next.x) > 1e-6 || Math.abs(curT.y - next.y) > 1e-6
    if (changed) {
      setFlowNativeTransform(runtime, next)
    }
    requestCommit()
  }, [
    active,
    canvas2dRenderer,
    datasetKey,
    fitToScreenMode,
    flowConfigEffective.node.heightPx,
    flowConfigEffective.node.widthPx,
    flowConfig.node.heightPx,
    flowConfig.node.widthPx,
    graphDataForZoom,
    graphDataForZoomRequests,
    graphDataRevision,
    requestCommit,
    viewportH,
    viewportW,
    viewPinned,
    zoomToSelectionMode,
    zoomViewKey,
    nodesForFlowTransformGuard,
    nodesForFlowZoomCollective,
    documentSemanticMode,
    sceneGraphData,
    flowEditorReservedW,
  ])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime) return
    if (!zoomRequest) return
    const isFlowEditor = canvas2dRenderer === 'flowEditor'
    const widthEffective =
      isFlowEditor && (zoomRequest.type === 'fit' || zoomRequest.type === 'reset')
        ? Math.max(1, viewportW - flowEditorReservedW)
        : viewportW
    applyZoomRequestNative({
      zoomRequest,
      runtime,
      graphData: graphDataForZoomRequests,
      width: widthEffective,
      height: viewportH,
      selectedNodeId: selectedNodeId ? String(selectedNodeId) : null,
      selectedEdgeId: selectedEdgeId ? String(selectedEdgeId) : null,
      selectedNodeIds: (selectedNodeIds || []).map(v => String(v)),
      selectedEdgeIds: (selectedEdgeIds || []).map(v => String(v)),
      onFrame: () => {
        scheduleFlowDraw()
        requestCommit()
        handleInteractionFrame()
      },
    })
  }, [
    active,
    buildDrawArgs,
    canvas2dRenderer,
    graphDataForZoomRequests,
    handleInteractionFrame,
    flowEditorReservedW,
    requestCommit,
    selectedEdgeId,
    selectedEdgeIds,
    selectedNodeId,
    selectedNodeIds,
    viewportH,
    viewportW,
    zoomRequest,
  ])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime) return
    const g = sceneGraphData
    const nodeList = Array.isArray(g?.nodes) ? g?.nodes : []
    const edgeList = Array.isArray(g?.edges) ? g?.edges : []
    const portHandlesCfg = (schema?.behavior?.portHandles || null) as { enabled?: unknown; showAllInputs?: unknown } | null
    const portHandlesEnabled = !!portHandlesCfg?.enabled
    const portHandlesShowAllInputs = !!portHandlesCfg?.showAllInputs
    const portHandlesKey = `${portHandlesEnabled ? 1 : 0}:${portHandlesShowAllInputs ? 1 : 0}`
    const graphKey = `${graphDataRevision}:${nodeList.length}:${edgeList.length}:${buildGraphMetaKeyIgnoringPending(g)}:${layoutVariant}:${portHandlesKey}`
    if (graphKey === lastBuiltGraphKeyRef.current && (runtime.scene?.nodes.length || 0) > 0) return
    lastBuiltGraphKeyRef.current = graphKey
    __flowCanvasDebug.lastBuiltSceneKey = graphKey
    runtime.positionsReady = computedPositions != null
    const res = buildAndSetFlowNativeScene({
      runtime,
      graphData: sceneGraphData,
      positions: computedPositions || seededFallbackPositions,
      schema,
      forbidCircleNodes,
      flowConfig: flowConfigEffective,
      sceneGroups,
      rankdir,
      nodeQuickEditorRegistry,
    })
    __flowCanvasDebug.lastBuiltSceneNodeCount = res.nodeCount
    scheduleFlowDraw()
  }, [
    active,
    buildDrawArgs,
    computedPositions,
    seededFallbackPositions,
    flowConfigEffective,
    forbidCircleNodes,
    graphDataRevision,
    layoutVariant,
    rankdir,
    sceneGraphData,
    sceneGroups,
    schema,
    nodeQuickEditorRegistry,
  ])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime) return
    setFlowNativePresentation(runtime, flowPresentation)
    scheduleFlowDraw()
  }, [active, buildDrawArgs, flowPresentation])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    const canvasEl = canvasRef.current
    if (!runtime || !canvasEl) return
    const selectionOnDrag = canvas2dRenderer === 'flowEditor' && flowEditorSelectionOnDrag === true
    const effectiveCollisionDuringDrag = computeCollisionDuringDrag({
      collisionDuringDrag: collisionDuringDrag === true,
      canvas2dRenderer: String(canvas2dRenderer || ''),
    })
    return bindFlowCanvasNativeInteractions({
      active,
      canvasEl,
      runtime,
      viewportControlsPreset,
      selectionOnDrag,
      allowNodeDragOverride,
      collisionDuringDrag: effectiveCollisionDuringDrag,
      requestCommit,
      buildDrawArgs,
      setSelectionBox: requestSetSelectionBox,
      onInteractionFrame: handleInteractionFrame,
      dragRef,
      lastPointerInCanvasRef,
      lastWheelIntentRef,
      zoomWheelGuardRef,
      userSelectLockPointerIdRef,
      positionsDirtySinceCommitRef,
      collisionSchemaRef,
      collisionGraphDataRef,
      collisionFlowConfigRef,
      collisionPresentationRef,
    })
  }, [
    active,
    allowNodeDragOverride,
    buildDrawArgs,
    canvas2dRenderer,
    collisionDuringDrag,
    flowEditorSelectionOnDrag,
    handleInteractionFrame,
    requestCommit,
    requestSetSelectionBox,
    viewportControlsPreset,
  ])

  return (
    <section ref={containerRef} className={CANVAS_SURFACE_CLASS}>
      {active && selectedIds.length >= 2 ? (
        <div className="pointer-events-none absolute right-3 top-3 z-50 flex flex-wrap gap-1 rounded-md border border-[var(--kg-border)] bg-[var(--kg-panel-bg)] p-2 text-xs text-[var(--kg-text)] shadow">
          <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('align-left')}>
            Align L
          </button>
          <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('align-center-x')}>
            Align CX
          </button>
          <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('align-right')}>
            Align R
          </button>
          <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('align-top')}>
            Align T
          </button>
          <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('align-center-y')}>
            Align CY
          </button>
          <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('align-bottom')}>
            Align B
          </button>
          <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('distribute-x')}>
            Dist X
          </button>
          <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => applyArrange('distribute-y')}>
            Dist Y
          </button>
        </div>
      ) : null}
      <canvas
        ref={canvasRef}
        aria-label="Flow renderer"
        data-kg-canvas-interactive="1"
        className={CANVAS_INTERACTIVE_CLASS}
        draggable={false}
      />
      {active && mediaNodes.length > 0 ? (
        <section aria-label="Flow media overlay" className="absolute inset-0 z-[80] pointer-events-none">
          {mediaNodes.map(n => {
            return (
              <RichMediaPanel
                key={n.id}
                ref={(el) => {
                  if (!el) {
                    mediaOverlayElsRef.current.delete(n.id)
                    return
                  }
                  mediaOverlayElsRef.current.set(n.id, el)
                }}
                data-kg-canvas-wheel-ignore="true"
                data-kg-canvas-pointer-ignore="true"
                className="absolute left-0 top-0 pointer-events-auto"
                title={n.title}
                url={n.url}
                openUrl={n.openUrl}
                kind={n.kind}
                interactive={n.interactive}
                iframeMode="srcdoc-when-needed"
                forwardWheelTo={() => canvasRef.current}
                onOverlayPanStart={({ pointerId, buttons }) => {
                  if ((buttons & 1) !== 1 && (buttons & 4) !== 4) return
                  startMediaOverlayPan({ pointerId })
                }}
                onOverlayPan={({ pointerId, dx, dy }) => moveMediaOverlayPan({ pointerId, dx, dy })}
                onOverlayPanEnd={({ pointerId }) => endMediaOverlayPan({ pointerId })}
                onHeaderDragStart={({ pointerId }) => beginMediaOverlayHeaderDrag(n.id, pointerId)}
                onHeaderDrag={({ dx, dy, pointerId }) => moveMediaOverlayHeaderDrag(n.id, { pointerId, dx, dy })}
                onHeaderDragEnd={({ pointerId }) => endMediaOverlayHeaderDrag(n.id, pointerId)}
                style={{
                  transform: 'translate(-99999px, -99999px)',
                  width: 1,
                  height: 1,
                }}
                onWheelCapture={stopEvent}
                onClickCapture={stopEvent}
                onDoubleClickCapture={stopEvent}
                onContextMenuCapture={stopEvent}
              />
            )
          })}
        </section>
      ) : null}
      {selectionBox && (
        <section
          aria-hidden={true}
          className="absolute pointer-events-none border border-[var(--kg-canvas-node-selected)] bg-[color-mix(in_srgb,var(--kg-canvas-node-selected)_15%,transparent)]"
          style={{ left: selectionBox.left, top: selectionBox.top, width: selectionBox.width, height: selectionBox.height }}
        />
      )}
    </section>
  )
}
