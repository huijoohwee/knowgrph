import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useShallow } from 'zustand/react/shallow'
import { GraphNode, GraphEdge, GraphData } from '@/lib/graph/types'
import { type GraphSchema } from '@/lib/graph/schema'
import { useContainerDims } from '@/hooks/useContainerDims'
import { normalizeEdgesForSim, updateForceSimulationPresentation } from '@/components/GraphCanvas/simulation'
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation'
import { GraphHoverTooltip, type HoverInfo } from '@/components/GraphHoverTooltip'
import {
  create2dSvgSnapshotFns,
  computeFlowState,
} from '@/components/GraphCanvas/helpers'
import { filterGraphToFrontmatterMermaid } from '@/lib/graph/layerDerivation'
import { setupGraphScene, updateGraphSceneGroupsPresentation, updateGraphSceneNodesPresentation } from '@/components/GraphCanvas/scene'
import { emitPropsPanelOpen } from '@/features/canvas/utils'
import { useGraphCanvasStyles } from '@/components/GraphCanvas/useGraphCanvasStyles'
import { useZoomEffects } from '@/components/GraphCanvas/hooks/useZoomEffects'
import { useEdgeCreationEffect } from '@/components/GraphCanvas/hooks/useEdgeCreationEffect'
import { useSelectionHighlight } from '@/components/GraphCanvas/hooks/useSelectionHighlight'
import { useGroupSelectionHighlight } from '@/components/GraphCanvas/hooks/useGroupSelectionHighlight'
import { determineLayoutPositions } from '@/components/GraphCanvas/layout/positioning'
import { useDebouncedValue } from '@/features/hooks/useDebouncedValue'
import { useGraphStoreKeyRef } from '@/hooks/useGraphStoreKeyRef'
import type { PortHandleDatum } from '@/components/GraphCanvas/portHandles'
import { useActiveGraphData } from '@/hooks/useActiveGraphData'

export default function GraphCanvas({ active = true }: { active?: boolean }) {
  const containerRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const lastLayoutModeRef = useRef<null | 'force' | 'radial'>(null);
  const lastFrontmatterModeRef = useRef<boolean | null>(null);
  const lastSemanticModeRef = useRef<'document' | 'keyword' | null>(null)
  const activeRef = useRef<boolean>(true)
  activeRef.current = !!active
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const nodesSelRef = useRef<d3.Selection<SVGElement, GraphNode, SVGGElement, unknown> | null>(null);
  const mediaSelRef = useRef<d3.Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown> | null>(null);
  const portHandlesSelRef =
    useRef<d3.Selection<SVGCircleElement, PortHandleDatum, SVGGElement, unknown> | null>(null);
  const linksHitSelRef = useRef<d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null>(null);
  const linksSelRef = useRef<d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null>(null);
  const labelsSelRef = useRef<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);
  const sceneGraphDataRef = useRef<GraphData | null>(null);
  const beforeRenderFrameRef = useRef<(() => void) | null>(null);
  const nodesPresentationAppliedKeyRef = useRef<string | null>(null);
  const groupsPresentationAppliedKeyRef = useRef<string | null>(null);
  const sceneCleanupRef = useRef<null | (() => void)>(null)
  const sceneBuildKeyRef = useRef<string | null>(null)
  const {
    graphDataRevision,
    setCanvasDims,
    setCanvasPos,
    schema,
    renderMediaAsNodes,
    mediaPanelDensity,
    setLayoutPositionsForMode,
    frontmatterModeEnabled,
    documentSemanticMode,
    canvasRenderMode,
  } = useGraphStore(
    useShallow((s) => ({
      graphDataRevision: s.graphDataRevision,
      setCanvasDims: s.setCanvasDims,
      setCanvasPos: s.setCanvasPos,
      schema: s.schema,
      renderMediaAsNodes: s.renderMediaAsNodes,
      mediaPanelDensity: s.mediaPanelDensity,
      setLayoutPositionsForMode: s.setLayoutPositionsForMode,
      frontmatterModeEnabled: s.frontmatterModeEnabled || false,
      documentSemanticMode: (s.documentSemanticMode || 'document') as 'document' | 'keyword',
      canvasRenderMode: s.canvasRenderMode,
    })),
  );
  const prevCanvasRenderModeRef = useRef<'2d' | '3d'>(canvasRenderMode)
  const prevCanvasRenderMode = prevCanvasRenderModeRef.current
  const registerCanvasSnapshotFns = useGraphStore(s => s.registerCanvasSnapshotFns);
  const selectedNodeIdRef = useGraphStoreKeyRef('selectedNodeId')
  const selectedEdgeIdRef = useGraphStoreKeyRef('selectedEdgeId')
  const selectedNodeIdsRef = useGraphStoreKeyRef('selectedNodeIds')
  const selectedEdgeIdsRef = useGraphStoreKeyRef('selectedEdgeIds')
  const graphDataRevisionRef = useGraphStoreKeyRef('graphDataRevision')
  const schemaRef = useRef(schema)

  const schemaLayoutEngineJson = useMemo(() => {
    const layout = schema?.layout || {}
    return JSON.stringify({
      mode: layout.mode || 'force',
      forces: layout.forces || null,
    })
  }, [schema?.layout?.mode, schema?.layout?.forces])

  const schemaNodesPresentationJson = useMemo(() => {
    return JSON.stringify({
      nodeShapeMode: schema?.behavior?.nodeShapeMode || 'auto',
      portHandles: schema?.behavior?.portHandles || null,
      nodeShapes: schema?.nodeShapes || null,
      allowNodeDrag: schema?.behavior?.allowNodeDrag !== false,
      hoverEnabled: schema?.behavior?.hover?.enabled !== false,
      expansion: schema?.behavior?.expansion || null,
      renderMediaAsNodes,
      mediaPanelDensity,
    })
  }, [
    schema?.behavior?.nodeShapeMode,
    schema?.behavior?.portHandles,
    schema?.nodeShapes,
    schema?.behavior?.allowNodeDrag,
    schema?.behavior?.hover?.enabled,
    schema?.behavior?.expansion,
    renderMediaAsNodes,
    mediaPanelDensity,
  ])

  const schemaGroupsPresentationJson = useMemo(() => {
    return JSON.stringify({
      groups: schema?.layout?.groups || null,
      labelStyles: schema?.labelStyles || null,
      nodeShapeMode: schema?.behavior?.nodeShapeMode || 'auto',
      portHandles: schema?.behavior?.portHandles || null,
    })
  }, [
    schema?.layout?.groups,
    schema?.labelStyles,
    schema?.behavior?.nodeShapeMode,
    schema?.behavior?.portHandles,
  ])

  const rawGraphData = useActiveGraphData()
  const effectiveFrontmatterModeEnabled = !!frontmatterModeEnabled && documentSemanticMode !== 'keyword'
  const renderGraphData = useMemo(() => {
    if (!rawGraphData) return null
    if (effectiveFrontmatterModeEnabled) {
      return filterGraphToFrontmatterMermaid(rawGraphData)
    }
    return rawGraphData
  }, [rawGraphData, effectiveFrontmatterModeEnabled])

  useEffect(() => {
    schemaRef.current = schema
  }, [schema])
  const { width, height, left, top } = useContainerDims(containerRef);
  const debouncedWidth = useDebouncedValue(width, 100);
  const debouncedHeight = useDebouncedValue(height, 100);
  const sceneWidth = useMemo(() => Math.max(1, Math.floor(debouncedWidth)), [debouncedWidth]);
  const sceneHeight = useMemo(() => Math.max(1, Math.floor(debouncedHeight)), [debouncedHeight]);
  const tempLinkSelRef = useRef<TempLinkSelection>(null);
  const linkDragRef = useRef<PendingLink | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onContextMenu = (ev: MouseEvent) => {
      if (ev.defaultPrevented) return;
      ev.preventDefault();
      const state = useGraphStore.getState()
      state.setSelectionSource('menu')
      state.selectNode(null)
      state.selectEdge(null)
      emitPropsPanelOpen({ clientX: ev.clientX, clientY: ev.clientY });
    };
    el.addEventListener('contextmenu', onContextMenu);
    return () => {
      el.removeEventListener('contextmenu', onContextMenu);
    };
  }, []);

  useEffect(() => {
    if (schema.behavior?.hover?.enabled === false) {
      setHoverInfo(null);
    }
  }, [schema.behavior?.hover?.enabled]);

  useEffect(() => {
    setCanvasDims({ w: Math.max(1, Math.floor(width)), h: Math.max(1, Math.floor(height)) });
    setCanvasPos({ x: left, y: top });
  }, [width, height, left, top, setCanvasDims, setCanvasPos]);

  useEffect(() => {
    if (active) return
    try {
      simulationRef.current?.stop()
    } catch {
      void 0
    }
  }, [active])

  useEffect(() => {
    return () => {
      try {
        sceneCleanupRef.current?.()
      } catch {
        void 0
      } finally {
        sceneCleanupRef.current = null
        sceneBuildKeyRef.current = null
      }
    }
  }, [])

  useZoomEffects({
    svgRef,
    zoomRef,
    width,
    height,
  });

  useEdgeCreationEffect({
    tempLinkSelRef,
    linkDragRef,
  });

  useEffect(() => {
    registerCanvasSnapshotFns('2d', svgRef.current ? create2dSvgSnapshotFns(svgRef) : null);
    return () => {
      registerCanvasSnapshotFns('2d', null);
    };
  }, [registerCanvasSnapshotFns]);

  useEffect(() => {
    if (active) return
    if (!sceneCleanupRef.current) return
    try {
      sceneCleanupRef.current()
    } catch {
      void 0
    } finally {
      sceneCleanupRef.current = null
      sceneBuildKeyRef.current = null
    }
  }, [active])

  const edgesForSim = useMemo(
    () =>
      normalizeEdgesForSim(
        (renderGraphData?.nodes ?? []) as GraphNode[],
        (renderGraphData?.edges ?? []) as GraphEdge[],
      ),
    [renderGraphData],
  );

  const flowState = useMemo(
    () => computeFlowState(renderGraphData as GraphData | null),
    [renderGraphData],
  );

  useEffect(() => {
    if (!active) return;
    if (!renderGraphData || !svgRef.current) return;
    const schemaValue = schemaRef.current;
    if (!schemaValue) return;
    const hoverEnabled = schemaValue.behavior?.hover?.enabled !== false;
    const expansionCfg = schemaValue.behavior?.expansion || {};
    const expansionEnabled = expansionCfg.enabled !== false;
    const zoomOnDoubleClick = expansionEnabled && expansionCfg.zoomOnDoubleClick !== false;
    let rafId: number | null = null;
    rafId = requestAnimationFrame(() => {
      if (!svgRef.current) return;
      const buildKey = [
        String(graphDataRevisionRef.current ?? graphDataRevision),
        `${sceneWidth}x${sceneHeight}`,
        schemaLayoutEngineJson,
        String(effectiveFrontmatterModeEnabled ? 1 : 0),
        String(documentSemanticMode),
        String(renderGraphData?.metadata && typeof renderGraphData.metadata === 'object'
          ? `${String((renderGraphData.metadata as Record<string, unknown>).kind ?? '')}:${String((renderGraphData.metadata as Record<string, unknown>).source ?? '')}`
          : ''),
        `${String(renderGraphData?.nodes?.length ?? 0)}:${String(renderGraphData?.edges?.length ?? 0)}`,
        String(renderMediaAsNodes ? 1 : 0),
        String(mediaPanelDensity),
      ].join('|')

      if (sceneCleanupRef.current && sceneBuildKeyRef.current === buildKey) {
        const sim = simulationRef.current
        if (sim && schemaValue.layout?.mode !== 'radial') {
          try {
            sim.alphaTarget(0.08).restart()
          } catch {
            void 0
          }
        }
        return
      }

      if (sceneCleanupRef.current) {
        try {
          sceneCleanupRef.current()
        } catch {
          void 0
        } finally {
          sceneCleanupRef.current = null
          sceneBuildKeyRef.current = null
        }
      }
      nodesPresentationAppliedKeyRef.current = schemaNodesPresentationJson
      groupsPresentationAppliedKeyRef.current = schemaGroupsPresentationJson
      const z = useGraphStore.getState().zoomState;
      const layoutPositionCacheByMode = useGraphStore.getState().layoutPositionCacheByMode;
      const isPinned = useGraphStore.getState().viewPinned === true;
      const mode = (schemaValue.layout?.mode || 'force') as 'force' | 'radial'
      const prevMode = lastLayoutModeRef.current
      const prevFrontmatterMode = lastFrontmatterModeRef.current
      const prevSemanticMode = lastSemanticModeRef.current
      const canReuseZoom = prevMode === mode && prevFrontmatterMode === !!effectiveFrontmatterModeEnabled && prevSemanticMode === documentSemanticMode
      const initialZoomTransform =
        z && (isPinned || (canReuseZoom && (z.graphDataRevision == null || z.graphDataRevision === graphDataRevisionRef.current)))
          ? { k: z.k, x: z.x, y: z.y }
          : null;
      const {
        layoutPositionsForMode,
        skipInitialLayout,
        cacheKey,
      } = determineLayoutPositions({
        mode,
        frontmatterMode: !!effectiveFrontmatterModeEnabled,
        semanticMode: documentSemanticMode,
        renderMode: canvasRenderMode,
        prevMode,
        prevFrontmatterMode,
        prevSemanticMode,
        prevRenderMode: prevCanvasRenderMode,
        nodes: Array.isArray(renderGraphData.nodes) ? renderGraphData.nodes : [],
        layoutPositionCacheByMode,
      });
      
      const prevPositions: Record<string, { x: number; y: number }> = {}
      if (nodesSelRef.current) {
        nodesSelRef.current.each((d: GraphNode) => {
          if (d.id && typeof d.x === 'number' && typeof d.y === 'number' && Number.isFinite(d.x) && Number.isFinite(d.y)) {
            prevPositions[String(d.id)] = { x: d.x, y: d.y }
          }
        })
      }

      lastLayoutModeRef.current = mode
      lastFrontmatterModeRef.current = !!effectiveFrontmatterModeEnabled
      lastSemanticModeRef.current = documentSemanticMode
      sceneCleanupRef.current = setupGraphScene({
        svgEl: svgRef.current,
        svgRef,
        graphData: renderGraphData,
        schema: schemaValue,
        edgesForSim,
        width: sceneWidth,
        height: sceneHeight,
        hoverEnabled,
        zoomOnDoubleClick,
        renderMediaAsNodes,
        mediaPanelDensity,
        initialZoomTransform,
        layoutPositionsForMode,
        prevPositions: Object.keys(prevPositions).length > 0 ? prevPositions : null,
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
        selectNode: id => useGraphStore.getState().selectNode(id),
        selectEdge: id => useGraphStore.getState().selectEdge(id),
        selectGroup: id => useGraphStore.getState().selectGroup(id),
        selectGroupExpanded: x =>
          useGraphStore.getState().selectGroupExpanded({ id: x.id, nodeIds: x.nodeIds, edgeIds: x.edgeIds }),
        setSelectionSource: src => useGraphStore.getState().setSelectionSource(src),
        addEdge: e => useGraphStore.getState().addEdge(e),
        updateEdge: (id, u) => useGraphStore.getState().updateEdge(id, u),
        setHoverInfo: updater => setHoverInfo(prev => updater(prev)),
        setLifecycleStageRendering: () => useGraphStore.getState().setLifecycleStage('rendering'),
        requestZoomSelection: () => useGraphStore.getState().requestZoom('selection'),
        onZoomTransform: t => {
          const pinned = useGraphStore.getState().viewPinned === true
          useGraphStore.getState().setZoomState({
            ...t,
            graphDataRevision: pinned ? undefined : graphDataRevisionRef.current,
          })
        },
        getSchema: () => schemaRef.current,
        getRenderMediaAsNodes: () => useGraphStore.getState().renderMediaAsNodes === true,
        layoutCacheKey: cacheKey,
        setLayoutPositionsForMode,
      });
      sceneBuildKeyRef.current = buildKey

    });
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [
    active,
    graphDataRevision,
    sceneWidth,
    sceneHeight,
    renderGraphData,
    schemaLayoutEngineJson,
    edgesForSim,
    setLayoutPositionsForMode,
    effectiveFrontmatterModeEnabled,
    documentSemanticMode,
    canvasRenderMode,
  ]);

  useEffect(() => {
    prevCanvasRenderModeRef.current = canvasRenderMode
  }, [canvasRenderMode])

  useEffect(() => {
    const g = gRef.current
    if (!g) return
    if (nodesPresentationAppliedKeyRef.current === schemaNodesPresentationJson) return
    if (!simulationRef.current) return
    if (!sceneGraphDataRef.current) return
    const schemaValue = schemaRef.current
    const hoverEnabled = schemaValue.behavior?.hover?.enabled !== false
    const expansionCfg = schemaValue.behavior?.expansion || {}
    const expansionEnabled = expansionCfg.enabled !== false
    const zoomOnDoubleClick = expansionEnabled && expansionCfg.zoomOnDoubleClick !== false
    updateForceSimulationPresentation({
      simulation: simulationRef.current,
      nodes: Array.isArray(sceneGraphDataRef.current.nodes) ? (sceneGraphDataRef.current.nodes as GraphNode[]) : [],
      width: sceneWidth,
      height: sceneHeight,
      schema: schemaValue,
    })
    updateGraphSceneNodesPresentation({
      gRef,
      schema: schemaValue,
      hoverEnabled,
      zoomOnDoubleClick,
      renderMediaAsNodes,
      mediaPanelDensity,
      tempLinkSelRef,
      linkDragRef,
      simulationRef,
      sceneGraphDataRef,
      nodesSelRef,
      mediaSelRef,
      portHandlesSelRef,
      labelsSelRef,
      setHoverInfo: updater => setHoverInfo(prev => updater(prev)),
      selectNode: id => useGraphStore.getState().selectNode(id),
      selectEdge: id => useGraphStore.getState().selectEdge(id),
      setSelectionSource: src => useGraphStore.getState().setSelectionSource(src),
      requestZoomSelection: () => useGraphStore.getState().requestZoom('selection'),
    })
    nodesPresentationAppliedKeyRef.current = schemaNodesPresentationJson
  }, [schemaNodesPresentationJson, sceneWidth, sceneHeight])

  useEffect(() => {
    const g = gRef.current
    if (!g) return
    if (groupsPresentationAppliedKeyRef.current === schemaGroupsPresentationJson) return
    const schemaValue = schemaRef.current
    if (!renderGraphData) return
    const hoverEnabled = schemaValue.behavior?.hover?.enabled !== false
    updateGraphSceneGroupsPresentation({
      gRef,
      schema: schemaValue,
      graphData: renderGraphData,
      beforeRenderFrameRef,
      simulationRef,
      hoverEnabled,
      setHoverInfo: updater => setHoverInfo(prev => updater(prev)),
      setSelectionSource: src => useGraphStore.getState().setSelectionSource(src),
      selectGroup: id => useGraphStore.getState().selectGroup(id),
      selectGroupExpanded: x =>
        useGraphStore.getState().selectGroupExpanded({ id: x.id, nodeIds: x.nodeIds, edgeIds: x.edgeIds }),
    })
    groupsPresentationAppliedKeyRef.current = schemaGroupsPresentationJson
  }, [schemaGroupsPresentationJson])


  useSelectionHighlight({
    nodesSelRef,
    mediaSelRef,
    labelsSelRef,
    linksSelRef,
  });
  useGroupSelectionHighlight({ gRef })

  useEffect(() => {
    if (!labelsSelRef.current || !renderGraphData) return;
    const { valuesByNodeId, kindsByNodeId } = flowState;
    if (Object.keys(kindsByNodeId).length === 0) return;
    labelsSelRef.current
      .text((d: GraphNode) => {
        const kind = kindsByNodeId[d.id];
        if (!kind) return d.label;
        const rawValue = valuesByNodeId[d.id];
        if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) return d.label;
        const rounded = Math.round(rawValue * 100) / 100;
        return `${d.label} (${rounded})`;
      });
  }, [flowState, renderGraphData, schemaNodesPresentationJson]);

  useGraphCanvasStyles({
    gRef,
    nodesSelRef,
    linksSelRef,
    labelsSelRef,
    schema,
    graphDataRevision: graphDataRevisionRef.current ?? 0,
  });

  return (
    <main
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      role="main"
      aria-label="Graph Canvas"
    >
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full z-0"
        viewBox={`0 0 ${Math.max(1, Math.floor(width))} ${Math.max(1, Math.floor(height))}`}
        preserveAspectRatio="xMidYMid meet"
      />
      <GraphHoverTooltip
        hoverInfo={hoverInfo}
        containerRef={containerRef as unknown as React.RefObject<HTMLElement | null>}
        nodes={(renderGraphData as GraphData | null)?.nodes}
        edges={(renderGraphData as GraphData | null)?.edges}
        schema={schema as GraphSchema | null}
        onRequestClose={() => setHoverInfo(null)}
      />
    </main>
  );
}
