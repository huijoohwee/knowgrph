import React from 'react'
import * as d3 from 'd3'
import { useShallow } from 'zustand/react/shallow'

import { useGraphStore } from '@/hooks/useGraphStore'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { useContainerDims } from '@/hooks/useContainerDims'
import { readFitAllOptions, readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { buildLayoutPositionCacheKey, buildLayoutViewKey, computeLayoutDatasetKey } from '@/components/GraphCanvas/layout/positioning'
import { cloneGraphDataForRender } from '@/components/GraphCanvas/renderClone'
import { buildZoomViewKey } from '@/components/GraphCanvas/zoomViewKey'
import { pickInitialZoomTransform } from '@/components/GraphCanvas/zoomState'
import { readFlowConfig } from '@/components/FlowCanvas/config'
import { buildElkLayout } from '@/components/FlowCanvas/elkLayout'
import { computeFlowHandlesByNode, buildFlowHandleId } from '@/components/FlowCanvas/handles'
import { buildDagreLayout, buildFastGridLayout, buildGraphMetaKey, deriveRankdir } from '@/components/FlowCanvas/layout'
import { computeZoomSubset } from '@/components/GraphCanvas/selectionZoom'
import { centerAllTransform, fitAllTransform, scaleCenteredOnGraphCentroidTransform } from '@/components/GraphCanvas/fit'
import { DEFAULT_FLOW_DAGRE_MAX_NODES, DEFAULT_FLOW_ELK_MAX_NODES, readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import { getNodeRenderShape2d } from '@/components/GraphCanvas/nodeSizing2d'
import { getPortHandlesConfig } from '@/components/GraphCanvas/portHandlesConfig'
import type { ZoomRequest } from '@/lib/zoom/requests'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { isSameZoomState } from '@/lib/zoom/zoomStateEq'
import { useAutoZoomModes2d } from '@/features/zoom/useAutoZoomModes2d'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import {
  clampScale,
  createFlowNativeRuntime,
  hitTestGroup,
  hitTestNode,
  requestFlowNativeDraw,
  setFlowNativeRankdir,
  setFlowNativeScene,
  setFlowNativePresentation,
  setFlowNativeTransform,
  setFlowNativeViewport,
  type FlowNativeRuntime,
  type FlowNativeScene,
} from '@/components/FlowCanvas/nativeRuntime'
import type { FlowHandleId } from '@/components/FlowCanvas/handles'
import { pickSeedFromOtherRendererCache } from '@/components/FlowCanvas/seed'
import { relaxFlowPositionsWithCollision } from '@/components/FlowCanvas/relaxPositions'
import { readGroupLabelTopExtra } from '@/components/GraphCanvas/layout/collisionConfig'

export const __flowCanvasDebug: {
  lastBuiltSceneNodeCount: number
  lastBuiltSceneKey: string
  lastZoomViewKey: string
} = {
  lastBuiltSceneNodeCount: 0,
  lastBuiltSceneKey: '',
  lastZoomViewKey: '',
}

const applyZoomRequestNative = (args: {
  zoomRequest: ZoomRequest
  runtime: FlowNativeRuntime
  graphData: GraphData | null
  width: number
  height: number
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedNodeIds?: string[]
  selectedEdgeIds?: string[]
}) => {
  const schema = useGraphStore.getState().schema
  const mode = readLayoutMode(schema)
  const pinned = useGraphStore.getState().viewPinned === true
  const clear = () => {
    try {
      useGraphStore.getState().clearZoomRequest()
    } catch {
      void 0
    }
  }

  const type = args.zoomRequest.type
  if (pinned && type !== 'in' && type !== 'out') {
    clear()
    return
  }
  if (type === 'selection' && pinned) {
    clear()
    return
  }

  const w = Math.max(1, Math.floor(args.width))
  const h = Math.max(1, Math.floor(args.height))
  const t0 = args.runtime.transform || d3.zoomIdentity
  const [minScale, maxScale] = readZoomScaleExtent(schema)

  const computeFitTransform = (intent: 'fitToScreen' | 'initialFit' | 'fitToView' | 'fitSelection') => {
    if (!args.graphData) return null
    const opts = readFitAllOptions({ schema, mode, intent })
    return fitAllTransform(args.graphData.nodes, w, h, opts)
  }

  if (type === 'in') {
    const k2 = clampScale(t0.k * 1.2, { minK: minScale, maxK: maxScale })
    if (args.graphData && (args.graphData.nodes || []).length > 0) {
      setFlowNativeTransform(args.runtime, scaleCenteredOnGraphCentroidTransform(args.graphData.nodes, w, h, k2))
    } else {
      setFlowNativeTransform(args.runtime, d3.zoomIdentity.translate(t0.x, t0.y).scale(k2))
    }
    clear()
    return
  }

  if (type === 'out') {
    const autoMinScale = (() => {
      const fitT = computeFitTransform('fitToView')
      if (!fitT) return minScale
      return Math.min(minScale, fitT.k)
    })()
    const k2 = clampScale(t0.k / 1.2, { minK: autoMinScale, maxK: maxScale })
    if (args.graphData && (args.graphData.nodes || []).length > 0) {
      setFlowNativeTransform(args.runtime, scaleCenteredOnGraphCentroidTransform(args.graphData.nodes, w, h, k2))
    } else {
      setFlowNativeTransform(args.runtime, d3.zoomIdentity.translate(t0.x, t0.y).scale(k2))
    }
    clear()
    return
  }

  if (type === 'reset') {
    if (args.graphData && (args.graphData.nodes || []).length > 0) {
      setFlowNativeTransform(args.runtime, centerAllTransform(args.graphData.nodes, w, h))
    } else {
      setFlowNativeTransform(args.runtime, d3.zoomIdentity)
    }
    clear()
    return
  }

  if (type === 'fit') {
    const next = computeFitTransform(args.zoomRequest.intent)
    if (next) setFlowNativeTransform(args.runtime, next)
    clear()
    return
  }

  if (type === 'selection') {
    if (!args.graphData) {
      clear()
      return
    }
    const subset = computeZoomSubset({
      graphData: args.graphData,
      selectedNodeId: args.selectedNodeId,
      selectedEdgeId: args.selectedEdgeId,
      selectedNodeIds: args.selectedNodeIds,
      selectedEdgeIds: args.selectedEdgeIds,
    })
    if (subset.length > 0) {
      const opts = readFitAllOptions({ schema, mode, intent: 'fitSelection' })
      setFlowNativeTransform(args.runtime, fitAllTransform(subset as GraphNode[], w, h, opts))
      clear()
      return
    }
    const fallback = computeFitTransform('fitToView')
    if (fallback) setFlowNativeTransform(args.runtime, fallback)
    clear()
    return
  }

  if (type === 'transform') {
    const p = args.zoomRequest.payload
    if (p && typeof p.k === 'number' && typeof p.x === 'number' && typeof p.y === 'number') {
      setFlowNativeTransform(args.runtime, d3.zoomIdentity.translate(p.x, p.y).scale(p.k))
    }
    clear()
    return
  }

  clear()
}

function hasCacheCoverage(args: {
  nodes: ReadonlyArray<{ id: unknown }>
  positions: Record<string, { x: number; y: number }> | null
  minCoverage: number
}): boolean {
  const nodes = args.nodes
  const cached = args.positions
  if (!cached) return false
  if (!Array.isArray(nodes) || nodes.length === 0) return false
  let ok = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const id = String(nodes[i]?.id ?? '')
    if (!id) continue
    const p = cached[id]
    if (!p) continue
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    ok += 1
  }
  return ok / Math.max(1, nodes.length) >= args.minCoverage
}

export function extractNodePositions(nodes: ReadonlyArray<{ id?: unknown; x?: unknown; y?: unknown }>): Record<string, { x: number; y: number }> | null {
  if (!Array.isArray(nodes) || nodes.length === 0) return null
  const out: Record<string, { x: number; y: number }> = {}
  let ok = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const id = String(n?.id ?? '').trim()
    if (!id) continue
    const x = typeof n?.x === 'number' ? n.x : NaN
    const y = typeof n?.y === 'number' ? n.y : NaN
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    out[id] = { x, y }
    ok += 1
  }
  if (ok === 0) return null
  return out
}

export default function FlowCanvas({ active = true }: { active?: boolean }) {
  const containerRef = React.useRef<HTMLElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const runtimeRef = React.useRef<FlowNativeRuntime | null>(null)
  const lastLayoutGraphKeyRef = React.useRef<string>('')
  const lastBuiltGraphKeyRef = React.useRef<string>('')
  const lastAppliedZoomKeyRef = React.useRef<string | null>(null)
  const lastAppliedPositionsRef = React.useRef<Record<string, { x: number; y: number }> | null>(null)
  const lastCommittedPositionsRef = React.useRef<Record<string, { x: number; y: number }> | null>(null)
  const pendingCommitRef = React.useRef(false)
  const positionsDirtySinceCommitRef = React.useRef(false)
  const seededFromOtherRendererKeyRef = React.useRef<string>('')
  const seededFromOtherRendererPositionsRef = React.useRef<Record<string, { x: number; y: number }> | null>(null)
  const selectedNodeIdsRef = React.useRef<string[]>([])
  const selectedEdgeIdsRef = React.useRef<string[]>([])
  const dragRef = React.useRef<
    | null
    | {
        type: 'pan'
        startSx: number
        startSy: number
        startTx: number
        startTy: number
        pointerId: number
      }
    | {
        type: 'node'
        nodeId: string
        startWorldX: number
        startWorldY: number
        startNodeX: number
        startNodeY: number
        pointerId: number
      }
    | {
        type: 'group'
        groupId: string
        memberNodeIds: string[]
        startWorldX: number
        startWorldY: number
        startNodePosById: Record<string, { x: number; y: number }>
        pointerId: number
      }
  >(null)
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
    graphDataRevision,
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
    zoomRequest,
    zoomState,
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
      zoomState: s.zoomState,
      viewPinned: s.viewPinned === true,
      setZoomState: s.setZoomState,
      setZoomStateForKey: s.setZoomStateForKey,
    })),
  )

  React.useEffect(() => {
    selectedNodeIdsRef.current = (selectedNodeIds || []).map(v => String(v))
    selectedEdgeIdsRef.current = (selectedEdgeIds || []).map(v => String(v))
  }, [selectedEdgeIds, selectedNodeIds])

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

  const renderGraphData = useActiveGraphRenderData(active)
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

  const zoomStateForKey = useGraphStore(s => (zoomViewKey ? (s.zoomStateByKey?.[zoomViewKey] ?? null) : null))

  const rankdir = deriveRankdir({ flowRankdir: schema?.layout?.flow?.rankdir })
  const flowConfig = React.useMemo(() => readFlowConfig({ schema, rankdir }), [rankdir, schema])
  const layoutMode = schema ? readLayoutMode(schema) : 'force'

  const flowPresentation = React.useMemo(() => {
    const s = schema
    const portCfg = s ? getPortHandlesConfig(s) : { enabled: false, placement: 'cardinal' as const, size: 4, offset: 2, strokeWidth: 1.5, stroke: '', fill: '' }
    const groupsCfg = s?.layout?.groups || {}
    const groupsEnabled = groupsCfg.enabled !== false
    const shape: 'rect' | 'geo' = groupsCfg.shape === 'geo' ? 'geo' : 'rect'
    const paddingPx = typeof groupsCfg.padding === 'number' && Number.isFinite(groupsCfg.padding) ? Math.max(0, groupsCfg.padding) : 24
    const labelTopExtraPx = s ? readGroupLabelTopExtra(s) : 0
    const cornerRadiusPx = typeof groupsCfg.cornerRadius === 'number' && Number.isFinite(groupsCfg.cornerRadius) ? Math.max(0, groupsCfg.cornerRadius) : 12
    const strokeWidthPx = typeof groupsCfg.strokeWidth === 'number' && Number.isFinite(groupsCfg.strokeWidth) ? Math.max(0, groupsCfg.strokeWidth) : 1.5
    const fillOpacity = typeof groupsCfg.fillOpacity === 'number' && Number.isFinite(groupsCfg.fillOpacity) ? Math.max(0, Math.min(1, groupsCfg.fillOpacity)) : 0.08

    const depthStyleCfg = (groupsCfg as typeof groupsCfg & { depthStyle?: unknown }).depthStyle as
      | { enabled?: unknown; outerMaxBoostSteps?: unknown; outerStrokeWidthStepPx?: unknown; outerFillOpacityStep?: unknown }
      | undefined
    const depthStyle = {
      enabled: depthStyleCfg?.enabled !== false,
      outerMaxBoostSteps:
        typeof depthStyleCfg?.outerMaxBoostSteps === 'number' && Number.isFinite(depthStyleCfg.outerMaxBoostSteps)
          ? Math.max(0, Math.floor(depthStyleCfg.outerMaxBoostSteps))
          : 3,
      outerStrokeWidthStepPx:
        typeof depthStyleCfg?.outerStrokeWidthStepPx === 'number' && Number.isFinite(depthStyleCfg.outerStrokeWidthStepPx)
          ? Math.max(0, depthStyleCfg.outerStrokeWidthStepPx)
          : 0.55,
      outerFillOpacityStep:
        typeof depthStyleCfg?.outerFillOpacityStep === 'number' && Number.isFinite(depthStyleCfg.outerFillOpacityStep)
          ? Math.max(0, depthStyleCfg.outerFillOpacityStep)
          : 0.035,
    }

    const flowEdges = (s?.layout?.flow || {}) as unknown as {
      edges?: {
        routing?: { enabled?: unknown; mode?: unknown; obstacleAvoidance?: unknown; marginPx?: unknown; laneStepPx?: unknown; maxLanes?: unknown }
        underlay?: { enabled?: unknown; groupFadeAlpha?: unknown }
      }
    }
    const routingRaw = flowEdges.edges?.routing || {}
    const underlayRaw = flowEdges.edges?.underlay || {}
    const edgesPresentation = {
      routing: {
        enabled: routingRaw.enabled !== false,
        mode: routingRaw.mode === 'bezier' ? ('bezier' as const) : ('ortho' as const),
        obstacleAvoidance: routingRaw.obstacleAvoidance !== false,
        marginPx: typeof routingRaw.marginPx === 'number' && Number.isFinite(routingRaw.marginPx) ? Math.max(0, routingRaw.marginPx) : 10,
        laneStepPx: typeof routingRaw.laneStepPx === 'number' && Number.isFinite(routingRaw.laneStepPx) ? Math.max(4, routingRaw.laneStepPx) : 56,
        maxLanes: typeof routingRaw.maxLanes === 'number' && Number.isFinite(routingRaw.maxLanes) ? Math.max(1, Math.floor(routingRaw.maxLanes)) : 10,
      },
      underlay: {
        enabled: underlayRaw.enabled !== false,
        groupFadeAlpha:
          typeof underlayRaw.groupFadeAlpha === 'number' && Number.isFinite(underlayRaw.groupFadeAlpha)
            ? Math.max(0, Math.min(1, underlayRaw.groupFadeAlpha))
            : 0.65,
      },
    }

    return {
      portHandles: {
        enabled: portCfg.enabled,
        placement: 'cardinal' as const,
        sizePx: portCfg.size,
        offsetPx: portCfg.offset,
        strokeWidthPx: portCfg.strokeWidth,
      },
      groups: {
        enabled: groupsEnabled,
        shape,
        paddingPx,
        labelTopExtraPx,
        cornerRadiusPx,
        strokeWidthPx,
        fillOpacity,
        depthStyle,
      },
      edges: edgesPresentation,
    }
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

  const [computedPositions, setComputedPositions] = React.useState<Record<string, { x: number; y: number }> | null>(() => layoutPositionsForMode || null)

  React.useEffect(() => {
    if (!active) return
    lastLayoutGraphKeyRef.current = ''
    lastAppliedPositionsRef.current = null
    const next = layoutPositionsForMode || null
    setComputedPositions(prev => (prev === next ? prev : next))
  }, [active, cacheKey, layoutPositionsForMode])

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

  const requestCommit = React.useCallback(() => {
    if (pendingCommitRef.current) return
    pendingCommitRef.current = true
    requestAnimationFrame(() => {
      pendingCommitRef.current = false
      const runtime = runtimeRef.current
      if (!runtime) return
      const t = runtime.transform || d3.zoomIdentity
      const current = useGraphStore.getState()
      const pinned = current.viewPinned === true
      const existing = current.zoomStateByKey?.[zoomViewKey] || current.zoomState
      const nextZoom = {
        k: t.k,
        x: t.x,
        y: t.y,
        graphDataRevision: pinned ? undefined : graphDataRevision,
        viewportW,
        viewportH,
      }
      if (!isSameZoomState(existing || null, nextZoom)) {
        setZoomState(nextZoom)
        setZoomStateForKey(zoomViewKey, nextZoom)
      }
      if (!cacheKey || typeof setLayoutPositionsForMode !== 'function') return
      if (!positionsDirtySinceCommitRef.current) return
      const scene = runtime.scene
      if (!scene) return
      positionsDirtySinceCommitRef.current = false
      const prev = lastCommittedPositionsRef.current
      const currentPositions: Record<string, { x: number; y: number }> = {}
      for (let i = 0; i < scene.nodes.length; i += 1) {
        const n = scene.nodes[i]
        const x = n.x
        const y = n.y
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue
        currentPositions[n.id] = { x, y }
      }
      if (Object.keys(currentPositions).length === 0) return

      const relaxGraph = graphDataForZoom && typeof graphDataForZoom === 'object' ? (graphDataForZoom as GraphData) : null
      const relaxed = schema && relaxGraph
        ? relaxFlowPositionsWithCollision({
            graphData: relaxGraph,
            groups: scene.groups || [],
            positions: currentPositions,
            schema,
            nodeSize: { widthPx: flowConfig.node.widthPx, heightPx: flowConfig.node.heightPx },
            portHandles: {
              enabled: flowPresentation.portHandles.enabled,
              sizePx: flowPresentation.portHandles.sizePx,
              offsetPx: flowPresentation.portHandles.offsetPx,
            },
            defaultSteps: (scene.groups?.length || 0) > 0 ? 14 : 10,
          })
        : currentPositions
      const nextPositions = relaxed || currentPositions

      for (let i = 0; i < scene.nodes.length; i += 1) {
        const n = scene.nodes[i]
        const p = nextPositions[n.id]
        if (!p) continue
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
        n.x = p.x
        n.y = p.y
      }
      runtime.dirty = true
      requestFlowNativeDraw(runtime, {
        selectedNodeIds: selectedNodeIdsRef.current,
        selectedEdgeIds: selectedEdgeIdsRef.current,
      })

      let changed = false
      for (const id of Object.keys(nextPositions)) {
        const p = nextPositions[id]
        const prior = prev ? prev[id] : null
        if (!prior || Math.abs(prior.x - p.x) > 0.5 || Math.abs(prior.y - p.y) > 0.5) {
          changed = true
          break
        }
      }
      lastCommittedPositionsRef.current = nextPositions
      if (changed) setLayoutPositionsForMode(cacheKey, nextPositions)
    })
  }, [cacheKey, flowConfig.node.heightPx, flowConfig.node.widthPx, flowPresentation.portHandles.enabled, flowPresentation.portHandles.offsetPx, flowPresentation.portHandles.sizePx, graphDataForZoom, graphDataRevision, schema, setLayoutPositionsForMode, setZoomState, setZoomStateForKey, viewportH, viewportW, zoomViewKey])

  React.useEffect(() => {
    let cancelled = false
    if (!active) return
    const g = sceneGraphData
    const nodeList = Array.isArray(g?.nodes) ? g?.nodes : []
    const edgeList = Array.isArray(g?.edges) ? g?.edges : []
    const graphKey = `${nodeList.length}:${edgeList.length}:${buildGraphMetaKey(g)}:${layoutVariant}`
    if (graphKey === lastLayoutGraphKeyRef.current && computedPositions) return
    lastLayoutGraphKeyRef.current = graphKey

    const run = async () => {
      const cached = layoutPositionsForMode || null
      const seededFromOtherRenderer = (() => {
        const seedKey = `${graphKey}:${String(documentSemanticMode || 'document')}:${effectiveFrontmatter ? '1' : '0'}:${layoutMode}`
        if (seededFromOtherRendererKeyRef.current === seedKey) return seededFromOtherRendererPositionsRef.current
        seededFromOtherRendererKeyRef.current = seedKey

        const cache = useGraphStore.getState().layoutPositionCacheByMode || null
        const baseKey = buildLayoutPositionCacheKey({
          datasetKey,
          mode: layoutMode,
          frontmatterMode: effectiveFrontmatter,
          semanticMode: String(documentSemanticMode || 'document'),
          renderMode: '2d',
          viewKey: layoutViewKey,
          renderVariant: 'd3',
        })
        const best = pickSeedFromOtherRendererCache({
          nodes: nodeList,
          cache,
          baseKey,
        })
        seededFromOtherRendererPositionsRef.current = best
        return best
      })()
      const seededFromNodes = extractNodePositions(nodeList as ReadonlyArray<{ id?: unknown; x?: unknown; y?: unknown }>)
      const fromCache = hasCacheCoverage({ nodes: nodeList, positions: cached, minCoverage: 0.9 })
      const fromOtherRenderer = !fromCache && hasCacheCoverage({ nodes: nodeList, positions: seededFromOtherRenderer, minCoverage: 0.9 })
      const fromNodes = !fromCache && !fromOtherRenderer && hasCacheCoverage({ nodes: nodeList, positions: seededFromNodes, minCoverage: 0.9 })

      const computed = fromCache
        ? cached
        : fromOtherRenderer
          ? seededFromOtherRenderer
        : fromNodes
          ? seededFromNodes
        : await (async () => {
            if (nodeList.length > DEFAULT_FLOW_DAGRE_MAX_NODES) {
              return buildFastGridLayout({
                nodes: nodeList.map(n => ({ id: String(n.id) })),
                nodeSize: { widthPx: flowConfig.node.widthPx, heightPx: flowConfig.node.heightPx },
              })
            }

            const dagre = () =>
              buildDagreLayout({
                nodes: nodeList.map(n => ({ id: String(n.id) })),
                edges: edgeList.map(e => ({ source: String(e.source), target: String(e.target) })),
                rankdir,
                nodeSize: { widthPx: flowConfig.node.widthPx, heightPx: flowConfig.node.heightPx },
              })

            const grid = () =>
              buildFastGridLayout({
                nodes: nodeList.map(n => ({ id: String(n.id) })),
                nodeSize: { widthPx: flowConfig.node.widthPx, heightPx: flowConfig.node.heightPx },
              })

            const allowElk = nodeList.length <= DEFAULT_FLOW_ELK_MAX_NODES
            const allowDagre = nodeList.length <= DEFAULT_FLOW_DAGRE_MAX_NODES

            if (flowConfig.engine === 'grid') return grid()
            if (flowConfig.engine === 'dagre') return allowDagre ? dagre() : grid()
            if (flowConfig.engine === 'elk') {
              if (!allowElk) return allowDagre ? dagre() : grid()
              try {
                return await buildElkLayout({ graphData: { nodes: nodeList, edges: edgeList }, config: flowConfig })
              } catch {
                return dagre()
              }
            }

            if (!allowDagre) return grid()
            if (!allowElk) return dagre()
            try {
              return await buildElkLayout({ graphData: { nodes: nodeList, edges: edgeList }, config: flowConfig })
            } catch {
              return dagre()
            }
          })()

      const relaxed =
        !fromCache && sceneGraphData && schema
          ? relaxFlowPositionsWithCollision({
              graphData: sceneGraphData as GraphData,
              groups: sceneGroups,
              positions: computed,
              schema,
              nodeSize: { widthPx: flowConfig.node.widthPx, heightPx: flowConfig.node.heightPx },
              portHandles: {
                enabled: flowPresentation.portHandles.enabled,
                sizePx: flowPresentation.portHandles.sizePx,
                offsetPx: flowPresentation.portHandles.offsetPx,
              },
              defaultSteps: sceneGroups.length > 0 ? 18 : 12,
            })
          : computed

      if (cancelled) return
      if (cacheKey && typeof setLayoutPositionsForMode === 'function' && relaxed && Object.keys(relaxed).length > 0) {
        setLayoutPositionsForMode(cacheKey, relaxed)
      }
      setComputedPositions(relaxed)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [active, cacheKey, computedPositions, documentSemanticMode, effectiveFrontmatter, flowConfig, layoutMode, layoutPositionsForMode, layoutVariant, rankdir, sceneGraphData, setLayoutPositionsForMode])

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
    requestFlowNativeDraw(runtime, {
      selectedNodeIds: selectedNodeIdsRef.current,
      selectedEdgeIds: selectedEdgeIdsRef.current,
    })
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
    requestFlowNativeDraw(runtime, {
      selectedNodeIds: selectedNodeIdsRef.current,
      selectedEdgeIds: selectedEdgeIdsRef.current,
    })
  }, [active, dpr, viewportH, viewportW])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime) return
    if (!graphDataForZoom) return
    if (lastAppliedZoomKeyRef.current === zoomViewKey) return
    lastAppliedZoomKeyRef.current = zoomViewKey
    const z = zoomStateForKey || zoomState
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
  }, [active, graphDataForZoom, graphDataRevision, viewportH, viewportW, viewPinned, zoomState, zoomStateForKey, zoomViewKey])

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
    requestFlowNativeDraw(runtime, { selectedNodeIds: selectedNodeIds || [], selectedEdgeIds: selectedEdgeIds || [] })
    requestCommit()
  }, [
    active,
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
    const pos = computedPositions || null
    const graphKey = `${nodeList.length}:${edgeList.length}:${buildGraphMetaKey(g)}:${layoutVariant}`
    if (graphKey === lastBuiltGraphKeyRef.current && (runtime.scene?.nodes.length || 0) > 0) {
      return
    }
    lastBuiltGraphKeyRef.current = graphKey
    __flowCanvasDebug.lastBuiltSceneKey = graphKey
    setFlowNativeRankdir(runtime, rankdir)

    const handlesByNode = computeFlowHandlesByNode({
      nodes: nodeList as ReadonlyArray<{ id: unknown }>,
      edges: edgeList as ReadonlyArray<{ id: unknown; source: unknown; target: unknown }>,
    })
    const nodeById = new Map<string, NonNullable<FlowNativeScene['nodes']>[number]>()
    const nodes: NonNullable<FlowNativeScene['nodes']> = []
    for (let i = 0; i < nodeList.length; i += 1) {
      const n = nodeList[i]
      const id = String(n?.id || '').trim()
      if (!id) continue
      const label = String(n?.label || id)
      const shape = schema ? getNodeRenderShape2d(n as GraphNode, schema) : 'rect'
      const handles = handlesByNode[id] || { in: [], out: [] }
      const p = pos ? pos[id] : null
      const x = p && Number.isFinite(p.x) ? p.x : 0
      const y = p && Number.isFinite(p.y) ? p.y : 0
      const inHandleTopPctById: Partial<Record<FlowHandleId, number>> = {}
      const outHandleTopPctById: Partial<Record<FlowHandleId, number>> = {}
      for (let j = 0; j < handles.in.length; j += 1) {
        const h = handles.in[j]
        inHandleTopPctById[h.id] = h.topPct
      }
      for (let j = 0; j < handles.out.length; j += 1) {
        const h = handles.out[j]
        outHandleTopPctById[h.id] = h.topPct
      }
      const node = {
        id,
        label,
        x,
        y,
        width: flowConfig.node.widthPx,
        height: flowConfig.node.heightPx,
        shape,
        handles,
        inHandleTopPctById,
        outHandleTopPctById,
      }
      nodes.push(node)
      nodeById.set(id, node)
    }

    const edges: NonNullable<FlowNativeScene['edges']> = []
    for (let i = 0; i < edgeList.length; i += 1) {
      const e = edgeList[i] as { id?: unknown; source?: unknown; target?: unknown }
      const edgeId = String(e?.id || '').trim()
      const source = String(e?.source || '').trim()
      const target = String(e?.target || '').trim()
      if (!edgeId || !source || !target) continue
      if (!nodeById.has(source) || !nodeById.has(target)) continue
      edges.push({
        id: edgeId,
        source,
        target,
        outHandleId: buildFlowHandleId({ dir: 'out', edgeId }),
        inHandleId: buildFlowHandleId({ dir: 'in', edgeId }),
      })
    }

    __flowCanvasDebug.lastBuiltSceneNodeCount = nodes.length
    const groups = sceneGroups
    const groupIdsByNodeId = (() => {
      if (!groups || groups.length === 0) return new Map<string, string[]>()
      const m = new Map<string, string[]>()
      for (let i = 0; i < groups.length; i += 1) {
        const g = groups[i]
        const gid = String(g.id || '').trim()
        if (!gid) continue
        const members = Array.isArray(g.memberNodeIds) ? g.memberNodeIds : []
        for (let j = 0; j < members.length; j += 1) {
          const id = String(members[j] || '').trim()
          if (!id) continue
          const arr = m.get(id) || []
          if (!arr.includes(gid)) arr.push(gid)
          m.set(id, arr)
        }
      }
      return m
    })()
    setFlowNativeScene(runtime, { nodes, edges, nodeById, groups, groupIdsByNodeId })
    requestFlowNativeDraw(runtime, {
      selectedNodeIds: selectedNodeIdsRef.current,
      selectedEdgeIds: selectedEdgeIdsRef.current,
    })
  }, [active, computedPositions, flowConfig, rankdir, sceneGraphData, sceneGroups, schemaGroupsPresentationJson, schemaNodesPresentationJson])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime) return
    setFlowNativePresentation(runtime, flowPresentation)
    requestFlowNativeDraw(runtime, {
      selectedNodeIds: selectedNodeIdsRef.current,
      selectedEdgeIds: selectedEdgeIdsRef.current,
    })
  }, [active, flowPresentation])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    const canvasEl = canvasRef.current
    if (!runtime || !canvasEl) return
    const onWheel = (e: WheelEvent) => {
      const state = useGraphStore.getState()
      const schema = state.schema
      const [minScale, maxScale] = readZoomScaleExtent(schema)
      const rect = canvasEl.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const t0 = runtime.transform || d3.zoomIdentity
      const factor = Math.exp(-e.deltaY * 0.001)
      const nextK = clampScale(t0.k * factor, { minK: minScale, maxK: maxScale })
      const wx = (sx - t0.x) / t0.k
      const wy = (sy - t0.y) / t0.k
      const nextX = sx - wx * nextK
      const nextY = sy - wy * nextK
      setFlowNativeTransform(runtime, d3.zoomIdentity.translate(nextX, nextY).scale(nextK))
      requestFlowNativeDraw(runtime, {
        selectedNodeIds: selectedNodeIdsRef.current,
        selectedEdgeIds: selectedEdgeIdsRef.current,
      })
      requestCommit()
    }

    const onPointerDown = (e: PointerEvent) => {
      if (!active) return
      const rect = canvasEl.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const hit = hitTestNode(runtime, { sx, sy })
      const pointerId = e.pointerId
      try {
        canvasEl.setPointerCapture(pointerId)
      } catch {
        void 0
      }
      if (hit) {
        const state = useGraphStore.getState()
        state.setSelectionSource('canvas')
        state.selectEdge(null)
        state.selectNode(hit)

        const allowDrag = state.schema?.behavior?.allowNodeDrag !== false
        if (allowDrag) {
          const t0 = runtime.transform || d3.zoomIdentity
          const wx = (sx - t0.x) / t0.k
          const wy = (sy - t0.y) / t0.k
          const node = runtime.scene?.nodeById.get(hit)
          if (node) {
            dragRef.current = {
              type: 'node',
              nodeId: hit,
              startWorldX: wx,
              startWorldY: wy,
              startNodeX: node.x,
              startNodeY: node.y,
              pointerId,
            }
          }
        }
        requestFlowNativeDraw(runtime, {
          selectedNodeIds: selectedNodeIdsRef.current,
          selectedEdgeIds: selectedEdgeIdsRef.current,
        })
        requestCommit()
        return
      }

      const groupHit = hitTestGroup(runtime, { sx, sy })
      if (groupHit) {
        const state = useGraphStore.getState()
        const allowDrag = state.schema?.behavior?.allowNodeDrag !== false
        if (allowDrag) {
          const scene = runtime.scene
          const group = scene?.groups?.find(g => String(g.id || '') === groupHit) || null
          if (scene && group) {
            const membersRaw = Array.isArray(group.memberNodeIds) ? group.memberNodeIds : []
            const memberNodeIds = membersRaw.map(v => String(v || '').trim()).filter(Boolean)
            const startNodePosById: Record<string, { x: number; y: number }> = {}
            for (let i = 0; i < memberNodeIds.length; i += 1) {
              const id = memberNodeIds[i]
              const node = scene.nodeById.get(id)
              if (!node) continue
              startNodePosById[id] = { x: node.x, y: node.y }
            }
            const t0 = runtime.transform || d3.zoomIdentity
            const wx = (sx - t0.x) / t0.k
            const wy = (sy - t0.y) / t0.k
            dragRef.current = {
              type: 'group',
              groupId: groupHit,
              memberNodeIds,
              startWorldX: wx,
              startWorldY: wy,
              startNodePosById,
              pointerId,
            }
            return
          }
        }
      }

      dragRef.current = {
        type: 'pan',
        startSx: sx,
        startSy: sy,
        startTx: runtime.transform.x,
        startTy: runtime.transform.y,
        pointerId,
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      if (drag.pointerId !== e.pointerId) return
      const rect = canvasEl.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      if (drag.type === 'pan') {
        const dx = sx - drag.startSx
        const dy = sy - drag.startSy
        setFlowNativeTransform(runtime, d3.zoomIdentity.translate(drag.startTx + dx, drag.startTy + dy).scale(runtime.transform.k))
        requestFlowNativeDraw(runtime, {
          selectedNodeIds: selectedNodeIdsRef.current,
          selectedEdgeIds: selectedEdgeIdsRef.current,
        })
        return
      }

      if (drag.type === 'group') {
        const t0 = runtime.transform || d3.zoomIdentity
        const wx = (sx - t0.x) / t0.k
        const wy = (sy - t0.y) / t0.k
        const dx = wx - drag.startWorldX
        const dy = wy - drag.startWorldY
        const scene = runtime.scene
        if (!scene) return
        for (let i = 0; i < drag.memberNodeIds.length; i += 1) {
          const id = drag.memberNodeIds[i]
          const node = scene.nodeById.get(id)
          const start = drag.startNodePosById[id]
          if (!node || !start) continue
          node.x = start.x + dx
          node.y = start.y + dy
        }
        runtime.dirty = true
        positionsDirtySinceCommitRef.current = true
        requestFlowNativeDraw(runtime, {
          selectedNodeIds: selectedNodeIdsRef.current,
          selectedEdgeIds: selectedEdgeIdsRef.current,
        })
        return
      }
      const t0 = runtime.transform || d3.zoomIdentity
      const wx = (sx - t0.x) / t0.k
      const wy = (sy - t0.y) / t0.k
      const dx = wx - drag.startWorldX
      const dy = wy - drag.startWorldY
      const scene = runtime.scene
      const node = scene?.nodeById.get(drag.nodeId)
      if (!scene || !node) return
      node.x = drag.startNodeX + dx
      node.y = drag.startNodeY + dy
      runtime.dirty = true
      positionsDirtySinceCommitRef.current = true
      requestFlowNativeDraw(runtime, {
        selectedNodeIds: selectedNodeIdsRef.current,
        selectedEdgeIds: selectedEdgeIdsRef.current,
      })
    }

    const onPointerUp = (e: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      if (drag.pointerId !== e.pointerId) return
      dragRef.current = null
      requestCommit()
    }

    canvasEl.addEventListener('wheel', onWheel, { passive: true })
    canvasEl.addEventListener('pointerdown', onPointerDown, { passive: true })
    canvasEl.addEventListener('pointermove', onPointerMove, { passive: true })
    canvasEl.addEventListener('pointerup', onPointerUp, { passive: true })
    canvasEl.addEventListener('pointercancel', onPointerUp, { passive: true })

    return () => {
      canvasEl.removeEventListener('wheel', onWheel)
      canvasEl.removeEventListener('pointerdown', onPointerDown)
      canvasEl.removeEventListener('pointermove', onPointerMove)
      canvasEl.removeEventListener('pointerup', onPointerUp)
      canvasEl.removeEventListener('pointercancel', onPointerUp)
    }
  }, [
    active,
    requestCommit,
  ])

  return (
    <section ref={containerRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        aria-label="Flow renderer"
        className="h-full w-full"
      />
    </section>
  )
}
