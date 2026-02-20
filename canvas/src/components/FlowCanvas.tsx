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
import { fitAllTransform } from '@/components/GraphCanvas/fit'
import { buildZoomViewKey } from '@/components/GraphCanvas/zoomViewKey'
import { pickInitialZoomTransform } from '@/lib/zoom/viewport'
import { pickZoomStateForView } from '@/lib/canvas/zoom-effective'
import { buildFlowEditorCameraInitKey } from '@/lib/canvas/flow-editor-init-key'
import { readFlowConfig } from '@/components/FlowCanvas/config'
import { buildAndSetFlowNativeScene } from '@/components/FlowCanvas/buildNativeScene'
import { buildGraphMetaKey, deriveRankdir } from '@/components/FlowCanvas/layout'
import { isFlowTransformShowingGraph } from '@/components/FlowCanvas/transformGuards'
import { deriveSceneGroups } from '@/lib/scene/sceneDerivation'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { useAutoZoomModes2d } from '@/features/zoom/useAutoZoomModes2d'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import { buildSchemaLayoutEngineJson2d } from '@/lib/canvas/schema-layout-engine-json'
import { buildCollapsedGroupIdsKey } from '@/lib/canvas/collapsedGroupIdsKey'
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
import { bindFlowCanvasNativeInteractions, type FlowCanvasDrag } from '@/components/FlowCanvas/bindNativeInteractions'
import { __flowCanvasDebug } from '@/components/FlowCanvas/flowCanvasDebug'
import { extractNodePositions } from '@/components/FlowCanvas/seedPositions'
import { useFlowComputedPositions } from '@/components/FlowCanvas/useFlowComputedPositions'
import { readFlowPresentation } from '@/components/FlowCanvas/presentation'
import { useFlowRequestCommit } from '@/components/FlowCanvas/useFlowRequestCommit'
import { computeCollisionDuringDrag } from '@/components/FlowCanvas/collisionPolicy'
import { CANVAS_INTERACTIVE_CLASS, CANVAS_SURFACE_CLASS } from '@/lib/canvas/surface'

export { __flowCanvasDebug, extractNodePositions }

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
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime) return
    runtime.dirty = true
    requestFlowNativeDraw(runtime, buildDrawArgs())
  }, [active, hideNodeIds, hidePortHandleNodeIds, hideSelectedNodeGlyph, hideSelectedNodePortHandles, renderEdges, renderGroups, renderNodes, selectedEdgeId, selectedEdgeIds, selectedNodeId, selectedNodeIds])

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
    schema,
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
      graphMetaKey: buildGraphMetaKey(sceneGraphData),
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
  const layoutMode = schema ? readLayoutMode(schema) : 'force'

  const flowPresentation = React.useMemo(() => {
    return readFlowPresentation(schema)
  }, [schema])

  const layoutVariant = React.useMemo(() => {
    return [
      `e=${flowConfig.engine}`,
      `rd=${rankdir}`,
      `dir=${flowConfig.elk.direction}`,
      `alg=${flowConfig.elk.algorithm}`,
      `n=${flowConfig.node.widthPx}x${flowConfig.node.heightPx}`,
      `s=${flowConfig.elk.nodeNodeSpacingPx},${flowConfig.elk.layerSpacingPx},${flowConfig.elk.edgeNodeSpacingPx}`,
      `h=${flowConfig.handle.sizePx},${flowConfig.handle.lineHeightPx}`,
    ].join('|')
  }, [flowConfig, rankdir])

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
    layoutMode,
    layoutVariant,
    documentSemanticMode: String(documentSemanticMode || 'document'),
    effectiveFrontmatter,
    layoutViewKey,
    rankdir,
    sceneGraphData,
    sceneGroups,
    schema,
    flowConfig,
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

  React.useEffect(() => {
    collisionSchemaRef.current = schema
    collisionGraphDataRef.current =
      graphDataForZoom && typeof graphDataForZoom === 'object'
        ? (graphDataForZoom as GraphData)
        : sceneGraphData && typeof sceneGraphData === 'object'
          ? (sceneGraphData as GraphData)
          : null
    collisionFlowConfigRef.current = flowConfig
    collisionPresentationRef.current = flowPresentation
  }, [flowConfig, flowPresentation, graphDataForZoom, schema, sceneGraphData])

  const requestCommit = useFlowRequestCommit({
    cacheKey,
    flowConfig,
    flowPresentation,
    graphDataRevision,
    runtimeRef,
    graphDataForZoomRef: collisionGraphDataRef,
    schemaRef: collisionSchemaRef,
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
    requestFlowNativeDraw(runtime, buildDrawArgs())
    if (!cacheKey || typeof setLayoutPositionsForMode !== 'function') return
    lastCommittedPositionsRef.current = pos
  }, [active, cacheKey, computedPositions, setLayoutPositionsForMode])

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
    requestFlowNativeDraw(runtime, buildDrawArgs())
  }, [active, dpr, viewportH, viewportW])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime) return
    if (!graphDataForZoom) return
    if (!computedPositions) return

    const isFlowEditor = canvas2dRenderer === 'flowEditor'
    const effectiveFitToScreenMode = isFlowEditor ? false : fitToScreenMode
    const effectiveZoomToSelectionMode = isFlowEditor ? false : zoomToSelectionMode

    const nodesForTransformGuard = (() => {
      const base = Array.isArray(graphDataForZoom.nodes) ? graphDataForZoom.nodes : []
      if (!isFlowEditor) return base as GraphNode[]
      const pos = computedPositions
      if (!pos) return []
      const out: GraphNode[] = []
      for (let i = 0; i < base.length; i += 1) {
        const n = base[i] as GraphNode
        const id = String((n as { id?: unknown })?.id || '').trim()
        if (!id) continue
        const p = pos[id]
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
        out.push({ ...n, x: p.x, y: p.y })
      }
      return out
    })()

    const nodesForFit = (() => {
      const baseForFit = (Array.isArray(graphDataForZoom.nodes) ? graphDataForZoom.nodes : []) as GraphNode[]
      const w = flowConfig.node.widthPx
      const h = flowConfig.node.heightPx
      if (!isFlowEditor) {
        const out: GraphNode[] = []
        for (let i = 0; i < baseForFit.length; i += 1) {
          const n = baseForFit[i] as GraphNode
          const x = typeof n.x === 'number' && Number.isFinite(n.x) ? (n.x as number) : null
          const y = typeof n.y === 'number' && Number.isFinite(n.y) ? (n.y as number) : null
          if (x == null || y == null) {
            out.push(n)
            continue
          }
          const props = (n.properties || {}) as Record<string, unknown>
          out.push({
            ...n,
            x: x + w / 2,
            y: y + h / 2,
            properties: {
              ...props,
              'visual:width': w,
              'visual:height': h,
              'visual:shape': 'rect',
            } as unknown as GraphNode['properties'],
          })
        }
        return out
      }
      const base = nodesForTransformGuard
      const out: GraphNode[] = []
      for (let i = 0; i < base.length; i += 1) {
        const n = base[i]
        const props = (n.properties || {}) as Record<string, unknown>
        out.push({
          ...n,
          x: (n.x as number) + w / 2,
          y: (n.y as number) + h / 2,
          properties: {
            ...props,
            'visual:width': w,
            'visual:height': h,
            'visual:shape': 'rect',
          } as unknown as GraphNode['properties'],
        })
      }
      return out
    })()

    const initKey = isFlowEditor
      ? buildFlowEditorCameraInitKey({ datasetKey: String(datasetKey || ''), graphData: sceneGraphData as GraphData | null })
      : zoomViewKey
    const alreadyInitializedForKey = lastInitTransformZoomViewKeyRef.current === initKey
    const t0 = runtime.transform || d3.zoomIdentity
    const hasNonIdentityTransform = t0.k !== 1 || t0.x !== 0 || t0.y !== 0
    if (isFlowEditor && alreadyInitializedForKey) {
      const ok = isFlowTransformShowingGraph(
        { k: t0.k, x: t0.x, y: t0.y },
        { nodes: nodesForTransformGuard as Array<{ x?: unknown; y?: unknown }>, viewportW, viewportH, nodeW: flowConfig.node.widthPx, nodeH: flowConfig.node.heightPx },
      )
      if (ok) return
    }
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
    if (isFlowEditor && nodesForTransformGuard.length === 0) return

    const fit = fitAllTransform(nodesForFit, viewportW, viewportH, opts)
    const next = (() => {
      if (!initial) return fit
      const candidate = d3.zoomIdentity.translate(initial.x, initial.y).scale(initial.k)
      const ok = isFlowTransformShowingGraph(
        { k: candidate.k, x: candidate.x, y: candidate.y },
        { nodes: nodesForTransformGuard as Array<{ x?: unknown; y?: unknown }>, viewportW, viewportH, nodeW: flowConfig.node.widthPx, nodeH: flowConfig.node.heightPx },
      )
      return ok ? candidate : fit
    })()

    lastInitTransformZoomViewKeyRef.current = initKey
    setFlowNativeTransform(runtime, next)
    requestCommit()
  }, [
    active,
    datasetKey,
    fitToScreenMode,
    flowConfig.node.heightPx,
    flowConfig.node.widthPx,
    graphDataForZoom,
    graphDataRevision,
    isFlowTransformShowingGraph,
    lastUserInteractionAtMsRef,
    requestCommit,
    viewportH,
    viewportW,
    viewPinned,
    zoomToSelectionMode,
    zoomViewKey,
    computedPositions,
  ])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime) return
    if (!zoomRequest) return
    applyZoomRequestNative({
      zoomRequest,
      runtime,
      graphData: graphDataForZoom,
      width: viewportW,
      height: viewportH,
      selectedNodeId: selectedNodeId ? String(selectedNodeId) : null,
      selectedEdgeId: selectedEdgeId ? String(selectedEdgeId) : null,
      selectedNodeIds: (selectedNodeIds || []).map(v => String(v)),
      selectedEdgeIds: (selectedEdgeIds || []).map(v => String(v)),
      onFrame: () => {
        requestFlowNativeDraw(runtime, buildDrawArgs())
        requestCommit()
        handleInteractionFrame()
      },
    })
  }, [
    active,
    buildDrawArgs,
    graphDataForZoom,
    handleInteractionFrame,
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
    const graphKey = `${graphDataRevision}:${nodeList.length}:${edgeList.length}:${buildGraphMetaKey(g)}:${layoutVariant}:${portHandlesKey}`
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
      flowConfig,
      sceneGroups,
      rankdir,
      nodeQuickEditorRegistry,
    })
    __flowCanvasDebug.lastBuiltSceneNodeCount = res.nodeCount
    requestFlowNativeDraw(runtime, buildDrawArgs())
  }, [
    active,
    buildDrawArgs,
    computedPositions,
    flowConfig,
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
    requestFlowNativeDraw(runtime, buildDrawArgs())
  }, [active, flowPresentation])

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
    onInteractionFrame,
    requestCommit,
    requestSetSelectionBox,
    viewportControlsPreset,
  ])

  return (
    <section ref={containerRef} className={CANVAS_SURFACE_CLASS}>
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
