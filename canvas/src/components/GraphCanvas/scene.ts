import * as d3 from 'd3'
import type { MutableRefObject, RefObject } from 'react'
import type { GraphNode, GraphEdge, GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { createZoom } from '@/components/GraphCanvas/zoom'
import { buildSimulation } from '@/components/GraphCanvas/simulation'
import { computeZoomTransformFromRequest } from '@/lib/zoom/actions'
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import { readFitAllOptions, readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { fitAllTransform } from '@/components/GraphCanvas/fit'
import { createLayoutGroupKeyOfNode, selectLayoutGroups } from '@/components/GraphCanvas/layout/layoutGroupKey'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation'
import { hideTempLink, cancelPendingEdge } from '@/features/edge-creation'
import type { HoverInfo } from '@/components/GraphHoverTooltip'
import { applySelectionHighlight } from '@/components/GraphCanvas/highlight'
import { createDefs, createGroupsLayer, createLinksHitLayer, createLinksLayer, createEdgeLabelsLayer, createNodesLayer, createTempLink, createLabelsLayer } from '@/components/GraphCanvas/sceneLayers'
import { attachGlobalHandlers, attachSimulationTick } from '@/components/GraphCanvas/sceneHandlers'
import { applyGraphCanvasZOrder } from '@/components/GraphCanvas/zOrder'
import type { PortHandleDatum } from '@/components/GraphCanvas/portHandles'
import { getGraphDataForDisplay } from '@/components/GraphCanvas/displayFilter'
import type { ViewportControlsPreset } from '@/lib/config.viewport-controls'

type GSelection = d3.Selection<SVGGElement, unknown, null, undefined>

type SetupGraphSceneArgs = {
  svgEl: SVGSVGElement
  svgRef: RefObject<SVGSVGElement>
  graphData: GraphData
  graphDataRevision: number
  schema: GraphSchema
  edgesForSim: GraphEdge[]
  width: number
  height: number
  hoverEnabled: boolean
  zoomOnDoubleClick: boolean
  renderMediaAsNodes: boolean
  mediaPanelDensity: 'default' | 'compact'
  fitToScreenMode?: boolean
  viewportControlsPreset: ViewportControlsPreset
  initialZoomTransform?: { k: number; x: number; y: number } | null
  layoutPositionsForMode?: Record<string, { x: number; y: number }> | null
  prevPositions?: Record<string, { x: number; y: number }> | null
  skipInitialLayout?: boolean
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
  setHoverInfo: (updater: (prev: HoverInfo | null) => HoverInfo | null) => void
  setLifecycleStageRendering: () => void
  requestZoomSelection: () => void
  onZoomTransform: (t: { k: number; x: number; y: number }) => void
  edgeScrollEnabled?: () => boolean
  getSchema: () => GraphSchema
  getRenderMediaAsNodes: () => boolean
  layoutCacheKey: string | null
  setLayoutPositionsForMode: ((key: string, positions: Record<string, { x: number; y: number }> | null) => void) | null
}

export const setupGraphScene = (args: SetupGraphSceneArgs) => {
  const {
    svgEl,
    svgRef,
    graphData,
    graphDataRevision,
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
    layoutCacheKey,
    setLayoutPositionsForMode,
  } = args

  const svg = d3.select(svgEl)
  svg.selectAll('*').remove()

  const g = svg.append('g')
  gRef.current = g

  createDefs(svg)

  const graphDataForDisplay = getGraphDataForDisplay({ graphData, edges: edgesForSim || [] })
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

  const applyCachedPositions = () => {
    const cached = layoutPositionsForMode && Object.keys(layoutPositionsForMode).length > 0 ? layoutPositionsForMode : null
    const prev = prevPositions && Object.keys(prevPositions).length > 0 ? prevPositions : null
    const source = cached || prev

    if (!source) return
    for (let i = 0; i < displayNodes.length; i += 1) {
      const node = displayNodes[i]
      const p = source[String(node.id)]
      if (!p) continue
      const x = typeof p.x === 'number' ? p.x : null
      const y = typeof p.y === 'number' ? p.y : null
      if (x == null || y == null) continue
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      node.x = x
      node.y = y
      node.vx = 0
      node.vy = 0
      node.fx = null
      node.fy = null
    }
  }

  if (skipInitialLayout) {
    applyCachedPositions()
  } else {
    // If not skipping layout, we still want to apply prev positions as initial guess for force layout
    // to avoid chaos when switching from tree -> force
    applyCachedPositions()
  }

  if (initialZoomTransform) {
    applyInitialTransform(initialZoomTransform)
  } else if (fitToScreenMode) {
    const intent = 'fitToScreen'
    const mode = readLayoutMode(schema)
    const opts = readFitAllOptions({ schema, mode, intent })
    const t = fitAllTransform(displayNodes, Math.max(1, width), Math.max(1, Math.floor(height)), opts)
    applyInitialTransform({ k: t.k, x: t.x, y: t.y })
  }

  const allGroups = deriveGraphGroups(graphDataForDisplay)
  const layoutGroups = selectLayoutGroups({ graphData: graphDataForDisplay, schema, groups: allGroups })
  const groupKeyOf = createLayoutGroupKeyOfNode({ graphData: graphDataForDisplay, schema, groups: layoutGroups })
  const simulation = buildSimulation(displayNodes, edgesForDisplay, Math.max(1, width), Math.max(1, Math.floor(height)), schema, {
    skipInitialLayout: !!skipInitialLayout,
    groupKeyOf,
    groupsForBboxCollide: allGroups,
  })
  simulationRef.current = simulation

  const groupsLayer = createGroupsLayer({
    g,
    graphData,
    edgesForDisplay,
    schema,
    simulation,
    hoverEnabled,
    setHoverInfo,
    setSelectionSource,
    selectNode,
    selectGroup,
    selectGroupExpanded,
    toggleGroupCollapsed,
  })
  beforeRenderFrameRef.current = groupsLayer?.update ? () => groupsLayer.update() : null

  // Fit to screen logic for clean slate
  if (fitToScreenMode !== false && !initialZoomTransform) {
    const [minK, maxK] = readZoomScaleExtent(schema)
    const res = computeZoomTransformFromRequest(
      { type: 'fit', intent: 'initialFit', at: Date.now() },
      {
        graphData: graphDataForDisplay,
        schema,
        graphDataRevision,
        viewportW: width,
        viewportH: height,
        pinned: false,
        selectedNodeId: null,
        selectedEdgeId: null,
        currentTransform: d3.zoomIdentity,
        scaleExtent: { minK, maxK },
        cacheKeyBase: '2d',
      },
    )
    const t = res?.nextTransform || d3.zoomIdentity
    svg.call(zoom.transform as unknown as (
      sel: d3.Selection<SVGSVGElement, unknown, null, undefined>,
      t: d3.ZoomTransform,
    ) => void, t)
  }

  // Legacy layout sync removed to prevent infinite re-render loop in Force layout mode.

  const linkHitSel = createLinksHitLayer({
    g,
    edgesForDisplay,
    schema,
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
    tempLinkSelRef,
    linkDragRef,
    simulation,
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
    labelsSelRef,
    hoverEnabled,
    setHoverInfo,
    selectNode,
    selectEdge,
    setSelectionSource,
  })
  if (labelsSelRef.current) {
    const hideBelow = schema.performance?.lod?.hideLabelsBelowScale ?? 0
    const k = d3.zoomTransform(svgEl).k || 1
    const hidden = hideBelow > 0 && k < hideBelow
    labelsSelRef.current.attr('data-zoom-lod-hidden', hidden ? '1' : '0')
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
      getSchema,
      width,
      height,
      beforeRenderFrameRef,
    })
  }

  applyGraphCanvasZOrder(g, args.schema)

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

  simulation.on('end.layoutCache', storeLayoutPositions)

  const layoutMode = readLayoutMode(schema)
  if (layoutMode === 'radial') {
    simulation.stop()
    storeLayoutPositions()
  }

  setLifecycleStageRendering()

  const cleanupHandlers = attachGlobalHandlers({
    svgRef,
    svg,
    tempLinkSelRef,
    linkDragRef,
    selectNode,
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
    cleanupHandlers()
  }
}

export const updateGraphSceneNodesPresentation = (args: {
  svgEl: SVGSVGElement
  gRef: MutableRefObject<GSelection | null>
  zoomRef: MutableRefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>
  edgeScrollEnabled?: () => boolean
  schema: GraphSchema
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
  requestZoomSelection: () => void
  toggleGroupCollapsed: (id: string) => void
}) => {
  const g = args.gRef.current
  const sim = args.simulationRef.current
  const graphData = args.sceneGraphDataRef.current
  if (!g || !sim || !graphData) return

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
    tempLinkSelRef: args.tempLinkSelRef,
    linkDragRef: args.linkDragRef,
    simulation: sim,
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
  const graphDataForDisplay = getGraphDataForDisplay({ graphData: args.graphData })
  const edgesForDisplay = Array.isArray(graphDataForDisplay.edges) ? (graphDataForDisplay.edges as GraphEdge[]) : []

  const sim = args.simulationRef.current
  const groupsLayer = createGroupsLayer({
    g,
    graphData: args.graphData,
    edgesForDisplay,
    schema: args.schema,
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
