import { useEffect, useRef, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react'
import * as d3 from 'd3'
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { SceneGroupsDerivation } from '@/lib/scene/sceneDerivation'
import type { ViewportControlsPreset } from '@/lib/config.viewport-controls'
import { withD3BipartiteSceneSchema } from '@/lib/canvas/d3BipartiteSchemaOverrides'
import { useGraphStore } from '@/hooks/useGraphStore'
import { readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { setupGraphScene } from '@/components/GraphCanvas/scene'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'
import { buildZoomViewKey } from '@/components/GraphCanvas/zoomViewKey'
import { pickInitialZoomTransform } from '@/lib/zoom/viewport'
import { pickZoomStateForView } from '@/lib/canvas/zoom-effective'
import { createRafLatestScheduler } from '@/lib/react/rafLatestScheduler'
import { commitZoomTransformToStore } from '@/lib/canvas/zoom-commit'
import { isD3Like2dRenderer } from '@/lib/config.render'
import {
  buildLayoutPositionCacheKey,
  buildLayoutViewKey,
  computeLayoutDatasetKey,
  determineLayoutPositions,
} from '@/components/GraphCanvas/layout/positioning'
import type { HoverInfo } from '@/components/GraphHoverTooltip'
import type { PortHandleDatum } from '@/components/GraphCanvas/portHandles'
import type { FlowPortHandleDatum2d } from '@/components/GraphCanvas/flowPortHandles2d'

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
  overlayBaseWidthRatioDefault: number
  overlayBaseWidthRatioCompact: number
  overlayBaseWidthMinPxDefault: number
  overlayBaseWidthMinPxCompact: number
  overlayBaseWidthMaxPxDefault: number
  overlayBaseWidthMaxPxCompact: number
  requestOverlaySchedule: () => void
  setLayoutPositionsForMode: (key: string, positions: Record<string, { x: number; y: number }>) => void
  selectedEdgeIdRef: MutableRefObject<string | null>
  selectedNodeIdRef: MutableRefObject<string | null>
  selectedNodeIdsRef: MutableRefObject<string[] | undefined>
  selectedEdgeIdsRef: MutableRefObject<string[] | undefined>
  setHoverInfo: Dispatch<SetStateAction<HoverInfo | null>>
}): void {
  const workspaceViewMode = useGraphStore(s => s.workspaceViewMode)
  const enableEditorGestures = workspaceViewMode === 'editor' && String(args.canvas2dRenderer || '') !== 'd3Bipartite'
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
    overlayBaseWidthRatioDefault,
    overlayBaseWidthRatioCompact,
    overlayBaseWidthMinPxDefault,
    overlayBaseWidthMinPxCompact,
    overlayBaseWidthMaxPxDefault,
    overlayBaseWidthMaxPxCompact,
    requestOverlaySchedule,
    setLayoutPositionsForMode,
    selectedEdgeIdRef,
    selectedNodeIdRef,
    selectedNodeIdsRef,
    selectedEdgeIdsRef,
    setHoverInfo,
  } = args

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

    const graphKind = (() => {
      const meta = (sceneGraphData.metadata || {}) as Record<string, unknown>
      return typeof meta.graphKind === 'string' ? meta.graphKind : ''
    })()
    const isD3LikeRenderer = canvasRenderMode === '2d' && isD3Like2dRenderer((canvas2dRenderer || null) as never)
    const isBipartite = isD3LikeRenderer && graphKind === 'bipartite'
    const schemaForScene: GraphSchema = withD3BipartiteSceneSchema({
      schema: schemaValue,
      graphData: sceneGraphData,
      canvasRenderMode,
      canvas2dRenderer: String(canvas2dRenderer || ''),
    })

    const hoverEnabled = schemaValue.behavior?.hover?.enabled !== false && !coarsePointer
    const expansionCfg = schemaValue.behavior?.expansion || {}
    const expansionEnabled = expansionCfg.enabled !== false
    const zoomOnDoubleClick = expansionEnabled && expansionCfg.zoomOnDoubleClick !== false
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

      const buildKey = [
        String(graphContentRevision || 0),
        `${sceneWidth}x${sceneHeight}`,
        schemaLayoutEngineJson,
        String(effectiveFrontmatterModeEnabled ? 1 : 0),
        String(documentSemanticMode),
        buildGraphMetaKeyIgnoringPending(sceneGraphData),
        `${String(sceneGraphData?.nodes?.length ?? 0)}:${String(sceneGraphData?.edges?.length ?? 0)}`,
        String(isBipartite ? 0 : (renderMediaAsNodes ? 1 : 0)),
        String(isBipartite ? '' : mediaPanelDensity),
        collapsedGroupIdsKey,
        String(enableEditorGestures ? 1 : 0),
        String(infiniteCanvasInteractionMode),
      ].join('|')

      if (sceneCleanupRef.current && sceneBuildKeyRef.current === buildKey) return

      const isMermaidLayout = (() => {
        const gd = sceneGraphData as unknown as { context?: unknown; metadata?: unknown } | null
        if (!gd) return false
        if (String(gd.context || '') === 'frontmatter-mermaid') return true
        const meta = gd.metadata
        if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false
        return String((meta as Record<string, unknown>).layoutEngine || '') === 'mermaid'
      })()

      if (sceneCleanupRef.current) {
        try {
          const prevPositions: Record<string, { x: number; y: number }> = {}
          if (nodesSelRef.current) {
            nodesSelRef.current.each((d: GraphNode) => {
              if (d.id && typeof d.x === 'number' && typeof d.y === 'number' && Number.isFinite(d.x) && Number.isFinite(d.y)) {
                prevPositions[String(d.id)] = { x: d.x, y: d.y }
              }
            })
          }
          try {
            const sim = simulationRef.current
            const simNodes = sim ? (sim.nodes() as unknown as GraphNode[]) : []
            for (let i = 0; i < simNodes.length; i += 1) {
              const n = simNodes[i]!
              const id = String(n?.id || '').trim()
              if (!id) continue
              if (prevPositions[id]) continue
              const x = (n as unknown as { x?: unknown }).x
              const y = (n as unknown as { y?: unknown }).y
              if (typeof x !== 'number' || typeof y !== 'number') continue
              if (!Number.isFinite(x) || !Number.isFinite(y)) continue
              prevPositions[id] = { x, y }
            }
          } catch {
            void 0
          }
          if (!isMermaidLayout && Object.keys(prevPositions).length > 0) {
            const state = useGraphStore.getState()
            const prevDatasetKey = lastDatasetKeyRef.current
            const prevMode = lastLayoutModeRef.current
            const prevFrontmatter = lastFrontmatterModeRef.current
            const prevSemantic = lastSemanticModeRef.current
            const prevViewKey = lastLayoutViewKeyRef.current
            if (prevDatasetKey && prevMode && prevFrontmatter != null && prevSemantic) {
              const key = buildLayoutPositionCacheKey({
                datasetKey: prevDatasetKey,
                mode: prevMode,
                frontmatterMode: prevFrontmatter,
                semanticMode: prevSemantic,
                renderMode: (prevCanvasRenderModeRef.current || '2d') as '2d' | '3d',
                renderVariant: prevRenderVariantRef.current || undefined,
                layoutVariant: lastLayoutVariantRef.current || undefined,
                viewKey: prevViewKey || undefined,
              })
              state.setLayoutPositionsForMode(key, prevPositions)
            }
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

      const graphMetaKey = buildGraphMetaKeyIgnoringPending(sceneGraphData)
      const graphMetaKeyForZoom = graphMetaKey
      const zoomViewKey = buildZoomViewKey({
        canvasRenderMode,
        canvas2dRenderer,
        schemaLayoutEngineJson,
        frontmatterModeEnabled: !!effectiveFrontmatterModeEnabled,
        documentSemanticMode: layoutSemanticModeKey,
        graphMetaKey: graphMetaKeyForZoom,
        renderMediaAsNodes: renderMediaAsNodes === true,
        mediaPanelDensity: String(mediaPanelDensity),
        collapsedGroupIdsKey,
      })
      const layoutViewKey = buildLayoutViewKey({
        schemaLayoutEngineJson,
        frontmatterModeEnabled: !!effectiveFrontmatterModeEnabled,
        documentSemanticMode: layoutSemanticModeKey,
        graphMetaKey,
        renderMediaAsNodes: renderMediaAsNodes === true,
        mediaPanelDensity: String(mediaPanelDensity),
        collapsedGroupIdsKey,
      })

      const stateForZoom = useGraphStore.getState()
      const layoutPositionCacheByMode = useGraphStore.getState().layoutPositionCacheByMode
      const isPinned = useGraphStore.getState().viewPinned === true
      const z = pickZoomStateForView({
        zoomViewKey,
        zoomStateByKey: stateForZoom.zoomStateByKey,
        viewPinned: isPinned,
        fitToScreenMode,
        zoomToSelectionMode,
      })
      const mode = readLayoutMode(schemaValue)
      const prevMode = lastLayoutModeRef.current
      const prevFrontmatterMode = lastFrontmatterModeRef.current
      const prevSemanticMode = lastSemanticModeRef.current
      const prevLayoutVariant = lastLayoutVariantRef.current
      const prevDatasetKey = lastDatasetKeyRef.current
      const prevLayoutViewKey = lastLayoutViewKeyRef.current
      const datasetKey = computeLayoutDatasetKey({
        graphData: sceneGraphData,
        graphDataRevision: graphContentRevision || 0,
      })
      const layoutVariant = isBipartite
        ? `bipartite:v4:${layoutSemanticModeKey}:${String(effectiveFrontmatterModeEnabled ? 1 : 0)}:${String(infiniteCanvasInteractionMode)}`
        : ''
      const pickedInitialZoomTransform = pickInitialZoomTransform({
        zoomState: z,
        pinned: isPinned,
        graphDataRevision: graphDataRevisionRef.current ?? graphDataRevision,
        nextViewportW: sceneWidth,
        nextViewportH: sceneHeight,
      })
      const initialZoomTransform =
        pickedInitialZoomTransform || (!fitToScreenMode && !zoomToSelectionMode ? lastKnownZoomTransformRef.current : null)
      const { layoutPositionsForMode, skipInitialLayout, cacheKey } = determineLayoutPositions({
        datasetKey,
        mode,
        frontmatterMode: !!effectiveFrontmatterModeEnabled,
        semanticMode: layoutSemanticModeKey,
        renderMode: canvasRenderMode,
        renderVariant: canvasRenderMode === '2d' ? canvas2dRenderer : '',
        layoutVariant,
        viewKey: layoutViewKey,
        prevViewKey: prevLayoutViewKey,
        prevDatasetKey,
        prevMode,
        prevFrontmatterMode,
        prevSemanticMode,
        prevRenderMode: prevCanvasRenderModeRef.current,
        prevRenderVariant: prevRenderVariantRef.current,
        prevLayoutVariant,
        nodes: Array.isArray(sceneGraphData.nodes) ? sceneGraphData.nodes : [],
        layoutPositionCacheByMode,
      })

      const effectiveLayoutPositionsForMode = isBipartite ? null : layoutPositionsForMode

      const baselineLayoutPositions = (() => {
        if (String(documentSemanticMode || 'document') !== 'keyword') return null
        if (!layoutPositionCacheByMode) return null

        const lookup = (key: string | null): Record<string, { x: number; y: number }> | null => {
          if (!key) return null
          const cached = layoutPositionCacheByMode[key] ?? null
          return cached && Object.keys(cached).length > 0 ? cached : null
        }

        if (prevSemanticMode === 'document' && prevDatasetKey && prevLayoutViewKey) {
          const baselineFromPrevKey = buildLayoutPositionCacheKey({
            datasetKey: prevDatasetKey,
            mode: prevMode ?? mode,
            frontmatterMode: prevFrontmatterMode ?? !!effectiveFrontmatterModeEnabled,
            semanticMode: 'document',
            renderMode: canvasRenderMode,
            viewKey: prevLayoutViewKey,
            renderVariant: canvasRenderMode === '2d' ? canvas2dRenderer : '',
            layoutVariant: prevLayoutVariant ?? layoutVariant,
          })
          const found = lookup(baselineFromPrevKey)
          if (found) return found
        }

        const baselineGraphMetaKey = (() => {
          const meta =
            sceneGraphData.metadata && typeof sceneGraphData.metadata === 'object' && !Array.isArray(sceneGraphData.metadata)
              ? (sceneGraphData.metadata as Record<string, unknown>)
              : null
          const raw = meta && typeof meta.baselineGraphMetaKey === 'string' ? meta.baselineGraphMetaKey.trim() : ''
          return raw || graphMetaKey
        })()
        const baselineLayoutViewKey = buildLayoutViewKey({
          schemaLayoutEngineJson,
          frontmatterModeEnabled: !!effectiveFrontmatterModeEnabled,
          documentSemanticMode: 'document',
          graphMetaKey: baselineGraphMetaKey,
          renderMediaAsNodes: renderMediaAsNodes === true,
          mediaPanelDensity: String(mediaPanelDensity),
          collapsedGroupIdsKey,
        })
        const baselineFromCurrentKey = buildLayoutPositionCacheKey({
          datasetKey,
          mode,
          frontmatterMode: !!effectiveFrontmatterModeEnabled,
          semanticMode: 'document',
          renderMode: canvasRenderMode,
          viewKey: baselineLayoutViewKey,
          renderVariant: canvasRenderMode === '2d' ? canvas2dRenderer : '',
          layoutVariant,
        })
        return lookup(baselineFromCurrentKey)
      })()

      const effectiveSkipInitialLayout = isBipartite
        ? false
        : String(documentSemanticMode || 'document') === 'keyword' &&
            canvasRenderMode === '2d' &&
            String(canvas2dRenderer || '') === 'd3' &&
            !!baselineLayoutPositions
          ? true
          : skipInitialLayout

      const prevPositions: Record<string, { x: number; y: number }> = {}
      if (nodesSelRef.current) {
        nodesSelRef.current.each((d: GraphNode) => {
          if (d.id && typeof d.x === 'number' && typeof d.y === 'number' && Number.isFinite(d.x) && Number.isFinite(d.y)) {
            prevPositions[String(d.id)] = { x: d.x, y: d.y }
          }
        })
      }
      try {
        const sim = simulationRef.current
        const simNodes = sim ? (sim.nodes() as unknown as GraphNode[]) : []
        for (let i = 0; i < simNodes.length; i += 1) {
          const n = simNodes[i]!
          const id = String(n?.id || '').trim()
          if (!id) continue
          if (prevPositions[id]) continue
          const x = (n as unknown as { x?: unknown }).x
          const y = (n as unknown as { y?: unknown }).y
          if (typeof x !== 'number' || typeof y !== 'number') continue
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue
          prevPositions[id] = { x, y }
        }
      } catch {
        void 0
      }

      lastLayoutModeRef.current = mode
      lastFrontmatterModeRef.current = !!effectiveFrontmatterModeEnabled
      lastSemanticModeRef.current = layoutSemanticModeKey
      lastLayoutVariantRef.current = layoutVariant
      lastDatasetKeyRef.current = datasetKey
      lastLayoutViewKeyRef.current = layoutViewKey
      activeLayoutCacheKeyRef.current = cacheKey

      sceneCleanupRef.current = setupGraphScene({
        active: () => activeRef.current,
        svgEl: svgRef.current,
        svgRef,
        graphData: sceneGraphData,
        graphDataRevision: graphDataRevision || 0,
        schema: schemaForScene,
        documentSemanticMode: documentSemanticMode ?? undefined,
        frontmatterModeEnabled: effectiveFrontmatterModeEnabled,
        multiDimTableModeEnabled: layoutSemanticModeKey.endsWith(':mdtbl'),
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
        overlayBaseWidthRatioDefault,
        overlayBaseWidthRatioCompact,
        overlayBaseWidthMinPxDefault,
        overlayBaseWidthMinPxCompact,
        overlayBaseWidthMaxPxDefault,
        overlayBaseWidthMaxPxCompact,
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
        prevPositions: isBipartite ? null : Object.keys(prevPositions).length > 0 ? prevPositions : null,
        skipInitialLayout: effectiveSkipInitialLayout,
        freezeSimulation: isEmbeddedPreview || isMermaidLayout,
        enableContinuousForceLayout: isBipartite || infiniteCanvasInteractionMode === 'interactive',
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
        selectNode: id => useGraphStore.getState().selectNode(id),
        selectEdge: id => useGraphStore.getState().selectEdge(id),
        selectGroup: id => useGraphStore.getState().selectGroup(id),
        selectGroupExpanded: x => useGraphStore.getState().selectGroupExpanded({ id: x.id, nodeIds: x.nodeIds, edgeIds: x.edgeIds }),
        toggleGroupCollapsed: id => useGraphStore.getState().toggleGroupCollapsed(id),
        setSelectionSource: src => useGraphStore.getState().setSelectionSource(src),
        addNode: n => useGraphStore.getState().addNode(n),
        updateNode: (id, u) => useGraphStore.getState().updateNode(id, u),
        addEdge: e => useGraphStore.getState().addEdge(e),
        updateEdge: (id, u) => useGraphStore.getState().updateEdge(id, u),
        enableEditorGestures,
        setHoverInfo: updater => setHoverInfo(prev => updater(prev)),
        setLifecycleStageRendering: () => useGraphStore.getState().setLifecycleStage('rendering'),
        requestZoomSelection: () => useGraphStore.getState().requestZoom('selection'),
        edgeScrollEnabled: () => useGraphStore.getState().viewPinned !== true,
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
      zoomCommitSchedulerRef.current.cancel()
    }
  }, [
    active,
    canvas2dRenderer,
    canvasRenderMode,
    collapsedGroupIdsKey,
    coarsePointer,
    documentSemanticMode,
    edgesForSim,
    enableEditorGestures,
    effectiveFrontmatterModeEnabled,
    fitToScreenMode,
    graphDataRevision,
    graphContentRevision,
    graphDataRevisionRef,
    isEmbeddedPreview,
    infiniteCanvasInteractionMode,
    layoutSemanticModeKey,
    mediaOverlayNodeIdSet,
    mediaPanelDensity,
    overlayBaseWidthRatioDefault,
    overlayBaseWidthRatioCompact,
    overlayBaseWidthMinPxDefault,
    overlayBaseWidthMinPxCompact,
    overlayBaseWidthMaxPxDefault,
    overlayBaseWidthMaxPxCompact,
    panelOnlyNodeIdsKey,
    renderMediaAsNodes,
    requestOverlaySchedule,
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
    viewportControlsPreset,
    zoomToSelectionMode,
  ])
}
