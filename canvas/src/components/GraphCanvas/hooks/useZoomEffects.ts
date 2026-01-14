import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { GraphData } from '@/lib/graph/types';
import { GraphSchema } from '@/lib/graph/schema';
import { computePanelAwareCanvasDims } from '@/components/GraphCanvas/helpers';
import { applyZoomRequest, type ZoomRequest } from '@/components/GraphCanvas/zoomController';
import { applyZoomOnSelection } from '@/components/GraphCanvas/selectionZoom';

interface UseZoomEffectsProps {
  svgRef: React.RefObject<SVGSVGElement>;
  zoomRef: React.MutableRefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>;
  width: number;
  height: number;
  isSidebarOpen: boolean;
  sidebarWidthRatio: number;
  graphData: GraphData | null;
  renderGraphData: GraphData | null;
  schema: GraphSchema;

  zoomRequest: ZoomRequest | null;
  fitToScreenMode: boolean;
  zoomToSelectionMode: boolean;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedNodeIds: string[] | undefined;
  selectedEdgeIds: string[] | undefined;

  requestZoom: (type: 'fit' | 'in' | 'out' | 'selection' | 'reset') => void;
}

export function useZoomEffects({
  svgRef,
  zoomRef,
  width,
  height,
  isSidebarOpen,
  sidebarWidthRatio,
  graphData,
  renderGraphData,
  schema,
  zoomRequest,
  fitToScreenMode,
  zoomToSelectionMode,
  selectedNodeId,
  selectedEdgeId,
  selectedNodeIds,
  selectedEdgeIds,
  requestZoom,
}: UseZoomEffectsProps) {
  const lastFitDepsRef = useRef<{ nodesCount: number; width: number; height: number; layoutMode?: string; layerMode?: string } | null>(null);

  // Effect 1: Handle fitToScreenMode
  useEffect(() => {
    if (!fitToScreenMode) {
      lastFitDepsRef.current = null;
      return;
    }
    if (!renderGraphData || !Array.isArray(renderGraphData.nodes) || renderGraphData.nodes.length === 0) return;
    
    const layoutMode = schema.layout?.mode || 'force';
    const layerMode = schema.layers?.mode || 'property';
    
    const next = {
      nodesCount: renderGraphData.nodes.length,
      width: Math.max(1, Math.floor(width)),
      height: Math.max(1, Math.floor(height)),
      layoutMode,
      layerMode,
    };
    const prev = lastFitDepsRef.current;
    if (
      prev &&
      prev.nodesCount === next.nodesCount &&
      prev.width === next.width &&
      prev.height === next.height &&
      prev.layoutMode === next.layoutMode &&
      prev.layerMode === next.layerMode
    ) {
      return;
    }
    lastFitDepsRef.current = next;
    requestZoom('fit');
  }, [fitToScreenMode, renderGraphData, width, height, requestZoom, schema.layout?.mode, schema.layers?.mode]);

  // Effect 2: Handle zoomRequest
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
    svgRef,
    zoomRef,
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

  // Effect 3: Handle zoomToSelectionMode
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
    svgRef,
    zoomRef,
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
}
