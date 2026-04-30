import { useEffect, useRef, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react'
import * as d3 from 'd3'
import { useShallow } from 'zustand/react/shallow'
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { SceneGroupsDerivation } from '@/lib/scene/sceneDerivation'
import { useGraphStore } from '@/hooks/useGraphStore'
import { isWorkspaceEditorOverlayOpen } from '@/features/workspace-table/workspaceTableSsot'
import { updateForceSimulationPresentation } from '@/components/GraphCanvas/simulation'
import { updateGraphSceneGroupsPresentation, updateGraphSceneNodesPresentation } from '@/components/GraphCanvas/scene'
import type { HoverInfo } from '@/components/GraphHoverTooltip'
import type { PortHandleDatum } from '@/components/GraphCanvas/portHandles'
import { computeOverlayHalfExtentsByNodeId2d } from '@/lib/render/overlayHalfExtentsByNodeId2d'
import { pipelinePerfMeasureSync } from '@/lib/pipelinePerf'

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
  frontmatterModeEnabled: boolean
  multiDimTableModeEnabled: boolean
  documentStructureBaselineLock: boolean
  canvas2dRenderer: string | null
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
  const { workspaceViewMode, workspaceCanvasPaneOpen } = useGraphStore(
    useShallow(s => ({
      workspaceViewMode: s.workspaceViewMode,
      workspaceCanvasPaneOpen: s.workspaceCanvasPaneOpen,
    })),
  )
  const workspaceOverlayOpen = isWorkspaceEditorOverlayOpen({ workspaceViewMode, workspaceCanvasPaneOpen })
  const workspaceOverlayOpenRef = useRef(workspaceOverlayOpen)
  workspaceOverlayOpenRef.current = workspaceOverlayOpen

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
    frontmatterModeEnabled,
    multiDimTableModeEnabled,
    documentStructureBaselineLock,
    canvas2dRenderer,
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
  const enableEditorGestures = !workspaceOverlayOpen && workspaceViewMode === 'editor' && String(canvas2dRenderer || '') !== 'd3Bipartite'

  const mediaOverlayNodeIdsKey = (() => {
    try {
      const ids = Array.from(mediaOverlayNodeIdSet || [])
        .map(v => String(v || '').trim())
        .filter(Boolean)
      if (ids.length <= 1) return ids.join('|')
      ids.sort((a, b) => a.localeCompare(b))
      return ids.join('|')
    } catch {
      return ''
    }
  })()

  useEffect(() => {
    const g = gRef.current
    if (!g) return
    if (
      nodesPresentationAppliedKeyRef.current ===
      `${schemaNodesPresentationJson}|${sceneWidth}|${sceneHeight}|${panelOnlyNodeIdsKey}|${mediaOverlayNodeIdsKey}|${enableEditorGestures ? 1 : 0}`
    )
      return
    if (!simulationRef.current) return
    if (!sceneGraphDataRef.current) return
    if (!activeRef.current) return
    const frozen = svgRef.current?.getAttribute('data-kg-layout-frozen') === '1'
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
    if (!frozen) {
      pipelinePerfMeasureSync({
        name: 'render',
        stage: 'presentation:forces',
        detail: {
          nodes: Array.isArray(sceneGraphDataRef.current.nodes) ? sceneGraphDataRef.current.nodes.length : 0,
          edges: edgesForSim.length,
          width: sceneWidth,
          height: sceneHeight,
        },
        run: () => updateForceSimulationPresentation({
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
        }),
      })
    }
    pipelinePerfMeasureSync({
      name: 'render',
      stage: 'presentation:nodes',
      detail: {
        nodes: Array.isArray(sceneGraphDataRef.current.nodes) ? sceneGraphDataRef.current.nodes.length : 0,
        edges: edgesForSim.length,
        overlays: mediaOverlayNodeIdSet.size,
        panelOnlyNodes: panelOnlyNodeIdSet.size,
      },
      run: () => updateGraphSceneNodesPresentation({
        svgEl: svgRef.current,
        zoomRef,
        edgeScrollEnabled: () => useGraphStore.getState().viewPinned !== true,
        gRef,
        schema: schemaValue,
        documentSemanticMode: documentSemanticMode ?? undefined,
        frontmatterModeEnabled: frontmatterModeEnabled === true,
        multiDimTableModeEnabled: multiDimTableModeEnabled === true,
        documentStructureBaselineLock: documentStructureBaselineLock === true,
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
        addEdge: e => {
          if (workspaceOverlayOpenRef.current) return
          useGraphStore.getState().addEdge(e)
        },
        updateEdge: (id, u) => {
          if (workspaceOverlayOpenRef.current) return
          useGraphStore.getState().updateEdge(id, u)
        },
        getSelectedEdgeId: () => selectedEdgeIdRef.current,
        enableEditorGestures,
        onCommitNodePosition:
          enableEditorGestures
            ? ({ id, x, y }) => {
                useGraphStore.getState().updateNode(id, { x, y })
              }
            : undefined,
        requestZoomSelection: () => useGraphStore.getState().requestZoom('selection'),
        toggleGroupCollapsed: id => useGraphStore.getState().toggleGroupCollapsed(id),
      }),
    })
    nodesPresentationAppliedKeyRef.current =
      `${schemaNodesPresentationJson}|${sceneWidth}|${sceneHeight}|${panelOnlyNodeIdsKey}|${mediaOverlayNodeIdsKey}|${enableEditorGestures ? 1 : 0}`
  }, [
    activeRef,
    coarsePointer,
    canvas2dRenderer,
    documentSemanticMode,
    edgesForSim,
    enableEditorGestures,
    gRef,
    groupChevronSelRef,
    labelsSelRef,
    linkDragRef,
    mediaOverlayNodeIdSet,
    mediaOverlayNodeIdsKey,
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
    pipelinePerfMeasureSync({
      name: 'render',
      stage: 'presentation:groups',
      detail: {
        nodes: Array.isArray(sceneGraphData.nodes) ? sceneGraphData.nodes.length : 0,
        groups: Array.isArray(sceneGroupsDerivation?.allGroups) ? sceneGroupsDerivation.allGroups.length : 0,
      },
      run: () => updateGraphSceneGroupsPresentation({
        gRef,
        schema: schemaValue,
        graphData: sceneGraphData,
        documentSemanticMode: documentSemanticMode ?? undefined,
        frontmatterModeEnabled: frontmatterModeEnabled === true,
        multiDimTableModeEnabled: multiDimTableModeEnabled === true,
        documentStructureBaselineLock: documentStructureBaselineLock === true,
        beforeRenderFrameRef,
        simulationRef,
        hoverEnabled,
        setHoverInfo: updater => setHoverInfo(prev => updater(prev)),
        setSelectionSource: src => useGraphStore.getState().setSelectionSource(src),
        selectNode: id => useGraphStore.getState().selectNode(id),
        selectGroup: id => useGraphStore.getState().selectGroup(id),
        selectGroupExpanded: x => useGraphStore.getState().selectGroupExpanded({ id: x.id, nodeIds: x.nodeIds, edgeIds: x.edgeIds }),
        toggleGroupCollapsed: id => useGraphStore.getState().toggleGroupCollapsed(id),
      }),
    })
    groupsPresentationAppliedKeyRef.current = schemaGroupsPresentationJson
  }, [
    beforeRenderFrameRef,
    coarsePointer,
    documentSemanticMode,
    documentStructureBaselineLock,
    frontmatterModeEnabled,
    gRef,
    groupsPresentationAppliedKeyRef,
    schemaGroupsPresentationJson,
    schemaRef,
    sceneGraphData,
    setHoverInfo,
    simulationRef,
    multiDimTableModeEnabled,
  ])
}
