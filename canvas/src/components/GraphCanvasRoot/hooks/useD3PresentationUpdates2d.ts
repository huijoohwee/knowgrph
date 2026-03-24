import { useEffect, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react'
import * as d3 from 'd3'
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { SceneGroupsDerivation } from '@/lib/scene/sceneDerivation'
import { useGraphStore } from '@/hooks/useGraphStore'
import { updateForceSimulationPresentation } from '@/components/GraphCanvas/simulation'
import { updateGraphSceneGroupsPresentation, updateGraphSceneNodesPresentation } from '@/components/GraphCanvas/scene'
import type { HoverInfo } from '@/components/GraphHoverTooltip'
import type { PortHandleDatum } from '@/components/GraphCanvas/portHandles'
import { computeOverlayHalfExtentsByNodeId2d } from '@/lib/render/overlayHalfExtentsByNodeId2d'

export function useD3PresentationUpdates2d(args: {
  activeRef: MutableRefObject<boolean>
  svgRef: RefObject<SVGSVGElement | null>
  gRef: MutableRefObject<d3.Selection<SVGGElement, unknown, null, undefined> | null>
  zoomRef: MutableRefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>
  simulationRef: MutableRefObject<d3.Simulation<GraphNode, GraphEdge> | null>
  sceneGraphDataRef: MutableRefObject<GraphData | null>
  sceneGraphData: GraphData | null
  schemaRef: MutableRefObject<GraphSchema>
  documentSemanticMode: 'document' | 'keyword'
  coarsePointer: boolean
  sceneWidth: number
  sceneHeight: number
  schemaNodesPresentationJson: string
  schemaGroupsPresentationJson: string
  nodesPresentationAppliedKeyRef: MutableRefObject<string | null>
  groupsPresentationAppliedKeyRef: MutableRefObject<string | null>
  edgesForSim: GraphEdge[]
  sceneGroupsDerivation: SceneGroupsDerivation | null
  renderMediaAsNodes: boolean
  mediaPanelDensity: 'default' | 'compact'
  mediaOverlayNodeIdSet: Set<string>
  panelOnlyNodeIdsKey: string
  panelOnlyNodeIdSet: Set<string>
  tempLinkSelRef: MutableRefObject<TempLinkSelection>
  linkDragRef: MutableRefObject<PendingLink | null>
  nodesSelRef: MutableRefObject<d3.Selection<SVGElement, GraphNode, SVGGElement, unknown> | null>
  groupChevronSelRef: MutableRefObject<d3.Selection<SVGPathElement, GraphNode, SVGGElement, unknown> | null>
  mediaSelRef: MutableRefObject<d3.Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown> | null>
  portHandlesSelRef: MutableRefObject<d3.Selection<SVGCircleElement, PortHandleDatum, SVGGElement, unknown> | null>
  labelsSelRef: MutableRefObject<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>
  beforeRenderFrameRef: MutableRefObject<(() => void) | null>
  selectedEdgeIdRef: MutableRefObject<string | null>
  setHoverInfo: Dispatch<SetStateAction<HoverInfo | null>>
}): void {
  const {
    activeRef,
    svgRef,
    gRef,
    zoomRef,
    simulationRef,
    sceneGraphDataRef,
    sceneGraphData,
    schemaRef,
    documentSemanticMode,
    coarsePointer,
    sceneWidth,
    sceneHeight,
    schemaNodesPresentationJson,
    schemaGroupsPresentationJson,
    nodesPresentationAppliedKeyRef,
    groupsPresentationAppliedKeyRef,
    edgesForSim,
    sceneGroupsDerivation,
    renderMediaAsNodes,
    mediaPanelDensity,
    mediaOverlayNodeIdSet,
    panelOnlyNodeIdsKey,
    panelOnlyNodeIdSet,
    tempLinkSelRef,
    linkDragRef,
    nodesSelRef,
    groupChevronSelRef,
    mediaSelRef,
    portHandlesSelRef,
    labelsSelRef,
    beforeRenderFrameRef,
    selectedEdgeIdRef,
    setHoverInfo,
  } = args

  useEffect(() => {
    const g = gRef.current
    if (!g) return
    if (nodesPresentationAppliedKeyRef.current === `${schemaNodesPresentationJson}|${sceneWidth}|${sceneHeight}|${panelOnlyNodeIdsKey}`) return
    if (!simulationRef.current) return
    if (!sceneGraphDataRef.current) return
    if (!activeRef.current) return
    if (svgRef.current?.getAttribute('data-kg-layout-frozen') === '1') return
    const schemaValue = schemaRef.current
    const hoverEnabled = schemaValue.behavior?.hover?.enabled !== false && !coarsePointer
    const expansionCfg = schemaValue.behavior?.expansion || {}
    const expansionEnabled = expansionCfg.enabled !== false
    const zoomOnDoubleClick = expansionEnabled && expansionCfg.zoomOnDoubleClick !== false

    const groupKeyByNodeId = sceneGroupsDerivation?.layoutGroupKeyByNodeId || null
    const groupKeyOf = (n: GraphNode): string | null => {
      const id = String(n.id || '').trim()
      if (!id || !groupKeyByNodeId) return null
      return groupKeyByNodeId[id] || null
    }
    updateForceSimulationPresentation({
      simulation: simulationRef.current,
      nodes: Array.isArray(sceneGraphDataRef.current.nodes) ? (sceneGraphDataRef.current.nodes as GraphNode[]) : [],
      edges: edgesForSim,
      width: sceneWidth,
      height: sceneHeight,
      schema: schemaValue,
      groupKeyOf,
      groupsForBboxCollide: sceneGroupsDerivation?.allGroups || [],
      nodeHalfExtentsByNodeId: computeOverlayHalfExtentsByNodeId2d({
        nodes: Array.isArray(sceneGraphDataRef.current.nodes) ? (sceneGraphDataRef.current.nodes as GraphNode[]) : [],
        panelOnlyNodeIdSet,
        mediaOverlayNodeIdSet,
        viewportW: Math.max(1, Math.floor(sceneWidth)),
        zoomK: (() => {
          try {
            const el = svgRef.current
            if (!el) return 1
            const k = d3.zoomTransform(el).k
            return typeof k === 'number' && Number.isFinite(k) && k > 0 ? k : 1
          } catch {
            return 1
          }
        })(),
        mediaPanelDensity,
        overlaySizing: {
          overlayBaseWidthRatioDefault: (useGraphStore.getState() as any).threeIframeOverlayBaseWidthRatioDefault,
          overlayBaseWidthRatioCompact: (useGraphStore.getState() as any).threeIframeOverlayBaseWidthRatioCompact,
          overlayBaseWidthMinPxDefault: (useGraphStore.getState() as any).threeIframeOverlayBaseWidthMinPxDefault,
          overlayBaseWidthMinPxCompact: (useGraphStore.getState() as any).threeIframeOverlayBaseWidthMinPxCompact,
          overlayBaseWidthMaxPxDefault: (useGraphStore.getState() as any).threeIframeOverlayBaseWidthMaxPxDefault,
          overlayBaseWidthMaxPxCompact: (useGraphStore.getState() as any).threeIframeOverlayBaseWidthMaxPxCompact,
        },
      }),
    })
    updateGraphSceneNodesPresentation({
      svgEl: svgRef.current,
      zoomRef,
      edgeScrollEnabled: () => useGraphStore.getState().viewPinned !== true,
      gRef,
      schema: schemaValue,
      documentSemanticMode: documentSemanticMode ?? undefined,
      hoverEnabled,
      zoomOnDoubleClick,
      renderMediaAsNodes,
      mediaOverlayNodeIdSet,
      panelOnlyNodeIdSet,
      mediaPanelDensity,
      tempLinkSelRef,
      linkDragRef,
      simulationRef,
      sceneGraphDataRef,
      nodesSelRef,
      groupChevronSelRef,
      mediaSelRef,
      portHandlesSelRef,
      labelsSelRef,
      setHoverInfo: updater => setHoverInfo(prev => updater(prev)),
      selectNode: id => useGraphStore.getState().selectNode(id),
      selectEdge: id => useGraphStore.getState().selectEdge(id),
      setSelectionSource: src => useGraphStore.getState().setSelectionSource(src),
      addEdge: e => useGraphStore.getState().addEdge(e),
      updateEdge: (id, u) => useGraphStore.getState().updateEdge(id, u),
      getSelectedEdgeId: () => selectedEdgeIdRef.current,
      enableEditorGestures: useGraphStore.getState().workspaceViewMode === 'editor',
      onCommitNodePosition:
        useGraphStore.getState().workspaceViewMode === 'editor'
          ? ({ id, x, y }) => {
              useGraphStore.getState().updateNode(id, { x, y })
            }
          : undefined,
      requestZoomSelection: () => useGraphStore.getState().requestZoom('selection'),
      toggleGroupCollapsed: id => useGraphStore.getState().toggleGroupCollapsed(id),
    })
    nodesPresentationAppliedKeyRef.current = `${schemaNodesPresentationJson}|${sceneWidth}|${sceneHeight}|${panelOnlyNodeIdsKey}`
  }, [
    activeRef,
    coarsePointer,
    documentSemanticMode,
    edgesForSim,
    gRef,
    groupChevronSelRef,
    labelsSelRef,
    linkDragRef,
    mediaOverlayNodeIdSet,
    mediaPanelDensity,
    panelOnlyNodeIdsKey,
    panelOnlyNodeIdSet,
    mediaSelRef,
    nodesPresentationAppliedKeyRef,
    nodesSelRef,
    portHandlesSelRef,
    renderMediaAsNodes,
    sceneGraphDataRef,
    sceneGroupsDerivation?.allGroups,
    sceneGroupsDerivation?.layoutGroupKeyByNodeId,
    sceneHeight,
    sceneWidth,
    schemaNodesPresentationJson,
    schemaRef,
    selectedEdgeIdRef,
    setHoverInfo,
    simulationRef,
    svgRef,
    tempLinkSelRef,
    zoomRef,
  ])

  useEffect(() => {
    const g = gRef.current
    if (!g) return
    if (groupsPresentationAppliedKeyRef.current === schemaGroupsPresentationJson) return
    const schemaValue = schemaRef.current
    if (!sceneGraphData) return
    const hoverEnabled = schemaValue.behavior?.hover?.enabled !== false && !coarsePointer
    updateGraphSceneGroupsPresentation({
      gRef,
      schema: schemaValue,
      graphData: sceneGraphData,
      documentSemanticMode: documentSemanticMode ?? undefined,
      beforeRenderFrameRef,
      simulationRef,
      hoverEnabled,
      setHoverInfo: updater => setHoverInfo(prev => updater(prev)),
      setSelectionSource: src => useGraphStore.getState().setSelectionSource(src),
      selectNode: id => useGraphStore.getState().selectNode(id),
      selectGroup: id => useGraphStore.getState().selectGroup(id),
      selectGroupExpanded: x => useGraphStore.getState().selectGroupExpanded({ id: x.id, nodeIds: x.nodeIds, edgeIds: x.edgeIds }),
      toggleGroupCollapsed: id => useGraphStore.getState().toggleGroupCollapsed(id),
    })
    groupsPresentationAppliedKeyRef.current = schemaGroupsPresentationJson
  }, [
    beforeRenderFrameRef,
    coarsePointer,
    documentSemanticMode,
    gRef,
    groupsPresentationAppliedKeyRef,
    schemaGroupsPresentationJson,
    schemaRef,
    sceneGraphData,
    setHoverInfo,
    simulationRef,
  ])
}
