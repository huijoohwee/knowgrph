import { useEffect, useMemo, useRef, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react'
import * as d3 from 'd3'
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { SceneGroupsDerivation } from '@/lib/scene/sceneDerivation'
import { useGraphStore } from '@/hooks/useGraphStore'
import { isWorkspaceEditorOverlayOpen } from '@/features/workspace-table/workspaceTableSsot'
import { updateForceSimulationPresentation } from '@/components/GraphCanvas/simulation'
import { updateGraphSceneGroupsPresentation, updateGraphSceneNodesPresentation } from '@/components/GraphCanvas/scene'
import { buildGraphCanvasStoreActionAdapters } from '@/components/GraphCanvasRoot/utils/graphStoreActionAdapters'
import type { NodeHalfExtents } from '@/components/GraphCanvas/layout/overlap'
import type { HoverInfo } from '@/components/GraphHoverTooltip'
import type { PortHandleDatum } from '@/components/GraphCanvas/portHandles'
import { computeOverlayHalfExtentsByNodeId2d } from '@/lib/render/overlayHalfExtentsByNodeId2d'
import { readOverlaySizingInputFromStoreState } from '@/lib/render/overlaySizing2d'
import { pipelinePerfMeasureSync } from '@/lib/pipelinePerf'
import { getCachedGraphLookup } from '@/lib/graph/lookupCache'

function mergeStableOverlayHalfExtents(args: {
  nodeById: ReadonlyMap<string, GraphNode>
  computed: Record<string, NodeHalfExtents> | null
  panelOnlyNodeIdSet: Set<string>
  mediaOverlayNodeIdSet: Set<string>
  lastStableByNodeId: Map<string, NodeHalfExtents>
}): Record<string, NodeHalfExtents> | null {
  const nodeIds = new Set<string>()
  for (const id of args.panelOnlyNodeIdSet) {
    const trimmed = String(id || '').trim()
    if (trimmed) nodeIds.add(trimmed)
  }
  for (const id of args.mediaOverlayNodeIdSet) {
    const trimmed = String(id || '').trim()
    if (trimmed) nodeIds.add(trimmed)
  }
  if (nodeIds.size === 0) return args.computed
  const out: Record<string, NodeHalfExtents> = args.computed ? { ...args.computed } : {}
  let changed = false
  for (const id of nodeIds) {
    const node = args.nodeById.get(id)
    const props =
      node?.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)
        ? (node.properties as Record<string, unknown>)
        : null
    const w = typeof props?.['visual:width'] === 'number' && Number.isFinite(props['visual:width']) ? (props['visual:width'] as number) : null
    const h = typeof props?.['visual:height'] === 'number' && Number.isFinite(props['visual:height']) ? (props['visual:height'] as number) : null
    if (w != null && h != null && w > 0 && h > 0) {
      const stable = { halfW: Math.max(1, w / 2), halfH: Math.max(1, h / 2) }
      args.lastStableByNodeId.set(id, stable)
      out[id] = stable
      changed = true
      continue
    }
    const lastStable = args.lastStableByNodeId.get(id)
    if (!lastStable) continue
    out[id] = lastStable
    changed = true
  }
  if (!changed) return args.computed
  return Object.keys(out).length > 0 ? out : null
}

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
  const workspaceViewMode = useGraphStore(s => s.workspaceViewMode)
  const workspaceOverlayOpenRef = useRef(false)
  useEffect(() => {
    const sync = (mode: 'canvas' | 'editor') => {
      workspaceOverlayOpenRef.current = isWorkspaceEditorOverlayOpen({
        workspaceViewMode: mode,
        workspaceCanvasPaneOpen: true,
      })
    }
    const state = useGraphStore.getState()
    sync(state.workspaceViewMode)
    return useGraphStore.subscribe(
      s => s.workspaceViewMode,
      next => {
        sync(next)
      },
    )
  }, [])
  const lastStableOverlayHalfExtentsByNodeIdRef = useRef<Map<string, NodeHalfExtents>>(new Map())

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
  const enableEditorGestures = workspaceViewMode === 'editor' && String(canvas2dRenderer || '') !== 'flowchart'
  const graphStoreActions = useMemo(
    () =>
      buildGraphCanvasStoreActionAdapters({
        setHoverInfo,
        workspaceOverlayOpenRef,
        enableNodePositionCommit: enableEditorGestures,
      }),
    [enableEditorGestures, setHoverInfo],
  )

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
      const sceneNodes = Array.isArray(sceneGraphDataRef.current.nodes) ? (sceneGraphDataRef.current.nodes as GraphNode[]) : []
      const sceneGraphLookup = getCachedGraphLookup({
        cacheScope: 'graph-canvas-root-presentation-scene-graph',
        graphData: sceneGraphDataRef.current,
        preferCurrentGraphDataRefs: true,
      })
      const computedOverlayHalfExtentsByNodeId = computeOverlayHalfExtentsByNodeId2d({
        nodes: sceneNodes,
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
        overlaySizing: readOverlaySizingInputFromStoreState(useGraphStore.getState()),
      })
      const stableOverlayHalfExtentsByNodeId = mergeStableOverlayHalfExtents({
        nodeById: sceneGraphLookup?.nodeById || new Map<string, GraphNode>(),
        computed: computedOverlayHalfExtentsByNodeId,
        panelOnlyNodeIdSet,
        mediaOverlayNodeIdSet,
        lastStableByNodeId: lastStableOverlayHalfExtentsByNodeIdRef.current,
      })
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
          nodes: sceneNodes,
          edges: edgesForSim,
          width: sceneWidth,
          height: sceneHeight,
          schema: schemaValue,
          groupKeyOf,
          groupsForBboxCollide: sceneGroupsDerivation?.allGroups || [],
          nodeHalfExtentsByNodeId: stableOverlayHalfExtentsByNodeId,
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
        setHoverInfo: graphStoreActions.setHoverInfo,
        selectNode: graphStoreActions.selectNode,
        selectEdge: graphStoreActions.selectEdge,
        setSelectionSource: graphStoreActions.setSelectionSource,
        addEdge: graphStoreActions.addEdge,
        updateEdge: graphStoreActions.updateEdge,
        getSelectedEdgeId: () => selectedEdgeIdRef.current,
        enableEditorGestures,
        onCommitNodePosition: graphStoreActions.onCommitNodePosition,
        requestZoomSelection: graphStoreActions.requestZoomSelection,
        toggleGroupCollapsed: graphStoreActions.toggleGroupCollapsed,
      }),
    })
    nodesPresentationAppliedKeyRef.current =
      `${schemaNodesPresentationJson}|${sceneWidth}|${sceneHeight}|${panelOnlyNodeIdsKey}|${mediaOverlayNodeIdsKey}|${enableEditorGestures ? 1 : 0}`
  }, [
    activeRef,
    coarsePointer,
    canvas2dRenderer,
    documentSemanticMode,
    documentStructureBaselineLock,
    edgesForSim,
    enableEditorGestures,
    frontmatterModeEnabled,
    gRef,
    graphStoreActions,
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
    multiDimTableModeEnabled,
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
        setHoverInfo: graphStoreActions.setHoverInfo,
        setSelectionSource: graphStoreActions.setSelectionSource,
        selectNode: graphStoreActions.selectNode,
        selectGroup: graphStoreActions.selectGroup,
        selectGroupExpanded: graphStoreActions.selectGroupExpanded,
        toggleGroupCollapsed: graphStoreActions.toggleGroupCollapsed,
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
    graphStoreActions,
    groupsPresentationAppliedKeyRef,
    schemaGroupsPresentationJson,
    schemaRef,
    sceneGraphData,
    sceneGroupsDerivation?.allGroups,
    setHoverInfo,
    simulationRef,
    multiDimTableModeEnabled,
  ])
}
