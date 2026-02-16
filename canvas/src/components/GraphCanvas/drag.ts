import * as d3 from 'd3';
import { GraphNode, GraphEdge } from '@/lib/graph/types';
import { GraphSchema } from '@/lib/graph/schema';
import { readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig';
import { lockGlobalUserSelect, unlockGlobalUserSelect } from '@/lib/canvas/interaction-user-select'
import { isSpacePanHeld } from '@/lib/canvas/space-pan'

export const nodeDragBehavior = (simulation: d3.Simulation<GraphNode, GraphEdge>, schema: GraphSchema) =>
  (() => {
    let locked = false
    return d3.drag<SVGElement, GraphNode>()
    .on('start', function (event, d) {
      if (isSpacePanHeld()) return
      lockGlobalUserSelect()
      locked = true
      const mode = readLayoutMode(schema)
      const structured = mode === 'radial'
      if (!structured && !event.active) {
         simulation.alphaTarget(0.3).restart();
      }
      d.fx = d.x;
      d.fy = d.y;
    })
    .on('drag', (event, d) => {
      if (isSpacePanHeld()) return
      const mode = readLayoutMode(schema)
      const structured = mode === 'radial'
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
        if (structured) d.x = nx;
      } else if (constraint === 'axis-y') {
        d.fy = ny;
        if (structured) d.y = ny;
      } else if (constraint === 'none') {
        d.fx = d.x; // Keep original if 'none' constraint, though usually 'free' is default
        d.fy = d.y;
      } else {
        d.fx = nx;
        d.fy = ny;
        if (structured) {
          d.x = nx;
          d.y = ny;
        }
      }

      if (structured) {
        const tickHandler = simulation.on('tick')
        if (typeof tickHandler === 'function') {
          ;(tickHandler as unknown as () => void)()
        }
      }
    })
    .on('end', (event, d) => {
      if (locked) {
        locked = false
        unlockGlobalUserSelect()
      }
      const mode = readLayoutMode(schema)
      const structured = mode === 'radial'
      if (!structured) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }
      d.vx = 0;
      d.vy = 0;
      
      if (structured) simulation.stop();
    });
  })()
