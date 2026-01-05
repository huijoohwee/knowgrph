import * as d3 from 'd3';
import { GraphNode, GraphEdge } from '@/lib/graph/types';
import { GraphSchema } from '@/lib/graph/schema';

export const nodeDragBehavior = (simulation: d3.Simulation<GraphNode, GraphEdge>, schema: GraphSchema) =>
  d3.drag<SVGCircleElement, GraphNode>()
    .on('start', (event, d) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on('drag', (event, d) => {
      const gridEnabled = !!schema.behavior.snapGrid?.enabled;
      const gridSize = Math.max(1, schema.behavior.snapGrid?.size ?? 10);
      const xRaw = event.x;
      const yRaw = event.y;
      const x = gridEnabled ? Math.round(xRaw / gridSize) * gridSize : xRaw;
      const y = gridEnabled ? Math.round(yRaw / gridSize) * gridSize : yRaw;
      const constraint = schema.behavior.dragConstraint || 'free';
      if (constraint === 'axis-x') {
        d.fx = x;
      } else if (constraint === 'axis-y') {
        d.fy = y;
      } else if (constraint === 'none') {
        d.fx = d.x;
        d.fy = d.y;
      } else {
        d.fx = x;
        d.fy = y;
      }
    })
    .on('end', (event, d) => {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
      d.vx = 0;
      d.vy = 0;
      if (schema.layout?.mode === 'radial' || schema.layout?.mode === 'tidy-tree') {
        simulation.stop();
      }
    });
