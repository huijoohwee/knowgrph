import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useGraphStore } from '@/hooks/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { GraphNode, GraphEdge, GraphData } from '@/lib/graph/types';
import { type GraphSchema } from '@/lib/graph/schema';
import { useContainerDims } from '@/hooks/useContainerDims';
import { normalizeEdgesForSim } from '@/components/GraphCanvas/utils';
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation';
import { GraphHoverTooltip, type HoverInfo } from '@/components/GraphHoverTooltip';
import {
  create2dSvgSnapshotFns,
  computeFlowState,
} from '@/components/GraphCanvas/helpers';
import { setupGraphScene } from '@/components/GraphCanvas/scene';
import { applySelectionHighlight } from '@/components/GraphCanvas/highlight';
import { emitPropsPanelOpen } from '@/features/canvas/utils';
import { deriveGraphDataForLayers, filterGraphToFrontmatterMermaid } from '@/lib/graph/layerDerivation';
import { useGraphCanvasStyles } from '@/components/GraphCanvas/useGraphCanvasStyles';
import { useZoomEffects } from '@/components/GraphCanvas/hooks/useZoomEffects';
import { useEdgeCreationEffect } from '@/components/GraphCanvas/hooks/useEdgeCreationEffect';
import { useSelectionHighlight } from '@/components/GraphCanvas/hooks/useSelectionHighlight';
import { determineLayoutPositions } from '@/components/GraphCanvas/layout/positioning';
import { useDebouncedValue } from '@/features/hooks/useDebouncedValue';

export default function GraphCanvas() {
  const containerRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const lastLayoutModeRef = useRef<null | 'force' | 'radial' | 'tree' | 'mermaid'>(null);
  const lastLayerModeRef = useRef<null | string>(null);
  const lastFrontmatterModeRef = useRef<boolean | null>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const nodesSelRef = useRef<d3.Selection<SVGElement, GraphNode, SVGGElement, unknown> | null>(null);
  const mediaSelRef = useRef<d3.Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown> | null>(null);
  const linksSelRef = useRef<d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null>(null);
  const labelsSelRef = useRef<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const {
    graphData,
    graphDataRevision,
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
    isEditMode,
    selectNode,
    selectEdge,
    addEdge,
    updateEdge,
    setCanvasDims,
    setCanvasPos,
    schema,
    setZoomState,
    zoomRequest,
    setSelectionSource,
    edgeCreationRequest,
    clearEdgeCreationRequest,
    requestZoom,
    setLifecycleStage,
    fitToScreenMode,
    zoomToSelectionMode,
    graphLayersVisible,
    isSidebarOpen,
    sidebarWidthRatio,
    renderMediaAsNodes,
    mediaNodeOpacity,
    mediaPanelDensity,
    setLayoutPositionsForMode,
    activeLayerBandIndex,
    frontmatterModeEnabled,
    markdownDocumentName,
    themeMode,
  } = useGraphStore(
    useShallow((s) => ({
      graphData: s.graphData as GraphData | null,
      graphDataRevision: s.graphDataRevision,
      selectedNodeId: s.selectedNodeId,
      selectedEdgeId: s.selectedEdgeId,
      selectedNodeIds: s.selectedNodeIds,
      selectedEdgeIds: s.selectedEdgeIds,
      isEditMode: s.isEditMode,
      selectNode: s.selectNode,
      selectEdge: s.selectEdge,
      addEdge: s.addEdge,
      updateEdge: s.updateEdge,
      setCanvasDims: s.setCanvasDims,
      setCanvasPos: s.setCanvasPos,
      schema: s.schema,
      setZoomState: s.setZoomState,
      zoomRequest: s.zoomRequest,
      setSelectionSource: s.setSelectionSource,
      edgeCreationRequest: s.edgeCreationRequest,
      clearEdgeCreationRequest: s.clearEdgeCreationRequest,
      requestZoom: s.requestZoom,
      setLifecycleStage: s.setLifecycleStage,
      fitToScreenMode: s.fitToScreenMode,
      zoomToSelectionMode: s.zoomToSelectionMode,
      graphLayersVisible: s.graphLayersVisible,
      isSidebarOpen: s.isSidebarOpen,
      sidebarWidthRatio: s.sidebarWidthRatio,
      renderMediaAsNodes: s.renderMediaAsNodes,
      mediaNodeOpacity: s.mediaNodeOpacity,
      mediaPanelDensity: s.mediaPanelDensity,
      setLayoutPositionsForMode: s.setLayoutPositionsForMode,
      activeLayerBandIndex: s.activeLayerBandIndex,
      frontmatterModeEnabled: s.frontmatterModeEnabled || false,
      markdownDocumentName: s.markdownDocumentName || '',
      themeMode: s.themeMode,
    })),
  );
  const registerCanvasSnapshotFns = useGraphStore(s => s.registerCanvasSnapshotFns);
  const selectNodeRef = useRef(selectNode);
  const setZoomStateRef = useRef(setZoomState);
  const selectEdgeRef = useRef(selectEdge);
  const setSelectionSourceRef = useRef(setSelectionSource);
  const addEdgeRef = useRef(addEdge);
  const updateEdgeRef = useRef(updateEdge);
  const isEditModeRef = useRef(isEditMode);
  const selectedNodeIdRef = useRef<string | null>(selectedNodeId);
  const selectedEdgeIdRef = useRef<string | null>(selectedEdgeId);
  const selectedNodeIdsRef = useRef<string[] | undefined>(selectedNodeIds);
  const selectedEdgeIdsRef = useRef<string[] | undefined>(selectedEdgeIds);
  const schemaRef = useRef(schema);
  const clearEdgeCreationRequestRef = useRef(clearEdgeCreationRequest);
  const setLifecycleStageRef = useRef(setLifecycleStage);
  const requestZoomRef = useRef(requestZoom);
  const graphDataRevisionRef = useRef(graphDataRevision);
  const renderGraphData = useMemo(
    () => {
      const base = graphData as GraphData | null;
      const schemaObj = schema as GraphSchema;
      const docName = (markdownDocumentName || '').trim() || null;
      const frontmatterOnly = !!frontmatterModeEnabled;
      const scopedGraph = frontmatterOnly ? filterGraphToFrontmatterMermaid(base, docName) : base;
      return deriveGraphDataForLayers(scopedGraph as GraphData | null, schemaObj);
    },
    [graphData, schema, frontmatterModeEnabled, markdownDocumentName],
  );

  useEffect(() => {
    selectNodeRef.current = selectNode;
    setZoomStateRef.current = setZoomState;
    selectEdgeRef.current = selectEdge;
    setSelectionSourceRef.current = setSelectionSource;
    addEdgeRef.current = addEdge;
    updateEdgeRef.current = updateEdge;
    isEditModeRef.current = isEditMode;
    selectedNodeIdRef.current = selectedNodeId;
    selectedEdgeIdRef.current = selectedEdgeId;
    selectedNodeIdsRef.current = selectedNodeIds;
    selectedEdgeIdsRef.current = selectedEdgeIds;
    schemaRef.current = schema;
    clearEdgeCreationRequestRef.current = clearEdgeCreationRequest;
    setLifecycleStageRef.current = setLifecycleStage;
    requestZoomRef.current = requestZoom;
    graphDataRevisionRef.current = graphDataRevision;
  }, [
    addEdge,
    clearEdgeCreationRequest,
    graphDataRevision,
    isEditMode,
    requestZoom,
    schema,
    selectEdge,
    selectNode,
    selectedEdgeId,
    selectedEdgeIds,
    selectedNodeId,
    selectedNodeIds,
    setLifecycleStage,
    setSelectionSource,
    setZoomState,
    updateEdge,
  ]);
  const { width, height, left, top } = useContainerDims(containerRef);
  const debouncedWidth = useDebouncedValue(width, 100);
  const debouncedHeight = useDebouncedValue(height, 100);
  const tempLinkSelRef = useRef<TempLinkSelection>(null);
  const linkDragRef = useRef<PendingLink | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onContextMenu = (ev: MouseEvent) => {
      if (ev.defaultPrevented) return;
      ev.preventDefault();
      setSelectionSourceRef.current('menu');
      selectNodeRef.current(null);
      selectEdgeRef.current(null);
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

  useZoomEffects({
    svgRef,
    zoomRef,
    width,
    height,
    isSidebarOpen,
    sidebarWidthRatio,
    graphData: graphData as GraphData | null,
    renderGraphData: renderGraphData as GraphData | null,
    schema: schema as GraphSchema,
    zoomRequest,
    fitToScreenMode,
    zoomToSelectionMode,
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
    requestZoom,
  });

  useEdgeCreationEffect({
    edgeCreationRequest,
    graphData: graphData as GraphData | null,
    selectedEdgeId,
    tempLinkSelRef,
    linkDragRef,
    clearEdgeCreationRequest,
    selectEdge,
    setSelectionSource,
  });

  useEffect(() => {
    registerCanvasSnapshotFns('2d', svgRef.current ? create2dSvgSnapshotFns(svgRef) : null);
    return () => {
      registerCanvasSnapshotFns('2d', null);
    };
  }, [registerCanvasSnapshotFns]);

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
    if (!renderGraphData || !svgRef.current) return;
    const schemaValue = schemaRef.current;
    if (!schemaValue) return;
    const hoverEnabled = schemaValue.behavior?.hover?.enabled !== false;
    const expansionCfg = schemaValue.behavior?.expansion || {};
    const expansionEnabled = expansionCfg.enabled !== false;
    const zoomOnDoubleClick = expansionEnabled && expansionCfg.zoomOnDoubleClick !== false;
    let rafId: number | null = null;
    let cleanupScene: (() => void) | null = null;
    rafId = requestAnimationFrame(() => {
      if (!svgRef.current) return;
      const z = useGraphStore.getState().zoomState;
      const layoutPositionCacheByMode = useGraphStore.getState().layoutPositionCacheByMode;
      const initialZoomTransform =
        z && (z.graphDataRevision == null || z.graphDataRevision === graphDataRevisionRef.current)
          ? { k: z.k, x: z.x, y: z.y }
          : null;
      const mode = schemaValue.layout?.mode || 'force'
      const prevMode = lastLayoutModeRef.current
      const layerMode = String(schemaValue.layers?.mode || 'property')
      const prevLayerMode = lastLayerModeRef.current
      const prevFrontmatterMode = lastFrontmatterModeRef.current

      const {
        layoutPositionsForMode,
        skipInitialLayout,
        cacheKey,
      } = determineLayoutPositions({
        mode,
        layerMode,
        frontmatterMode: !!frontmatterModeEnabled,
        prevMode,
        prevLayerMode,
        prevFrontmatterMode,
        nodes: Array.isArray(renderGraphData.nodes) ? renderGraphData.nodes : [],
        edgesRevision: graphDataRevisionRef.current,
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
      lastLayerModeRef.current = layerMode
      lastFrontmatterModeRef.current = !!frontmatterModeEnabled
      cleanupScene = setupGraphScene({
        svgEl: svgRef.current,
        svgRef,
        graphData: renderGraphData,
        schema: schemaValue,
        edgesForSim,
        width: debouncedWidth,
        height: debouncedHeight,
        hoverEnabled,
        zoomOnDoubleClick,
        graphLayersVisible,
        renderMediaAsNodes,
        mediaPanelDensity,
        initialZoomTransform,
        layoutPositionsForMode,
        prevPositions: Object.keys(prevPositions).length > 0 ? prevPositions : null,
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
        selectNode: id => selectNodeRef.current(id),
        selectEdge: id => selectEdgeRef.current(id),
        setSelectionSource: src => setSelectionSourceRef.current(src),
        addEdge: e => addEdgeRef.current(e),
        updateEdge: (id, u) => updateEdgeRef.current(id, u),
        setHoverInfo: updater => setHoverInfo(prev => updater(prev)),
        setLifecycleStageRendering: () => setLifecycleStageRef.current('rendering'),
        requestZoomSelection: () => requestZoomRef.current('selection'),
        onZoomTransform: t =>
          setZoomStateRef.current({ ...t, graphDataRevision: graphDataRevisionRef.current }),
        layoutCacheKey: cacheKey,
        setLayoutPositionsForMode,
      });
      applySelectionHighlight(
        nodesSelRef.current,
        mediaSelRef.current,
        labelsSelRef.current,
        linksSelRef.current,
        renderGraphData as GraphData,
        schemaValue,
        selectedNodeIdRef.current,
        selectedEdgeIdRef.current,
        selectedNodeIdsRef.current,
        selectedEdgeIdsRef.current,
        renderMediaAsNodes,
        { mediaNodeOpacity, activeLayerBandIndex },
      );
    });
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      if (cleanupScene) cleanupScene();
    };
  }, [
    graphData,
    graphDataRevision,
    debouncedWidth,
    debouncedHeight,
    renderGraphData,
    schema,
    edgesForSim,
    graphLayersVisible,
    renderMediaAsNodes,
    mediaNodeOpacity,
    mediaPanelDensity,
    setLayoutPositionsForMode,
    activeLayerBandIndex,
    frontmatterModeEnabled,
  ]);


  useSelectionHighlight({
    renderGraphData: renderGraphData as GraphData | null,
    graphData: graphData as GraphData | null,
    schema: schema as GraphSchema,
    themeMode,
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
    setLifecycleStage,
    nodesSelRef,
    mediaSelRef,
    labelsSelRef,
    linksSelRef,
    renderMediaAsNodes,
    mediaNodeOpacity,
    activeLayerBandIndex,
  });

  useEffect(() => {
    if (!labelsSelRef.current || !graphData) return;
    const { valuesByNodeId, kindsByNodeId } = flowState;
    labelsSelRef.current
      .text((d: GraphNode) => {
        const kind = kindsByNodeId[d.id];
        if (!kind) return d.label;
        const rawValue = valuesByNodeId[d.id];
        if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) return d.label;
        const rounded = Math.round(rawValue * 100) / 100;
        return `${d.label} (${rounded})`;
      });
  }, [flowState, graphData]);

  useGraphCanvasStyles({
    nodesSelRef,
    linksSelRef,
    labelsSelRef,
    schema,
    themeMode,
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
      />
    </main>
  );
}
