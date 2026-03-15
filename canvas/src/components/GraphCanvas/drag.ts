import * as d3 from 'd3';
import { GraphNode, GraphEdge } from '@/lib/graph/types';
import { GraphSchema } from '@/lib/graph/schema';
import { readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig';
import { lockGlobalUserSelect, unlockGlobalUserSelect } from '@/lib/canvas/interaction-user-select'
import { isSpacePanHeld } from '@/lib/canvas/space-pan'
import { useGraphStore } from '@/hooks/useGraphStore'
import { readSnapGridConfigFromSchema, snapPointToGrid } from '@/lib/canvas/gridSnap'

export const nodeDragBehavior = (
  simulation: d3.Simulation<GraphNode, GraphEdge>,
  schema: GraphSchema,
  opts?: { onNodeDragEnd?: (node: GraphNode) => void; clampNodePosition?: (args: { node: GraphNode; x: number; y: number }) => { x: number; y: number } },
) =>
  (() => {
    let locked = false
    let frozenDrag = false
    const isFrozenFromEl = (el: SVGElement | null): boolean => {
      const svg = el?.ownerSVGElement
      return svg?.getAttribute('data-kg-layout-frozen') === '1'
    }
    return d3.drag<SVGElement, GraphNode>()
    .on('start', function (event, d) {
      if (useGraphStore.getState().canvasPointerMode2d === 'pan') return
      if (isSpacePanHeld()) return
      lockGlobalUserSelect()
      locked = true
      const mode = readLayoutMode(schema)
      const structured = mode === 'radial'

      frozenDrag = isFrozenFromEl(this as unknown as SVGElement)
      if (!structured && !frozenDrag && !event.active) {
        simulation.alphaTarget(0.08).restart();
      }
      d.fx = d.x;
      d.fy = d.y;
    })
    .on('drag', (event, d) => {
      if (useGraphStore.getState().canvasPointerMode2d === 'pan') return
      if (isSpacePanHeld()) return
      const mode = readLayoutMode(schema)
      const structured = mode === 'radial'
      const grid = readSnapGridConfigFromSchema(schema)
      const src = event && typeof event === 'object' && 'sourceEvent' in event ? (event as { sourceEvent?: unknown }).sourceEvent : null
      const altDown = !!(src && typeof src === 'object' && 'altKey' in (src as Record<string, unknown>) && (src as { altKey?: unknown }).altKey)
      
      // Calculate new position
      let nx = event.x;
      let ny = event.y;
      
      if (grid.enabled && !altDown) {
        const snapped = snapPointToGrid({ x: nx, y: ny }, grid.size)
        nx = snapped.x
        ny = snapped.y
      }

      if (opts?.clampNodePosition) {
        try {
          const clamped = opts.clampNodePosition({ node: d, x: nx, y: ny })
          nx = clamped.x
          ny = clamped.y
        } catch {
          void 0
        }
      }
      
      const constraint = schema.behavior.dragConstraint || 'free';
      if (constraint === 'axis-x') {
        d.fx = nx;
        if (structured || frozenDrag) d.x = nx;
      } else if (constraint === 'axis-y') {
        d.fy = ny;
        if (structured || frozenDrag) d.y = ny;
      } else if (constraint === 'none') {
        d.fx = d.x; // Keep original if 'none' constraint, though usually 'free' is default
        d.fy = d.y;
      } else {
        d.fx = nx;
        d.fy = ny;
        if (structured || frozenDrag) {
          d.x = nx;
          d.y = ny;
        }
      }

      if (structured || frozenDrag) {
        const tickHandler = simulation.on('tick')
        if (typeof tickHandler === 'function') {
          ;(tickHandler as unknown as () => void)()
        }
      }
    })
    .on('end', (event, d) => {
      if (useGraphStore.getState().canvasPointerMode2d === 'pan') return
      if (locked) {
        locked = false
        unlockGlobalUserSelect()
      }
      const mode = readLayoutMode(schema)
      const structured = mode === 'radial'
      if (!structured && !frozenDrag) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }
      d.vx = 0;
      d.vy = 0;
      frozenDrag = false

      try {
        opts?.onNodeDragEnd?.(d)
      } catch {
        void 0
      }
      
      if (structured) simulation.stop();
    });
  })()

export const edgeDragBehavior = (simulation: d3.Simulation<GraphNode, GraphEdge>, schema: GraphSchema) =>
  (() => {
    let locked = false
    let sourceNode: GraphNode | undefined
    let targetNode: GraphNode | undefined
    let frozenDrag = false

    const isFrozenFromEl = (el: SVGElement | null): boolean => {
      const svg = el?.ownerSVGElement
      return svg?.getAttribute('data-kg-layout-frozen') === '1'
    }

    return d3.drag<SVGElement, GraphEdge>()
      .on('start', function (event, d) {
        if (useGraphStore.getState().canvasPointerMode2d === 'pan') return
        if (isSpacePanHeld()) return
        lockGlobalUserSelect()
        locked = true
        
        // Find source and target nodes
        const nodes = simulation.nodes()
        const sId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source
        const tId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target
        sourceNode = nodes.find(n => String(n.id) === String(sId))
        targetNode = nodes.find(n => String(n.id) === String(tId))
        
        if (!sourceNode || !targetNode) return

        const mode = readLayoutMode(schema)
        const structured = mode === 'radial'
        frozenDrag = isFrozenFromEl(this as unknown as SVGElement)
        if (!structured && !frozenDrag && !event.active) {
          simulation.alphaTarget(0.08).restart();
        }
        
        // Fix nodes
        sourceNode.fx = sourceNode.x
        sourceNode.fy = sourceNode.y
        targetNode.fx = targetNode.x
        targetNode.fy = targetNode.y
      })
      .on('drag', (event) => {
        if (useGraphStore.getState().canvasPointerMode2d === 'pan') return
        if (isSpacePanHeld()) return
        if (!sourceNode || !targetNode) return

        const dx = event.dx
        const dy = event.dy
        
        // Move both nodes
        if (sourceNode.fx != null) sourceNode.fx += dx
        if (sourceNode.fy != null) sourceNode.fy += dy
        if (targetNode.fx != null) targetNode.fx += dx
        if (targetNode.fy != null) targetNode.fy += dy
        
        const mode = readLayoutMode(schema)
        const structured = mode === 'radial'
        
        if (structured || frozenDrag) {
             if (sourceNode.x != null) sourceNode.x += dx
             if (sourceNode.y != null) sourceNode.y += dy
             if (targetNode.x != null) targetNode.x += dx
             if (targetNode.y != null) targetNode.y += dy
        
            const tickHandler = simulation.on('tick')
            if (typeof tickHandler === 'function') {
              ;(tickHandler as unknown as () => void)()
            }
        }
      })
      .on('end', (event) => {
        if (useGraphStore.getState().canvasPointerMode2d === 'pan') return
        if (locked) {
            locked = false
            unlockGlobalUserSelect()
        }
        
        const mode = readLayoutMode(schema)
        const structured = mode === 'radial'
        if (!structured && !frozenDrag) {
            if (!event.active) simulation.alphaTarget(0);
            if (sourceNode) {
                sourceNode.fx = null
                sourceNode.fy = null
            }
            if (targetNode) {
                targetNode.fx = null
                targetNode.fy = null
            }
        }
        
        if (sourceNode) { sourceNode.vx = 0; sourceNode.vy = 0; }
        if (targetNode) { targetNode.vx = 0; targetNode.vy = 0; }

        sourceNode = undefined
        targetNode = undefined
        frozenDrag = false
        
        if (structured) simulation.stop();
      })
  })()
