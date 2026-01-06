import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { GraphData, GraphNode, GraphEdge } from '@/lib/graph/types';
import { GraphSchema } from '@/lib/graph/schema';
import { selectionPerfStart, selectionPerfEnd } from '@/lib/selectionPerf';
import { applySelectionHighlight } from '@/components/GraphCanvas/highlight';

interface UseSelectionHighlightProps {
  renderGraphData: GraphData | null;
  graphData: GraphData | null;
  schema: GraphSchema;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedNodeIds: string[] | undefined;
  selectedEdgeIds: string[] | undefined;
  setLifecycleStage: (stage: string) => void;
  
  // Refs to d3 selections
  nodesSelRef: React.MutableRefObject<d3.Selection<SVGCircleElement, GraphNode, SVGGElement, unknown> | null>;
  mediaSelRef: React.MutableRefObject<d3.Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown> | null>;
  labelsSelRef: React.MutableRefObject<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>;
  linksSelRef: React.MutableRefObject<d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null>;
}

export function useSelectionHighlight({
  renderGraphData,
  graphData,
  schema,
  selectedNodeId,
  selectedEdgeId,
  selectedNodeIds,
  selectedEdgeIds,
  setLifecycleStage,
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
  }, [
    selectedNodeId, 
    selectedEdgeId, 
    selectedNodeIds, 
    selectedEdgeIds, 
    renderGraphData, 
    graphData, 
    schema
  ]);
}
