import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { GraphData, GraphNode, GraphEdge } from '@/lib/graph/types';
import { GraphSchema } from '@/lib/graph/schema';
import { selectionPerfStart, selectionPerfEnd } from '@/lib/selectionPerf';
import { applySelectionHighlight } from '@/components/GraphCanvas/highlight';
import { UI_THEME_COLORS } from '@/lib/ui/theme-tokens';
import type { ThemeMode } from '@/lib/ui/theme';

interface UseSelectionHighlightProps {
  renderGraphData: GraphData | null;
  graphData: GraphData | null;
  schema: GraphSchema;
  paused?: boolean;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedNodeIds: string[] | undefined;
  selectedEdgeIds: string[] | undefined;
  setLifecycleStage: (stage: string) => void;
  renderMediaAsNodes: boolean;
  mediaNodeOpacity: number;
  activeLayerBandIndex: number | null;
  themeMode: ThemeMode;
  
  // Refs to d3 selections
  nodesSelRef: React.MutableRefObject<d3.Selection<SVGElement, GraphNode, SVGGElement, unknown> | null>;
  mediaSelRef: React.MutableRefObject<d3.Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown> | null>;
  labelsSelRef: React.MutableRefObject<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>;
  linksSelRef: React.MutableRefObject<d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null>;
}

export function useSelectionHighlight({
  renderGraphData,
  graphData,
  schema,
  paused,
  selectedNodeId,
  selectedEdgeId,
  selectedNodeIds,
  selectedEdgeIds,
  setLifecycleStage,
  renderMediaAsNodes,
  mediaNodeOpacity,
  activeLayerBandIndex,
  themeMode,
  nodesSelRef,
  mediaSelRef,
  labelsSelRef,
  linksSelRef,
}: UseSelectionHighlightProps) {
  const setLifecycleStageRef = useRef(setLifecycleStage);
  
  useEffect(() => {
    setLifecycleStageRef.current = setLifecycleStage;
  }, [setLifecycleStage]);

  useEffect(() => {
    if (paused) return;
    if (!renderGraphData) return;
    const t0 = selectionPerfStart();
    setLifecycleStageRef.current('selectionUpdate');
    
    const isDark = themeMode === 'dark' || (themeMode === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const themeColors = isDark ? UI_THEME_COLORS.dark : UI_THEME_COLORS.light;

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
      renderMediaAsNodes,
      { mediaNodeOpacity, activeLayerBandIndex, themeColors },
    );
    selectionPerfEnd('canvas', t0);
  }, [
    paused,
    selectedNodeId, 
    selectedEdgeId, 
    selectedNodeIds, 
    selectedEdgeIds, 
    renderGraphData, 
    graphData, 
    schema,
    nodesSelRef,
    mediaSelRef,
    labelsSelRef,
    linksSelRef,
    renderMediaAsNodes,
    mediaNodeOpacity,
    activeLayerBandIndex,
    themeMode,
  ]);
}
