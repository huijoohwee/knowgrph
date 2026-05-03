import { useEffect, useMemo, useRef, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react'
import * as d3 from 'd3'
import { useShallow } from 'zustand/react/shallow'
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { SceneGroupsDerivation } from '@/lib/scene/sceneDerivation'
import type { ViewportControlsPreset } from '@/lib/config.viewport-controls'
import { useGraphStore } from '@/hooks/useGraphStore'
import { isWorkspaceEditorOverlayOpen } from '@/features/workspace-table/workspaceTableSsot'
import { setupGraphScene } from '@/components/GraphCanvas/scene'
import { createRafLatestScheduler } from '@/lib/react/rafLatestScheduler'
import { commitZoomTransformToStore } from '@/lib/canvas/zoom-commit'
import { pipelinePerfMeasureSync } from '@/lib/pipelinePerf'
import { capturePrevNodePositions } from '@/components/GraphCanvasRoot/utils/capturePrevNodePositions'
import { buildD3SceneLayoutPrepContext } from '@/components/GraphCanvasRoot/utils/d3SceneLayoutPrepContext'
import { buildD3SceneSetupContext } from '@/components/GraphCanvasRoot/utils/d3SceneSetupContext'
import { buildGraphCanvasStoreActionAdapters } from '@/components/GraphCanvasRoot/utils/graphStoreActionAdapters'
import { persistPrevLayoutSnapshot } from '@/components/GraphCanvasRoot/utils/persistPrevLayoutSnapshot'
import type { HoverInfo } from '@/components/GraphHoverTooltip'
import type { PortHandleDatum } from '@/components/GraphCanvas/portHandles'
import type { FlowPortHandleDatum2d } from '@/components/GraphCanvas/flowPortHandles2d'
import type { OverlayDensitySizingConfigInput } from '@/lib/render/overlaySizing2d'

export function useD3GraphScene2d(args: {
  active: boolean
  activeRef: MutableRefObject<boolean>
  svgRef: RefObject<SVGSVGElement | null>
  gRef: MutableRefObject<d3.Selection<SVGGElement, unknown, null, undefined> | null>
  zoomRef: MutableRefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>
  simulationRef: MutableRefObject<d3.Simulation<GraphNode, GraphEdge> | null>
  sceneGraphDataRef: MutableRefObject<GraphData | null>
  sceneCleanupRef: MutableRefObject<null | (() => void)>
  sceneBuildKeyRef: MutableRefObject<string | null>
  beforeRenderFrameRef: MutableRefObject<(() => void) | null>
  beforeRenderFrameWrappedSourceRef: MutableRefObject<(() => void) | null>
  nodesSelRef: MutableRefObject<d3.Selection<SVGElement, GraphNode, SVGGElement, unknown> | null>
  groupChevronSelRef: MutableRefObject<d3.Selection<SVGPathElement, GraphNode, SVGGElement, unknown> | null>
  mediaSelRef: MutableRefObject<d3.Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown> | null>
  portHandlesSelRef: MutableRefObject<
    d3.Selection<SVGCircleElement, PortHandleDatum | FlowPortHandleDatum2d, SVGGElement, unknown> | null
  >
  linksHitSelRef: MutableRefObject<d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null>
  linksSelRef: MutableRefObject<d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null>
  labelsSelRef: MutableRefObject<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>
  tempLinkSelRef: MutableRefObject<TempLinkSelection>
  linkDragRef: MutableRefObject<PendingLink | null>
  schemaRef: MutableRefObject<GraphSchema>
  schemaLayoutEngineJson: string
  schemaNodesPresentationJson: string
  schemaGroupsPresentationJson: string
  nodesPresentationAppliedKeyRef: MutableRefObject<string | null>
  groupsPresentationAppliedKeyRef: MutableRefObject<string | null>
  activeLayoutCacheKeyRef: MutableRefObject<string | null>
  graphDataRevision: number
  graphContentRevision: number
  graphDataRevisionRef: MutableRefObject<number>
  sceneWidth: number
  sceneHeight: number
  sceneGraphData: GraphData | null
  sceneGroupsDerivation: SceneGroupsDerivation | null
  edgesForSim: GraphEdge[]
  effectiveFrontmatterModeEnabled: boolean
  multiDimTableModeEnabled: boolean
  documentStructureBaselineLock: boolean
  documentSemanticMode: 'document' | 'keyword'
  layoutSemanticModeKey: string
  canvasRenderMode: '2d' | '3d'
  canvas2dRenderer: string | null
  renderMediaAsNodes: boolean
  mediaPanelDensity: 'default' | 'compact'
  viewportControlsPreset: ViewportControlsPreset
  collapsedGroupIdsKey: string
  fitToScreenMode: boolean
  zoomToSelectionMode: boolean
  isEmbeddedPreview: boolean
  coarsePointer: boolean
  mediaOverlayNodeIdSet: Set<string>
  panelOnlyNodeIdsKey: string
  panelOnlyNodeIdSet: Set<string>
  overlaySizing?: OverlayDensitySizingConfigInput | null
  requestOverlaySchedule: () => void
  setLayoutPositionsForMode: (key: string, positions: Record<string, { x: number; y: number }>) => void
  selectedEdgeIdRef: MutableRefObject<string | null>
  selectedNodeIdRef: MutableRefObject<string | null>
  selectedNodeIdsRef: MutableRefObject<string[] | undefined>
  selectedEdgeIdsRef: MutableRefObject<string[] | undefined>
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
  const enableEditorGestures = !workspaceOverlayOpen && workspaceViewMode === 'editor' && String(args.canvas2dRenderer || '') !== 'flowchart'
  const infiniteCanvasInteractionMode = useGraphStore(s => s.infiniteCanvasInteractionMode)

  const {
    active,
    activeRef,
    svgRef,
    gRef,
    zoomRef,
    simulationRef,
    sceneGraphDataRef,
    sceneCleanupRef,
    sceneBuildKeyRef,
    beforeRenderFrameRef,
    beforeRenderFrameWrappedSourceRef,
    nodesSelRef,
    groupChevronSelRef,
    mediaSelRef,
    portHandlesSelRef,
    linksHitSelRef,
    linksSelRef,
    labelsSelRef,
    tempLinkSelRef,
    linkDragRef,
    schemaRef,
    schemaLayoutEngineJson,
    schemaNodesPresentationJson,
    schemaGroupsPresentationJson,
    nodesPresentationAppliedKeyRef,
    groupsPresentationAppliedKeyRef,
    activeLayoutCacheKeyRef,
    graphDataRevision,
    graphContentRevision,
    graphDataRevisionRef,
    sceneWidth,
    sceneHeight,
    sceneGraphData,
    sceneGroupsDerivation,
    edgesForSim,
    effectiveFrontmatterModeEnabled,
    multiDimTableModeEnabled,
    documentStructureBaselineLock,
    documentSemanticMode,
    layoutSemanticModeKey,
    canvasRenderMode,
    canvas2dRenderer,
    renderMediaAsNodes,
    mediaPanelDensity,
    viewportControlsPreset,
    collapsedGroupIdsKey,
    fitToScreenMode,
    zoomToSelectionMode,
    isEmbeddedPreview,
    coarsePointer,
    mediaOverlayNodeIdSet,
    panelOnlyNodeIdsKey,
    panelOnlyNodeIdSet,
    overlaySizing,
    requestOverlaySchedule,
    setLayoutPositionsForMode,
    selectedEdgeIdRef,
    selectedNodeIdRef,
    selectedNodeIdsRef,
    selectedEdgeIdsRef,
    setHoverInfo,
  } = args
  const graphStoreActions = useMemo(
    () =>
      buildGraphCanvasStoreActionAdapters({
        setHoverInfo,
        workspaceOverlayOpenRef,
      }),
    [setHoverInfo],
  )

  const lastLayoutModeRef = useRef<null | 'radial' | 'block'>(null)
  const lastFrontmatterModeRef = useRef<boolean | null>(null)
  const lastSemanticModeRef = useRef<string | null>(null)
  const lastLayoutVariantRef = useRef<string | null>(null)
  const lastDatasetKeyRef = useRef<string | null>(null)
  const lastLayoutViewKeyRef = useRef<string | null>(null)
  const prevCanvasRenderModeRef = useRef<'2d' | '3d'>(canvasRenderMode)
  const prevRenderVariantRef = useRef<string>(canvasRenderMode === '2d' ? String(canvas2dRenderer || '') : '')
  const lastKnownZoomTransformRef = useRef<{ k: number; x: number; y: number } | null>(null)

  const zoomCommitParamsRef = useRef<{ zoomViewKey: string; viewportW: number; viewportH: number; graphDataRevision: number }>({
    zoomViewKey: '',
    viewportW: 0,
    viewportH: 0,
    graphDataRevision: 0,
  })

  const zoomCommitSchedulerRef = useRef(
    createRafLatestScheduler<{ k: number; x: number; y: number }>(transform => {
      const params = zoomCommitParamsRef.current
      if (!params.zoomViewKey) return
      const store = useGraphStore.getState()
      commitZoomTransformToStore({
        state: {
          viewPinned: store.viewPinned === true,
          zoomState: store.zoomState,
          zoomStateByKey: store.zoomStateByKey,
          setZoomState: store.setZoomState,
          setZoomStateForKey: store.setZoomStateForKey,
        },
        zoomViewKey: params.zoomViewKey,
        transform,
        viewportW: params.viewportW,
        viewportH: params.viewportH,
        graphDataRevision: params.graphDataRevision,
      })
    }),
  )

  useEffect(() => {
    prevCanvasRenderModeRef.current = canvasRenderMode
  }, [canvasRenderMode])

  useEffect(() => {
    prevRenderVariantRef.current = canvasRenderMode === '2d' ? String(canvas2dRenderer || '') : ''
  }, [canvas2dRenderer, canvasRenderMode])

  useEffect(() => {
    if (!active) return
    if (!sceneGraphData || !svgRef.current) return
    const schemaValue = schemaRef.current
    if (!schemaValue) return

    const sceneSetup = buildD3SceneSetupContext({
      sceneGraphData,
      schema: schemaValue,
      canvasRenderMode,
      canvas2dRenderer,
      coarsePointer,
      sceneWidth,
      sceneHeight,
      schemaLayoutEngineJson,
      effectiveFrontmatterModeEnabled,
      documentSemanticMode,
      renderMediaAsNodes,
      mediaPanelDensity,
      collapsedGroupIdsKey,
      enableEditorGestures,
      graphContentRevision,
      infiniteCanvasInteractionMode,
    })
    const { isFlowchart, schemaForScene, hoverEnabled, zoomOnDoubleClick, graphMetaKey, buildKey, isMermaidLayout } = sceneSetup
    const zoomCommitScheduler = zoomCommitSchedulerRef.current
    let rafId: number | null = null
    rafId = requestAnimationFrame(() => {
      if (!svgRef.current) return

      try {
        const t = d3.zoomTransform(svgRef.current as unknown as SVGSVGElement)
        lastKnownZoomTransformRef.current = {
          k: typeof t.k === 'number' && Number.isFinite(t.k) && t.k > 0 ? t.k : 1,
          x: typeof t.x === 'number' && Number.isFinite(t.x) ? t.x : 0,
          y: typeof t.y === 'number' && Number.isFinite(t.y) ? t.y : 0,
        }
      } catch {
        void 0
      }

      if (sceneCleanupRef.current && sceneBuildKeyRef.current === buildKey) return

      if (sceneCleanupRef.current) {
        try {
          const prevPositions = capturePrevNodePositions({
            nodesSelection: nodesSelRef.current,
            simulation: simulationRef.current,
          })
          if (!isMermaidLayout && Object.keys(prevPositions).length > 0 && !workspaceOverlayOpenRef.current) {
            persistPrevLayoutSnapshot({
              prevPositions,
              prevDatasetKey: lastDatasetKeyRef.current,
              prevMode: lastLayoutModeRef.current,
              prevFrontmatterMode: lastFrontmatterModeRef.current,
              prevSemanticMode: lastSemanticModeRef.current,
              prevViewKey: lastLayoutViewKeyRef.current,
              prevRenderMode: (prevCanvasRenderModeRef.current || '2d') as '2d' | '3d',
              prevRenderVariant: prevRenderVariantRef.current,
              prevLayoutVariant: lastLayoutVariantRef.current,
              setLayoutPositionsForMode: (key, positions) => useGraphStore.getState().setLayoutPositionsForMode(key, positions),
            })
          }
        } catch {
          void 0
        }
        try {
          sceneCleanupRef.current()
        } catch {
          void 0
        } finally {
          sceneCleanupRef.current = null
          sceneBuildKeyRef.current = null
        }
      }

      nodesPresentationAppliedKeyRef.current = `${schemaNodesPresentationJson}|${sceneWidth}|${sceneHeight}`
      groupsPresentationAppliedKeyRef.current = schemaGroupsPresentationJson

      const graphStoreState = useGraphStore.getState()
      const layoutPositionCacheByMode = graphStoreState.layoutPositionCacheByMode
      const isPinned = graphStoreState.viewPinned === true
      const prevMode = lastLayoutModeRef.current
      const prevFrontmatterMode = lastFrontmatterModeRef.current
      const prevSemanticMode = lastSemanticModeRef.current
      const prevLayoutVariant = lastLayoutVariantRef.current
      const prevDatasetKey = lastDatasetKeyRef.current
      const prevLayoutViewKey = lastLayoutViewKeyRef.current
      const layoutPrep = buildD3SceneLayoutPrepContext({
        sceneGraphData,
        graphContentRevision: graphContentRevision || 0,
        graphDataRevision: graphDataRevisionRef.current ?? graphDataRevision,
        graphMetaKey,
        schema: schemaValue,
        canvasRenderMode,
        canvas2dRenderer,
        schemaLayoutEngineJson,
        effectiveFrontmatterModeEnabled,
        documentSemanticMode,
        layoutSemanticModeKey,
        renderMediaAsNodes,
        mediaPanelDensity,
        collapsedGroupIdsKey,
        fitToScreenMode,
        zoomToSelectionMode,
        isFlowchart,
        infiniteCanvasInteractionMode,
        sceneWidth,
        sceneHeight,
        zoomStateByKey: graphStoreState.zoomStateByKey,
        viewPinned: isPinned,
        layoutPositionCacheByMode,
        lastKnownZoomTransform: lastKnownZoomTransformRef.current,
        prevMode,
        prevFrontmatterMode,
        prevSemanticMode,
        prevLayoutVariant,
        prevDatasetKey,
        prevLayoutViewKey,
        prevRenderMode: prevCanvasRenderModeRef.current,
        prevRenderVariant: prevRenderVariantRef.current,
      })
      const {
        zoomViewKey,
        layoutViewKey,
        mode,
        datasetKey,
        layoutVariant,
        initialZoomTransform,
        effectiveLayoutPositionsForMode,
        baselineLayoutPositions,
        effectiveSkipInitialLayout,
        cacheKey,
      } = layoutPrep

      const prevPositions = capturePrevNodePositions({
        nodesSelection: nodesSelRef.current,
        simulation: simulationRef.current,
      })

      lastLayoutModeRef.current = mode
      lastFrontmatterModeRef.current = !!effectiveFrontmatterModeEnabled
      lastSemanticModeRef.current = layoutSemanticModeKey
      lastLayoutVariantRef.current = layoutVariant
      lastDatasetKeyRef.current = datasetKey
      lastLayoutViewKeyRef.current = layoutViewKey
      activeLayoutCacheKeyRef.current = cacheKey

      sceneCleanupRef.current = pipelinePerfMeasureSync({
        name: 'render',
        stage: 'scene:setup',
        detail: {
          nodes: Array.isArray(sceneGraphData?.nodes) ? sceneGraphData.nodes.length : 0,
          edges: Array.isArray(sceneGraphData?.edges) ? sceneGraphData.edges.length : 0,
          width: sceneWidth,
          height: sceneHeight,
          renderer: String(canvas2dRenderer || ''),
        },
        run: () => setupGraphScene({
          active: () => activeRef.current,
          svgEl: svgRef.current,
          svgRef,
          graphData: sceneGraphData,
          graphDataRevision: graphDataRevision || 0,
          schema: schemaForScene,
          documentSemanticMode: documentSemanticMode ?? undefined,
          frontmatterModeEnabled: effectiveFrontmatterModeEnabled,
          multiDimTableModeEnabled: multiDimTableModeEnabled === true,
          documentStructureBaselineLock: documentStructureBaselineLock === true,
          canvas2dRenderer: String(canvas2dRenderer || ''),
          edgesForSim,
          width: sceneWidth,
          height: sceneHeight,
          hoverEnabled,
          zoomOnDoubleClick,
          renderMediaAsNodes,
          mediaOverlayNodeIdSet,
          panelOnlyNodeIdSet,
          mediaPanelDensity,
          overlaySizing,
          enableTightInitialLayout: (() => {
            if (isEmbeddedPreview) return false
            const nodesCount = Array.isArray(sceneGraphData?.nodes) ? sceneGraphData.nodes.length : 0
            const edgesCount = Array.isArray(sceneGraphData?.edges) ? sceneGraphData.edges.length : 0
            if (nodesCount > 2600) return false
            if (edgesCount > 8200) return false
            return true
          })(),
          fitToScreenMode,
          viewportControlsPreset,
          initialZoomTransform,
          layoutPositionsForMode: effectiveLayoutPositionsForMode,
          baselineLayoutPositions,
          prevPositions: isFlowchart ? null : Object.keys(prevPositions).length > 0 ? prevPositions : null,
          skipInitialLayout: effectiveSkipInitialLayout,
          freezeSimulation: isEmbeddedPreview || isMermaidLayout,
          enableContinuousForceLayout: isFlowchart || infiniteCanvasInteractionMode === 'interactive',
          groupsForBboxCollide: sceneGroupsDerivation?.allGroups || [],
          layoutGroupKeyByNodeId: sceneGroupsDerivation?.layoutGroupKeyByNodeId || null,
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
          selectNode: graphStoreActions.selectNode,
          selectEdge: graphStoreActions.selectEdge,
          selectGroup: graphStoreActions.selectGroup,
          selectGroupExpanded: graphStoreActions.selectGroupExpanded,
          toggleGroupCollapsed: graphStoreActions.toggleGroupCollapsed,
          setSelectionSource: graphStoreActions.setSelectionSource,
          addNode: graphStoreActions.addNode,
          updateNode: graphStoreActions.updateNode,
          addEdge: graphStoreActions.addEdge,
          updateEdge: graphStoreActions.updateEdge,
          enableEditorGestures,
          setHoverInfo: graphStoreActions.setHoverInfo,
          setLifecycleStageRendering: graphStoreActions.setLifecycleStageRendering,
          requestZoomSelection: graphStoreActions.requestZoomSelection,
          edgeScrollEnabled: graphStoreActions.edgeScrollEnabled,
          onZoomTransform: t => {
            try {
              requestOverlaySchedule()
            } catch {
              void 0
            }
            zoomCommitParamsRef.current = {
              zoomViewKey,
              viewportW: sceneWidth,
              viewportH: sceneHeight,
              graphDataRevision: graphDataRevisionRef.current,
            }
            zoomCommitSchedulerRef.current.schedule(t)
          },
          getSchema: () => schemaRef.current,
          getRenderMediaAsNodes: () => useGraphStore.getState().renderMediaAsNodes === true,
          layoutCacheKey: cacheKey,
          setLayoutPositionsForMode,
        }),
      })

      const baseBefore = beforeRenderFrameRef.current
      if (baseBefore && beforeRenderFrameWrappedSourceRef.current !== baseBefore) {
        beforeRenderFrameWrappedSourceRef.current = baseBefore
        beforeRenderFrameRef.current = () => {
          baseBefore()
          try {
            requestOverlaySchedule()
          } catch {
            void 0
          }
        }
      }
      sceneBuildKeyRef.current = buildKey
    })
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId)
      zoomCommitScheduler.cancel()
    }
  }, [
    active,
    activeLayoutCacheKeyRef,
    activeRef,
    beforeRenderFrameRef,
    beforeRenderFrameWrappedSourceRef,
    canvas2dRenderer,
    canvasRenderMode,
    collapsedGroupIdsKey,
    coarsePointer,
    documentSemanticMode,
    documentStructureBaselineLock,
    edgesForSim,
    enableEditorGestures,
    effectiveFrontmatterModeEnabled,
    fitToScreenMode,
    gRef,
    graphStoreActions,
    graphDataRevision,
    graphContentRevision,
    graphDataRevisionRef,
    groupChevronSelRef,
    groupsPresentationAppliedKeyRef,
    isEmbeddedPreview,
    infiniteCanvasInteractionMode,
    layoutSemanticModeKey,
    labelsSelRef,
    linkDragRef,
    linksHitSelRef,
    linksSelRef,
    mediaOverlayNodeIdSet,
    mediaSelRef,
    mediaPanelDensity,
    multiDimTableModeEnabled,
    nodesPresentationAppliedKeyRef,
    nodesSelRef,
    overlaySizing,
    panelOnlyNodeIdSet,
    panelOnlyNodeIdsKey,
    portHandlesSelRef,
    renderMediaAsNodes,
    requestOverlaySchedule,
    sceneBuildKeyRef,
    sceneCleanupRef,
    sceneGraphData,
    sceneGraphDataRef,
    sceneGroupsDerivation?.allGroups,
    sceneGroupsDerivation?.layoutGroupKeyByNodeId,
    sceneHeight,
    sceneWidth,
    schemaGroupsPresentationJson,
    schemaLayoutEngineJson,
    schemaNodesPresentationJson,
    schemaRef,
    selectedEdgeIdRef,
    selectedEdgeIdsRef,
    selectedNodeIdRef,
    selectedNodeIdsRef,
    setHoverInfo,
    setLayoutPositionsForMode,
    simulationRef,
    svgRef,
    tempLinkSelRef,
    viewportControlsPreset,
    zoomRef,
    zoomToSelectionMode,
  ])
}
