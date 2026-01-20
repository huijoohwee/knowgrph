import * as d3 from 'd3'
import type { MutableRefObject, RefObject } from 'react'
import type { GraphNode, GraphEdge, GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { createZoom } from '@/components/GraphCanvas/zoom'
import { buildSimulation } from '@/components/GraphCanvas/simulation'
import { fitAllTransform } from '@/components/GraphCanvas/fit'
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation'
import { hideTempLink, cancelPendingEdge } from '@/features/edge-creation'
import type { HoverInfo } from '@/components/GraphHoverTooltip'
import { applySelectionHighlight } from '@/components/GraphCanvas/highlight'
import { createDefs, createGroupsLayer, createLinksHitLayer, createLinksLayer, createEdgeLabelsLayer, createNodesLayer, createTempLink, createLabelsLayer } from '@/components/GraphCanvas/sceneLayers'
import { attachGlobalHandlers, attachSimulationTick } from '@/components/GraphCanvas/sceneHandlers'
import type { PortHandleDatum } from '@/components/GraphCanvas/portHandles'

type GSelection = d3.Selection<SVGGElement, unknown, null, undefined>

type SetupGraphSceneArgs = {
  svgEl: SVGSVGElement
  svgRef: RefObject<SVGSVGElement>
  graphData: GraphData
  schema: GraphSchema
  edgesForSim: GraphEdge[]
  width: number
  height: number
  hoverEnabled: boolean
  zoomOnDoubleClick: boolean
  renderMediaAsNodes: boolean
  mediaPanelDensity: 'default' | 'compact'
  initialZoomTransform?: { k: number; x: number; y: number } | null
  layoutPositionsForMode?: Record<string, { x: number; y: number }> | null
  prevPositions?: Record<string, { x: number; y: number }> | null
  skipInitialLayout?: boolean
  gRef: MutableRefObject<GSelection | null>
  nodesSelRef: MutableRefObject<d3.Selection<SVGElement, GraphNode, SVGGElement, unknown> | null>
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
  setSelectionSource: (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => void
  addEdge: (e: GraphEdge) => void
  updateEdge: (id: string, u: Partial<GraphEdge>) => void
  setHoverInfo: (updater: (prev: HoverInfo | null) => HoverInfo | null) => void
  setLifecycleStageRendering: () => void
  requestZoomSelection: () => void
  onZoomTransform: (t: { k: number; x: number; y: number }) => void
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
    schema,
    edgesForSim,
    width,
    height,
    hoverEnabled,
    zoomOnDoubleClick,
    renderMediaAsNodes,
    mediaPanelDensity,
    initialZoomTransform,
    layoutPositionsForMode,
    prevPositions,
    skipInitialLayout,
    gRef,
    nodesSelRef,
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

  const displayNodes = Array.isArray(graphData.nodes)
    ? graphData.nodes.filter(n => {
        if (String(n.type || '') === 'MermaidSubgraph') return false
        const props = (n.properties || {}) as Record<string, unknown>
        const isHeadingSection = String(n.type || '') === 'Section' && typeof props.level === 'number'
        return !isHeadingSection
      })
    : []
  const displayNodeIdSet = new Set<string>(displayNodes.map(n => String(n.id)))
  const edgesForDisplay = (edgesForSim || []).filter(e => {
    const s = String(e.source || '')
    const t = String(e.target || '')
    if (!s || !t) return false
    if (!displayNodeIdSet.has(s) || !displayNodeIdSet.has(t)) return false
    if (e.label === 'hasMermaidNode' || e.label === 'hasMermaidSubgraph' || e.label === 'hasMermaid') return false
    return true
  })
  const graphDataForDisplay: GraphData = { ...graphData, nodes: displayNodes, edges: edgesForDisplay }
  sceneGraphDataRef.current = graphDataForDisplay

  const zoom = createZoom(svg, g, labelsSelRef, schema, onZoomTransform, () => {
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
  if (initialZoomTransform) {
    const k = typeof initialZoomTransform.k === 'number' && Number.isFinite(initialZoomTransform.k) ? initialZoomTransform.k : 1
    const x = typeof initialZoomTransform.x === 'number' && Number.isFinite(initialZoomTransform.x) ? initialZoomTransform.x : 0
    const y = typeof initialZoomTransform.y === 'number' && Number.isFinite(initialZoomTransform.y) ? initialZoomTransform.y : 0
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

  const simulation = buildSimulation(displayNodes, edgesForDisplay, Math.max(1, width), Math.max(1, Math.floor(height)), schema, {
    skipInitialLayout: !!skipInitialLayout,
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
    selectGroup,
    selectGroupExpanded,
  })
  beforeRenderFrameRef.current = groupsLayer?.update ? () => groupsLayer.update() : null

  // Fit to screen logic for clean slate
  if (!initialZoomTransform) {
    const padding = schema.layout?.fitPadding
    const useCentroid = schema.layout?.fitUseCentroid
    const detectClusters = schema.layout?.fitDetectClusters
    const targetAspectRatio = schema.layout?.fitTargetAspectRatio
    const enforceAspectRatio = schema.layout?.fitEnforceAspectRatio

    const commonOpts = {
      pad: typeof padding === 'number' && Number.isFinite(padding) ? Math.max(20, Math.min(160, Math.floor(padding))) : 80,
      useCentroidCentering: useCentroid !== false,
      detectClusters: detectClusters !== false,
      targetAspectRatio: typeof targetAspectRatio === 'number' && Number.isFinite(targetAspectRatio) ? targetAspectRatio : 1.777,
      enforceAspectRatio: enforceAspectRatio !== false,
      schema,
    }

    const t = fitAllTransform(graphDataForDisplay.nodes, width, height, commonOpts)

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

  const { nodeSel, mediaSel, portHandlesSel } = createNodesLayer({
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
  })
  nodesSelRef.current = nodeSel
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

  // Z-Order: Groups (bottom) -> Links -> Nodes -> PortHandles -> Labels (top)
  g.selectAll('[data-kg-layer="groups"]').lower()
  g.selectAll('[data-kg-layer="links"]').raise()
  g.selectAll('[data-kg-layer="edge-labels"]').raise()
  g.selectAll('[data-kg-layer="temp-link"]').raise()
  g.selectAll('[data-kg-layer="nodes"]').raise()
  g.selectAll('[data-kg-layer="media"]').raise()
  g.selectAll('[data-kg-layer="port-handles"]').raise()
  g.selectAll('[data-kg-layer="labels"]').raise()
  g.selectAll('[data-kg-layer="group-labels"]').raise()

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

  if (schema.layout?.mode === 'radial') {
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
    simulation.stop()
    simulationRef.current = null
    sceneGraphDataRef.current = null
    beforeRenderFrameRef.current = null
    cleanupHandlers()
  }
}

export const updateGraphSceneNodesPresentation = (args: {
  gRef: MutableRefObject<GSelection | null>
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
}) => {
  const g = args.gRef.current
  const sim = args.simulationRef.current
  const graphData = args.sceneGraphDataRef.current
  if (!g || !sim || !graphData) return

  g.selectAll('[data-kg-layer="media"]').remove()
  g.selectAll('[data-kg-layer="nodes"]').remove()
  g.selectAll('[data-kg-layer="port-handles"]').remove()
  g.selectAll('[data-kg-layer="labels"]').remove()

  const { nodeSel, mediaSel, portHandlesSel } = createNodesLayer({
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
  })

  args.nodesSelRef.current = nodeSel
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

  // Z-Order: Groups (bottom) -> Links -> Nodes -> PortHandles -> Labels (top)
  g.selectAll('[data-kg-layer="groups"]').lower()
  g.selectAll('[data-kg-layer="links"]').raise()
  g.selectAll('[data-kg-layer="edge-labels"]').raise()
  g.selectAll('[data-kg-layer="temp-link"]').raise()
  g.selectAll('[data-kg-layer="nodes"]').raise()
  g.selectAll('[data-kg-layer="media"]').raise()
  g.selectAll('[data-kg-layer="port-handles"]').raise()
  g.selectAll('[data-kg-layer="labels"]').raise()
  g.selectAll('[data-kg-layer="group-labels"]').raise()
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
  selectGroup: (id: string | null) => void
  selectGroupExpanded: (args: { id: string; nodeIds: string[]; edgeIds: string[] }) => void
}) => {
  const g = args.gRef.current
  if (!g) return
  g.selectAll('[data-kg-layer="groups"]').remove()
  g.selectAll('[data-kg-layer="group-labels"]').remove()
  const displayNodes = Array.isArray(args.graphData.nodes)
    ? args.graphData.nodes.filter(n => {
        if (String(n.type || '') === 'MermaidSubgraph') return false
        const props = (n.properties || {}) as Record<string, unknown>
        const isHeadingSection = String(n.type || '') === 'Section' && typeof props.level === 'number'
        return !isHeadingSection
      })
    : []
  const displayNodeIdSet = new Set<string>(displayNodes.map(n => String(n.id)))
  const edgesForDisplay = Array.isArray(args.graphData.edges)
    ? args.graphData.edges.filter(e => {
        const s = String(e.source || '')
        const t = String(e.target || '')
        if (!s || !t) return false
        if (!displayNodeIdSet.has(s) || !displayNodeIdSet.has(t)) return false
        if (e.label === 'hasMermaidNode' || e.label === 'hasMermaidSubgraph' || e.label === 'hasMermaid') return false
        return true
      })
    : []

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
    selectGroup: args.selectGroup,
    selectGroupExpanded: args.selectGroupExpanded,
  })
  args.beforeRenderFrameRef.current = groupsLayer?.update ? () => groupsLayer.update() : null
  
  // Z-Order: Groups (bottom) -> Links -> Nodes -> PortHandles -> Labels (top)
  g.selectAll('[data-kg-layer="groups"]').lower()
  g.selectAll('[data-kg-layer="links"]').raise()
  g.selectAll('[data-kg-layer="edge-labels"]').raise()
  g.selectAll('[data-kg-layer="temp-link"]').raise()
  g.selectAll('[data-kg-layer="nodes"]').raise()
  g.selectAll('[data-kg-layer="media"]').raise()
  g.selectAll('[data-kg-layer="port-handles"]').raise()
  g.selectAll('[data-kg-layer="labels"]').raise()
  g.selectAll('[data-kg-layer="group-labels"]').raise()
}
