import * as d3 from 'd3'
import type { MutableRefObject, RefObject } from 'react'
import type { GraphNode, GraphEdge, GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { createZoom, buildSimulation, deriveTidyTreeDerivation } from '@/components/GraphCanvas/utils'
import { buildNodeGroupsFromSchema, createPolygonsLayer } from '@/components/GraphCanvas/polygons'
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation'
import { hideTempLink, cancelPendingEdge } from '@/features/edge-creation'
import type { HoverInfo } from '@/components/GraphHoverTooltip'
import { applySelectionHighlight } from '@/components/GraphCanvas/highlight'
import { createDefs, createLinksLayer, createNodesLayer, createTempLink, createLabelsLayer } from '@/components/GraphCanvas/sceneLayers'
import { attachGlobalHandlers, attachSimulationTick } from '@/components/GraphCanvas/sceneHandlers'

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
  polygonsVisible: boolean
  initialZoomTransform?: { k: number; x: number; y: number } | null
  layoutPositionsForMode?: Record<string, { x: number; y: number }> | null
  skipInitialLayout?: boolean
  gRef: MutableRefObject<GSelection | null>
  nodesSelRef: MutableRefObject<d3.Selection<SVGCircleElement, GraphNode, SVGGElement, unknown> | null>
  mediaSelRef: MutableRefObject<d3.Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown> | null>
  linksSelRef: MutableRefObject<d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null>
  labelsSelRef: MutableRefObject<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>
  zoomRef: MutableRefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>
  tempLinkSelRef: MutableRefObject<TempLinkSelection>
  linkDragRef: MutableRefObject<PendingLink | null>
  isEditModeRef: MutableRefObject<boolean>
  selectedEdgeIdRef: MutableRefObject<string | null>
  selectedNodeIdRef: MutableRefObject<string | null>
  selectedNodeIdsRef: MutableRefObject<string[] | undefined>
  selectedEdgeIdsRef: MutableRefObject<string[] | undefined>
  selectNode: (id: string | null) => void
  selectEdge: (id: string | null) => void
  setSelectionSource: (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => void
  addEdge: (e: GraphEdge) => void
  updateEdge: (id: string, u: Partial<GraphEdge>) => void
  setHoverInfo: (updater: (prev: HoverInfo | null) => HoverInfo | null) => void
  setLifecycleStageRendering: () => void
  requestZoomSelection: () => void
  onZoomTransform: (t: { k: number; x: number; y: number }) => void
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
    polygonsVisible,
    initialZoomTransform,
    layoutPositionsForMode,
    skipInitialLayout,
    gRef,
    nodesSelRef,
    mediaSelRef,
    linksSelRef,
    labelsSelRef,
    zoomRef,
    tempLinkSelRef,
    linkDragRef,
    isEditModeRef,
    selectedEdgeIdRef,
    selectedNodeIdRef,
    selectedNodeIdsRef,
    selectedEdgeIdsRef,
    selectNode,
    selectEdge,
    setSelectionSource,
    addEdge,
    updateEdge,
    setHoverInfo,
    setLifecycleStageRendering,
    requestZoomSelection,
    onZoomTransform,
  } = args

  const svg = d3.select(svgEl)
  svg.selectAll('*').remove()

  const g = svg.append('g')
  gRef.current = g

  createDefs(svg)

  const zoom = createZoom(svg, g, labelsSelRef, schema, onZoomTransform, () => {
    if (!nodesSelRef.current && !labelsSelRef.current && !linksSelRef.current && !mediaSelRef.current) return
    applySelectionHighlight(
      nodesSelRef.current,
      mediaSelRef.current,
      labelsSelRef.current,
      linksSelRef.current,
      graphData,
      schema,
      selectedNodeIdRef.current,
      selectedEdgeIdRef.current,
      selectedNodeIdsRef.current,
      selectedEdgeIdsRef.current,
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
    if (!layoutPositionsForMode || Object.keys(layoutPositionsForMode).length === 0) return
    for (let i = 0; i < graphData.nodes.length; i += 1) {
      const node = graphData.nodes[i]
      const p = layoutPositionsForMode[String(node.id)]
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
  }

  const simulation = buildSimulation(graphData.nodes, edgesForSim, Math.max(1, width), Math.max(1, Math.floor(height)), schema, {
    skipInitialLayout: !!skipInitialLayout,
  })

  if (!skipInitialLayout) {
    applyCachedPositions()
  }

  const nodeGroups = buildNodeGroupsFromSchema(graphData, schema)

  const polygonSel = createPolygonsLayer({
    g,
    nodeGroups,
    graphData,
    schema,
    polygonsVisible,
  })

  const nodeIds = new Set<string>()
  for (let i = 0; i < graphData.nodes.length; i += 1) {
    nodeIds.add(String(graphData.nodes[i].id))
  }
  const tidyTreeDerivation =
    schema.layout?.mode === 'tidy-tree' ? deriveTidyTreeDerivation(edgesForSim, schema, nodeIds) : null

  const edgesForDisplayBase = (() => {
    if (schema.layout?.mode !== 'tidy-tree' || !tidyTreeDerivation || !tidyTreeDerivation.candidateEdges.length) {
      return edgesForSim
    }
    const direction = tidyTreeDerivation.direction
    const candidateEdges = tidyTreeDerivation.candidateEdges
    const parentByChild = new Map<string, string>()
    const treeEdgeIds = new Set<string>()
    for (let i = 0; i < candidateEdges.length; i += 1) {
      const e = candidateEdges[i]
      const src = String(e.source)
      const tgt = String(e.target)
      const parent = direction === 'source-target' ? src : tgt
      const child = direction === 'source-target' ? tgt : src
      if (!parent || !child) continue
      if (parent === child) continue
      if (!nodeIds.has(parent) || !nodeIds.has(child)) continue
      const childId = String(child)
      if (parentByChild.has(childId)) continue
      parentByChild.set(childId, String(parent))
      const edgeId = String(e.id)
      if (edgeId) treeEdgeIds.add(edgeId)
    }
    if (!treeEdgeIds.size) return candidateEdges
    const treeEdges = candidateEdges.filter(e => treeEdgeIds.has(String(e.id)))
    return treeEdges.length ? treeEdges : candidateEdges
  })()

  const edgesForDisplay = (() => {
    const mode = schema.layers?.mode || 'property'
    if (mode !== 'semantic') return edgesForDisplayBase
    const hiddenTypeSet = new Set(['Document', 'Section', 'Paragraph', 'CodeBlock', 'Table', 'List', 'ListItem'])
    const hiddenNodeIds = new Set<string>()
    for (let i = 0; i < graphData.nodes.length; i += 1) {
      const n = graphData.nodes[i]
      const t = String(n.type || '')
      if (!t) continue
      if (hiddenTypeSet.has(t)) hiddenNodeIds.add(String(n.id))
    }
    if (!hiddenNodeIds.size) return edgesForDisplayBase
    return edgesForDisplayBase.filter((e) => {
      const src = String(e.source ?? '')
      const tgt = String(e.target ?? '')
      if (!src || !tgt) return false
      if (hiddenNodeIds.has(src) || hiddenNodeIds.has(tgt)) return false
      return true
    })
  })()

  const linkSel = createLinksLayer({
    g,
    edgesForDisplay,
    schema,
    hoverEnabled,
    setHoverInfo,
    setSelectionSource,
    selectNode,
    selectEdge,
  })
  linksSelRef.current = linkSel

  const { nodeSel, mediaSel } = createNodesLayer({
    g,
    graphData,
    edgesForDisplay,
    schema,
    tidyTreeDerivation,
    hoverEnabled,
    zoomOnDoubleClick,
    isEditModeRef,
    selectedEdgeIdRef,
    tempLinkSelRef,
    linkDragRef,
    simulation,
    selectNode,
    selectEdge,
    setSelectionSource,
    addEdge,
    updateEdge,
    setHoverInfo,
    requestZoomSelection,
  })
  nodesSelRef.current = nodeSel
  mediaSelRef.current = mediaSel

  createTempLink(g, tempLinkSelRef)

  createLabelsLayer({
    g,
    graphData,
    schema,
    edgesForDisplay,
    tidyTreeDerivation,
    labelsSelRef,
  })

  if (labelsSelRef.current) {
    const hideBelow = schema.performance?.lod?.hideLabelsBelowScale ?? 0
    const k = d3.zoomTransform(svgEl).k || 1
    const hidden = hideBelow > 0 && k < hideBelow
    labelsSelRef.current.attr('data-zoom-lod-hidden', hidden ? '1' : '0')
    attachSimulationTick({
      svgEl,
      simulation,
      nodeSel,
      mediaSel,
      linkSel,
      labelsSel: labelsSelRef.current,
      polygonSel,
      nodeGroups,
      nodes: graphData.nodes,
      schema,
      tidyTreeDerivation,
      width,
      height,
    })
  }

  if (schema.layout?.mode === 'radial' || schema.layout?.mode === 'tidy-tree') {
    simulation.stop()
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
    simulation.stop()
    cleanupHandlers()
  }
}
