import * as d3 from 'd3';
import { GraphNode, GraphEdge } from '@/lib/graph/types';
import { GraphSchema } from '@/lib/graph/schema';
import type { EdgeWithRuntime } from './simulation';
import { getEdgeEndpoints } from './simulation';

export const nodeDragBehavior = (simulation: d3.Simulation<GraphNode, GraphEdge>, schema: GraphSchema) =>
  d3.drag<SVGElement, GraphNode>()
    .on('start', function (event, d) {
      d3.select(this).raise()
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

      const prevX = typeof d.fx === 'number' && Number.isFinite(d.fx) ? d.fx : d.x;
      const prevY = typeof d.fy === 'number' && Number.isFinite(d.fy) ? d.fy : d.y;
      
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

      const nextX = typeof d.fx === 'number' && Number.isFinite(d.fx) ? d.fx : d.x;
      const nextY = typeof d.fy === 'number' && Number.isFinite(d.fy) ? d.fy : d.y;
      const dxApplied = typeof prevX === 'number' && typeof nextX === 'number' ? nextX - prevX : 0;
      const dyApplied = typeof prevY === 'number' && typeof nextY === 'number' ? nextY - prevY : 0;

      if (isMermaid && (dxApplied !== 0 || dyApplied !== 0)) {
        const nodes = simulation.nodes()
        const getSubgraphName = (node: GraphNode): string | null => {
          const props = (node.properties || {}) as Record<string, unknown>
          const raw = props['subgraphName']
          const name = typeof raw === 'string' ? raw.trim() : ''
          return name ? name : null
        }
        const getMemberSubgraphName = (node: GraphNode): string | null => {
          const props = (node.properties || {}) as Record<string, unknown>
          const raw = props['mermaidSubgraphName']
          const name = typeof raw === 'string' ? raw.trim() : ''
          return name ? name : null
        }

        const targetSubgraphName =
          String(d.type || '') === 'MermaidSubgraph' ? getSubgraphName(d) : getMemberSubgraphName(d)

        const movedNodeIds = new Set<string>()
        if (targetSubgraphName) {
          for (let i = 0; i < nodes.length; i += 1) {
            const n = nodes[i]
            const id = String(n.id || '')
            if (!id) continue
            if (String(n.type || '') === 'MermaidSubgraph') {
              const name = getSubgraphName(n)
              if (name === targetSubgraphName) movedNodeIds.add(id)
              continue
            }
            const memberName = getMemberSubgraphName(n)
            if (memberName === targetSubgraphName) movedNodeIds.add(id)
          }
        }

        if (movedNodeIds.size > 0) {
          for (let i = 0; i < nodes.length; i += 1) {
            const n = nodes[i]
            const id = String(n.id || '')
            if (!id || !movedNodeIds.has(id)) continue
            if (n === d) continue
            if (n.x != null) n.x += dxApplied
            if (n.y != null) n.y += dyApplied
            n.fx = n.x
            n.fy = n.y
          }

          const linkForce = simulation.force('link') as unknown as { links?: () => GraphEdge[] } | null
          const links = linkForce && typeof linkForce.links === 'function' ? linkForce.links() : null
          if (Array.isArray(links) && links.length > 0) {
            for (let i = 0; i < links.length; i += 1) {
              const edge = links[i]
              const { src, tgt } = getEdgeEndpoints(edge as EdgeWithRuntime)
              if (!src || !tgt) continue
              const srcMoved = movedNodeIds.has(src)
              const tgtMoved = movedNodeIds.has(tgt)
              if (!srcMoved && !tgtMoved) continue

              const props = (edge.properties || {}) as Record<string, unknown>
              const points = props['visual:points'] as Array<{ x: number; y: number }> | undefined
              if (!Array.isArray(points) || points.length === 0) continue

              if (srcMoved && tgtMoved) {
                for (let p = 0; p < points.length; p += 1) {
                  const pt = points[p]
                  if (typeof pt?.x === 'number') pt.x += dxApplied
                  if (typeof pt?.y === 'number') pt.y += dyApplied
                }
                continue
              }

              if (edge.properties) {
                delete (edge.properties as Record<string, unknown>)['visual:points']
              }
            }
          }
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
