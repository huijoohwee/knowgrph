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
import { computeEvenlyDistributedPositions } from '@/lib/canvas/evenDistribute'
import { isEditableTarget, readArrangeShortcut, readNudgeDelta } from '@/lib/canvas/arrangeShortcuts'
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
import { computeNodeQuickEditorScale, NODE_QUICK_EDITOR_BASE_SIZE } from '@/components/FlowEditor/nodeQuickEditorZoom'
import { computeNodeQuickEditorMaxAnchorShiftPx } from '@/components/FlowEditor/nodeQuickEditorLayout'
import { DEFAULT_FLOW_NODE_WIDTH_PX } from '@/lib/graph/layoutDefaults'
import type { GraphSchema } from '@/lib/graph/schema'

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
    hideNodeIds: undefined,
    hidePortHandleNodeIds: undefined,
    renderEdges: undefined,
    renderGroups: undefined,
    renderNodes: undefined,
  })
  const lastPointerInCanvasRef = React.useRef<null | { sx: number; sy: number; ts: number }>(null)
  const lastWheelIntentRef = React.useRef<null | { dir: 'in' | 'out'; ts: number }>(null)
  const zoomWheelGuardRef = React.useRef(createZoomWheelGuardState())
  const userSelectLockPointerIdRef = React.useRef<number | null>(null)

  const { width, height, dpr } = useContainerDims(containerRef)
  const viewportW = Math.max(1, Math.floor(width))
  const viewportH = Math.max(1, Math.floor(height))

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
      zoomRequest: s.zoomRequest,
      viewPinned: s.viewPinned === true,
      fitToScreenMode: s.fitToScreenMode === true,
      zoomToSelectionMode: s.zoomToSelectionMode === true,
      setZoomState: s.setZoomState,
      setZoomStateForKey: s.setZoomStateForKey,
      nodeQuickEditorRegistry: s.nodeQuickEditorRegistry || [],
      openQuickEditorNodeIds: s.openQuickEditorNodeIds || [],
      flowNodeQuickEditorPinnedByNodeId: s.flowNodeQuickEditorPinnedByNodeId || {},
      flowNodeQuickEditorWorldPosByNodeId: (s as unknown as { flowNodeQuickEditorWorldPosByNodeId?: Record<string, { x: number; y: number }> }).flowNodeQuickEditorWorldPosByNodeId || {},
      flowNodeQuickEditorPosByNodeId: s.flowNodeQuickEditorPosByNodeId || {},
    })),
  )

  const graphDataRevision = typeof graphDataRevisionOverride === 'number' ? graphDataRevisionOverride : baseGraphDataRevision

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
    const explicitHideNodeIds = (hideNodeIds || []).map(v => String(v)).filter(Boolean)
    const explicitHidePortHandleNodeIds = (hidePortHandleNodeIds || []).map(v => String(v)).filter(Boolean)
    drawArgsRef.current.hideNodeIds = hideSelectedNodeGlyph
      ? Array.from(new Set([...nextSelectedNodeIds, ...explicitHideNodeIds]))
      : explicitHideNodeIds.length > 0
        ? explicitHideNodeIds
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
    selectedEdgeId,
    selectedEdgeIds,
    selectedNodeId,
    selectedNodeIds,
    scheduleFlowDraw,
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

  const sceneGraphData = React.useMemo(() => {
    if (!renderGraphData) return null
    const cloned = cloneGraphDataForRender(renderGraphData)
    return deriveSceneDisplayGraph({ graphData: cloned as GraphData })?.displayGraphData || (cloned as GraphData)
  }, [renderGraphData])

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
    return p
  }, [documentSemanticMode, schema])

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
      graphData: sceneGraphData as GraphData | null,
      graphDataRevision,
      schema,
      documentSemanticMode: String(documentSemanticMode || ''),
      frontmatterModeEnabled: !!effectiveFrontmatter,
    })
  }, [documentSemanticMode, effectiveFrontmatter, graphDataRevision, sceneGraphData, schema])

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

  const graphDataForZoom = React.useMemo(() => {
    if (!sceneGraphData) return null
    const pos = computedPositions
    if (!pos) return sceneGraphData
    const nodes = Array.isArray(sceneGraphData.nodes) ? sceneGraphData.nodes : []
    const nextNodes = nodes.map(n => {
      const id = String(n.id || '')
      const p = id ? pos[id] : null
      if (!p) return n
      return { ...n, x: p.x, y: p.y }
    })
    return { ...sceneGraphData, nodes: nextNodes }
  }, [computedPositions, sceneGraphData])

  const nodesForFlowTransformGuard = React.useMemo(() => {
    const isFlowEditor = canvas2dRenderer === 'flowEditor'
    const base = (Array.isArray(graphDataForZoom?.nodes) ? graphDataForZoom!.nodes : []) as GraphNode[]
    if (!isFlowEditor) return base
    const pos = computedPositions
    if (!pos) return []
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
  }, [canvas2dRenderer, computedPositions, graphDataForZoom])

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
    return { ...graphDataForZoom, nodes: nodesForFlowZoom }
  }, [graphDataForZoom, nodesForFlowZoom])

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
    type Action =
      | 'align-left'
      | 'align-center-x'
      | 'align-right'
      | 'align-top'
      | 'align-center-y'
      | 'align-bottom'
      | 'distribute-x'
      | 'distribute-y'
    return (action: Action) => {
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
      const ref = refId ? byId.get(refId) : null
      if (!ref) return
      const grid = schema?.behavior?.snapGrid
      const gridSize = grid && grid.enabled && typeof grid.size === 'number' && Number.isFinite(grid.size) ? Math.max(4, Math.floor(grid.size)) : 0
      const snap = (v: number) => (gridSize ? Math.round(v / gridSize) * gridSize : v)

      if (action === 'distribute-x' || action === 'distribute-y') {
        const pts = selectedIds
          .map((id) => {
            const n = byId.get(id)
            if (!n) return null
            return { id, x: n.x + n.width / 2, y: n.y + n.height / 2 }
          })
          .filter(Boolean) as { id: string; x: number; y: number }[]
        if (pts.length < 3) return
        const next = computeEvenlyDistributedPositions({ nodes: pts, axis: action === 'distribute-x' ? 'x' : 'y', minSpacing: gridSize || 24 })
        for (let i = 0; i < pts.length; i += 1) {
          const id = pts[i]!.id
          const n = byId.get(id)
          const p = next[id]
          if (!n || !p) continue
          if (action === 'distribute-x') n.x = snap(p.x - n.width / 2)
          if (action === 'distribute-y') n.y = snap(p.y - n.height / 2)
        }
        runtime.dirty = true
        positionsDirtySinceCommitRef.current = true
        scheduleFlowDraw()
        requestCommit()
        return
      }

      for (let i = 0; i < selectedIds.length; i += 1) {
        const id = selectedIds[i]!
        const n = byId.get(id)
        if (!n) continue
        if (action === 'align-left') n.x = snap(ref.x)
        if (action === 'align-right') n.x = snap(ref.x + ref.width - n.width)
        if (action === 'align-center-x') n.x = snap(ref.x + ref.width / 2 - n.width / 2)
        if (action === 'align-top') n.y = snap(ref.y)
        if (action === 'align-bottom') n.y = snap(ref.y + ref.height - n.height)
        if (action === 'align-center-y') n.y = snap(ref.y + ref.height / 2 - n.height / 2)
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
      const grid = schema?.behavior?.snapGrid
      const gridSize =
        grid && grid.enabled && typeof grid.size === 'number' && Number.isFinite(grid.size) ? Math.max(4, Math.floor(grid.size)) : 1
      const delta = readNudgeDelta({ e, snapGridEnabled: !!grid?.enabled, snapGridSize: gridSize })
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
    if (!computedPositions) return

    const isFlowEditor = canvas2dRenderer === 'flowEditor'
    const effectiveFitToScreenMode = fitToScreenMode
    const effectiveZoomToSelectionMode = zoomToSelectionMode

    const nodesForTransformGuard = nodesForFlowTransformGuard
    const nodesForFit = nodesForFlowZoom

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
    const next = (() => {
      if (!seeded) return fit
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
    computedPositions,
    nodesForFlowTransformGuard,
    nodesForFlowZoom,
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
      positions: computedPositions,
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
