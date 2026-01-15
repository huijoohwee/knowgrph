import * as d3 from 'd3';
import { GraphNode, GraphEdge } from '@/lib/graph/types';
import { GraphSchema } from '@/lib/graph/schema';

export const nodeDragBehavior = (simulation: d3.Simulation<GraphNode, GraphEdge>, schema: GraphSchema) =>
  d3.drag<SVGElement, GraphNode>()
    .on('start', (event, d) => {
      // In Mermaid mode, we don't want forces to restart because we manually control layout
      const isMermaid = schema.layout?.mode === 'mermaid';
      if (!isMermaid && !event.active) {
         simulation.alphaTarget(0.3).restart();
      }
      d.fx = d.x;
      d.fy = d.y;
    })
    .on('drag', (event, d) => {
      const isMermaid = schema.layout?.mode === 'mermaid';
      const gridEnabled = !!schema.behavior.snapGrid?.enabled;
      const gridSize = Math.max(1, schema.behavior.snapGrid?.size ?? 10);
      
      // Calculate new position
      let nx = event.x;
      let ny = event.y;
      
      if (gridEnabled) {
        nx = Math.round(nx / gridSize) * gridSize;
        ny = Math.round(ny / gridSize) * gridSize;
      }
      
      const constraint = schema.behavior.dragConstraint || 'free';
      if (constraint === 'axis-x') {
        d.fx = nx;
        if (isMermaid) d.x = nx;
      } else if (constraint === 'axis-y') {
        d.fy = ny;
        if (isMermaid) d.y = ny;
      } else if (constraint === 'none') {
        d.fx = d.x; // Keep original if 'none' constraint, though usually 'free' is default
        d.fy = d.y;
      } else {
        d.fx = nx;
        d.fy = ny;
        if (isMermaid) {
            d.x = nx;
            d.y = ny;
        }
      }

      // Mermaid Subgraph Dragging Logic
      // If we are dragging a subgraph container, move all its children by the same delta
      if (isMermaid && d.type === 'MermaidSubgraph') {
         const dx = event.dx;
         const dy = event.dy;
         // We use the raw event.dx/dy which is the delta of the pointer.
         // This assumes the drag is 1:1. 
         
         const subgraphNameRaw = d.properties ? d.properties['subgraphName'] : null
         const subgraphName = typeof subgraphNameRaw === 'string' ? subgraphNameRaw : null
         if (subgraphName && (dx !== 0 || dy !== 0)) {
             simulation.nodes().forEach(n => {
                 // Check if n is a child of this subgraph
                 const childSubgraphRaw = n.properties ? n.properties['mermaidSubgraphName'] : null
                 const childSubgraphName = typeof childSubgraphRaw === 'string' ? childSubgraphRaw : null
                 if (n !== d && childSubgraphName === subgraphName) {
                     // Move child
                     // We update both fixed position (fx, fy) and current position (x, y)
                     // because simulation might be stopped.
                     if (n.x != null) n.x += dx;
                     if (n.y != null) n.y += dy;
                     n.fx = n.x;
                     n.fy = n.y;
                 }
             });
         }
      }

      if (isMermaid) {
          // Force render update without advancing simulation
          // This ensures edges and other elements track the dragged node immediately
          const tickHandler = simulation.on('tick')
          if (typeof tickHandler === 'function') {
            ;(tickHandler as unknown as () => void)()
          }
      }
    })
    .on('end', (event, d) => {
      const isMermaid = schema.layout?.mode === 'mermaid';
      if (!isMermaid) {
         if (!event.active) simulation.alphaTarget(0);
         d.fx = null;
         d.fy = null;
      } else {
         // In Mermaid mode, we KEEP the fixed position so nodes stay where dropped
         // We do not clear fx/fy.
         // Also ensure simulation is stopped to save resources
         simulation.stop();
      }
      d.vx = 0;
      d.vy = 0;
      
      if (schema.layout?.mode === 'radial' || schema.layout?.mode === 'tree') {
        simulation.stop();
      }
    });
