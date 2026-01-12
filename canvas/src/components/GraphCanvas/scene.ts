import * as d3 from 'd3'
import type { MutableRefObject, RefObject } from 'react'
import type { GraphNode, GraphEdge, GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { createZoom, buildSimulation, deriveTidyTreeDerivation } from '@/components/GraphCanvas/utils'
import { computeTidyTreeCollapseHiddenNodes } from '@/components/GraphCanvas/tidyTreeLabelLod'
import { buildNodeGroupsFromSchema, createGraphLayersLayer } from '@/components/GraphCanvas/graphLayers'
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
  graphLayersVisible: boolean
  renderMediaAsNodes: boolean
  mediaPanelDensity: 'default' | 'compact'
  initialZoomTransform?: { k: number; x: number; y: number } | null
  layoutPositionsForMode?: Record<string, { x: number; y: number }> | null
  skipInitialLayout?: boolean
  gRef: MutableRefObject<GSelection | null>
  nodesSelRef: MutableRefObject<d3.Selection<SVGElement, GraphNode, SVGGElement, unknown> | null>
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
    graphLayersVisible,
    renderMediaAsNodes,
    mediaPanelDensity,
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
    layoutCacheKey,
    setLayoutPositionsForMode,
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
          args.renderMediaAsNodes,
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

  if (layoutCacheKey && typeof setLayoutPositionsForMode === 'function') {
    simulation.on('end', () => {
      if (!graphData.nodes || !graphData.nodes.length) {
        setLayoutPositionsForMode(layoutCacheKey, null)
        return
      }
      const positions: Record<string, { x: number; y: number }> = {}
      for (let i = 0; i < graphData.nodes.length; i += 1) {
        const node = graphData.nodes[i]
        const id = String(node.id)
        if (!id) continue
        const x = typeof node.x === 'number' ? node.x : null
        const y = typeof node.y === 'number' ? node.y : null
        if (x == null || y == null) continue
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue
        positions[id] = { x, y }
      }
      if (Object.keys(positions).length === 0) {
        setLayoutPositionsForMode(layoutCacheKey, null)
      } else {
        setLayoutPositionsForMode(layoutCacheKey, positions)
      }
    })
  }

  if (!skipInitialLayout) {
    applyCachedPositions()
  }

  const nodeIds = new Set<string>()
  for (let i = 0; i < graphData.nodes.length; i += 1) {
    nodeIds.add(String(graphData.nodes[i].id))
  }
  const tidyTreeDerivation =
    schema.layout?.mode === 'tidy-tree' ? deriveTidyTreeDerivation(edgesForSim, schema, nodeIds) : null

  const edgesForDisplayBase = (() => {
    const layersCfg = schema.layers || {}
    const layerMode = layersCfg.mode || 'property'
    if (schema.layout?.mode !== 'tidy-tree' || !tidyTreeDerivation || !tidyTreeDerivation.candidateEdges.length) {
      return edgesForSim
    }
    if (layerMode === 'property') return edgesForSim
    return tidyTreeDerivation.candidateEdges
  })()

  const edgesForDisplayRaw = (() => {
    const layersCfg = schema.layers || {}
    const mode = layersCfg.mode || 'property'
    const semanticCfg = layersCfg.semantic || {}
    const semanticHiddenTypes = Array.isArray(semanticCfg.hiddenNodeTypes)
      ? semanticCfg.hiddenNodeTypes.map(t => String(t || '').trim()).filter(Boolean)
      : []
    if (mode !== 'semantic' || !semanticHiddenTypes.length) return edgesForDisplayBase
    const hiddenTypeSet = new Set(semanticHiddenTypes)
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

  const tidyTreeHiddenNodeIds = (() => {
    if (schema.layout?.mode !== 'tidy-tree' || !tidyTreeDerivation) return null
    const lod = schema.performance?.lod?.tidyTree
    if (!lod) return null
    const hidden = computeTidyTreeCollapseHiddenNodes({
      nodes: graphData.nodes,
      edgesForDisplay: edgesForDisplayRaw,
      direction: tidyTreeDerivation.direction,
      lod,
    })
    return hidden.size ? hidden : null
  })()

  const edgesForDisplay = (() => {
    if (!tidyTreeHiddenNodeIds) return edgesForDisplayRaw
    return edgesForDisplayRaw.filter((e) => {
      const src = String(e.source ?? '')
      const tgt = String(e.target ?? '')
      if (!src || !tgt) return false
      if (tidyTreeHiddenNodeIds.has(src) || tidyTreeHiddenNodeIds.has(tgt)) return false
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

  const graphDataForDisplay = (() => {
    if (!tidyTreeHiddenNodeIds) return graphData
    const nodes = graphData.nodes.filter(n => !tidyTreeHiddenNodeIds.has(String(n.id)))
    return nodes.length === graphData.nodes.length ? graphData : { ...graphData, nodes }
  })()

  const { nodeSel, mediaSel } = createNodesLayer({
    g,
    graphData: graphDataForDisplay,
    edgesForDisplay,
    schema,
    tidyTreeDerivation,
    hoverEnabled,
    renderMediaAsNodes,
    mediaPanelDensity,
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
    graphLayersVisible,
  })
  nodesSelRef.current = nodeSel
  mediaSelRef.current = mediaSel

  createTempLink(g, tempLinkSelRef)

  createLabelsLayer({
    g,
    graphData: graphDataForDisplay,
    schema,
    edgesForDisplay,
    tidyTreeDerivation,
    labelsSelRef,
    renderMediaAsNodes,
    graphLayersVisible,
  })

  const nodeGroups = buildNodeGroupsFromSchema(graphData, schema)

  const { hullSel: graphLayersHullSel, centroidSel: graphLayerCentroidSel } = createGraphLayersLayer({
    g,
    nodeGroups,
    graphData,
    schema,
    graphLayersVisible,
    hoverEnabled,
    setHoverInfo,
    simulation,
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
      graphLayersHullSel,
      graphLayerCentroidSel,
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
