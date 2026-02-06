import React from 'react'
import * as d3 from 'd3'
import { useShallow } from 'zustand/react/shallow'

import { useGraphStore } from '@/hooks/useGraphStore'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { useContainerDims } from '@/hooks/useContainerDims'
import { readFitAllOptions, readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { buildLayoutPositionCacheKey, buildLayoutViewKey, computeLayoutDatasetKey } from '@/components/GraphCanvas/layout/positioning'
import { cloneGraphDataForRender } from '@/components/GraphCanvas/renderClone'
import { fitAllTransform } from '@/components/GraphCanvas/fit'
import { buildZoomViewKey } from '@/components/GraphCanvas/zoomViewKey'
import { pickInitialZoomTransform } from '@/lib/zoom/viewport'
import { readFlowConfig } from '@/components/FlowCanvas/config'
import { buildAndSetFlowNativeScene } from '@/components/FlowCanvas/buildNativeScene'
import { buildGraphMetaKey, deriveRankdir } from '@/components/FlowCanvas/layout'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import type { GraphData } from '@/lib/graph/types'
import { useAutoZoomModes2d } from '@/features/zoom/useAutoZoomModes2d'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import {
  createFlowNativeRuntime,
  requestFlowNativeDraw,
  setFlowNativePresentation,
  setFlowNativeTransform,
  setFlowNativeViewport,
  type FlowNativeRuntime,
} from '@/components/FlowCanvas/nativeRuntime'
import { createZoomWheelGuardState } from '@/lib/canvas/zoom-wheel-guard'
import { applyZoomRequestNative } from '@/components/FlowCanvas/applyZoomRequestNative'
import { bindFlowCanvasNativeInteractions, type FlowCanvasDrag } from '@/components/FlowCanvas/bindNativeInteractions'
import { __flowCanvasDebug } from '@/components/FlowCanvas/flowCanvasDebug'
import { extractNodePositions } from '@/components/FlowCanvas/seedPositions'
import { useFlowComputedPositions } from '@/components/FlowCanvas/useFlowComputedPositions'
import { readFlowPresentation } from '@/components/FlowCanvas/presentation'
import { useFlowRequestCommit } from '@/components/FlowCanvas/useFlowRequestCommit'

export { __flowCanvasDebug, extractNodePositions }

export default function FlowCanvas({
  active = true,
  graphDataOverride,
  graphDataRevisionOverride,
  collisionDuringDrag = false,
  allowNodeDragOverride,
  hideSelectedNodeGlyph = false,
  hideSelectedNodePortHandles,
  forbidCircleNodes = false,
}: {
  active?: boolean
  graphDataOverride?: GraphData | null
  graphDataRevisionOverride?: number
  collisionDuringDrag?: boolean
  allowNodeDragOverride?: boolean
  hideSelectedNodeGlyph?: boolean
  hideSelectedNodePortHandles?: boolean
  forbidCircleNodes?: boolean
}) {
  const containerRef = React.useRef<HTMLElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const runtimeRef = React.useRef<FlowNativeRuntime | null>(null)
  const lastBuiltGraphKeyRef = React.useRef<string>('')
  const lastAppliedZoomKeyRef = React.useRef<string | null>(null)
  const lastAppliedPositionsRef = React.useRef<Record<string, { x: number; y: number }> | null>(null)
  const lastCommittedPositionsRef = React.useRef<Record<string, { x: number; y: number }> | null>(null)
  const positionsDirtySinceCommitRef = React.useRef(false)
  const selectedNodeIdsRef = React.useRef<string[]>([])
  const selectedEdgeIdsRef = React.useRef<string[]>([])
  const drawArgsRef = React.useRef<{
    selectedNodeIds: string[]
    selectedEdgeIds: string[]
    hideNodeIds?: string[]
    hidePortHandleNodeIds?: string[]
  }>({
    selectedNodeIds: [],
    selectedEdgeIds: [],
    hideNodeIds: undefined,
    hidePortHandleNodeIds: undefined,
  })
  const lastPointerInCanvasRef = React.useRef<null | { sx: number; sy: number; ts: number }>(null)
  const lastWheelIntentRef = React.useRef<null | { dir: 'in' | 'out'; ts: number }>(null)
  const zoomWheelGuardRef = React.useRef(createZoomWheelGuardState())
  const userSelectLockPointerIdRef = React.useRef<number | null>(null)

  const buildDrawArgs = React.useCallback(
    () => drawArgsRef.current,
    [],
  )
  const collisionSchemaRef = React.useRef<typeof schema | null>(null)
  const collisionGraphDataRef = React.useRef<GraphData | null>(null)
  const collisionFlowConfigRef = React.useRef<typeof flowConfig | null>(null)
  const collisionPresentationRef = React.useRef<typeof flowPresentation | null>(null)
  const dragRef = React.useRef<FlowCanvasDrag>(null)
  const { width, height, dpr } = useContainerDims(containerRef)
  const viewportW = Math.max(1, Math.floor(width))
  const viewportH = Math.max(1, Math.floor(height))

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
    setLayoutPositionsForMode,
    graphDataRevision: baseGraphDataRevision,
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
    zoomRequest,
    viewPinned,
    setZoomState,
    setZoomStateForKey,
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
      setLayoutPositionsForMode: s.setLayoutPositionsForMode,
      graphDataRevision: s.graphDataRevision || 0,
      selectedNodeId: s.selectedNodeId,
      selectedEdgeId: s.selectedEdgeId,
      selectedNodeIds: s.selectedNodeIds,
      selectedEdgeIds: s.selectedEdgeIds,
      zoomRequest: s.zoomRequest,
      viewPinned: s.viewPinned === true,
      setZoomState: s.setZoomState,
      setZoomStateForKey: s.setZoomStateForKey,
    })),
  )

  const graphDataRevision = typeof graphDataRevisionOverride === 'number' ? graphDataRevisionOverride : baseGraphDataRevision

  React.useEffect(() => {
    const nextSelectedNodeIds = (selectedNodeIds || []).map(v => String(v))
    const nextSelectedEdgeIds = (selectedEdgeIds || []).map(v => String(v))
    selectedNodeIdsRef.current = nextSelectedNodeIds
    selectedEdgeIdsRef.current = nextSelectedEdgeIds
    drawArgsRef.current.selectedNodeIds = nextSelectedNodeIds
    drawArgsRef.current.selectedEdgeIds = nextSelectedEdgeIds
    drawArgsRef.current.hideNodeIds = hideSelectedNodeGlyph ? nextSelectedNodeIds : undefined
    drawArgsRef.current.hidePortHandleNodeIds = hideSelectedNodePortHandles ? nextSelectedNodeIds : undefined
  }, [hideSelectedNodeGlyph, hideSelectedNodePortHandles, selectedEdgeIds, selectedNodeIds])

  useAutoZoomModes2d({
    viewportW,
    viewportH,
    paused: !active,
  })

  const schemaLayoutEngineJson = React.useMemo(() => {
    const mode = schema ? readLayoutMode(schema) : 'force'
    const forces = schema?.layout?.forces || null
    const fitPadding = schema?.layout?.fitPadding ?? null
    return JSON.stringify({
      mode,
      forces,
      fitPadding,
      flow: schema?.layout?.flow || null,
    })
  }, [schema])

  const schemaNodesPresentationJson = React.useMemo(() => {
    return JSON.stringify({
      nodeShapeMode: schema?.behavior?.nodeShapeMode || 'auto',
      portHandles: schema?.behavior?.portHandles || null,
      nodeShapes: schema?.nodeShapes || null,
      allowNodeDrag: schema?.behavior?.allowNodeDrag !== false,
      hoverEnabled: schema?.behavior?.hover?.enabled !== false,
      expansion: schema?.behavior?.expansion || null,
      renderMediaAsNodes,
      mediaPanelDensity,
    })
  }, [
    mediaPanelDensity,
    renderMediaAsNodes,
    schema?.behavior?.allowNodeDrag,
    schema?.behavior?.expansion,
    schema?.behavior?.hover?.enabled,
    schema?.behavior?.nodeShapeMode,
    schema?.behavior?.portHandles,
    schema?.nodeShapes,
  ])

  const schemaGroupsPresentationJson = React.useMemo(() => {
    return JSON.stringify({
      groups: schema?.layout?.groups || null,
      labelStyles: schema?.labelStyles || null,
      nodeShapeMode: schema?.behavior?.nodeShapeMode || 'auto',
      portHandles: schema?.behavior?.portHandles || null,
    })
  }, [
    schema?.behavior?.nodeShapeMode,
    schema?.behavior?.portHandles,
    schema?.labelStyles,
    schema?.layout?.groups,
  ])

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
    const ids = Array.isArray(collapsedGroupIds) ? collapsedGroupIds : []
    const normalized = ids.map(x => String(x || '').trim()).filter(Boolean)
    if (normalized.length === 0) return ''
    normalized.sort((a, b) => a.localeCompare(b))
    return normalized.join('|')
  }, [collapsedGroupIds])

  const sceneGraphData = React.useMemo(() => {
    if (!renderGraphData) return null
    return cloneGraphDataForRender(renderGraphData)
  }, [renderGraphData])

  const layoutViewKey = React.useMemo(() => {
    const mode = schema ? readLayoutMode(schema) : 'force'
    const forces = schema?.layout?.forces || null
    const fitPadding = schema?.layout?.fitPadding ?? null
    const schemaLayoutEngineJson = JSON.stringify({
      mode,
      forces,
      fitPadding,
    })
    return buildLayoutViewKey({
      schemaLayoutEngineJson,
      frontmatterModeEnabled: effectiveFrontmatter,
      documentSemanticMode: String(documentSemanticMode),
      graphMetaKey: buildGraphMetaKey(sceneGraphData),
      renderMediaAsNodes: renderMediaAsNodes === true,
      mediaPanelDensity: String(mediaPanelDensity),
      collapsedGroupIdsKey,
      schemaNodesPresentationJson,
      schemaGroupsPresentationJson,
    })
  }, [
    collapsedGroupIdsKey,
    documentSemanticMode,
    effectiveFrontmatter,
    mediaPanelDensity,
    renderMediaAsNodes,
    schema,
    schemaGroupsPresentationJson,
    schemaNodesPresentationJson,
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
      schemaNodesPresentationJson,
      schemaGroupsPresentationJson,
    })
  }, [
    canvas2dRenderer,
    canvasRenderMode,
    collapsedGroupIdsKey,
    documentSemanticMode,
    effectiveFrontmatter,
    mediaPanelDensity,
    renderMediaAsNodes,
    schemaGroupsPresentationJson,
    schemaLayoutEngineJson,
    schemaNodesPresentationJson,
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

  const sceneGroups = React.useMemo(() => {
    if (!flowPresentation.groups.enabled) return []
    if (!sceneGraphData) return []
    return deriveGraphGroups(sceneGraphData as GraphData)
  }, [flowPresentation.groups.enabled, sceneGraphData])

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
    collisionGraphDataRef.current = graphDataForZoom && typeof graphDataForZoom === 'object' ? (graphDataForZoom as GraphData) : null
    collisionFlowConfigRef.current = flowConfig
    collisionPresentationRef.current = flowPresentation
  }, [flowConfig, flowPresentation, graphDataForZoom, schema])

  const requestCommit = useFlowRequestCommit({
    cacheKey,
    flowConfig,
    flowPresentation,
    graphDataForZoom,
    graphDataRevision,
    runtimeRef,
    schema,
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
    for (let i = 0; i < scene.nodes.length; i += 1) {
      const n = scene.nodes[i]
      const p = pos[n.id]
      if (!p) continue
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
      n.x = p.x
      n.y = p.y
    }
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
    if (canvasEl.width !== nextW) canvasEl.width = nextW
    if (canvasEl.height !== nextH) canvasEl.height = nextH
    requestFlowNativeDraw(runtime, buildDrawArgs())
  }, [active, dpr, viewportH, viewportW])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime) return
    if (!graphDataForZoom) return
    if (lastAppliedZoomKeyRef.current === zoomViewKey) return
    lastAppliedZoomKeyRef.current = zoomViewKey
    const st = useGraphStore.getState()
    const zForKey = zoomViewKey ? (st.zoomStateByKey?.[zoomViewKey] ?? null) : null
    const z = zForKey || st.zoomState
    const initial = pickInitialZoomTransform({
      zoomState: z,
      pinned: viewPinned,
      graphDataRevision,
      nextViewportW: viewportW,
      nextViewportH: viewportH,
    })
    if (initial) {
      setFlowNativeTransform(runtime, d3.zoomIdentity.translate(initial.x, initial.y).scale(initial.k))
      return
    }
    const schema = useGraphStore.getState().schema
    const mode = readLayoutMode(schema)
    const opts = readFitAllOptions({ schema, mode, intent: 'initialFit' })
    setFlowNativeTransform(runtime, fitAllTransform(graphDataForZoom.nodes, viewportW, viewportH, opts))
  }, [active, graphDataForZoom, graphDataRevision, viewportH, viewportW, viewPinned, zoomViewKey])

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
    })
    requestFlowNativeDraw(runtime, buildDrawArgs())
    requestCommit()
  }, [
    active,
    buildDrawArgs,
    graphDataForZoom,
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
    const graphKey = `${graphDataRevision}:${nodeList.length}:${edgeList.length}:${buildGraphMetaKey(g)}:${layoutVariant}:${schemaNodesPresentationJson}:${schemaGroupsPresentationJson}`
    if (graphKey === lastBuiltGraphKeyRef.current && (runtime.scene?.nodes.length || 0) > 0) return
    lastBuiltGraphKeyRef.current = graphKey
    __flowCanvasDebug.lastBuiltSceneKey = graphKey
    const res = buildAndSetFlowNativeScene({
      runtime,
      graphData: sceneGraphData,
      positions: computedPositions,
      schema,
      forbidCircleNodes,
      flowConfig,
      sceneGroups,
      rankdir,
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
    schemaGroupsPresentationJson,
    schemaNodesPresentationJson,
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
    return bindFlowCanvasNativeInteractions({
      active,
      canvasEl,
      runtime,
      allowNodeDragOverride,
      collisionDuringDrag,
      requestCommit,
      buildDrawArgs,
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
  }, [active, allowNodeDragOverride, buildDrawArgs, collisionDuringDrag, requestCommit])

  return (
    <section ref={containerRef} className="absolute inset-0 overscroll-none">
      <canvas
        ref={canvasRef}
        aria-label="Flow renderer"
        className="h-full w-full touch-none select-none"
        draggable={false}
      />
    </section>
  )
}
