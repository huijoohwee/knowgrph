import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useShallow } from 'zustand/react/shallow'
import { GraphNode, GraphEdge, GraphData } from '@/lib/graph/types'
import { type GraphSchema } from '@/lib/graph/schema'
import { useContainerDims } from '@/hooks/useContainerDims'
import { normalizeEdgesForSim } from '@/components/GraphCanvas/simulation'
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation'
import { GraphHoverTooltip, type HoverInfo } from '@/components/GraphHoverTooltip'
import {
  create2dSvgSnapshotFns,
  computeFlowState,
} from '@/components/GraphCanvas/helpers'
import { setupGraphScene } from '@/components/GraphCanvas/scene'
import { emitPropsPanelOpen } from '@/features/canvas/utils'
import { useGraphCanvasStyles } from '@/components/GraphCanvas/useGraphCanvasStyles'
import { useZoomEffects } from '@/components/GraphCanvas/hooks/useZoomEffects'
import { useEdgeCreationEffect } from '@/components/GraphCanvas/hooks/useEdgeCreationEffect'
import { useSelectionHighlight } from '@/components/GraphCanvas/hooks/useSelectionHighlight'
import { determineLayoutPositions } from '@/components/GraphCanvas/layout/positioning'
import { useDebouncedValue } from '@/features/hooks/useDebouncedValue'
import { useGraphStoreKeyRef } from '@/hooks/useGraphStoreKeyRef'

export default function GraphCanvas() {
  const containerRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const lastLayoutModeRef = useRef<null | 'force' | 'radial'>(null);
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
    setCanvasDims,
    setCanvasPos,
    schema,
    renderMediaAsNodes,
    mediaPanelDensity,
    setLayoutPositionsForMode,
    frontmatterModeEnabled,
    themeMode,
  } = useGraphStore(
    useShallow((s) => ({
      graphData: s.graphData as GraphData | null,
      graphDataRevision: s.graphDataRevision,
      setCanvasDims: s.setCanvasDims,
      setCanvasPos: s.setCanvasPos,
      schema: s.schema,
      renderMediaAsNodes: s.renderMediaAsNodes,
      mediaPanelDensity: s.mediaPanelDensity,
      setLayoutPositionsForMode: s.setLayoutPositionsForMode,
      frontmatterModeEnabled: s.frontmatterModeEnabled || false,
      themeMode: s.themeMode,
    })),
  );
  const registerCanvasSnapshotFns = useGraphStore(s => s.registerCanvasSnapshotFns);
  const selectedNodeIdRef = useGraphStoreKeyRef('selectedNodeId')
  const selectedEdgeIdRef = useGraphStoreKeyRef('selectedEdgeId')
  const selectedNodeIdsRef = useGraphStoreKeyRef('selectedNodeIds')
  const selectedEdgeIdsRef = useGraphStoreKeyRef('selectedEdgeIds')
  const graphDataRevisionRef = useGraphStoreKeyRef('graphDataRevision')
  const schemaRef = useRef(schema)

  const schemaLayoutJson = useMemo(() => JSON.stringify(schema?.layout), [schema?.layout]);

  const renderGraphData = graphData as GraphData | null

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
      const isPinned = useGraphStore.getState().viewPinned === true;
      const initialZoomTransform =
        z && (isPinned || z.graphDataRevision == null || z.graphDataRevision === graphDataRevisionRef.current)
          ? { k: z.k, x: z.x, y: z.y }
          : null;
      const mode = (schemaValue.layout?.mode || 'force') as 'force' | 'radial'
      const prevMode = lastLayoutModeRef.current
      const prevFrontmatterMode = lastFrontmatterModeRef.current

      const {
        layoutPositionsForMode,
        skipInitialLayout,
        cacheKey,
      } = determineLayoutPositions({
        mode,
        frontmatterMode: !!frontmatterModeEnabled,
        prevMode,
        prevFrontmatterMode,
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
      lastFrontmatterModeRef.current = !!frontmatterModeEnabled
      cleanupScene = setupGraphScene({
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
        linksSelRef,
        labelsSelRef,
        zoomRef,
        tempLinkSelRef,
        linkDragRef,
        selectedEdgeIdRef,
        selectedNodeIdRef,
        selectedNodeIdsRef,
        selectedEdgeIdsRef,
        selectNode: id => useGraphStore.getState().selectNode(id),
        selectEdge: id => useGraphStore.getState().selectEdge(id),
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
        layoutCacheKey: cacheKey,
        setLayoutPositionsForMode,
      });
    });
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      if (cleanupScene) cleanupScene();
    };
  }, [
    graphDataRevision,
    sceneWidth,
    sceneHeight,
    renderGraphData,
    schemaLayoutJson,
    edgesForSim,
    renderMediaAsNodes,
    mediaPanelDensity,
    setLayoutPositionsForMode,
    frontmatterModeEnabled,
  ]);


  useSelectionHighlight({
    nodesSelRef,
    mediaSelRef,
    labelsSelRef,
    linksSelRef,
  });

  useEffect(() => {
    if (!labelsSelRef.current || !graphData) return;
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
        onRequestClose={() => setHoverInfo(null)}
      />
    </main>
  );
}
