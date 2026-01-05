import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useGraphStore } from '@/hooks/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { GraphNode, GraphEdge, GraphData } from '@/lib/graph/types';
import { type GraphSchema } from '@/lib/graph/schema';
import { useContainerDims } from '@/hooks/useContainerDims';
import { normalizeEdgesForSim, type EdgeWithRuntime } from '@/components/GraphCanvas/utils';
import { applyZoomRequest } from '@/components/GraphCanvas/zoomController';
import { startEdgeFromNode, startUpdateEdgeEndpoint } from '@/features/edge-creation';
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation';
import { GraphHoverTooltip, type HoverInfo } from '@/components/GraphHoverTooltip';
import {
  getRenderNodeRadius2d,
  getEdgeBaseStroke,
  getEdgeStrokeWidth,
  computeFlowState,
  computePanelAwareCanvasDims,
  create2dSvgSnapshotFns,
} from '@/components/GraphCanvas/helpers';
import { selectionPerfStart, selectionPerfEnd } from '@/lib/selectionPerf';
import { setupGraphScene } from '@/components/GraphCanvas/scene';
import { applySelectionHighlight } from '@/components/GraphCanvas/highlight';
import { applyZoomOnSelection } from '@/components/GraphCanvas/selectionZoom';
import { emitPropsPanelOpen } from '@/features/canvas/utils';
import { deriveGraphDataForLayers } from '@/lib/graph/layerDerivation';

export default function GraphCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const lastLayoutModeRef = useRef<null | 'force' | 'radial' | 'tidy-tree'>(null);
  const lastLayerModeRef = useRef<null | string>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const nodesSelRef = useRef<d3.Selection<SVGCircleElement, GraphNode, SVGGElement, unknown> | null>(null);
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
    polygonGroupsVisible,
    isSidebarOpen,
    sidebarWidthRatio,
    layoutPositionCacheByMode,
  } = useGraphStore(
    useShallow((s) => ({
      graphData: s.graphData,
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
      polygonGroupsVisible: s.polygonGroupsVisible,
      isSidebarOpen: s.isSidebarOpen,
      sidebarWidthRatio: s.sidebarWidthRatio,
      layoutPositionCacheByMode: s.layoutPositionCacheByMode,
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
    () => deriveGraphDataForLayers(graphData as GraphData | null, schema as GraphSchema),
    [graphData, schema],
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
  const { width, height, left, top } = useContainerDims(containerRef as unknown as React.RefObject<HTMLElement | null>);
  const tempLinkSelRef = useRef<TempLinkSelection>(null);
  const linkDragRef = useRef<PendingLink | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const lastFitDepsRef = useRef<{ nodesCount: number; width: number; height: number } | null>(null);

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

  useEffect(() => {
    if (!fitToScreenMode) {
      lastFitDepsRef.current = null;
      return;
    }
    if (!renderGraphData || !Array.isArray(renderGraphData.nodes) || renderGraphData.nodes.length === 0) return;
    const next = {
      nodesCount: renderGraphData.nodes.length,
      width: Math.max(1, Math.floor(width)),
      height: Math.max(1, Math.floor(height)),
    };
    const prev = lastFitDepsRef.current;
    if (prev && prev.nodesCount === next.nodesCount && prev.width === next.width && prev.height === next.height) {
      return;
    }
    lastFitDepsRef.current = next;
    requestZoom('fit');
  }, [fitToScreenMode, renderGraphData, width, height, requestZoom]);

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
      const initialZoomTransform =
        z && (z.graphDataRevision == null || z.graphDataRevision === graphDataRevisionRef.current)
          ? { k: z.k, x: z.x, y: z.y }
          : null;
      const mode = schemaValue.layout?.mode || 'force'
      const prevMode = lastLayoutModeRef.current
      const layerMode = String(schemaValue.layers?.mode || 'property')
      const prevLayerMode = lastLayerModeRef.current
      const isModeChange = prevMode !== mode
      const isLayerChange = prevLayerMode !== layerMode
      const isStructuredMode = mode === 'radial' || mode === 'tidy-tree'
      const nodes = Array.isArray(renderGraphData.nodes) ? renderGraphData.nodes : []
      const coverageFromNodes = (() => {
        if (!isStructuredMode) return 0
        if (nodes.length === 0) return 0
        let matches = 0
        for (let i = 0; i < nodes.length; i += 1) {
          const n = nodes[i]
          const x = typeof n.x === 'number' ? n.x : null
          const y = typeof n.y === 'number' ? n.y : null
          if (x == null || y == null) continue
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue
          matches += 1
        }
        return matches / Math.max(1, nodes.length)
      })()
      const cachedPositions =
        isStructuredMode && layoutPositionCacheByMode
          ? (layoutPositionCacheByMode[`${layerMode}:${mode}`] ?? null)
          : null
      const coverageFromCache = (() => {
        if (!isStructuredMode) return 0
        if (!cachedPositions) return 0
        if (nodes.length === 0) return 0
        let matches = 0
        for (let i = 0; i < nodes.length; i += 1) {
          const p = cachedPositions[String(nodes[i].id)]
          if (!p) continue
          const x = typeof p.x === 'number' ? p.x : null
          const y = typeof p.y === 'number' ? p.y : null
          if (x == null || y == null) continue
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue
          matches += 1
        }
        return matches / Math.max(1, nodes.length)
      })()
      const shouldUseCache =
        isStructuredMode &&
        !!cachedPositions &&
        coverageFromCache >= 0.95 &&
        (isModeChange || isLayerChange || coverageFromNodes < 0.95)
      const layoutPositionsForMode = shouldUseCache ? cachedPositions : null
      const skipInitialLayout =
        isStructuredMode &&
        (shouldUseCache || (!isModeChange && !isLayerChange && coverageFromNodes >= 0.95))
      lastLayoutModeRef.current = mode
      lastLayerModeRef.current = layerMode
      cleanupScene = setupGraphScene({
        svgEl: svgRef.current,
        svgRef,
        graphData: renderGraphData,
        schema: schemaValue,
        edgesForSim,
        width,
        height,
        hoverEnabled,
        zoomOnDoubleClick,
        polygonsVisible: polygonGroupsVisible,
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
      );
    });
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      if (cleanupScene) cleanupScene();
    };
  }, [
    graphData,
    graphDataRevision,
    width,
    height,
    renderGraphData,
    schema,
    edgesForSim,
    polygonGroupsVisible,
    layoutPositionCacheByMode,
  ]);


  useEffect(() => {
    if (!edgeCreationRequest || !graphData) return;
    const n = graphData.nodes.find(x => x.id === edgeCreationRequest.fromId);
    if (!n) { clearEdgeCreationRequestRef.current(); return; }
    if (edgeCreationRequest.type === 'create') {
      startEdgeFromNode(n, tempLinkSelRef, linkDragRef);
    } else {
      const sel = selectedEdgeId ? graphData.edges.find(e => e.id === selectedEdgeId) : null;
      if (sel) {
        const selectEdgeNonNull: (id: string) => void = id => selectEdgeRef.current(id);
        const setSelectionSourceStrict: (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => void = src => setSelectionSourceRef.current(src);
        startUpdateEdgeEndpoint(sel, n, edgeCreationRequest.type, tempLinkSelRef, linkDragRef, selectEdgeNonNull, setSelectionSourceStrict);
      } else {
        startEdgeFromNode(n, tempLinkSelRef, linkDragRef);
      }
    }
    clearEdgeCreationRequestRef.current();
  }, [edgeCreationRequest, graphData, selectedEdgeId]);

  useEffect(() => {
    if (!zoomRequest || !svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    const panelDims = computePanelAwareCanvasDims(
      Math.max(1, Math.floor(width)),
      Math.max(1, Math.floor(height)),
      !!isSidebarOpen,
      sidebarWidthRatio,
    );
    applyZoomRequest(zoomRequest, {
      svg,
      zoom: zoomRef.current,
      graphData,
      width: panelDims.width,
      height: panelDims.height,
      selectedNodeId,
      selectedEdgeId,
      selectedNodeIds,
      selectedEdgeIds,
    });
  }, [
    zoomRequest,
    graphData,
    width,
    height,
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
    isSidebarOpen,
    sidebarWidthRatio,
  ]);

  useEffect(() => {
    if (!renderGraphData) return;
    const t0 = selectionPerfStart();
    setLifecycleStageRef.current('selectionUpdate');
    applySelectionHighlight(
      nodesSelRef.current,
      mediaSelRef.current,
      labelsSelRef.current,
      linksSelRef.current,
      graphData as GraphData,
      schema as GraphSchema,
      selectedNodeId,
      selectedEdgeId,
      selectedNodeIds,
      selectedEdgeIds,
    );
    selectionPerfEnd('canvas', t0);
  }, [selectedNodeId, selectedEdgeId, selectedNodeIds, selectedEdgeIds, renderGraphData, graphData, schema]);

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

  useEffect(() => {
    const isTidyTree = schema.layout?.mode === 'tidy-tree'
    const tidyCfg = schema.layout?.tidyTree || {}
    const tidyColorMode = tidyCfg.colorMode === 'schema' ? 'schema' : 'observable'
    if (nodesSelRef.current) {
      nodesSelRef.current
        .attr('r', (d: GraphNode) => getRenderNodeRadius2d(d, schema))
      if (isTidyTree && tidyColorMode === 'observable') {
        nodesSelRef.current.attr('stroke', 'none').attr('stroke-width', 0)
      } else {
        nodesSelRef.current
          .attr('stroke', (d: GraphNode) => (schema.nodeStroke?.[d.type]?.color ?? (isTidyTree ? 'none' : '#ffffff')))
          .attr('stroke-width', (d: GraphNode) => (schema.nodeStroke?.[d.type]?.width ?? (isTidyTree ? 0 : 1.5)))
      }
    }
    if (linksSelRef.current) {
      linksSelRef.current.attr('stroke', (d: GraphEdge) => {
        if (isTidyTree) {
          const override = typeof tidyCfg.linkStroke === 'string' ? tidyCfg.linkStroke.trim() : ''
          if (override) return override
          return getEdgeBaseStroke(d, schema)
        }
        return getEdgeBaseStroke(d, schema)
      })
      linksSelRef.current.attr('stroke-opacity', () => {
        if (!isTidyTree) return 0.6
        const raw = tidyCfg.linkOpacity
        if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.min(1, raw))
        return 0.4
      })
      linksSelRef.current.attr('stroke-width', (d: GraphEdge) => {
        if (isTidyTree) {
          const raw = tidyCfg.linkWidth
          if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
        }
        return getEdgeStrokeWidth(d as EdgeWithRuntime, schema)
      })
      if (schema.layout?.mode === 'tidy-tree') {
        linksSelRef.current.attr('marker-end', null);
      } else {
        linksSelRef.current.attr(
          'marker-end',
          (d: GraphEdge) => (schema.edgeStyles[d.label]?.arrow ? 'url(#arrowhead)' : null),
        );
      }
    }
    if (labelsSelRef.current) {
      const labelFontSize = (() => {
        if (!isTidyTree) return schema.labelStyles?.fontSize ?? 12
        const raw = tidyCfg.labelFontSize
        if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
        const fromLabelStyles = schema.labelStyles?.fontSize
        if (typeof fromLabelStyles === 'number' && Number.isFinite(fromLabelStyles) && fromLabelStyles > 0) return fromLabelStyles
        return 10
      })()
      const haloColor = schema.labelStyles?.halo?.color ?? '#ffffff'
      const haloWidthRaw = schema.labelStyles?.halo?.width
      const haloWidth =
        typeof haloWidthRaw === 'number' && Number.isFinite(haloWidthRaw) && haloWidthRaw > 0 ? haloWidthRaw : 3
      const labelFill = (() => {
        if (!isTidyTree || tidyColorMode === 'schema') return schema.labelStyles?.color ?? '#111'
        const override = typeof tidyCfg.linkStroke === 'string' ? tidyCfg.linkStroke.trim() : ''
        return override || '#555'
      })()
      labelsSelRef.current.attr('font-size', labelFontSize).attr('fill', labelFill)
      if (isTidyTree && tidyColorMode === 'observable') {
        labelsSelRef.current
          .attr('paint-order', 'stroke')
          .attr('stroke', haloColor)
          .attr('stroke-width', haloWidth)
          .attr('stroke-linejoin', 'round')
      } else {
        labelsSelRef.current.attr('paint-order', null).attr('stroke', null).attr('stroke-width', null).attr('stroke-linejoin', null)
      }
      if (!isTidyTree) {
        labelsSelRef.current
          .attr('dx', (schema.labelStyles?.offset?.dx ?? 12))
          .attr('dy', (schema.labelStyles?.offset?.dy ?? 4))
      }
    }
  }, [schema, selectedNodeId]);

  useEffect(() => {
    if (!zoomToSelectionMode) return;
    if (!graphData || !svgRef.current || !zoomRef.current) return;
    const expansionCfg = schema.behavior?.expansion || {};
    const expansionEnabled = expansionCfg.enabled !== false;
    const zoomOnSelection = expansionEnabled && expansionCfg.zoomOnSelection !== false;
    if (!zoomOnSelection) return;
    const svg = d3.select(svgRef.current);
    const panelDims = computePanelAwareCanvasDims(
      Math.max(1, Math.floor(width)),
      Math.max(1, Math.floor(height)),
      !!isSidebarOpen,
      sidebarWidthRatio,
    );
    applyZoomOnSelection({
      graphData: renderGraphData as GraphData,
      svg,
      zoom: zoomRef.current,
      width: panelDims.width,
      height: panelDims.height,
      selectedNodeId,
      selectedEdgeId,
      selectedNodeIds,
      selectedEdgeIds,
    });
  }, [
    zoomToSelectionMode,
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
    renderGraphData,
    graphData,
    width,
    height,
    schema.behavior?.expansion,
    isSidebarOpen,
    sidebarWidthRatio,
  ]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
    >
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full z-0"
        viewBox={`0 0 ${Math.max(1, Math.floor(width))} ${Math.max(1, Math.floor(height))}`}
        preserveAspectRatio="none"
      />
      <GraphHoverTooltip
        hoverInfo={hoverInfo}
        containerRef={containerRef as unknown as React.RefObject<HTMLElement | null>}
        nodes={(renderGraphData as GraphData | null)?.nodes}
        edges={(renderGraphData as GraphData | null)?.edges}
        schema={schema as GraphSchema | null}
      />
    </div>
  );
}
