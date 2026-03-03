import * as d3 from 'd3'
import type { MutableRefObject, RefObject } from 'react'
import type { GraphNode, GraphEdge, GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { createZoom } from '@/components/GraphCanvas/zoom'
import { buildSimulation } from '@/components/GraphCanvas/simulation'
import { readFitAllOptions, readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { fitAllTransform } from '@/components/GraphCanvas/fit'
import { relaxNodesWithCollision } from '@/components/GraphCanvas/layout/relax'
import { postFitNodesToViewport } from '@/components/GraphCanvas/layout/postFit'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation'
import { hideTempLink, cancelPendingEdge } from '@/features/edge-creation'
import type { HoverInfo } from '@/components/GraphHoverTooltip'
import { applySelectionHighlight } from '@/components/GraphCanvas/highlight'
import { deriveSceneDisplayGraph } from '@/lib/scene/sceneDerivation'
import { createDefs, createGroupsLayer, createLinksHitLayer, createLinksLayer, createEdgeLabelsLayer, createNodesLayer, createTempLink, createLabelsLayer, createResizeHandlesLayer } from '@/components/GraphCanvas/sceneLayers'
import { attachGlobalHandlers, attachSimulationTick } from '@/components/GraphCanvas/sceneHandlers'
import { applyGraphCanvasZOrder } from '@/components/GraphCanvas/zOrder'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import type { PortHandleDatum } from '@/components/GraphCanvas/portHandles'
import { buildNodeZKeyById } from '@/lib/canvas/groupZOrder'
import {
  initializeGraphLayout,
  applyBaselineDocumentPositionsToKeywordGraph,
  seedKeywordEntityNodesFromBaselineSources,
  layoutLooksUnstableForViewport,
} from '@/components/GraphCanvas/layout/initialization'
import { applyCollectiveGraphLayout } from '@/components/GraphCanvas/layout/collectiveFit'
import type { ViewportControlsPreset } from '@/lib/config.viewport-controls'
import { readFitPadding } from '@/lib/graph/layoutDefaults'
import { pipelinePerfMeasureSync } from '@/lib/pipelinePerf'
import { createUniqueId } from '@/lib/ids'

type GSelection = d3.Selection<SVGGElement, unknown, null, undefined>

type SetupGraphSceneArgs = {
  svgEl: SVGSVGElement
  svgRef: RefObject<SVGSVGElement>
  graphData: GraphData
  graphDataRevision: number
  schema: GraphSchema
  documentSemanticMode?: 'document' | 'keyword'
  edgesForSim: GraphEdge[]
  width: number
  height: number
  hoverEnabled: boolean
  zoomOnDoubleClick: boolean
  renderMediaAsNodes: boolean
  mediaPanelDensity: 'default' | 'compact'
  enableTightInitialLayout?: boolean
  fitToScreenMode?: boolean
  viewportControlsPreset: ViewportControlsPreset
  initialZoomTransform?: { k: number; x: number; y: number } | null
  layoutPositionsForMode?: Record<string, { x: number; y: number }> | null
  baselineLayoutPositions?: Record<string, { x: number; y: number }> | null
  prevPositions?: Record<string, { x: number; y: number }> | null
  skipInitialLayout?: boolean
  freezeSimulation?: boolean
  groupsForBboxCollide: GraphGroup[]
  layoutGroupKeyByNodeId: Record<string, string> | null
  gRef: MutableRefObject<GSelection | null>
  nodesSelRef: MutableRefObject<d3.Selection<SVGElement, GraphNode, SVGGElement, unknown> | null>
  groupChevronSelRef: MutableRefObject<d3.Selection<SVGPathElement, GraphNode, SVGGElement, unknown> | null>
  mediaSelRef: MutableRefObject<d3.Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown> | null>
  portHandlesSelRef: MutableRefObject<
    d3.Selection<SVGCircleElement, PortHandleDatum, SVGGElement, unknown> | null
  >
  linksHitSelRef: MutableRefObject<d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null>
  linksSelRef: MutableRefObject<d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null>
  labelsSelRef: MutableRefObject<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>
  zoomRef: MutableRefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>
  tempLinkSelRef: MutableRefObject<TempLinkSelection>
  linkDragRef: MutableRefObject<PendingLink | null>
  simulationRef: MutableRefObject<d3.Simulation<GraphNode, GraphEdge> | null>
  sceneGraphDataRef: MutableRefObject<GraphData | null>
  beforeRenderFrameRef: MutableRefObject<(() => void) | null>
  selectedEdgeIdRef: MutableRefObject<string | null>
  selectedNodeIdRef: MutableRefObject<string | null>
  selectedNodeIdsRef: MutableRefObject<string[] | undefined>
  selectedEdgeIdsRef: MutableRefObject<string[] | undefined>
  selectNode: (id: string | null) => void
  selectEdge: (id: string | null) => void
  selectGroup: (id: string | null) => void
  selectGroupExpanded: (args: { id: string; nodeIds: string[]; edgeIds: string[] }) => void
  toggleGroupCollapsed: (id: string) => void
  setSelectionSource: (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => void
  addEdge: (e: GraphEdge) => void
  updateEdge: (id: string, u: Partial<GraphEdge>) => void
  addNode: (n: GraphNode) => void
  updateNode: (id: string, u: Partial<GraphNode>) => void
  setHoverInfo: (updater: (prev: HoverInfo | null) => HoverInfo | null) => void
  setLifecycleStageRendering: () => void
  requestZoomSelection: () => void
  onZoomTransform: (t: { k: number; x: number; y: number }) => void
  edgeScrollEnabled?: () => boolean
  getSchema: () => GraphSchema
  getRenderMediaAsNodes: () => boolean
  enableEditorGestures?: boolean
  layoutCacheKey: string | null
  setLayoutPositionsForMode: ((key: string, positions: Record<string, { x: number; y: number }> | null) => void) | null
}

export const setupGraphScene = (args: SetupGraphSceneArgs) => {
  const {
    svgEl,
    svgRef,
    graphData,
    schema,
    edgesForSim,
    width,
    height,
    hoverEnabled,
    zoomOnDoubleClick,
    renderMediaAsNodes,
    mediaPanelDensity,
    fitToScreenMode,
    viewportControlsPreset,
    initialZoomTransform,
    layoutPositionsForMode,
    baselineLayoutPositions,
    prevPositions,
    skipInitialLayout,
    gRef,
    nodesSelRef,
    groupChevronSelRef,
    mediaSelRef,
    portHandlesSelRef,
    linksHitSelRef,
    linksSelRef,
    labelsSelRef,
    zoomRef,
    tempLinkSelRef,
    linkDragRef,
    simulationRef,
    sceneGraphDataRef,
    beforeRenderFrameRef,
    selectedEdgeIdRef,
    selectedNodeIdRef,
    selectedNodeIdsRef,
    selectedEdgeIdsRef,
    selectNode,
    selectEdge,
    selectGroup,
    selectGroupExpanded,
    toggleGroupCollapsed,
    setSelectionSource,
    setHoverInfo,
    setLifecycleStageRendering,
    requestZoomSelection,
    onZoomTransform,
    getSchema,
    getRenderMediaAsNodes,
    enableEditorGestures,
    layoutCacheKey,
    setLayoutPositionsForMode,
  } = args

  const svg = d3.select(svgEl)
  svg.selectAll('*').remove()
  svg.attr('data-kg-layout-frozen', null)

  const g = svg.append('g')
  gRef.current = g

  createDefs(svg)

  const display = deriveSceneDisplayGraph({ graphData, edges: edgesForSim || [] })
  const graphDataForDisplay = display?.displayGraphData || graphData
  sceneGraphDataRef.current = graphDataForDisplay
  const displayNodes = Array.isArray(graphDataForDisplay.nodes) ? (graphDataForDisplay.nodes as GraphNode[]) : []
  const edgesForDisplay = Array.isArray(graphDataForDisplay.edges) ? (graphDataForDisplay.edges as GraphEdge[]) : []

  const zoom = createZoom(svg, g, labelsSelRef, schema, viewportControlsPreset, onZoomTransform, () => {
    if (!nodesSelRef.current && !labelsSelRef.current && !linksSelRef.current && !mediaSelRef.current) return
    const schemaValue = getSchema()
    applySelectionHighlight(
      nodesSelRef.current,
      mediaSelRef.current,
      labelsSelRef.current,
      linksSelRef.current,
          graphDataForDisplay,
          schemaValue,
          selectedNodeIdRef.current,
          selectedEdgeIdRef.current,
          selectedNodeIdsRef.current,
          selectedEdgeIdsRef.current,
          getRenderMediaAsNodes(),
        )
  })
  zoomRef.current = zoom
  const applyInitialTransform = (t: { k: number; x: number; y: number } | null) => {
    if (!t) return
    const k = typeof t.k === 'number' && Number.isFinite(t.k) ? t.k : 1
    const x = typeof t.x === 'number' && Number.isFinite(t.x) ? t.x : 0
    const y = typeof t.y === 'number' && Number.isFinite(t.y) ? t.y : 0
    const next = d3.zoomIdentity.translate(x, y).scale(k)
    svg.call(
      zoom.transform as unknown as (
        sel: d3.Selection<SVGSVGElement, unknown, null, undefined>,
        t: d3.ZoomTransform,
      ) => void,
      next,
    )
  }

  const layoutPositionsSource = (() => {
    const cached = layoutPositionsForMode && Object.keys(layoutPositionsForMode).length > 0 ? layoutPositionsForMode : null
    const prev = prevPositions && Object.keys(prevPositions).length > 0 ? prevPositions : null
    return cached || prev
  })()

  const seedCenter = (() => {
    if (!initialZoomTransform) return null
    const k =
      typeof initialZoomTransform.k === 'number' && Number.isFinite(initialZoomTransform.k) && initialZoomTransform.k > 0
        ? initialZoomTransform.k
        : 1
    const x = typeof initialZoomTransform.x === 'number' && Number.isFinite(initialZoomTransform.x) ? initialZoomTransform.x : 0
    const y = typeof initialZoomTransform.y === 'number' && Number.isFinite(initialZoomTransform.y) ? initialZoomTransform.y : 0
    return { x: (width / 2 - x) / k, y: (height / 2 - y) / k }
  })()

  const isKeywordGraph = (() => {
    const meta = (graphDataForDisplay.metadata || {}) as Record<string, unknown>
    if (meta.kind === 'keyword') return true
    // Also check nodes for keyword properties to match simulation detection
    const nodes = Array.isArray(graphDataForDisplay.nodes) ? graphDataForDisplay.nodes : []
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const props = (n.properties || {}) as Record<string, unknown>
      if (typeof props['keyword:kind'] === 'string' && props['keyword:kind']) return true
    }
    return false
  })()

  const groupKeyByNodeId = args.layoutGroupKeyByNodeId
  const groupKeyOf = (n: GraphNode): string | null => {
    const id = String(n.id || '').trim()
    if (!id || !groupKeyByNodeId) return null
    return groupKeyByNodeId[id] || null
  }

  if (isKeywordGraph && baselineLayoutPositions) {
    const overwriteExisting =
      !skipInitialLayout || layoutLooksUnstableForViewport({ nodes: displayNodes, width, height, viewportCenter: seedCenter })
    seedKeywordEntityNodesFromBaselineSources({
      keywordNodes: displayNodes,
      allNodes: Array.isArray(graphData.nodes) ? (graphData.nodes as GraphNode[]) : ([] as GraphNode[]),
      allEdges: Array.isArray(graphData.edges) ? (graphData.edges as GraphEdge[]) : ([] as GraphEdge[]),
      baseline: baselineLayoutPositions,
      overwriteExisting,
    })
    applyBaselineDocumentPositionsToKeywordGraph({
      nodes: displayNodes,
      edges: edgesForDisplay,
      baseline: baselineLayoutPositions,
      overwriteExisting,
    })
  }

  pipelinePerfMeasureSync({
    name: 'render',
    stage: 'layout:init',
    detail: {
      nodes: displayNodes.length,
      edges: edgesForDisplay.length,
      hasCachedPositions: !!layoutPositionsSource,
      skipInitialLayout: !!skipInitialLayout,
    },
    run: () =>
      initializeGraphLayout({
        nodes: displayNodes,
        edges: edgesForDisplay,
        width,
        height,
        schema,
        seedCenter,
        groupKeyOf,
        layoutPositions: layoutPositionsSource,
      }),
  })

  const effectiveSkipInitialLayout = (() => {
    if (!skipInitialLayout) return false
    if (layoutLooksUnstableForViewport({ nodes: displayNodes, width, height, viewportCenter: seedCenter })) return false
    return true
  })()

  const simulation = buildSimulation(displayNodes, edgesForDisplay, Math.max(1, width), Math.max(1, Math.floor(height)), schema, {
    skipInitialLayout: !!effectiveSkipInitialLayout,
    groupKeyOf,
    groupsForBboxCollide: args.groupsForBboxCollide,
    treatKeywordGraphAsDocument: isKeywordGraph,
    viewportCenter: seedCenter || undefined,
  })
  simulationRef.current = simulation

  if (effectiveSkipInitialLayout && readLayoutMode(schema) === 'force' && args.freezeSimulation !== true) {
    try {
      simulation.alphaTarget(0)
      simulation.alpha(0)
      simulation.stop()
    } catch {
      void 0
    }
    svg.attr('data-kg-layout-frozen', '1')
  }

  const shouldApplyInitialTightLayout = args.enableTightInitialLayout === true

  if (!effectiveSkipInitialLayout && displayNodes.length > 1) {
    const dupCounts = new Map<string, number>()
    for (let i = 0; i < displayNodes.length; i += 1) {
      const n = displayNodes[i]
      const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : 0
      const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : 0
      n.x = x
      n.y = y
      const key = `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`
      dupCounts.set(key, (dupCounts.get(key) || 0) + 1)
    }

    const jitterFor = (id: string): { dx: number; dy: number } => {
      let h = 0
      for (let i = 0; i < id.length; i += 1) {
        h = (h * 31 + id.charCodeAt(i)) >>> 0
      }
      const sx = ((h % 7) - 3) * 0.11
      const sy = (((h >>> 3) % 7) - 3) * 0.11
      return { dx: sx, dy: sy }
    }

    for (let i = 0; i < displayNodes.length; i += 1) {
      const n = displayNodes[i]
      const x = n.x as number
      const y = n.y as number
      const key = `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`
      if ((dupCounts.get(key) || 0) <= 1) continue
      const j = jitterFor(String(n.id || ''))
      n.x = x + j.dx
      n.y = y + j.dy
    }

  }

  if (shouldApplyInitialTightLayout && displayNodes.length > 1) {
    relaxNodesWithCollision({
      nodes: displayNodes,
      edges: edgesForDisplay,
      schema,
      defaultSteps: (args.groupsForBboxCollide || []).length > 0 ? 18 : 12,
      groupKeyOf,
      groups: args.groupsForBboxCollide,
    })

    for (let i = 0; i < displayNodes.length; i += 1) {
      const n = displayNodes[i]
      n.vx = 0
      n.vy = 0
    }

    const padPx = Math.max(24, Math.floor(readFitPadding(schema)))
    postFitNodesToViewport({
      nodes: displayNodes,
      width: Math.max(1, width),
      height: Math.max(1, Math.floor(height)),
      paddingPx: padPx,
      minScale: 0.06,
      maxScale: 2.2,
      viewportCenter: seedCenter || undefined,
    })

    if (readLayoutMode(schema) === 'force' && args.freezeSimulation !== true) {
      try {
        simulation.alphaTarget(0)
        simulation.alpha(0)
        simulation.stop()
      } catch {
        void 0
      }
      svg.attr('data-kg-layout-frozen', '1')
    }
  }

  if (initialZoomTransform) {
    applyInitialTransform(initialZoomTransform)
  }

  if (args.freezeSimulation === true) {
    try {
      simulation.alpha(0)
      simulation.alphaTarget(0)
      simulation.stop()
    } catch {
      void 0
    }
    svg.attr('data-kg-layout-frozen', '1')
  }

  const allGroupsForZOrder = deriveGraphGroups(graphDataForDisplay, { forceDocumentStructure: args.documentSemanticMode === 'document' })
  const nodeZKeyById = buildNodeZKeyById({ nodes: displayNodes, groups: allGroupsForZOrder })

  const groupsLayer = createGroupsLayer({
    g,
    graphData,
    edgesForDisplay,
    schema,
    documentSemanticMode: args.documentSemanticMode,
    simulation,
    groupsOverride: allGroupsForZOrder,
    hoverEnabled,
    setHoverInfo,
    setSelectionSource,
    selectNode,
    selectGroup,
    selectGroupExpanded,
    toggleGroupCollapsed,
  })
  const groupsUpdate = groupsLayer?.update ? () => groupsLayer.update() : null
  beforeRenderFrameRef.current = groupsUpdate
  // Legacy layout sync removed to prevent infinite re-render loop in Force layout mode.

  const linkHitSel = createLinksHitLayer({
    g,
    edgesForDisplay,
    schema,
    simulation,
    hoverEnabled,
    setHoverInfo,
    setSelectionSource,
    selectNode,
    selectEdge,
  })
  linksHitSelRef.current = linkHitSel

  const { nodeSel, mediaSel, portHandlesSel, groupChevronSel } = createNodesLayer({
    g,
    graphData: graphDataForDisplay,
    schema,
    renderMediaAsNodes,
    mediaPanelDensity,
    zoomOnDoubleClick,
    nodeZKeyById,
    tempLinkSelRef,
    linkDragRef,
    simulation,
    addEdge: args.addEdge,
    updateEdge: args.updateEdge,
    getSelectedEdgeId: () => selectedEdgeIdRef.current,
    enableEditorGestures,
    onCommitNodePosition: enableEditorGestures
      ? ({ id, x, y }) => {
          args.updateNode(id, { x, y })
        }
      : undefined,
    hoverEnabled,
    setHoverInfo,
    selectNode,
    selectEdge,
    setSelectionSource,
    requestZoomSelection,
    toggleGroupCollapsed,
    edgeScroll: {
      enabled: () => (typeof args.edgeScrollEnabled === 'function' ? args.edgeScrollEnabled() : true),
      panByPx: (dx, dy) => {
        svg.call(
          zoom.translateBy as unknown as (
            sel: d3.Selection<SVGSVGElement, unknown, null, undefined>,
            x: number,
            y: number,
          ) => void,
          dx,
          dy,
        )
      },
    },
  })
  nodesSelRef.current = nodeSel
  groupChevronSelRef.current = groupChevronSel
  mediaSelRef.current = mediaSel
  portHandlesSelRef.current = portHandlesSel

  const resizeLayer = enableEditorGestures
    ? createResizeHandlesLayer({
        g,
        svgRef,
        getSchema,
        nodes: graphDataForDisplay.nodes,
        getSelectedNodeId: () => selectedNodeIdRef.current,
        enabled: true,
        commitResize: ({ id, properties }) => {
          args.updateNode(id, { properties })
        },
      })
    : null
  beforeRenderFrameRef.current = () => {
    groupsUpdate?.()
    resizeLayer?.update()
  }

  const linkSel = createLinksLayer({
    g,
    edgesForDisplay,
    schema,
  })
  linksSelRef.current = linkSel

  const edgeLabelSel = createEdgeLabelsLayer({
    g,
    edgesForDisplay,
    schema,
    hoverEnabled,
    setHoverInfo,
    setSelectionSource,
    selectEdge,
  })

  createTempLink(g, tempLinkSelRef)

  createLabelsLayer({
    g,
    nodes: graphDataForDisplay.nodes,
    schema,
    documentSemanticMode: args.documentSemanticMode,
    nodeZKeyById,
    labelsSelRef,
    hoverEnabled,
    setHoverInfo,
    selectNode,
    selectEdge,
    setSelectionSource,
  })

  const isForceLayout = readLayoutMode(schema) === 'force'

  const storeLayoutPositions = () => {
    if (!layoutCacheKey || typeof setLayoutPositionsForMode !== 'function') return
    const positions: Record<string, { x: number; y: number }> = {}
    for (let i = 0; i < graphDataForDisplay.nodes.length; i += 1) {
      const node = graphDataForDisplay.nodes[i]
      const id = String(node.id)
      if (!id) continue
      const x = typeof node.x === 'number' ? node.x : null
      const y = typeof node.y === 'number' ? node.y : null
      if (x == null || y == null) continue
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      positions[id] = { x, y }
    }
    if (Object.keys(positions).length > 0) {
      setLayoutPositionsForMode(layoutCacheKey, positions)
    }
  }
  if (labelsSelRef.current) {
    const hideBelow = schema.performance?.lod?.hideLabelsBelowScale ?? 0
    const k = d3.zoomTransform(svgEl).k || 1
    const hidden = hideBelow > 0 && k < hideBelow
    labelsSelRef.current.attr('data-zoom-lod-hidden', hidden ? '1' : '0')

    let stableTicks = 0
    let finalFitApplied = false
    attachSimulationTick({
      svgEl,
      simulation,
      nodeSelRef: nodesSelRef,
      groupChevronSelRef,
      mediaSelRef,
      portHandlesSelRef,
      linkHitSelRef: linksHitSelRef,
      linkSelRef: linksSelRef,
      edgeLabelSel,
      labelsSelRef,
      nodes: graphDataForDisplay.nodes,
      nodeById: display?.nodeById || null,
      groupsForBboxCollide: args.groupsForBboxCollide,
      getSchema,
      documentSemanticMode: args.documentSemanticMode,
      width,
      height,
      beforeRenderFrameRef,
      afterRenderFrame: ({ alpha, tick }) => {
        if (!isForceLayout) return
        if (finalFitApplied) return
        if (args.freezeSimulation === true) return
        if (args.enableTightInitialLayout !== true) return
        if (effectiveSkipInitialLayout) return
        if (tick < 20) return

        if (alpha < 0.045) {
          stableTicks += 1
        } else {
          stableTicks = 0
        }
        if (stableTicks < 12) return

        const allowAutoFit = !initialZoomTransform
        if (allowAutoFit) {
          applyCollectiveGraphLayout({
            nodes: displayNodes,
            edges: edgesForDisplay,
            width: Math.max(1, width),
            height: Math.max(1, Math.floor(height)),
            schema: getSchema(),
          })

          relaxNodesWithCollision({
            nodes: displayNodes,
            edges: edgesForDisplay,
            schema: getSchema(),
            defaultSteps: (args.groupsForBboxCollide || []).length > 0 ? 10 : 6,
            groups: args.groupsForBboxCollide,
            groupKeyOf,
          })
          for (let i = 0; i < displayNodes.length; i += 1) {
            const n = displayNodes[i]
            n.vx = 0
            n.vy = 0
          }

          const padPx = Math.max(24, Math.floor(readFitPadding(getSchema())))
          postFitNodesToViewport({
            nodes: displayNodes,
            width: Math.max(1, width),
            height: Math.max(1, Math.floor(height)),
            paddingPx: padPx,
            minScale: 0.04,
            maxScale: 1.8,
          })

          const intent = fitToScreenMode ? 'fitToScreen' : 'fitToView'
          const schemaValue = getSchema()
          const mode = readLayoutMode(schemaValue)
          const baseOpts = readFitAllOptions({ schema: schemaValue, mode, intent })
          const opts = baseOpts
          const t = fitAllTransform(displayNodes, Math.max(1, width), Math.max(1, Math.floor(height)), opts)
          applyInitialTransform({ k: t.k, x: t.x, y: t.y })
        }
        finalFitApplied = true

        try {
          simulation.alphaTarget(0)
          simulation.alpha(0)
          simulation.stop()
        } catch {
          void 0
        }
        svg.attr('data-kg-layout-frozen', '1')
        storeLayoutPositions()
      },
    })
  }

  applyGraphCanvasZOrder(g, args.schema)

  simulation.on('end.layoutCache', storeLayoutPositions)

  const layoutMode = readLayoutMode(schema)
  if (layoutMode === 'radial') {
    simulation.stop()
    storeLayoutPositions()
    svg.attr('data-kg-layout-frozen', '1')
  }

  setLifecycleStageRendering()

  const cleanupHandlers = attachGlobalHandlers({
    svgRef,
    svg,
    tempLinkSelRef,
    linkDragRef,
    selectNode,
    enableEditorGestures,
    onCanvasShiftDoubleClick: ({ x, y }) => {
      if (!enableEditorGestures) return
      const base = args.graphData
      const used = new Set<string>((base?.nodes || []).map(n => String(n.id || '')))
      const id = createUniqueId('n', used)
      const n: GraphNode = {
        id,
        label: `Node ${id}`,
        type: 'Node',
        x,
        y,
        properties: {},
      }
      args.addNode(n)
      try {
        args.setSelectionSource('editor')
        args.selectNode(id)
      } catch {
        void 0
      }
    },
    hideTemp: () => hideTempLink(tempLinkSelRef),
    cancelPending: () => cancelPendingEdge(linkDragRef),
  })

  return () => {
    storeLayoutPositions()
    simulation.on('end.layoutCache', null)
    simulation.stop()
    simulationRef.current = null
    sceneGraphDataRef.current = null
    beforeRenderFrameRef.current = null
    try {
      resizeLayer?.destroy()
    } catch {
      void 0
    }
    cleanupHandlers()
  }
}

export const updateGraphSceneNodesPresentation = (args: {
  svgEl: SVGSVGElement
  gRef: MutableRefObject<GSelection | null>
  zoomRef: MutableRefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>
  edgeScrollEnabled?: () => boolean
  schema: GraphSchema
  documentSemanticMode?: 'document' | 'keyword'
  hoverEnabled: boolean
  zoomOnDoubleClick: boolean
  renderMediaAsNodes: boolean
  mediaPanelDensity: 'default' | 'compact'
  tempLinkSelRef: MutableRefObject<TempLinkSelection>
  linkDragRef: MutableRefObject<PendingLink | null>
  simulationRef: MutableRefObject<d3.Simulation<GraphNode, GraphEdge> | null>
  sceneGraphDataRef: MutableRefObject<GraphData | null>
  nodesSelRef: MutableRefObject<d3.Selection<SVGElement, GraphNode, SVGGElement, unknown> | null>
  groupChevronSelRef: MutableRefObject<d3.Selection<SVGPathElement, GraphNode, SVGGElement, unknown> | null>
  mediaSelRef: MutableRefObject<d3.Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown> | null>
  portHandlesSelRef: MutableRefObject<
    d3.Selection<SVGCircleElement, PortHandleDatum, SVGGElement, unknown> | null
  >
  labelsSelRef: MutableRefObject<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>
  setHoverInfo: (updater: (prev: HoverInfo | null) => HoverInfo | null) => void
  selectNode: (id: string | null) => void
  selectEdge: (id: string | null) => void
  setSelectionSource: (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => void
  addEdge: (e: GraphEdge) => void
  updateEdge: (id: string, u: Partial<GraphEdge>) => void
  getSelectedEdgeId: () => string | null
  enableEditorGestures?: boolean
  onCommitNodePosition?: (args: { id: string; x: number; y: number }) => void
  requestZoomSelection: () => void
  toggleGroupCollapsed: (id: string) => void
}) => {
  const g = args.gRef.current
  const sim = args.simulationRef.current
  const graphData = args.sceneGraphDataRef.current
  if (!g || !sim || !graphData) return

  const allGroupsForZOrder = deriveGraphGroups(graphData, { forceDocumentStructure: args.documentSemanticMode === 'document' })
  const nodeZKeyById = buildNodeZKeyById({ nodes: Array.isArray(graphData.nodes) ? (graphData.nodes as GraphNode[]) : [], groups: allGroupsForZOrder })

  const zoom = args.zoomRef.current
  const svgEl = args.svgEl
  const svg = d3.select(svgEl)

  g.selectAll('[data-kg-layer="media"]').remove()
  g.selectAll('[data-kg-layer="nodes"]').remove()
  g.selectAll('[data-kg-layer="node-chevrons"]').remove()
  g.selectAll('[data-kg-layer="port-handles"]').remove()
  g.selectAll('[data-kg-layer="labels"]').remove()

  const { nodeSel, mediaSel, portHandlesSel, groupChevronSel } = createNodesLayer({
    g,
    graphData,
    schema: args.schema,
    renderMediaAsNodes: args.renderMediaAsNodes,
    mediaPanelDensity: args.mediaPanelDensity,
    zoomOnDoubleClick: args.zoomOnDoubleClick,
    nodeZKeyById,
    tempLinkSelRef: args.tempLinkSelRef,
    linkDragRef: args.linkDragRef,
    simulation: sim,
    addEdge: args.addEdge,
    updateEdge: args.updateEdge,
    getSelectedEdgeId: args.getSelectedEdgeId,
    enableEditorGestures: args.enableEditorGestures,
    onCommitNodePosition: args.onCommitNodePosition,
    hoverEnabled: args.hoverEnabled,
    setHoverInfo: args.setHoverInfo,
    selectNode: args.selectNode,
    selectEdge: args.selectEdge,
    setSelectionSource: args.setSelectionSource,
    requestZoomSelection: args.requestZoomSelection,
    toggleGroupCollapsed: args.toggleGroupCollapsed,
    edgeScroll:
      zoom && svgEl
        ? {
            enabled: () => (typeof args.edgeScrollEnabled === 'function' ? args.edgeScrollEnabled() : true),
            panByPx: (dx, dy) => {
              svg.call(
                zoom.translateBy as unknown as (
                  sel: d3.Selection<SVGSVGElement, unknown, null, undefined>,
                  x: number,
                  y: number,
                ) => void,
                dx,
                dy,
              )
            },
          }
        : undefined,
  })

  args.nodesSelRef.current = nodeSel
  args.groupChevronSelRef.current = groupChevronSel
  args.mediaSelRef.current = mediaSel
  args.portHandlesSelRef.current = portHandlesSel

  createLabelsLayer({
    g,
    nodes: graphData.nodes,
    schema: args.schema,
    documentSemanticMode: args.documentSemanticMode,
    nodeZKeyById,
    labelsSelRef: args.labelsSelRef,
    hoverEnabled: args.hoverEnabled,
    setHoverInfo: args.setHoverInfo,
    selectNode: args.selectNode,
    selectEdge: args.selectEdge,
    setSelectionSource: args.setSelectionSource,
  })

  applyGraphCanvasZOrder(g, args.schema)
}

export const updateGraphSceneGroupsPresentation = (args: {
  gRef: MutableRefObject<GSelection | null>
  schema: GraphSchema
  graphData: GraphData
  documentSemanticMode?: 'document' | 'keyword'
  beforeRenderFrameRef: MutableRefObject<(() => void) | null>
  simulationRef: MutableRefObject<d3.Simulation<GraphNode, GraphEdge> | null>
  hoverEnabled: boolean
  setHoverInfo: (updater: (prev: HoverInfo | null) => HoverInfo | null) => void
  setSelectionSource: (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => void
  selectNode: (id: string | null) => void
  selectGroup: (id: string | null) => void
  selectGroupExpanded: (args: { id: string; nodeIds: string[]; edgeIds: string[] }) => void
  toggleGroupCollapsed: (id: string) => void
}) => {
  const g = args.gRef.current
  if (!g) return
  g.selectAll('[data-kg-layer="groups"]').remove()
  g.selectAll('[data-kg-layer="group-labels"]').remove()
  const display = deriveSceneDisplayGraph({ graphData: args.graphData })
  const edgesForDisplay = display ? display.displayEdges : ([] as GraphEdge[])

  const sim = args.simulationRef.current
  const allGroupsForZOrder = deriveGraphGroups(args.graphData, { forceDocumentStructure: args.documentSemanticMode === 'document' })
  const groupsLayer = createGroupsLayer({
    g,
    graphData: args.graphData,
    edgesForDisplay,
    schema: args.schema,
    documentSemanticMode: args.documentSemanticMode,
    groupsOverride: allGroupsForZOrder,
    simulation: sim,
    hoverEnabled: args.hoverEnabled,
    setHoverInfo: args.setHoverInfo,
    setSelectionSource: args.setSelectionSource,
    selectNode: args.selectNode,
    selectGroup: args.selectGroup,
    selectGroupExpanded: args.selectGroupExpanded,
    toggleGroupCollapsed: args.toggleGroupCollapsed,
  })
  args.beforeRenderFrameRef.current = groupsLayer?.update ? () => groupsLayer.update() : null
  
  applyGraphCanvasZOrder(g, args.schema)
}
